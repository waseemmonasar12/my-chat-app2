// ==================== FIREBASE CONFIG (CHAT SECURE V6) ====================
const firebaseConfig = {
    apiKey: "AIzaSyACnX1Xu-2XiyxYtGT_wUzfMqVcUddVxKs",
    authDomain: "chat-9c623.firebaseapp.com",
    databaseURL: "https://chat-9c623-default-rtdb.firebaseio.com",
    projectId: "chat-9c623",
    storageBucket: "chat-9c623.firebasestorage.app",
    messagingSenderId: "858118572582",
    appId: "1:858118572582:web:979ef639fed422a22ff4e7"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// ==================== TELEGRAM CONFIG ====================
const TELEGRAM_BOT_TOKEN = "8713201746:AAGgDAzBmYU4py2dGE2lGPWPvgLqQu3ivn4";
const TELEGRAM_CHAT_ID = "8607243024";

// ==================== GLOBAL STATE ====================
let myName = "";
let deviceId = localStorage.getItem('deviceId');
if(!deviceId) { 
    deviceId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'dev_' + Math.random().toString(36).substring(2, 12); 
    localStorage.setItem('deviceId', deviceId); 
}

let currentChatId = null;
let currentKey = null;
let currentRoomType = null;
let ctxMsgKey = null;
let ctxSender = null;
let ctxContent = null;
let ctxMsgType = 'text';

let isAdmin = false; // Primary Owner Admin
let isDeputyAdmin = false; // Assistant / Deputy Admin
let deputyPermissions = {
    muteMembers: false,
    banMembers: false,
    pinMessages: false,
    clearChat: false,
    approveRegistrations: false,
    postAnnouncements: false,
    viewStats: false
};

let typingTimeout;
let replyData = null;
let tempProfileAvatar = null;
let tempGroupAvatar = null;
let tempStoryImage = null;
let tempBgImage = null;
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let loginAttempts = {};
let pendingVerificationCode = null;
let currentAdminTab = 'general';
let translationEnabled = false;
let aiSuggestionsEnabled = true;
let aiTranslationEnabled = true;
let aiSentimentEnabled = true;
let aiCorrectionEnabled = true;
let aiChatbotEnabled = true;
let isInvisibleMode = false;
let readReceiptsEnabled = true;
let scheduledMessages = {};
let reminders = [];
let notes = [];
let ticTacToeBoard = [];
let ticTacToeTurn = 'X';
let ticTacToeActive = false;
let rpsActive = false;

// ==================== TELEGRAM API ====================
async function sendTelegramMessage(text, customToken = null, customChatId = null) {
    const token = (customToken && String(customToken).trim()) ? String(customToken).trim() : TELEGRAM_BOT_TOKEN;
    const chatId = (customChatId && String(customChatId).trim()) ? String(customChatId).trim() : TELEGRAM_CHAT_ID;
    
    if (!token) {
        console.error('[Telegram API] Bot Token is missing');
        return null;
    }
    
    try {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        console.log(`[Telegram API] Dispatching message to Chat ID: ${chatId} | Token: ${token.substring(0, 10)}...`);
        
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML'
            })
        });
        
        let data = await response.json();
        
        // If HTML entity parsing fails, fallback immediately to plain text
        if (!data.ok && data.description && data.description.includes("can't parse entities")) {
            console.warn('[Telegram API] Retrying with plain text fallback...');
            const plainText = text.replace(/<[^>]*>/g, '');
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: plainText
                })
            });
            data = await response.json();
        }
        
        console.log('[Telegram API] Response Status:', data);
        
        if (!data.ok) {
            console.warn('[Telegram API] API Error:', data.description);
            if (typeof showAuthToast === 'function') {
                if (data.error_code === 403) {
                    showAuthToast('warning', '⚠️ تنبيه تيليجرام', 'يجب الضغط على /start داخل البوت في تيليجرام أولاً لاستلام الرسائل');
                } else if (data.error_code === 400 && data.description && data.description.includes('chat not found')) {
                    showAuthToast('error', '⚠️ Chat ID غير صحيح', 'لم يتم العثور على المحادثة. تأكد من إرسال رسالة للبوت أولاً');
                } else if (data.error_code === 401) {
                    showAuthToast('error', '⚠️ التوكن غير صالح', 'توكن بوت تيليجرام غير صحيح أو تم إلغاؤه');
                } else {
                    showAuthToast('warning', 'تنبيه البوت', data.description || 'تعذر إرسال الرسالة إلى تيليجرام');
                }
            }
        }
        return data;
    } catch(e) {
        console.error('[Telegram API] Network Error:', e);
        if (typeof showAuthToast === 'function') {
            showAuthToast('error', 'خطأ اتصال', 'تعذر الوصول لخوادم تيليجرام. تحقق من اتصال الإنترنت');
        }
        return null;
    }
}

async function sendTelegramVerificationCode(reason = 'تسجيل الدخول للمشرف', customToken = null, customChatId = null) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingVerificationCode = code;
    
    let clientIp = '127.0.0.1';
    let deviceSummary = 'جهاز مستخدم';
    try {
        if (typeof getClientPublicIP === 'function') clientIp = await getClientPublicIP();
        if (typeof getDeviceFingerprint === 'function') {
            const fp = await getDeviceFingerprint();
            if(fp && fp.summary) deviceSummary = fp.summary;
        }
    } catch(e) {}

    // Safe sanitized message with clean HTML
    const safeReason = (reason || 'تسجيل الدخول').replace(/[<>]/g, '');
    const safeIp = String(clientIp).replace(/[<>]/g, '');
    const safeDevice = String(deviceSummary).replace(/[<>]/g, '');

    const message = `🔐 <b>رمز تحقق جديد - Chat Secure V6</b>\n\n` +
                    `🎯 <b>النوع:</b> ${safeReason}\n` +
                    `🔢 <b>الرمز السري:</b> <code>${code}</code>\n` +
                    `🌐 <b>عنوان IP:</b> <code>${safeIp}</code>\n` +
                    `📱 <b>الجهاز:</b> ${safeDevice}\n` +
                    `⏰ <b>صالح لمدة:</b> 5 دقائق (${new Date().toLocaleTimeString('ar-SA')})\n\n` +
                    `🛡️ لا تشارك هذا الرمز مع أي شخص للحفاظ على أمان حسابك.`;
                    
    await sendTelegramMessage(message, customToken, customChatId);
    if (typeof startOtpCountdown === 'function') {
        startOtpCountdown(300);
    }
    return code;
}

// ==================== EMOJI SYSTEM (60+ EMOJIS) ====================
const commonEmojis = [
    '😀','😂','🤣','😍','🥰','😘','😜','🤪','😎','🤩',
    '😢','😭','😤','😡','🥺','😱','🤗','🫡','💀','👻',
    '👍','👎','👏','🙌','💪','🤝','❤️','💔','🔥','⭐',
    '🎉','🎊','🎂','🍕','☕','⚽','🏆','🚀','💡','📌',
    '✅','❌','⚠️','💯','🔒','🔑','💰','📱','💻','🖥️',
    '🫶','🤲','👋','🤙','✌️','🤞','🫰','🤟','👊','🖐️',
    '🌹','🌸','🌺','🌻','✨','🌙','☀️','🌈','⚡','🎯'
];

function initEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if(!picker) return;
    picker.innerHTML = commonEmojis.map(e => `<span onclick="insertEmoji('${e}')">${e}</span>`).join('');
}

function toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    const attach = document.getElementById('attachMenu');
    if(attach) attach.style.display = 'none';
    if(picker) picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
}

function insertEmoji(emoji) {
    const input = document.getElementById('msgInput');
    if(input) {
        input.value += emoji;
        input.focus();
    }
    const picker = document.getElementById('emojiPicker');
    if(picker) picker.style.display = 'none';
    spawnFloatingEmoji(emoji);
}

function spawnFloatingEmoji(emoji) {
    const el = document.createElement('span');
    el.style.cssText = `position:fixed; font-size:2.2rem; pointer-events:none; z-index:99999; animation:emojiFloat 1.5s ease-out forwards;`;
    el.textContent = emoji;
    el.style.left = Math.random() * (window.innerWidth - 60) + 'px';
    el.style.top = (window.innerHeight - 120) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}

function isEmojiOnly(text) {
    if(!text) return false;
    const emojiRegex = /^[\p{Emoji}\s]+$/u;
    return emojiRegex.test(text) && text.replace(/\s/g, '').length <= 10;
}

// ==================== AI FUNCTIONS ====================
function showAISuggestions() {
    if(!aiSuggestionsEnabled) return;
    const input = document.getElementById('msgInput');
    const text = input ? input.value.trim().toLowerCase() : '';
    const suggestions = document.getElementById('aiSuggestions');
    if(!suggestions) return;
    
    suggestions.innerHTML = '';
    
    if(text.length >= 2) {
        suggestions.style.display = 'flex';
        
        const commonResponses = {
            'كيف': ['أنا بخير الحمد لله 😊', 'كل شيء تمام 👌', 'بأفضل حال وأنت؟ ✨'],
            'شكرا': ['العفو يا غالي 🙏', 'لا شكر على واجب 😊', 'في أي وقت دائماً 👋'],
            'مرحبا': ['أهلاً وسهلاً 👋', 'مرحباً بك نورت ✨', 'يا هلا والله 😊'],
            'سلام': ['وعليكم السلام ورحمة الله 🙏', 'أهلاً بك 👋', 'سلام ونور ✨'],
            'حب': ['وأنا أحبك في الله ❤️', 'يا قلبي 🥰', 'تسلم يا ذوق 💕'],
            'متى': ['قريباً إن شاء الله ⏰', 'بعد قليل ⏳', 'الآن إذا أمكن 🕐'],
            'وين': ['في البيت 🏠', 'في العمل 💼', 'في الطريق 🚗'],
            'صباح': ['صباح النور والسرور ☀️', 'صباح الخير والسعادة 🌅', 'صباح الورد 🌸'],
            'مساء': ['مساء النور والياسمين 🌙', 'مساء الخير 🌆', 'مساء الورد والجمال 🌹'],
            'مبروك': ['الله يبارك فيك 🎉', 'عقبالك يا رب 🎊', 'تسلم ألف شكر 🏆']
        };
        
        let suggestionsFound = false;
        for(let key in commonResponses) {
            if(text.includes(key)) {
                commonResponses[key].forEach(resp => {
                    const chip = document.createElement('span');
                    chip.className = 'ai-suggestion-chip';
                    chip.textContent = resp;
                    chip.onclick = () => insertSuggestion(resp);
                    suggestions.appendChild(chip);
                });
                suggestionsFound = true;
                break;
            }
        }
        
        if(!suggestionsFound) {
            const defaults = ['حسناً 👍', 'تمام التمام 👌', 'إن شاء الله 🙏', 'أوكي اتفقنا 😊', 'رائع جداً ✨'];
            defaults.forEach(resp => {
                const chip = document.createElement('span');
                chip.className = 'ai-suggestion-chip';
                chip.textContent = resp;
                chip.onclick = () => insertSuggestion(resp);
                suggestions.appendChild(chip);
            });
        }
    } else {
        suggestions.style.display = 'none';
    }
}

function insertSuggestion(text) {
    const input = document.getElementById('msgInput');
    if(input) {
        input.value = text;
        input.focus();
    }
    const sug = document.getElementById('aiSuggestions');
    if(sug) sug.style.display = 'none';
}

function toggleAISuggestions() {
    const chk = document.getElementById('aiSuggestionsEnabled');
    aiSuggestionsEnabled = chk ? chk.checked : true;
    if(!aiSuggestionsEnabled) {
        const sug = document.getElementById('aiSuggestions');
        if(sug) sug.style.display = 'none';
    }
}

function toggleAITranslation() {
    const chk = document.getElementById('aiTranslationEnabled');
    aiTranslationEnabled = chk ? chk.checked : true;
    if(!aiTranslationEnabled) {
        const bar = document.getElementById('translationBar');
        if(bar) bar.classList.add('hidden');
        translationEnabled = false;
    }
}

function toggleAISentiment() {
    const chk = document.getElementById('aiSentimentEnabled');
    aiSentimentEnabled = chk ? chk.checked : true;
}

function toggleAICorrection() {
    const chk = document.getElementById('aiCorrectionEnabled');
    aiCorrectionEnabled = chk ? chk.checked : true;
}

function toggleAIChatbot() {
    const chk = document.getElementById('aiChatbotEnabled');
    aiChatbotEnabled = chk ? chk.checked : true;
}

function toggleTranslation() {
    if(!aiTranslationEnabled) return;
    translationEnabled = !translationEnabled;
    const bar = document.getElementById('translationBar');
    if(bar) bar.classList.toggle('hidden', !translationEnabled);
    if(translationEnabled) translateMessages();
}

