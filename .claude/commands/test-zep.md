# Test Zep Memory Command

Test that Zep memory is working correctly for user recognition and greetings.

## Debug Endpoints

### 1. Check User Memory
```bash
curl "https://vic-agent-production.up.railway.app/debug/zep/USER_ID" | jq
```
Replace `USER_ID` with actual user ID (e.g., from Clerk).

### 2. Check Full Debug State
```bash
curl "https://vic-agent-production.up.railway.app/debug/full" | jq
```

### 3. Check Last Request
```bash
curl "https://vic-agent-production.up.railway.app/debug/last-request" | jq
```

## Expected Behavior

### For Returning User (e.g., Dan)
- Zep should return `is_returning: true`
- `topics` array should contain past interests (e.g., "Royal Aquarium")
- Greeting should include name AND last topic:
  - "Dan, son of Vic! Last time we were exploring Royal Aquarium..."

### For New User
- Zep should return `is_returning: false`
- Greeting should ask for name and suggest Thorney Island

## Clear User Memory (if contaminated)
```bash
curl -X DELETE "https://vic-agent-production.up.railway.app/debug/zep/USER_ID"
```

## Frontend Test
1. Go to https://lost-london-v2-copilot.vercel.app
2. Log in with Clerk
3. Click VIC avatar
4. Listen for personalized greeting with name + last topic
