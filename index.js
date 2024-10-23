const express = require('express');
const { Client, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);

// Store QR code data
let qrCodeData = null;
let clientReady = false;

// Express middleware
app.use(express.json());
app.use(express.static('public'));

const client = new Client({
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
    },
    authTimeoutMs: 60000, // 60 seconds for authentication
});

// Set up media and responded contacts
const media = MessageMedia.fromFilePath('./trk.png');
const respondedContacts = new Set();

// QR Code endpoint
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
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send('QR Code not yet generated. Please wait...');
    }
});

// Status endpoint
app.get('/status', (req, res) => {
    res.json({
        status: clientReady ? 'ready' : 'waiting',
        respondedContacts: Array.from(respondedContacts).length
    });
});

// WhatsApp client events
client.on('qr', async (qr) => {
    console.log('QR Code received');
    try {
        qrCodeData = await qrcode.toDataURL(qr);
    } catch (err) {
        console.error('Error generating QR code:', err);
    }
});

client.on('ready', () => {
    console.log('Client is ready!');
    clientReady = true;
    qrCodeData = null; // Clear QR code once client is ready
});

client.on('message', async (message) => {
    const sender = message.from;

    if (!respondedContacts.has(sender)) {
        try {
            respondedContacts.add(sender);

            // Send product image and description
            await client.sendMessage(sender, media, {
                caption: 'هالعرض المميز:\n3 تلاتة تريكو وقبية بـ 199 درهم فقط! 🎉\nالتوصيل مجاني لجميع المناطق 🚚. سعر المنتج هو 199 درهم. من فضلك أرسل معلوماتك للطلب (الاسم، العنوان، رقم الهاتف، المقاس).'
            });

            const buttonMessage = {
                text: 'للمزيد من المعلومات، يرجى إرسال أحد الأرقام التالية:\n1. سعر المنتج\n2. تكلفة التوصيل\n3. جودة المنتج',
            };

            await client.sendMessage(sender, buttonMessage);
        } catch (error) {
            console.error('Error sending message:', error);
            await client.sendMessage(sender, 'عذراً، حدث خطأ. للطلب، يرجى إرسال معلوماتك.');
        }
    }
});

client.on('message', async (message) => {
    const sender = message.from;
    const messageContent = message.body;

    const responses = {
        '1': 'سعر المنتج هو 199 درهم.',
        '2': 'التوصيل مجاني لجميع المناطق 🚚.',
        '3': 'جودة المنتج عالية جدًا.'
    };

    if (responses[messageContent]) {
        try {
            await client.sendMessage(sender, responses[messageContent]);
        } catch (error) {
            console.error('Error handling response:', error);
        }
    }
});

// Handle authentication events
client.on('authenticated', () => {
    console.log('Client authenticated');
});

client.on('auth_failure', (error) => {
    console.error('Authentication failed:', error);
    qrCodeData = null;
    clientReady = false;
});

// Initialize client and start server
const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await client.initialize();
        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('Error starting server:', err);
    }
}

startServer();

// Handle process termination
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Cleaning up...');
    await client.destroy();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
