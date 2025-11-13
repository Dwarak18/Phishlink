"""
OAuth utilities for Gmail and Microsoft Graph API integration (optional).
"""
import os
import json
import base64
from typing import Dict, Optional, List
from datetime import datetime, timedelta
import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build


class GmailOAuthManager:
    """Manages OAuth flow and API calls for Gmail."""
    
    def __init__(self, credentials_file: str = "gmail_credentials.json"):
        self.credentials_file = credentials_file
        self.scopes = [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email'
        ]
        self.service = None
    
    def get_authorization_url(self, redirect_uri: str) -> str:
        """Get OAuth authorization URL."""
        flow = Flow.from_client_secrets_file(
            self.credentials_file,
            scopes=self.scopes,
            redirect_uri=redirect_uri
        )
        
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        return auth_url
    
    def exchange_code_for_tokens(self, auth_code: str, redirect_uri: str) -> Dict:
        """Exchange authorization code for access tokens."""
        try:
            flow = Flow.from_client_secrets_file(
                self.credentials_file,
                scopes=self.scopes,
                redirect_uri=redirect_uri
            )
            
            flow.fetch_token(code=auth_code)
            
            credentials = flow.credentials
            return {
                'access_token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'expires_at': credentials.expiry.timestamp() if credentials.expiry else None
            }
        except Exception as e:
            raise Exception(f"Failed to exchange code for tokens: {e}")
    
    def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh access token using refresh token."""
        try:
            credentials = Credentials(
                token=None,
                refresh_token=refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=self._get_client_id(),
                client_secret=self._get_client_secret()
            )
            
            credentials.refresh(Request())
            
            return {
                'access_token': credentials.token,
                'expires_at': credentials.expiry.timestamp() if credentials.expiry else None
            }
        except Exception as e:
            raise Exception(f"Failed to refresh token: {e}")
    
    def get_email_details(self, message_id: str, access_token: str) -> Dict:
        """Get detailed email information including headers."""
        try:
            credentials = Credentials(token=access_token)
            service = build('gmail', 'v1', credentials=credentials)
            
            # Get message details
            message = service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            
            # Extract headers
            headers = {}
            if 'payload' in message and 'headers' in message['payload']:
                for header in message['payload']['headers']:
                    headers[header['name']] = header['value']
            
            # Extract body
            body = self._extract_body(message['payload'])
            
            # Extract attachments info
            attachments = self._extract_attachments(message['payload'])
            
            return {
                'message_id': message_id,
                'thread_id': message.get('threadId'),
                'subject': headers.get('Subject', ''),
                'from': headers.get('From', ''),
                'to': headers.get('To', ''),
                'date': headers.get('Date', ''),
                'body': body,
                'headers': headers,
                'attachments': attachments,
                'labels': message.get('labelIds', [])
            }
        except Exception as e:
            raise Exception(f"Failed to get email details: {e}")
    
    def _extract_body(self, payload: Dict) -> str:
        """Extract email body from Gmail API payload."""
        body = ""
        
        if 'parts' in payload:
            for part in payload['parts']:
                if part['mimeType'] == 'text/plain':
                    if 'data' in part['body']:
                        body += base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
                elif part['mimeType'] == 'text/html' and not body:
                    # Fallback to HTML if no plain text
                    if 'data' in part['body']:
                        body = base64.urlsafe_b64decode(
                            part['body']['data']
                        ).decode('utf-8')
        elif payload['mimeType'] == 'text/plain':
            if 'data' in payload['body']:
                body = base64.urlsafe_b64decode(
                    payload['body']['data']
                ).decode('utf-8')
        
        return body
    
    def _extract_attachments(self, payload: Dict) -> List[str]:
        """Extract attachment information from Gmail API payload."""
        attachments = []
        
        if 'parts' in payload:
            for part in payload['parts']:
                if 'filename' in part and part['filename']:
                    attachments.append(part['filename'])
        
        return attachments
    
    def _get_client_id(self) -> str:
        """Get OAuth client ID from credentials file."""
        with open(self.credentials_file, 'r') as f:
            creds = json.load(f)
            return creds['installed']['client_id']
    
    def _get_client_secret(self) -> str:
        """Get OAuth client secret from credentials file."""
        with open(self.credentials_file, 'r') as f:
            creds = json.load(f)
            return creds['installed']['client_secret']


class MicrosoftOAuthManager:
    """Manages OAuth flow and API calls for Microsoft Graph (Outlook)."""
    
    def __init__(self, client_id: str, client_secret: str, tenant: str = "common"):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant = tenant
        self.scopes = [
            'https://graph.microsoft.com/Mail.Read',
            'https://graph.microsoft.com/User.Read'
        ]
    
    def get_authorization_url(self, redirect_uri: str) -> str:
        """Get OAuth authorization URL for Microsoft."""
        params = {
            'client_id': self.client_id,
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'response_mode': 'query',
            'scope': ' '.join(self.scopes),
            'state': 'random_state_string'  # Should be random in production
        }
        
        auth_url = f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0/authorize"
        query_params = '&'.join([f"{k}={v}" for k, v in params.items()])
        
        return f"{auth_url}?{query_params}"
    
    def exchange_code_for_tokens(self, auth_code: str, redirect_uri: str) -> Dict:
        """Exchange authorization code for access tokens."""
        token_url = f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0/token"
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': auth_code,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code',
            'scope': ' '.join(self.scopes)
        }
        
        response = requests.post(token_url, data=data)
        
        if response.status_code != 200:
            raise Exception(f"Failed to get access token: {response.text}")
        
        token_data = response.json()
        
        return {
            'access_token': token_data['access_token'],
            'refresh_token': token_data.get('refresh_token'),
            'expires_at': datetime.now().timestamp() + token_data['expires_in']
        }
    
    def refresh_access_token(self, refresh_token: str) -> Dict:
        """Refresh access token using refresh token."""
        token_url = f"https://login.microsoftonline.com/{self.tenant}/oauth2/v2.0/token"
        
        data = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token',
            'scope': ' '.join(self.scopes)
        }
        
        response = requests.post(token_url, data=data)
        
        if response.status_code != 200:
            raise Exception(f"Failed to refresh token: {response.text}")
        
        token_data = response.json()
        
        return {
            'access_token': token_data['access_token'],
            'expires_at': datetime.now().timestamp() + token_data['expires_in']
        }
    
    def get_email_details(self, message_id: str, access_token: str) -> Dict:
        """Get detailed email information from Microsoft Graph."""
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        # Get message details
        url = f"https://graph.microsoft.com/v1.0/me/messages/{message_id}"
        params = {
            '$select': 'subject,from,toRecipients,receivedDateTime,body,hasAttachments,internetMessageHeaders'
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            raise Exception(f"Failed to get email details: {response.text}")
        
        message = response.json()
        
        # Extract headers
        email_headers = {}
        if 'internetMessageHeaders' in message:
            for header in message['internetMessageHeaders']:
                email_headers[header['name']] = header['value']
        
        # Get attachments if any
        attachments = []
        if message.get('hasAttachments', False):
            attachments = self._get_attachments(message_id, access_token)
        
        return {
            'message_id': message_id,
            'subject': message.get('subject', ''),
            'from': message.get('from', {}).get('emailAddress', {}).get('address', ''),
            'to': [addr['emailAddress']['address'] for addr in message.get('toRecipients', [])],
            'date': message.get('receivedDateTime', ''),
            'body': message.get('body', {}).get('content', ''),
            'headers': email_headers,
            'attachments': attachments
        }
    
    def _get_attachments(self, message_id: str, access_token: str) -> List[str]:
        """Get attachment names for a message."""
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }
        
        url = f"https://graph.microsoft.com/v1.0/me/messages/{message_id}/attachments"
        params = {'$select': 'name,contentType,size'}
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code == 200:
            attachments_data = response.json()
            return [att['name'] for att in attachments_data.get('value', [])]
        
        return []


# Helper functions for extension integration
def save_oauth_credentials(user_id: str, provider: str, credentials: Dict):
    """Save OAuth credentials securely (implement proper encryption in production)."""
    # This is a simplified implementation - use proper encryption in production
    creds_file = f"oauth_creds_{user_id}_{provider}.json"
    with open(creds_file, 'w') as f:
        json.dump(credentials, f)


def load_oauth_credentials(user_id: str, provider: str) -> Optional[Dict]:
    """Load OAuth credentials."""
    creds_file = f"oauth_creds_{user_id}_{provider}.json"
    try:
        with open(creds_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def is_token_expired(expires_at: float) -> bool:
    """Check if access token is expired."""
    return datetime.now().timestamp() >= expires_at - 300  # 5 min buffer