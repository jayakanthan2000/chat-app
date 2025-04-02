const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('./models/User');
const Message = require('./models/Message');
const Room = require('./models/Room');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4200",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// MongoDB Connection with retry logic
const connectDB = async () => {
  try {
    const conn = await mongoose.connect('mongodb://localhost:27017/chatapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      w: 'majority'
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Test the connection by creating a test document
    const testUser = new User({
      username: 'test',
      email: 'test@test.com',
      password: await bcrypt.hash('test123', 10)
    });
    await testUser.save();
    console.log('Test user created successfully');
    
    // Clean up test user
    await User.deleteOne({ email: 'test@test.com' });
    console.log('Test user cleaned up');
    
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// REST API endpoints with enhanced error handling
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    const savedUser = await user.save();
    console.log('New user registered:', savedUser.username);
    res.status(201).json({ message: 'User created successfully', userId: savedUser._id });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log(req.body);
    let param = JSON.parse(req.body?.['param']);
    console.log(param);
    const { email, password } = param;
    console.log('email',email)
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    
    // Update last seen
    user.lastSeen = new Date();
    await user.save();
    
    const token = jwt.sign({ id: user._id, username: user.username }, 'your-secret-key');
    console.log('User logged in:', user.username);
    res.json({ 
      token, 
      user: { 
        _id: user._id,
        username: user.username, 
        email: user.email 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, isPrivate } = req.body;
    
    // Check if room already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room already exists' });
    }
    
    const room = new Room({
      name,
      description,
      createdBy: req.user.id,
      members: [req.user.id],
      isPrivate
    });
    
    const savedRoom = await room.save();
    console.log('New room created:', savedRoom.name);
    res.status(201).json(savedRoom);
  } catch (error) {
    console.error('Room creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await Room.find({ 
      $or: [
        { isPrivate: false },
        { members: req.user.id }
      ]
    }).populate('createdBy', 'username');
    console.log('Rooms fetched for user:', req.user.username);
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(400).json({ error: error.message });
  }
});

// Socket.IO middleware for authentication
io.use(async (socket, next) => {
  // console.log('io auth', socket.handshake);
  console.log("Received query:", socket.handshake.query);
  try {
    const token = socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    console.log('token passed');

    const decoded = jwt.verify(token, 'your-secret-key');
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.user.username);

  socket.on('join-room', async (roomName) => {
    console.log(`User ${socket.user.username} joined room: ${roomName}`);
    socket.join(roomName);
    
    try {
      const messages = await Message.find({ room: roomName })
        .sort({ timestamp: 1 })
        .limit(50)
        .populate('user', 'username email');
      console.log(`Fetched ${messages.length} messages for room: ${roomName}`);
      socket.emit('room-messages', messages);
    } catch (error) {
      console.error('Error fetching room messages:', error);
      socket.emit('error', { message: 'Failed to fetch messages' });
    }
  });

  socket.on('leave-room', (roomName) => {
    console.log(`User ${socket.user.username} left room: ${roomName}`);
    socket.leave(roomName);
  });

  socket.on('message', async (message) => {
    console.log('Message received:', message);
    
    try {
      const newMessage = new Message({
        content: message.content,
        user: socket.user._id,
        room: message.room,
        type: message.type || 'text',
        metadata: message.metadata
      });
      
      const savedMessage = await newMessage.save();
      console.log('Message saved:', savedMessage._id);
      
      // Update room's last activity
      await Room.findOneAndUpdate(
        { name: message.room },
        { lastActivity: new Date() }
      );
      
      // Populate user info before emitting
      const populatedMessage = await Message.findById(savedMessage._id)
        .populate('user', 'username email');
      
      io.to(message.room).emit('message', populatedMessage);
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('error', { message: 'Failed to save message' });
    }
  });

  socket.on('get-room-messages', async (roomName) => {
    try {
      const messages = await Message.find({ room: roomName })
        .sort({ timestamp: 1 })
        .limit(50)
        .populate('user', 'username email');
      console.log(`Fetched ${messages.length} messages for room: ${roomName}`);
      socket.emit('room-messages', messages);
    } catch (error) {
      console.error('Error fetching room messages:', error);
      socket.emit('error', { message: 'Failed to fetch messages' });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.user.username);
    // Update user's last seen
    try {
      await User.findByIdAndUpdate(socket.user._id, {
        lastSeen: new Date()
      });
      console.log('Updated last seen for user:', socket.user.username);
    } catch (error) {
      console.error('Error updating user last seen:', error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 