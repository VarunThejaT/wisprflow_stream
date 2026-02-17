# WisprFlow Stream — Plan

## Problem

When working across two workstations, there's no fast way to get speech-to-text
output from one machine (running WisprFlow) into the clipboard of another.
Copy-pasting via Slack/email adds latency and keystrokes.

## Goal

A minimal web app where:
- **Workstation A (sender):** Dictate text via WisprFlow, press Enter to send.
- **Workstation B (receiver):** Message arrives instantly and is auto-copied
  to clipboard. The receiver tab will be kept **in focus**.

Single user. No auth for now. Works over the internet (different networks).
Messages are short — a few tens of words.

---

## Architecture

```
 [WS-A: Browser]  ---wss--->  [Cloud Server]  ---wss--->  [WS-B: Browser]
   (sender)                     (relay)                    (receiver + auto-copy)
```

- **WebSocket** for lowest latency (~200ms over internet).
- Server is a stateless relay — receives a message, broadcasts to all other
  connected clients.
- Single HTML page serves as both sender and receiver.
- Clipboard write uses `navigator.clipboard.writeText()` — requires HTTPS
  and a focused tab (both guaranteed by our setup).

## Tech Stack

| Layer    | Choice              | Why                                      |
|----------|---------------------|------------------------------------------|
| Server   | Node.js + `ws`      | Minimal, fast, no framework overhead     |
| Frontend | Vanilla HTML/JS/CSS | No build step, single file, instant load |
| Auth     | Supabase Auth       | Google OAuth + email/password, built-in  |
| Deploy   | Fly.io              | Free tier, HTTPS + WSS, low latency      |

## UI

Single page, two modes controlled by an **auto-copy toggle**:

- **Sender mode** (auto-copy OFF): Text input + Send button. Enter to send.
  Shows sent messages in a log. Input auto-clears and re-focuses after send.
- **Receiver mode** (auto-copy ON): Same page, but incoming messages are
  automatically written to clipboard. Visual flash confirms each copy.

Other elements:
- **Connection status** — green/red dot.
- **Auto-copy toggle** — persisted in localStorage. Defaults to OFF.
  When ON, every incoming message is copied to clipboard.
- **Click-to-copy** — each message has a copy button as fallback.

## File Structure

```
wisprflow_stream/
├── server.js          # WebSocket relay + static file server (~50 lines)
├── public/
│   └── index.html     # Single-page UI (HTML + inline JS + CSS)
├── package.json       # Only dependency: ws
├── Dockerfile         # For deployment
├── fly.toml           # Fly.io config
├── plan.md
└── README.md
```

## Implementation Steps

### Phase 1 — MVP
1. `npm init`, install `ws`.
2. Build `server.js`:
   - Serve `public/` over HTTP.
   - WebSocket server on the same port (HTTP upgrade).
   - On message: broadcast JSON to all other connected clients.
3. Build `public/index.html`:
   - Connect to WebSocket (auto-detect ws/wss from page protocol).
   - Text input + Enter to send. Show sent/received messages in a log.
   - Auto-copy toggle (localStorage). When ON, incoming messages are
     written to clipboard via `navigator.clipboard.writeText()`.
   - Green/red connection dot.
   - Click-to-copy button on each message.
4. Test locally with two browser tabs.

### Phase 2 — Polish
5. Visual flash/highlight on received + copied messages.
6. Auto-reconnect with exponential backoff on disconnect.
7. Sound or browser notification on incoming message (optional).

### Phase 3 — Deploy
8. Create `Dockerfile` (Node.js alpine, copy files, expose port).
9. Create `fly.toml` (single machine, auto-stop disabled for always-on).
10. Deploy to Fly.io. Test end-to-end over the internet.

### Phase 4 — Auth (Supabase)

**Goal:** Only authenticated users can access the app. Each user's messages are
private — they relay only between that user's own sessions (e.g., laptop ↔ desktop).

**Auth provider:** Supabase Auth (hosted, free tier)
- Google OAuth sign-in
- Email + password sign-up / sign-in
- JWT-based sessions

**Architecture with auth:**

```
[Browser]  --login-->  [Supabase Auth]  --JWT-->  [Browser]
[Browser]  --wss + JWT-->  [Server]  --verify JWT-->  [Supabase]
[Server]  --broadcast to same user_id only-->  [Other sessions]
```

**How it works:**
1. User opens the app → sees a login page (Google or email/password).
2. Supabase Auth handles the login flow and returns a JWT.
3. Browser connects to WebSocket, passing the JWT as a query param or in the
   first message.
4. Server verifies the JWT against Supabase's public JWT secret.
5. Server tags the WebSocket connection with the user's ID.
6. On message: server broadcasts only to other connections with the **same
   user ID** (private relay).
7. Unauthenticated or expired connections are rejected.

**Implementation steps:**

11. Set up Supabase project:
    - Create project on supabase.com.
    - Enable Google OAuth provider (requires Google Cloud Console OAuth credentials).
    - Enable email/password auth.
    - Note the project URL, anon key, and JWT secret.

12. Add login page (`public/login.html`):
    - Include Supabase JS client (`@supabase/supabase-js` via CDN).
    - "Sign in with Google" button → `supabase.auth.signInWithOAuth()`.
    - Email + password form → `supabase.auth.signUp()` / `signInWithPassword()`.
    - On successful auth, redirect to `index.html`.

13. Protect `index.html`:
    - On page load, check `supabase.auth.getSession()`.
    - If no session, redirect to `login.html`.
    - Pass the access token when connecting to WebSocket:
      `new WebSocket(\`wss://host?token=\${session.access_token}\`)`.
    - Add a logout button.

14. Update `server.js` — authenticate WebSocket connections:
    - Install `jsonwebtoken` dependency.
    - On WebSocket upgrade: extract token from query string.
    - Verify JWT using Supabase's JWT secret.
    - Extract `user_id` from the token payload. Tag the connection.
    - Reject connections with missing/invalid/expired tokens.

15. Update `server.js` — private relay:
    - Change broadcast logic: instead of sending to all other clients,
      send only to clients with the **same user_id**.

16. Set environment variables on Fly.io:
    - `SUPABASE_JWT_SECRET` — for server-side JWT verification.
    - Redeploy.

17. Test end-to-end:
    - Login with Google on Workstation A.
    - Login with same account on Workstation B.
    - Verify messages relay only between your own sessions.
    - Verify a different user's messages are isolated.

**File structure after Phase 4:**

```
wisprflow_stream/
├── server.js              # WebSocket relay + auth verification
├── public/
│   ├── index.html         # Main app (protected)
│   └── login.html         # Login page (Google OAuth + email/password)
├── package.json           # Dependencies: ws, jsonwebtoken
├── Dockerfile
├── fly.toml
├── plan.md
└── README.md
```

### Phase 5 — Future (out of scope for now)
- Multiple rooms/channels per user.
- Message history (persist last N messages per user in Supabase DB).
- Rate limiting.
- Mobile support / PWA.
