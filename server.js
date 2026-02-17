const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const jwt = require("jsonwebtoken");
const jwksRsa = require("jwks-rsa");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || "https://qufeotwtcvdpdqngysuj.supabase.co";

const jwksClient = jwksRsa({
  jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 600000, // 10 minutes
});

function getSigningKey(header) {
  return new Promise((resolve, reject) => {
    jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) return reject(err);
      resolve(key.getPublicKey());
    });
  });
}

function verifyToken(token) {
  return new Promise((resolve, reject) => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded) return reject(new Error("Could not decode token"));

    getSigningKey(decoded.header)
      .then((publicKey) => {
        const payload = jwt.verify(token, publicKey, { algorithms: ["ES256"] });
        resolve(payload);
      })
      .catch(reject);
  });
}

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
};

const server = http.createServer((req, res) => {
  const reqPath = url.parse(req.url).pathname;
  const filePath = path.join(
    __dirname,
    "public",
    reqPath === "/" ? "index.html" : reqPath
  );
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
  const params = new URLSearchParams(url.parse(req.url).query);
  const token = params.get("token");

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  let payload;
  try {
    payload = await verifyToken(token);
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    ws.close(4003, "Invalid token");
    return;
  }

  const userId = payload.sub;
  ws.userId = userId;

  console.log(`Client connected: user=${userId} (${wss.clients.size} total)`);

  ws.on("message", (data) => {
    const message = data.toString();
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === 1 && client.userId === userId) {
        client.send(message);
      }
    }
  });

  ws.on("close", () => {
    console.log(`Client disconnected: user=${userId} (${wss.clients.size} total)`);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
