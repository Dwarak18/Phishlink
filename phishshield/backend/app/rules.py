"""
Pattern-based phishing detection rules for PhishShield.
"""
import re
from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class Rule:
    """Represents a phishing detection rule."""
    name: str
    pattern: str
    weight: float
    category: str
    description: str
    flags: int = re.IGNORECASE


class PhishingRules:
    """Container for all phishing detection rules."""
    
    def __init__(self):
        self.rules = self._load_rules()
        self.compiled_rules = self._compile_rules()
    
    def _load_rules(self) -> List[Rule]:
        """Load all phishing detection rules."""
        return [
            # Urgent action patterns
            Rule(
                name="urgent_action",
                pattern=r"\b(urgent|immediate|act now|expires?(?:\s+(?:today|soon))?|limited time|hurry|asap|emergency)\b",
                weight=25.0,
                category="urgency",
                description="Urgent action language commonly used in phishing"
            ),
            
            # Suspicious financial patterns
            Rule(
                name="financial_urgency",
                pattern=r"\b(account (?:suspended|locked|frozen|compromised)|verify (?:your )?account|payment (?:failed|required)|billing (?:issue|problem)|refund (?:pending|available))\b",
                weight=35.0,
                category="financial",
                description="Financial urgency language"
            ),
            
            # Generic greeting patterns (lack of personalization)
            Rule(
                name="generic_greeting",
                pattern=r"^(?:dear (?:customer|user|sir|madam|valued customer)|hello|hi there|greetings)(?:\s*[,.]|\s*$)",
                weight=15.0,
                category="personalization",
                description="Generic greeting suggesting mass email"
            ),
            
            # Suspicious links patterns
            Rule(
                name="suspicious_tld",
                pattern=r"https?://[^\s]*\.(?:tk|ml|ga|cf|click|download|zip|exe|bit\.ly|tinyurl|short)",
                weight=30.0,
                category="links",
                description="Suspicious top-level domains or URL shorteners"
            ),
            
            # IP address links
            Rule(
                name="ip_address_link",
                pattern=r"https?://(?:\d{1,3}\.){3}\d{1,3}",
                weight=40.0,
                category="links",
                description="Links containing IP addresses instead of domains"
            ),
            
            # Suspicious attachments
            Rule(
                name="suspicious_attachment",
                pattern=r"\b(?:attachment|attached|download|file).*\.(?:exe|scr|bat|com|pif|zip|rar|doc|docx|xls|xlsx).*\b",
                weight=25.0,
                category="attachments",
                description="Potentially dangerous attachment types"
            ),
            
            # Prize/lottery scams
            Rule(
                name="lottery_scam",
                pattern=r"\b(?:won|winner|lottery|prize|congratulations|jackpot|\$\d+(?:,\d{3})*(?:\.\d{2})?|million dollars?)\b",
                weight=35.0,
                category="scam",
                description="Lottery or prize scam language"
            ),
            
            # Login/credential harvesting
            Rule(
                name="credential_harvesting",
                pattern=r"\b(?:click (?:here|below)|log\s?in|sign\s?in|verify (?:your )?(?:identity|account|password)|update (?:your )?(?:information|details))\b",
                weight=30.0,
                category="credentials",
                description="Credential harvesting attempts"
            ),
            
            # Authority impersonation
            Rule(
                name="authority_impersonation",
                pattern=r"\b(?:irs|fbi|police|bank|microsoft|apple|google|amazon|paypal|ebay|government|tax|court|legal|lawsuit)\b",
                weight=25.0,
                category="impersonation",
                description="Impersonation of authorities or well-known companies"
            ),
            
            # Suspicious sender patterns
            Rule(
                name="suspicious_sender",
                pattern=r"(?:no-?reply|do-?not-?reply|noreply|donotreply)@.*|.*@(?:gmail|yahoo|hotmail|outlook)\.com",
                weight=20.0,
                category="sender",
                description="Potentially suspicious sender patterns"
            ),
            
            # Poor grammar/spelling (common in phishing)
            Rule(
                name="poor_grammar",
                pattern=r"\b(?:recieve|seperate|occured|wont|cant|dont|im|youre|theres|wheres|whos)\b|[a-z]{2,}[A-Z][a-z]",
                weight=10.0,
                category="grammar",
                description="Common spelling/grammar errors in phishing emails"
            ),
            
            # Threats and consequences
            Rule(
                name="threats",
                pattern=r"\b(?:penalty|fine|legal action|arrest|prosecution|jail|prison|consequences|closed|terminated|disabled)\b",
                weight=30.0,
                category="threats",
                description="Threatening language to create fear"
            ),
            
            # Cryptocurrency scams
            Rule(
                name="crypto_scam",
                pattern=r"\b(?:bitcoin|btc|ethereum|eth|crypto|blockchain|invest|trading|profit|guaranteed|returns?)\b",
                weight=25.0,
                category="crypto",
                description="Cryptocurrency-related scam indicators"
            ),
            
            # Social engineering
            Rule(
                name="social_engineering",
                pattern=r"\b(?:help (?:me|us)|need (?:your )?help|assistance|cooperation|confidential|secret|private|trust)\b",
                weight=20.0,
                category="social",
                description="Social engineering attempts"
            ),
            
            # Spoofed display names
            Rule(
                name="display_name_spoofing",
                pattern=r"^[\"']?(?:administrator|admin|support|security|no-reply|system)[\"']?\s*<.*@(?!.*\.(gov|edu|mil)).*>",
                weight=35.0,
                category="spoofing",
                description="Potentially spoofed display names"
            )
        ]
    
    def _compile_rules(self) -> Dict[str, Tuple[re.Pattern, Rule]]:
        """Compile regex patterns for better performance."""
        compiled = {}
        for rule in self.rules:
            try:
                compiled[rule.name] = (re.compile(rule.pattern, rule.flags), rule)
            except re.error as e:
                print(f"Warning: Failed to compile rule '{rule.name}': {e}")
        return compiled
    
    def check_subject(self, subject: str) -> List[Tuple[Rule, List[str]]]:
        """Check subject line against rules."""
        matches = []
        if not subject:
            return matches
            
        for name, (pattern, rule) in self.compiled_rules.items():
            found_matches = pattern.findall(subject)
            if found_matches:
                matches.append((rule, found_matches))
        return matches
    
    def check_body(self, body: str) -> List[Tuple[Rule, List[str]]]:
        """Check email body against rules."""
        matches = []
        if not body:
            return matches
            
        for name, (pattern, rule) in self.compiled_rules.items():
            found_matches = pattern.findall(body)
            if found_matches:
                matches.append((rule, found_matches))
        return matches
    
    def check_sender(self, sender: str) -> List[Tuple[Rule, List[str]]]:
        """Check sender address against rules."""
        matches = []
        if not sender:
            return matches
            
        # Only check sender-specific rules
        sender_rules = [name for name in self.compiled_rules.keys() 
                       if 'sender' in name or 'spoofing' in name]
        
        for name in sender_rules:
            pattern, rule = self.compiled_rules[name]
            found_matches = pattern.findall(sender)
            if found_matches:
                matches.append((rule, found_matches))
        return matches
    
    def check_links(self, links: List[str]) -> List[Tuple[Rule, List[str]]]:
        """Check URLs against suspicious patterns."""
        matches = []
        if not links:
            return matches
            
        # Only check link-specific rules
        link_rules = [name for name in self.compiled_rules.keys() 
                     if 'link' in name or 'tld' in name or 'ip' in name]
        
        all_links = ' '.join(links)
        for name in link_rules:
            pattern, rule = self.compiled_rules[name]
            found_matches = pattern.findall(all_links)
            if found_matches:
                matches.append((rule, found_matches))
        return matches
    
    def get_rule_categories(self) -> List[str]:
        """Get all available rule categories."""
        return list(set(rule.category for rule in self.rules))
    
    def get_rules_by_category(self, category: str) -> List[Rule]:
        """Get all rules in a specific category."""
        return [rule for rule in self.rules if rule.category == category]