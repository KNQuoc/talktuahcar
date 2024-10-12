import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io.connect('http://localhost:5001');

function App() {
    const [myId, setMyId] = useState('');
    const [remoteId, setRemoteId] = useState('');
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerRef = useRef(null);

    useEffect(() => {
        socket.on('connect', () => {
            setMyId(socket.id);
        });

        socket.on('user-connected', (userId) => {
            console.log('User connected:', userId);
            setRemoteId(userId);
        });

        socket.on('signal', (data) => {
            peerRef.current.signal(data.signal);
        });
    }, []);

    const startCall = async () => {
        const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = localStream;
        
        const Peer = require('simple-peer');
        peerRef.current = new Peer({
            initiator: true,
            trickle: false,
            stream: localStream,
        });

        peerRef.current.on('signal', (signal) => {
            socket.emit('signal', { to: remoteId, from: myId, signal });
        });

        peerRef.current.on('stream', (stream) => {
            remoteVideoRef.current.srcObject = stream;
        });
    };

    return (
        <div>
            <h2>My ID: {myId}</h2>
            <video ref={localVideoRef} autoPlay muted></video>
            <video ref={remoteVideoRef} autoPlay></video>
            <button onClick={startCall}>Start Call</button>
        </div>
    );
}

export default App;
