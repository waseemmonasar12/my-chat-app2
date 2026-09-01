// ==================== ALL REMAINING FEATURES - CHAT SECURE V6 ====================

// ==================== 1. AI - SPEECH TO TEXT & TEXT TO SPEECH ====================
let speechRecognition = null;
let isListening = false;

function initSpeechRecognition() {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SpeechRecognitionClass) {
        try {
            speechRecognition = new SpeechRecognitionClass();
            speechRecognition.lang = 'ar-SA';
            speechRecognition.continuous = false;
            speechRecognition.interimResults = false;
            
            speechRecognition.onresult = (event) => {
                const text = event.results[0][0].transcript;
                const msgInput = document.getElementById('msgInput');
                if(msgInput) {
                    msgInput.value = text;
                    msgInput.focus();
                }
                showNotification('🎤 تم التعرف على الصوت', text);
            };
            
            speechRecognition.onerror = () => {
                isListening = false;
            };
            speechRecognition.onend = () => {
                isListening = false;
            };
        } catch(e) {
            console.log('Speech recognition init error', e);
        }
    }
}

function startSpeechToText() {
    if(!speechRecognition) {
        initSpeechRecognition();
    }
    if(!speechRecognition) {
        showNotification('❌ غير مدعوم', 'المتصفح لا يدعم تحويل الصوت لنص');
        return;
    }
    try {
        speechRecognition.start();
        isListening = true;
        showNotification('🎤 تحدث الآن', 'جاري الاستماع لصوتك باللغة العربية...');
    } catch(e) {
        showNotification('⚠️ تنبيه', 'جاري الاستماع بالفعل');
    }
}

function textToSpeech(text) {
    if('speechSynthesis' in window && text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// ==================== 1. AI - CONTEXTUAL EMOJI SUGGESTION ====================
function suggestEmojiByContext(text) {
    if(!text) return null;
    const emojiMap = {
        'حب': '❤️', 'سعيد': '😊', 'حزين': '😢', 'غاضب': '😡',
        'ضحك': '😂', 'جميل': '✨', 'رائع': '🌟', 'ممتاز': '👏',
        'اكل': '🍕', 'شرب': '☕', 'نوم': '😴', 'عمل': '💼',
        'دراسة': '📚', 'رياضة': '⚽', 'موسيقى': '🎵', 'سفر': '✈️',
        'بيت': '🏠', 'سيارة': '🚗', 'هاتف': '📱', 'كمبيوتر': '💻',
        'مطر': '🌧️', 'شمس': '☀️', 'قمر': '🌙', 'نجوم': '⭐',
        'بحر': '🌊', 'جبل': '⛰️', 'وردة': '🌸', 'شجرة': '🌳'
    };
    
    for(let key in emojiMap) {
        if(text.includes(key)) return emojiMap[key];
    }
    return null;
}

// ==================== 1. AI - SMART MESSAGE FILTER ====================
function smartFilterMessages(messages) {
    const spamKeywords = ['اربح معنا', 'جائزة كبرى', 'اضغط هنا فورا', 'ربح سريع'];
    return messages.filter(msg => {
        if(msg.type !== 'text') return true;
        const content = (msg.content || '').toLowerCase();
        return !spamKeywords.some(k => content.includes(k));
    });
}

// ==================== 1. AI - PREDICT NEXT REPLY ====================
function predictNextReply(text) {
    if(!text) return null;
    const predictions = {
        'كيف حالك': ['أنا بخير والحمد لله وأنت؟', 'تمام التمام يا غالي', 'بأفضل حال يسعدك'],
        'ماذا تفعل': ['أتصفح المحادثات', 'أعمل على بعض المهام', 'أستمتع بوقتي'],
        'أين أنت': ['في البيت حالياً', 'في العمل والمهام', 'في الطريق قريباً'],
        'متى تأتي': ['خلال نصف ساعة', 'قريباً جداً إن شاء الله', 'في الموعد تماماً']
    };
    
    for(let key in predictions) {
        if(text.includes(key)) {
            const arr = predictions[key];
            return arr[Math.floor(Math.random() * arr.length)];
        }
    }
    return null;
}

// ==================== 2. VIDEO BACKGROUNDS ====================
let videoBackgroundActive = false;

function applyVideoBackground(videoUrl) {
    const bgContainer = document.getElementById('globalBg');
    if(!bgContainer) return;
    bgContainer.innerHTML = `<video autoplay muted loop style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"><source src="${videoUrl}" type="video/mp4"></video>`;
    videoBackgroundActive = true;
    db.ref('system/settings/videoBg').set(videoUrl);
    showNotification('🎥 خلفية متحركة', 'تم تفعيل الفيديو كخلفية للتطبيق');
}

function removeVideoBackground() {
    const bgContainer = document.getElementById('globalBg');
    if(bgContainer) bgContainer.innerHTML = '';
    videoBackgroundActive = false;
    db.ref('system/settings/videoBg').remove();
}

// ==================== 2. NOTIFICATION SOUNDS ====================
const notificationSoundsLibrary = {
    'default': null,
    'bell': 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
    'chime': 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3',
    'pop': 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'
};

let currentNotificationSound = localStorage.getItem('notificationSound') || 'default';

function setNotificationSound(soundName) {
    currentNotificationSound = soundName;
    localStorage.setItem('notificationSound', soundName);
    playNotificationSound();
}

function playNotificationSound() {
    if(currentNotificationSound !== 'default' && notificationSoundsLibrary[currentNotificationSound]) {
        try {
            const audio = new Audio(notificationSoundsLibrary[currentNotificationSound]);
            audio.play().catch(() => {});
        } catch(e) {}
    }
}

// ==================== 2. READING MODE ====================
function toggleReadingMode() {
    const isReadingMode = document.body.classList.toggle('reading-mode');
    localStorage.setItem('readingMode', isReadingMode);
    
    if(isReadingMode) {
        document.documentElement.style.setProperty('--msg-me-glass', 'rgba(0, 92, 75, 0.22)');
        document.documentElement.style.setProperty('--msg-other-glass', 'rgba(32, 44, 51, 0.22)');
        showNotification('📖 وضع القراءة المريح', 'تم تفعيل وضع القراءة لراحة العين');
    } else {
        document.documentElement.style.setProperty('--msg-me-glass', 'rgba(0, 92, 75, 0.15)');
        document.documentElement.style.setProperty('--msg-other-glass', 'rgba(32, 44, 51, 0.15)');
        showNotification('📖 وضع القراءة', 'تم إيقاف وضع القراءة');
    }
}

// ==================== 3. ADVANCED ACTIVITY ANALYTICS & CHART.JS ====================
let activityChartInstance = null;

async function analyzeUserActivityDetailed() {
    const messagesSnap = await db.ref('messages').once('value');
    const messages = messagesSnap.val() || {};
    const activityByHour = Array(24).fill(0);
    const activityByDay = Array(7).fill(0);
    const userActivity = {};
    
    for(let roomId in messages) {
        for(let msgId in messages[roomId]) {
            const msg = messages[roomId][msgId];
            if(msg.timestamp) {
                const date = new Date(msg.timestamp);
                activityByHour[date.getHours()]++;
                activityByDay[date.getDay()]++;
            }
            if(msg.sender) {
                userActivity[msg.sender] = (userActivity[msg.sender] || 0) + 1;
            }
        }
    }
    
    return { activityByHour, activityByDay, userActivity };
}

function renderActivityChart() {
    analyzeUserActivityDetailed().then(data => {
        const canvas = document.getElementById('activityChart');
        if(!canvas || typeof Chart === 'undefined') return;
        
        if(activityChartInstance) {
            activityChartInstance.destroy();
        }
        
        activityChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'الرسائل حسب ساعات اليوم',
                    data: data.activityByHour,
                    borderColor: '#00a884',
                    backgroundColor: 'rgba(0, 168, 132, 0.25)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e9edef', font: { family: 'Cairo' } }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#8696a0', font: { size: 10 } },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        ticks: { color: '#8696a0' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        beginAtZero: true
                    }
                }
            }
        });
    });
}