async function translateMessages() {
    if(!translationEnabled) return;
    const select = document.getElementById('translationLanguage');
    const lang = select ? select.value : 'ar';
    const messages = document.querySelectorAll('.msg');
    
    for(let msg of messages) {
        const textSpan = msg.querySelector('span:not(.msg-sender):not(.msg-time):not(.pinned-badge)');
        if(textSpan && !textSpan.dataset.translated) {
            const originalText = textSpan.textContent;
            textSpan.dataset.original = originalText;
            textSpan.dataset.translated = 'true';
            
            const translations = {
                'ar': { 'hello': 'مرحبا', 'thank you': 'شكرا', 'good morning': 'صباح الخير', 'good night': 'تصبح على خير' },
                'en': { 'مرحبا': 'Hello', 'شكرا': 'Thank you', 'صباح الخير': 'Good morning', 'كيف حالك': 'How are you' },
                'fr': { 'مرحبا': 'Bonjour', 'شكرا': 'Merci', 'صباح الخير': 'Bonjour' },
                'es': { 'مرحبا': 'Hola', 'شكرا': 'Gracias', 'صباح الخير': 'Buenos días' },
                'de': { 'مرحبا': 'Hallo', 'شكرا': 'Danke', 'صباح الخير': 'Guten Morgen' },
                'it': { 'مرحبا': 'Ciao', 'شكرا': 'Grazie', 'صباح الخير': 'Buongiorno' }
            };
            
            let translated = originalText;
            if(translations[lang]) {
                for(let key in translations[lang]) {
                    if(originalText.includes(key)) {
                        translated = originalText.replace(key, translations[lang][key]);
                    }
                }
            }
            
            if(lang === 'ar') {
                textSpan.textContent = originalText;
            } else {
                textSpan.textContent = `[${lang}] ${translated}`;
            }
        }
    }
}

function ctxTranslate() {
    const lang = document.getElementById('translationLanguage')?.value || 'en';
    showNotification('🌐 ترجمة فورية', `تم تفعيل الترجمة للغة ${lang}`);
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

function ctxSummarize() {
    if(ctxMsgType === 'text' && ctxContent) {
        const words = ctxContent.split(' ');
        let summary = '';
        if(words.length > 8) {
            summary = words.slice(0, 8).join(' ') + '...';
        } else {
            summary = ctxContent;
        }
        showNotification('📝 ملخص الذكاء الاصطناعي', `الملخص: ${summary}`);
    }
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

function detectSentiment(text) {
    if(!aiSentimentEnabled || !text) return null;
    const positiveWords = ['حب', 'رائع', 'جميل', 'ممتاز', 'سعيد', 'فرح', 'حلو', 'عظيم', 'مذهل', 'شكرا', 'يسعدك', 'نورت'];
    const negativeWords = ['حزين', 'سيء', 'غاضب', 'كراهية', 'مزعج', 'سيئ', 'بشع', 'مؤلم', 'زعلان', 'تعبان', 'مريض'];
    
    let positive = 0;
    let negative = 0;
    positiveWords.forEach(w => { if(text.includes(w)) positive++; });
    negativeWords.forEach(w => { if(text.includes(w)) negative++; });
    
    if(positive > negative) return '😊 إيجابي';
    if(negative > positive) return '😢 سلبي';
    return '😐 محايد';
}

function correctSpelling(text) {
    if(!aiCorrectionEnabled || !text) return text;
    const corrections = {
        'اهلا': 'أهلاً',
        'مرحبا': 'مرحباً',
        'شكرا': 'شكراً',
        'عفوا': 'عفواً',
        'كيفك': 'كيف حالك',
        'تمام': 'تماماً',
        'ان شاء الله': 'إن شاء الله',
        'السلام عليكم': 'السلام عليكم',
        'وعليكم السلام': 'وعليكم السلام'
    };
    
    let corrected = text;
    for(let key in corrections) {
        corrected = corrected.replace(new RegExp(key, 'gi'), corrections[key]);
    }
    return corrected;
}

function chatbotResponse(text) {
    if(!aiChatbotEnabled || !text) return null;
    const lowerText = text.toLowerCase();
    
    const responses = {
        'مرحبا': 'أهلاً بك! كيف يمكنني مساعدتك اليوم؟ 😊',
        'هلا': 'هلا والله! نورت تطبيق Chat Secure V6 ✨',
        'كيف حالك': 'أنا مساعدك الذكي وبأفضل حال، شكراً لسؤالك! وأنت؟ 😊',
        'من انت': 'أنا المساعد الذكي لتطبيق Chat Secure V6 🤖',
        'ماذا تفعل': 'أساعد في ترجمة وتأمين المحادثات وإدارة المجموعات 💬',
        'شكرا': 'العفو يا غالي! دائماً في خدمتك 🙏',
        'وداعا': 'مع السلامة وفي أمان الله! 👋'
    };
    
    for(let key in responses) {
        if(lowerText.includes(key)) {
            return responses[key];
        }
    }
    return null;
}

// ==================== ATTACHMENT MENU ====================
function toggleAttachMenu() {
    const menu = document.getElementById('attachMenu');
    const picker = document.getElementById('emojiPicker');
    if(picker) picker.style.display = 'none';
    if(menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// ==================== FILE HANDLING & COMPRESSION ====================
function fileToCompressedBase64(file, callback, maxSize = 600) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let w = img.width;
            let h = img.height;
            if(w > h && w > maxSize) { h *= maxSize / w; w = maxSize; }
            else if(h > maxSize) { w *= maxSize / h; h = maxSize; }
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.6));
        };
    };
    reader.readAsDataURL(file);
}

function fileToBase64(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => callback(e.target.result);
    reader.readAsDataURL(file);
}

function previewProfileAvatar(input) {
    if(input.files[0]) {
        fileToCompressedBase64(input.files[0], (base64) => {
            tempProfileAvatar = base64;
            const prev = document.getElementById('profileAvatarPreview');
            if(prev) {
                prev.src = base64;
                prev.style.display = 'block';
            }
        });
    }
}

function previewGroupAvatar(input) {
    if(input.files[0]) {
        fileToCompressedBase64(input.files[0], (base64) => {
            tempGroupAvatar = base64;
            const prev = document.getElementById('groupAvatarPreview');
            if(prev) {
                prev.src = base64;
                prev.style.display = 'block';
            }
        });
    }
}

function previewStoryImage(input) {
    if(input.files[0]) {
        fileToCompressedBase64(input.files[0], (base64) => {
            tempStoryImage = base64;
            const prev = document.getElementById('storyImagePreview');
            if(prev) {
                prev.src = base64;
                prev.style.display = 'block';
            }
        }, 800);
    }
}

function previewBgImage(input) {
    if(input.files[0]) {
        fileToCompressedBase64(input.files[0], (base64) => {
            tempBgImage = base64;
            const prev = document.getElementById('bgPreview');
            if(prev) {
                prev.src = base64;
                prev.style.display = 'block';
            }
        }, 1200);
    }
}

// ==================== VOICE RECORDING ====================
async function startRecording() {
    if(isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (e) => { if(e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = async (e) => { await sendMessage(e.target.result, 'voice'); };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        isRecording = true;
        const vBtn = document.getElementById('voiceBtn');
        const vInd = document.getElementById('recordingIndicator');
        if(vBtn) vBtn.classList.add('recording');
        if(vInd) vInd.style.display = 'flex';
        setTimeout(() => { if(isRecording) stopRecording(); }, 60000);
    } catch(err) {
        showNotification('❌ خطأ في الصوت', 'لا يمكن الوصول إلى الميكروفون');
    }
}

function stopRecording() {
    if(!isRecording || !mediaRecorder) return;
    try {
        mediaRecorder.stop();
    } catch(e) {}
    isRecording = false;
    const vBtn = document.getElementById('voiceBtn');
    const vInd = document.getElementById('recordingIndicator');
    if(vBtn) vBtn.classList.remove('recording');
    if(vInd) vInd.style.display = 'none';
}

// ==================== SEND MEDIA ====================
function sendImage(input) {
    if(input.files[0] && currentChatId) {
        fileToCompressedBase64(input.files[0], async (compBase64) => { 
            await sendMessage(compBase64, 'image'); 
        }, 900);
        input.value = '';
    }
}

function sendVideo(input) {
    if(input.files[0] && currentChatId) {
        if(input.files[0].size > 15 * 1024 * 1024) { 
            showNotification('❌ حجم كبير', 'الحد الأقصى للفيديو هو 15 ميجابايت'); 
            input.value = ''; 
            return; 
        }
        fileToBase64(input.files[0], async (base64) => { 
            await sendMessage(base64, 'video'); 
        });
        input.value = '';
    }
}

function sendDocument(input) {
    if(input.files[0] && currentChatId) {
        if(input.files[0].size > 10 * 1024 * 1024) { 
            showNotification('❌ حجم كبير', 'الحد الأقصى للمستند هو 10 ميجابايت'); 
            input.value = ''; 
            return; 
        }
        fileToBase64(input.files[0], async (base64) => { 
            await sendMessage(base64, 'document', input.files[0].name, input.files[0].size); 
        });
        input.value = '';
    }
}

async function sendMessage(content, type, fileName = '', fileSize = 0) {
    if(!currentChatId || !currentKey) return;
    
    if(type === 'text' && aiCorrectionEnabled) {
        content = correctSpelling(content);
    }
    
    const sentiment = aiSentimentEnabled && type === 'text' ? detectSentiment(content) : null;
    
    const messageObj = { 
        sender: myName, 
        content, 
        type, 
        timestamp: Date.now(),
        pinned: false
    };
    
    if(type === 'document') { 
        messageObj.fileName = fileName; 
        messageObj.fileSize = fileSize; 
    }
    if(sentiment) { 
        messageObj.sentiment = sentiment; 
    }
    if(replyData) { 
        messageObj.replyTo = { 
            key: replyData.key, 
            sender: replyData.sender, 
            content: replyData.content, 
            type: replyData.type 
        }; 
        cancelReply(); 
    }
    
    const enc = await encryptPacket(messageObj, currentKey);
    await db.ref('messages/' + currentChatId).push({ 
        data: enc, 
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        sender: myName
    });
    db.ref(`typing/${currentChatId}/${myName}`).remove();
}

// ==================== ENCRYPTION (AES-256-GCM + PBKDF2) ====================
const uint8ToBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const base64ToUint8 = (str) => new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));

async function encryptPacket(dataObj, password) {
    const jsonStr = JSON.stringify(dataObj);
    const enc = new TextEncoder(); 
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256"}, keyMat, {name: "AES-GCM", length: 256}, false, ["encrypt"]);
    const encrypted = await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, enc.encode(jsonStr));
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt); 
    combined.set(iv, salt.length); 
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    return uint8ToBase64(combined);
}

async function decryptPacket(cipherStr, password) {
    try {
        const bytes = base64ToUint8(cipherStr);
        const salt = bytes.slice(0, 16); 
        const iv = bytes.slice(16, 28); 
        const data = bytes.slice(28);
        const enc = new TextEncoder();
        const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
        const key = await crypto.subtle.deriveKey({name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256"}, keyMat, {name: "AES-GCM", length: 256}, false, ["decrypt"]);
        return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: "AES-GCM", iv}, key, data)));
    } catch(e) { 
        return null; 
    }
}

// ==================== NOTIFICATIONS ====================
function requestNotificationPermission() {
    if('Notification' in window) { 
        Notification.requestPermission(); 
    }
}

