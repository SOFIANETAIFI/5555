// index.js
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState
} = require('@whiskeysockets/baileys');
const path = require('path');
const fs = require('fs');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const P = require('pino');

// Keep service alive
app.get('/', (req, res) => {
    res.send('WhatsApp Bot is Running!');
});

app.get('/ping', (req, res) => {
    res.send('pong');
});

// المسار للصورة
const imagePath = path.join(__dirname, 'trk.png');

// حفظ حالة المستخدمين
const userStates = new Set();

// تأكد من وجود مجلد auth_info
if (!fs.existsSync('./auth_info')) {
    fs.mkdirSync('./auth_info');
}

// دالة لتشغيل البوت
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    
    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: P({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('اتصال مقطوع بسبب ', lastDisconnect.error, ', جاري إعادة الاتصال:', shouldReconnect);
            
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('تم الاتصال بنجاح!');
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
                        text: 'الأوامر المتاحة:\n' +
                              '- start: لعرض المنتج وتفاصيل الطلب\n' +
                              '- help: لعرض قائمة الأوامر'
                    });
                    break;
                    
                default:
                    if (!messageText.startsWith('help') && !messageText.startsWith('start')) {
                        await sock.sendMessage(chatId, {
                            text: 'عذراً، لا أفهم هذا الأمر. يرجى استخدام "help" لرؤية الأوامر المتاحة.'
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
}

app.listen(port, () => {
    console.log(`الخادم يعمل على المنفذ ${port}`);
    connectToWhatsApp().catch(err => console.log('خطأ في الاتصال:', err));
});

// Keep the process alive
process.on('SIGTERM', () => {
    console.log('SIGTERM received');
});
