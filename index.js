const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const express = require('express');
const qrcode = require('qrcode');
const https = require('https');
const app = express();
const port = process.env.PORT || 3000;
const P = require('pino');

// المسار للصورة
const imagePath = path.join(__dirname, 'trk.png');

// حفظ حالة المستخدمين
const userStates = new Set();

// متغير عالمي لتخزين آخر QR code
let lastQR = '';
let isConnected = false;

// تأكد من وجود مجلد auth_info
if (!fs.existsSync('./auth_info')) {
    fs.mkdirSync('./auth_info');
}

// إعداد Express
app.use(express.static('public'));
app.set('view engine', 'ejs');

// صفحة QR الرئيسية
app.get('/', (req, res) => {
    res.render('qr', { 
        qrCode: lastQR,
        isConnected: isConnected,
        botStatus: isConnected ? 'متصل' : 'غير متصل'
    });
});

// مسار للتأكد من أن البوت يعمل
app.get('/ping', (req, res) => {
    res.send('pong');
});

// متغيرات تتبع إعادة الاتصال
let connectionRetryCount = 0;
const MAX_RETRIES = 5;

// دالة الاتصال بالواتساب
async function connectToWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('auth_info')
        
        const sock = makeWASocket({
            printQRInTerminal: false,
            auth: state,
            logger: P({ level: 'silent' }),
            qrTimeout: 60000,
            connectTimeout: 60000,
            defaultQueryTimeoutMs: 60000
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                lastQR = await qrcode.toDataURL(qr);
                isConnected = false;
                console.log('New QR Code generated - Check the web interface');
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                isConnected = false;
                
                if (shouldReconnect && connectionRetryCount < MAX_RETRIES) {
                    connectionRetryCount++;
                    setTimeout(connectToWhatsApp, 5000 * connectionRetryCount);
                }
            } else if (connection === 'open') {
                isConnected = true;
                connectionRetryCount = 0;
                lastQR = ''; // مسح QR بعد الاتصال
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            
            if (!m.message) return;

            const chatId = m.key.remoteJid;

            // تحقق إذا تم مراسلة هذا المستخدم مسبقاً
            if (userStates.has(chatId)) return;

            // إضافة المراسل إلى قائمة المستخدمين لمنع تكرار المراسلة
            userStates.add(chatId);

            try {
                // إرسال الرسالة الترحيبية مع الصورة
                await sock.sendMessage(chatId, {
                    image: { url: imagePath },
                    caption: '*3 تلاتة تريكو وقبية 199 درهم*\n' +
                            'التوصيل 0 درهم\n' +
                            'متوفر في S L XL 2XL 3XL\n' +
                            '♻️لتسجيل طلبكم سريعا♻️\n' +
                            'اترك رسالتك\n' +
                            '*بالاسم*             :………………………\n' +
                            '*رقم الهاتف*    : ………………………\n' +
                            '*العنوان الكامل* : …………………….\n' +
                            '*المقاس*           :………………………\n' +
                            'سيعمل فريقنا على الإتصال بكم وبتوصيل طلبيتكم'
                });

                // إرسال تذكير بعد 30 ثانية
                setTimeout(async () => {
                    await sock.sendMessage(chatId, {
                        text: 'برجاء تقديم المعلومات اللازمة *بالاسم*، *رقم الهاتف*، و*العنوان الكامل* لتتم معالجة طلبكم بنجاح. شكرا!'
                    });
                }, 30000);

            } catch (error) {
                console.error('خطأ في معالجة الرسالة:', error);
            }
        });

    } catch (err) {
        console.error('♻️خطأ في الاتصال:', err);
        if (connectionRetryCount < MAX_RETRIES) {
            setTimeout(connectToWhatsApp, 10000);
        }
    }
}

// بدء الخادم
const server = app.listen(port, () => {
    console.log(`الخادم يعمل على المنفذ ${port}`);
    connectToWhatsApp().catch(err => {
        console.error('خطأ في الاتصال الأولي:', err);
        setTimeout(connectToWhatsApp, 10000);
    });
});

// معالجة أخطاء العملية
process.on('uncaughtException', (err) => {
    console.error('خطأ غير معالج:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('رفض غير معالج:', err);
});

process.on('SIGTERM', () => {
    console.log('تم استلام إشارة SIGTERM. جاري الإغلاق بأمان...');
    server.close(() => {
        console.log('تم إغلاق الخادم');
        process.exit(0);
    });
});
