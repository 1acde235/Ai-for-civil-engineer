
# How to Deploy ConstructAI

ConstructAI is built with **React (Vite)** for the frontend and **Node.js (Serverless)** for the backend API. It is optimized for deployment on **Vercel**.

## Prerequisites

1.  A [GitHub](https://github.com/), GitLab, or Bitbucket account.
2.  A [Vercel](https://vercel.com/) account.
3.  Your API Keys:
    *   **Google Gemini API Key** (for AI analysis).
    *   **Chapa Secret Key** (optional, for payments).
    *   **Telebirr Credentials** (optional, App ID, App Key, Short Code).

## Deployment Steps

### 1. Push Code to Git
Initialize a git repository and push this project to your provider.

```bash
git init
git add .
git commit -m "Initial commit"
# Add your remote origin here
# git remote add origin https://github.com/YOUR_USERNAME/construct-ai.git
# git push -u origin main
```

### 2. Import Project in Vercel
1.  Log in to Vercel.
2.  Click **"Add New..."** > **"Project"**.
3.  Import your git repository.
4.  Vercel will detect `Vite` as the framework. The default Build Command (`vite build`) and Output Directory (`dist`) are correct.

### 3. Configure Environment Variables
**Crucial Step:** Before clicking "Deploy", expand the **"Environment Variables"** section and add the following keys:

| Key | Value Description | Required? |
| :--- | :--- | :--- |
| `API_KEY` | Your Google Gemini API Key. | **YES** |
| `CHAPA_SECRET_KEY` | Secret Key from Chapa Dashboard (starts with `CHASECK_...`). | No (if using manual pay) |
| `TELEBIRR_APP_ID` | Your Telebirr Merchant App ID. | No |
| `TELEBIRR_APP_KEY` | Your Telebirr App Key. | No |
| `TELEBIRR_SHORT_CODE`| Your Merchant Short Code. | No |

*Note: The `API_KEY` will be embedded into the frontend build for the AI functionality to work in the browser. Ensure you restrict this key in Google Cloud Console if possible (e.g. by HTTP Referrer).*

### 4. Deploy
Click **"Deploy"**. Vercel will:
1.  Build your React frontend.
2.  Deploy the files in `api/` as Serverless Functions.
3.  Assign a production URL (e.g., `construct-ai.vercel.app`).

### 5. Post-Deployment Setup
*   **Payment Callbacks:** If you use Chapa/Telebirr, they will send payment confirmations to your site.
    *   Chapa uses the `return_url` we dynamically generate.
    *   Telebirr uses the `notifyUrl` we dynamically generate (`/api/telebirr-callback`).
*   **Custom Domain:** Go to Vercel Settings > Domains to add `www.your-saas.com`.

## Troubleshooting

*   **API Errors (404/500):** Check the Vercel "Functions" logs.
*   **AI Not Working:** Ensure `API_KEY` was set correctly in Environment Variables **before** the build. If you added it after, you must **Redeploy** (rebuild) the application.
*   **CORS Issues:** The API functions have CORS headers configured, but ensure your frontend is calling the relative path `/api/...` not a hardcoded `localhost` URL.

