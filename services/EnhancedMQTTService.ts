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

    // Simple UAL connection test
    async connectToUALAirQuality() { 
        try { 
            console.log('🌍 Testing UAL Air Quality MQTT connection...');
            
            // Try WebSocket connection first
            const { default: mqtt } = await import('mqtt/dist/mqtt.min.js');
            
            const wsUrl = `ws://${UAL_MQTT_CONFIG.HOST}:8083/mqtt`;
            console.log(`🔗 Attempting connection to: ${wsUrl}`);
            
            this.ualClient = mqtt.connect(wsUrl, {
                username: UAL_MQTT_CONFIG.USERNAME,
                password: UAL_MQTT_CONFIG.PASSWORD,
                clientId: `SmartWatering_UAL_${Date.now()}`,
                connectTimeout: 15000,
                keepalive: 60
            });

            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log("❌ UAL connection timeout");
                    this.ualClient?.end();
                    reject(new Error("Connection timeout"));
                }, 15000);

                this.ualClient.on('connect', () => {
                    clearTimeout(timeout);
                    console.log('✅ UAL MQTT connected successfully');
                    this.isUALConnected = true;
                    
                    // Subscribe to air quality data
                    this.ualClient.subscribe(UAL_MQTT_TOPICS.AIR_QUALITY_READINGS, (err: any) => {
                        if (err) {
                            console.error('❌ Subscribe failed:', err);
                            reject(err);
                        } else {
                            console.log('📡 Subscribed to air quality readings');
                            this.setupMessageHandler();
                            resolve(true);
                        }
                    });
                });

                this.ualClient.on('error', (error: any) => {
                    clearTimeout(timeout);
                    console.error('❌ UAL MQTT connection error:', error);
                    this.isUALConnected = false;
                    reject(error);
                });

                this.ualClient.on('close', () => {
                    console.log('🔌 UAL MQTT connection closed');
                    this.isUALConnected = false;
                });
            });

        } catch (error) { 
            console.error("🔴 UAL connection failed:", error);
            this.isUALConnected = false;
            throw error;
        }
    }

    private setupMessageHandler() {
        this.ualClient.on('message', (topic: string, message: Buffer) => {
            try {
                console.log(`📨 UAL message on ${topic}:`, message.toString());
                
                const rawData = JSON.parse(message.toString());
                const sensorId = topic.split('/')[2];
                
                const airQualityData: AirQualityData = {
                    ...rawData,
                    sensorId,
                    timestamp: Date.now()
                };
                
                this.airQualityHandlers.forEach(handler => handler(airQualityData));
                
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        });
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
            plantSystem: MQTTService.isConnected ? MQTTService.isConnected() : false,
            ualAirQuality: this.isUALConnected
        };
    }

    async disconnect() {
        if (MQTTService.disconnect) await MQTTService.disconnect();
        if (this.ualClient) {
            this.ualClient.end();
            this.ualClient = null;
        }
        this.isUALConnected = false;
        this.airQualityHandlers = [];
    }
}

export default EnhancedMQTTService.getInstance();