const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");
const { requireSchoolUser, requireAdmin, authenticateSocket } = require('./middleware/schoolAuth');
// Load the backend configuration even when launched from the repository root.
require("dotenv").config({ path: require("node:path").join(__dirname, ".env") });


const { handleInterviewSocket } = require("./controllers/interviewSocket");
const { handleSet1Socket } = require("./controllers/set1Socket");
const { handleSet2Socket } = require("./controllers/set2Socket");
const { handleSet3Socket } = require("./controllers/set3Socket");
const { handlePostTestSocket } = require("./controllers/postTestSocket");
const { handleDevSttSocket } = require("./controllers/devSttSocket");
const { handleDemoSocket } = require("./controllers/demoSocket");
const { handleMicTestSocket } = require("./controllers/micTestSocket");
const { handlePracticeAgainSocket } = require("./controllers/practiceAgainSocket");
const { handleVoiceAgentSocket } = require("./controllers/voiceAgentSocket");

const app = express();

// 1. Setup middleware (allows frontend to talk to backend)
app.use(cors());
// Mount public chat before the global parser so its smaller body limit applies.
const recommendationRoutes = require("./routes/recommendationRoutes");
app.use("/api/recommendations", recommendationRoutes);
// Private coach has its own small parser and verified account quotas.
app.use("/api/coach", require("./routes/coachRoutes"));
app.use("/api/practice-again", require("./routes/practiceAgainRoutes"));
app.use(express.json());
app.use((error, req, res, next) => {
  if (error.type !== 'entity.parse.failed') return next(error);
  res.status(400).json({ error: 'Invalid JSON body.' });
});

// 2. Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Successfully connected to MongoDB!"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// 3. Create a simple test route
app.get("/api/test", (req, res) => {
  res.json({ message: "Hello from the backend! The server is running." });
});

// Import REST routes
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", requireSchoolUser, userRoutes);
app.use("/api/admin", requireAdmin, require("./routes/adminRoutes"));

const deepgramRoutes = require("./routes/deepgramRoutes");
app.use("/api/deepgram", requireSchoolUser, deepgramRoutes);

const ttsRoutes = require("./routes/ttsRoutes");
app.use("/api/tts", ttsRoutes);

const voiceAgentRoutes = require("./routes/voiceAgentRoutes");
app.use("/api/voice-agent", voiceAgentRoutes);

// DEV-ONLY: AI question generation dry-run (no TTS/STT/WebSocket)
const debugRoutes = require("./routes/debugRoutes");
app.use("/api/debug", (req, res, next) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  next();
}, requireSchoolUser, debugRoutes);

// 4. Wrap Express in a raw HTTP server so we can share the port with WebSockets
const server = http.createServer(app);

// 5. WebSocket server — blueprint §7 interviewSocket controller
//    ws://localhost:5000/ws/interview
const wss = new WebSocketServer({ noServer: true, handleProtocols: (protocols) => protocols.has('iterview') ? 'iterview' : false });

// Upgrade HTTP → WS only for specific paths
server.on("upgrade", async (request, socket, head) => {
  socket.on('error', () => {});
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  const protectedPaths = ['/ws/interview', '/ws/set1', '/ws/set2', '/ws/set3', '/ws/posttest', '/ws/voice-agent', '/ws/dev-stt-test', '/ws/mic-test', '/ws/practice-again'];
  if (pathname === '/ws/dev-stt-test' && process.env.NODE_ENV === 'production') {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }
  if (protectedPaths.includes(pathname)) {
    try {
      await authenticateSocket(request);
    } catch (error) {
      const status = error.status || 401;
      socket.end(`HTTP/1.1 ${status} ${status === 403 ? 'Forbidden' : status === 503 ? 'Service Unavailable' : 'Unauthorized'}\r\nConnection: close\r\n\r\n`);
      return;
    }
    if (socket.destroyed) return;
  }

  if (pathname === "/ws/interview") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleInterviewSocket(ws, request);
    });
  } else if (pathname === "/ws/set1") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleSet1Socket(ws, request);
    });
  } else if (pathname === "/ws/set2") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleSet2Socket(ws, request);
    });
  } else if (pathname === "/ws/set3") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleSet3Socket(ws, request);
    });
  } else if (pathname === "/ws/posttest") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handlePostTestSocket(ws, request);
    });
  } else if (pathname === "/ws/dev-stt-test") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleDevSttSocket(ws, request);
    });
  } else if (pathname === "/ws/practice-again") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handlePracticeAgainSocket(ws, request);
    });
  } else if (pathname === "/ws/mic-test") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleMicTestSocket(ws);
    });
  } else if (pathname === "/ws/demo") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleDemoSocket(ws, request);
    });
  } else if (pathname === "/ws/voice-agent") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      handleVoiceAgentSocket(ws, request);
    });
  } else {
    socket.destroy(); // reject unknown WS paths
  }
});

// 6. Start the server
const PORT = process.env.PORT || 5000;

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Kill the process holding it and restart.`
    );
    console.error(
      `   Run: Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force`
    );
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(
    `🔌 WebSockets ready at ws://localhost:${PORT}/ws/interview | /ws/set1 | /ws/set2 | /ws/set3 | /ws/posttest | /ws/demo | /ws/mic-test | /ws/voice-agent`
  );
});
