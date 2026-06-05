const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 1. Setup middleware (allows frontend to talk to backend)
app.use(cors());
app.use(express.json());

// 2. Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Successfully connected to MongoDB!"))
  .catch((err) => console.log("❌ MongoDB connection error:", err));

// 3. Create a simple test route
app.get('/api/test', (req, res) => {
  res.json({ message: "Hello from the backend! The server is running." });
});

// Import your new routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

// 4. Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
