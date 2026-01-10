# Deploy Command

Deploy Lost London to production (Railway backend + Vercel frontend).

## Pre-flight Checks

1. Run `git status` - ensure no uncommitted changes or commit them first
2. Check for TypeScript errors: `cd /Users/dankeegan/lost-london-v2 && npm run build`
3. Check Python syntax: `cd /Users/dankeegan/lost-london-v2/agent && python -m py_compile src/agent.py`

## Deployment Steps

### 1. Commit and Push
```bash
git add -A
git commit -m "Your commit message"
git push origin main
```

### 2. Deploy Backend to Railway
```bash
cd /Users/dankeegan/lost-london-v2/agent
railway up
```
Wait for build to complete. Check logs: `railway logs`

### 3. Deploy Frontend to Vercel
```bash
cd /Users/dankeegan/lost-london-v2
npx vercel --prod
```

## Production URLs
- Frontend: https://lost-london-v2-copilot.vercel.app
- Backend: https://vic-agent-production.up.railway.app
- Backend AG-UI: https://vic-agent-production.up.railway.app/agui

## Post-Deploy Verification
1. Visit frontend, click VIC avatar, test greeting
2. Check Railway logs for errors: `railway logs`
3. Test debug endpoint: `curl https://vic-agent-production.up.railway.app/debug/full | jq`
