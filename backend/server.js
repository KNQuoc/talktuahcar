const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();
const server = http.createServer(app);

// Explicitly set Socket.io CORS options
const io = socketIo(server, {
  cors: {
    origin: '*',  // Allow any origin; can restrict to specific Ngrok URL if needed
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type'],
    credentials: true
  }
});

// Enable CORS for Express with more explicit options
app.use(cors({
  origin: '*', // You can restrict to your Ngrok URL like: 'https://your-ngrok-url.ngrok.io'
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Route to serve index.html as the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Socket.io logic
let users = [];

io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join-call', async (data) => {
    const { userId, lat, long } = data;
    users.push({ userId, lat, long, socketId: socket.id });
    
    try {
      // Check for other users in range using Google Distance Matrix API
      let usersInRange = await checkUsersInRangeWithGoogleAPI(userId, lat, long);
  
      // Notify users in range to connect via WebRTC
      usersInRange.forEach(user => {
        io.to(user.socketId).emit('connect-user', { userId, peerId: socket.id });
      });
    } catch (error) {
      console.error('Error in join-call:', error);
    }
  });

  socket.on('signal', (data) => {
    io.to(data.peerId).emit('signal', { signal: data.signal, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
    users = users.filter(user => user.socketId !== socket.id);
  });

  socket.on('update-location', async (data) => {
    const { userId, lat, long } = data;
    let user = users.find(user => user.userId === userId);
    if (user) {
      user.lat = lat;
      user.long = long;
      
      // Recheck range and disconnect users if necessary
      try {
        let usersOutOfRange = await checkUsersInRangeWithGoogleAPI(userId, lat, long, 'disconnect');
        usersOutOfRange.forEach(user => {
          io.to(user.socketId).emit('disconnect-user', { peerId: socket.id });
        });
      } catch (error) {
        console.error('Error updating location:', error);
      }
    }
  });
});

// Check if users are within range using Google Distance Matrix API
const checkUsersInRangeWithGoogleAPI = async (userId, lat, long) => {
  const range = 1000; // meters
  const otherUsers = users.filter(user => user.userId !== userId);
  
  if (otherUsers.length === 0) return [];

  const origins = `${lat},${long}`;
  const destinations = otherUsers.map(user => `${user.lat},${user.long}`).join('|');

  const googleMapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=YOUR_GOOGLE_MAPS_API_KEY`;

  try {
    const response = await axios.get(googleMapsUrl);
    const results = response.data.rows[0].elements;
    
    let usersInRange = [];
    
    results.forEach((result, index) => {
      if (result.distance.value <= range) {  // distance in meters
        usersInRange.push(otherUsers[index]);
      }
    });
    
    return usersInRange;
  } catch (error) {
    console.error('Error fetching distance data from Google:', error);
    return [];
  }
};

server.listen(4000, '0.0.0.0', () => console.log('Server is running on port 4000'));
