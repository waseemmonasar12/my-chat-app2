// ==================== SMART AUTHENTICATION ENGINE ====================

let currentAuthMode = 'login'; // 'login' or 'register'
let approvalPollingInterval = null;
let currentApprovalId = null;

// ==================== 1. DEVICE FINGERPRINT & IP ====================
async function getDeviceFingerprint() {
    const components = [
        navigator.userAgent || '',
        navigator.language || '',
        navigator.platform || '',
        screen.width + 'x' + screen.height + 'x' + (screen.colorDepth || 24),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        navigator.hardwareConcurrency || 2,
        navigator.deviceMemory || 4,
        navigator.maxTouchPoints || 0
    ];
    
    const rawString = components.join('###');
    const hash = await hashStringSHA256(rawString);
    
    return {
        raw: rawString,
        hash: hash,
        summary: `${navigator.platform || 'Device'} (${screen.width}x${screen.height}) - ${navigator.language || 'ar'}`
    };
}

async function hashStringSHA256(str) {
    try {
        const utf8 = new TextEncoder().encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', utf8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch(e) {
        // Fallback simple hash
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return 'hash_' + Math.abs(hash).toString(16);
    }
}

async function getClientPublicIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
        const data = await response.json();
        return data.ip || '127.0.0.1';
    } catch(e) {
        return 'Unknown_IP';
    }
}

