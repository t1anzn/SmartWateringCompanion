const mqtt = require('mqtt');
const WebSocket = require('ws');

// UAL MQTT Connection
const ualClient = mqtt.connect('mqtt://mqtt.cci.arts.ac.uk:1883', {
    username: 'YOUR_UAL_USERNAME', // Replace with your actual UAL username
    password: 'YOUR_UAL_PASSWORD', // Replace with your actual UAL password
    clientId: `UAL_Bridge_${Date.now()}`
});

// WebSocket Server for React Native
const wss = new WebSocket.Server({ 
    port: 9001,
    host: '0.0.0.0' // Listen on all interfaces
});

let connectedClients = [];

wss.on('connection', (ws, req) => {
    console.log('✅ React Native client connected from:', req.socket.remoteAddress);
    connectedClients.push(ws);
    
    // Send a welcome message
    ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to UAL Bridge',
        timestamp: Date.now()
    }));
    
    ws.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== ws);
        console.log('❌ React Native client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket client error:', error);
    });
});

wss.on('error', (error) => {
    console.error('❌ WebSocket server error:', error);
});

// Forward UAL data to React Native clients
ualClient.on('connect', () => {
    console.log('✅ Connected to UAL MQTT');
    ualClient.subscribe('airgradient/#', (err) => {
        if (err) {
            console.error('❌ Failed to subscribe:', err);
        } else {
            console.log('📡 Subscribed to airgradient/#');
        }
    });
});

ualClient.on('message', (topic, message) => {
    const data = {
        topic,
        payload: message.toString(),
        timestamp: Date.now()
    };
    
    console.log(`📨 Received: ${topic} - ${message.toString()}`);
    
    // Send to all connected React Native clients
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
});

ualClient.on('error', (error) => {
    console.error('❌ UAL MQTT error:', error);
});

console.log('🚀 MQTT Bridge starting on ws://localhost:9001');
console.log('🌐 Also listening on ws://0.0.0.0:9001 for network access');
console.log('📋 Make sure you have run: npm install mqtt ws');
console.log('🌐 Connecting to UAL MQTT...');
