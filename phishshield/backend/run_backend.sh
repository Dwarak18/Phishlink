#!/bin/bash
# PhishShield Backend Startup Script

cd /workspaces/Phishlink/phishshield/backend

echo "🚀 Starting PhishShield Backend..."
echo "=================================="

# Create __init__.py if it doesn't exist
if [ ! -f "app/__init__.py" ]; then
    touch app/__init__.py
    echo "✅ Created app/__init__.py"
fi

# Start the FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
