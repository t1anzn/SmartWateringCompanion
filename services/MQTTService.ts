import { Client as PahoClient, Message } from 'paho-mqtt';
import { EventEmitter } from 'events';
import { MQTT_CONFIG } from '@/constants/MQTTConfig';

// Increase the default limit for EventEmitter listeners
EventEmitter.defaultMaxListeners = 20;

class MQTTService {
  client: PahoClient | null = null;
  host: string = '';
  port: string = '';
  clientId: string = '';
  eventEmitter = new EventEmitter();
  isConnected: boolean = false;
  
  constructor() {
    this.clientId = `smart_watering_app_${Math.random().toString(16).substr(2, 8)}`;
  }
  
  connect(host: string, port: string, username?: string, password?: string): Promise<boolean> {
    this.host = host;
    this.port = port;
    
    return new Promise((resolve, reject) => {
      try {
        console.log("🔵 Setting up WebSocket MQTT connection...");
        
        // For HiveMQ Cloud, we need to use the WebSocket path "/mqtt"
        // and enable SSL since it's a secure connection
        const path = "/mqtt";
        console.log(`Host: ${host}, Port: ${port}, Path: ${path}`);
        
        // Create the client with proper parameters
        this.client = new PahoClient(host, Number(port), path, this.clientId);
        
        // Set callback handlers
        this.client.onConnectionLost = (responseObject) => {
          if (responseObject.errorCode !== 0) {
            console.log("🔴 MQTT connection lost:", responseObject.errorMessage);
          } else {
            console.log("🟠 MQTT disconnected normally");
          }
          this.isConnected = false;
          this.eventEmitter.emit('disconnect');
        };
        
        this.client.onMessageArrived = (message) => {
          try {
            console.log(`🔵 Message received: ${message.destinationName} - ${message.payloadString}`);
            this.eventEmitter.emit('message', message.destinationName, message.payloadString);
          } catch (error) {
            console.log("🔴 Error processing message:", error);
          }
        };
        
        // Connect with proper options for HiveMQ Cloud
        const connectOptions: any = {
          timeout: 30,
          useSSL: true, // MUST be true for HiveMQ Cloud
          keepAliveInterval: 60,
          cleanSession: true,
          onSuccess: () => {
            console.log("🟢 MQTT Connected!");
            this.isConnected = true;
            resolve(true);
          },
          onFailure: (err: any) => {
            console.log("🔴 MQTT Connection failed:", err.errorMessage);
            reject(new Error(`Connection failed: ${err.errorMessage}`));
          }
        };
        
        // HiveMQ Cloud requires username and password
        if (username) {
          connectOptions.userName = username;
          connectOptions.password = password;
        }
        
        console.log("Connecting with client ID:", this.clientId);
        this.client.connect(connectOptions);
        
      } catch (error) {
        console.log("🔴 MQTT setup error:", error);
        reject(error);
      }
    });
  }
  
  subscribe(topic: string, qos: 0 | 1 | 2 = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        console.log("🔴 Cannot subscribe, MQTT client not initialized");
        reject(new Error('MQTT client not initialized'));
        return;
      }
      
      if (!this.isConnected) {
        console.log("🔴 Cannot subscribe, MQTT client not connected");
        reject(new Error('MQTT client not connected'));
        return;
      }
      
      try {
        console.log(`🔵 Subscribing to ${topic}...`);
        
        // Use proper options object for subscription
        const subscribeOptions = {
          qos: qos,
          onSuccess: () => {
            console.log(`🟢 Subscribed to ${topic}`);
            resolve();
          },
          onFailure: (err: any) => {
            console.log(`🔴 Failed to subscribe to ${topic}:`, err.errorMessage);
            reject(new Error(`Subscribe failed: ${err.errorMessage}`));
          }
        };
        
        this.client.subscribe(topic, subscribeOptions);
      } catch (error) {
        console.log(`🔴 Error subscribing to ${topic}:`, error);
        reject(error);
      }
    });
  }
  
  publish(topic: string, message: string, qos: 0 | 1 | 2 = 0, retain: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        console.log("🔴 Cannot publish, MQTT client not initialized");
        reject(new Error('MQTT client not initialized'));
        return;
      }
      
      if (!this.isConnected) {
        console.log("🔴 Cannot publish, MQTT client not connected");
        reject(new Error('MQTT client not connected'));
        return;
      }
      
      try {
        console.log(`🔵 Publishing to ${topic}: ${message}`);
        
        // Create message object
        const mqttMessage = new Message(message);
        mqttMessage.destinationName = topic;
        mqttMessage.qos = qos;
        mqttMessage.retained = retain;
        
        this.client.send(mqttMessage);
        console.log(`🟢 Published to ${topic}`);
        resolve();
      } catch (error) {
        console.log(`🔴 Error publishing to ${topic}:`, error);
        reject(error);
      }
    });
  }
  
  onMessage(callback: (topic: string, message: string) => void): void {
    this.eventEmitter.on('message', callback);
  }
  
  onDisconnect(callback: () => void): void {
    this.eventEmitter.on('disconnect', callback);
  }
  
  disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.client) {
        resolve();
        return;
      }
      
      try {
        console.log("🔵 Disconnecting from MQTT broker");
        
        // Only attempt disconnect if connected
        if (this.isConnected) {
          this.client.disconnect();
          console.log("🟢 MQTT Disconnected");
        } else {
          console.log("🟠 MQTT already disconnected");
        }
      } catch (error) {
        console.log("🔴 Error disconnecting from MQTT:", error);
      }
      
      this.client = null;
      this.isConnected = false;
      resolve();
    });
  }
  
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Export a singleton instance
export default new MQTTService();
