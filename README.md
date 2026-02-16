# WisprFlow Stream

Send text from one workstation and have it instantly copied to the clipboard on another. Built for speech-to-text workflows where you dictate on one machine and paste on another.

**Live app:** https://wisprflow-stream.fly.dev

---

## For Users

### How It Works

1. Open https://wisprflow-stream.fly.dev on both workstations.
2. **Sender (Workstation A):** Turn **Auto-copy OFF**. Type or dictate text, press Enter to send.
3. **Receiver (Workstation B):** Keep **Auto-copy ON** (the default). Incoming messages are automatically copied to your clipboard. Keep this tab **in focus**.
4. Switch to any app on Workstation B and paste.

Messages are relayed in real time over WebSockets (~200ms latency over the internet).

### Features

- **Auto-copy to clipboard** — incoming messages are written to clipboard instantly (toggle on/off, persisted across sessions)
- **Notification sound** — audible beep on incoming messages (toggle on/off)
- **Connection status** — green/red dot shows connection state
- **Auto-reconnect** — reconnects automatically if the connection drops
- **Click-to-copy** — manual copy button on each message as a fallback
- **No account required** — just open the URL and start sending

### Important Notes

- The **receiver tab must stay in focus** for auto-copy to work. This is a browser security requirement — clipboard writes are blocked in background tabs.
- The app requires **HTTPS** for clipboard access. The deployed version at `wisprflow-stream.fly.dev` handles this automatically.

---

## For Developers

### Architecture

```
[Browser A]  ---wss--->  [Cloud Server]  ---wss--->  [Browser B]
  (sender)                 (relay)                   (receiver + auto-copy)
```

The server is a stateless WebSocket relay built with Node.js and the `ws` library. It receives a message from one client and broadcasts it to all other connected clients. No database, no framework, no build tools.

### Tech Stack

| Layer    | Choice              |
|----------|---------------------|
| Server   | Node.js + `ws`      |
| Frontend | Vanilla HTML/JS/CSS |
| Deploy   | Fly.io (HTTPS + WSS)|


### Running Locally

```bash
git clone https://github.com/VarunThejaT/wisprflow_stream.git
cd wisprflow_stream
npm install
npm start
```

The server runs on `http://localhost:3000`. Note: clipboard auto-copy requires HTTPS (or localhost with the tab in focus).

### Deploying to Fly.io

```bash
# Install flyctl (one-time)
curl -L https://fly.io/install.sh | sh

# Authenticate and deploy
fly auth login
fly launch
fly deploy
```

The app will be available at `https://<your-app-name>.fly.dev` with HTTPS and WebSocket support out of the box.
