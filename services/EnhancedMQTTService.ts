import { MQTT_CONFIG, UAL_MQTT_CONFIG, MQTT_TOPICS, UAL_MQTT_TOPICS } from '@/constants/MQTTConfig';
import MQTTService from './MQTTService';

export interface AirQualityData { 
    // Core air quality measurements
    rco2: number; // CO2 concentration in ppm
    atmp: number; // Temperature in °C
    rhum: number; // Relative Humidity in %
    tvoc_index: number; // TVOC index
    nox_index: number;  // NOx Index
    pm01: number; // PM1 µg/m³
    pm02: number; // PM2.5 µg/m³
    pm10: number; // PM10 µg/m³
    pm003_count: number; // PM0.3 particle count
    light: number; // Light level
    wifi: number; // WiFi signal strength

    // System information
    firmware?: string; //Firmware version
    ssid?: string; //WiFi SSID
    hwVersion?: number; // Hardware version
    boot?: number; // Boot count
    wdog?: number; // Watchdog count
    
    // Our added fields
    timestamp?: number;
    location?: string; 
    sensorId?: string;
}

class EnhancedMQTTService { 
    private static instance: EnhancedMQTTService;
    private isUALConnected = false;
    private airQualityHandlers: ((data: AirQualityData) => void)[] = [];
    private ualClient: any = null;

    static getInstance(): EnhancedMQTTService { 
        if (!EnhancedMQTTService.instance) { 
            EnhancedMQTTService.instance = new EnhancedMQTTService();
        }
        return EnhancedMQTTService.instance;
    }

    // Plant system connection (unchanged)
    async connectToPlantSystem() { 
        try { 
            await MQTTService.connect( 
                MQTT_CONFIG.HOST,
                MQTT_CONFIG.PORT,
                MQTT_CONFIG.USERNAME,
                MQTT_CONFIG.PASSWORD
            );
            return true;
        } catch (error) { 
            console.error("🔴 Error connecting to plant system MQTT:", error);
            throw error;
        }
    }

    // UAL connection via bridge service
    async connectToUALAirQuality() { 
        try { 
            console.log('🌍 Connecting to UAL via bridge service...');
            
            // Try different connection URLs
            const connectionUrls = [
                'ws://localhost:9001',
                'ws://127.0.0.1:9001',
                'ws://0.0.0.0:9001'
            ];
            
            for (const url of connectionUrls) {
                try {
                    console.log(`🔍 Trying connection to: ${url}`);
                    const connected = await this.tryConnection(url);
                    if (connected) return true;
                } catch (error) {
                    console.log(`❌ Failed to connect to ${url}:`, error.message);
                }
            }
            
            throw new Error('All connection attempts failed');

        } catch (error) { 
            console.error("🔴 UAL bridge connection failed:", error);
            this.isUALConnected = false;
            throw error;
        }
    }

    private async tryConnection(url: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            console.log(`🔗 Creating WebSocket connection to ${url}`);
            const ws = new WebSocket(url);
            
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error(`Connection timeout for ${url}`));
            }, 3000);

            ws.onopen = () => {
                clearTimeout(timeout);
                console.log(`✅ Connected to bridge at ${url}`);
                this.ualClient = ws;
                this.isUALConnected = true;
                this.setupWebSocketHandlers(ws);
                resolve(true);
            };

            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error(`❌ Connection error for ${url}:`, error);
                reject(error);
            };
        });
    }

    private setupWebSocketHandlers(ws: WebSocket) {
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'welcome') {
                    console.log('🎉 Received welcome message from bridge:', data.message);
                    return;
                }
                console.log(`📨 UAL data from ${data.topic}:`, data.payload);
                this.handleUALMessage(data.payload);
            } catch (error) {
                console.error('❌ Error parsing bridge message:', error);
            }
        };

        ws.onclose = () => {
            console.log('🔌 Bridge connection closed');
            this.isUALConnected = false;
        };

        ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isUALConnected = false;
        };
    }

    private handleUALMessage(payload: string) {
        try {
            console.log('📨 UAL message received:', payload);
            
            const rawData = JSON.parse(payload);
            
            const airQualityData: AirQualityData = {
                ...rawData,
                sensorId: rawData.sensorId || 'unknown',
                timestamp: Date.now(),
                location: 'UAL CCI Building'
            };
            
            this.airQualityHandlers.forEach(handler => handler(airQualityData));
            
        } catch (error) {
            console.error('❌ Error parsing UAL message:', error);
        }
    }

    // Connect to both systems
    async connectAll() {
        const results = await Promise.allSettled([
            this.connectToPlantSystem(),
            this.connectToUALAirQuality()
        ]);

        return {
            plantSystem: results[0].status === 'fulfilled',
            ualAirQuality: results[1].status === 'fulfilled'
        };
    }

    // Plant system wrapper methods
    async subscribe(topic: string) { return MQTTService.subscribe(topic); }
    async publish(topic: string, message: string) { return MQTTService.publish(topic, message); }
    onMessage(handler: (topic: string, message: string) => void) { MQTTService.onMessage(handler); }
    offMessage(handler: (topic: string, message: string) => void) { MQTTService.offMessage(handler); }
    onDisconnect(handler: () => void) { MQTTService.onDisconnect(handler); }
    offDisconnect(handler: () => void) { MQTTService.offDisconnect(handler); }
    clearAllListeners() { MQTTService.clearAllListeners(); }

    // Air quality handlers
    onAirQualityData(handler: (data: AirQualityData) => void) {
        this.airQualityHandlers.push(handler);
    }

    offAirQualityData(handler: (data: AirQualityData) => void) {
        const index = this.airQualityHandlers.indexOf(handler);
        if (index > -1) this.airQualityHandlers.splice(index, 1);
    }

    getConnectionStatus() {
        return {
            plantSystem: typeof MQTTService.isConnected === 'function' ? MQTTService.isConnected() : MQTTService.isConnected || false,
            ualAirQuality: this.isUALConnected
        };
    }

    async disconnect() {
        if (MQTTService.disconnect) await MQTTService.disconnect();
        if (this.ualClient) {
            if (this.ualClient.close) {
                this.ualClient.close();
            }
            this.ualClient = null;
        }
        this.isUALConnected = false;
        this.airQualityHandlers = [];
    }
}

export default EnhancedMQTTService.getInstance();