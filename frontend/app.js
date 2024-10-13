const socket = io.connect('https://df2e-141-215-172-213.ngrok-free.app'); // Replace with your domain or IP
let localStream;
let peerConnections = {}; // Store peer connections
let userId = 'user' + Math.floor(Math.random() * 1000); // Random user ID for testing

// Request access to user's camera and microphone
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  .then(stream => {
    localStream = stream;http://141.215.172.213:4000
    displayVideoStream(localStream, 'local'); // Display local video

    // Emit an event to join the call
    joinCall();
  })
  .catch(error => {
    console.error('Error accessing media devices.', error);
    alert('Please enable camera and microphone permissions.');
  });

// Function to display video stream in the UI
function displayVideoStream(stream, id) {
  let videoElement = document.createElement('video');
  videoElement.id = id;
  videoElement.srcObject = stream;
  videoElement.autoplay = true;
  videoElement.muted = (id === 'local'); // Mute own video
  document.getElementById('video-container').appendChild(videoElement);
}

// Function to join the call and emit geolocation data
function joinCall() {
  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;
    socket.emit('join-call', { userId, lat: latitude, long: longitude });
  });
}

// When a new peer joins, create a new peer connection
socket.on('connect-user', (data) => {
  const { peerId } = data;
  createPeerConnection(peerId);

  // Create and send an offer to the new peer
  peerConnections[peerId].createOffer().then(offer => {
    return peerConnections[peerId].setLocalDescription(offer);
  }).then(() => {
    socket.emit('signal', { peerId, signal: peerConnections[peerId].localDescription });
  });
});

// Function to create a new RTCPeerConnection for a peer
function createPeerConnection(peerId) {
  const peerConnection = new RTCPeerConnection();

  // Add local stream tracks to the peer connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Handle incoming ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('signal', { peerId, signal: event.candidate });
    }
  };

  // Handle the remote stream from the other peer
  peerConnection.ontrack = (event) => {
    if (!document.getElementById(peerId)) {
      displayVideoStream(event.streams[0], peerId); // Display the remote video
    }
  };

  peerConnections[peerId] = peerConnection; // Store peer connection
}

// When receiving a signal from another peer
socket.on('signal', (data) => {
  const { signal, from } = data;

  if (!peerConnections[from]) {
    createPeerConnection(from);
  }

  const peerConnection = peerConnections[from];

  if (signal.type === 'offer') {
    // Handle incoming offer
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal)).then(() => {
      return peerConnection.createAnswer();
    }).then(answer => {
      return peerConnection.setLocalDescription(answer);
    }).then(() => {
      socket.emit('signal', { peerId: from, signal: peerConnection.localDescription });
    });
  } else if (signal.type === 'answer') {
    // Handle incoming answer
    peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
  } else if (signal.candidate) {
    // Add the ICE candidate
    peerConnection.addIceCandidate(new RTCIceCandidate(signal));
  }
});

// If the other user disconnects
socket.on('disconnect-user', (data) => {
  const { peerId } = data;
  if (peerConnections[peerId]) {
    peerConnections[peerId].close();
    delete peerConnections[peerId];
    document.getElementById(peerId).remove(); // Remove video element
  }
});
