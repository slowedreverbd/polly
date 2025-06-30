# PR Preview Build Setup for Vercel

This guide explains how to configure Vercel to build preview deployments for every pull request.

## Overview

The project is configured to handle two types of builds:
- **Production builds**: Run `convex deploy` and then build the Vite app
- **Preview/PR builds**: Only build the Vite app (skip Convex deployment)

## Vercel Configuration

### 1. Enable Preview Deployments

In your Vercel project settings:
1. Go to **Settings** → **Git**
2. Under **Ignored Build Step**, make sure it's set to "Don't skip"
3. Under **Production Branch**, set your main branch (usually `main` or `master`)

### 2. Configure Environment Variables

You need different environment variables for production and preview environments.

#### Production Environment Variables
In Vercel dashboard → Settings → Environment Variables:
- `VITE_CONVEX_URL`: Your production Convex URL
- `CONVEX_DEPLOY_KEY`: Your Convex deploy key (for production deployments)

#### Preview Environment Variables
For preview deployments, you should use a separate Convex deployment:
- `VITE_CONVEX_URL`: Your development/staging Convex URL

To set preview-specific variables:
1. In Vercel dashboard → Settings → Environment Variables
2. Click "Add New"
3. Add `VITE_CONVEX_URL` with your dev/staging Convex URL
4. **Important**: Uncheck "Production" and check only "Preview" and "Development"

### 3. Convex Setup for Preview Environments

You should have separate Convex deployments:
```bash
# Production deployment
npx convex dev --prod

# Development/staging deployment for previews
npx convex dev
```

Use the development deployment URL for preview builds.

## How It Works

1. When a PR is opened, Vercel automatically triggers a preview build
2. The `scripts/vercel-build.js` script detects it's a preview environment
3. It runs `pnpm build:preview` which only builds the Vite app
4. The preview uses the development Convex deployment (no new deployment)

## Troubleshooting

### Build Still Failing?

1. **Check Environment Variables**: Ensure `VITE_CONVEX_URL` is set for preview environments
2. **Verify Convex URL**: Make sure the URL is accessible and correct
3. **Check Build Logs**: Look for specific error messages in Vercel build logs

### "Convex deploy" Running in Preview?

If you see Convex deployment attempts in preview builds:
1. Clear Vercel build cache: Settings → Advanced → Clear Build Cache
2. Verify the build command in vercel.json is `node scripts/vercel-build.js`

### Missing Data in Preview?

Preview builds use a different Convex deployment, so data won't match production:
1. This is expected behavior
2. You may want to seed your development Convex instance with test data
3. Consider using the same staging Convex deployment for all preview builds

## Best Practices

1. **Use Separate Convex Projects**: Don't share production Convex deployment with previews
2. **Environment Parity**: Keep preview environment as close to production as possible
3. **Test Data**: Maintain good test data in your development Convex instance
4. **Security**: Never expose production Convex deploy keys in preview environments

## Quick Checklist

- [ ] Preview deployments enabled in Vercel
- [ ] `VITE_CONVEX_URL` set for preview environment
- [ ] Separate Convex deployment for development/staging
- [ ] Build script (vercel-build.js) is working correctly
- [ ] Preview builds complete successfully