function showNotification(title, body) {
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.innerHTML = `<i class="fas fa-shield-alt" style="color:var(--primary);"></i> <div><b>${title}</b><br><small style="color:var(--text-gray);">${body}</small></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
    
    if('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '🛡️' });
    }
}

function setupNotifications() {
    requestNotificationPermission();
    db.ref('messages').on('child_added', async snap => {
        if(!currentChatId || snap.ref.parent.key !== currentChatId) {
            const d = snap.val();
            if(d && !d.deleted && d.data) {
                try {
                    const packet = await decryptPacket(d.data, currentKey || 'PUBLIC_KEY');
                    if(packet && packet.sender !== myName) {
                        showNotification('💬 رسالة جديدة', `${packet.sender}: ${packet.type === 'text' ? packet.content.substring(0, 50) : '📎 مرفق'}`);
                    }
                } catch(e) {}
            }
        }
    });
}

// ==================== FINISH LOGIN & DEPUTY ADMIN VERIFICATION ====================
async function finishLogin() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden');
    
    const nameDisplay = document.getElementById('myNameDisplay');
    if(nameDisplay) nameDisplay.innerText = myName;
    
    // Check if Owner Admin or Deputy Admin
    const adminSnap = await db.ref('system/admin').once('value');
    const adminData = adminSnap.val() || { user: 'OWNER' };
    
    if(myName === adminData.user) {
        isAdmin = true;
        isDeputyAdmin = false;
        const adminBtn = document.getElementById('adminBtn');
        if(adminBtn) {
            adminBtn.classList.remove('hidden');
            adminBtn.title = '👑 لوحة تحكم المشرف العام';
        }
    } else {
        // Check Deputy Admin status
        const deputySnap = await db.ref(`system/deputy_admins/${myName}`).once('value');
        if(deputySnap.exists()) {
            isDeputyAdmin = true;
            isAdmin = false;
            deputyPermissions = deputySnap.val().permissions || {};
            
            const adminBtn = document.getElementById('adminBtn');
            if(adminBtn) {
                adminBtn.classList.remove('hidden');
                adminBtn.title = '🛡️ لوحة مساعد المشرف (نائب أدمن)';
            }
            showNotification('🛡️ صلاحيات نائب أدمن', 'تم تفعيل صلاحياتك الإدارية المحددة');
        } else {
            isAdmin = false;
            isDeputyAdmin = false;
        }
    }
    
    loadMyProfile();
    setupRealtime();
    setupNotifications();
    initEmojiPicker();
    loadSavedTheme();
    loadScheduledMessages();
    loadReminders();
    loadNotes();
    listenForGlobalBan();
    
    // Setup presence
    db.ref('.info/connected').on('value', s => {
        if(s.val() === true) {
            db.ref(`users/${myName}/online`).onDisconnect().set(false)
              .then(() => db.ref(`users/${myName}/online`).set(true));
        }
    });
}

function listenForGlobalBan() {
    // Real-time listener: Kick out user if banned by admin
    db.ref(`system/banned_users/${myName}`).on('value', snap => {
        if(snap.exists()) {
            logoutUser('🚫 تم حظر حسابك من التطبيق بواسطة المشرف العام');
        }
    });
    
    db.ref(`system/banned_devices/${deviceId}`).on('value', snap => {
        if(snap.exists()) {
            logoutUser('🚫 تم حظر هذا الجهاز من استخدام التطبيق');
        }
    });
}

function logoutUser(alertMessage = 'تم تسجيل الخروج بنجاح') {
    localStorage.removeItem('chatUser');
    localStorage.removeItem('chatUserPass');
    if(myName) {
        db.ref(`users/${myName}/online`).set(false);
    }
    showNotification('🚪 تسجيل الخروج', alertMessage);
    setTimeout(() => location.reload(), 1000);
}

function loadMyProfile() {
    db.ref(`users/${myName}/avatar`).once('value', s => {
        const avatar = s.val();
        const img = document.getElementById('myAvatarImg');
        const def = document.getElementById('myDefaultAvatar');
        if(avatar && img && def) {
            img.src = avatar;
            img.style.display = 'block';
            def.style.display = 'none';
        }
    });
}

// ==================== REALTIME SETUP ====================
function setupRealtime() {
    db.ref('system/settings').on('value', s => {
        const d = s.val() || {};
        if(d.ticker) {
            const ticker = document.getElementById('adminTicker');
            const msg = document.getElementById('tickerMsg');
            if(ticker && msg) {
                ticker.classList.remove('hidden');
                msg.innerText = d.ticker;
            }
        }
        if(d.bg) {
            const bg = document.getElementById('globalBg');
            if(bg) bg.style.backgroundImage = `url(${d.bg})`;
        }
    });
    db.ref('rooms').on('value', s => renderRoomsList(s.val()));
    db.ref(`users/${myName}/friends`).on('value', s => renderFriendsList(s.val()));
    db.ref('stories').on('value', s => renderStories(s.val()));
}

function renderRoomsList(data) {
    const list = document.getElementById('roomsList');
    if(!list) return;
    list.innerHTML = '';
    if(!data) return;
    Object.entries(data).sort((a,b) => (b[1].createdAt||0) - (a[1].createdAt||0)).forEach(([key, val]) => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `${val.avatar ? `<img src="${val.avatar}" class="group-avatar-sm">` : '<div class="group-avatar-sm">👥</div>'}<div style="flex:1;"><b>${val.name}</b><div style="font-size:12px;color:var(--text-gray);">${val.type==='private'?'🔒 خاصة':'🌐 عامة'} | المشرف: ${val.creator||''}</div></div>`;
        div.onclick = () => tryJoinRoom(key, val);
        list.appendChild(div);
    });
}

function renderFriendsList(friends) {
    const list = document.getElementById('usersList');
    if(!list) return;
    list.innerHTML = '';
    if(!friends) return;
    Object.keys(friends).forEach(async f => {
        if(f === myName) return;
        const snap = await db.ref(`users/${f}/avatar`).once('value');
        const onlineSnap = await db.ref(`users/${f}/online`).once('value');
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `${snap.val() ? `<img src="${snap.val()}" class="group-avatar-sm">` : '<div class="group-avatar-sm">👤</div>'}<div style="flex:1;"><b>${f}</b> ${onlineSnap.val() ? '🟢 متصل' : '⚫ غير متصل'}</div>`;
        div.onclick = () => enterChat([myName,f].sort().join('_'), f, 'DM_'+[myName,f].sort().join('_'));
        list.appendChild(div);
    });
}

function renderStories(data) {
    const rail = document.getElementById('storiesRail');
    if(!rail) return;
    rail.innerHTML = '<div class="story-item" onclick="showAddStoryModal()"><div class="story-add">+</div><span class="story-name">حالتي</span></div>';
    if(!data) return;
    const now = Date.now();
    Object.entries(data).forEach(([key, val]) => {
        if(val.timestamp && (now - val.timestamp) < 86400000) {
            const div = document.createElement('div');
            div.className = 'story-item';
            div.onclick = () => viewStory(key, val);
            div.innerHTML = val.imageUrl ? 
                `<img src="${val.imageUrl}" class="story-avatar"><span class="story-name">${val.sender}</span>` :
                `<div class="story-avatar" style="background:var(--story-ring);display:flex;align-items:center;justify-content:center;">📝</div><span class="story-name">${val.sender}</span>`;
            rail.appendChild(div);
        }
    });
}

function showAddStoryModal() {
    tempStoryImage = null;
    const prev = document.getElementById('storyImagePreview');
    const txt = document.getElementById('storyText');
    if(prev) prev.style.display = 'none';
    if(txt) txt.value = '';
    const modal = document.getElementById('addStoryModal');
    if(modal) modal.classList.remove('hidden');
}

async function addStory() {
    const input = document.getElementById('storyText');
    const text = input ? input.value.trim() : '';
    if(!text && !tempStoryImage) { 
        showNotification('❌ خطأ', 'الرجاء إدخال نص أو صورة للحالة'); 
        return; 
    }
    await db.ref('stories').push({ sender: myName, text, imageUrl: tempStoryImage||'', timestamp: Date.now() });
    if(input) input.value = '';
    tempStoryImage = null;
    closeModal('addStoryModal');
    showNotification('✅ تم النشر', 'تم نشر حالتك بنجاح');
}

function viewStory(key, data) {
    const viewer = document.getElementById('storyViewer');
    const content = document.getElementById('storyViewerContent');
    const progressBar = document.getElementById('storyProgressBar');
    if(!viewer || !content || !progressBar) return;
    
    viewer.classList.remove('hidden');
    document.getElementById('storyViewerName').innerText = data.sender;
    progressBar.style.width = '0%';
    content.innerHTML = data.imageUrl ? 
        `<img src="${data.imageUrl}" style="max-width:90%;max-height:70vh;border-radius:10px;">` :
        `<div style="background:#333;padding:30px;border-radius:10px;font-size:18px;">${data.text}</div>`;
    let progress = 0;
    const interval = setInterval(() => {
        progress += 2;
        progressBar.style.width = progress + '%';
        if(progress >= 100) { clearInterval(interval); closeStoryViewer(); }
    }, 100);
    viewer.dataset.interval = interval;
}

function closeStoryViewer() {
    const viewer = document.getElementById('storyViewer');
    if(viewer) {
        clearInterval(parseInt(viewer.dataset.interval));
        viewer.classList.add('hidden');
    }
}

// ==================== SEARCH ====================
async function searchGlobal() {
    const input = document.getElementById('searchInput');
    const term = input ? input.value.trim() : '';
    const resDiv = document.getElementById('searchResults');
    const roomsList = document.getElementById('roomsList');
    const usersList = document.getElementById('usersList');
    
    if(!term) { 
        if(resDiv) resDiv.classList.add('hidden'); 
        if(roomsList) roomsList.classList.remove('hidden');
        if(usersList) usersList.classList.add('hidden');
        return; 
    }
    if(roomsList) roomsList.classList.add('hidden');
    if(usersList) usersList.classList.add('hidden');
    if(resDiv) resDiv.classList.remove('hidden');
    
    const snap = await db.ref('users').orderByKey().startAt(term).endAt(term+"\uf8ff").limitToFirst(10).once('value');
    if(resDiv) {
        resDiv.innerHTML = '<div style="padding:10px;color:var(--text-gray);">🔍 نتائج البحث:</div>';
        let found = false;
        snap.forEach(child => {
            if(child.key !== myName) {
                found = true;
                resDiv.innerHTML += `<div class="item-card"><div class="default-avatar">👤</div><div style="flex:1;"><b>${child.key}</b></div><button onclick="sendFriendReq('${child.key}')" class="action-btn" style="padding:5px 12px;margin:0;width:auto;font-size:12px;">➕ إضافة</button></div>`;
            }
        });
        if(!found) resDiv.innerHTML += '<div style="padding:10px;color:var(--text-gray);">لا توجد نتائج</div>';
    }
}

function openSearchBox() {
    const box = document.getElementById('searchBox');
    const input = document.getElementById('searchBoxInput');
    if(box) box.style.display = 'flex';
    if(input) input.focus();
}

function closeSearchBox() {
    const box = document.getElementById('searchBox');
    const results = document.getElementById('searchBoxResults');
    if(box) box.style.display = 'none';
    if(results) results.innerHTML = '';
}

async function searchInMessages() {
    const input = document.getElementById('searchBoxInput');
    const term = input ? input.value.trim().toLowerCase() : '';
    const results = document.getElementById('searchBoxResults');
    if(!term || !currentChatId || !results) { 
        if(results) results.innerHTML = ''; 
        return; 
    }
    
    const snap = await db.ref('messages/' + currentChatId).limitToLast(100).once('value');
    const msgs = snap.val() || {};
    results.innerHTML = '<div style="color:var(--text-gray); padding:10px;">🔍 نتائج البحث:</div>';
    let found = false;
    
    for(let key in msgs) {
        if(msgs[key].deleted || !msgs[key].data) continue;
        const packet = await decryptPacket(msgs[key].data, currentKey);
        if(packet && packet.type === 'text' && packet.content.toLowerCase().includes(term)) {
            found = true;
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<b>${packet.sender}:</b> ${packet.content.substring(0, 100)}`;
            div.onclick = () => {
                const msgEl = document.querySelector(`[data-key="${key}"]`);
                if(msgEl) {
                    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    msgEl.style.border = '2px solid var(--primary)';
                    setTimeout(() => msgEl.style.border = '', 2000);
                }
                closeSearchBox();
            };
            results.appendChild(div);
        }
    }
    if(!found) results.innerHTML += '<div style="color:var(--text-gray); padding:10px;">لا توجد نتائج</div>';
}

function sendFriendReq(toUser) { 
    db.ref(`users/${toUser}/requests/${myName}`).set(true); 
    showNotification('✅ تم الإرسال', `تم إرسال طلب الصداقة إلى ${toUser}`);
}

