const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;
const OLLAMA_URL = 'http://localhost:11434';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Serve the main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Store latest sensor data
let latestSensorData = {
    soilMoisture: 65,
    humidity: 72,
    temperature: 24,
    lastUpdated: new Date(),
    deviceId: 'simulation'
};

// ESP32 sensor data endpoint
app.post('/api/sensor-data', (req, res) => {
    try {
        const { soilMoisture, humidity, temperature, timestamp, deviceId } = req.body;
        
        // Update latest sensor data - handle 0 values properly
        latestSensorData = {
            soilMoisture: soilMoisture !== undefined ? parseFloat(soilMoisture) : latestSensorData.soilMoisture,
            humidity: humidity !== undefined ? parseFloat(humidity) : latestSensorData.humidity,
            temperature: temperature !== undefined ? parseFloat(temperature) : latestSensorData.temperature,
            lastUpdated: new Date(),
            deviceId: deviceId || 'ESP32'
        };
        
        console.log('📡 Received sensor data:', latestSensorData);
        res.json({ 
            status: 'success', 
            message: 'Sensor data received',
            data: latestSensorData 
        });
        
    } catch (error) {
        console.error('Error processing sensor data:', error);
        res.status(400).json({ 
            status: 'error', 
            message: 'Invalid sensor data' 
        });
    }
});

// Get latest sensor data
app.get('/api/sensor-data', (req, res) => {
    res.json(latestSensorData);
});

// AI Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sensorData, language = 'en' } = req.body;
        
        // Use latest sensor data if not provided
        const currentSensorData = sensorData || latestSensorData;
        
        // Create context-aware prompt based on language
        const systemPrompts = {
            en: `You are a helpful plant care assistant with access to real-time sensor data. 
Current readings:
- Soil Moisture: ${currentSensorData?.soilMoisture || 'N/A'}%
- Humidity: ${currentSensorData?.humidity || 'N/A'}%
- Temperature: ${currentSensorData?.temperature || 'N/A'}°C

Provide helpful, concise plant care advice based on these readings. Keep responses under 100 words and be encouraging. If sensor data shows concerning values, prioritize addressing those issues.`,
            
            ar: `أنت مساعد ذكي للعناية بالنباتات لديك الوصول إلى بيانات المستشعرات في الوقت الفعلي.
القراءات الحالية:
- رطوبة التربة: ${currentSensorData?.soilMoisture || 'غير متوفر'}%
- الرطوبة: ${currentSensorData?.humidity || 'غير متوفر'}%
- درجة الحرارة: ${currentSensorData?.temperature || 'غير متوفر'}°م

قدم نصائح مفيدة ومختصرة للعناية بالنباتات بناءً على هذه القراءات. اجعل الردود أقل من 100 كلمة وكن مشجعاً. إذا أظهرت بيانات المستشعرات قيماً مثيرة للقلق، أعط الأولوية لمعالجة هذه المشاكل.`
        };

        const systemPrompt = systemPrompts[language] || systemPrompts.en;
        const responseLanguage = language === 'ar' ? 'Arabic' : 'English';

        const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
            model: 'mistral',
            prompt: `${systemPrompt}\n\nUser Question: ${message}\n\nPlease respond in ${responseLanguage}:\n\nAssistant:`,
            stream: false,
            options: {
                temperature: 0.7,
                top_p: 0.9,
                max_tokens: 150
            }
        });

        const aiResponse = response.data.response.trim();
        res.json({ response: aiResponse });

    } catch (error) {
        console.error('Error calling Ollama:', error.message);
        
        // Fallback response if Ollama is not available
        const fallbackResponse = generateFallbackResponse(req.body.message, req.body.sensorData || latestSensorData, req.body.language);
        res.json({ response: fallbackResponse });
    }
});

// Fallback response function (your original logic)
function generateFallbackResponse(message, sensorData, language = 'en') {
    const msg = message.toLowerCase();
    const data = sensorData || {};
    
    // Arabic responses
    if (language === 'ar') {
        if (msg.includes('soil') || msg.includes('moisture') || msg.includes('رطوبة') || msg.includes('تربة')) {
            const moisture = Math.round(data.soilMoisture || 65);
            if (moisture < 30) {
                return `رطوبة التربة منخفضة عند ${moisture}%. أنصح بسقي النباتات قريباً. معظم النباتات تفضل رطوبة التربة بين 50-70%.`;
            } else if (moisture > 80) {
                return `رطوبة التربة عالية عند ${moisture}%. تأكد من وجود تصريف جيد لمنع تعفن الجذور.`;
            } else {
                return `رطوبة التربة ممتازة عند ${moisture}%! هذا مثالي لمعظم النباتات.`;
            }
        }
        
        if (msg.includes('water') || msg.includes('ري') || msg.includes('سقي')) {
            const moisture = Math.round(data.soilMoisture || 65);
            if (moisture < 40) {
                return `نعم، نباتاتك تحتاج إلى الماء. رطوبة التربة الحالية ${moisture}%. اسقِ ببطء حتى ترى تصريف طفيف.`;
            } else {
                return `رطوبة التربة جيدة عند ${moisture}%. لا تحتاج للسقي الآن.`;
            }
        }
        
        return "أنا هنا لمساعدتك في العناية بالنباتات! اسألني عن رطوبة التربة أو السقي أو درجة الحرارة أو الرطوبة.";
    }
    
    // English responses (original logic)
    if (msg.includes('soil') || msg.includes('moisture')) {
        const moisture = Math.round(data.soilMoisture || 65);
        if (moisture < 30) {
            return `Your soil moisture is quite low at ${moisture}%. I recommend watering your plants soon. Most plants prefer soil moisture between 50-70%.`;
        } else if (moisture > 80) {
            return `Your soil moisture is quite high at ${moisture}%. Make sure there's good drainage to prevent root rot.`;
        } else {
            return `Your soil moisture is excellent at ${moisture}%! This is optimal for most plants.`;
        }
    }
    
    if (msg.includes('water')) {
        const moisture = Math.round(data.soilMoisture || 65);
        if (moisture < 40) {
            return `Yes, your plants could use some water. Current soil moisture is ${moisture}%. Water slowly until you see slight runoff.`;
        } else {
            return `Your soil moisture looks good at ${moisture}%. You don't need to water right now.`;
        }
    }
    
    return "I'm here to help with your plant care! Ask me about soil moisture, watering, temperature, or humidity.";
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'running',
        ollama: 'checking...',
        timestamp: new Date().toISOString()
    });
});

// Check Ollama connection
app.get('/api/ollama-status', async (req, res) => {
    try {
        const response = await axios.get(`${OLLAMA_URL}/api/tags`);
        res.json({ 
            status: 'connected',
            models: response.data.models || []
        });
    } catch (error) {
        res.json({ 
            status: 'disconnected',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🌱 Reboot The Earth Server running on http://localhost:${PORT}`);
    console.log(`🤖 Ollama should be running on ${OLLAMA_URL}`);
    console.log(`📊 Dashboard available at http://localhost:${PORT}`);
    
    // Check Ollama connection on startup
    axios.get(`${OLLAMA_URL}/api/tags`)
        .then(() => console.log('✅ Ollama connection successful'))
        .catch(() => console.log('❌ Ollama not accessible - using fallback responses'));
});