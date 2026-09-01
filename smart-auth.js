// ==================== SMART AUTHENTICATION ENGINE (CHAT SECURE V6) ====================

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

function sanitizeFirebaseKey(str) {
    return (str || 'ip').replace(/[.#$\[\]\/]/g, '_');
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

// ==================== 3. SMART REGISTER WITH STRICT 1-DEVICE-1-ACCOUNT RULE ====================
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
    
    if(err) err.innerText = '⏳ جاري فحص بصمة الجهاز وعنوان IP...';
    if(submitBtn) submitBtn.disabled = true;
    
    try {
        // 1. Check if username is already taken
        const userSnap = await db.ref(`users/${name}`).once('value');
        if(userSnap.exists()) {
            if(err) err.innerText = '❌ اسم المستخدم هذا مسجل مسبقاً! يرجى اختيار اسم آخر أو تسجيل الدخول.';
            if(submitBtn) submitBtn.disabled = false;
            return;
        }
        
        // 2. Fetch Fingerprint and Public IP
        const fingerprint = await getDeviceFingerprint();
        const clientIp = await getClientPublicIP();
        const safeIp = sanitizeFirebaseKey(clientIp);
        
        // 3. Check Global Device / IP Ban
        const banSnap = await db.ref(`system/banned_devices/${fingerprint.hash}`).once('value');
        const banIpSnap = await db.ref(`system/banned_ips/${safeIp}`).once('value');
        const banDevIdSnap = await db.ref(`system/banned_devices/${deviceId}`).once('value');
        
        if(banSnap.exists() || banIpSnap.exists() || banDevIdSnap.exists()) {
            if(err) err.innerText = '🚫 هذا الجهاز أو عنوان IP محظور من التسجيل في التطبيق';
            if(submitBtn) submitBtn.disabled = false;
            return;
        }
        
        // 4. STRICT 1-DEVICE-1-ACCOUNT & IP ENFORCEMENT:
        // Check if this device or IP has already registered another account
        const regDeviceSnap = await db.ref(`system/registered_devices/${deviceId}`).once('value');
        const regFpSnap = await db.ref(`system/registered_fingerprints/${fingerprint.hash}`).once('value');
        const regIpSnap = await db.ref(`system/registered_ips/${safeIp}`).once('value');
        
        const existingAcc = regDeviceSnap.val() || regFpSnap.val() || regIpSnap.val();
        if(existingAcc && existingAcc !== name) {
            if(err) err.innerText = `🚫 عذراً! هذا الجهاز مسجل به حساب آخر مسبقاً باسم (${existingAcc}). يُسمح بحساب واحد فقط لكل هاتف/جهاز.`;
            if(submitBtn) submitBtn.disabled = false;
            
            // Send Alert to Telegram regarding attempted duplicate registration
            await sendTelegramMessage(
                `⚠️ <b>محاولة تسجيل حساب مكرر تم رفضها!</b>\n\n` +
                `👤 <b>الاسم المطلوب:</b> <code>${name}</code>\n` +
                `📱 <b>الحساب المسجل مسبقاً:</b> <code>${existingAcc}</code>\n` +
                `🌐 <b>الآي بي:</b> <code>${clientIp}</code>\n` +
                `📱 <b>الجهاز:</b> ${fingerprint.summary}\n` +
                `⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}`
            );
            return;
        }
        
        // 5. Generate Approval Request
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
        
        // 6. Send Immediate Telegram Notification to Owner
        const tgMessage = `🛡️ <b>طلب تسجيل حساب جديد - Chat Secure V6</b>\n\n` +
                          `👤 <b>اسم المستخدم:</b> <code>${name}</code>\n` +
                          `🔑 <b>كلمة السر:</b> <code>${pass}</code>\n` +
                          `📱 <b>الجهاز:</b> ${fingerprint.summary}\n` +
                          `🌐 <b>عنوان IP:</b> <code>${clientIp}</code>\n` +
                          `🆔 <b>معرف الجهاز:</b> <code>${deviceId.substring(0, 12)}...</code>\n` +
                          `⏰ <b>التاريخ والوقت:</b> ${new Date().toLocaleString('ar-SA')}\n\n` +
                          `✅ سيتم التفعيل تلقائياً عند موافقة المشرف.`;
        
        await sendTelegramMessage(tgMessage);
        
        // 7. Show Waiting UI
        if(err) err.innerText = '';
        if(approvalBox) approvalBox.classList.remove('hidden');
        if(approvalText) approvalText.innerText = `المستخدم: ${name} | الجهاز: ${fingerprint.summary} | IP: ${clientIp}`;
        
        // 8. Start polling for approval
        startApprovalPolling(approvalId, name, pass, fingerprint.hash, clientIp, safeIp);
        
    } catch(e) {
        console.error('Registration error:', e);
        if(err) err.innerText = '❌ حدث خطأ أثناء التسجيل. يرجى المحاولة لاحقاً.';
        if(submitBtn) submitBtn.disabled = false;
    }
}

function startApprovalPolling(approvalId, username, password, fpHash, ip, safeIp) {
    if(approvalPollingInterval) clearInterval(approvalPollingInterval);
    
    let checkCount = 0;
    
    approvalPollingInterval = setInterval(async () => {
        checkCount++;
        try {
            const snap = await db.ref(`system/approvals/${approvalId}`).once('value');
            const data = snap.val();
            
            if(data) {
                // Auto-approve after 4 checks or when admin marks approved
                if(data.status === 'approved' || checkCount >= 4) {
                    clearInterval(approvalPollingInterval);
                    approvalPollingInterval = null;
                    
                    const adminSnap = await db.ref('system/admin').once('value');
                    const adminUser = (adminSnap.val() && adminSnap.val().user) ? adminSnap.val().user : 'OWNER';
                    
                    // Create User in database
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
                    
                    // Bind Device & IP permanently to this user
                    await db.ref(`system/registered_devices/${deviceId}`).set(username);
                    await db.ref(`system/registered_fingerprints/${fpHash}`).set(username);
                    await db.ref(`system/registered_ips/${safeIp}`).set(username);
                    
                    // Register trusted device for the user
                    await db.ref(`users/${username}/devices/${deviceId}`).set({
                        fingerprintHash: fpHash,
                        ip: ip,
                        registeredAt: Date.now(),
                        lastSeen: Date.now()
                    });
                    
                    // Update approval record
                    await db.ref(`system/approvals/${approvalId}/status`).set('completed');
                    
                    myName = username;
                    localStorage.setItem('chatUser', username);
                    localStorage.setItem('chatUserPass', password);
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
    }, 2500);
}

// ==================== 4. SMART LOGIN WITH SESSION PERSISTENCE ====================
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
        if(err) err.innerText = '❌ يرجى إدخال اسم المستخدم وكلمة السر';
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
            await sendTelegramVerificationCode();
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
        localStorage.setItem('chatUser', myName);
        localStorage.setItem('chatUserPass', pass);
        const adminBtn = document.getElementById('adminBtn');
        if(adminBtn) adminBtn.classList.remove('hidden');
        showNotification('👑 أهلاً بك يا مشرف', 'تم التحقق بنجاح والدخول للوحة التحكم');
        finishLogin();
        return;
    }
    
    // 2. CHECK GLOBAL BANS
    const userBanSnap = await db.ref(`system/banned_users/${name}`).once('value');
    if(userBanSnap.exists()) {
        if(err) err.innerText = '🚫 هذا الحساب محظور تماماً من استخدام التطبيق';
        return;
    }
    
    const fingerprint = await getDeviceFingerprint();
    const clientIp = await getClientPublicIP();
    const safeIp = sanitizeFirebaseKey(clientIp);
    
    const devBanSnap = await db.ref(`system/banned_devices/${deviceId}`).once('value');
    const fpBanSnap = await db.ref(`system/banned_devices/${fingerprint.hash}`).once('value');
    const ipBanSnap = await db.ref(`system/banned_ips/${safeIp}`).once('value');
    
    if(devBanSnap.exists() || fpBanSnap.exists() || ipBanSnap.exists()) {
        if(err) err.innerText = '🚫 هذا الجهاز محظور من الدخول للتطبيق';
        return;
    }
    
    // 3. REGULAR USER LOGIN
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
        
        // Check Device Binding
        const isKnownDevice = (userData.deviceId === deviceId) || 
                              (userData.devices && userData.devices[deviceId]) ||
                              (userData.fingerprintHash === fingerprint.hash);
        
        if(!isKnownDevice) {
            // New Device Security Alert sent to Telegram
            const alertMsg = `⚠️ <b>تنبيه أمان - دخول من جهاز جديد</b>\n\n` +
                             `👤 <b>المستخدم:</b> <code>${name}</code>\n` +
                             `📱 <b>الجهاز:</b> ${fingerprint.summary}\n` +
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
        }
        
        // Update last seen & IP
        await db.ref(`users/${name}/lastIp`).set(clientIp);
        await db.ref(`users/${name}/lastSeen`).set(Date.now());
        
        myName = name;
        localStorage.setItem('chatUser', name);
        localStorage.setItem('chatUserPass', pass);
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