function renderHeatMap() {
    analyzeUserActivityDetailed().then(data => {
        const container = document.getElementById('heatMapContainer');
        if(!container) return;
        
        const maxActivity = Math.max(...data.activityByDay, 1);
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        
        container.innerHTML = '<h5 style="margin-bottom:8px; color:var(--text-gray);">نشاط الأيام:</h5>' + days.map((day, index) => {
            const intensity = maxActivity > 0 ? (data.activityByDay[index] / maxActivity) : 0;
            const color = `rgba(0, 168, 132, ${0.15 + intensity * 0.75})`;
            return `<div style="background:${color}; padding:8px 12px; border-radius:8px; margin:4px 0; display:flex; justify-content:space-between; font-size:12px; font-weight:bold;">
                <span>📅 ${day}</span>
                <span>${data.activityByDay[index]} رسالة</span>
            </div>`;
        }).join('');
    });
}

// ==================== 3. WEEKLY REPORT GENERATION ====================
function generateWeeklyReport() {
    analyzeUserActivityDetailed().then(data => {
        const totalMessages = data.activityByHour.reduce((a,b) => a+b, 0);
        const maxHour = Math.max(...data.activityByHour);
        const mostActiveHour = maxHour > 0 ? data.activityByHour.indexOf(maxHour) : 12;
        const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        const mostActiveDay = days[data.activityByDay.indexOf(Math.max(...data.activityByDay, 0))];
        const mostActiveUser = Object.entries(data.userActivity).sort((a,b) => b[1] - a[1])[0];
        
        const report = `📊 التقرير الأسبوعي الشامل\n━━━━━━━━━━━━━━\n📝 إجمالي الرسائل: ${totalMessages}\n🕐 ذروة النشاط: ${mostActiveHour}:00\n📅 أكثر يوم تفاعلاً: ${mostActiveDay}\n👤 العضو الأكثر نشاطاً: ${mostActiveUser ? mostActiveUser[0] : 'لا يوجد'}\n━━━━━━━━━━━━━━`;
        
        showNotification('📊 التقرير الأسبوعي', 'تم توليد التقرير الأسبوعي بنجاح');
        sendTelegramMessage(`📊 <b>التقرير الأسبوعي - Chat Secure V6</b>\n\n${report}`);
    });
}

