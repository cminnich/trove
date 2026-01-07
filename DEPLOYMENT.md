# Deployment Guide - Vercel

## Quick Deploy

### One-Click Deploy (Recommended for POC)

1. **Push to GitHub** (if not already done):
   ```bash
   git remote add origin https://github.com/cminnich/trove.git
   git push -u origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New" → "Project"
   - Import your `trove` repository
   - Vercel auto-detects Next.js configuration

3. **Configure Environment Variables**:

   In Vercel dashboard → Project Settings → Environment Variables, add:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

   **IMPORTANT**: Set all variables for "Production", "Preview", and "Development" environments.

4. **Deploy**:
   - Click "Deploy"
   - Vercel builds and deploys automatically
   - Your app will be live at `https://trove-xxx.vercel.app`

## Vercel CLI Deploy (Alternative)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (first time)
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name? trove
# - Directory? ./
# - Override settings? No

# Deploy to production
vercel --prod
```

## Environment Variables Setup

### Where to Find Your Credentials

**Anthropic API Key:**
- Go to [console.anthropic.com](https://console.anthropic.com)
- Settings → API Keys
- Create new key if needed

**Supabase Credentials:**
- Go to your [Supabase project](https://supabase.com/dashboard)
- Project Settings → API
- Copy:
  - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `service_role` → `SUPABASE_SECRET_KEY`

### Adding to Vercel

**Via Dashboard:**
1. Project → Settings → Environment Variables
2. Add each variable individually
3. Check all environments (Production, Preview, Development)
4. Click "Save"

**Via CLI:**
```bash
# Production
vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SECRET_KEY production

# Preview (for testing branches)
vercel env add ANTHROPIC_API_KEY preview
# ... repeat for other vars

# Development (optional - local dev)
vercel env add ANTHROPIC_API_KEY development
# ... repeat for other vars
```

**Via .env File Upload (Easiest):**
1. Create `.env.production` locally (DO NOT COMMIT):
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SECRET_KEY=sb_secret_...
   ```

2. Upload in Vercel dashboard:
   - Settings → Environment Variables
   - Click "Add New" → "Import .env File"
   - Upload `.env.production`
   - Select environments
   - Delete local `.env.production` after upload

## Post-Deployment Testing

### 1. Health Check
```bash
curl https://trove-xxx.vercel.app/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-01-06T..."
}
```

### 2. Test Extraction Endpoint
```bash
curl -X POST https://trove-xxx.vercel.app/api/extract \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.amazon.com/dp/B0XXXXXX"}'
```

### 3. Test from iPhone
- Create iOS Shortcut (see below)
- Share a product URL
- Should open your Vercel URL and extract data

## iOS Shortcut for Testing

### Create Shortcut

1. Open **Shortcuts** app on iPhone
2. Create new Shortcut
3. Add actions:

```
Get URLs from [Shortcut Input]
↓
Set variable [ProductURL] to [URLs]
↓
URL Encode [ProductURL]
↓
Set variable [EncodedURL] to [URL Encoded]
↓
Open URL: https://trove-xxx.vercel.app/add?url=[EncodedURL]
```

4. Settings:
   - Name: "Add to Trove"
   - Show in Share Sheet: ON
   - Share Sheet Types: URLs, Safari Web Pages

5. Test by sharing any product URL

## Continuous Deployment

### Auto-Deploy on Push

Vercel automatically deploys:
- **Production**: Pushes to `main` branch → `trove-xxx.vercel.app`
- **Preview**: Pushes to other branches → `trove-xxx-git-branch.vercel.app`
- **PR Previews**: Pull requests get unique preview URLs

### Manual Deploy

**Via CLI:**
```bash
# Preview deploy
vercel

# Production deploy
vercel --prod
```

**Via Dashboard:**
- Deployments → ⋮ (three dots) → "Redeploy"

## Domain Configuration (Optional)

### Add Custom Domain

1. Vercel Dashboard → Project → Settings → Domains
2. Add domain: `trove.yourdomain.com`
3. Follow DNS configuration instructions
4. Vercel handles SSL automatically

### Recommended Domains for POC
- Default: `trove-xxx.vercel.app` (works fine for testing)
- Custom: `trove.yourname.com` (if you want a clean URL)

## Monitoring & Debugging

### View Logs

**Via Dashboard:**
- Deployments → Click deployment → "Logs" tab

**Via CLI:**
```bash
vercel logs
vercel logs --follow  # Live tail
```

### Common Issues

**Build fails:**
- Check environment variables are set for Production
- Review build logs for TypeScript/linting errors
- Run `npm run build` locally first

**API routes fail:**
- Verify all environment variables are set
- Check Supabase connection (test /api/health)
- Review function logs in Vercel dashboard

**CORS errors:**
- Ensure `NEXT_PUBLIC_*` variables are set for client-side access
- Check browser console for detailed errors

## Performance Optimization

### Vercel Defaults (Already Optimized)
- ✅ Edge caching
- ✅ Image optimization
- ✅ Automatic compression
- ✅ Global CDN

### API Route Optimization
Consider adding these headers to API routes for caching:

```typescript
// For /api/health (cache for 60s)
export async function GET() {
  return NextResponse.json(
    { status: "ok", ... },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120'
      }
    }
  );
}
```

## Cost Estimation

### Vercel Free Tier (Hobby)
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless function executions: 100GB-hours
- ✅ Edge Functions: 500K invocations
- **Should be sufficient for POC testing**

### Estimated Costs (Free Tier)
- **Deployment**: $0
- **Hosting**: $0 (under limits)
- **Bandwidth**: $0 (POC traffic << 100GB)

### Anthropic API Costs
- **Extraction**: ~$0.02 per product
- **10 products**: ~$0.20
- **100 products**: ~$2.00

### Supabase Costs
- **Free tier**: 500MB database, 2GB bandwidth
- **POC**: Should stay well within free tier

## Next Steps

1. **Deploy to Vercel** using one-click import
2. **Add environment variables** in Vercel dashboard
3. **Test health endpoint** to verify connection
4. **Create iOS Shortcut** with your Vercel URL
5. **Share a product URL** to test end-to-end flow

## Rollback

If deployment has issues:

**Via Dashboard:**
- Deployments → Find last working deployment → ⋮ → "Promote to Production"

**Via CLI:**
```bash
vercel rollback
```

## Additional Resources

- [Vercel Next.js Deployment Docs](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables Guide](https://vercel.com/docs/projects/environment-variables)
- [Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
