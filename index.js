const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const express = require('express');
const path = require('path');

// Create an Express server to serve the QR code
const app = express();
const port = process.env.PORT || 3000;

app.get('/qr', (req, res) => {
    res.sendFile(path.join(__dirname, 'qrcode.png'));
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

// Initialize the WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ],
        headless: true
    }
});

// Listen for the QR code and save it as a PNG
client.on('qr', (qr) => {
    qrcode.toFile('qrcode.png', qr, (err) => {
        if (err) {
            console.error('Error generating QR Code:', err);
        } else {
            console.log(`QR Code saved as qrcode.png. You can access it at http://localhost:${port}/qr`);
        }
    });
});

// When the client is ready
client.on('ready', () => {
    console.log('Client is ready!');

    // Send a welcome message to a predefined number
    const chatId = '+212708026291'; // ضع الرقم الصحيح هنا
    client.sendMessage(chatId, 'مرحبًا! أنا البوت الخاص بك.'); // تأكد من استخدام الرقم مع رمز الدولة
});

// Handle incoming messages and send media and button responses
const media = MessageMedia.fromFilePath('./trk.png');
const respondedContacts = new Set();

client.on('message', async (message) => {
    console.log(`Received message from ${message.from}: ${message.body}`);

    const sender = message.from;

    if (!respondedContacts.has(sender)) {
        try {
            respondedContacts.add(sender);

            // Send the image and description
            await client.sendMessage(sender, media, {
                caption: 'هالعرض المميز:\n3 تلاتة تريكو وقبية بـ 199 درهم فقط! 🎉\nالتوصيل مجاني لجميع المناطق 🚚. سعر المنتج هو 199 درهم. من فضلك أرسل معلوماتك للطلب (الاسم، العنوان، رقم الهاتف، المقاس).'
            });

            // Send buttons with options
            const buttons = [
                { buttonId: 'price', buttonText: { displayText: 'سعر المنتج' }, type: 1 },
                { buttonId: 'delivery', buttonText: { displayText: 'تكلفة التوصيل' }, type: 1 },
                { buttonId: 'quality', buttonText: { displayText: 'جودة المنتج' }, type: 1 }
            ];

            const buttonMessage = {
                text: 'اختر خيارًا:',
                footer: 'معلومات إضافية',
                buttons: buttons,
                headerType: 1
            };

            await client.sendMessage(sender, buttonMessage);
        } catch (error) {
            console.error('Error sending message:', error);
            await client.sendMessage(sender, 'للطلب، يرجى إرسال معلوماتك.');
        }
    }
});

// Handle button responses
client.on('button-response', async (buttonResponse) => {
    const sender = buttonResponse.from;
    const selectedButtonId = buttonResponse.selectedButtonId;

    const responses = {
        price: 'سعر المنتج هو 199 درهم.',
        delivery: 'التوصيل مجاني لجميع المناطق 🚚.',
        quality: 'جودة المنتج عالية جدًا.'
    };

    try {
        await client.sendMessage(sender, responses[selectedButtonId] || 'للطلب، يرجى إرسال معلوماتك.');
    } catch (error) {
        console.error('Error handling button response:', error);
    }
});

// Initialize the client
client.initialize().catch(err => {
    console.error('Error initializing client:', err);
});
