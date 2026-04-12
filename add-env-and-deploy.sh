#!/bin/bash
# Adds Supabase env vars to Vercel and redeploys
set -e
cd "$(dirname "$0")"

echo "🔑 Adding environment variables to Vercel..."

# Add NEXT_PUBLIC_SUPABASE_URL to all environments
echo "https://vsgvgxcrzsmescwtjomi.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --force 2>/dev/null || true
echo "https://vsgvgxcrzsmescwtjomi.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview --force 2>/dev/null || true
echo "https://vsgvgxcrzsmescwtjomi.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL development --force 2>/dev/null || true

# Add NEXT_PUBLIC_SUPABASE_ANON_KEY to all environments
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZ3ZneGNyenNtZXNjd3Rqb21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Nzk4ODQsImV4cCI6MjA5MTQ1NTg4NH0.IFGHjMJSdM0KJJkjNB0IupLYUFo5yxbksKJs8vD54fg" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --force 2>/dev/null || true
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZ3ZneGNyenNtZXNjd3Rqb21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Nzk4ODQsImV4cCI6MjA5MTQ1NTg4NH0.IFGHjMJSdM0KJJkjNB0IupLYUFo5yxbksKJs8vD54fg" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview --force 2>/dev/null || true
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzZ3ZneGNyenNtZXNjd3Rqb21pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Nzk4ODQsImV4cCI6MjA5MTQ1NTg4NH0.IFGHjMJSdM0KJJkjNB0IupLYUFo5yxbksKJs8vD54fg" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY development --force 2>/dev/null || true

echo "✅ Environment variables added!"
echo ""
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🚀 Deploying to Vercel..."
vercel --prod

echo ""
echo "✅ Done! Your app is live at https://mattarout.vercel.app"
echo ""
echo "⚠️  One last step: Go to Supabase → Authentication → URL Configuration"
echo "   Set Site URL to: https://mattarout.vercel.app"
echo "   Add redirect URL: https://mattarout.vercel.app/auth/callback"