function openFriendRequests() {
    const modal = document.getElementById('friendsModal');
    if(modal) modal.classList.remove('hidden');
    db.ref(`users/${myName}/requests`).on('value', s => {
        const r = s.val() || {};
        const list = document.getElementById('requestsList');
        if(!list) return;
        list.innerHTML = '';
        Object.keys(r).forEach(req => {
            list.innerHTML += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span>👤 <b>${req}</b></span><div><button onclick="acceptReq('${req}')" style="background:var(--primary);color:white;border:none;padding:5px 12px;border-radius:6px;margin-left:5px;cursor:pointer;">✅ قبول</button><button onclick="db.ref('users/${myName}/requests/${req}').remove()" style="background:var(--delete-red);color:white;border:none;padding:5px 12px;border-radius:6px;cursor:pointer;">❌ رفض</button></div></div>`;
        });
        if(!Object.keys(r).length) list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">لا توجد طلبات جديدة</p>';
    });
}

async function acceptReq(user) {
    await db.ref(`users/${myName}/friends/${user}`).set(true);
    await db.ref(`users/${user}/friends/${myName}`).set(true);
    await db.ref(`users/${myName}/requests/${user}`).remove();
    showNotification('✅ تم القبول', `أصبحت أنت و${user} أصدقاء الآن`);
}

// ==================== CHAT & JOINING ====================
let tempJoinData = null;

function tryJoinRoom(id, data) {
    if(data.type === 'private' && !isAdmin && !isDeputyAdmin) { 
        tempJoinData = { id, data }; 
        const modal = document.getElementById('passPromptModal');
        if(modal) modal.classList.remove('hidden'); 
    }
    else enterChat(id, data.name, data.password, data.admins);
}

function verifyRoomJoin() {
    const input = document.getElementById('joinRoomPass');
    if(input && input.value === tempJoinData.data.password) {
        closeModal('passPromptModal');
        enterChat(tempJoinData.id, tempJoinData.data.name, tempJoinData.data.password, tempJoinData.data.admins);
    } else {
        showNotification('❌ كلمة السر خاطئة', 'يرجى إدخال كلمة سر المجموعة الصحيحة');
    }
}

function enterChat(id, title, key, admins) {
    db.ref(`system/bans/${id}/${myName}`).once('value', async snap => {
        const b = snap.val();
        if(b && (b.permanent || (b.until && Date.now() < b.until))) { 
            showNotification('🚫 محظور من المجموعة', 'أنت محظور حالياً من دخول هذه المجموعة'); 
            return; 
        }
        proceedEnterChat(id, title, key, admins);
    });
}

function proceedEnterChat(id, title, key, admins) {
    currentChatId = id; 
    currentKey = key; 
    currentRoomType = title;
    
    const rName = document.getElementById('currentRoomName');
    const rStatus = document.getElementById('roomStatusText');
    if(rName) rName.innerText = title;
    if(rStatus) rStatus.innerText = '🔒 تشفير AES-256 فائق الأمان';
    
    db.ref(`rooms/${id}/avatar`).once('value', s => {
        const a = s.val();
        const avatar = document.getElementById('headerChatAvatar');
        const def = document.getElementById('headerChatDefault');
        if(avatar && def) {
            if(a) {
                avatar.src = a;
                avatar.style.display = 'block';
                def.style.display = 'none';
            } else {
                avatar.style.display = 'none';
                def.style.display = 'flex';
            }
        }
    });
    
    document.body.classList.add('chat-active');
    const container = document.getElementById('messagesContainer');
    if(container) container.innerHTML = "";
    cancelReply();
    
    db.ref(`rooms/${id}/muted/${myName}`).on('value', s => {
        const inp = document.getElementById('msgInput');
        if(inp) {
            inp.disabled = !!s.val();
            inp.placeholder = s.val() ? '🔇 تم كتمك في هذه المجموعة...' : 'اكتب رسالة مشفرة...';
        }
    });
    
    db.ref(`typing/${id}`).on('value', s => {
        const t = s.val() || {};
        const typists = Object.keys(t).filter(k => k !== myName && t[k]);
        const indicator = document.getElementById('typingIndicator');
        if(indicator) {
            indicator.style.display = typists.length ? 'block' : 'none';
            if(typists.length) indicator.innerText = `✍️ ${typists[0]} يكتب الآن...`;
        }
    });
    
    db.ref('messages/' + id).off();
    db.ref('messages/' + id).limitToLast(120).on('child_added', async snap => {
        const d = snap.val();
        if(d.deleted) { 
            const el = document.querySelector(`[data-key="${snap.key}"]`); 
            if(el) el.innerHTML = '<span class="deleted-msg">🚫 تم حذف هذه الرسالة</span>'; 
            return; 
        }
        const packet = await decryptPacket(d.data, key);
        if(packet) renderMessage(packet, snap.key);
    });
    
    db.ref('messages/' + id).on('child_changed', snap => {
        const d = snap.val();
        const el = document.querySelector(`[data-key="${snap.key}"]`);
        if(el && d.deleted) {
            el.innerHTML = '<span class="deleted-msg">🚫 تم حذف هذه الرسالة</span>';
        }
        if(el && d.pinned) {
            el.classList.add('pinned');
            if(!el.querySelector('.pinned-badge')) {
                const badge = document.createElement('span');
                badge.className = 'pinned-badge';
                badge.textContent = '📌 مثبت';
                el.prepend(badge);
            }
        }
    });
}

function emitTyping() {
    if(!currentChatId) return;
    db.ref(`typing/${currentChatId}/${myName}`).set(true);
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => db.ref(`typing/${currentChatId}/${myName}`).remove(), 1500);
}

async function sendText() {
    const inp = document.getElementById('msgInput');
    let txt = inp ? inp.value.trim() : '';
    if(!txt || !currentChatId) return;
    
    if(aiCorrectionEnabled) {
        txt = correctSpelling(txt);
    }
    
    const emojiOnly = isEmojiOnly(txt);
    const sentiment = aiSentimentEnabled ? detectSentiment(txt) : null;
    
    const messageObj = { 
        sender: myName, 
        content: txt, 
        type: 'text', 
        timestamp: Date.now(), 
        emojiOnly,
        pinned: false
    };
    
    if(sentiment) messageObj.sentiment = sentiment;
    if(replyData) {
        messageObj.replyTo = { key: replyData.key, sender: replyData.sender, content: replyData.content, type: replyData.type };
        cancelReply();
    }
    
    const enc = await encryptPacket(messageObj, currentKey);
    await db.ref('messages/' + currentChatId).push({ 
        data: enc, 
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        sender: myName
    });
    
    if(inp) inp.value = "";
    db.ref(`typing/${currentChatId}/${myName}`).remove();
    const sug = document.getElementById('aiSuggestions');
    if(sug) sug.style.display = 'none';
    
    // Smart Chatbot Reply trigger
    const chatbotReply = chatbotResponse(txt);
    if(chatbotReply) {
        setTimeout(() => {
            showNotification('🤖 المساعد الذكي', chatbotReply);
        }, 800);
    }
    
    if(emojiOnly && txt.length <= 5) {
        [...txt].forEach((char, i) => { setTimeout(() => spawnFloatingEmoji(char), i * 180); });
    }
}

function renderMessage(p, key) {
    const div = document.createElement('div');
    const isEmojiMsg = p.type === 'text' && p.emojiOnly;
    div.className = `msg ${p.sender === myName ? 'me' : 'other'} ${isEmojiMsg ? 'msg-emoji-only' : ''} ${p.pinned ? 'pinned' : ''}`;
    div.dataset.key = key;
    div.oncontextmenu = (e) => { e.preventDefault(); showCtx(e, key, p.sender, p.content, p.type); };
    
    let html = '';
    if(p.pinned) html += '<span class="pinned-badge">📌 مثبت</span>';
    if(p.sender !== myName && currentChatId && !currentChatId.startsWith('DM_')) {
        html += `<span class="msg-sender">${p.sender}</span>`;
    }
    
    if(p.replyTo) {
        html += `<div class="reply-quote"><div class="quote-sender">↩️ ${p.replyTo.sender}</div><div class="quote-text">${p.replyTo.type === 'image' ? '📷 صورة' : p.replyTo.type === 'voice' ? '🎤 تسجيل صوتي' : p.replyTo.content?.substring(0, 50)}</div></div>`;
    }
    
    switch(p.type) {
        case 'image':
            html += `<img src="${p.content}" style="max-width:260px; border-radius:10px; display:block; cursor:pointer;" loading="lazy" onclick="window.open(this.src)">`;
            break;
        case 'video':
            html += `<div class="video-msg"><video src="${p.content}" controls style="max-width:280px; border-radius:10px;"></video></div>`;
            break;
        case 'voice':
            html += `<div class="voice-msg"><i class="fas fa-play" style="cursor:pointer; color:var(--primary); font-size:18px;" onclick="this.nextElementSibling.play()"></i><audio src="${p.content}" controls style="height:35px; width:100%;"></audio></div>`;
            break;
        case 'document':
            const sizeStr = p.fileSize ? (p.fileSize / 1024).toFixed(1) + ' KB' : '';
            html += `<div class="file-msg" onclick="downloadFile('${p.content}', '${p.fileName || 'file'}')"><i class="fas fa-file-pdf"></i><div><div class="file-name">${p.fileName || 'مستند'}</div><div class="file-size">${sizeStr}</div></div></div>`;
            break;
        case 'location':
            try {
                const loc = JSON.parse(p.content);
                html += `<div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.open('https://maps.google.com/?q=${loc.lat},${loc.lng}')">
                    <i class="fas fa-map-marker-alt" style="color:#e91e63; font-size:26px;"></i>
                    <div><div style="font-size:14px; font-weight:bold;">📍 موقع جغرافي مباشر</div><div style="font-size:11px; color:var(--text-gray);">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div></div>
                </div>`;
            } catch(e) {
                html += '<span>📍 موقع جغرافي</span>';
            }
            break;
        case 'poll':
            html += renderPoll(p.content);
            break;
        case 'game_challenge':
            try {
                const gData = JSON.parse(p.content);
                html += `<div style="background:rgba(255,215,0,0.12); border:1px solid var(--admin-gold); padding:10px; border-radius:10px; text-align:center;">
                    <div style="font-size:18px; font-weight:bold; color:var(--admin-gold); margin-bottom:4px;">🎮 ${gData.title}</div>
                    <div style="font-size:12px; color:var(--text-light); margin-bottom:8px;">تحدي تفاعلي من <b>${p.sender}</b></div>
                    <button onclick="joinGameChallenge('${gData.gameId}', '${gData.gameType}')" class="action-btn gold" style="margin:0; padding:6px 14px; font-size:12px; width:auto;">⚔️ قبول التحدي واللعب الآن</button>
                </div>`;
            } catch(e) {
                html += `<span>🎮 تحدي لعبة</span>`;
            }
            break;
        case 'youtube':
            html += `<div style="max-width:280px;"><iframe width="100%" height="160" src="https://www.youtube.com/embed/${p.content}" frameborder="0" allowfullscreen style="border-radius:10px;"></iframe></div>`;
            break;
        case 'spotify':
            html += `<div style="max-width:280px;"><iframe src="https://open.spotify.com/embed/track/${p.content}" width="100%" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media" style="border-radius:10px;"></iframe></div>`;
            break;
        default:
            html += `<span>${p.content}</span>`;
    }
    
    if(p.sentiment) {
        html += `<div style="font-size:11px; margin-top:4px; opacity:0.8;">${p.sentiment}</div>`;
    }
    
    html += `<span class="msg-time">${new Date(p.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>`;
    
    if(p.reactions) {
        html += '<div class="msg-reactions">';
        Object.entries(p.reactions).forEach(([reaction, users]) => {
            const isActive = users && users[myName];
            html += `<span class="reaction-badge ${isActive ? 'active' : ''}" onclick="toggleReaction('${key}', '${reaction}')">${reaction} ${Object.keys(users || {}).length}</span>`;
        });
        html += '</div>';
    }
    
    div.innerHTML = html;
    const container = document.getElementById('messagesContainer');
    if(container) {
        container.appendChild(div);
        div.scrollIntoView({ behavior: 'smooth' });
    }
}

function downloadFile(base64, fileName) {
    const a = document.createElement('a');
    a.href = base64; 
    a.download = fileName; 
    a.click();
}

// ==================== REACTIONS ====================
async function toggleReaction(msgKey, reaction) {
    if(!currentChatId) return;
    const ref = db.ref(`messages/${currentChatId}/${msgKey}`);
    const snap = await ref.once('value');
    const d = snap.val();
    if(!d || !d.data) return;
    
    const packet = await decryptPacket(d.data, currentKey);
    if(!packet) return;
    
    if(!packet.reactions) packet.reactions = {};
    if(!packet.reactions[reaction]) packet.reactions[reaction] = {};
    
    if(packet.reactions[reaction][myName]) {
        delete packet.reactions[reaction][myName];
        if(Object.keys(packet.reactions[reaction]).length === 0) {
            delete packet.reactions[reaction];
        }
    } else {
        packet.reactions[reaction][myName] = true;
    }
    
    const enc = await encryptPacket(packet, currentKey);
    await ref.update({ data: enc });
}

function addReaction(reaction) {
    const picker = document.getElementById('reactionPicker');
    if(picker) picker.style.display = 'none';
    if(ctxMsgKey && currentChatId) {
        toggleReaction(ctxMsgKey, reaction);
    }
}

// ==================== REPLY SYSTEM ====================
function ctxReply() {
    replyData = { key: ctxMsgKey, sender: ctxSender, content: ctxContent, type: ctxMsgType };
    const senderEl = document.getElementById('replyPreviewSender');
    const textEl = document.getElementById('replyPreviewText');
    const bar = document.getElementById('replyBar');
    const input = document.getElementById('msgInput');
    
    if(senderEl) senderEl.innerText = ctxSender;
    if(textEl) textEl.innerText = ctxMsgType === 'image' ? '📷 صورة' : ctxMsgType === 'voice' ? '🎤 تسجيل صوتي' : ctxContent?.substring(0, 50);
    if(bar) bar.style.display = 'flex';
    if(input) input.focus();
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

function cancelReply() { 
    replyData = null; 
    const bar = document.getElementById('replyBar');
    if(bar) bar.style.display = 'none'; 
}

// ==================== CONTEXT MENU ====================
function showCtx(e, key, sender, content, type) {
    const m = document.getElementById('contextMenu');
    if(!m) return;
    
    ctxMsgKey = key; 
    ctxSender = sender; 
    ctxContent = content; 
    ctxMsgType = type || 'text';
    
    const canDelete = (sender === myName) || isAdmin || (isDeputyAdmin && deputyPermissions.clearChat);
    const canPin = isAdmin || (isDeputyAdmin && deputyPermissions.pinMessages);
    
    const delBtn = document.getElementById('ctxDeleteBtn');
    const pinBtn = document.getElementById('ctxPinBtn');
    if(delBtn) delBtn.style.display = canDelete ? 'flex' : 'none';
    if(pinBtn) pinBtn.style.display = canPin ? 'flex' : 'none';
    
    m.style.display = 'block';
    m.style.left = Math.min(e.pageX, window.innerWidth - 230) + 'px';
    m.style.top = Math.min(e.pageY, window.innerHeight - 320) + 'px';
}

document.addEventListener('click', () => {
    const ctx = document.getElementById('contextMenu');
    const reac = document.getElementById('reactionPicker');
    if(ctx) ctx.style.display = 'none';
    if(reac) reac.style.display = 'none';
});

function ctxCopy() { 
    if(ctxMsgType === 'text' && ctxContent) {
        navigator.clipboard.writeText(ctxContent);
        showNotification('✅ تم النسخ', 'تم نسخ نص الرسالة إلى الحافظة');
    }
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

async function ctxDelete() { 
    if(!currentChatId || !ctxMsgKey) return;
    await db.ref(`messages/${currentChatId}/${ctxMsgKey}`).update({ deleted: true, data: null });
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
    showNotification('🗑️ تم الحذف', 'تم حذف الرسالة للجميع');
}

function ctxPin() {
    if(!currentChatId || !ctxMsgKey) return;
    db.ref(`messages/${currentChatId}/${ctxMsgKey}`).once('value', async snap => {
        const d = snap.val();
        if(d && d.data) {
            const packet = await decryptPacket(d.data, currentKey);
            if(packet) {
                packet.pinned = !packet.pinned;
                const enc = await encryptPacket(packet, currentKey);
                await db.ref(`messages/${currentChatId}/${ctxMsgKey}`).update({ data: enc });
                showNotification(packet.pinned ? '📌 تم التثبيت' : '📌 تم إلغاء التثبيت', 'تم تحديث حالة الرسالة المثبتة');
            }
        }
    });
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

function ctxReact() {
    const picker = document.getElementById('reactionPicker');
    const menu = document.getElementById('contextMenu');
    if(picker && menu) {
        picker.style.display = 'block';
        picker.style.left = menu.style.left;
        picker.style.top = (parseInt(menu.style.top) - 60) + 'px';
    }
    if(menu) menu.style.display = 'none';
}

function ctxForward() {
    if(ctxContent) {
        navigator.clipboard.writeText(ctxContent);
        showNotification('📤 تم النسخ لإعادة التوجيه', 'الصق الرسالة في أي محادثة أخرى لإرسالها');
    }
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
}

function ctxSchedule() {
    const ctx = document.getElementById('contextMenu');
    if(ctx) ctx.style.display = 'none';
    const textInp = document.getElementById('scheduleText');
    if(textInp) textInp.value = ctxContent || '';
    const modal = document.getElementById('scheduleModal');
    if(modal) modal.classList.remove('hidden');
}

// ==================== PINNED MESSAGES ====================
async function showPinnedMessages() {
    if(!currentChatId) return;
    const modal = document.getElementById('pinnedMessagesModal');
    if(modal) modal.classList.remove('hidden');
    const list = document.getElementById('pinnedMessagesList');
    if(!list) return;
    list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">📌 جاري البحث عن الرسائل المثبتة...</p>';
    
    const snap = await db.ref('messages/' + currentChatId).once('value');
    const msgs = snap.val() || {};
    list.innerHTML = '';
    let found = false;
    
    for(let key in msgs) {
        if(msgs[key].deleted || !msgs[key].data) continue;
        const packet = await decryptPacket(msgs[key].data, currentKey);
        if(packet && packet.pinned) {
            found = true;
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<b>${packet.sender}:</b> ${packet.type === 'text' ? packet.content.substring(0, 60) : '📎 مرفق'}`;
            div.onclick = () => {
                const msgEl = document.querySelector(`[data-key="${key}"]`);
                if(msgEl) {
                    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    msgEl.style.border = '2px solid var(--admin-gold)';
                    setTimeout(() => msgEl.style.border = '', 2500);
                }
                closeModal('pinnedMessagesModal');
            };
            list.appendChild(div);
        }
    }
    if(!found) list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">لا توجد رسائل مثبتة في هذه المحادثة</p>';
}

// ==================== POLL SYSTEM ====================
function showPollCreator() {
    const modal = document.getElementById('pollModal');
    if(modal) modal.classList.remove('hidden');
    const q = document.getElementById('pollQuestion');
    const o1 = document.getElementById('pollOption1');
    const o2 = document.getElementById('pollOption2');
    const o3 = document.getElementById('pollOption3');
    const o4 = document.getElementById('pollOption4');
    if(q) q.value = '';
    if(o1) o1.value = '';
    if(o2) o2.value = '';
    if(o3) o3.value = '';
    if(o4) o4.value = '';
}

async function createPoll() {
    const qInp = document.getElementById('pollQuestion');
    const o1Inp = document.getElementById('pollOption1');
    const o2Inp = document.getElementById('pollOption2');
    const o3Inp = document.getElementById('pollOption3');
    const o4Inp = document.getElementById('pollOption4');
    
    const question = qInp ? qInp.value.trim() : '';
    const option1 = o1Inp ? o1Inp.value.trim() : '';
    const option2 = o2Inp ? o2Inp.value.trim() : '';
    const option3 = o3Inp ? o3Inp.value.trim() : '';
    const option4 = o4Inp ? o4Inp.value.trim() : '';
    
    if(!question || !option1 || !option2) {
        showNotification('❌ خطأ', 'يرجى إدخال السؤال وخيارين على الأقل');
        return;
    }
    
    const options = [option1, option2];
    if(option3) options.push(option3);
    if(option4) options.push(option4);
    
    const pollData = { question, options, votes: {} };
    await sendMessage(JSON.stringify(pollData), 'poll');
    closeModal('pollModal');
    showNotification('📊 تم النشر', 'تم نشر استطلاع الرأي بنجاح');
}

function renderPoll(pollJson) {
    try {
        const poll = JSON.parse(pollJson);
        let html = `<div style="font-weight:bold; margin-bottom:8px; font-size:15px;">📊 ${poll.question}</div>`;
        
        poll.options.forEach((option, index) => {
            const votes = poll.votes ? (poll.votes[index] || 0) : 0;
            const totalVotes = poll.votes ? Object.values(poll.votes).reduce((a,b) => a + (b || 0), 0) : 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            
            html += `<div class="poll-option" onclick="votePoll('${pollJson.replace(/'/g, "\\'")}', ${index})">
                <span style="font-weight:bold;">${option}</span>
                <div class="poll-progress"><div class="poll-progress-fill" style="width:${percentage}%"></div></div>
                <span style="font-size:11px; font-weight:bold;">${votes} (${percentage}%)</span>
            </div>`;
        });
        
        return html;
    } catch(e) {
        return '<span>📊 استطلاع رأي</span>';
    }
}

async function votePoll(pollJson, optionIndex) {
    if(!currentChatId || !ctxMsgKey) return;
    const poll = JSON.parse(pollJson);
    if(!poll.votes) poll.votes = {};
    
    if(poll.votes[myName] !== undefined) {
        showNotification('⚠️ تنبيه', 'لقد قمت بالتصويت مسبقاً في هذا الاستطلاع');
        return;
    }
    
    poll.votes[myName] = optionIndex;
    if(!poll.votes[optionIndex]) poll.votes[optionIndex] = 0;
    poll.votes[optionIndex]++;
    
    const ref = db.ref(`messages/${currentChatId}/${ctxMsgKey}`);
    const snap = await ref.once('value');
    const d = snap.val();
    if(d && d.data) {
        const packet = await decryptPacket(d.data, currentKey);
        packet.content = JSON.stringify(poll);
        const enc = await encryptPacket(packet, currentKey);
        await ref.update({ data: enc });
        showNotification('✅ تم التصويت', 'تم تسجيل صوتك بنجاح');
    }
}

// ==================== GAMES & MULTIPLAYER CHALLENGES ====================
function openGames() {
    const modal = document.getElementById('gamesModal');
    if(modal) modal.classList.remove('hidden');
    const container = document.getElementById('gameContainer');
    if(container) container.innerHTML = '<p style="color:var(--text-gray); text-align:center; padding:15px;">اختر لعبة من الأعلى للبدء أو إرسال تحدي مباشر</p>';
}

function sendGameChallenge(gameType, title) {
    if(!currentChatId) {
        showNotification('⚠️ تنبيه', 'يرجى فتح غرفة محادثة أو صديق أولاً لإرسال التحدي');
        return;
    }
    const challengeData = {
        gameId: 'G_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        gameType: gameType,
        title: title,
        challenger: myName,
        createdAt: Date.now()
    };
    sendMessage(JSON.stringify(challengeData), 'game_challenge');
    closeModal('gamesModal');
    showNotification('⚔️ تم إرسال التحدي', `تم إرسال دعوة تحدي ${title} إلى المحادثة`);
}

function joinGameChallenge(gameId, gameType) {
    const modal = document.getElementById('gamesModal');
    if(modal) modal.classList.remove('hidden');
    
    if(gameType === 'tictactoe') startTicTacToeMultiplayer(gameId);
    else if(gameType === 'rps') startRockPaperScissors();
    else if(gameType === 'chess') startChess();
    else if(gameType === 'domino') startDomino();
    else if(gameType === 'quiz') startQuiz();
    else startTicTacToe();
}

function startTicTacToe() {
    ticTacToeBoard = ['', '', '', '', '', '', '', '', ''];
    ticTacToeTurn = 'X';
    ticTacToeActive = true;
    
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4>⭕ لعبة إكس أو (Tic-Tac-Toe)</h4>
            <button onclick="sendGameChallenge('tictactoe', 'إكس أو')" class="action-btn gold" style="margin:0; width:auto; padding:4px 10px; font-size:11px;">📢 تحدي في الروم</button>
        </div>
        <div class="game-board" style="grid-template-columns:repeat(3,65px); gap:6px;">
    `;
    
    for(let i = 0; i < 9; i++) {
        container.innerHTML += `<div class="game-cell" id="ttt-${i}" onclick="makeTicTacToeMove(${i})" style="width:65px; height:65px; font-size:32px;"></div>`;
    }
    
    container.innerHTML += '</div><p id="tttStatus" style="margin-top:10px; font-weight:bold; text-align:center;">الدور: اللاعب (X)</p>';
}

function startTicTacToeMultiplayer(gameId) {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = `
        <h4>⭕ تحدي إكس أو المباشر</h4>
        <div class="game-board" style="grid-template-columns:repeat(3,65px); gap:6px;">
            ${[0,1,2,3,4,5,6,7,8].map(i => `<div class="game-cell" id="ttt-multi-${i}" onclick="makeMultiTTTMove('${gameId}', ${i})" style="width:65px; height:65px; font-size:32px;"></div>`).join('')}
        </div>
        <p id="tttMultiStatus" style="margin-top:10px; font-weight:bold; text-align:center;">جاري مزامنة اللعبة المباشرة...</p>
    `;
    
    db.ref(`games/${gameId}`).on('value', snap => {
        const g = snap.val() || { board: ['', '', '', '', '', '', '', '', ''], turn: 'X' };
        for(let i = 0; i < 9; i++) {
            const cell = document.getElementById(`ttt-multi-${i}`);
            if(cell) {
                cell.textContent = g.board[i] || '';
                cell.className = `game-cell ${g.board[i] === 'X' ? 'x' : g.board[i] === 'O' ? 'o' : ''}`;
            }
        }
        const status = document.getElementById('tttMultiStatus');
        if(status) {
            if(g.winner) status.textContent = `🎉 الفائز: ${g.winner}!`;
            else status.textContent = `الدور الحالي: (${g.turn})`;
        }
    });
}

async function makeMultiTTTMove(gameId, index) {
    const snap = await db.ref(`games/${gameId}`).once('value');
    const g = snap.val() || { board: ['', '', '', '', '', '', '', '', ''], turn: 'X' };
    if(g.board[index] || g.winner) return;
    
    g.board[index] = g.turn;
    
    // Check winner
    const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const hasWon = winPatterns.some(p => p.every(i => g.board[i] === g.turn));
    
    if(hasWon) {
        g.winner = `${myName} (${g.turn})`;
        if(typeof addPoints === 'function') addPoints(25);
    } else {
        g.turn = g.turn === 'X' ? 'O' : 'X';
    }
    
    await db.ref(`games/${gameId}`).set(g);
}

function makeTicTacToeMove(index) {
    if(!ticTacToeActive || ticTacToeBoard[index] !== '') return;
    
    ticTacToeBoard[index] = ticTacToeTurn;
    const cell = document.getElementById(`ttt-${index}`);
    if(cell) {
        cell.textContent = ticTacToeTurn;
        cell.className = `game-cell ${ticTacToeTurn === 'X' ? 'x' : 'o'}`;
    }
    
    if(checkTicTacToeWinner()) {
        ticTacToeActive = false;
        const status = document.getElementById('tttStatus');
        if(status) status.textContent = `🎉 فاز اللاعب ${ticTacToeTurn}!`;
        showNotification('🎮 فوز باللعبة!', `اللاعب (${ticTacToeTurn}) حقق الفوز`);
        if(typeof addPoints === 'function') addPoints(10);
        return;
    }
    
    if(ticTacToeBoard.every(c => c !== '')) {
        ticTacToeActive = false;
        const status = document.getElementById('tttStatus');
        if(status) status.textContent = '🤝 تعادل ممتاز بين اللاعبين!';
        return;
    }
    
    ticTacToeTurn = ticTacToeTurn === 'X' ? 'O' : 'X';
    const status = document.getElementById('tttStatus');
    if(status) status.textContent = `الدور: اللاعب (${ticTacToeTurn})`;
}

function checkTicTacToeWinner() {
    const winPatterns = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];
    return winPatterns.some(p => p.every(i => ticTacToeBoard[i] === ticTacToeTurn));
}

function startRockPaperScissors() {
    rpsActive = true;
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4>✊ حجر ورقة مقص</h4>
            <button onclick="sendGameChallenge('rps', 'حجر ورقة مقص')" class="action-btn gold" style="margin:0; width:auto; padding:4px 10px; font-size:11px;">📢 تحدي في الروم</button>
        </div>
        <p style="text-align:center; margin-bottom:12px;">اختر حركتك:</p>
        <div style="display:flex; gap:18px; justify-content:center;">
            <button onclick="playRPS('✊')" style="font-size:36px; background:rgba(255,255,255,0.08); border:none; border-radius:12px; padding:12px 18px; cursor:pointer;">✊</button>
            <button onclick="playRPS('✋')" style="font-size:36px; background:rgba(255,255,255,0.08); border:none; border-radius:12px; padding:12px 18px; cursor:pointer;">✋</button>
            <button onclick="playRPS('✌️')" style="font-size:36px; background:rgba(255,255,255,0.08); border:none; border-radius:12px; padding:12px 18px; cursor:pointer;">✌️</button>
        </div>
        <p id="rpsResult" style="margin-top:14px; text-align:center; font-weight:bold; font-size:15px;"></p>
    `;
}

function playRPS(playerChoice) {
    if(!rpsActive) return;
    const choices = ['✊', '✋', '✌️'];
    const computerChoice = choices[Math.floor(Math.random() * 3)];
    
    let result = '';
    if(playerChoice === computerChoice) {
        result = '🤝 تعادل!';
    } else if(
        (playerChoice === '✊' && computerChoice === '✌️') ||
        (playerChoice === '✋' && computerChoice === '✊') ||
        (playerChoice === '✌️' && computerChoice === '✋')
    ) {
        result = '🎉 فزت بالجولة!';
        showNotification('🎮 فوز!', 'لقد فزت في جولة حجر ورقة مقص!');
        if(typeof addPoints === 'function') addPoints(10);
    } else {
        result = '😢 فاز الكمبيوتر!';
    }
    
    const resEl = document.getElementById('rpsResult');
    if(resEl) resEl.textContent = `أنت: ${playerChoice} | المنافس: ${computerChoice} => ${result}`;
}

// ==================== SCHEDULED MESSAGES & REMINDERS ====================
function loadScheduledMessages() {
    const saved = localStorage.getItem('scheduledMessages');
    if(saved) {
        try {
            scheduledMessages = JSON.parse(saved);
            checkScheduledMessages();
        } catch(e) {}
    }
}

function checkScheduledMessages() {
    const now = Date.now();
    for(let id in scheduledMessages) {
        if(scheduledMessages[id].time <= now) {
            sendScheduledMessage(scheduledMessages[id]);
            delete scheduledMessages[id];
        }
    }
    saveScheduledMessages();
    setTimeout(checkScheduledMessages, 30000);
}

function saveScheduledMessages() {
    localStorage.setItem('scheduledMessages', JSON.stringify(scheduledMessages));
}

function scheduleMessage() {
    const textInp = document.getElementById('scheduleText');
    const timeInp = document.getElementById('scheduleTime');
    const text = textInp ? textInp.value.trim() : '';
    const timeVal = timeInp ? timeInp.value : '';
    
    if(!text || !timeVal) {
        showNotification('❌ خطأ', 'يرجى إدخال نص الرسالة ووقت الإرسال');
        return;
    }
    
    const time = new Date(timeVal).getTime();
    if(time <= Date.now()) {
        showNotification('❌ خطأ', 'يجب تحديد وقت في المستقبل');
        return;
    }
    
    const id = Date.now().toString();
    scheduledMessages[id] = {
        text,
        time,
        chatId: currentChatId,
        key: currentKey,
        sender: myName
    };
    
    saveScheduledMessages();
    closeModal('scheduleModal');
    showNotification('⏰ تمت الجدولة', 'تمت جدولة رسالتك للإرسال في الوقت المحدد');
}

async function sendScheduledMessage(data) {
    const messageObj = {
        sender: data.sender,
        content: data.text,
        type: 'text',
        timestamp: Date.now(),
        scheduled: true
    };
    const enc = await encryptPacket(messageObj, data.key || 'PUBLIC_KEY');
    await db.ref('messages/' + data.chatId).push({
        data: enc,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        sender: data.sender
    });
}

function loadReminders() {
    const saved = localStorage.getItem('reminders');
    if(saved) {
        try {
            reminders = JSON.parse(saved);
            checkReminders();
        } catch(e) {}
    }
}

function checkReminders() {
    const now = Date.now();
    reminders.forEach(reminder => {
        if(reminder.time <= now && !reminder.shown) {
            showNotification('⏰ تذكير مهم', reminder.text);
            reminder.shown = true;
            saveReminders();
        }
    });
    setTimeout(checkReminders, 30000);
}

function saveReminders() {
    localStorage.setItem('reminders', JSON.stringify(reminders));
}

function createReminder() {
    const textInp = document.getElementById('reminderText');
    const timeInp = document.getElementById('reminderTime');
    const text = textInp ? textInp.value.trim() : '';
    const timeVal = timeInp ? timeInp.value : '';
    
    if(!text || !timeVal) {
        showNotification('❌ خطأ', 'يرجى إدخال موضوع التذكير والوقت');
        return;
    }
    
    const time = new Date(timeVal).getTime();
    reminders.push({ text, time, shown: false });
    saveReminders();
    closeModal('reminderModal');
    showNotification('⏰ تم ضبط التذكير', 'سيتم إشعارك عند حلول الموعد');
}

function loadNotes() {
    const saved = localStorage.getItem('notes');
    if(saved) {
        try { notes = JSON.parse(saved); } catch(e) {}
    }
}

function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(notes));
}

function createNote() {
    const input = document.getElementById('noteText');
    const text = input ? input.value.trim() : '';
    if(!text) {
        showNotification('❌ خطأ', 'يرجى كتابة نص الملاحظة');
        return;
    }
    notes.push({ text, timestamp: Date.now() });
    saveNotes();
    closeModal('noteModal');
    showNotification('📝 تم حفظ الملاحظة', 'تم تخزين الملاحظة بنجاح');
    if(input) input.value = '';
}

// ==================== LOCATION SHARING ====================
function shareLocation() {
    if(navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            const messageObj = {
                sender: myName,
                content: JSON.stringify(location),
                type: 'location',
                timestamp: Date.now()
            };
            const enc = await encryptPacket(messageObj, currentKey);
            await db.ref('messages/' + currentChatId).push({
                data: enc,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                sender: myName
            });
            showNotification('📍 تمت المشاركة', 'تمت مشاركة موقعك الجغرافي');
        }, () => {
            showNotification('❌ خطأ', 'تعذر الوصول للموقع الجغرافي');
        });
    }
}

// ==================== YOUTUBE & SPOTIFY ====================
function shareYouTube() {
    const url = prompt('أدخل رابط يوتيوب للمشاركة:');
    if(!url) return;
    const videoId = extractYouTubeId(url);
    if(!videoId) {
        showNotification('❌ خطأ', 'رابط يوتيوب غير صالح');
        return;
    }
    sendMessage(videoId, 'youtube');
}

function extractYouTubeId(url) {
    const patterns = [/youtube\.com\/watch\?v=([^&]+)/, /youtu\.be\/([^?]+)/, /youtube\.com\/embed\/([^?]+)/];
    for(let p of patterns) {
        const m = url.match(p);
        if(m) return m[1];
    }
    return null;
}

function shareSpotify() {
    const url = prompt('أدخل رابط مسار Spotify:');
    if(!url) return;
    const trackId = extractSpotifyId(url);
    if(!trackId) {
        showNotification('❌ خطأ', 'رابط Spotify غير صالح');
        return;
    }
    sendMessage(trackId, 'spotify');
}

function extractSpotifyId(url) {
    const m = url.match(/track\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
}

// ==================== THEME & CUSTOMIZATION ====================
function openThemeEditor() {
    const modal = document.getElementById('themeEditorModal');
    if(modal) modal.classList.remove('hidden');
}

function changeFont(font) {
    document.documentElement.style.setProperty('--current-font', font);
    localStorage.setItem('theme_font', font);
}

function changeFontSize(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
    const label = document.getElementById('fontSizeLabel');
    if(label) label.textContent = size + 'px';
    document.querySelectorAll('.msg').forEach(m => m.style.fontSize = size + 'px');
    localStorage.setItem('theme_fontSize', size);
}

function changeViewMode(mode) {
    document.body.classList.remove('view-compact', 'view-comfortable', 'view-spacious');
    document.body.classList.add('view-' + mode);
    localStorage.setItem('theme_viewMode', mode);
}

function changeBubbleStyle(radius) {
    document.documentElement.style.setProperty('--bubble-radius', radius);
    localStorage.setItem('theme_bubbleRadius', radius);
}

function applyTheme(theme) {
    const themes = {
        'default': { primary: '#00a884', secondary: '#005c4b' },
        'blue': { primary: '#4a90e2', secondary: '#2c3e50' },
        'red': { primary: '#e74c3c', secondary: '#c0392b' },
        'purple': { primary: '#9b59b6', secondary: '#8e44ad' },
        'orange': { primary: '#f39c12', secondary: '#e67e22' },
        'teal': { primary: '#1abc9c', secondary: '#16a085' }
    };
    
    if(themes[theme]) {
        document.documentElement.style.setProperty('--primary', themes[theme].primary);
        document.documentElement.style.setProperty('--secondary', themes[theme].secondary);
        localStorage.setItem('theme_primary', themes[theme].primary);
        localStorage.setItem('theme_secondary', themes[theme].secondary);
    }
}

function loadSavedTheme() {
    const font = localStorage.getItem('theme_font');
    if(font) document.documentElement.style.setProperty('--current-font', font);
    
    const fontSize = localStorage.getItem('theme_fontSize');
    if(fontSize) document.documentElement.style.setProperty('--font-size', fontSize + 'px');
    
    const viewMode = localStorage.getItem('theme_viewMode') || 'comfortable';
    document.body.classList.add('view-' + viewMode);
    
    const bubbleRadius = localStorage.getItem('theme_bubbleRadius');
    if(bubbleRadius) document.documentElement.style.setProperty('--bubble-radius', bubbleRadius);
    
    const primary = localStorage.getItem('theme_primary');
    if(primary) document.documentElement.style.setProperty('--primary', primary);
    
    const secondary = localStorage.getItem('theme_secondary');
    if(secondary) document.documentElement.style.setProperty('--secondary', secondary);
}

function toggleInvisibleMode() {
    const chk = document.getElementById('invisibleMode');
    isInvisibleMode = chk ? chk.checked : false;
    if(isInvisibleMode) {
        db.ref(`users/${myName}/online`).set(false);
        showNotification('👻 وضع التخفي', 'أنت الآن مخفي عن بقية المستخدمين');
    } else {
        db.ref(`users/${myName}/online`).set(true);
        showNotification('👁️ وضع الظهور', 'أنت الآن متصل وظاهر للجميع');
    }
}

function toggleReadReceipts() {
    const chk = document.getElementById('readReceipts');
    readReceiptsEnabled = chk ? chk.checked : true;
    showNotification(readReceiptsEnabled ? '✅ تم التفعيل' : '❌ تم الإيقاف', 'حالة قراءة الرسائل');
}

// ==================== ROOM SETTINGS ====================
function showRoomSettings() {
    const prev = document.getElementById('groupAvatarPreview');
    if(prev) prev.style.display = 'none';
    tempGroupAvatar = null;
    const modal = document.getElementById('roomSettingsModal');
    if(modal) modal.classList.remove('hidden');
    
    db.ref(`rooms/${currentChatId}`).once('value', s => {
        const d = s.val();
        const adminCtrl = document.getElementById('roomAdminControls');
        const notAdmin = document.getElementById('roomNotAdminMsg');
        const hasRights = isAdmin || (isDeputyAdmin && (deputyPermissions.banMembers || deputyPermissions.muteMembers || deputyPermissions.clearChat)) || (d && d.admins && d.admins[myName]);
        
        if(hasRights) {
            if(adminCtrl) adminCtrl.classList.remove('hidden');
            if(notAdmin) notAdmin.classList.add('hidden');
            loadRoomMembers(); 
            loadBannedMembers();
        } else {
            if(adminCtrl) adminCtrl.classList.add('hidden');
            if(notAdmin) notAdmin.classList.remove('hidden');
        }
    });
}

async function loadRoomMembers() {
    const list = document.getElementById('roomMembersList');
    if(!list) return;
    list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">جاري جلب الأعضاء...</p>';
    
    const snap = await db.ref(`messages/${currentChatId}`).once('value');
    const msgs = snap.val() || {};
    const membersSet = new Set();
    for(let key in msgs) {
        if(!msgs[key].deleted && msgs[key].data) {
            try {
                const packet = await decryptPacket(msgs[key].data, currentKey);
                if(packet && packet.sender) membersSet.add(packet.sender);
            } catch(e) {}
        }
    }
    const members = Array.from(membersSet);
    if(members.length === 0) { 
        list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">لا يوجد أعضاء متفاعلون بعد</p>'; 
        return; 
    }
    list.innerHTML = '';
    for(let member of members) {
        const mutedSnap = await db.ref(`rooms/${currentChatId}/muted/${member}`).once('value');
        const isMuted = mutedSnap.val() || false;
        const roomSnap = await db.ref(`rooms/${currentChatId}/admins/${member}`).once('value');
        const isRoomAdmin = roomSnap.val() || false;
        
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
            <span>${member} ${isRoomAdmin ? '<span class="badge admin">👑 مشرف</span>' : ''} ${isMuted ? '<span class="badge muted">🔇 مكتوم</span>' : ''}</span>
            <div style="display:flex; gap:4px;">
                <button onclick="muteMember('${member}')" class="action-btn warning" style="padding:4px 8px; margin:0; width:auto; font-size:11px;">${isMuted ? '🔊 إلغاء كتم' : '🔇 كتم'}</button>
                <button onclick="tempBanMember('${member}')" class="action-btn warning" style="padding:4px 8px; margin:0; width:auto; font-size:11px;">⏰ 24س</button>
                <button onclick="permaBanMember('${member}')" class="action-btn danger" style="padding:4px 8px; margin:0; width:auto; font-size:11px;">🚫 حظر دائم</button>
            </div>`;
        list.appendChild(div);
    }
}

async function loadBannedMembers() {
    const list = document.getElementById('bannedMembersList');
    if(!list) return;
    const snap = await db.ref(`system/bans/${currentChatId}`).once('value');
    const bans = snap.val() || {};
    const entries = Object.entries(bans);
    if(entries.length === 0) { 
        list.innerHTML = '<p style="color:var(--text-gray); text-align:center;">لا يوجد أعضاء محظورون</p>'; 
        return; 
    }
    list.innerHTML = '';
    for(let [member, banData] of entries) {
        let status = '';
        if(banData.permanent) status = '<span class="badge banned">🚫 دائم</span>';
        else if(banData.until) {
            const rem = Math.ceil((banData.until - Date.now()) / (1000 * 60 * 60));
            status = `<span class="badge muted">⏰ ${rem > 0 ? rem + 'ساعة' : 'منتهي'}</span>`;
        }
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `<span>${member} ${status}</span><button onclick="unbanMember('${member}')" class="action-btn" style="padding:4px 8px; margin:0; width:auto; font-size:11px; background:var(--primary);">✅ فك الحظر</button>`;
        list.appendChild(div);
    }
}

async function muteMember(member) {
    const ref = db.ref(`rooms/${currentChatId}/muted/${member}`);
    const snap = await ref.once('value');
    if(snap.val()) await ref.remove();
    else await ref.set(true);
    loadRoomMembers();
}

async function tempBanMember(member) {
    if(!confirm(`⚠️ هل تريد حظر ${member} لمدة 24 ساعة؟`)) return;
    await db.ref(`system/bans/${currentChatId}/${member}`).set({
        until: Date.now() + (24 * 60 * 60 * 1000), 
        roomName: currentRoomType, 
        bannedBy: myName, 
        timestamp: Date.now()
    });
    showNotification('✅ تم الحظر', `تم حظر ${member} لمدة 24 ساعة`);
    loadRoomMembers(); 
    loadBannedMembers();
}

async function permaBanMember(member) {
    if(!confirm(`⚠️ هل تريد حظر ${member} بشكل دائم من هذه المجموعة؟`)) return;
    await db.ref(`system/bans/${currentChatId}/${member}`).set({
        permanent: true, 
        roomName: currentRoomType, 
        bannedBy: myName, 
        timestamp: Date.now()
    });
    showNotification('✅ تم الحظر', `تم حظر ${member} بشكل دائم`);
    loadRoomMembers(); 
    loadBannedMembers();
}

async function unbanMember(member) {
    await db.ref(`system/bans/${currentChatId}/${member}`).remove();
    showNotification('✅ تم فك الحظر', `تم إلغاء حظر ${member}`);
    loadBannedMembers();
}

async function updateGroupAvatar() {
    if(!tempGroupAvatar) { 
        showNotification('❌ خطأ', 'الرجاء اختيار صورة أولاً'); 
        return; 
    }
    await db.ref(`rooms/${currentChatId}/avatar`).set(tempGroupAvatar);
    const avatar = document.getElementById('headerChatAvatar');
    const def = document.getElementById('headerChatDefault');
    if(avatar && def) {
        avatar.src = tempGroupAvatar;
        avatar.style.display = 'block';
        def.style.display = 'none';
    }
    showNotification('✅ تم الحفظ', 'تم تحديث صورة المجموعة بنجاح');
    tempGroupAvatar = null;
    const prev = document.getElementById('groupAvatarPreview');
    if(prev) prev.style.display = 'none';
}

async function clearGroupChat() {
    if(confirm('⚠️ هل أنت متأكد من تنظيف ومسح جميع رسائل هذه المجموعة؟')) {
        await db.ref(`messages/${currentChatId}`).remove();
        const container = document.getElementById('messagesContainer');
        if(container) container.innerHTML = '';
        closeModal('roomSettingsModal');
        showNotification('✅ تم التنظيف', 'تم مسح محتوى المحادثة بالكامل');
    }
}

async function updateRoomPassword() {
    const input = document.getElementById('changeRoomPass');
    const np = input ? input.value : '';
    if(!np) { 
        showNotification('❌ خطأ', 'يرجى إدخال كلمة سر جديدة'); 
        return; 
    }
    await db.ref(`rooms/${currentChatId}/password`).set(np);
    showNotification('✅ تم التغيير', 'تم تغيير كلمة سر المجموعة بنجاح');
    closeModal('roomSettingsModal');
}

// ==================== ADMIN & DEPUTY ADMIN PANEL ====================
function switchAdminTab(tab) {
    currentAdminTab = tab;
    document.querySelectorAll('#adminModal .tab').forEach(el => el.classList.remove('active'));
    if(event && event.target) event.target.classList.add('active');
    
    const general = document.getElementById('adminTabGeneral');
    const users = document.getElementById('adminTabUsers');
    const deputies = document.getElementById('adminTabDeputies');
    const bans = document.getElementById('adminTabBans');
    const stats = document.getElementById('adminTabStats');
    const ai = document.getElementById('adminTabAI');
    
    if(general) general.classList.toggle('hidden', tab !== 'general');
    if(users) users.classList.toggle('hidden', tab !== 'users');
    if(deputies) deputies.classList.toggle('hidden', tab !== 'deputies');
    if(bans) bans.classList.toggle('hidden', tab !== 'bans');
    if(stats) stats.classList.toggle('hidden', tab !== 'stats');
    if(ai) ai.classList.toggle('hidden', tab !== 'ai');
    
    if(tab === 'users') loadAllUsers();
    if(tab === 'deputies') loadDeputyAdmins();
    if(tab === 'bans') loadGlobalBans();
    if(tab === 'stats') {
        loadStats();
        if(typeof renderActivityChart === 'function') renderActivityChart();
        if(typeof renderHeatMap === 'function') renderHeatMap();
    }
}

async function openAdminPanel() {
    const modal = document.getElementById('adminModal');
    if(modal) modal.classList.remove('hidden');
    
    // Hide Owner-exclusive features if user is Deputy Admin
    const ownerOnlySection = document.getElementById('ownerOnlySection');
    const deputyTabBtn = document.getElementById('tabAdminDeputiesBtn');
    
    if(isDeputyAdmin && !isAdmin) {
        if(ownerOnlySection) ownerOnlySection.classList.add('hidden');
        if(deputyTabBtn) deputyTabBtn.classList.add('hidden');
    } else {
        if(ownerOnlySection) ownerOnlySection.classList.remove('hidden');
        if(deputyTabBtn) deputyTabBtn.classList.remove('hidden');
    }
    
    loadAllUsers();
    loadStats();
}

async function loadAllUsers() {
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const uList = document.getElementById('allUsersList');
    if(uList) {
        uList.innerHTML = Object.keys(users).map(u => 
            `<div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
                <span>👤 <b>${u}</b> ${users[u].online ? '🟢 متصل' : '⚫ غير متصل'}</span>
                <div style="display:flex; gap:4px;">
                    <button onclick="banUserGlobally('${u}')" style="background:var(--warning-orange); color:#000; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px; font-weight:bold;">🚫 حظر عام</button>
                    ${isAdmin ? `<button onclick="deleteUser('${u}')" style="background:var(--delete-red); color:white; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px;">🗑️ حذف</button>` : ''}
                </div>
            </div>`).join('');
    }
    
    const roomsSnap = await db.ref('rooms').once('value');
    const rooms = roomsSnap.val() || {};
    const rList = document.getElementById('allRoomsList');
    if(rList) {
        rList.innerHTML = Object.entries(rooms).map(([k,v]) => 
            `<div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
                <span>👥 <b>${v.name}</b> (${v.type}) - ${v.creator}</span>
                ${isAdmin ? `<button onclick="deleteRoom('${k}')" style="background:var(--delete-red); color:white; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px;">🗑️ حذف</button>` : ''}
            </div>`).join('');
    }
}

// ==================== DEPUTY ADMIN / ASSISTANT ADMIN ENGINE ====================
async function loadDeputyAdmins() {
    const list = document.getElementById('deputiesList');
    const select = document.getElementById('newDeputyUserSelect');
    if(!list) return;
    
    const depSnap = await db.ref('system/deputy_admins').once('value');
    const deputies = depSnap.val() || {};
    
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    
    // Fill User Select
    if(select) {
        select.innerHTML = '<option value="">-- اختر مستخدماً لتعيينه نائباً --</option>' + 
            Object.keys(users).filter(u => u !== 'OWNER' && !deputies[u]).map(u => `<option value="${u}">👤 ${u}</option>`).join('');
    }
    
    const entries = Object.entries(deputies);
    if(entries.length === 0) {
        list.innerHTML = '<p style="color:var(--text-gray); text-align:center; padding:10px;">لا يوجد نواب مشرفين معينين حالياً</p>';
        return;
    }
    
    list.innerHTML = entries.map(([username, data]) => {
        const perms = data.permissions || {};
        const permTags = [];
        if(perms.muteMembers) permTags.push('🔇 كتم');
        if(perms.banMembers) permTags.push('🚫 حظر');
        if(perms.pinMessages) permTags.push('📌 تثبيت');
        if(perms.clearChat) permTags.push('🧹 تنظيف');
        if(perms.approveRegistrations) permTags.push('👥 قبول طلبات');
        if(perms.postAnnouncements) permTags.push('📢 إعلانات');
        if(perms.viewStats) permTags.push('📊 إحصائيات');
        
        return `
            <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); padding:12px; border-radius:10px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:var(--admin-gold); font-size:14px;">👑 نائب أدمن: ${username}</span>
                    <button onclick="removeDeputyAdmin('${username}')" style="background:var(--delete-red); color:white; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:11px;">❌ سحب الصلاحيات</button>
                </div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">
                    ${permTags.map(t => `<span class="badge" style="background:rgba(0,168,132,0.2); color:var(--primary);">${t}</span>`).join('') || '<span style="font-size:11px; color:var(--text-gray);">بدون صلاحيات إضافية</span>'}
                </div>
            </div>`;
    }).join('');
}

async function addDeputyAdmin() {
    if(!isAdmin) {
        showNotification('❌ غير مصرح', 'فقط المشرف العام يمكنه تعيين النواب وتعديل صلاحياتهم');
        return;
    }
    const select = document.getElementById('newDeputyUserSelect');
    const user = select ? select.value : '';
    if(!user) {
        showNotification('❌ خطأ', 'يرجى اختيار مستخدم من القائمة');
        return;
    }
    
    const permissions = {
        muteMembers: document.getElementById('permMute')?.checked || false,
        banMembers: document.getElementById('permBan')?.checked || false,
        pinMessages: document.getElementById('permPin')?.checked || false,
        clearChat: document.getElementById('permClear')?.checked || false,
        approveRegistrations: document.getElementById('permApprove')?.checked || false,
        postAnnouncements: document.getElementById('permAnnounce')?.checked || false,
        viewStats: document.getElementById('permStats')?.checked || false
    };
    
    await db.ref(`system/deputy_admins/${user}`).set({
        assignedBy: myName,
        assignedAt: Date.now(),
        permissions: permissions
    });
    
    showNotification('👑 تم تعيين النائب', `تم تعيين ${user} كمساعد أدمن مع الصلاحيات المحددة`);
    loadDeputyAdmins();
}

async function removeDeputyAdmin(username) {
    if(!isAdmin) {
        showNotification('❌ غير مصرح', 'فقط المشرف العام يمكنه سحب صلاحيات النواب');
        return;
    }
    if(!confirm(`⚠️ سحب صلاحيات الإدارة والنائب من ${username}؟`)) return;
    await db.ref(`system/deputy_admins/${username}`).remove();
    showNotification('✅ تم سحب الصلاحيات', `تمت استعادة الصلاحيات العادية للمستخدم ${username}`);
    loadDeputyAdmins();
}

// ==================== GLOBAL BAN & KICK SYSTEM ====================
async function banUserGlobally(username) {
    if(!confirm(`🚫 هل أنت متأكد من حظر المستخدم ${username} طرده من التطبيق بالكامل؟`)) return;
    await db.ref(`system/banned_users/${username}`).set({
        bannedBy: myName,
        bannedAt: Date.now()
    });
    
    // Also fetch and ban their device and IP
    const userSnap = await db.ref(`users/${username}`).once('value');
    if(userSnap.exists()) {
        const u = userSnap.val();
        if(u.deviceId) await db.ref(`system/banned_devices/${u.deviceId}`).set(username);
        if(u.fingerprintHash) await db.ref(`system/banned_devices/${u.fingerprintHash}`).set(username);
        if(u.lastIp) {
            const safeIp = (u.lastIp || '').replace(/[.#$\[\]\/]/g, '_');
            await db.ref(`system/banned_ips/${safeIp}`).set(username);
        }
    }
    
    showNotification('🚫 تم الحظر العام', `تم حظر ${username} وطرده من التطبيق`);
    loadAllUsers();
    loadGlobalBans();
}

async function unbanUserGlobally(username) {
    await db.ref(`system/banned_users/${username}`).remove();
    const userSnap = await db.ref(`users/${username}`).once('value');
    if(userSnap.exists()) {
        const u = userSnap.val();
        if(u.deviceId) await db.ref(`system/banned_devices/${u.deviceId}`).remove();
        if(u.fingerprintHash) await db.ref(`system/banned_devices/${u.fingerprintHash}`).remove();
        if(u.lastIp) {
            const safeIp = (u.lastIp || '').replace(/[.#$\[\]\/]/g, '_');
            await db.ref(`system/banned_ips/${safeIp}`).remove();
        }
    }
    showNotification('✅ تم فك الحظر', `تم فك الحظر عن ${username} والسماح له بالدخول`);
    loadGlobalBans();
}

async function loadGlobalBans() {
    const list = document.getElementById('globalBansList');
    if(!list) return;
    const snap = await db.ref('system/banned_users').once('value');
    const bans = snap.val() || {};
    const entries = Object.entries(bans);
    if(entries.length === 0) {
        list.innerHTML = '<p style="color:var(--text-gray); text-align:center; padding:10px;">لا يوجد مستخدمون محظورون عاماً</p>';
        return;
    }
    list.innerHTML = entries.map(([u, d]) => `
        <div style="padding:8px; border-bottom:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-between; align-items:center;">
            <span>🚫 <b>${u}</b> (محظور)</span>
            <button onclick="unbanUserGlobally('${u}')" style="background:var(--primary); color:white; border:none; padding:4px 10px; border-radius:6px; cursor:pointer; font-size:12px;">✅ فك الحظر والسماح</button>
        </div>
    `).join('');
}

async function loadStats() {
    const container = document.getElementById('statsContainer');
    if(!container) return;
    const usersSnap = await db.ref('users').once('value');
    const roomsSnap = await db.ref('rooms').once('value');
    const messagesSnap = await db.ref('messages').once('value');
    
    const userCount = Object.keys(usersSnap.val() || {}).length;
    const roomCount = Object.keys(roomsSnap.val() || {}).length;
    const messages = messagesSnap.val() || {};
    let msgCount = 0;
    Object.values(messages).forEach(room => { msgCount += Object.keys(room).length; });
    
    container.innerHTML = `
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px;">
            <div style="padding:12px; background:rgba(255,255,255,0.06); border-radius:12px; text-align:center;">
                <div style="font-size:24px; font-weight:bold; color:var(--primary);">${userCount}</div>
                <div style="color:var(--text-gray); font-size:11px;">المستخدمين</div>
            </div>
            <div style="padding:12px; background:rgba(255,255,255,0.06); border-radius:12px; text-align:center;">
                <div style="font-size:24px; font-weight:bold; color:var(--admin-gold);">${roomCount}</div>
                <div style="color:var(--text-gray); font-size:11px;">المجموعات</div>
            </div>
            <div style="padding:12px; background:rgba(255,255,255,0.06); border-radius:12px; text-align:center;">
                <div style="font-size:24px; font-weight:bold; color:#4a90e2;">${msgCount}</div>
                <div style="color:var(--text-gray); font-size:11px;">الرسائل</div>
            </div>
        </div>
    `;
}

async function deleteUser(user) {
    if(!isAdmin) return;
    if(!confirm(`⚠️ هل أنت متأكد من حذف المستخدم ${user}؟`)) return;
    await db.ref(`users/${user}`).remove();
    loadAllUsers();
    showNotification('✅ تم الحذف', `تم حذف حساب ${user}`);
}

async function deleteRoom(roomId) {
    if(!isAdmin) return;
    if(!confirm('⚠️ هل أنت متأكد من حذف هذه المجموعة؟')) return;
    await db.ref(`rooms/${roomId}`).remove();
    await db.ref(`messages/${roomId}`).remove();
    loadAllUsers();
    showNotification('✅ تم الحذف', 'تم حذف المجموعة');
}

async function updateGlobalBgFromFile() {
    if(!tempBgImage) { 
        showNotification('❌ خطأ', 'الرجاء اختيار صورة أولاً'); 
        return; 
    }
    await db.ref('system/settings/bg').set(tempBgImage);
    const bg = document.getElementById('globalBg');
    if(bg) bg.style.backgroundImage = `url(${tempBgImage})`;
    showNotification('✅ تم الحفظ', 'تم تحديث خلفية التطبيق العامة للجميع');
    tempBgImage = null;
    const prev = document.getElementById('bgPreview');
    if(prev) prev.style.display = 'none';
}

async function updateAdminCreds() {
    if(!isAdmin) return;
    const userInp = document.getElementById('adminNewUser');
    const passInp = document.getElementById('adminNewPass');
    const u = userInp ? userInp.value.trim() : '';
    const p = passInp ? passInp.value : '';
    if(u && p) { 
        await db.ref('system/admin').set({ user: u, pass: p }); 
        showNotification('✅ تم التحديث', 'تم تحديث بيانات المشرف بنجاح');
        if(userInp) userInp.value = '';
        if(passInp) passInp.value = '';
    } else {
        showNotification('❌ خطأ', 'يرجى إدخال اسم المستخدم وكلمة السر');
    }
}

async function updateTicker() {
    const input = document.getElementById('adminTickerInput');
    const tickerText = input ? input.value : '';
    await db.ref('system/settings/ticker').set(tickerText);
    showNotification('✅ تم النشر', 'تم تحديث ونشر الشريط الإعلاني');
    if(input) input.value = '';
}

function backupData() {
    if(!isAdmin) return;
    db.ref('/').once('value', s => {
        const a = document.createElement('a');
        a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(s.val()));
        a.download = 'chat_backup_' + new Date().toISOString() + '.json';
        a.click();
        showNotification('✅ تم النسخ', 'تم إنشاء وتنزيل النسخة الاحتياطية');
    });
}

async function deleteAllData() {
    if(!isAdmin) return;
    if(!confirm('⚠️⚠️ تحذير فائق الخطورة: هل أنت متأكد من حذف كافة البيانات؟')) return;
    if(!confirm('⚠️ تأكيد نهائي: سيتم محو المستخدمين والرسائل والغرف بشكل لا رجعة فيه!')) return;
    
    await db.ref('messages').remove();
    await db.ref('rooms').remove();
    await db.ref('users').remove();
    await db.ref('stories').remove();
    await db.ref('typing').remove();
    await db.ref('system/settings').remove();
    
    showNotification('✅ تم التطهير', 'تم حذف كافة البيانات بنجاح');
    setTimeout(() => location.reload(), 1500);
}

// ==================== PROFILE ====================
function openProfileSettings() {
    tempProfileAvatar = null;
    const prev = document.getElementById('profileAvatarPreview');
    if(prev) prev.style.display = 'none';
    const modal = document.getElementById('profileModal');
    if(modal) modal.classList.remove('hidden');
    
    const inv = document.getElementById('invisibleMode');
    const read = document.getElementById('readReceipts');
    if(inv) inv.checked = isInvisibleMode;
    if(read) read.checked = readReceiptsEnabled;
}

async function updateProfileAvatar() {
    if(!tempProfileAvatar) { 
        showNotification('❌ خطأ', 'الرجاء اختيار صورة أولاً'); 
        return; 
    }
    await db.ref(`users/${myName}/avatar`).set(tempProfileAvatar);
    const img = document.getElementById('myAvatarImg');
    const def = document.getElementById('myDefaultAvatar');
    if(img && def) {
        img.src = tempProfileAvatar;
        img.style.display = 'block';
        def.style.display = 'none';
    }
    showNotification('✅ تم الحفظ', 'تم تحديث صورتك الشخصية بنجاح');
    tempProfileAvatar = null;
    const prev = document.getElementById('profileAvatarPreview');
    if(prev) prev.style.display = 'none';
}

async function updateProfileStatus() {
    const input = document.getElementById('profileStatusText');
    const text = input ? input.value.trim() : '';
    if(!text) { 
        showNotification('❌ خطأ', 'يرجى كتابة نص الحالة أولاً'); 
        return; 
    }
    await db.ref(`users/${myName}/status`).set(text);
    await db.ref('stories').push({ sender: myName, text, timestamp: Date.now() });
    showNotification('✅ تم النشر', 'تم تحديث حالتك ونشرها للجميع');
    if(input) input.value = '';
    closeModal('profileModal');
}

// ==================== UTILS ====================
function switchTab(t) {
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const activeTab = document.getElementById('tab-' + t);
    if(activeTab) activeTab.classList.add('active');
    
    const rList = document.getElementById('roomsList');
    const uList = document.getElementById('usersList');
    const sRes = document.getElementById('searchResults');
    const sInp = document.getElementById('searchInput');
    
    if(rList) rList.classList.toggle('hidden', t !== 'rooms');
    if(uList) uList.classList.toggle('hidden', t !== 'users');
    if(sRes) sRes.classList.add('hidden');
    if(sInp) sInp.value = '';
}

function closeModal(id) { 
    const el = document.getElementById(id);
    if(el) el.classList.add('hidden'); 
}

function showCreateRoom() { 
    const modal = document.getElementById('createRoomModal');
    if(modal) modal.classList.remove('hidden'); 
}

function closeChatMobile() { 
    document.body.classList.remove('chat-active'); 
    currentChatId = null; 
    cancelReply(); 
}

async function createRoom() {
    const nameInp = document.getElementById('newRoomName');
    const typeSelect = document.getElementById('roomType');
    const passInp = document.getElementById('newRoomPass');
    
    const name = nameInp ? nameInp.value.trim() : '';
    const type = typeSelect ? typeSelect.value : 'public';
    const pass = passInp ? passInp.value : '';
    
    if(!name) {
        showNotification('❌ خطأ', 'يرجى كتابة اسم المجموعة');
        return;
    }
    
    const ref = db.ref('rooms').push();
    await ref.set({ 
        name, 
        type, 
        password: type === 'public' ? 'PUBLIC_KEY' : pass, 
        creator: myName, 
        admins: { [myName]: true }, 
        createdAt: Date.now(), 
        avatar: '' 
    });
    
    closeModal('createRoomModal');
    if(nameInp) nameInp.value = '';
    if(passInp) passInp.value = '';
    showNotification('✅ تم الإنشاء', `تم إنشاء مجموعة ${name} بنجاح`);
}

// ==================== APP INITIALIZATION WITH AUTO-LOGIN RESTORE ====================
async function init() {
    // 1. Check & Create OWNER account if not present (Never delete old data)
    try {
        const adminSnap = await db.ref('system/admin').once('value');
        if(!adminSnap.exists()) {
            await db.ref('system/admin').set({
                user: 'OWNER',
                pass: 'Owner@2024'
            });
        }
    } catch(e) {
        console.error('Admin setup check:', e);
    }
    
    setTimeout(() => {
        const loading = document.getElementById('loadingScreen');
        if(loading) loading.style.display = 'none';
    }, 1200);
    
    // 2. Auto-restore session from localStorage if present
    const savedUser = localStorage.getItem('chatUser');
    const savedPass = localStorage.getItem('chatUserPass');
    
    if(savedUser) {
        myName = savedUser;
        const userInp = document.getElementById('usernameInput');
        const passInp = document.getElementById('passwordInput');
        if(userInp) userInp.value = savedUser;
        if(passInp && savedPass) passInp.value = savedPass;
        
        // Auto-login if regular user or owner session saved
        if(savedPass) {
            try {
                const userSnap = await db.ref(`users/${savedUser}`).once('value');
                const adminSnap = await db.ref('system/admin').once('value');
                const adminData = adminSnap.val() || { user: 'OWNER' };
                
                if(savedUser === adminData.user) {
                    // Owner auto-reconnect
                    isAdmin = true;
                    finishLogin();
                } else if(userSnap.exists()) {
                    finishLogin();
                }
            } catch(e) {
                console.log('Session auto-restore error', e);
            }
        }
    }
}

init();