// ==================== 3. EXPORT TO PDF/TEXT & EXCEL/CSV ====================
function exportToPDF() {
    const container = document.getElementById('messagesContainer');
    const content = container ? container.innerText : 'لا توجد رسائل';
    const blob = new Blob([`Chat Secure V6 - Export\nDate: ${new Date().toLocaleString()}\n\n${content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chat_Export_${Date.now()}.txt`;
    a.click();
    showNotification('✅ تم التصدير', 'تم تصدير المحادثة بتنسيق نصي');
}

function exportToExcel() {
    const container = document.getElementById('messagesContainer');
    const content = container ? container.innerText : '';
    const lines = content.split('\n');
    const csv = lines.map(line => `"${line.replace(/"/g, '""')}"`).join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Chat_Export_${Date.now()}.csv`;
    a.click();
    showNotification('✅ تم التصدير', 'تم تصدير سجل المحادثة CSV');
}

// ==================== 4. SOCIAL SHARING HELPERS ====================
function shareGitHubCode() {
    const url = prompt('أدخل رابط GitHub للمشاركة:');
    if(!url) return;
    sendMessage(url, 'text');
}

function shareGoogleCalendarEvent() {
    const title = prompt('عنوان الموعد / الاجتماع:');
    const date = prompt('التاريخ والوقت (مثال: 2026-09-01 16:00):');
    if(!title || !date) return;
    sendMessage(`📅 موعد تقويم: ${title} - في ${date}`, 'text');
}

function shareDriveFile() {
    const url = prompt('أدخل رابط ملف Google Drive أو Dropbox:');
    if(!url) return;
    sendMessage(`📁 ملف سحابي: ${url}`, 'text');
}

function shareInstagramPost() {
    const url = prompt('أدخل رابط منشور Instagram:');
    if(!url) return;
    sendMessage(`📸 Instagram: ${url}`, 'text');
}

function shareTwitterPost() {
    const url = prompt('أدخل رابط تغريدة Twitter / X:');
    if(!url) return;
    sendMessage(`🐦 Twitter/X: ${url}`, 'text');
}

function shareTikTok() {
    const url = prompt('أدخل رابط TikTok:');
    if(!url) return;
    sendMessage(`🎵 TikTok: ${url}`, 'text');
}

// ==================== 4. QR CODE INTEGRATION ====================
function generateQRCode(text) {
    const qrContainer = document.getElementById('qrCodeContainer');
    if(!qrContainer || typeof QRCode === 'undefined') return;
    
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: text,
        width: 180,
        height: 180,
        colorDark: '#00a884',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function showRoomQRCode() {
    if(!currentChatId) {
        showNotification('❌ تنبيه', 'يرجى فتح غرفة محادثة أولاً');
        return;
    }
    const inviteData = {
        app: "Chat Secure V6",
        roomId: currentChatId,
        roomName: currentRoomType || 'محادثة مشفرة',
        key: currentKey || 'PUBLIC_KEY'
    };
    const modal = document.getElementById('qrModal');
    if(modal) modal.classList.remove('hidden');
    generateQRCode(JSON.stringify(inviteData));
}

// ==================== 5. EXTRA GAMES (CHESS, DOMINO, CARDS, QUIZ) ====================
let chessBoard = [];
let chessTurn = 'white';
let chessActive = false;
let selectedChessPiece = null;
let dominoPieces = [];
let dominoActive = false;
let cardDeck = [];
let cardActive = false;
let dailyChallenge = null;
let userPoints = parseInt(localStorage.getItem('userPoints')) || 0;
let userBadges = JSON.parse(localStorage.getItem('userBadges')) || [];

function startChess() {
    chessActive = true;
    chessTurn = 'white';
    selectedChessPiece = null;
    chessBoard = [
        ['♜','♞','♝','♛','♚','♝','♞','♜'],
        ['♟','♟','♟','♟','♟','♟','♟','♟'],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['','','','','','','',''],
        ['♙','♙','♙','♙','♙','♙','♙','♙'],
        ['♖','♘','♗','♕','♔','♗','♘','♖']
    ];
    renderChessBoard();
}

function renderChessBoard() {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = '<h4 style="margin-bottom:8px;">♟️ شطرنج تكتيكي</h4><div class="game-board" style="grid-template-columns:repeat(8,36px); gap:1px; background:#444; padding:2px; border-radius:6px;">';
    
    for(let row = 0; row < 8; row++) {
        for(let col = 0; col < 8; col++) {
            const isDark = (row + col) % 2 === 1;
            const piece = chessBoard[row][col];
            const isSelected = selectedChessPiece && selectedChessPiece.row === row && selectedChessPiece.col === col;
            const bg = isSelected ? 'var(--primary)' : (isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.2)');
            container.innerHTML += `<div class="game-cell" style="background:${bg}; width:36px; height:36px; font-size:24px; border:none; border-radius:2px;" onclick="selectChessPiece(${row},${col})">${piece}</div>`;
        }
    }
    
    container.innerHTML += `</div><p style="margin-top:8px; font-weight:bold; font-size:13px;">الدور: ${chessTurn === 'white' ? '⚪ الأبيض' : '⚫ الأسود'}</p>`;
}

function selectChessPiece(row, col) {
    if(!chessActive) return;
    
    if(selectedChessPiece === null) {
        if(chessBoard[row][col] !== '') {
            selectedChessPiece = { row, col };
            renderChessBoard();
        }
    } else {
        chessBoard[row][col] = chessBoard[selectedChessPiece.row][selectedChessPiece.col];
        chessBoard[selectedChessPiece.row][selectedChessPiece.col] = '';
        selectedChessPiece = null;
        chessTurn = chessTurn === 'white' ? 'black' : 'white';
        renderChessBoard();
        if(typeof addPoints === 'function') addPoints(5);
    }
}

function startDomino() {
    dominoActive = true;
    dominoPieces = [];
    for(let i = 0; i <= 6; i++) {
        for(let j = i; j <= 6; j++) {
            dominoPieces.push({ left: i, right: j });
        }
    }
    dominoPieces.sort(() => Math.random() - 0.5);
    renderDominoBoard();
}

function renderDominoBoard() {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = '<h4>🎲 دومينو الحظ والذكاء</h4><div style="display:flex; flex-wrap:wrap; gap:6px; justify-content:center; margin:10px 0;">';
    
    dominoPieces.slice(0, 7).forEach((piece, index) => {
        container.innerHTML += `
            <div class="game-cell" style="width:44px; height:70px; font-size:16px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;" onclick="playDominoPiece(${index})">
                <span>${piece.left}</span>
                <hr style="width:80%; border-color:#555; margin:3px 0;">
                <span>${piece.right}</span>
            </div>`;
    });
    container.innerHTML += '</div><p style="font-size:12px; color:var(--text-gray);">اضغط على القطعة للعبها</p>';
}

function playDominoPiece(index) {
    if(!dominoActive) return;
    const p = dominoPieces[index];
    showNotification('🎲 دومينو', `لعبت القطعة: [${p.left}|${p.right}]`);
    dominoPieces.splice(index, 1);
    renderDominoBoard();
    if(typeof addPoints === 'function') addPoints(5);
}

function startCardGame() {
    cardActive = true;
    cardDeck = [];
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    for(let s of suits) {
        for(let r of ranks) {
            cardDeck.push({ suit: s, rank: r });
        }
    }
    cardDeck.sort(() => Math.random() - 0.5);
    renderCardGame();
}

function renderCardGame() {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = '<h4>🃏 كوتشينة تفاعلية</h4><div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap; margin:10px 0;">';
    
    cardDeck.slice(0, 5).forEach((card, index) => {
        const isRed = card.suit === '♥' || card.suit === '♦';
        container.innerHTML += `
            <div class="game-cell" style="width:48px; height:68px; font-size:16px; color:${isRed ? '#e74c3c' : '#e9edef'}; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; background:rgba(255,255,255,0.1);" onclick="playCard(${index})">
                <span style="font-weight:bold;">${card.rank}</span>
                <span style="font-size:22px;">${card.suit}</span>
            </div>`;
    });
    container.innerHTML += '</div><p style="font-size:12px; color:var(--text-gray);">اضغط على الورقة لرميها</p>';
}

function playCard(index) {
    if(!cardActive) return;
    const c = cardDeck[index];
    showNotification('🃏 كوتشينة', `لعبت: ${c.rank} ${c.suit}`);
    cardDeck.splice(index, 1);
    renderCardGame();
    if(typeof addPoints === 'function') addPoints(5);
}

// ==================== 5. DAILY CHALLENGES & GAMIFICATION ====================
function generateDailyChallenge() {
    const challenges = [
        '📨 أرسل 10 رسائل مشفرة اليوم',
        '👥 أنشئ مجموعة محادثة جديدة',
        '👤 أضف صديقاً جديداً للتطبيق',
        '📷 انشر قصة (Story) جديدة',
        '😊 استخدم 5 تفاعلات إيموجي سريعة',
        '🎤 أرسل رسالة صوتية مشفرة',
        '📍 شارك موقعك الجغرافي',
        '📌 ثبّت رسالة مهمة في المجموعة',
        '📊 أنشئ استطلاع رأي في المحادثة',
        '🎮 العب جولة في ألعاب المنصة'
    ];
    
    const today = new Date().toDateString();
    const saved = localStorage.getItem('dailyChallenge');
    if(saved) {
        try {
            const parsed = JSON.parse(saved);
            if(parsed.date === today) {
                dailyChallenge = parsed.challenge;
                return;
            }
        } catch(e) {}
    }
    
    dailyChallenge = challenges[Math.floor(Math.random() * challenges.length)];
    localStorage.setItem('dailyChallenge', JSON.stringify({ date: today, challenge: dailyChallenge }));
}

function addPoints(points) {
    userPoints += points;
    localStorage.setItem('userPoints', userPoints);
    
    if(userPoints >= 3000) addBadge('👑 ملك المحادثة');
    else if(userPoints >= 1500) addBadge('💎 ألماسي');
    else if(userPoints >= 800) addBadge('🏆 محترف');
    else if(userPoints >= 300) addBadge('⭐ نجم متفاعل');
    else if(userPoints >= 100) addBadge('💪 نشيط');
    else if(userPoints >= 30) addBadge('🌱 مبتدئ');
    
    updatePointsDisplay();
}

function addBadge(badge) {
    if(!userBadges.includes(badge)) {
        userBadges.push(badge);
        localStorage.setItem('userBadges', JSON.stringify(userBadges));
        showNotification('🎖️ شارة جديدة!', `حصلت على وسام: ${badge}`);
    }
}

function updatePointsDisplay() {
    const el = document.getElementById('userPointsDisplay');
    if(el) el.textContent = `💰 ${userPoints} نقطة`;
}

// ==================== 5. CULTURAL QUIZ (10 QUESTIONS) ====================
const quizQuestions = [
    { q: 'ما هي عاصمة المملكة العربية السعودية؟', options: ['جدة', 'الرياض', 'مكة المكرمة', 'الدمام'], answer: 1 },
    { q: 'كم عدد سور القرآن الكريم؟', options: ['114 سورة', '110 سورة', '120 سورة', '100 سورة'], answer: 0 },
    { q: 'ما هو أكبر كوكب في مجموعتنا الشمسية؟', options: ['المريخ', 'الأرض', 'المشتري', 'زحل'], answer: 2 },
    { q: 'كم عدد قارات العالم؟', options: ['5', '6', '7', '8'], answer: 2 },
    { q: 'ما هو أسرع حيوان بري على الأرض؟', options: ['الأسد', 'الفهد الصياد', 'الغزال', 'الحصان'], answer: 1 },
    { q: 'ما هي عاصمة اليابان؟', options: ['أوساكا', 'كيوتو', 'طوكيو', 'هيروشيما'], answer: 2 },
    { q: 'كم عدد ألوان قوس قزح الأساسية؟', options: ['5', '6', '7', '8'], answer: 2 },
    { q: 'من هو مخترع المصباح الكهربائي؟', options: ['توماس أديسون', 'نيكولا تسلا', 'أينشتاين', 'نيوتن'], answer: 0 },
    { q: 'ما هي العملة الرسمية في دولة الإمارات؟', options: ['الريال', 'الدينار', 'الدرهم', 'الجنيه'], answer: 2 },
    { q: 'ما هو أعلى جبل في العالم؟', options: ['جبل كليمنجارو', 'جبل إيفرست', 'جبل فوجي', 'جبل الطور'], answer: 1 }
];

let currentQuizQuestions = [];
let currentQuizIndex = 0;
let quizScore = 0;
let quizActive = false;

function startQuiz() {
    quizActive = true;
    quizScore = 0;
    currentQuizIndex = 0;
    currentQuizQuestions = [...quizQuestions].sort(() => Math.random() - 0.5).slice(0, 5);
    showQuizQuestion();
}

function showQuizQuestion() {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    if(currentQuizIndex >= currentQuizQuestions.length) {
        endQuiz();
        return;
    }
    
    const q = currentQuizQuestions[currentQuizIndex];
    container.innerHTML = `
        <h4>🎯 المسابقة الثقافية (${currentQuizIndex + 1}/${currentQuizQuestions.length})</h4>
        <p style="font-weight:bold; margin:12px 0; font-size:16px;">${q.q}</p>
        <div style="display:grid; gap:8px;">
            ${q.options.map((opt, i) => `
                <button onclick="checkQuizAnswer(${i})" class="action-btn secondary" style="margin:0; padding:10px; font-size:14px; text-align:right;">${opt}</button>
            `).join('')}
        </div>
        <p id="quizScore" style="margin-top:10px; color:var(--text-gray); font-weight:bold;">النقاط الحالية: ${quizScore}</p>
    `;
}

function checkQuizAnswer(selected) {
    if(!quizActive) return;
    const q = currentQuizQuestions[currentQuizIndex];
    const res = document.getElementById('quizScore');
    
    if(selected === q.answer) {
        quizScore += 20;
        if(res) {
            res.textContent = `✅ إجابة صحيحة! (+20 نقطة)`;
            res.style.color = 'var(--primary)';
        }
        addPoints(20);
    } else {
        if(res) {
            res.textContent = `❌ إجابة خاطئة! الصحيحة: ${q.options[q.answer]}`;
            res.style.color = 'var(--delete-red)';
        }
    }
    
    currentQuizIndex++;
    setTimeout(showQuizQuestion, 1400);
}

function endQuiz() {
    quizActive = false;
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = `
        <h4>🎉 اكتملت المسابقة!</h4>
        <p style="font-size:22px; font-weight:bold; color:var(--admin-gold); margin:16px 0;">مجموع نقاطك: ${quizScore} نقطة</p>
        <button onclick="startQuiz()" class="action-btn">🔄 مسابقة جديدة</button>
    `;
    if(quizScore >= 60) addBadge('🧠 عبقري الثقافة');
}

// ==================== 5. MEME GENERATOR ====================
const memeTemplates = [
    '🤣 عندما يقولون المحادثة غير مشفرة وأنت تستخدم Chat Secure V6',
    '😅 عندما ترسل رسالة وتكتشف أنك في المجموعة الخطأ',
    '🤔 عندما ترسل رسالة ذاتية التدمير وتنتظر رؤيتها تختفي',
    '🤯 عندما تكتشف كل ميزات التشفير والألعاب في تطبيق واحد',
    '🥳 عندما يوافق المشرف على دخولك للمجموعة المشفرة'
];

function generateMeme() {
    const meme = memeTemplates[Math.floor(Math.random() * memeTemplates.length)];
    sendMessage(meme, 'text');
    showNotification('🎭 مولد الميمز', 'تم نشر الميم في المحادثة');
}

// ==================== 5. COLLABORATIVE WHITEBOARD ====================
let whiteboardCanvas = null;
let whiteboardCtx = null;
let isDrawing = false;

function startWhiteboard() {
    const container = document.getElementById('gameContainer');
    if(!container) return;
    container.innerHTML = `
        <h4>🎨 لوحة الرسم التفاعلية</h4>
        <canvas id="whiteboardCanvas" width="380" height="220" style="background:white; border-radius:10px; margin:10px auto; display:block; cursor:crosshair;"></canvas>
        <div style="display:flex; gap:10px; align-items:center; justify-content:center;">
            <input type="color" id="whiteboardColor" value="#000000" style="width:40px; height:36px; padding:0; border:none; cursor:pointer;">
            <input type="range" id="whiteboardSize" min="1" max="12" value="3" style="width:100px;">
            <button onclick="clearWhiteboard()" class="action-btn danger" style="margin:0; width:auto; padding:6px 14px; font-size:12px;">مسح</button>
        </div>
    `;
    
    whiteboardCanvas = document.getElementById('whiteboardCanvas');
    if(whiteboardCanvas) {
        whiteboardCtx = whiteboardCanvas.getContext('2d');
        whiteboardCtx.fillStyle = 'white';
        whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
        
        whiteboardCanvas.onmousedown = (e) => {
            isDrawing = true;
            whiteboardCtx.beginPath();
            whiteboardCtx.moveTo(e.offsetX, e.offsetY);
        };
        whiteboardCanvas.onmousemove = (e) => {
            if(isDrawing) {
                whiteboardCtx.lineTo(e.offsetX, e.offsetY);
                whiteboardCtx.strokeStyle = document.getElementById('whiteboardColor')?.value || '#000';
                whiteboardCtx.lineWidth = document.getElementById('whiteboardSize')?.value || 3;
                whiteboardCtx.lineCap = 'round';
                whiteboardCtx.stroke();
            }
        };
        whiteboardCanvas.onmouseup = () => { isDrawing = false; };
        whiteboardCanvas.onmouseleave = () => { isDrawing = false; };
    }
}

function clearWhiteboard() {
    if(whiteboardCtx && whiteboardCanvas) {
        whiteboardCtx.fillStyle = 'white';
        whiteboardCtx.fillRect(0, 0, whiteboardCanvas.width, whiteboardCanvas.height);
    }
}

// ==================== 5. LIVE STREAM & VOICE ROOM ====================
function startLiveStream() {
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                const container = document.getElementById('gameContainer');
                if(!container) return;
                container.innerHTML = '<h4>📡 بث كاميرا مباشر</h4>';
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                video.muted = true;
                video.style.width = '100%';
                video.style.borderRadius = '10px';
                container.appendChild(video);
                
                const stopBtn = document.createElement('button');
                stopBtn.textContent = '⏹️ إيقاف البث';
                stopBtn.className = 'action-btn danger';
                stopBtn.onclick = () => {
                    stream.getTracks().forEach(t => t.stop());
                    container.innerHTML = '<p style="padding:15px;">تم إيقاف البث بنجاح</p>';
                };
                container.appendChild(stopBtn);
                showNotification('📡 بث مباشر', 'تم تشغيل البث المباشر');
            })
            .catch(() => showNotification('❌ تعذر الوصول', 'يرجى السماح بالوصول للكاميرا'));
    }
}

function startVoiceRoom() {
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const container = document.getElementById('gameContainer');
                if(!container) return;
                container.innerHTML = `
                    <h4>🎙️ غرفة صوتية حية</h4>
                    <div style="display:flex; align-items:center; gap:12px; justify-content:center; margin:20px 0;">
                        <div style="width:55px; height:55px; border-radius:50%; background:var(--primary); animation:pulse 1.2s infinite; display:flex; align-items:center; justify-content:center; color:white; font-size:24px;">
                            <i class="fas fa-microphone"></i>
                        </div>
                        <span style="font-weight:bold;">الميكروفون متصل في الغرفة الصوتية</span>
                    </div>
                    <button onclick="stopVoiceRoom()" class="action-btn danger">⏹️ مغادرة الغرفة الصوتية</button>
                `;
                window.voiceRoomStream = stream;
                showNotification('🎙️ غرفة صوتية', 'أنت الآن في الغرفة الصوتية');
            })
            .catch(() => showNotification('❌ تعذر الوصول', 'يرجى إعطاء إذن الميكروفون'));
    }
}

function stopVoiceRoom() {
    if(window.voiceRoomStream) {
        window.voiceRoomStream.getTracks().forEach(t => t.stop());
        const container = document.getElementById('gameContainer');
        if(container) container.innerHTML = '<p style="padding:15px;">تمت مغادرة الغرفة الصوتية</p>';
    }
}

// ==================== 6. PIN LOCK & SECURITY KEY ====================
let appPin = localStorage.getItem('appPin') || null;

function setAppPin() {
    const pin = prompt('أدخل رمز PIN جديد مكوّن من 4 أرقام:');
    if(pin && pin.length === 4 && /^\d+$/.test(pin)) {
        appPin = pin;
        localStorage.setItem('appPin', pin);
        showNotification('🔒 تم القفل بنجاح', 'تم تفعيل قفل PIN للتطبيق');
    } else {
        showNotification('❌ خطأ', 'رمز PIN يجب أن يتكون من 4 أرقام بالضبط');
    }
}

function sendSecretMessage() {
    const text = prompt('أدخل نص الرسالة السرية:');
    if(!text) return;
    const duration = parseInt(prompt('مدة الظهور قبل الاختفاء التلقائي بالثواني:', '15')) || 15;
    
    const secretMessage = {
        sender: myName,
        content: text,
        type: 'secret',
        timestamp: Date.now(),
        expiresAt: Date.now() + (duration * 1000)
    };
    
    sendMessage(JSON.stringify(secretMessage), 'secret');
    showNotification('🔒 رسالة سرية', `ستختفي الرسالة بعد ${duration} ثانية تلقائياً`);
}

// ==================== 6. SCREEN CAPTURE SHIELD ====================
function enableScreenShield() {
    document.addEventListener('keydown', (e) => {
        if(e.key === 'PrintScreen') {
            showNotification('🚫 حماية الشاشة', 'أخذ لقطات الشاشة محمي');
            document.body.style.opacity = '0';
            setTimeout(() => { document.body.style.opacity = '1'; }, 300);
        }
    });
}

// ==================== 7. FOLLOW & PUBLIC PROFILE ====================
function followUser(username) {
    db.ref(`users/${username}/followers/${myName}`).set(true);
    db.ref(`users/${myName}/following/${username}`).set(true);
    showNotification('✅ تمت المتابعة', `أنت الآن تتابع ${username}`);
}

function unfollowUser(username) {
    db.ref(`users/${username}/followers/${myName}`).remove();
    db.ref(`users/${myName}/following/${username}`).remove();
    showNotification('✅ إلغاء المتابعة', `توقفت عن متابعة ${username}`);
}

function generateReferralCode() {
    const code = (myName || 'USER') + '_' + Math.random().toString(36).substring(2, 7);
    db.ref(`referrals/${code}`).set({ referrer: myName, createdAt: Date.now() });
    return code;
}

function shareReferralCode() {
    const code = generateReferralCode();
    navigator.clipboard.writeText(code).then(() => {
        showNotification('🔗 رمز الإحالة', `تم نسخ كود الإحالة الخاص بك: ${code}`);
    });
}

// ==================== 8. MOBILE SWIPE GESTURES ====================
function initSwipeGestures() {
    let touchStartX = 0;
    let touchEndX = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].clientX;
        const deltaX = touchEndX - touchStartX;
        
        // Swipe Right to go back from chat to list on mobile
        if(deltaX > 90 && document.body.classList.contains('chat-active')) {
            closeChatMobile();
        }
    }, { passive: true });
}

function toggleOneHandedMode() {
    const isOneHanded = document.body.classList.toggle('one-handed');
    localStorage.setItem('oneHandedMode', isOneHanded);
    showNotification('📱 وضع اليد الواحدة', isOneHanded ? 'تم التفعيل' : 'تم الإيقاف');
}

function toggleDataSaver() {
    const cur = localStorage.getItem('dataSaver') === 'true';
    localStorage.setItem('dataSaver', !cur);
    showNotification('📉 وضع توفير البيانات', !cur ? 'تم التفعيل' : 'تم الإيقاف');
}

// ==================== 9. CONVERSATION POSITION RESUME ====================
function saveConversationPosition() {
    if(!currentChatId) return;
    const c = document.getElementById('messagesContainer');
    if(c) localStorage.setItem('pos_' + currentChatId, c.scrollTop);
}

function restoreConversationPosition() {
    if(!currentChatId) return;
    const saved = localStorage.getItem('pos_' + currentChatId);
    const c = document.getElementById('messagesContainer');
    if(saved && c) c.scrollTop = parseInt(saved);
}

// ==================== 10. VOICE TRANSLATION & 3D ====================
function send3DMessage() {
    const text = prompt('أدخل نص الرسالة ثلاثية الأبعاد (3D):');
    if(text) sendMessage(text, '3d');
}

// ==================== 10. SMART NIGHT MODE ====================
function initSmartNightMode() {
    function checkTime() {
        const hour = new Date().getHours();
        if(hour >= 22 || hour < 6) {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }
    }
    checkTime();
    setInterval(checkTime, 60000);
}

// ==================== 11. LUCKY SPIN WHEEL & RANDOM NAME PICKER ====================
let wheelParticipants = ['أحمد', 'محمد', 'سارة', 'خالد', 'فاطمة', 'عمر', 'نورة', 'علي'];
let wheelColors = ['#00a884', '#ffd700', '#3498db', '#e74c3c', '#9b59b6', '#e67e22', '#1abc9c', '#f39c12'];
let currentWheelRotation = 0;
let isSpinningWheel = false;
let lastWheelWinner = '';

function openSpinWheelGame() {
    const modal = document.getElementById('spinWheelModal');
    if(!modal) return;
    modal.classList.remove('hidden');
    
    // Default to room/group members or online users if available
    setWheelSource('room');
}

function setWheelSource(source) {
    const tabRoom = document.getElementById('tabWheelRoom');
    const tabCustom = document.getElementById('tabWheelCustom');
    const customWrap = document.getElementById('wheelCustomInputWrap');

    if(source === 'room') {
        if(tabRoom) tabRoom.classList.add('active');
        if(tabCustom) tabCustom.classList.remove('active');
        if(customWrap) customWrap.classList.add('hidden');

        // Fetch participants from current room or registered users
        const users = Object.keys(registeredUsersCache || {});
        if(users.length > 1) {
            wheelParticipants = users.slice(0, 12);
        } else {
            wheelParticipants = [myName || 'أنا', 'صديق 1', 'صديق 2', 'صديق 3', 'صديق 4'];
        }
        drawLuckyWheel();
    } else {
        if(tabRoom) tabRoom.classList.remove('active');
        if(tabCustom) tabCustom.classList.add('active');
        if(customWrap) customWrap.classList.remove('hidden');
    }
}

function loadCustomNamesToWheel() {
    const inp = document.getElementById('customNamesInput');
    const raw = inp ? inp.value.trim() : '';
    if(!raw) {
        showNotification('⚠️ تنبيه', 'يرجى إدخال أسماء مفصولة بفواصل');
        return;
    }
    const names = raw.split(/[,،\n]+/).map(n => n.trim()).filter(n => n.length > 0);
    if(names.length < 2) {
        showNotification('⚠️ تنبيه', 'يرجى إدخال اسمين على الأقل للقرعة');
        return;
    }
    wheelParticipants = names;
    drawLuckyWheel();
    showNotification('✅ تم التحديث', `تم تحميل ${names.length} أسماء إلى عجلة الحظ!`);
}

function drawLuckyWheel() {
    const canvas = document.getElementById('luckyWheelCanvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const numSegments = wheelParticipants.length;
    const arcSize = (2 * Math.PI) / numSegments;
    const radius = canvas.width / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(currentWheelRotation);

    for(let i = 0; i < numSegments; i++) {
        const angle = i * arcSize;
        ctx.beginPath();
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius - 4, angle, angle + arcSize);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#111b21';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw Name Text
        ctx.save();
        ctx.rotate(angle + arcSize / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px Cairo, sans-serif';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        
        let label = wheelParticipants[i];
        if(label.length > 10) label = label.substring(0, 8) + '..';
        ctx.fillText(label, radius - 20, 5);
        ctx.restore();
    }

    // Center Gold Pin
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffd700';
    ctx.fill();
    ctx.strokeStyle = '#111b21';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
}

function spinLuckyWheel() {
    if(isSpinningWheel || !wheelParticipants.length) return;
    isSpinningWheel = true;
    
    const spinBtn = document.getElementById('spinWheelBtn');
    if(spinBtn) {
        spinBtn.disabled = true;
        spinBtn.innerText = '⏳ جاري التدوير...';
    }

    const winnerDisplay = document.getElementById('wheelWinnerDisplay');
    if(winnerDisplay) winnerDisplay.classList.add('hidden');

    const totalRounds = 5 + Math.random() * 5; // 5 to 10 full spins
    const randomStopAngle = Math.random() * (2 * Math.PI);
    const targetRotation = currentWheelRotation + (totalRounds * 2 * Math.PI) + randomStopAngle;
    
    const startTime = performance.now();
    const duration = 4000; // 4 seconds animation

    function animateWheel(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentWheelRotation = currentWheelRotation + (targetRotation - currentWheelRotation) * easeOut;

        drawLuckyWheel();

        if(progress < 1) {
            requestAnimationFrame(animateWheel);
        } else {
            isSpinningWheel = false;
            currentWheelRotation = targetRotation % (2 * Math.PI);
            
            // Calculate winner
            // Pointer is at the top (-PI/2)
            const numSegments = wheelParticipants.length;
            const arcSize = (2 * Math.PI) / numSegments;
            // The segment under top pointer (270 deg or 3*PI/2)
            const normalizedRotation = (2 * Math.PI - (currentWheelRotation % (2 * Math.PI)) + (3 * Math.PI / 2)) % (2 * Math.PI);
            const winningIndex = Math.floor(normalizedRotation / arcSize) % numSegments;
            
            lastWheelWinner = wheelParticipants[winningIndex];

            const winnerText = document.getElementById('wheelWinnerText');
            if(winnerText) winnerText.innerText = `🎉 الفائز بالقرعة: ${lastWheelWinner}`;
            if(winnerDisplay) winnerDisplay.classList.remove('hidden');

            if(spinBtn) {
                spinBtn.disabled = false;
                spinBtn.innerText = '🎯 تدوير العجلة الآن!';
            }

            playAppSound('win');
            spawnFloatingEmoji('🎉');
            showNotification('🏆 نتيجة القرعة', `الفائز المختار هو: ${lastWheelWinner}`);
        }
    }

    requestAnimationFrame(animateWheel);
}

function shareWheelResultInChat() {
    if(!lastWheelWinner) {
        showNotification('⚠️ تنبيه', 'قم بتدوير العجلة أولاً للحصول على فائز');
        return;
    }
    if(!currentChatId) {
        showNotification('⚠️ تنبيه', 'افتح محادثة أو مجموعة أولاً لمشاركة النتيجة');
        return;
    }
    const message = `🎯 **نتيجة قرعة عجلة الحظ:**\n🏆 **الفائز:** ${lastWheelWinner}\n👥 **المشاركون:** ${wheelParticipants.join(', ')}`;
    sendMessage(message, 'text');
    closeModal('spinWheelModal');
    showNotification('📢 تم النشر', 'تمت مشاركة نتيجة القرعة بالمحادثة بنجاح!');
}

// ==================== 12. TRUTH OR DARE (كرسي الاعتراف والصراحة) ====================
const truthQuestions = [
    'ما هو أكثر موقف محرج تعرضت له في حياتك ولم تخبر به أحداً؟',
    'ما هي أكبر كذبة قلتها في حياتك وما زال الجميع يصدقها؟',
    'لو أتيحت لك فرصة مسح خطأ واحد من ماضيك، ماذا سيكون؟',
    'من هو الشخص في هذه الغرفة الذي تثق به أكثر من غيره؟',
    'ما هي العادة الغريبة التي تفعلها وأنت وحدك ولا يعلمها أحد؟',
    'ما هو الشيء الذي تخاف منه بشدة وتخجل من الاعتراف به؟',
    'هل ندمت يوماً على مساعدة شخص ما؟ ولماذا؟',
    'ما هو السر الذي لم تخبر به حتى أقرب أصدقائك؟',
    'لو كان بإمكانك تغيير صفة واحدة في شخصيتك، فماذا ستختار؟',
    'ما هو أغرب حلم حلمت به مؤخراً وتتذكره بتفاصيله؟',
    'هل وقعت في حب شخص من طرف واحد من قبل؟',
    'ما هو الشيء الذي لا تستطيع العيش بدونه أبداً؟'
];

const dareChallenges = [
    'أرسل رسالة صوتية للمجموعة وأنت تقلد صوت قطة أو شخصية كرتونية!',
    'قم بتغيير صورة ملفك الشخصي إلى صورة مضحكة لمدة 10 دقائق!',
    'اكتب رسالة اعتذار مضحكة لآخر شخص تحدثت معه على الخاص!',
    'قم بإرسال نكتة مضحكة جداً الآن في المحادثة!',
    'أرسل رسالة صوتية وأنت تغني فيها مقطعاً من أغنيتك المفضلة!',
    'اكتب حكمة من تأليفك وأقنع الجميع أنها حكمة لفيلسوف يوناني!',
    'قل 5 مجاملات سريعة لخمسة أعضاء مختلفين في المحادثة!',
    'أرسل ملصقاً عشوائياً بدون تفسير لأول شخص متصل الآن!',
    'تحدث باللغة الفصحى فقط طوال الـ 5 دقائق القادمة!'
];

let lastTodText = '';
let lastTodType = '';
let currentBottleAngle = 0;

function openTruthOrDareGame() {
    const modal = document.getElementById('truthOrDareModal');
    if(!modal) return;
    modal.classList.remove('hidden');
}

function spinTheBottle() {
    const bottle = document.getElementById('spinBottleElem');
    const playerText = document.getElementById('selectedPlayerText');
    if(!bottle) return;

    const randomRotations = 4 + Math.floor(Math.random() * 5); // 4-8 spins
    const randomExtraAngle = Math.floor(Math.random() * 360);
    currentBottleAngle += (randomRotations * 360) + randomExtraAngle;

    bottle.style.transform = `rotate(${currentBottleAngle}deg)`;
    if(playerText) playerText.innerText = '⏳ الزجاجة تدور لاختيار اللاعب...';

    // Pick random participant
    const users = Object.keys(registeredUsersCache || {});
    const pool = users.length > 0 ? users : [myName, 'صديقك'];
    const chosenOne = pool[Math.floor(Math.random() * pool.length)];

    setTimeout(() => {
        if(playerText) {
            playerText.innerHTML = `🎯 وقع الاختيار على: <span style="color:var(--primary); font-size:18px;">${chosenOne}</span>! اختر صراحة أو جرأة:`;
        }
        playAppSound('pop');
    }, 3000);
}

function pickTruthQuestion() {
    const q = truthQuestions[Math.floor(Math.random() * truthQuestions.length)];
    lastTodText = q;
    lastTodType = '💬 سؤال صراحة';

    displayTodCard(lastTodType, lastTodText, '#3498db');
}

function pickDareChallenge() {
    const d = dareChallenges[Math.floor(Math.random() * dareChallenges.length)];
    lastTodText = d;
    lastTodType = '🔥 تحدي وجرأة';

    displayTodCard(lastTodType, lastTodText, '#e74c3c');
}

function displayTodCard(type, text, badgeColor) {
    const card = document.getElementById('todCardContainer');
    const badge = document.getElementById('todTypeBadge');
    const txt = document.getElementById('todQuestionText');

    if(card && badge && txt) {
        card.classList.remove('hidden');
        badge.innerText = type;
        badge.style.background = badgeColor;
        badge.style.color = '#ffffff';
        txt.innerText = text;
    }
}

function shareTodInChat() {
    if(!lastTodText) return;
    if(!currentChatId) {
        showNotification('⚠️ تنبيه', 'افتح محادثة أو مجموعة أولاً لإرسال السؤال');
        return;
    }
    const message = `🎲 **لعبة الصراحة أو الجرأة (كرسي الاعتراف):**\n${lastTodType}:\n👉 **${lastTodText}**\n\n_في انتظار إجابتك الآن!_ ✨`;
    sendMessage(message, 'text');
    closeModal('truthOrDareModal');
    showNotification('📨 تم الإرسال', 'تم إرسال السؤال إلى المحادثة بنجاح!');
}

// ==================== 13. RANDOM NUMBER & DICE ROLL ====================
const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function openDiceGame() {
    const modal = document.getElementById('diceModal');
    if(!modal) return;
    modal.classList.remove('hidden');
    switchDiceTab('dice');
}

function switchDiceTab(tab) {
    const tabDice = document.getElementById('tabDiceRoll');
    const tabNum = document.getElementById('tabRandNum');
    const diceView = document.getElementById('diceRollView');
    const numView = document.getElementById('randNumView');

    if(tab === 'dice') {
        if(tabDice) tabDice.classList.add('active');
        if(tabNum) tabNum.classList.remove('active');
        if(diceView) diceView.classList.remove('hidden');
        if(numView) numView.classList.add('hidden');
    } else {
        if(tabDice) tabDice.classList.remove('active');
        if(tabNum) tabNum.classList.add('active');
        if(diceView) diceView.classList.add('hidden');
        if(numView) numView.classList.remove('hidden');
    }
}

function rollTheDice() {
    const d1 = document.getElementById('diceFace1');
    const d2 = document.getElementById('diceFace2');
    const resText = document.getElementById('diceResultText');

    let rollCount = 0;
    const rollInterval = setInterval(() => {
        const r1 = Math.floor(Math.random() * 6);
        const r2 = Math.floor(Math.random() * 6);
        if(d1) d1.innerText = diceFaces[r1];
        if(d2) d2.innerText = diceFaces[r2];
        rollCount++;

        if(rollCount >= 10) {
            clearInterval(rollInterval);
            const total = (r1 + 1) + (r2 + 1);
            if(resText) resText.innerHTML = `🎲 النتيجة: <b style="color:var(--admin-gold); font-size:18px;">${r1+1} + ${r2+1} = ${total}</b>`;
            playAppSound('pop');
            
            if(currentChatId) {
                // Auto announce dice roll in chat
                sendMessage(`🎲 **رمي نرد:** حصل على (${r1+1} و ${r2+1}) = **المجموع ${total}**`, 'text');
            }
        }
    }, 80);
}

function generateRandomNumber() {
    const minInput = document.getElementById('randNumMin');
    const maxInput = document.getElementById('randNumMax');
    const display = document.getElementById('randNumResult');

    const min = parseInt(minInput ? minInput.value : '1') || 1;
    const max = parseInt(maxInput ? maxInput.value : '100') || 100;

    if(min >= max) {
        showNotification('⚠️ تنبيه', 'يجب أن يكون الحد الأدنى أصغر من الحد الأقصى');
        return;
    }

    let count = 0;
    const interval = setInterval(() => {
        const temp = Math.floor(min + Math.random() * (max - min + 1));
        if(display) display.innerText = temp;
        count++;

        if(count >= 12) {
            clearInterval(interval);
            const finalNum = Math.floor(min + Math.random() * (max - min + 1));
            if(display) display.innerText = finalNum;
            playAppSound('win');
            
            if(currentChatId) {
                sendMessage(`🔢 **قرعة رقمية عشوائية:** الرقم المختار بين (${min} و ${max}) هو: **${finalNum}** 🎯`, 'text');
            }
        }
    }, 60);
}

// Sound Helper
function playAppSound(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if(type === 'win') {
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
            osc.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
            gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.5);
        } else {
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.15);
        }
    } catch(e) {}
}

// ==================== INITIALIZATION ORCHESTRATOR ====================
function initAllExtraFeatures() {
    initSpeechRecognition();
    initSwipeGestures();
    initSmartNightMode();
    enableScreenShield();
    generateDailyChallenge();
    updatePointsDisplay();
    
    console.log('🚀 Chat Secure V6 - All Extra Features Loaded Successfully');
}

// Start
initAllExtraFeatures();

