#!/bin/bash
# HomeVoice — one-shot deploy script
# Run this from inside the homevoice folder:
#   bash deploy.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "🏠 HomeVoice Deploy Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Project: $PROJECT_DIR"
echo ""

# Step 1: Install Vercel CLI if not present
if ! command -v vercel &>/dev/null; then
  echo "📦 Installing Vercel CLI..."
  npm install -g vercel
else
  echo "✅ Vercel CLI already installed ($(vercel --version))"
fi

# Step 2: Install project dependencies
echo ""
echo "📦 Installing project dependencies..."
cd "$PROJECT_DIR"
npm install

# Step 3: Deploy
echo ""
echo "🚀 Deploying to Vercel..."
echo "   (A browser window will open to log in if you haven't already)"
echo ""
vercel --prod

echo ""
echo "✅ Done! Your app is live."
echo "   Next: add your API keys at vercel.com → your project → Settings → Environment Variables"
echo ""
echo "   Required keys:"
echo "   ANTHROPIC_API_KEY    → console.anthropic.com"
echo "   RAPIDAPI_KEY         → rapidapi.com (search Zillow56)"
echo "   ELEVENLABS_API_KEY   → elevenlabs.io"
echo "   SERPER_API_KEY       → serper.dev"
echo ""
echo "   After adding keys, redeploy with:  vercel --prod"
