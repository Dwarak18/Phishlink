#!/bin/bash
# PhishShield Extension Build Script

cd /workspaces/Phishlink/phishshield/extension

echo "📦 Building PhishShield Browser Extension..."
echo "=============================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📥 Installing dependencies (this may take a moment)..."
    npm install
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Build the extension
echo "🔨 Building extension..."
npm run build

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Extension built to: dist/"
echo ""
echo "Next steps:"
echo "1. Open Chrome/Edge and go to chrome://extensions or edge://extensions"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked' and select the 'dist' folder"
echo ""
