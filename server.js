require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/privymessages')
  .then(async () => {
    console.log('✓ MongoDB connected');
    await createAdminIfNotExists();
  })
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

async function createAdminIfNotExists() {
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await User.findOne({ isAdmin: true });
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 10);
    await User.create({ username: adminUsername, password: hashed, isAdmin: true });
    console.log(`✓ Admin created — username: "${adminUsername}" password: "${adminPassword}"`);
    console.log('  Change ADMIN_PASSWORD in .env before going live!');
  }
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin', require('./routes/admin'));

// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io auth middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'changeme_secret');
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// Online users map: userId (string) -> socketId
const onlineUsers = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.id.toString();
  onlineUsers.set(userId, socket.id);

  // Broadcast updated online list
  io.emit('users_online', Array.from(onlineUsers.keys()));
  console.log(`+ ${socket.user.username} connected`);

  socket.on('disconnect', () => {
    onlineUsers.delete(userId);
    io.emit('users_online', Array.from(onlineUsers.keys()));
    console.log(`- ${socket.user.username} disconnected`);
  });
});

// Share io and onlineUsers with routes
app.set('io', io);
app.set('onlineUsers', onlineUsers);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🔒 PrivyMessages running → http://localhost:${PORT}\n`);
});
