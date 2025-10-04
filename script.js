// ESP32 Soil Monitor Dashboard JavaScript
class ESP32Dashboard {
    constructor() {
        this.websocket = null;
        this.reconnectInterval = null;
        this.isConnected = false;
        this.chatHistory = [];
        this.currentLanguage = localStorage.getItem('preferred-language') || 'en';
        this.translations = this.initializeTranslations();
        this.speechRecognition = null;
        this.speechSynthesis = window.speechSynthesis;
        this.isSpeakingEnabled = false;
        this.isListening = false;
        this.voiceTimeout = null;
        this.recognitionAttempts = 0;
        this.maxAttempts = 3;
        
        // Initialize TTS voices when available
        this.initializeTTSVoices();
        this.sensorData = {
            soilMoisture: 65,
            humidity: 72,
            temperature: 24,
            lastUpdated: new Date()
        };

        this.init();
    }

    // Initialize TTS voices
    initializeTTSVoices() {
        if (!this.speechSynthesis) return;
        
        // Load voices when they become available
        if (this.speechSynthesis.getVoices().length === 0) {
            this.speechSynthesis.addEventListener('voiceschanged', () => {
                console.log('🎤 TTS voices loaded:', this.speechSynthesis.getVoices().length);
            });
        } else {
            console.log('🎤 TTS voices available:', this.speechSynthesis.getVoices().length);
        }
    }

    // Initialize translations
    initializeTranslations() {
        return {
            en: {
                title: "Project Gaia",
                soilMoisture: "Soil Moisture",
                humidity: "Humidity", 
                temperature: "Temperature",
                plantCareAssistant: "Plant Care Assistant",
                askPlaceholder: "Ask me about your plants...",
                soilCheck: "Soil Check",
                watering: "Watering",
                health: "Health",
                optimal: "Optimal",
                good: "Good",
                perfect: "Perfect",
                poor: "Poor",
                dry: "Dry",
                wet: "Wet",
                hot: "Hot",
                cold: "Cold",
                welcomeMessage: "Hello! I'm your AI plant care assistant. Ask me anything about your plants or check your sensor data.",
                voiceInput: "Voice Input",
                enableTTS: "Enable Text-to-Speech",
                microphoneClick: "🎤 Click microphone to speak",
                listening: "🎤 Listening...",
                speaking: "🔊 Speaking...",
                processing: "⚡ Processing...",
                success: "✅ Speech received!",
                error: "❌ Error occurred"
            },
            ar: {
                title: "مشروع جايا",
                soilMoisture: "رطوبة التربة",
                humidity: "الرطوبة",
                temperature: "درجة الحرارة", 
                plantCareAssistant: "مساعد العناية بالنباتات",
                askPlaceholder: "اسألني عن نباتاتك...",
                soilCheck: "فحص التربة",
                watering: "الري",
                health: "الصحة",
                optimal: "مثالي",
                good: "جيد",
                perfect: "ممتاز",
                poor: "ضعيف",
                dry: "جاف",
                wet: "رطب", 
                hot: "حار",
                cold: "بارد",
                welcomeMessage: "مرحباً! أنا مساعدك الذكي للعناية بالنباتات. اسألني أي شيء عن نباتاتك أو تحقق من بيانات المستشعرات.",
                voiceInput: "الإدخال الصوتي",
                enableTTS: "تفعيل تحويل النص إلى كلام",
                microphoneClick: "🎤 اضغط على الميكروفون للتحدث",
                listening: "🎤 أستمع...",
                speaking: "🔊 أتحدث...",
                processing: "⚡ معالجة...",
                success: "✅ تم استلام الكلام!",
                error: "❌ حدث خطأ"
            }
        };
    }

    async init() {
        this.setupEventListeners();
        this.applyLanguage(); // Apply language settings first
        this.updateTranslations(); // Update all translations
        this.initializeChat();
        this.initializeVoice();
        this.startRealDataFetching(); // Use real data from server
        this.updateDisplay();
        this.startDataRefresh();
        this.setupLanguageSelector();
    }

    setupEventListeners() {
        const chatInput = document.getElementById('chatInput');
        const sendButton = document.getElementById('sendButton');
        const voiceButton = document.getElementById('voiceButton');
        const speakToggle = document.getElementById('speakToggle');
        const quickActions = document.querySelectorAll('.suggestion-chip');
        const langToggle = document.getElementById('langToggle');
        const langDropdown = document.getElementById('langDropdown');
        const langOptions = document.querySelectorAll('.lang-option');
        const clearChat = document.getElementById('clearChat');

        // Chat input events
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Button events
        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }
        if (voiceButton) {
            voiceButton.addEventListener('click', () => this.toggleVoiceRecognition());
        }
        if (speakToggle) {
            speakToggle.addEventListener('click', () => this.toggleSpeech());
        }
        
        // Clear chat button
        if (clearChat) {
            clearChat.addEventListener('click', () => this.clearChat());
        }

