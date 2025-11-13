"""
FastAPI main application for PhishShield backend.
"""
import time
import os
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .schemas import (
    EmailData, AnalysisResult, UserFeedback, WhitelistEntry, BlacklistEntry, HealthCheck
)
from .analyzer import EmailAnalyzer
from .db import DatabaseManager


# Global variables for application state
db_manager: Optional[DatabaseManager] = None
email_analyzer: Optional[EmailAnalyzer] = None
app_start_time = time.time()


def get_db_manager() -> DatabaseManager:
    """Get the database manager instance."""
    if db_manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database manager not initialized"
        )
    return db_manager


def get_email_analyzer() -> EmailAnalyzer:
    """Get the email analyzer instance."""
    if email_analyzer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email analyzer not initialized"
        )
    return email_analyzer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global db_manager, email_analyzer
    
    # Startup
    print("🚀 Starting PhishShield API...")
    
    # Initialize database
    db_path = os.getenv("DATABASE_PATH", "phishshield.db")
    db_manager = DatabaseManager(db_path)
    print(f"✅ Database initialized: {db_path}")
    
    # Initialize email analyzer
    email_analyzer = EmailAnalyzer(db_manager)
    print(f"✅ Email analyzer initialized with {len(email_analyzer.rules.rules)} rules")
    
    # Add some default entries for testing
    if not db_manager.get_whitelist():
        db_manager.add_to_whitelist("*@trusted-domain.com", "system", "Default trusted domain")
        db_manager.add_to_whitelist("admin@company.com", "system", "Company admin")
        print("✅ Added default whitelist entries")
    
    print("🎉 PhishShield API is ready!")
    
    yield
    
    # Shutdown
    print("👋 Shutting down PhishShield API...")


# Create FastAPI app
app = FastAPI(
    title="PhishShield API",
    description="Advanced phishing detection API for email security",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "chrome-extension://*",
        "moz-extension://*", 
        "ms-browser-extension://*",
        "http://localhost:3000",  # React dev server
        "http://localhost:8000"   # FastAPI dev server
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=Dict[str, str])
async def root():
    """Root endpoint with basic API information."""
    return {
        "message": "PhishShield API - Advanced Email Security",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health", response_model=HealthCheck)
async def health_check():
    """Health check endpoint."""
    analyzer = get_email_analyzer()
    return HealthCheck(
        status="healthy",
        version="1.0.0",
        uptime=time.time() - app_start_time,
        rules_loaded=len(analyzer.rules.rules)
    )


@app.post("/analyze", response_model=AnalysisResult)
async def analyze_email(
    email_data: EmailData,
    background_tasks: BackgroundTasks
):
    """
    Analyze email for phishing indicators.
    
    This is the main endpoint that performs comprehensive phishing analysis
    on the provided email data using pattern-based rules, header checks,
    and URL analysis.
    """
    try:
        # Perform analysis
        analyzer = get_email_analyzer()
        result = analyzer.analyze(email_data)
        
        # Log analysis in background
        background_tasks.add_task(
            log_analysis_result,
            email_data,
            result
        )
        
        return result
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@app.post("/feedback")
async def submit_feedback(feedback: UserFeedback):
    """Submit user feedback on analysis results."""
    try:
        db = get_db_manager()
        success = db.log_user_feedback(
            feedback.message_id,
            feedback.is_phishing,
            feedback.feedback_type,
            feedback.comments
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save feedback"
            )
        
        return {"message": "Feedback submitted successfully"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit feedback: {str(e)}"
        )


@app.get("/whitelist")
async def get_whitelist():
    """Get all whitelist entries."""
    try:
        db = get_db_manager()
        whitelist = db.get_whitelist()
        return {"whitelist": whitelist}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get whitelist: {str(e)}"
        )


@app.post("/whitelist")
async def add_to_whitelist(entry: WhitelistEntry):
    """Add entry to whitelist."""
    try:
        db = get_db_manager()
        success = db.add_to_whitelist(
            entry.email_address,
            entry.added_by,
            entry.reason
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add to whitelist"
            )
        
        return {"message": f"Added {entry.email_address} to whitelist"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add to whitelist: {str(e)}"
        )