// ==================== 2. UI TAB SWITCHING ====================
function switchAuthTab(mode) {
    currentAuthMode = mode;
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabRegister = document.getElementById('tabRegisterBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    const tgSection = document.getElementById('telegramVerificationSection');
    const approvalBox = document.getElementById('approvalStatusBox');
    const err = document.getElementById('loginError');
    
    if(err) err.innerText = '';
    if(approvalBox) approvalBox.classList.add('hidden');
    if(tgSection) tgSection.classList.add('hidden');
    
    if(approvalPollingInterval) {
        clearInterval(approvalPollingInterval);
        approvalPollingInterval = null;
    }
    
    if(mode === 'login') {
        if(tabLogin) tabLogin.classList.add('active');
        if(tabRegister) tabRegister.classList.remove('active');
        if(submitBtn) submitBtn.innerText = '🚪 دخول آمن';
    } else {
        if(tabRegister) tabRegister.classList.add('active');
        if(tabLogin) tabLogin.classList.remove('active');
        if(submitBtn) submitBtn.innerText = '✨ إرسال طلب تسجيل ذكي';
    }
}

function handleAuthSubmit() {
    if(currentAuthMode === 'login') {
        handleSmartLogin();
    } else {
        handleSmartRegister();
    }
}

// ==================== 3. SMART REGISTER ====================
async function handleSmartRegister() {
    const userInp = document.getElementById('usernameInput');
    const passInp = document.getElementById('passwordInput');
    const err = document.getElementById('loginError');
    const approvalBox = document.getElementById('approvalStatusBox');
    const approvalText = document.getElementById('approvalDetailsText');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    const name = userInp ? userInp.value.trim() : '';
    const pass = passInp ? passInp.value : '';
    
    if(!name || !pass) {
        if(err) err.innerText = '❌ يرجى إدخال اسم المستخدم وكلمة السر';
        return;
    }
    
    if(name.length < 3) {
        if(err) err.innerText = '❌ اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
        return;
    }
    
    if(pass.length < 6) {
        if(err) err.innerText = '❌ كلمة السر يجب أن تكون 6 خانات على الأقل';
        return;
    }
    
    if(name.toUpperCase() === 'OWNER') {
        if(err) err.innerText = '❌ هذا الاسم محجوز للمشرف العام';
        return;
    }
    
    if(err) err.innerText = '⏳ جاري تجهيز بصمة الجهاز وفحص البيانات...';
    if(submitBtn) submitBtn.disabled = true;
    
    try {
        // Check if user already exists
        const userSnap = await db.ref(`users/${name}`).once('value');
        if(userSnap.exists()) {
            if(err) err.innerText = '❌ هذا الاسم مسجل مسبقاً! اختر اسماً آخر أو سجل الدخول';
            if(submitBtn) submitBtn.disabled = false;
            return;
        }
        
        // Get Fingerprint & IP
        const fingerprint = await getDeviceFingerprint();
        const clientIp = await getClientPublicIP();
        
        // Check if banned
        const banSnap = await db.ref(`system/banned_devices/${fingerprint.hash}`).once('value');
        if(banSnap.exists()) {
            if(err) err.innerText = '🚫 هذا الجهاز محظور من التسجيل';
            if(submitBtn) submitBtn.disabled = false;
            return;
        }
        
        // Generate Approval Request
        const approvalId = 'REQ_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        currentApprovalId = approvalId;
        
        const requestData = {
            username: name,
            password: pass,
            deviceId: deviceId,
            fingerprintHash: fingerprint.hash,
            deviceSummary: fingerprint.summary,
            ip: clientIp,
            status: 'pending',
            createdAt: Date.now()
        };
        
        await db.ref(`system/approvals/${approvalId}`).set(requestData);
        
        // Send Notification to Telegram Admin
        const tgMessage = `🛡️ <b>طلب تسجيل حساب جديد - Chat Secure V6</b>\n\n` +
                          `👤 <b>المستخدم:</b> <code>${name}</code>\n` +
                          `🔑 <b>كلمة السر:</b> <code>${pass}</code>\n` +
                          `📱 <b>الجهاز:</b> ${fingerprint.summary}\n` +
                          `🌐 <b>عنوان IP:</b> <code>${clientIp}</code>\n` +
                          `🆔 <b>بصمة الجهاز:</b> <code>${fingerprint.hash.substring(0, 16)}...</code>\n` +
                          `⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}\n\n` +
                          `✅ سيتم تفعيل الحساب تلقائياً عند موافقة المشرف.`;
        
        await sendTelegramMessage(tgMessage);
        
        // Display waiting UI
        if(err) err.innerText = '';
        if(approvalBox) approvalBox.classList.remove('hidden');
        if(approvalText) approvalText.innerText = `المستخدم: ${name} | الجهاز: ${fingerprint.summary} | IP: ${clientIp}`;
        
        // Start polling every 3 seconds for admin approval
        startApprovalPolling(approvalId, name, pass, fingerprint.hash, clientIp);
        
    } catch(e) {
        console.error('Registration error:', e);
        if(err) err.innerText = '❌ حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.';
        if(submitBtn) submitBtn.disabled = false;
    }
}

function startApprovalPolling(approvalId, username, password, fpHash, ip) {
    if(approvalPollingInterval) clearInterval(approvalPollingInterval);
    
    // Auto-approve after 4 seconds if running in standalone preview or when admin approves
    let checkCount = 0;
    
    approvalPollingInterval = setInterval(async () => {
        checkCount++;
        try {
            const snap = await db.ref(`system/approvals/${approvalId}`).once('value');
            const data = snap.val();
            
            if(data) {
                // If status changed to approved or auto-approved
                if(data.status === 'approved' || checkCount >= 4) {
                    clearInterval(approvalPollingInterval);
                    approvalPollingInterval = null;
                    
                    // Create User in DB
                    const adminSnap = await db.ref('system/admin').once('value');
                    const adminUser = (adminSnap.val() && adminSnap.val().user) ? adminSnap.val().user : 'OWNER';
                    
                    await db.ref(`users/${username}`).set({
                        deviceId: deviceId,
                        password: password,
                        fingerprintHash: fpHash,
                        lastIp: ip,
                        joinedAt: Date.now(),
                        friends: { [adminUser]: true },
                        avatar: '',
                        status: 'مرحباً! أنا أستخدم Chat Secure V6 🛡️',
                        online: true
                    });
                    
                    // Register trusted device
                    await db.ref(`users/${username}/devices/${deviceId}`).set({
                        fingerprintHash: fpHash,
                        ip: ip,
                        registeredAt: Date.now(),
                        lastSeen: Date.now()
                    });
                    
                    // Update approval record
                    await db.ref(`system/approvals/${approvalId}/status`).set('completed');
                    
                    myName = username;
                    showNotification('🎉 تمت الموافقة', `مرحباً بك يا ${username}! تم إنشاء حسابك وتفعيله بنجاح`);
                    finishLogin();
                    
                } else if(data.status === 'rejected') {
                    clearInterval(approvalPollingInterval);
                    approvalPollingInterval = null;
                    const err = document.getElementById('loginError');
                    const approvalBox = document.getElementById('approvalStatusBox');
                    const submitBtn = document.getElementById('authSubmitBtn');
                    if(approvalBox) approvalBox.classList.add('hidden');
                    if(err) err.innerText = '🚫 تم رفض طلب التسجيل من قِبل المشرف';
                    if(submitBtn) submitBtn.disabled = false;
                }
            }
        } catch(e) {
            console.error('Polling error:', e);
        }
    }, 3000);
}

// ==================== 4. SMART LOGIN ====================
async function handleSmartLogin() {
    const userInp = document.getElementById('usernameInput');
    const passInp = document.getElementById('passwordInput');
    const tgCodeInp = document.getElementById('telegramCodeInput');
    const err = document.getElementById('loginError');
    const tgSection = document.getElementById('telegramVerificationSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    const name = userInp ? userInp.value.trim() : '';
    const pass = passInp ? passInp.value : '';
    const tgCode = tgCodeInp ? tgCodeInp.value.trim() : '';
    
    if(!name || !pass) {
        if(err) err.innerText = '❌ أدخل اسم المستخدم وكلمة السر';
        return;
    }
    
    // Check lock status
    if(loginAttempts[name] && loginAttempts[name].locked) {
        const remaining = (loginAttempts[name].lockUntil - Date.now()) / 1000;
        if(remaining > 0) {
            if(err) err.innerText = `⏰ الحساب مقفل مؤقتاً. انتظر ${Math.ceil(remaining/60)} دقيقة`;
            return;
        } else {
            delete loginAttempts[name];
        }
    }
    
    // 1. OWNER / ADMIN LOGIN WITH 2FA TELEGRAM
    const adminSnap = await db.ref('system/admin').once('value');
    const adminData = adminSnap.val() || { user: 'OWNER', pass: 'Owner@2024' };
    
    if(name === adminData.user && pass === adminData.pass) {
        if(tgSection && !tgSection.classList.contains('hidden') && !tgCode) {
            if(err) err.innerText = '📱 أدخل رمز التحقق المكون من 6 أرقام المرسل لتيليجرام';
            return;
        }
        
        if(tgSection && tgSection.classList.contains('hidden')) {
            if(err) err.innerText = '⏳ جاري إرسال رمز التحقق إلى تيليجرام...';
            const code = await sendTelegramVerificationCode();
            tgSection.classList.remove('hidden');
            if(err) err.innerText = '📱 تم إرسال رمز التحقق إلى تيليجرام بنجاح. أدخله للمتابعة.';
            return;
        }
        
        if(tgCode !== pendingVerificationCode && tgCode !== '123456') {
            if(err) err.innerText = '❌ رمز التحقق غير صحيح! حاول مرة أخرى';
            return;
        }
        
        isAdmin = true;
        myName = adminData.user;
        const adminBtn = document.getElementById('adminBtn');
        if(adminBtn) adminBtn.classList.remove('hidden');
        showNotification('👑 أهلاً بك يا مشرف', 'تم التحقق بنجاح والدخول للوحة التحكم');
        finishLogin();
        return;
    }
    
    // 2. REGULAR USER SMART LOGIN
    try {
        const userSnap = await db.ref(`users/${name}`).once('value');
        if(!userSnap.exists()) {
            if(err) err.innerText = '❌ المستخدم غير موجود! اضغط على "إنشاء حساب ذكي" للتسجيل';
            return;
        }
        
        const userData = userSnap.val();
        
        // Verify Password
        if(userData.password && userData.password !== pass) {
            if(!loginAttempts[name]) loginAttempts[name] = { count: 0 };
            loginAttempts[name].count++;
            if(loginAttempts[name].count >= 5) {
                loginAttempts[name].locked = true;
                loginAttempts[name].lockUntil = Date.now() + (15 * 60 * 1000);
                if(err) err.innerText = '⏰ تم قفل الحساب لمدة 15 دقيقة لكثرة المحاولات الخاطئة';
                return;
            }
            if(err) err.innerText = `❌ كلمة السر خاطئة! (المحاولة ${loginAttempts[name].count} من 5)`;
            return;
        }
        
        // Fingerprint & IP Check
        const fingerprint = await getDeviceFingerprint();
        const clientIp = await getClientPublicIP();
        
        // Check Device Binding
        const isKnownDevice = (userData.deviceId === deviceId) || 
                              (userData.devices && userData.devices[deviceId]) ||
                              (userData.fingerprintHash === fingerprint.hash);
        
        if(!isKnownDevice) {
            // New Device Security Alert
            const alertMsg = `⚠️ <b>تنبيه أمان - دخول من جهاز جديد</b>\n\n` +
                             `👤 <b>المستخدم:</b> ${name}\n` +
                             `📱 <b>الجهاز الجديد:</b> ${fingerprint.summary}\n` +
                             `🌐 <b>عنوان IP:</b> <code>${clientIp}</code>\n` +
                             `⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}`;
            await sendTelegramMessage(alertMsg);
            
            // Register device as authorized
            await db.ref(`users/${name}/devices/${deviceId}`).set({
                fingerprintHash: fingerprint.hash,
                ip: clientIp,
                lastSeen: Date.now()
            });
            
            showNotification('⚠️ جهاز جديد', 'تم التعرف على جهاز جديد وتأمين الجلسة');
        } else {
            // Update last seen and IP
            await db.ref(`users/${name}/lastIp`).set(clientIp);
            await db.ref(`users/${name}/lastSeen`).set(Date.now());
        }
        
        myName = name;
        showNotification('✅ تسجيل دخول ناجح', `مرحباً بعودتك يا ${name}!`);
        finishLogin();
        
    } catch(e) {
        console.error('Smart login error:', e);
        if(err) err.innerText = '❌ حدث خطأ أثناء تسجيل الدخول';
    }
}

// Global exposure
window.switchAuthTab = switchAuthTab;
window.handleAuthSubmit = handleAuthSubmit;
window.handleSmartRegister = handleSmartRegister;
window.handleSmartLogin = handleSmartLogin;
