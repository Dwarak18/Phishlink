# OAuth Configuration Template

This file provides the template for OAuth configuration. **DO NOT commit actual OAuth credentials to git.**

## Setup Instructions:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Copy the values below to your local `manifest.json`

## Template:

```json
{
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email"
    ],
    "project_id": "YOUR_PROJECT_ID_HERE",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "YOUR_GOOGLE_CLIENT_SECRET_HERE",
    "redirect_uris": ["http://localhost:8000"],
    "javascript_origins": ["http://localhost.chromiumapp.org"]
  }
}
```

## Security Notes:

- Never commit real OAuth credentials to version control
- Keep your client secret secure
- Use environment variables for production deployments
- The extension works without OAuth for basic email analysis