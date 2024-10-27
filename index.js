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

// آلية الحفاظ على نشاط التطبيق
function keepAlive() {
    const appUrl = process.env.APP_URL || `https://five555-3.onrender.com`;
    console.log('Starting keep-alive mechanism...');
    
    setInterval(() => {
        https.get(appUrl, (resp) => {
            if (resp.statusCode === 200) {
                console.log('Keep-alive ping successful');
            }
        }).on('error', (err) => {
            console.error('Keep-alive ping failed:', err);
        });
    }, 840000);
}

// إعداد Express
app.use(express.static('public'));
app.set('view engine', 'ejs');

// إنشاء مجلد public إذا لم يكن موجوداً
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public');
}

// صفحة QR الرئيسية
app.get('/', (req, res) => {
    res.render('qr', { 
        qrCode: lastQR,
        isConnected: isConnected,
        botStatus: isConnected ? 'متصل' : 'غير متصل'
    });
});

// مسار للحصول على حالة الاتصال
app.get('/status', (req, res) => {
    res.json({ 
        isConnected: isConnected,
        status: isConnected ? 'متصل' : 'غير متصل'
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
                try {
                    // تحويل QR إلى صورة وحفظها
                    lastQR = await qrcode.toDataURL(qr);
                    isConnected = false;
                    console.log('New QR Code generated - Check the web interface');
                } catch (err) {
                    console.error('Error generating QR code:', err);
                }
            }
            
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                isConnected = false;
                
                console.log('انقطع الاتصال بسبب:', lastDisconnect?.error);
                
                if (shouldReconnect && connectionRetryCount < MAX_RETRIES) {
                    connectionRetryCount++;
                    console.log(`\nمحاولة إعادة الاتصال ${connectionRetryCount} من ${MAX_RETRIES}`);
                    setTimeout(() => {
                        connectToWhatsApp();
                    }, 5000 * connectionRetryCount);
                } else if (connectionRetryCount >= MAX_RETRIES) {
                    console.log('\nتم الوصول للحد الأقصى من محاولات إعادة الاتصال. يرجى التحقق من اتصالك.');
                }
            } else if (connection === 'open') {
                console.log('تم الاتصال بنجاح! البوت جاهز للعمل');
                isConnected = true;
                connectionRetryCount = 0;
                lastQR = ''; // مسح QR بعد الاتصال
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const m = messages[0];
            
            if (!m.message) return;
            const messageType = Object.keys(m.message)[0];
            
            let messageText = messageType === 'conversation' ? m.message.conversation :
                messageType === 'extendedTextMessage' ? m.message.extendedTextMessage.text : '';
            
            if (!messageText) return;
            
            const chatId = m.key.remoteJid;
            
            if (userStates.has(chatId)) return;
            userStates.add(chatId);

            try {
                switch(messageText.toLowerCase()) {
                    case 'start':
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
                        break;
                        
                    case 'help':
                        await sock.sendMessage(chatId, {
                            text: '*3 تلاتة تريكو وقبية 199 درهم*:\n' +
                                '♻️لتسجيل طلبكم سريعا♻️\n' +
                                    'اترك رسالتك\n' +
                                    '*بالاسم*             :………………………\n' +
                                    '*رقم الهاتف*    : ………………………\n' +
                                    '*العنوان الكامل* : …………………….\n' +
                                    '*المقاس*           :………………………\n' +
                                    'سيعمل فريقنا على الإتصال بكم وبتوصيل طلبيتكم'
                        });
                        break;
                        
                    default:
                        if (!messageText.startsWith('help') && !messageText.startsWith('start')) {
                            await sock.sendMessage(chatId, {
                                text: '♻️لتسجيل طلبكم سريعا♻️'
                            });
                        }
                }
            } catch (error) {
                console.error('خطأ في معالجة الرسالة:', error);
            } finally {
                setTimeout(() => {
                    userStates.delete(chatId);
                }, 60000);
            }
        });

    } catch (err) {
        console.error('♻️لتسجيل طلبكم سريعا♻️:', err);
        if (connectionRetryCount < MAX_RETRIES) {
            setTimeout(() => connectToWhatsApp(), 10000);
        }
    }
}

// بدء الخادم
const server = app.listen(port, () => {
    console.log(`الخادم يعمل على المنفذ ${port}`);
    keepAlive();
    connectToWhatsApp().catch(err => {
        console.error('خطأ في الاتصال الأولي:', err);
        setTimeout(() => connectToWhatsApp(), 10000);
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
