const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const { handleInterviewSocket } = require("./controllers/interviewSocket");

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

// 4. Wrap Express in a raw HTTP server so we can share the port with WebSockets
const server = http.createServer(app);

// 5. WebSocket server — blueprint §7 interviewSocket controller
//    ws://localhost:5000/ws/interview
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws) => {
  handleInterviewSocket(ws);
});

// Upgrade HTTP → WS only for the /ws/interview path
server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === "/ws/interview") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy(); // reject unknown WS paths
  }
});

// 6. Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready at ws://localhost:${PORT}/ws/interview`);
});
