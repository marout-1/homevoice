#!/bin/bash
# Run this from the homevoice directory to deploy the admin section
# Usage: bash deploy-admin.sh

set -e
cd "$(dirname "$0")"

echo "→ Pushing to GitHub..."
git push origin main

echo "→ Deploying to Vercel..."
vercel deploy --prod

echo ""
echo "✅ Done! Admin section is live at:"
echo "   https://mattarout.vercel.app/admin"
echo ""
echo "⚠️  IMPORTANT: Before using /admin, run admin-schema.sql in Supabase:"
echo "   1. Go to https://supabase.com/dashboard/project/vsgvgxcrzsmescwtjomi/sql"
echo "   2. Paste contents of admin-schema.sql and click Run"
echo "   3. Then run: UPDATE public.profiles SET is_admin = true WHERE email = 'marout@gmail.com';"
