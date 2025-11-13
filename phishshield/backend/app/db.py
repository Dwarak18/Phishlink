"""
Database manager for PhishShield - handles whitelist/blacklist and audit logging.
"""
import sqlite3
import json
import time
from typing import List, Dict, Optional, Any
from contextlib import contextmanager
from pathlib import Path


class DatabaseManager:
    """Manages SQLite database for PhishShield."""
    
    def __init__(self, db_path: str = "phishshield.db"):
        self.db_path = Path(db_path)
        self.init_database()
    
    def init_database(self):
        """Initialize database tables."""
        with self.get_connection() as conn:
            # Whitelist table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS whitelist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_address TEXT UNIQUE NOT NULL,
                    added_by TEXT DEFAULT 'user',
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reason TEXT,
                    is_active BOOLEAN DEFAULT 1
                )
            """)
            
            # Blacklist table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS blacklist (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_address TEXT UNIQUE NOT NULL,
                    added_by TEXT DEFAULT 'user',
                    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reason TEXT,
                    is_active BOOLEAN DEFAULT 1
                )
            """)
            
            # Audit log table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    email_from TEXT,
                    email_subject TEXT,
                    risk_score REAL,
                    risk_level TEXT,
                    flags_json TEXT,
                    user_feedback TEXT,
                    analysis_time REAL,
                    message_id TEXT
                )
            """)
            
            # User feedback table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_feedback (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    message_id TEXT,
                    is_phishing BOOLEAN,
                    feedback_type TEXT,
                    comments TEXT
                )
            """)
            
            # Create indexes for better performance
            conn.execute("CREATE INDEX IF NOT EXISTS idx_whitelist_email ON whitelist(email_address)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_blacklist_email ON blacklist(email_address)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON user_feedback(message_id)")
            
            conn.commit()
    
    @contextmanager
    def get_connection(self):
        """Get database connection with proper error handling."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Enable dict-like access
        try:
            yield conn
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    # Whitelist management
    def add_to_whitelist(self, email_address: str, added_by: str = "user", reason: Optional[str] = None) -> bool:
        """Add email/domain to whitelist."""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO whitelist (email_address, added_by, reason)
                    VALUES (?, ?, ?)
                """, (email_address.lower(), added_by, reason))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding to whitelist: {e}")
            return False
    
    def remove_from_whitelist(self, email_address: str) -> bool:
        """Remove email/domain from whitelist."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    UPDATE whitelist SET is_active = 0 
                    WHERE email_address = ? AND is_active = 1
                """, (email_address.lower(),))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error removing from whitelist: {e}")
            return False
    
    def is_whitelisted(self, email_address: str) -> bool:
        """Check if email/domain is whitelisted."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT 1 FROM whitelist 
                    WHERE email_address = ? AND is_active = 1
                """, (email_address.lower(),))
                return cursor.fetchone() is not None
        except Exception as e:
            print(f"Error checking whitelist: {e}")
            return False
    
    def get_whitelist(self) -> List[Dict[str, Any]]:
        """Get all active whitelist entries."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT email_address, added_by, added_at, reason
                    FROM whitelist 
                    WHERE is_active = 1
                    ORDER BY added_at DESC
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error getting whitelist: {e}")
            return []
    
    # Blacklist management
    def add_to_blacklist(self, email_address: str, added_by: str = "user", reason: Optional[str] = None) -> bool:
        """Add email/domain to blacklist."""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO blacklist (email_address, added_by, reason)
                    VALUES (?, ?, ?)
                """, (email_address.lower(), added_by, reason))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error adding to blacklist: {e}")
            return False
    
    def remove_from_blacklist(self, email_address: str) -> bool:
        """Remove email/domain from blacklist."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    UPDATE blacklist SET is_active = 0 
                    WHERE email_address = ? AND is_active = 1
                """, (email_address.lower(),))
                conn.commit()
                return cursor.rowcount > 0
        except Exception as e:
            print(f"Error removing from blacklist: {e}")
            return False
    
    def is_blacklisted(self, email_address: str) -> bool:
        """Check if email/domain is blacklisted."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT 1 FROM blacklist 
                    WHERE email_address = ? AND is_active = 1
                """, (email_address.lower(),))
                return cursor.fetchone() is not None
        except Exception as e:
            print(f"Error checking blacklist: {e}")
            return False
    
    def get_blacklist(self) -> List[Dict[str, Any]]:
        """Get all active blacklist entries."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT email_address, added_by, added_at, reason
                    FROM blacklist 
                    WHERE is_active = 1
                    ORDER BY added_at DESC
                """)
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error getting blacklist: {e}")
            return []
    
    # Audit logging
    def log_analysis(self, email_from: str, email_subject: str, risk_score: float, 
                    risk_level: str, flags: List[Dict], analysis_time: float, 
                    message_id: Optional[str] = None) -> bool:
        """Log analysis results for audit trail."""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO audit_log 
                    (email_from, email_subject, risk_score, risk_level, flags_json, 
                     analysis_time, message_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    email_from,
                    email_subject[:500],  # Truncate long subjects
                    risk_score,
                    risk_level,
                    json.dumps(flags),
                    analysis_time,
                    message_id
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error logging analysis: {e}")
            return False
    
    def log_user_feedback(self, message_id: str, is_phishing: bool, 
                         feedback_type: str, comments: Optional[str] = None) -> bool:
        """Log user feedback on analysis results."""
        try:
            with self.get_connection() as conn:
                conn.execute("""
                    INSERT INTO user_feedback (message_id, is_phishing, feedback_type, comments)
                    VALUES (?, ?, ?, ?)
                """, (message_id, is_phishing, feedback_type, comments))
                conn.commit()
                return True
        except Exception as e:
            print(f"Error logging user feedback: {e}")
            return False
    
    def get_analysis_stats(self, days: int = 30) -> Dict[str, Any]:
        """Get analysis statistics for the last N days."""
        try:
            with self.get_connection() as conn:
                # Basic stats
                cursor = conn.execute("""
                    SELECT 
                        COUNT(*) as total_analyses,
                        AVG(risk_score) as avg_risk_score,
                        COUNT(CASE WHEN risk_level = 'high' OR risk_level = 'critical' THEN 1 END) as high_risk_count,
                        AVG(analysis_time) as avg_analysis_time
                    FROM audit_log 
                    WHERE timestamp >= datetime('now', '-{} days')
                """.format(days))
                
                stats = dict(cursor.fetchone())
                
                # Risk level distribution
                cursor = conn.execute("""
                    SELECT risk_level, COUNT(*) as count
                    FROM audit_log 
                    WHERE timestamp >= datetime('now', '-{} days')
                    GROUP BY risk_level
                """.format(days))
                
                stats['risk_distribution'] = {row['risk_level']: row['count'] 
                                            for row in cursor.fetchall()}
                
                return stats
        except Exception as e:
            print(f"Error getting analysis stats: {e}")
            return {}
    
    def get_recent_analyses(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent analysis results."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    SELECT timestamp, email_from, email_subject, risk_score, 
                           risk_level, analysis_time, message_id
                    FROM audit_log 
                    ORDER BY timestamp DESC 
                    LIMIT ?
                """, (limit,))
                return [dict(row) for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error getting recent analyses: {e}")
            return []
    
    def cleanup_old_data(self, days: int = 90) -> int:
        """Clean up old audit data (older than N days)."""
        try:
            with self.get_connection() as conn:
                cursor = conn.execute("""
                    DELETE FROM audit_log 
                    WHERE timestamp < datetime('now', '-{} days')
                """.format(days))
                
                deleted_count = cursor.rowcount
                conn.commit()
                return deleted_count
        except Exception as e:
            print(f"Error cleaning up old data: {e}")
            return 0