        // Language selector events
        if (langToggle && langDropdown) {
            langToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                langDropdown.classList.toggle('active');
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            if (langDropdown) {
                langDropdown.classList.remove('active');
            }
        });

        // Language option selection
        if (langOptions && langDropdown) {
            langOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    const lang = e.currentTarget.dataset.lang;
                    this.changeLanguage(lang);
                    langDropdown.classList.remove('active');
                });
            });
        }

        // Quick suggestion chips
        if (quickActions && chatInput) {
            quickActions.forEach(action => {
                action.addEventListener('click', (e) => {
                    const message = e.currentTarget.dataset.message;
                    if (message) {
                        chatInput.value = message;
                        this.sendMessage();
                    }
                });
            });
        }

        // Auto-resize chat input
        if (chatInput) {
            chatInput.addEventListener('input', (e) => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            });
        }
    }

    // Clear chat function
    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = `
            <div class="message bot-message">
                <div class="message-avatar">
                    <i class="fas fa-robot"></i>
                </div>
                <div class="message-content">
                    <p data-i18n="chatbot.welcome">👋 Hello! I'm your AI plant care assistant. I can analyze your sensor data and provide personalized recommendations for your plants. What would you like to know?</p>
                    <div class="message-time">Just now</div>
                </div>
            </div>
        `;
        this.chatHistory = [];
    }

    // Setup language selector - Enhanced
    setupLanguageSelector() {
        const langText = document.getElementById('langText');
        
        // Set initial language button text
        if (langText) {
            langText.textContent = this.currentLanguage === 'ar' ? 'English' : 'العربية';
        }
        
        // Apply initial language settings
        this.applyLanguage();
        this.updateTranslations();
    }

    // Change language - Enhanced
    changeLanguage(language) {
        console.log(`🌍 Changing language to: ${language}`);
        this.currentLanguage = language;
        localStorage.setItem('preferred-language', language);
        
        // Update language button text
        const langText = document.getElementById('langText');
        if (langText) {
            langText.textContent = language === 'ar' ? 'English' : 'العربية';
        }
        
        // Apply language changes
        this.applyLanguage();
        
        // Update all translated elements
        this.updateTranslations();
        
        // Update voice status in new language
        this.setVoiceStatus('ready');
        
        // Clear and reinitialize chat with new language
        this.initializeChat();
    }

    // Apply language to all elements - Enhanced  
    applyLanguage() {
        // Set document direction and language
        document.documentElement.dir = this.currentLanguage === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = this.currentLanguage;
        
        // Update body class for language-specific styling
        document.body.className = this.currentLanguage === 'ar' ? 'rtl-mode' : 'ltr-mode';
    }

    // Update all translations
    updateTranslations() {
        const currentTranslations = this.translations[this.currentLanguage];
        
        // Update all elements with data-translate attribute
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (currentTranslations[key]) {
                element.textContent = currentTranslations[key];
            }
        });
        
        // Update placeholders
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            if (currentTranslations[key]) {
                element.placeholder = currentTranslations[key];
            }
        });
        
        // Update titles (tooltips)
        document.querySelectorAll('[data-translate-title]').forEach(element => {
            const key = element.getAttribute('data-translate-title');
            if (currentTranslations[key]) {
                element.title = currentTranslations[key];
            }
        });
    }

    // Update status text when language changes
    updateStatusLanguage() {
        // No status indicator in navbar anymore, so nothing to update
    }

    // Initialize voice recognition - Completely rewritten
    initializeVoice() {
        console.log('Initializing voice system...');
        
        // Reset voice state
        this.isListening = false;
        this.recognitionAttempts = 0;
        
        // Check browser support
        const hasSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        
        if (!hasSupport) {
            this.disableVoiceFeature('Browser does not support speech recognition');
            return;
        }
        
        try {
            // Create fresh speech recognition instance
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            // Simple, reliable settings
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.maxAlternatives = 1;
            this.speechRecognition.lang = 'en-US';
            
            // Set up event handlers
            this.setupVoiceEventHandlers();
            
            // Initialize UI
            this.updateVoiceUI('ready');
            console.log('Voice system initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize speech recognition:', error);
            this.disableVoiceFeature('Failed to initialize voice recognition');
        }
    }
    
    // Setup voice event handlers
    setupVoiceEventHandlers() {
        this.speechRecognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.isListening = true;
            this.updateVoiceUI('listening');
            
            // Set safety timeout
            this.voiceTimeout = setTimeout(() => {
                console.log('⏰ Voice timeout reached');
                if (this.isListening) {
                    this.speechRecognition.stop();
                    this.updateVoiceUI('error', 'Voice recognition timed out. Please try again.');
                    this.resetVoiceState();
                }
            }, 8000); // 8 second timeout
        };
        
        this.speechRecognition.onresult = (event) => {
            console.log('🎯 Speech recognition result received');
            
            if (event.results && event.results.length > 0) {
                const transcript = event.results[0][0].transcript.trim();
                const confidence = event.results[0][0].confidence;
                
                console.log(`📝 Transcript: "${transcript}" (confidence: ${confidence})`);
                
                if (transcript && transcript.length > 0) {
                    // Clear the input and set the transcript
                    const chatInput = document.getElementById('chatInput');
                    chatInput.value = transcript;
                    
                    // Show success and reset state
                    this.updateVoiceUI('success', 'Voice message received!');
                    this.resetVoiceState();
                    
                    // Send the message after a brief delay
                    setTimeout(() => {
                        this.updateVoiceUI('ready');
                        this.sendMessage();
                    }, 1000);
                } else {
                    console.log('❌ Empty transcript received');
                    this.updateVoiceUI('error', 'No speech detected. Please try again.');
                    this.resetVoiceState();
                }
            }
        };
        
        this.speechRecognition.onerror = (event) => {
            console.error('🚨 Speech recognition error:', event.error);
            
            // Clear timeout
            if (this.voiceTimeout) {
                clearTimeout(this.voiceTimeout);
                this.voiceTimeout = null;
            }
            
            // Increment error count to prevent infinite loops
            this.voiceErrorCount = (this.voiceErrorCount || 0) + 1;
            
            // Handle network errors with retry logic
            if (event.error === 'network') {
                console.log('🌐 Network error detected...');
                
                // Only try fallback a few times, then disable
                if (this.voiceErrorCount <= 2) {
                    console.log(`🔄 Network error attempt ${this.voiceErrorCount}/2`);
                    this.handleNetworkError();
                } else {
                    console.log('❌ Too many network errors, disabling voice feature');
                    this.updateVoiceUI('error', 'Voice recognition unavailable due to network issues. Please refresh the page to try again.');
                    this.disableVoiceFeature('Network connectivity issues');
                }
            } else {
                this.handleSpeechError(event.error);
            }
        };
        
        this.speechRecognition.onend = () => {
            console.log('🔚 Speech recognition ended');
            
            // Clean up if still listening
            if (this.isListening) {
                console.log('🧹 Cleaning up voice state');
                this.resetVoiceState();
            }
        };
    }
    
    // Reset voice state
    resetVoiceState() {
        this.isListening = false;
        
        // Clear timeout if exists
        if (this.voiceTimeout) {
            clearTimeout(this.voiceTimeout);
            this.voiceTimeout = null;
        }
        
        const voiceButton = document.getElementById('voiceButton');
        if (voiceButton) {
            voiceButton.classList.remove('listening');
        }
        
        this.updateVoiceUI('ready');
    }
    
    // Update voice UI
    updateVoiceUI(state, message = '') {
        const statusElement = document.getElementById('voiceStatus');
        const voiceButton = document.getElementById('voiceButton');
        
        if (!statusElement) return;
        
        switch(state) {
            case 'ready':
                statusElement.textContent = '🎤 Click microphone to speak';
                statusElement.className = 'voice-status';
                if (voiceButton) voiceButton.disabled = false;
                break;
                
            case 'listening':
                statusElement.textContent = '🔴 Listening... Speak now!';
                statusElement.className = 'voice-status listening';
                break;
                
            case 'processing':
                statusElement.textContent = '⚡ Processing...';
                statusElement.className = 'voice-status processing';
                break;
                
            case 'success':
                statusElement.textContent = `✅ ${message}`;
                statusElement.className = 'voice-status success';
                break;
                
            case 'error':
                statusElement.textContent = `❌ ${message}`;
                statusElement.className = 'voice-status error';
                setTimeout(() => this.updateVoiceUI('ready'), 4000);
                break;
                
            case 'disabled':
                statusElement.textContent = `⚠️ ${message}`;
                statusElement.className = 'voice-status disabled';
                if (voiceButton) voiceButton.disabled = true;
                break;
        }
    }
    
    // Disable voice feature
    disableVoiceFeature(reason) {
        console.log(`❌ Disabling voice feature: ${reason}`);
        this.updateVoiceUI('disabled', reason);
        
        const voiceButton = document.getElementById('voiceButton');
        if (voiceButton) {
            voiceButton.disabled = true;
            voiceButton.style.opacity = '0.5';
        }
    }
    
    // Main toggle function (called by button click)
    toggleVoiceRecognition() {
        console.log('🎤 Voice button clicked');
        
        if (!this.speechRecognition) {
            this.updateVoiceUI('error', 'Speech recognition not available');
            return;
        }
        
        if (this.isListening) {
            console.log('🛑 Currently listening, stopping...');
            this.speechRecognition.stop();
            this.resetVoiceState();
        } else {
            console.log('🚀 Starting new voice session...');
            
            // Reset error count for new attempt
            this.voiceErrorCount = 0;
            
            try {
                // Check for network connectivity first
                if (!navigator.onLine) {
                    this.updateVoiceUI('error', 'No internet connection. Voice recognition requires internet access.');
                    return;
                }
                
                // Set language for speech recognition (be more conservative)
                const isBrave = navigator.brave && navigator.brave.isBrave;
                if (!isBrave) {
                    this.speechRecognition.lang = this.currentLanguage === 'ar' ? 'ar-SA' : 'en-US';
                }
                
                // Start recognition
                this.speechRecognition.start();
                this.isListening = true;
                
                // Update UI
                this.updateVoiceUI('listening');
                const voiceButton = document.getElementById('voiceButton');
                if (voiceButton) voiceButton.classList.add('listening');
                
                // Set timeout to prevent hanging (shorter for network issues)
                const timeoutDuration = isBrave ? 8000 : 6000; // Reduced timeout
                this.voiceTimeout = setTimeout(() => {
                    if (this.isListening) {
                        console.log('⏰ Voice timeout - stopping recognition');
                        this.speechRecognition.stop();
                        this.updateVoiceUI('error', 'Voice recognition timed out. Try again or check your internet connection.');
                        this.resetVoiceState();
                    }
                }, timeoutDuration);
                
            } catch (error) {
                console.error('Failed to start speech recognition:', error);
                
                // More specific error handling
                if (error.name === 'InvalidStateError') {
                    this.updateVoiceUI('error', 'Voice recognition is busy. Please wait a moment and try again.');
                } else if (error.name === 'NotAllowedError') {
                    this.updateVoiceUI('error', 'Microphone access denied. Please allow microphone permissions.');
                } else {
                    this.updateVoiceUI('error', 'Could not start voice recognition. Check your internet connection and microphone.');
                }
                this.resetVoiceState();
            }
        }
    }

    // Handle network errors specifically
    handleNetworkError() {
        console.log('🔧 Handling network error with fallback...');
        
        // Reset state
        this.resetVoiceState();
        
        // Show user-friendly message
        this.updateVoiceUI('error', 'Network issue detected. Voice recognition may not work reliably in this browser.');
        
        // Don't retry immediately - wait for user to try again
        console.log('⏸️ Voice system paused due to network issues. User can try again manually.');
    }
    
    // Initialize voice with fallback options
    initializeVoiceWithFallback() {
        console.log('🔄 Initializing voice system with fallback...');
        
        // Check if we're in Brave browser (common source of network errors)
        const isBrave = navigator.brave && navigator.brave.isBrave;
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        
        if (isBrave) {
            console.log('🦁 Brave browser detected - using optimized settings');
        }
        
        try {
            // Recreate speech recognition with different settings
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.speechRecognition = new SpeechRecognition();
            
            // More conservative settings for problematic browsers
            this.speechRecognition.continuous = false;
            this.speechRecognition.interimResults = false;
            this.speechRecognition.maxAlternatives = 1;
            
            // Try without specifying language first (let browser decide)
            if (isBrave) {
                // Brave sometimes works better without explicit language
                console.log('🦁 Using browser default language for Brave');
            } else {
                this.speechRecognition.lang = this.currentLanguage === 'ar' ? 'ar-SA' : 'en-US';
            }
            
            // Setup handlers again
            this.setupVoiceEventHandlers();
            
            // Show that voice is available but may be limited
            this.updateVoiceUI('ready');
            console.log('✅ Voice system reinitialized with fallback settings');
            
        } catch (error) {
            console.error('❌ Fallback initialization failed:', error);
            this.disableVoiceFeature('Voice recognition unavailable in this browser');
        }
    }

    // Handle speech recognition errors
    handleSpeechError(error) {
        let errorMessage = '';
        
        switch(error) {
            case 'network':
                errorMessage = 'Network error: Voice recognition requires a stable internet connection. If using Brave browser, try Chrome or Firefox for better voice support.';
                break;
            case 'not-allowed':
            case 'permission-denied':
                errorMessage = 'Microphone access denied. Please click the microphone icon in your address bar and allow access.';
                break;
            case 'no-speech':
                errorMessage = 'No speech detected. Please speak clearly into your microphone and try again.';
                break;
            case 'audio-capture':
                errorMessage = 'Microphone not found. Please check that your microphone is connected and working.';
                break;
            case 'service-not-allowed':
                errorMessage = 'Speech service blocked. This may be due to browser privacy settings.';
                break;
            case 'language-not-supported':
                errorMessage = 'Language not supported. Switching to English.';
                // Try switching to English
                this.speechRecognition.lang = 'en-US';
                break;
            default:
                errorMessage = `Voice recognition error (${error}). Please check your internet connection and microphone, then try again.`;
        }
        
        // Show error message to user
        this.updateVoiceUI('error', errorMessage);
        this.resetVoiceState();
        
        // Log detailed error for debugging
        console.warn(`🚨 Speech Recognition Error: ${error} - ${errorMessage}`);
    }

    // Show voice error message
    showVoiceError(message) {
        this.updateVoiceUI('error', message);
        console.warn('Voice Error:', message);
    }

    // Stop listening (reset voice state)
    stopListening() {
        this.resetVoiceState();
    }

    // Toggle text-to-speech
    toggleSpeech() {
        this.isSpeakingEnabled = !this.isSpeakingEnabled;
        const speakToggle = document.getElementById('speakToggle');
        
        if (this.isSpeakingEnabled) {
            speakToggle.classList.add('active');
        } else {
            speakToggle.classList.remove('active');
            // Stop any current speech
            this.speechSynthesis.cancel();
        }
    }

    // Speak text - Enhanced TTS system
    speakText(text) {
        if (!this.isSpeakingEnabled || !this.speechSynthesis) return;
        
        // Cancel any ongoing speech
        this.speechSynthesis.cancel();
        
        // Clean text for better speech
        const cleanText = text.replace(/[*_~`]/g, '').replace(/\n+/g, ' ');
        
        if (!cleanText.trim()) return;
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        // Set language based on current language
        if (this.currentLanguage === 'ar') {
            utterance.lang = 'ar-SA';
            utterance.rate = 0.8; // Slower for Arabic
        } else {
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
        }
        
        utterance.pitch = 1;
        utterance.volume = 0.8;
        
        // Try to find and use a better voice
        this.setupVoiceForUtterance(utterance);
        
        utterance.onstart = () => {
            console.log('🔊 TTS started');
            this.setVoiceStatus('speaking');
            const speakToggle = document.getElementById('speakToggle');
            if (speakToggle) speakToggle.classList.add('speaking');
        };
        
        utterance.onend = () => {
            console.log('🔇 TTS ended');
            this.setVoiceStatus('ready');
            const speakToggle = document.getElementById('speakToggle');
            if (speakToggle) speakToggle.classList.remove('speaking');
        };
        
        utterance.onerror = (event) => {
            console.error('🚨 TTS error:', event.error);
            this.setVoiceStatus('TTS error: ' + event.error);
            const speakToggle = document.getElementById('speakToggle');
            if (speakToggle) speakToggle.classList.remove('speaking');
        };
        
        try {
            this.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Failed to speak:', error);
            this.setVoiceStatus('Speech failed: ' + error.message);
        }
    }
    
    // Setup voice for utterance
    setupVoiceForUtterance(utterance) {
        try {
            const voices = this.speechSynthesis.getVoices();
            
            if (voices.length === 0) {
                // Voices not loaded yet, try again after a delay
                setTimeout(() => {
                    const voicesRetry = this.speechSynthesis.getVoices();
                    this.selectBestVoice(utterance, voicesRetry);
                }, 100);
            } else {
                this.selectBestVoice(utterance, voices);
            }
        } catch (error) {
            console.warn('Voice selection failed:', error);
        }
    }
    
    // Select best voice for current language
    selectBestVoice(utterance, voices) {
        if (!voices || voices.length === 0) return;
        
        const targetLang = this.currentLanguage === 'ar' ? 'ar' : 'en';
        
        // Look for voices that match the target language
        const matchingVoices = voices.filter(voice => 
            voice.lang.toLowerCase().startsWith(targetLang)
        );
        
        if (matchingVoices.length > 0) {
            // Prefer local voices over remote ones
            const localVoices = matchingVoices.filter(voice => voice.localService);
            const preferredVoice = localVoices.length > 0 ? localVoices[0] : matchingVoices[0];
            
            utterance.voice = preferredVoice;
            console.log(`🎤 Selected voice: ${preferredVoice.name} (${preferredVoice.lang})`);
        } else {
            console.log('🎤 Using default system voice');
        }
    }

    // Set voice status message - Enhanced with translations
    setVoiceStatus(statusKey) {
        const statusElement = document.getElementById('voiceStatus');
        if (!statusElement) return;
        
        const currentTranslations = this.translations[this.currentLanguage];
        
        // Handle different status types
        switch(statusKey) {
            case 'ready':
                statusElement.textContent = currentTranslations.microphoneClick;
                statusElement.className = 'voice-status';
                break;
                
            case 'speaking':
                statusElement.textContent = currentTranslations.speaking;
                statusElement.className = 'voice-status speaking';
                break;
                
            case 'listening':
                statusElement.textContent = currentTranslations.listening;
                statusElement.className = 'voice-status listening';
                break;
                
            case 'processing':
                statusElement.textContent = currentTranslations.processing;
                statusElement.className = 'voice-status processing';
                break;
                
            case 'success':
                statusElement.textContent = currentTranslations.success;
                statusElement.className = 'voice-status success';
                break;
                
            case 'brave_detected':
                statusElement.textContent = '🛡️ Brave detected - voice may need multiple attempts';
                statusElement.className = 'voice-status';
                break;
                
            default:
                if (statusKey && statusKey.includes('error')) {
                    statusElement.textContent = currentTranslations.error + ': ' + statusKey;
                    statusElement.className = 'voice-status error';
                } else if (statusKey) {
                    statusElement.textContent = statusKey;
                    statusElement.className = 'voice-status';
                } else {
                    statusElement.textContent = currentTranslations.microphoneClick;
                    statusElement.className = 'voice-status';
                }
                break;
        }
    }

    initializeChat() {
        // Clear existing messages except the first welcome message
        const chatMessages = document.getElementById('chatMessages');
        const existingMessages = chatMessages.querySelectorAll('.message');
        existingMessages.forEach((msg, index) => {
            if (index > 0) msg.remove(); // Keep first message, remove others
        });

        // Update the welcome message with current language
        const welcomeMessage = chatMessages.querySelector('.message p');
        if (welcomeMessage) {
            const currentTranslations = this.translations[this.currentLanguage];
            welcomeMessage.textContent = currentTranslations.welcomeMessage;
        }

        // Add a context-aware follow-up message
        setTimeout(() => {
            const followUpMessage = this.currentLanguage === 'ar' 
                ? "قراءاتك الحالية تبدو جيدة! رطوبة التربة في المستوى المثالي. هل تريد نصائح عناية محددة؟"
                : "Your current readings look good! Soil moisture is at optimal levels. Would you like specific care recommendations?";
            this.addBotMessage(followUpMessage);
        }, 1500);
    }

    // WebSocket connection for real ESP32 (replace simulation when ready)
    connectToESP32(url = 'ws://192.168.1.100:81') {
        try {
            this.websocket = new WebSocket(url);
            
            this.websocket.onopen = () => {
                console.log('Connected to ESP32');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                this.clearReconnectInterval();
            };

            this.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.updateSensorData(data);
                } catch (error) {
                    console.error('Error parsing WebSocket data:', error);
                }
            };

            this.websocket.onclose = () => {
                console.log('Disconnected from ESP32');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };

        } catch (error) {
            console.error('Failed to connect to ESP32:', error);
            this.updateConnectionStatus(false);
        }
    }

    attemptReconnect() {
        if (this.reconnectInterval) return;
        
        this.reconnectInterval = setInterval(() => {
            console.log('Attempting to reconnect to ESP32...');
            this.connectToESP32();
        }, 5000);
    }

    clearReconnectInterval() {
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }

    // Fetch real sensor data from server
    async startRealDataFetching() {
        // Initial fetch
        await this.fetchSensorData();
        
        // Fetch every 2 seconds (faster to match ESP32)
        setInterval(async () => {
            await this.fetchSensorData();
        }, 2000);
    }

    async fetchSensorData() {
        try {
            const response = await fetch('http://192.168.137.1:3000/api/sensor-data');
            if (response.ok) {
                const data = await response.json();
                this.updateSensorData(data);
                console.log('✅ Fetched real sensor data:', data);
            } else {
                this.isConnected = false;
                this.updateDisplay();
            }
        } catch (error) {
            console.error('Error fetching sensor data:', error);
            this.isConnected = false;
            this.updateDisplay();
        }
    }

    updateConnectionStatus(connected, deviceId = 'ESP32') {
        // Update internal connection state
        this.isConnected = connected !== undefined ? connected : this.isConnected;
        
        // No UI update needed since we removed the connection status from navbar
        // The connection state is now only visible through sensor data display
    }

    // Simulate data for demo (fallback when server/ESP32 not available)
    simulateData() {
        setInterval(() => {
            const variation = () => (Math.random() - 0.5) * 4;
            
            this.sensorData.soilMoisture = Math.max(0, Math.min(100, this.sensorData.soilMoisture + variation()));
            this.sensorData.humidity = Math.max(0, Math.min(100, this.sensorData.humidity + variation()));
            this.sensorData.temperature = Math.max(10, Math.min(40, this.sensorData.temperature + variation() * 0.5));
            this.sensorData.lastUpdated = new Date();
            
            this.updateDisplay();
        }, 3000);
    }

    updateSensorData(data) {
        this.sensorData = {
            ...this.sensorData,
            ...data,
            lastUpdated: new Date()
        };
        // Mark as connected when we receive valid data
        this.isConnected = true;
        this.updateDisplay();
    }

    updateDisplay() {
        // Check if ESP32 is connected and we have valid data
        if (!this.isConnected || !this.sensorData || this.sensorData.soilMoisture === undefined) {
            this.showOfflineData();
            return;
        }

        // Update soil moisture
        const soilMoisture = Math.round(this.sensorData.soilMoisture);
        const soilMoistureEl = document.getElementById('soilMoisture');
        const heroSoilMoistureEl = document.getElementById('heroSoilMoisture');
        const soilProgressEl = document.getElementById('soilProgress');
        const soilStatusEl = document.getElementById('soilStatus');
        
        if (soilMoistureEl) soilMoistureEl.textContent = soilMoisture;
        if (heroSoilMoistureEl) heroSoilMoistureEl.textContent = `${soilMoisture}%`;
        if (soilProgressEl) soilProgressEl.style.width = `${soilMoisture}%`;
        if (soilStatusEl) soilStatusEl.textContent = this.getSoilMoistureStatus(soilMoisture);

        // Update humidity  
        const humidity = Math.round(this.sensorData.humidity);
        const humidityEl = document.getElementById('humidity');
        const heroHumidityEl = document.getElementById('heroHumidity');
        const humidityProgressEl = document.getElementById('humidityProgress');
        const humidityStatusEl = document.getElementById('humidityStatus');
        
        if (humidityEl) humidityEl.textContent = humidity;
        if (heroHumidityEl) heroHumidityEl.textContent = `${humidity}%`;
        if (humidityProgressEl) humidityProgressEl.style.width = `${humidity}%`;
        if (humidityStatusEl) humidityStatusEl.textContent = this.getHumidityStatus(humidity);

        // Update temperature
        const temperature = Math.round(this.sensorData.temperature * 10) / 10;
        const temperatureEl = document.getElementById('temperature');
        const heroTemperatureEl = document.getElementById('heroTemperature');
        const tempProgressEl = document.getElementById('tempProgress');
        const tempStatusEl = document.getElementById('tempStatus');
        
        if (temperatureEl) temperatureEl.textContent = temperature;
        if (heroTemperatureEl) heroTemperatureEl.textContent = `${temperature}°C`;
        const tempPercentage = Math.max(0, Math.min(100, ((temperature - 10) / 30) * 100));
        if (tempProgressEl) tempProgressEl.style.width = `${tempPercentage}%`;
        if (tempStatusEl) tempStatusEl.textContent = this.getTemperatureStatus(temperature);

        // Update summary
        const lastUpdatedEl = document.getElementById('lastUpdated');
        const avgMoistureEl = document.getElementById('avgMoisture');
        
        if (lastUpdatedEl) lastUpdatedEl.textContent = this.formatTime(this.sensorData.lastUpdated);
        if (avgMoistureEl) avgMoistureEl.textContent = `${soilMoisture}%`;

        // Update connection status
        this.updateConnectionStatus();
    }

    showOfflineData() {
        // Show "--" for all sensor values when offline
        const soilMoistureEl = document.getElementById('soilMoisture');
        const heroSoilMoistureEl = document.getElementById('heroSoilMoisture');
        const soilProgressEl = document.getElementById('soilProgress');
        const soilStatusEl = document.getElementById('soilStatus');
        
        if (soilMoistureEl) soilMoistureEl.textContent = '--';
        if (heroSoilMoistureEl) heroSoilMoistureEl.textContent = '--%';
        if (soilProgressEl) soilProgressEl.style.width = '0%';
        if (soilStatusEl) soilStatusEl.textContent = 'No Data';

        const humidityEl = document.getElementById('humidity');
        const heroHumidityEl = document.getElementById('heroHumidity');
        const humidityProgressEl = document.getElementById('humidityProgress');
        const humidityStatusEl = document.getElementById('humidityStatus');
        
        if (humidityEl) humidityEl.textContent = '--';
        if (heroHumidityEl) heroHumidityEl.textContent = '--%';
        if (humidityProgressEl) humidityProgressEl.style.width = '0%';
        if (humidityStatusEl) humidityStatusEl.textContent = 'No Data';

        const temperatureEl = document.getElementById('temperature');
        const heroTemperatureEl = document.getElementById('heroTemperature');
        const tempProgressEl = document.getElementById('tempProgress');
        const tempStatusEl = document.getElementById('tempStatus');
        
        if (temperatureEl) temperatureEl.textContent = '--';
        if (heroTemperatureEl) heroTemperatureEl.textContent = '--°C';
        if (tempProgressEl) tempProgressEl.style.width = '0%';
        if (tempStatusEl) tempStatusEl.textContent = 'No Data';

        // Update summary
        const lastUpdatedEl = document.getElementById('lastUpdated');
        const avgMoistureEl = document.getElementById('avgMoisture');
        
        if (lastUpdatedEl) lastUpdatedEl.textContent = 'No Connection';
        if (avgMoistureEl) avgMoistureEl.textContent = '--%';

        // Update connection status
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        // No UI update needed since we removed the connection status from navbar
        // The connection state is now only visible through sensor data display
    }

    getSoilMoistureStatus(moisture) {
        const currentTranslations = this.translations[this.currentLanguage];
        
        if (moisture < 30) return currentTranslations.dry || 'Dry';
        if (moisture < 50) return currentTranslations.poor || 'Poor';
        if (moisture < 80) return currentTranslations.optimal || 'Optimal';
        return currentTranslations.wet || 'Wet';
    }

    getHumidityStatus(humidity) {
        const currentTranslations = this.translations[this.currentLanguage];
        
        if (humidity < 40) return currentTranslations.poor || 'Poor';
        if (humidity < 70) return currentTranslations.good || 'Good';
        if (humidity < 85) return currentTranslations.optimal || 'Optimal';
        return currentTranslations.wet || 'Wet';
    }

    getTemperatureStatus(temp) {
        const currentTranslations = this.translations[this.currentLanguage];
        
        if (temp < 15) return currentTranslations.cold || 'Cold';
        if (temp < 20) return currentTranslations.good || 'Good';
        if (temp < 28) return currentTranslations.perfect || 'Perfect';
        if (temp < 35) return currentTranslations.good || 'Good';
        return currentTranslations.hot || 'Hot';
    }

    formatTime(date) {
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
        return date.toLocaleDateString();
    }

    async sendMessage(predefinedMessage = null) {
        const chatInput = document.getElementById('chatInput');
        const message = predefinedMessage || chatInput.value.trim();
        
        if (!message) return;

        // Add user message
        this.addUserMessage(message);
        
        // Clear input
        if (!predefinedMessage) {
            chatInput.value = '';
            chatInput.style.height = 'auto';
        }

        // Add typing indicator
        this.addTypingIndicator();

        try {
            // Send to local AI backend
            const response = await this.getAIResponse(message);
            this.removeTypingIndicator();
            this.addBotMessage(response);
        } catch (error) {
            console.error('AI request failed:', error);
            this.removeTypingIndicator();
            // Fallback to local response
            const fallbackResponse = this.generateAIResponse(message);
            this.addBotMessage(fallbackResponse);
        }
    }

    addUserMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    addBotMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <p>${message}</p>
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
        
        // Speak the message if speech is enabled
        this.speakText(message);
    }

    async getAIResponse(message) {
        try {
            const response = await fetch('http://192.168.137.1:3000/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sensorData: this.sensorData,
                    language: this.currentLanguage
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Error calling AI API:', error);
            throw error;
        }
    }

    addTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message bot-message typing-indicator';
        
        typingDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-robot"></i>
            </div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = document.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    generateAIResponse(userMessage) {
        const message = userMessage.toLowerCase();
        const data = this.sensorData;
        
        // Soil moisture related responses
        if (message.includes('soil') || message.includes('moisture')) {
            const moisture = Math.round(data.soilMoisture);
            if (moisture < 30) {
                return `Your soil moisture is quite low at ${moisture}%. I recommend watering your plants soon. Most plants prefer soil moisture between 50-70%.`;
            } else if (moisture > 80) {
                return `Your soil moisture is quite high at ${moisture}%. Make sure there's good drainage to prevent root rot. Consider reducing watering frequency.`;
            } else {
                return `Your soil moisture is excellent at ${moisture}%! This is optimal for most plants. Keep up the good care routine.`;
            }
        }
        
        // Watering related responses
        if (message.includes('water')) {
            const moisture = Math.round(data.soilMoisture);
            if (moisture < 40) {
                return `Yes, your plants could use some water. Current soil moisture is ${moisture}%. Water slowly until you see slight runoff, then stop.`;
            } else {
                return `Your soil moisture looks good at ${moisture}%. You don't need to water right now. Check again in a day or two.`;
            }
        }
        
        // Temperature related responses
        if (message.includes('temperature') || message.includes('temp')) {
            const temp = Math.round(data.temperature * 10) / 10;
            if (temp < 18) {
                return `Temperature is ${temp}°C, which is a bit cool for most plants. Consider moving them to a warmer location or using a heat mat.`;
            } else if (temp > 30) {
                return `Temperature is ${temp}°C, which is quite warm. Ensure good air circulation and consider moving plants away from direct heat sources.`;
            } else {
                return `Temperature is perfect at ${temp}°C! This is ideal for most houseplants. Your plants should be happy with this temperature.`;
            }
        }
        
        // Humidity related responses
        if (message.includes('humidity')) {
            const humidity = Math.round(data.humidity);
            if (humidity < 40) {
                return `Humidity is ${humidity}%, which is low for most plants. Consider using a humidifier or placing a water tray near your plants.`;
            } else if (humidity > 80) {
                return `Humidity is ${humidity}%, which is quite high. Ensure good air circulation to prevent fungal issues.`;
            } else {
                return `Humidity is great at ${humidity}%! This level is perfect for most houseplants.`;
            }
        }
        
        // Health status responses
        if (message.includes('health') || message.includes('status')) {
            const moisture = Math.round(data.soilMoisture);
            const temp = Math.round(data.temperature * 10) / 10;
            const humidity = Math.round(data.humidity);
            
            let health = 'excellent';
            let issues = [];
            
            if (moisture < 30 || moisture > 85) {
                health = 'needs attention';
                issues.push('soil moisture');
            }
            if (temp < 16 || temp > 32) {
                health = 'needs attention';
                issues.push('temperature');
            }
            if (humidity < 35 || humidity > 85) {
                health = 'needs attention';
                issues.push('humidity');
            }
            
            if (issues.length === 0) {
                return `Your plants are in excellent health! All readings are optimal: ${moisture}% soil moisture, ${temp}°C temperature, ${humidity}% humidity.`;
            } else {
                return `Your plants need some attention. Current issues: ${issues.join(', ')}. Check the readings above and adjust care accordingly.`;
            }
        }
        
        // General plant care tips
        if (message.includes('tip') || message.includes('care') || message.includes('help')) {
            const tips = [
                "💧 Water when soil moisture drops below 40% for most plants.",
                "🌡️ Keep temperature between 18-26°C for optimal growth.",
                "💨 Maintain humidity between 40-70% for healthy plants.",
                "☀️ Ensure adequate light but avoid direct harsh sunlight.",
                "🕒 Check your plants daily and water early morning when possible.",
                "🌱 Rotate plants weekly for even growth and light exposure."
            ];
            return tips[Math.floor(Math.random() * tips.length)];
        }
        
        // Default responses
        const defaultResponses = [
            "I'm here to help with your plant care! Ask me about soil moisture, watering, temperature, or humidity.",
            "Your current readings show everything is looking good! Is there something specific you'd like to know?",
            "I can provide plant care advice based on your sensor data. What would you like to know?",
            "Feel free to ask about watering schedules, optimal growing conditions, or plant health!"
        ];
        
        return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    scrollToBottom() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    startDataRefresh() {
        // Update readings counter
        let readingCount = 1247;
        setInterval(() => {
            readingCount += Math.floor(Math.random() * 3) + 1;
            document.getElementById('readingsCount').textContent = readingCount.toLocaleString();
        }, 10000);
    }

    // Method to send data to ESP32 (for future use)
    sendToESP32(data) {
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify(data));
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ESP32Dashboard();
    
    // Try to connect to ESP32 (uncomment when ESP32 is ready)
    // dashboard.connectToESP32('ws://192.168.1.100:81');
});

// Add some interactive animations
document.addEventListener('DOMContentLoaded', () => {
    // Animate sensor cards on load
    const cards = document.querySelectorAll('.sensor-card');
    cards.forEach((card, index) => {
        setTimeout(() => {
            card.style.transform = 'translateY(0)';
            card.style.opacity = '1';
        }, index * 200);
    });
    
    // Add hover effects to progress bars
    const progressBars = document.querySelectorAll('.progress-fill');
    progressBars.forEach(bar => {
        bar.addEventListener('mouseenter', () => {
            bar.style.transform = 'scaleY(1.2)';
        });
        bar.addEventListener('mouseleave', () => {
            bar.style.transform = 'scaleY(1)';
        });
    });
});

// PWA-like features for mobile
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // You can register a service worker here for offline functionality
        console.log('Service Worker support detected');
    });
}

// Handle orientation changes on mobile
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        window.scrollTo(0, 0);
    }, 100);
});