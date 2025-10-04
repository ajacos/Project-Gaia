# ESP32 Soil Monitor Dashboard

An elegant, mobile-friendly dashboard for monitoring soil moisture, humidity, and temperature using ESP32 sensors with an integrated AI chatbot assistant.

## Features

### 📱 Mobile-First Design
- Fully responsive layout optimized for mobile devices
- Touch-friendly interface with smooth animations
- PWA-ready for installation on mobile devices

### 📊 Real-Time Sensor Monitoring
- **Soil Moisture**: Real-time soil moisture percentage with visual indicators
- **Humidity**: Ambient humidity monitoring with status indicators
- **Temperature**: Temperature readings with optimal range indicators
- **Progress Bars**: Visual representation of all sensor values

### 🤖 AI Plant Care Assistant
- Interactive chatbot for plant care advice
- Quick action buttons for common questions
- Intelligent responses based on current sensor readings
- Plant health analysis and recommendations

### 🎨 Elegant Design
- Modern, clean interface with smooth animations
- Color-coded sensor cards with gradients
- Professional typography and spacing
- Dark/light theme ready

## Quick Start

1. **Open the Dashboard**
   ```
   Simply open index.html in any modern web browser
   ```

2. **For Local Development**
   ```bash
   # If you have Python installed
   python -m http.server 8000
   
   # Or if you have Node.js installed
   npx serve .
   
   # Then open http://localhost:8000
   ```

## ESP32 Integration

### Hardware Setup
Connect your sensors to the ESP32:
- **Soil Moisture Sensor**: Analog pin A0
- **DHT22 (Temperature/Humidity)**: Digital pin D2
- **Power**: 3.3V or 5V depending on sensor requirements

### ESP32 Code Example
```cpp
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <DHT.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Sensor pins
#define SOIL_MOISTURE_PIN A0
#define DHT_PIN 2
#define DHT_TYPE DHT22

DHT dht(DHT_PIN, DHT_TYPE);
WebSocketsServer webSocket = WebSocketsServer(81);

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
  
  // Start WebSocket server
  webSocket.begin();
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
  
  // Read sensors every 3 seconds
  static unsigned long lastReading = 0;
  if (millis() - lastReading > 3000) {
    sendSensorData();
    lastReading = millis();
  }
}

void sendSensorData() {
  // Read sensors
  int soilMoistureRaw = analogRead(SOIL_MOISTURE_PIN);
  float soilMoisture = map(soilMoistureRaw, 0, 1023, 100, 0); // Invert and convert to percentage
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  // Create JSON
  StaticJsonDocument<200> doc;
  doc["soilMoisture"] = soilMoisture;
  doc["humidity"] = humidity;
  doc["temperature"] = temperature;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // Send to all connected clients
  webSocket.broadcastTXT(jsonString);
  
  Serial.println("Sent: " + jsonString);
}

void webSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.printf("[%u] Disconnected!\n", num);
      break;
    case WStype_CONNECTED:
      Serial.printf("[%u] Connected from %s\n", num, webSocket.remoteIP(num).toString().c_str());
      break;
    case WStype_TEXT:
      Serial.printf("[%u] Received: %s\n", num, payload);
      break;
  }
}
```

### Required Libraries
Install these libraries in Arduino IDE:
- `WebSockets` by Markus Sattler
- `DHT sensor library` by Adafruit
- `ArduinoJson` by Benoit Blanchon

### Connection Setup
1. **Find your ESP32's IP address** from the Serial Monitor
2. **Update the WebSocket URL** in `script.js`:
   ```javascript
   // Replace with your ESP32's IP address
   dashboard.connectToESP32('ws://192.168.1.100:81');
   ```
3. **Uncomment the connection line** in `script.js` (line 409)

## Configuration

### Sensor Thresholds
Customize the optimal ranges in `script.js`:
```javascript
getSoilMoistureStatus(moisture) {
    if (moisture < 30) return 'Dry - Water Needed';
    if (moisture < 50) return 'Slightly Dry';
    if (moisture < 80) return 'Optimal';
    return 'Very Moist';
}
```

### Styling
- Colors can be modified in `styles.css` using CSS custom properties
- Mobile breakpoints can be adjusted in the responsive media queries
- Animation speeds and effects can be customized

## Chatbot Features

The AI assistant can help with:
- **Soil Moisture Analysis**: "How is my soil moisture?"
- **Watering Advice**: "Should I water my plants?"
- **Health Status**: "What's the plant health status?"
- **Care Tips**: General plant care recommendations
- **Environmental Analysis**: Temperature and humidity guidance

## File Structure
```
├── index.html          # Main dashboard page
├── styles.css          # Styling and responsive design
├── script.js           # JavaScript functionality and ESP32 integration
└── README.md           # This file
```

## Browser Compatibility
- Chrome/Edge 60+
- Firefox 55+
- Safari 12+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Features in Demo Mode
When not connected to ESP32, the dashboard runs in demo mode with:
- Simulated sensor data with realistic variations
- Fully functional chatbot
- All UI interactions working
- Connection status indicators

## Troubleshooting

### Common Issues
1. **WebSocket connection fails**
   - Check ESP32 IP address
   - Ensure both devices are on same network
   - Verify firewall settings

2. **Sensor readings are incorrect**
   - Check wiring connections
   - Calibrate soil moisture sensor in dry/wet conditions
   - Verify DHT22 is properly connected

3. **Mobile display issues**
   - Clear browser cache
   - Check viewport meta tag
   - Test in different mobile browsers

### Debug Mode
Enable debug logging by opening browser console (F12) to see:
- WebSocket connection status
- Sensor data updates
- JavaScript errors

## Future Enhancements
- Historical data charts
- Alert notifications
- Multiple plant monitoring
- Weather integration
- Plant species-specific care profiles

## License
This project is open source and available under the MIT License.