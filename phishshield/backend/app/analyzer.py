"""
Email analyzer for PhishShield - performs phishing detection analysis.
"""
import time
import re
from typing import List, Dict, Optional, Set
from urllib.parse import urlparse
from .schemas import EmailData, AnalysisResult, RiskFlag
from .rules import PhishingRules
from .db import DatabaseManager


class EmailAnalyzer:
    """Main email analysis engine."""
    
    def __init__(self, db_manager: DatabaseManager):
        self.rules = PhishingRules()
        self.db = db_manager
        
        # Risk level thresholds
        self.risk_thresholds = {
            'safe': 0,
            'low': 25,
            'medium': 50,
            'high': 75,
            'critical': 90
        }
    
    def analyze(self, email_data: EmailData) -> AnalysisResult:
        """Perform comprehensive phishing analysis on email data."""
        start_time = time.time()
        
        # Check whitelist/blacklist first
        sender_status = self._check_sender_lists(email_data.from_address)
        if sender_status['whitelisted']:
            return self._create_safe_result(
                analysis_time=time.time() - start_time,
                whitelisted=True
            )
        
        flags = []
        total_score = 0
        
        # Blacklist check
        if sender_status['blacklisted']:
            flags.append(RiskFlag(
                type="blacklisted_sender",
                severity="critical",
                description="Sender is on the blacklist",
                details=f"Sender {email_data.from_address} is blacklisted"
            ))
            total_score += 90  # High penalty for blacklisted senders
        
        # Rule-based analysis
        rule_flags, rule_score = self._analyze_with_rules(email_data)
        flags.extend(rule_flags)
        total_score += rule_score
        
        # Header analysis (if available)
        if email_data.headers:
            header_flags, header_score = self._analyze_headers(email_data.headers)
            flags.extend(header_flags)
            total_score += header_score
        
        # URL analysis
        if email_data.links:
            url_flags, url_score = self._analyze_urls(email_data.links)
            flags.extend(url_flags)
            total_score += url_score
        
        # Sender-domain mismatch analysis
        mismatch_flags, mismatch_score = self._analyze_sender_domain_mismatch(
            email_data.from_address, email_data.body
        )
        flags.extend(mismatch_flags)
        total_score += mismatch_score
        
        # Cap the score at 100
        risk_score = min(total_score, 100)
        risk_level = self._calculate_risk_level(risk_score)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(flags, email_data)
        
        analysis_time = time.time() - start_time
        
        return AnalysisResult(
            risk_score=risk_score,
            risk_level=risk_level,
            flags=flags,
            recommendations=recommendations,
            analysis_time=analysis_time,
            whitelisted=sender_status['whitelisted'],
            blacklisted=sender_status['blacklisted']
        )
    
    def _check_sender_lists(self, sender: str) -> Dict[str, bool]:
        """Check if sender is in whitelist or blacklist."""
        # Extract domain from email
        domain = sender.split('@')[-1] if '@' in sender else sender
        
        # Check exact email and domain
        whitelisted = (
            self.db.is_whitelisted(sender) or 
            self.db.is_whitelisted(domain) or
            self.db.is_whitelisted(f"*@{domain}")
        )
        
        blacklisted = (
            self.db.is_blacklisted(sender) or 
            self.db.is_blacklisted(domain) or
            self.db.is_blacklisted(f"*@{domain}")
        )
        
        return {'whitelisted': whitelisted, 'blacklisted': blacklisted}
    
    def _analyze_with_rules(self, email_data: EmailData) -> tuple[List[RiskFlag], float]:
        """Analyze email using pattern-based rules."""
        flags = []
        total_score = 0
        seen_patterns = set()  # Avoid duplicate flags
        
        # Check subject
        subject_matches = self.rules.check_subject(email_data.subject)
        for rule, matches in subject_matches:
            if rule.name not in seen_patterns:
                flags.append(RiskFlag(
                    type=f"subject_{rule.category}",
                    severity=self._weight_to_severity(rule.weight),
                    description=f"Suspicious pattern in subject: {rule.description}",
                    details=f"Matched: {', '.join(matches[:3])}",  # Show first 3 matches
                    matched_pattern=rule.pattern
                ))
                total_score += rule.weight
                seen_patterns.add(rule.name)
        
        # Check body
        body_matches = self.rules.check_body(email_data.body)
        for rule, matches in body_matches:
            if rule.name not in seen_patterns:
                flags.append(RiskFlag(
                    type=f"body_{rule.category}",
                    severity=self._weight_to_severity(rule.weight),
                    description=f"Suspicious pattern in body: {rule.description}",
                    details=f"Matched: {', '.join(matches[:3])}",
                    matched_pattern=rule.pattern
                ))
                total_score += rule.weight
                seen_patterns.add(rule.name)
        
        # Check sender
        sender_matches = self.rules.check_sender(email_data.from_address)
        for rule, matches in sender_matches:
            if rule.name not in seen_patterns:
                flags.append(RiskFlag(
                    type=f"sender_{rule.category}",
                    severity=self._weight_to_severity(rule.weight),
                    description=f"Suspicious sender pattern: {rule.description}",
                    details=f"Sender: {email_data.from_address}",
                    matched_pattern=rule.pattern
                ))
                total_score += rule.weight
                seen_patterns.add(rule.name)
        
        # Check links
        if email_data.links:
            link_matches = self.rules.check_links(email_data.links)
            for rule, matches in link_matches:
                if rule.name not in seen_patterns:
                    flags.append(RiskFlag(
                        type=f"link_{rule.category}",
                        severity=self._weight_to_severity(rule.weight),
                        description=f"Suspicious link pattern: {rule.description}",
                        details=f"Suspicious links found: {len(matches)}",
                        matched_pattern=rule.pattern
                    ))
                    total_score += rule.weight
                    seen_patterns.add(rule.name)
        
        return flags, total_score
    
    def _analyze_headers(self, headers: Dict[str, str]) -> tuple[List[RiskFlag], float]:
        """Analyze email headers for authenticity indicators."""
        flags = []
        score = 0
        
        # Check SPF
        received_spf = headers.get('Received-SPF', '').lower()
        if 'fail' in received_spf:
            flags.append(RiskFlag(
                type="spf_fail",
                severity="high",
                description="SPF authentication failed",
                details="Sender's IP is not authorized to send emails for this domain"
            ))
            score += 35
        elif 'softfail' in received_spf:
            flags.append(RiskFlag(
                type="spf_softfail",
                severity="medium",
                description="SPF soft failure",
                details="Sender's IP is questionable for this domain"
            ))
            score += 20
        
        # Check DKIM
        dkim_signature = headers.get('DKIM-Signature', '')
        authentication_results = headers.get('Authentication-Results', '').lower()
        
        if 'dkim=fail' in authentication_results:
            flags.append(RiskFlag(
                type="dkim_fail",
                severity="high",
                description="DKIM signature verification failed",
                details="Email signature is invalid or tampered"
            ))
            score += 30
        elif not dkim_signature and 'dkim=none' in authentication_results:
            flags.append(RiskFlag(
                type="dkim_missing",
                severity="low",
                description="No DKIM signature found",
                details="Email lacks cryptographic signature"
            ))
            score += 10
        
        # Check for suspicious routing
        received_headers = [v for k, v in headers.items() if k.lower().startswith('received')]
        if len(received_headers) > 10:
            flags.append(RiskFlag(
                type="excessive_hops",
                severity="medium",
                description="Excessive email routing hops",
                details=f"Email passed through {len(received_headers)} servers"
            ))
            score += 15
        
        return flags, score
    
    def _analyze_urls(self, urls: List[str]) -> tuple[List[RiskFlag], float]:
        """Analyze URLs for suspicious characteristics."""
        flags = []
        score = 0
        suspicious_count = 0
        
        for url in urls:
            try:
                parsed = urlparse(url)
                
                # Check for URL shorteners
                shortener_domains = [
                    'bit.ly', 'tinyurl.com', 'short.link', 't.co', 'goo.gl',
                    'ow.ly', 'buff.ly', 'is.gd', 'tiny.cc'
                ]
                
                if parsed.netloc.lower() in shortener_domains:
                    suspicious_count += 1
                
                # Check for suspicious TLDs
                suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.click', '.download']
                if any(parsed.netloc.endswith(tld) for tld in suspicious_tlds):
                    suspicious_count += 1
                
                # Check for homograph attacks (basic)
                if self._contains_suspicious_chars(parsed.netloc):
                    suspicious_count += 1
                    
            except Exception:
                # Invalid URL format
                suspicious_count += 1
        
        if suspicious_count > 0:
            severity = "high" if suspicious_count >= len(urls) * 0.5 else "medium"
            flags.append(RiskFlag(
                type="suspicious_urls",
                severity=severity,
                description="Suspicious URLs detected",
                details=f"{suspicious_count} out of {len(urls)} URLs appear suspicious"
            ))
            score += min(suspicious_count * 20, 50)  # Cap at 50 points
        
        return flags, score
    
    def _analyze_sender_domain_mismatch(self, sender: str, body: str) -> tuple[List[RiskFlag], float]:
        """Check for sender domain vs claimed identity mismatch."""
        flags = []
        score = 0
        
        if '@' not in sender:
            return flags, score
        
        sender_domain = sender.split('@')[1].lower()
        body_lower = body.lower()
        
        # Common companies that are often impersonated
        company_domains = {
            'microsoft': ['microsoft.com', 'outlook.com', 'hotmail.com'],
            'google': ['google.com', 'gmail.com'],
            'apple': ['apple.com', 'icloud.com'],
            'amazon': ['amazon.com'],
            'paypal': ['paypal.com'],
            'ebay': ['ebay.com'],
            'facebook': ['facebook.com'],
            'twitter': ['twitter.com'],
            'instagram': ['instagram.com']
        }
        
        for company, domains in company_domains.items():
            if company in body_lower and not any(domain in sender_domain for domain in domains):
                flags.append(RiskFlag(
                    type="domain_mismatch",
                    severity="high",
                    description=f"Sender domain mismatch for {company.title()}",
                    details=f"Email claims to be from {company.title()} but sender domain is {sender_domain}"
                ))
                score += 40
                break
        
        return flags, score
    
    def _contains_suspicious_chars(self, domain: str) -> bool:
        """Check for suspicious characters that might indicate homograph attacks."""
        # This is a basic check - a full implementation would be more comprehensive
        suspicious_chars = ['ο', '0', 'о', 'а', 'е', 'р', 'х', 'у']  # Cyrillic lookalikes
        return any(char in domain for char in suspicious_chars)
    
    def _weight_to_severity(self, weight: float) -> str:
        """Convert rule weight to severity level."""
        if weight >= 35:
            return "high"
        elif weight >= 25:
            return "medium"
        else:
            return "low"
    
    def _calculate_risk_level(self, score: float) -> str:
        """Calculate risk level based on score."""
        for level in ['critical', 'high', 'medium', 'low', 'safe']:
            if score >= self.risk_thresholds[level]:
                return level
        return 'safe'
    
    def _generate_recommendations(self, flags: List[RiskFlag], email_data: EmailData) -> List[str]:
        """Generate security recommendations based on detected flags."""
        recommendations = []
        flag_types = {flag.type for flag in flags}
        
        if any('blacklisted' in ft for ft in flag_types):
            recommendations.append("⚠️ DO NOT interact with this email - sender is blacklisted")
            recommendations.append("Report this email to your IT security team")
        
        if any('link' in ft for ft in flag_types):
            recommendations.append("🔗 Do not click on any links in this email")
            recommendations.append("Verify URLs by hovering over them before clicking")
        
        if any('credential' in ft for ft in flag_types):
            recommendations.append("🔐 Never enter passwords or personal information via email links")
            recommendations.append("Access accounts directly through official websites")
        
        if any('urgent' in ft or 'threat' in ft for ft in flag_types):
            recommendations.append("⏰ Be suspicious of urgent demands - legitimate companies give reasonable time")
            recommendations.append("Verify urgency through official channels")
        
        if any('financial' in ft for ft in flag_types):
            recommendations.append("💳 Contact your bank or financial institution directly to verify any issues")
            recommendations.append("Do not provide financial information via email")
        
        if any('attachment' in ft for ft in flag_types):
            recommendations.append("📎 Do not open attachments from unknown or suspicious senders")
            recommendations.append("Scan attachments with antivirus before opening")
        
        if any('domain_mismatch' in ft for ft in flag_types):
            recommendations.append("🏢 Verify the actual sender - the email may be impersonating a legitimate company")
        
        if any('spf' in ft or 'dkim' in ft for ft in flag_types):
            recommendations.append("📧 Email failed authentication checks - treat with extreme caution")
        
        # General recommendations if high risk
        high_risk_flags = [f for f in flags if f.severity in ['high', 'critical']]
        if high_risk_flags:
            recommendations.extend([
                "🚨 This email shows multiple signs of being a phishing attempt",
                "Consider reporting this email to your organization's security team",
                "Do not forward or share this email with others"
            ])
        
        return recommendations[:10]  # Limit to 10 recommendations
    
    def _create_safe_result(self, analysis_time: float, whitelisted: bool = False) -> AnalysisResult:
        """Create a safe analysis result."""
        return AnalysisResult(
            risk_score=0.0,
            risk_level="safe",
            flags=[],
            recommendations=["✅ This email appears to be safe"] if whitelisted else [],
            analysis_time=analysis_time,
            whitelisted=whitelisted,
            blacklisted=False
        )