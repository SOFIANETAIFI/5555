// index.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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
        executablePath: '/nix/store/x205pbkd5xh5g4iv0g58xjla55has3cx-chromium-108.0.5359.94/bin/chromium',
        headless: true
    }
});

// إعدادات الصورة للمنتج
const media = MessageMedia.fromFilePath('./trk.png');

// حفظ جهات الاتصال الذين تم الرد عليهم
const respondedContacts = new Set();

// عرض QR Code عند بدء تشغيل البوت
client.on('qr', (qr) => {
    console.log('QR Code received:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async (message) => {
    const sender = message.from;

    if (!respondedContacts.has(sender)) {
        try {
            respondedContacts.add(sender);

            // إرسال الصورة والوصف
            await client.sendMessage(sender, media, {
                caption: 'هالعرض المميز:\n3 تلاتة تريكو وقبية بـ 199 درهم فقط! 🎉\nالتوصيل مجاني لجميع المناطق 🚚. سعر المنتج هو 199 درهم. من فضلك أرسل معلوماتك للطلب (الاسم، العنوان، رقم الهاتف، المقاس).'
            });

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

client.on('button-response', async (buttonResponse) => {
    const sender = buttonResponse.from;
    const selectedButtonId = buttonResponse.selectedButtonId;

    const responses = {
        price: 'سعر المنتج هو 199 درهم.',
        delivery: 'التوصيل مجاني لجميع المناطق 🚚.',
        quality: 'جودة المنتج عالية جدًا.'
    };

    try {
        await client.sendMessage(sender, responses[selectedButtonId] || 'للطلب، يرجى إرسال معلوماتك');
    } catch (error) {
        console.error('Error handling button response:', error);
    }
});

client.initialize().catch(err => {
    console.error('Error initializing client:', err);
});
