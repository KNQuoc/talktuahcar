const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const axios = require('axios');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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
    
    // Check for other users in range using Google Distance Matrix API
    let usersInRange = await checkUsersInRangeWithGoogleAPI(userId, lat, long);

    // Notify users in range to connect via WebRTC
    usersInRange.forEach(user => {
      io.to(user.socketId).emit('connect-user', { userId, peerId: socket.id });
    });
  });

  // Handle WebRTC signaling (Offer, Answer, ICE Candidates)
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
      let usersOutOfRange = await checkUsersInRangeWithGoogleAPI(userId, lat, long, 'disconnect');
      usersOutOfRange.forEach(user => {
        io.to(user.socketId).emit('disconnect-user', { peerId: socket.id });
      });
    }
  });
});

// Check if users are within range using Google Distance Matrix API
const checkUsersInRangeWithGoogleAPI = async (userId, lat, long) => {
  const range = 1000; // meters
  const otherUsers = users.filter(user => user.userId !== userId);
  
  if (otherUsers.length === 0) return [];

  const origins = [`${lat},${long}`];
  const destinations = otherUsers.map(user => `${user.lat},${user.long}`).join('|');

  const googleMapsUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&key=YAIzaSyDQkPKppoBEJMH0Y7Q1nyv3bDLHObcX8lU`;
  
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

server.listen(4000, () => console.log('Server is running on port 4000'));
