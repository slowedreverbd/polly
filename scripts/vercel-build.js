#!/usr/bin/env node

/**
 * Vercel build script that conditionally runs different builds
 * based on the deployment environment
 */

import { execSync } from 'child_process';

// Check if we're in a preview deployment
const isPreview = process.env.VERCEL_ENV === 'preview';
const isPullRequest = process.env.VERCEL_GIT_PULL_REQUEST_ID;
const convexUrl = process.env.VITE_CONVEX_URL;

// Log environment info
console.log('🔍 Build Environment:');
console.log(`   VERCEL_ENV: ${process.env.VERCEL_ENV || 'not set'}`);
console.log(`   Pull Request: ${isPullRequest ? `#${isPullRequest}` : 'no'}`);
console.log(`   VITE_CONVEX_URL: ${convexUrl ? '✅ Set' : '❌ Not set'}`);

// Check if Convex URL is set
if (!convexUrl) {
  console.error('\n❌ ERROR: VITE_CONVEX_URL environment variable is not set!');
  console.error('   Please set this in your Vercel project settings.');
  console.error('   See docs/PR_PREVIEW_SETUP.md for instructions.\n');
  process.exit(1);
}

// For PR previews, skip Convex deployment
if (isPreview || isPullRequest) {
  console.log('\n🔨 Running preview build (without Convex deployment)...');
  try {
    execSync('pnpm build:preview', { stdio: 'inherit' });
    console.log('✅ Preview build completed successfully!');
  } catch (error) {
    console.error('❌ Preview build failed:', error.message);
    process.exit(1);
  }
} else {
  console.log('\n🚀 Running production build (with Convex deployment)...');
  
  // Check for Convex deploy key in production
  if (!process.env.CONVEX_DEPLOY_KEY) {
    console.warn('⚠️  Warning: CONVEX_DEPLOY_KEY not set. Convex deploy might fail.');
  }
  
  try {
    execSync('pnpm build', { stdio: 'inherit' });
    console.log('✅ Production build completed successfully!');
  } catch (error) {
    console.error('❌ Production build failed:', error.message);
    process.exit(1);
  }
}