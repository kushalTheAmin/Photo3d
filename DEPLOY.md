# Deployment Guide

This guide explains how to deploy Photo3D so you can use it on your phone.

## Quick Start Options

### Option 1: Railway (Recommended - Easiest)

**Deploy Backend:**
1. Go to [railway.app](https://railway.app) and sign up (free tier available)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your Photo3d repository
4. Railway will auto-detect the Dockerfile in `/backend`
5. Click Deploy - your API will be live in ~2 minutes
6. Copy your API URL (e.g., `https://photo3d-production-xxxx.up.railway.app`)

**Use the App:**
1. Create a `.env` file with your backend URL:
   ```
   EXPO_PUBLIC_API_URL=https://your-railway-url.up.railway.app
   ```
2. Install Expo Go on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
3. Run `npm start` on your computer
4. Scan the QR code with Expo Go

---

### Option 2: Render (Free Tier)

**Deploy Backend:**
1. Go to [render.com](https://render.com) and sign up
2. Click "New" → "Blueprint"
3. Connect your GitHub repo
4. Render will use the `render.yaml` config automatically
5. Wait for deployment (~5 minutes)
6. Copy your API URL (e.g., `https://photo3d-api.onrender.com`)

---

### Option 3: Fly.io

**Deploy Backend:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Deploy from backend directory
cd backend
fly launch --name photo3d-api
fly deploy
```

---

## Running the Mobile App

### Development (Expo Go)

This is the easiest way to test on your phone:

```bash
# 1. Set your backend URL
cp .env.example .env
# Edit .env with your deployed backend URL

# 2. Install dependencies
npm install

# 3. Start the app
npm start

# 4. Scan QR code with Expo Go app on your phone
```

### Build Standalone App (APK/IPA)

To create an installable app:

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android (APK)
eas build --platform android --profile preview

# Build for iOS (requires Apple Developer account)
eas build --platform ios --profile preview
```

After the build completes, you'll get a download link for the APK/IPA file.

---

## Complete Setup Walkthrough

### Step 1: Deploy Backend to Railway

1. Fork this repo to your GitHub account
2. Go to [railway.app](https://railway.app)
3. Click "Start a New Project"
4. Select "Deploy from GitHub repo"
5. Authorize Railway to access your GitHub
6. Select the `Photo3d` repository
7. In settings, set the root directory to `backend`
8. Railway will build and deploy automatically
9. Once deployed, go to Settings → Domains
10. Copy your public URL (e.g., `https://photo3d-production-abc123.up.railway.app`)

### Step 2: Configure Mobile App

```bash
# Clone if you haven't already
git clone https://github.com/YOUR_USERNAME/Photo3d.git
cd Photo3d

# Create environment file
echo "EXPO_PUBLIC_API_URL=https://YOUR-RAILWAY-URL.up.railway.app" > .env

# Install dependencies
npm install
```

### Step 3: Run on Your Phone

1. Download **Expo Go** on your phone:
   - [iOS App Store](https://apps.apple.com/app/expo-go/id982107779)
   - [Android Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. Start the development server:
   ```bash
   npm start
   ```

3. Scan the QR code:
   - **iOS**: Use the Camera app to scan
   - **Android**: Use Expo Go app to scan

4. The app will open on your phone!

---

## Troubleshooting

### "Network request failed"
- Make sure your backend URL in `.env` is correct
- Check that your backend is running: visit `https://your-url/health`

### "Face not detected"
- Ensure good lighting
- Face the camera directly
- Keep your face centered in the frame

### Slow processing
- Free tier servers may be slow on first request (cold start)
- Wait 10-15 seconds for the server to wake up

### Build errors
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

---

## Cost Estimates

| Service | Free Tier | Paid |
|---------|-----------|------|
| Railway | 500 hours/month | $5/month |
| Render | 750 hours/month | $7/month |
| Fly.io | 3 shared VMs | $1.94/month |
| Expo | Unlimited dev | $29/month (EAS builds) |

**For personal use, the free tiers are usually sufficient!**

---

## Need Help?

1. Check the [README.md](README.md) for app documentation
2. Open an issue on GitHub
3. Make sure your backend health check passes: `curl https://your-url/health`
