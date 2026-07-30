# Australian restaurant search worker

This Cloudflare Worker keeps FatSecret credentials out of the public PWA and requests localized Australian restaurant results. It does not store search responses or nutrition records.

## Prerequisites

Create a FatSecret Platform application with `basic` and `localization` access for region `AU`, then install/authenticate Wrangler.

```bash
cd worker
npx wrangler login
npx wrangler secret put FATSECRET_CLIENT_ID
npx wrangler secret put FATSECRET_CLIENT_SECRET
npx wrangler deploy
```

Set the resulting Worker URL as the GitHub Actions repository variable `VITE_RESTAURANT_API_URL`, for example `https://nutri-notes-restaurant-api.<account>.workers.dev`, then rerun the Pages workflow.

Never put the FatSecret client secret in `.env`, GitHub Pages variables, application settings, or frontend source code.
