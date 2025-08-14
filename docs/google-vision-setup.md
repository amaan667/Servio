# Google Cloud Vision OCR Setup

## Environment Variables Required

Add these to your `.env` file:

```env
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
GCS_BUCKET_NAME=your-bucket-name
```

## Setup Steps

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Note your Project ID

### 2. Enable APIs
Enable these APIs in your Google Cloud project:
- Cloud Vision API
- Cloud Storage API

### 3. Create Service Account
1. Go to IAM & Admin > Service Accounts
2. Create a new service account
3. Grant these roles:
   - Cloud Vision API User
   - Storage Object Admin
4. Create and download the JSON key file
5. Save as `service-account.json` in your project root

### 4. Create Storage Bucket
1. Go to Cloud Storage > Buckets
2. Create a new bucket
3. Note the bucket name
4. Make sure it's accessible to your service account

### 5. Railway Deployment
For Railway deployment, add these environment variables in the Railway dashboard:

**Regular Variables:**
- `GOOGLE_PROJECT_ID` = your-project-id
- `GCS_BUCKET_NAME` = your-bucket-name

**File Variable (Important!):**
- `GOOGLE_APPLICATION_CREDENTIALS` = **File Variable**
  - Click "Add Variable"
  - Name: `GOOGLE_APPLICATION_CREDENTIALS`
  - Type: **File**
  - Upload your `service-account.json` file content

**How to set up the file variable:**
1. Open your `service-account.json` file
2. Copy the entire JSON content
3. In Railway Variables tab, create a new variable
4. Name: `GOOGLE_APPLICATION_CREDENTIALS`
5. Type: **File**
6. Paste the entire JSON content

## Benefits

- **98% accuracy** on clear menu text
- **Handles multi-page PDFs** with images
- **Preserves menu order** and structure
- **Free tier**: 1,000 pages/month
- **No Docker/Sharp issues** - works reliably on Railway
- **Better than client-side OCR** - more accurate and reliable

## Usage

The system will automatically:
1. Upload PDF to Google Cloud Storage
2. Run Vision OCR on all pages
3. Extract text in reading order
4. Clean up temporary files
5. Send extracted text to GPT for menu parsing
