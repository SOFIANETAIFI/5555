// index.js
const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const path = require('path');
const app = express();
const server = http.createServer(app);

let qrCodeData = null;
let clientReady = false;
let client = null;
let connectionCheckInterval = null;

// Express middleware
app.use(express.json());
app.use(express.static('public'));

// Function to clear sessions
const clearSessions = () => {
    const sessionsPath = './sessions';
    if (fs.existsSync(sessionsPath)) {
        fs.rmSync(sessionsPath, { recursive: true, force: true });
        fs.mkdirSync(sessionsPath);
        console.log('Sessions cleared');
    }
};

// Function to initialize WhatsApp client
const initializeWhatsAppClient = () => {
    // Clear existing client if any
    if (client) {
        try {
            client.destroy();
        } catch (err) {
            console.error('Error destroying client:', err);
        }
    }

    // Clear sessions before creating new client
    clearSessions();

    // Reset states
    qrCodeData = null;
    clientReady = false;

    // Create new client
    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: './sessions'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--no-zygote',
                '--single-process',
            ],
        }
    });

    // Set up client event handlers
    client.on('qr', async (qr) => {
        console.log('New QR Code received');
        try {
            qrCodeData = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('Error generating QR code:', err);
        }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        clientReady = true;
        qrCodeData = null;
        startConnectionCheck();
    });

    client.on('disconnected', (reason) => {
        console.log('Client was disconnected:', reason);
        clientReady = false;
        stopConnectionCheck();
        // Reinitialize after short delay
        setTimeout(() => {
            initializeWhatsAppClient();
        }, 5000);
    });

    client.on('auth_failure', () => {
        console.log('Auth failure, restarting...');
        clientReady = false;
        stopConnectionCheck();
        initializeWhatsAppClient();
    });

    // Message handling
    client.on('message', async (message) => {
        const sender = message.from;
        const messageContent = message.body;

        try {
            // Basic message handling
            if (!clientReady) {
                return; // Don't process messages if client isn't ready
            }

            const media = MessageMedia.fromFilePath('./trk.png');

            if (!message.isGroup) {
                await client.sendMessage(sender, media, {
                    caption: 'هالعرض المميز:\n3 تلاتة تريكو وقبية بـ 199 درهم فقط! 🎉\nالتوصيل مجاني لجميع المناطق 🚚. سعر المنتج هو 199 درهم. من فضلك أرسل معلوماتك للطلب (الاسم، العنوان، رقم الهاتف، المقاس).'
                });

                const buttonMessage = {
                    text: 'للمزيد من المعلومات، يرجى إرسال أحد الأرقام التالية:\n1. سعر المنتج\n2. تكلفة التوصيل\n3. جودة المنتج',
                };

                await client.sendMessage(sender, buttonMessage);
            }

            // Handle numeric responses
            const responses = {
                '1': 'سعر المنتج هو 199 درهم.',
                '2': 'التوصيل مجاني لجميع المناطق 🚚.',
                '3': 'جودة المنتج عالية جدًا.'
            };

            if (responses[messageContent]) {
                await client.sendMessage(sender, responses[messageContent]);
            }

        } catch (error) {
            console.error('Error handling message:', error);
        }
    });

    // Initialize client
    client.initialize().catch(err => {
        console.error('Failed to initialize client:', err);
        setTimeout(() => {
            initializeWhatsAppClient();
        }, 5000);
    });
};

// Connection monitoring functions
const checkConnection = async () => {
    if (!client || !clientReady) return;

    try {
        const state = await client.getState();
        console.log('Current connection state:', state);
        
        if (state !== 'CONNECTED') {
            console.log('Connection lost, reinitializing...');
            clientReady = false;
            stopConnectionCheck();
            initializeWhatsAppClient();
        }
    } catch (err) {
        console.error('Error checking connection:', err);
        clientReady = false;
        stopConnectionCheck();
        initializeWhatsAppClient();
    }
};

const startConnectionCheck = () => {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }
    connectionCheckInterval = setInterval(checkConnection, 30000); // Check every 30 seconds
};

const stopConnectionCheck = () => {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
};

// Express routes
app.get('/qr', async (req, res) => {
    if (clientReady) {
        return res.send('WhatsApp client is already ready!');
    }
    if (qrCodeData) {
        res.type('html');
        res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <meta http-equiv="refresh" content="30">
                    <style>
                        body {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background-color: #f0f2f5;
                        }
                        .container {
                            text-align: center;
                            padding: 20px;
                            background: white;
                            border-radius: 10px;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                        }
                        img {
                            max-width: 300px;
                            height: auto;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Scan QR Code to Login</h2>
                        <img src="${qrCodeData}" alt="WhatsApp QR Code"/>
                        <p>Status: Waiting for scan...</p>
                        <p>Page will refresh automatically every 30 seconds</p>
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send('QR Code not yet generated. Please wait and refresh...');
    }
});

app.get('/status', (req, res) => {
    res.json({
        status: clientReady ? 'ready' : 'waiting',
        state: client ? client.getState() : 'not_initialized'
    });
});

app.get('/restart', (req, res) => {
    initializeWhatsAppClient();
    res.json({ message: 'WhatsApp client is restarting...' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initializeWhatsAppClient();
});

// Handle process termination
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Cleaning up...');
    stopConnectionCheck();
    if (client) {
        await client.destroy();
    }
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