@app.delete("/whitelist/{email_address}")
async def remove_from_whitelist(email_address: str):
    """Remove entry from whitelist."""
    try:
        db = get_db_manager()
        success = db.remove_from_whitelist(email_address)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email address not found in whitelist"
            )
        
        return {"message": f"Removed {email_address} from whitelist"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove from whitelist: {str(e)}"
        )


@app.get("/blacklist")
async def get_blacklist():
    """Get all blacklist entries."""
    try:
        db = get_db_manager()
        blacklist = db.get_blacklist()
        return {"blacklist": blacklist}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get blacklist: {str(e)}"
        )


@app.post("/blacklist")
async def add_to_blacklist(entry: BlacklistEntry):
    """Add entry to blacklist."""
    try:
        db = get_db_manager()
        success = db.add_to_blacklist(
            entry.email_address,
            entry.added_by,
            entry.reason
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to add to blacklist"
            )
        
        return {"message": f"Added {entry.email_address} to blacklist"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add to blacklist: {str(e)}"
        )


@app.delete("/blacklist/{email_address}")
async def remove_from_blacklist(email_address: str):
    """Remove entry from blacklist."""
    try:
        db = get_db_manager()
        success = db.remove_from_blacklist(email_address)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Email address not found in blacklist"
            )
        
        return {"message": f"Removed {email_address} from blacklist"}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove from blacklist: {str(e)}"
        )


@app.get("/stats")
async def get_analysis_stats(days: int = Query(30, ge=1, le=365)):
    """Get analysis statistics for the specified number of days."""
    try:
        db = get_db_manager()
        stats = db.get_analysis_stats(days)
        return stats
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get statistics: {str(e)}"
        )


@app.get("/recent-analyses")
async def get_recent_analyses(limit: int = Query(50, ge=1, le=500)):
    """Get recent analysis results."""
    try:
        db = get_db_manager()
        analyses = db.get_recent_analyses(limit)
        return {"analyses": analyses}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get recent analyses: {str(e)}"
        )


@app.get("/rules")
async def get_rules():
    """Get information about loaded detection rules."""
    try:
        analyzer = get_email_analyzer()
        rules_info = {
            "total_rules": len(analyzer.rules.rules),
            "categories": analyzer.rules.get_rule_categories(),
            "rules_by_category": {
                category: len(analyzer.rules.get_rules_by_category(category))
                for category in analyzer.rules.get_rule_categories()
            }
        }
        return rules_info
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get rules information: {str(e)}"
        )


@app.post("/test-analyze")
async def test_analyze():
    """Test endpoint with sample phishing email for demonstration."""
    sample_email = EmailData(
        subject="URGENT: Your Account Will Be Suspended!",
        **{"from": "security@suspicious-bank.tk"},
        to=["user@company.com"],
        body="""
        Dear Customer,
        
        Your account has been compromised and will be suspended immediately unless
        you verify your identity by clicking the link below:
        
        http://192.168.1.100/verify-account
        
        You have won $1,000,000 in our lottery! Click here to claim your prize!
        
        This is urgent - act now or face legal consequences!
        
        Best regards,
        Bank Security Team
        """,
        links=["http://192.168.1.100/verify-account", "http://malicious-site.tk/claim-prize"],
        headers={
            "Received-SPF": "fail",
            "Authentication-Results": "dkim=fail"
        },
        attachments=["invoice.exe", "document.zip"]
    )
    
    analyzer = get_email_analyzer()
    result = analyzer.analyze(sample_email)
    return result


# Background task functions
async def log_analysis_result(email_data: EmailData, result: AnalysisResult):
    """Background task to log analysis results."""
    try:
        db = get_db_manager()
        flags_dict = [
            {
                "type": flag.type,
                "severity": flag.severity,
                "description": flag.description,
                "details": flag.details
            }
            for flag in result.flags
        ]
        
        db.log_analysis(
            email_from=email_data.from_address,
            email_subject=email_data.subject,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            flags=flags_dict,
            analysis_time=result.analysis_time,
            message_id=email_data.message_id
        )
    except Exception as e:
        print(f"Failed to log analysis result: {e}")


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler."""
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred. Please try again later.",
            "detail": str(exc) if os.getenv("DEBUG", "false").lower() == "true" else None
        }
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"🚀 Starting PhishShield API on {host}:{port}")
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level="info"
    )