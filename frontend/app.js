const socket = io.connect('http://localhost:4000');
let localStream;
let peerConnections = {}; // Keep track of active peer connections

navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;
    let videoElement = document.createElement('video');
    videoElement.srcObject = stream;
    videoElement.autoplay = true;
    document.getElementById('video-container').appendChild(videoElement);
  });

function joinCall() {
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    socket.emit('join-call', { userId: 'user1', lat: latitude, long: longitude });
  });
}

socket.on('connect-user', (data) => {
  const { peerId } = data;
  
  // Initialize WebRTC connection with the new peer
  let peerConnection = new RTCPeerConnection();

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { peerId, signal: event.candidate });
    }
  };

  peerConnection.ontrack = (event) => {
    let videoElement = document.createElement('video');
    videoElement.srcObject = event.streams[0];
    videoElement.autoplay = true;
    document.getElementById('video-container').appendChild(videoElement);
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.createOffer().then(offer => {
    peerConnection.setLocalDescription(offer);
    socket.emit('signal', { peerId, signal: offer });
  });

  peerConnections[peerId] = peerConnection;
});

socket.on('signal', (data) => {
  const { signal, from } = data;

  let peerConnection = peerConnections[from];
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection();
    peerConnections[from] = peerConnection;
  }

  if (signal.type === 'offer') {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
    peerConnection.createAnswer().then(answer => {
      peerConnection.setLocalDescription(answer);
      socket.emit('signal', { peerId: from, signal: answer });
    });
  } else if (signal.type === 'answer') {
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
  } else if (signal.candidate) {
    peerConnection.addIceCandidate(new RTCIceCandidate(signal));
  }
});

function monitorLocation() {
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;
    socket.emit('update-location', { userId: 'user1', lat: latitude, long: longitude });
  });
}

socket.on('disconnect-user', (data) => {
  const { peerId } = data;
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
    document.querySelector(`video[data-peerId="${peerId}"]`).remove();
  }
});
// const googleMapsApiKey = 'YAIzaSyDQkPKppoBEJMH0Y7Q1nyv3bDLHObcX8lU'; 