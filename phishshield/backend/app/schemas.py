"""
Pydantic schemas for the PhishShield API.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class EmailData(BaseModel):
    """Schema for email data to be analyzed."""
    subject: str = Field(..., description="Email subject line")
    from_address: str = Field(..., alias="from", description="Sender email address")
    to_addresses: List[str] = Field(default_factory=list, alias="to", description="Recipient email addresses")
    body: str = Field(..., description="Email body content")
    links: List[str] = Field(default_factory=list, description="URLs found in the email")
    headers: Optional[Dict[str, str]] = Field(default=None, description="Email headers for SPF/DKIM checks")
    attachments: List[str] = Field(default_factory=list, description="Attachment names/types")
    message_id: Optional[str] = Field(default=None, description="Email message ID")


class RiskFlag(BaseModel):
    """Schema for individual risk flags."""
    type: str = Field(..., description="Type of risk detected")
    severity: str = Field(..., description="Risk severity: low, medium, high, critical")
    description: str = Field(..., description="Human-readable description of the risk")
    details: Optional[str] = Field(default=None, description="Additional details about the risk")
    matched_pattern: Optional[str] = Field(default=None, description="Pattern that triggered this flag")


class AnalysisResult(BaseModel):
    """Schema for analysis results."""
    risk_score: float = Field(..., ge=0, le=100, description="Overall risk score (0-100)")
    risk_level: str = Field(..., description="Risk level: safe, low, medium, high, critical")
    flags: List[RiskFlag] = Field(default_factory=list, description="List of detected risk flags")
    recommendations: List[str] = Field(default_factory=list, description="Security recommendations")
    analysis_time: float = Field(..., description="Time taken for analysis in seconds")
    whitelisted: bool = Field(default=False, description="Whether sender is whitelisted")
    blacklisted: bool = Field(default=False, description="Whether sender is blacklisted")


class UserFeedback(BaseModel):
    """Schema for user feedback on analysis results."""
    message_id: str = Field(..., description="Email message ID")
    is_phishing: bool = Field(..., description="User's assessment: true if phishing, false if legitimate")
    feedback_type: str = Field(..., description="Type of feedback: report_phishing, mark_safe, false_positive")
    comments: Optional[str] = Field(default=None, description="Additional user comments")


class WhitelistEntry(BaseModel):
    """Schema for whitelist entries."""
    email_address: str = Field(..., description="Email address or domain to whitelist")
    added_by: str = Field(default="user", description="Who added this entry")
    reason: Optional[str] = Field(default=None, description="Reason for whitelisting")


class BlacklistEntry(BaseModel):
    """Schema for blacklist entries."""
    email_address: str = Field(..., description="Email address or domain to blacklist")
    added_by: str = Field(default="user", description="Who added this entry")
    reason: Optional[str] = Field(default=None, description="Reason for blacklisting")


class HealthCheck(BaseModel):
    """Schema for health check response."""
    status: str = Field(..., description="Service status")
    version: str = Field(..., description="API version")
    uptime: float = Field(..., description="Service uptime in seconds")
    rules_loaded: int = Field(..., description="Number of detection rules loaded")