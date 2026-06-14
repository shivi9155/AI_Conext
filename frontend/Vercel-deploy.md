Vercel Deployment Guide for FairShare Lite Frontend

1) Connect repository
- In Vercel dashboard, click "New Project" → Import Git Repository → select `AI_Conext` (your GitHub repo).
- Set the Project Root to: `frontend`.

2) Build & Framework settings
- Framework Preset: Next.js (auto-detected)
- Build Command: `npm run build`
- Output Directory: leave default (Next.js)
- Install Command: `npm install`

3) Environment Variables
Add the following Production env vars in Vercel (Dashboard > Settings > Environment Variables) or via Vercel CLI.
- `NEXT_PUBLIC_API_URL` = `https://fairshare-lite-production.up.railway.app/api`

Optional: set the same value for `Preview` and `Development` if you want previews to hit the live backend.

Vercel CLI commands (example):
```bash
# login once
vercel login
# import project (interactive) or use `vercel --prod` after linking
vercel link --project fairshare-lite-frontend
# add production env var
vercel env add NEXT_PUBLIC_API_URL production
# when prompted, paste: https://fairshare-lite-production.up.railway.app/api
# optionally add to preview
vercel env add NEXT_PUBLIC_API_URL preview
```

4) Deploy
- After configuring env vars, click "Deploy" in the Vercel dashboard or push a commit to the branch you connected.
- Vercel will build using the env values you provided.

5) Local verification (simulate production build)
```bash
cd frontend
npm install
# On Windows PowerShell
$env:NODE_ENV='production'; npm run build
npm run start
# The app will serve a production-next server at http://localhost:3000
```

6) Notes & Troubleshooting
- Ensure the backend URL is publicly accessible and responding before wiring it into the frontend.
- If you see CORS or auth-related errors, verify backend CORS rules and JWT_SECRET are set in Railway.
- For advanced setups (custom domains, rewrites), configure in Vercel project settings.

If you want, I can: 
- Trigger a Vercel import config (prepare vercel.json) and the exact `vercel` CLI commands for your repo.
- Run a local production build now to verify `frontend/.env.production` is applied.
