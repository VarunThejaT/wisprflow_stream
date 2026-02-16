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
| Deploy   | Fly.io              | Free tier, HTTPS + WSS, low latency      |

No database. No framework. No build tools.

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

### Phase 4 — Future (out of scope for now)
- Auth (simple passphrase or token).
- Multiple rooms/channels.
- Message history (persist last N in memory).
