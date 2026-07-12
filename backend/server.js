const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();


const { handleInterviewSocket } = require("./controllers/interviewSocket");
const { handleSet1Socket } = require("./controllers/set1Socket");
const { handleSet2Socket } = require("./controllers/set2Socket");
const { handleSet3Socket } = require("./controllers/set3Socket");
const { handlePostTestSocket } = require("./controllers/postTestSocket");

const app = express();

// 1. Setup middleware (allows frontend to talk to backend)
app.use(cors());
app.use(express.json());

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
app.use("/api/users", userRoutes);

const deepgramRoutes = require("./routes/deepgramRoutes");
app.use("/api/deepgram", deepgramRoutes);

const ttsRoutes = require("./routes/ttsRoutes");
app.use("/api/tts", ttsRoutes);

// DEV-ONLY: AI question generation dry-run (no TTS/STT/WebSocket)
const debugRoutes = require("./routes/debugRoutes");
app.use("/api/debug", debugRoutes);

// 4. Wrap Express in a raw HTTP server so we can share the port with WebSockets
const server = http.createServer(app);

// 5. WebSocket server — blueprint §7 interviewSocket controller
//    ws://localhost:5000/ws/interview
const wss = new WebSocketServer({ noServer: true });

// Upgrade HTTP → WS only for specific paths
server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

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
    `🔌 WebSockets ready at ws://localhost:${PORT}/ws/interview | /ws/set1 | /ws/set2 | /ws/set3 | /ws/posttest`
  );
});
