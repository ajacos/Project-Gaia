/*
  ESP32 Soil Moisture Sensor with WiFi Data Transmission
  Based on: http://www.electronicwings.com
  Modified for: Reboot The Earth Dashboard
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <DHT_U.h>

// WiFi credentials - CHANGE THESE TO YOUR WIFI
const char* ssid = "aaron";
const char* password = "12348765";

// Server endpoint - CHANGE THIS TO YOUR COMPUTER'S IP
const char* serverURL = "http://192.168.137.1:3000/api/sensor-data";

// LCD configuration (address 0x27, 16 columns, 2 rows)
LiquidCrystal_I2C lcd(0x27, 16, 2);

#define DHTPIN 4       // Digital pin connected to the DHT sensor
#define DHTTYPE DHT11  // DHT 11

DHT dht(DHTPIN, DHTTYPE);

int _moisture, sensor_analog;
const int sensor_pin = A0; /* Soil moisture sensor O/P pin */

// Timing variables
unsigned long lastSensorRead = 0;
unsigned long lastDataSend = 0;
const unsigned long sensorInterval = 1000;  // Read sensors every 1 second (faster)
const unsigned long sendInterval = 3000;    // Send data every 3 seconds (much faster)

// Display variables
int displayPage = 0;  // 0: Main data, 1: Network status
unsigned long lastDisplayUpdate = 0;
const unsigned long page1Duration = 10000;  // Page 1 (sensors) shows for 10 seconds
const unsigned long page2Duration = 2000;   // Page 2 (network) shows for 2 seconds

void setup(void) {
  Serial.begin(115200);
  dht.begin();

  // Initialize LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  
  // Show startup message
  lcd.setCursor(0, 0);
  lcd.print("Plant Monitor");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  delay(2000);

  // Connect to WiFi
  connectToWiFi();

  Serial.println("Setup complete!");
  delay(500); // Reduced from 2000ms to 500ms
}

void connectToWiFi() {
  WiFi.begin(ssid, password);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Please wait...");

  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Connected! IP: ");
  Serial.println(WiFi.localIP());

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected!");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(2000);
}

void loop(void) {
  unsigned long currentTime = millis();

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }

  // Read sensors every 1 second
  if (currentTime - lastSensorRead >= sensorInterval) {
    readSensorsAndDisplay();
    lastSensorRead = currentTime;
  }

  // Send data to server every 3 seconds
  if (currentTime - lastDataSend >= sendInterval) {
    sendDataToServer();
    lastDataSend = currentTime;
  }

  // Update display page with different durations
  unsigned long currentDisplayDuration = (displayPage == 0) ? page1Duration : page2Duration;
  if (currentTime - lastDisplayUpdate >= currentDisplayDuration) {
    displayPage = (displayPage + 1) % 2;  // Toggle between 0 and 1
    lastDisplayUpdate = currentTime;
  }
}

void readSensorsAndDisplay() {
  // Read soil moisture
  sensor_analog = analogRead(sensor_pin);
  
  // Improved calibration based on typical soil moisture sensor values
  // Dry air/soil = 4095 (maximum), Wet soil = 1000-1500 (minimum)
  int dryValue = 4095;   // Value when sensor is completely dry (what you're seeing now)
  int wetValue = 1000;   // Value when sensor is in very wet soil
  
  // Calculate moisture percentage (inverted because higher analog = drier)
  int moisturePercent = map(sensor_analog, dryValue, wetValue, 0, 100);
  sensor_analog = constrain(moisturePercent, 0, 100); // Keep within 0-100%
  
  // Read DHT sensor
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  // Check if DHT reads failed
  if (isnan(h) || isnan(t)) {
    Serial.println(F("Failed to read from DHT sensor!"));
    h = 0;
    t = 0;
  }

  // Print to Serial for debugging
  Serial.print("Raw analog: ");
  Serial.print(analogRead(sensor_pin));
  Serial.print(", Moisture: ");
  Serial.print(sensor_analog);
  Serial.print("%, Humidity: ");
  Serial.print(h);
  Serial.print("%, Temperature: ");
  Serial.print(t);
  Serial.println("°C");

  // Update OLED display
  updateDisplay(t, h, sensor_analog);
}

void updateDisplay(float temp, float humidity, int moisture) {
  lcd.clear();
  
  if (displayPage == 0) {
    // Page 1: Sensor readings
    lcd.setCursor(0, 0);
    lcd.printf("T:%.1f", temp);
    lcd.print((char)223);  // Degree symbol
    lcd.printf("C H:%.0f%%", humidity);
    
    lcd.setCursor(0, 1);
    lcd.printf("Soil: %d%%", moisture);
    
    // Show WiFi status
    lcd.setCursor(11, 1);
    if (WiFi.status() == WL_CONNECTED) {
      lcd.print("WiFi");
    } else {
      lcd.print("----");
    }
  } else {
    // Page 2: Network information
    lcd.setCursor(0, 0);
    if (WiFi.status() == WL_CONNECTED) {
      lcd.print("WiFi: Connected");
      lcd.setCursor(0, 1);
      lcd.printf("RSSI: %d dBm", WiFi.RSSI());
    } else {
      lcd.print("WiFi: Failed");
      lcd.setCursor(0, 1);
      lcd.print("Check Network");
    }
  }
}

void sendDataToServer() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");

    // Read current sensor values
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    if (isnan(h)) h = 0;
    if (isnan(t)) t = 0;

    // Create JSON payload
    StaticJsonDocument<200> jsonDoc;
    jsonDoc["soilMoisture"] = sensor_analog;
    jsonDoc["humidity"] = h;
    jsonDoc["temperature"] = t;
    jsonDoc["timestamp"] = millis();
    jsonDoc["deviceId"] = "ESP32_Plant_Monitor";

    String jsonString;
    serializeJson(jsonDoc, jsonString);

    Serial.println("Sending data: " + jsonString);

    // Send POST request
    int httpResponseCode = http.POST(jsonString);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Server response: " + response);

    } else {
      Serial.print("Error sending data. HTTP code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi not connected, cannot send data");
  }
}