const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(cors());
app.use(express.json());

// MongoDB connection setup
mongoose.connect('mongodb://localhost:27017/callApp', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log(err));

// Example Schema for user call history
const CallSchema = new mongoose.Schema({
    caller: String,
    callee: String,
    startTime: Date,
    endTime: Date,
});

const Call = mongoose.model('Call', CallSchema);

// WebRTC signaling logic
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('join-call', (roomID) => {
        socket.join(roomID);
        socket.to(roomID).emit('user-connected', socket.id);
    });

    socket.on('signal', (data) => {
        io.to(data.to).emit('signal', { from: data.from, signal: data.signal });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Starting server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
