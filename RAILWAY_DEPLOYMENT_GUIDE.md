# Railway Deployment Guide

## 🚂 Deploying Servio to Railway

This guide will help you deploy the Servio application to Railway without using Docker.

## 📋 Prerequisites

1. **Railway Account**: Sign up at [railway.app](https://railway.app)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Supabase Project**: Set up your Supabase project and get the credentials

## 🔧 Railway Setup

### 1. Connect Your Repository

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your Servio repository
5. Railway will automatically detect it's a Next.js project

### 2. Configure Environment Variables

In your Railway project dashboard, go to the "Variables" tab and add these required environment variables:

```bash
# Required for Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Required for the application
NEXT_PUBLIC_APP_URL=https://your-app-name.railway.app
NEXT_PUBLIC_SITE_URL=https://your-app-name.railway.app
APP_URL=https://your-app-name.railway.app

# Optional but recommended
NODE_ENV=production
PORT=8080
```

### 3. Build Configuration

Railway will automatically use the `.nixpacks` configuration file which includes:

- **Node.js 20** and **pnpm** installation
- **Environment check** before build
- **Next.js build** process
- **Production start** command

## 🏗️ Build Process

The build process follows these steps:

1. **Setup Phase**: Install Node.js 20 and pnpm
2. **Install Phase**: Run `pnpm install --frozen-lockfile`
3. **Build Phase**: 
   - Run environment check script
   - Run `pnpm build`
4. **Start Phase**: Run `pnpm start`

## 🔍 Environment Check

The `scripts/railway-env-check.js` script will verify:

- ✅ All required environment variables are set
- ✅ No placeholder values are being used
- ✅ App directory structure is correct
- ✅ No conflicting files exist

## 🚀 Deployment

### Automatic Deployment

Railway will automatically deploy when you push to your main branch:

```bash
git add .
git commit -m "Update for Railway deployment"
git push origin main
```

### Manual Deployment

You can also trigger manual deployments from the Railway dashboard.

## 📊 Monitoring

### Logs

Check the Railway dashboard for:
- Build logs
- Runtime logs
- Error messages

### Health Check

The application includes a health check endpoint:
```
https://your-app-name.railway.app/api/health
```

## 🔧 Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   - Check Railway Variables tab
   - Ensure all required variables are set
   - No placeholder values should be used

2. **Build Failures**
   - Check build logs in Railway dashboard
   - Verify Node.js version compatibility
   - Ensure all dependencies are in package.json

3. **Runtime Errors**
   - Check runtime logs
   - Verify Supabase connection
   - Check environment variable values

### Debug Tools

The application includes debug endpoints:

- **Environment Check**: `/api/env`
- **Auth Debug**: `/debug-auth`
- **Health Check**: `/api/health`

## 🔄 Updates

To update your deployment:

1. Push changes to your GitHub repository
2. Railway will automatically detect changes
3. A new deployment will start
4. Monitor the build logs for any issues

## 📞 Support

If you encounter issues:

1. Check Railway logs first
2. Verify environment variables
3. Test locally with the same environment
4. Check the debug endpoints

## 🎯 Success Indicators

Your deployment is successful when:

- ✅ Build completes without errors
- ✅ Application starts on port 8080
- ✅ Health check endpoint responds
- ✅ Environment variables are properly loaded
- ✅ Supabase connection works
- ✅ Authentication flows work correctly

## 🔐 Security Notes

- Never commit `.env.local` files
- Use Railway's secure environment variable storage
- Regularly rotate Supabase keys
- Monitor application logs for security issues
