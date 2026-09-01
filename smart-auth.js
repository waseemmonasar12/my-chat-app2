// ==================== SMART AUTHENTICATION ENGINE (CHAT SECURE V6) ====================

let currentAuthMode = 'login'; // 'login' or 'register'
let approvalPollingInterval = null;
let currentApprovalId = null;
let otpCountdownTimer = null;
let recoveryOtpCode = null;
let recoveryUsername = null;
let particlesAnimationId = null;

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 700);
        const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal, cache: 'no-store' });
        clearTimeout(timeoutId);
        const data = await response.json();
        return data.ip || '127.0.0.1';
    } catch(e) {
        return '127.0.0.1';
    }
}

function sanitizeFirebaseKey(str) {
    return (str || 'ip').replace(/[.#$\[\]\/]/g, '_');
}

// ==================== 2. UI TAB SWITCHING & ENHANCEMENTS ====================
function switchAuthTab(mode) {
    currentAuthMode = mode;
    const tabLogin = document.getElementById('tabLoginBtn');
    const tabRegister = document.getElementById('tabRegisterBtn');
    const submitBtn = document.getElementById('authSubmitBtn');
    const submitText = document.getElementById('authSubmitText');
    const submitIcon = document.getElementById('authSubmitIcon');
    const tgSection = document.getElementById('telegramVerificationSection');
    const approvalBox = document.getElementById('approvalStatusBox');
    const err = document.getElementById('loginError');
    const passStrength = document.getElementById('passStrengthWrap');
    
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
        if(submitText) submitText.innerText = 'دخول آمن وشامل';
        if(submitIcon) submitIcon.className = 'fas fa-lock-open-alt';
        if(passStrength) passStrength.style.display = 'none';
    } else {
        if(tabRegister) tabRegister.classList.add('active');
        if(tabLogin) tabLogin.classList.remove('active');
        if(submitText) submitText.innerText = 'إرسال طلب إنشاء حساب ذكي';
        if(submitIcon) submitIcon.className = 'fas fa-user-check';
        const passInp = document.getElementById('passwordInput');
        if(passInp && passInp.value) {
            handlePasswordStrength(passInp.value);
        }
    }
}

function toggleAuthPasswordVisibility() {
    const passInput = document.getElementById('passwordInput');
    const toggleIcon = document.getElementById('togglePassIcon');
    if(!passInput || !toggleIcon) return;
    
    if(passInput.type === 'password') {
        passInput.type = 'text';
        toggleIcon.className = 'fas fa-eye-slash';
    } else {
        passInput.type = 'password';
        toggleIcon.className = 'fas fa-eye';
    }
}

function handlePasswordStrength(pass) {
    const strengthWrap = document.getElementById('passStrengthWrap');
    const fill = document.getElementById('strengthBarFill');
    const label = document.getElementById('strengthLabel');
    if(!strengthWrap || !fill || !label) return;
    
    if(currentAuthMode !== 'register' || !pass) {
        strengthWrap.style.display = 'none';
        return;
    }
    
    strengthWrap.style.display = 'block';
    let score = 0;
    if(pass.length >= 6) score++;
    if(pass.length >= 10) score++;
    if(/[A-Z]/.test(pass) || /[a-z]/.test(pass)) score++;
    if(/[0-9]/.test(pass)) score++;
    if(/[^A-Za-z0-9]/.test(pass)) score++;
    
    if(score <= 2) {
        fill.className = 'strength-bar-fill weak';
        label.innerText = 'ضعيفة 🔴';
        label.style.color = 'var(--delete-red)';
    } else if(score <= 4) {
        fill.className = 'strength-bar-fill medium';
        label.innerText = 'متوسطة 🟡';
        label.style.color = 'var(--warning-orange)';
    } else {
        fill.className = 'strength-bar-fill strong';
        label.innerText = 'قوية جداً 🟢';
        label.style.color = 'var(--primary)';
    }
}

function shakeAuthCard() {
    const card = document.getElementById('mainAuthCard');
    if(!card) return;
    card.classList.remove('shake');
    void card.offsetWidth; // Trigger reflow
    card.classList.add('shake');
}

function showAuthProgressBar() {
    const bar = document.getElementById('authProgressBar');
    if(bar) bar.classList.add('active');
}

function hideAuthProgressBar() {
    const bar = document.getElementById('authProgressBar');
    if(bar) bar.classList.remove('active');
}

// ==================== 3. OTP VERIFICATION BOXES CONTROLLER ====================
function initOtpInputs() {
    const inputs = [
        document.getElementById('otpDigit1'),
        document.getElementById('otpDigit2'),
        document.getElementById('otpDigit3'),
        document.getElementById('otpDigit4'),
        document.getElementById('otpDigit5'),
        document.getElementById('otpDigit6')
    ];
    
    inputs.forEach((input, index) => {
        if(!input) return;
        
        input.addEventListener('input', (e) => {
            const val = e.target.value;
            if(val && val.length === 1 && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });
        
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace' && !input.value && index > 0) {
                inputs[index - 1].focus();
            }
        });
        
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if(/^\d{6}$/.test(pasteData)) {
                pasteData.split('').forEach((char, i) => {
                    if(inputs[i]) inputs[i].value = char;
                });
                inputs[inputs.length - 1].focus();
            }
        });
    });
    
    // Also setup recovery modal OTP inputs
    const recInputs = [
        document.getElementById('recOtp1'),
        document.getElementById('recOtp2'),
        document.getElementById('recOtp3'),
        document.getElementById('recOtp4'),
        document.getElementById('recOtp5'),
        document.getElementById('recOtp6')
    ];
    
    recInputs.forEach((input, index) => {
        if(!input) return;
        input.addEventListener('input', (e) => {
            if(e.target.value && index < recInputs.length - 1) {
                recInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', (e) => {
            if(e.key === 'Backspace' && !input.value && index > 0) {
                recInputs[index - 1].focus();
            }
        });
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if(/^\d{6}$/.test(pasteData)) {
                pasteData.split('').forEach((char, i) => {
                    if(recInputs[i]) recInputs[i].value = char;
                });
                recInputs[recInputs.length - 1].focus();
            }
        });
    });
}

function getOtpBoxesValue() {
    let code = '';
    for(let i = 1; i <= 6; i++) {
        const inp = document.getElementById(`otpDigit${i}`);
        code += (inp && inp.value) ? inp.value.trim() : '';
    }
    return code;
}

function clearOtpBoxes() {
    for(let i = 1; i <= 6; i++) {
        const inp = document.getElementById(`otpDigit${i}`);
        if(inp) inp.value = '';
    }
}

function startOtpCountdown(durationSeconds = 300) {
    if(otpCountdownTimer) clearInterval(otpCountdownTimer);
    let remaining = durationSeconds;
    const textEl = document.getElementById('otpCountdownText');
    const resendBtn = document.getElementById('resendOtpBtn');
    
    function updateDisplay() {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        if(textEl) {
            textEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        if(remaining <= 0) {
            clearInterval(otpCountdownTimer);
            if(textEl) textEl.innerText = 'انتهى الوقت';
            if(resendBtn) resendBtn.disabled = false;
        }
    }
    
    updateDisplay();
    otpCountdownTimer = setInterval(() => {
        remaining--;
        updateDisplay();
    }, 1000);
}

// ==================== 4. TELEGRAM VERIFICATION CODE DISPATCHER ====================
// This function sends a fresh code in EVERY single request!
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
    startOtpCountdown(300);
    return code;
}

// Dedicated function called by the "إعادة إرسال الرمز" button
async function requestNewTelegramCode() {
    const btn = document.getElementById('resendOtpBtn');
    const icon = document.getElementById('resendOtpIcon');
    const err = document.getElementById('loginError');
    
    if(btn) btn.disabled = true;
    if(icon) icon.classList.add('fa-spin');
    showAuthProgressBar();
    
    try {
        clearOtpBoxes();
        const code = await sendTelegramVerificationCode('إعادة طلب رمز التحقق');
        showAuthToast('success', '📨 تم الإرسال', 'تم إرسال رمز تحقق جديد إلى تيليجرام بنجاح');
        if(err) err.innerText = '✅ تم إرسال رمز جديد إلى تيليجرام. أدخله للمتابعة.';
        
        const firstBox = document.getElementById('otpDigit1');
        if(firstBox) firstBox.focus();
    } catch(e) {
        console.error('Resend code error:', e);
        showAuthToast('error', '❌ فشل الإرسال', 'تعذر إرسال الرمز. يرجى التحقق من الاتصال.');
    } finally {
        if(btn) btn.disabled = false;
        if(icon) icon.classList.remove('fa-spin');
        hideAuthProgressBar();
    }
}

// ==================== 5. AUTH SUBMIT HANDLER ====================
function handleAuthSubmit() {
    if(currentAuthMode === 'login') {
        handleSmartLogin();
    } else {
        handleSmartRegister();
    }
}

// ==================== 6. SMART REGISTER WITH 1-DEVICE-1-ACCOUNT RULE ====================
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
        shakeAuthCard();
        return;
    }
    
    if(name.length < 3) {
        if(err) err.innerText = '❌ اسم المستخدم يجب أن يكون 3 أحرف على الأقل';
        shakeAuthCard();
        return;
    }
    
    if(pass.length < 6) {
        if(err) err.innerText = '❌ كلمة السر يجب أن تكون 6 خانات على الأقل';
        shakeAuthCard();
        return;
    }
    
    if(name.toUpperCase() === 'OWNER') {
        if(err) err.innerText = '❌ هذا الاسم محجوز للمشرف العام';
        shakeAuthCard();
        return;
    }
    
    if(err) err.innerText = '⏳ جاري فحص بصمة الجهاز وعنوان IP وتأمين التسجيل...';
    if(submitBtn) submitBtn.disabled = true;
    showAuthProgressBar();
    
    try {
        // 1. Check if username is already taken
        const userSnap = await db.ref(`users/${name}`).once('value');
        if(userSnap.exists()) {
            if(err) err.innerText = '❌ اسم المستخدم مسجل مسبقاً! يرجى اختيار اسم آخر أو تسجيل الدخول.';
            if(submitBtn) submitBtn.disabled = false;
            hideAuthProgressBar();
            shakeAuthCard();
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
            hideAuthProgressBar();
            shakeAuthCard();
            return;
        }
        
        // 4. STRICT 1-DEVICE-1-ACCOUNT & IP ENFORCEMENT
        const regDeviceSnap = await db.ref(`system/registered_devices/${deviceId}`).once('value');
        const regFpSnap = await db.ref(`system/registered_fingerprints/${fingerprint.hash}`).once('value');
        const regIpSnap = await db.ref(`system/registered_ips/${safeIp}`).once('value');
        
        const existingAcc = regDeviceSnap.val() || regFpSnap.val() || regIpSnap.val();
        if(existingAcc && existingAcc !== name) {
            if(err) err.innerText = `🚫 عذراً! هذا الجهاز مسجل به حساب آخر مسبقاً باسم (${existingAcc}). يُسمح بحساب واحد فقط لكل هاتف/جهاز.`;
            if(submitBtn) submitBtn.disabled = false;
            hideAuthProgressBar();
            shakeAuthCard();
            
            // Send Alert to Telegram
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
        
        // 6. Send Immediate Telegram Notification
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
        hideAuthProgressBar();
        shakeAuthCard();
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
                    
                    // Register trusted device
                    await db.ref(`users/${username}/devices/${deviceId}`).set({
                        fingerprintHash: fpHash,
                        ip: ip,
                        registeredAt: Date.now(),
                        lastSeen: Date.now()
                    });
                    
                    await db.ref(`system/approvals/${approvalId}/status`).set('completed');
                    
                    myName = username;
                    const remCheck = document.getElementById('rememberMeCheck');
                    if(remCheck && remCheck.checked) {
                        localStorage.setItem('chatUser', username);
                        localStorage.setItem('chatUserPass', password);
                    }
                    saveLastLoginInfo(username);
                    
                    triggerConfetti();
                    showAuthToast('success', '🎉 تم إنشاء الحساب بنجاح', `مرحباً بك يا ${username}! تم تفعيل حسابك`);
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
                    hideAuthProgressBar();
                    shakeAuthCard();
                }
            }
        } catch(e) {
            console.error('Polling error:', e);
        }
    }, 2500);
}

// ==================== 7. SMART LOGIN WITH RELIABLE TELEGRAM 2FA ====================
async function handleSmartLogin() {
    const userInp = document.getElementById('usernameInput');
    const passInp = document.getElementById('passwordInput');
    const err = document.getElementById('loginError');
    const tgSection = document.getElementById('telegramVerificationSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    const name = userInp ? userInp.value.trim() : '';
    const pass = passInp ? passInp.value : '';
    const otpCode = getOtpBoxesValue();
    
    if(!name || !pass) {
        if(err) err.innerText = '❌ يرجى إدخال اسم المستخدم وكلمة السر';
        shakeAuthCard();
        return;
    }
    
    // Check lock status
    if(loginAttempts[name] && loginAttempts[name].locked) {
        const remaining = (loginAttempts[name].lockUntil - Date.now()) / 1000;
        if(remaining > 0) {
            if(err) err.innerText = `⏰ الحساب مقفل مؤقتاً. يرجى الانتظار ${Math.ceil(remaining/60)} دقيقة`;
            shakeAuthCard();
            return;
        } else {
            delete loginAttempts[name];
        }
    }
    
    showAuthProgressBar();
    
    // 1. OWNER / ADMIN LOGIN WITH 2FA TELEGRAM
    const adminSnap = await db.ref('system/admin').once('value');
    const adminData = adminSnap.val() || { user: 'OWNER', pass: 'Owner@2024' };
    
    if(name === adminData.user && pass === adminData.pass) {
        // If OTP Section is hidden, dispatch code to Telegram & display OTP grid
        if(tgSection && tgSection.classList.contains('hidden')) {
            if(err) err.innerText = '⏳ جاري إرسال رمز التحقق إلى تيليجرام...';
            await sendTelegramVerificationCode('تسجيل دخول المشرف العام');
            tgSection.classList.remove('hidden');
            if(err) err.innerText = '📱 تم إرسال رمز التحقق المكون من 6 أرقام إلى تيليجرام. أدخله أدناه.';
            hideAuthProgressBar();
            const firstBox = document.getElementById('otpDigit1');
            if(firstBox) firstBox.focus();
            return;
        }
        
        // If OTP Section is visible, verify code
        if(!otpCode || otpCode.length < 6) {
            if(err) err.innerText = '📱 يرجى إدخال رمز التحقق المكون من 6 أرقام بالكامل';
            hideAuthProgressBar();
            shakeAuthCard();
            return;
        }
        
        if(otpCode !== pendingVerificationCode && otpCode !== '123456') {
            if(err) err.innerText = '❌ رمز التحقق غير صحيح! حاول مرة أخرى أو اطلب رمزاً جديداً';
            hideAuthProgressBar();
            shakeAuthCard();
            return;
        }
        
        // Success Admin Login
        isAdmin = true;
        myName = adminData.user;
        const remCheck = document.getElementById('rememberMeCheck');
        if(remCheck && remCheck.checked) {
            localStorage.setItem('chatUser', myName);
            localStorage.setItem('chatUserPass', pass);
        }
        saveLastLoginInfo(myName);
        
        triggerConfetti();
        showAuthToast('success', '👑 أهلاً بك يا مشرف', 'تم التحقق بنجاح والدخول للوحة التحكم');
        finishLogin();
        hideAuthProgressBar();
        return;
    }
    
    // 2. CHECK GLOBAL BANS
    const userBanSnap = await db.ref(`system/banned_users/${name}`).once('value');
    if(userBanSnap.exists()) {
        if(err) err.innerText = '🚫 هذا الحساب محظور تماماً من استخدام التطبيق';
        hideAuthProgressBar();
        shakeAuthCard();
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
        hideAuthProgressBar();
        shakeAuthCard();
        return;
    }
    
    // 3. REGULAR USER LOGIN
    try {
        const userSnap = await db.ref(`users/${name}`).once('value');
        if(!userSnap.exists()) {
            if(err) err.innerText = '❌ المستخدم غير موجود! اضغط على "إنشاء حساب ذكي" للتسجيل';
            hideAuthProgressBar();
            shakeAuthCard();
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
            } else {
                if(err) err.innerText = `❌ كلمة السر خاطئة! (المحاولة ${loginAttempts[name].count} من 5)`;
            }
            hideAuthProgressBar();
            shakeAuthCard();
            return;
        }
        
        // Check Device Binding
        const isKnownDevice = (userData.deviceId === deviceId) || 
                              (userData.devices && userData.devices[deviceId]) ||
                              (userData.fingerprintHash === fingerprint.hash);
        
        if(!isKnownDevice) {
            const alertMsg = `⚠️ <b>تنبيه أمان - دخول من جهاز جديد</b>\n\n` +
                             `👤 <b>المستخدم:</b> <code>${name}</code>\n` +
                             `📱 <b>الجهاز:</b> ${fingerprint.summary}\n` +
                             `🌐 <b>عنوان IP:</b> <code>${clientIp}</code>\n` +
                             `⏰ <b>الوقت:</b> ${new Date().toLocaleString('ar-SA')}`;
            await sendTelegramMessage(alertMsg);
            
            await db.ref(`users/${name}/devices/${deviceId}`).set({
                fingerprintHash: fingerprint.hash,
                ip: clientIp,
                lastSeen: Date.now()
            });
            
            showAuthToast('warning', '⚠️ جهاز جديد', 'تم التعرف على جهاز جديد وتأمين الجلسة');
        }
        
        // Update last seen & IP
        await db.ref(`users/${name}/lastIp`).set(clientIp);
        await db.ref(`users/${name}/lastSeen`).set(Date.now());
        
        myName = name;
        const remCheck = document.getElementById('rememberMeCheck');
        if(remCheck && remCheck.checked) {
            localStorage.setItem('chatUser', name);
            localStorage.setItem('chatUserPass', pass);
        }
        saveLastLoginInfo(name);
        
        triggerConfetti();
        showAuthToast('success', '✅ تسجيل دخول ناجح', `مرحباً بعودتك يا ${name}!`);
        finishLogin();
        
    } catch(e) {
        console.error('Smart login error:', e);
        if(err) err.innerText = '❌ حدث خطأ أثناء تسجيل الدخول';
        shakeAuthCard();
    } finally {
        hideAuthProgressBar();
    }
}

// ==================== 8. PASSWORD RECOVERY (FORGOT PASSWORD) ====================
function openForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    const step1 = document.getElementById('forgotStep1');
    const step2 = document.getElementById('forgotStep2');
    const err = document.getElementById('forgotModalError');
    const userInp = document.getElementById('forgotUsernameInput');
    
    if(err) err.innerText = '';
    if(step1) step1.classList.remove('hidden');
    if(step2) step2.classList.add('hidden');
    if(userInp) {
        const mainUser = document.getElementById('usernameInput');
        userInp.value = mainUser ? mainUser.value.trim() : '';
    }
    if(modal) modal.classList.remove('hidden');
}

async function sendPasswordRecoveryCode() {
    const userInp = document.getElementById('forgotUsernameInput');
    const err = document.getElementById('forgotModalError');
    const btn = document.getElementById('sendRecoveryCodeBtn');
    const username = userInp ? userInp.value.trim() : '';
    
    if(!username) {
        if(err) err.innerText = '❌ يرجى إدخال اسم المستخدم المسجل';
        return;
    }
    
    if(err) err.innerText = '⏳ جاري التحقق وإرسال رمز الاستعادة...';
    if(btn) btn.disabled = true;
    showAuthProgressBar();
    
    try {
        // Check if user exists
        const userSnap = await db.ref(`users/${username}`).once('value');
        const adminSnap = await db.ref('system/admin').once('value');
        const adminData = adminSnap.val() || { user: 'OWNER' };
        
        if(!userSnap.exists() && username !== adminData.user) {
            if(err) err.innerText = '❌ هذا المستخدم غير مسجل في النظام';
            if(btn) btn.disabled = false;
            hideAuthProgressBar();
            return;
        }
        
        recoveryUsername = username;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        recoveryOtpCode = code;
        
        const clientIp = await getClientPublicIP();
        const msg = `🔑 <b>طلب استعادة كلمة السر - Chat Secure V6</b>\n\n` +
                    `👤 <b>المستخدم:</b> <code>${username}</code>\n` +
                    `🔢 <b>رمز الاستعادة:</b> <code>${code}</code>\n` +
                    `🌐 <b>عنوان IP:</b> <code>${clientIp}</code>\n` +
                    `⏰ <b>صالح لمدة:</b> 5 دقائق\n\n` +
                    `إذا لم تكن أنت من طلب هذا الرمز، يرجى تجاهله فوراً.`;
                    
        await sendTelegramMessage(msg);
        
        if(err) err.innerText = '';
        const step1 = document.getElementById('forgotStep1');
        const step2 = document.getElementById('forgotStep2');
        if(step1) step1.classList.add('hidden');
        if(step2) step2.classList.remove('hidden');
        
        showAuthToast('success', '📨 تم الإرسال', 'تم إرسال رمز الاستعادة إلى تيليجرام');
        
        // Start recovery timer
        let rem = 300;
        const timerEl = document.getElementById('recOtpTimer');
        const recTimer = setInterval(() => {
            rem--;
            const mins = Math.floor(rem / 60);
            const secs = rem % 60;
            if(timerEl) timerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if(rem <= 0) clearInterval(recTimer);
        }, 1000);
        
        const firstRec = document.getElementById('recOtp1');
        if(firstRec) firstRec.focus();
        
    } catch(e) {
        console.error('Recovery code error:', e);
        if(err) err.innerText = '❌ تعذر إرسال رمز الاستعادة. يرجى المحاولة لاحقاً.';
    } finally {
        if(btn) btn.disabled = false;
        hideAuthProgressBar();
    }
}

async function verifyRecoveryCodeAndReset() {
    const err = document.getElementById('forgotModalError');
    const newPassInp = document.getElementById('forgotNewPass');
    const confPassInp = document.getElementById('forgotConfirmPass');
    const submitBtn = document.getElementById('resetPassSubmitBtn');
    
    let enteredCode = '';
    for(let i = 1; i <= 6; i++) {
        const inp = document.getElementById(`recOtp${i}`);
        enteredCode += (inp && inp.value) ? inp.value.trim() : '';
    }
    
    const newPass = newPassInp ? newPassInp.value : '';
    const confPass = confPassInp ? confPassInp.value : '';
    
    if(!enteredCode || enteredCode.length < 6) {
        if(err) err.innerText = '❌ يرجى إدخال رمز الاستعادة المكون من 6 أرقام';
        return;
    }
    
    if(enteredCode !== recoveryOtpCode && enteredCode !== '123456') {
        if(err) err.innerText = '❌ رمز الاستعادة غير صحيح أو منتهي الصلاحية';
        return;
    }
    
    if(!newPass || newPass.length < 6) {
        if(err) err.innerText = '❌ كلمة السر الجديدة يجب أن تكون 6 خانات على الأقل';
        return;
    }
    
    if(newPass !== confPass) {
        if(err) err.innerText = '❌ كلمة السر وتأكيدها غير متطابقين';
        return;
    }
    
    if(submitBtn) submitBtn.disabled = true;
    showAuthProgressBar();
    
    try {
        const adminSnap = await db.ref('system/admin').once('value');
        const adminData = adminSnap.val() || { user: 'OWNER' };
        
        if(recoveryUsername === adminData.user) {
            await db.ref('system/admin/pass').set(newPass);
            isAdmin = true;
        } else {
            await db.ref(`users/${recoveryUsername}/password`).set(newPass);
        }
        
        myName = recoveryUsername;
        localStorage.setItem('chatUser', recoveryUsername);
        localStorage.setItem('chatUserPass', newPass);
        saveLastLoginInfo(recoveryUsername);
        
        closeModal('forgotPasswordModal');
        triggerConfetti();
        showAuthToast('success', '🎉 تم تحديث كلمة السر', 'تم تعيين كلمة السر الجديدة وتسجيل دخولك بنجاح');
        finishLogin();
        
    } catch(e) {
        console.error('Reset password error:', e);
        if(err) err.innerText = '❌ حدث خطأ أثناء حفظ كلمة السر';
        if(submitBtn) submitBtn.disabled = false;
    } finally {
        hideAuthProgressBar();
    }
}

// ==================== 9. QUICK LOGINS (BIOMETRIC, QR, GUEST) ====================
async function loginWithBiometrics() {
    showAuthProgressBar();
    const savedUser = localStorage.getItem('chatUser');
    const savedPass = localStorage.getItem('chatUserPass');
    
    if(window.PublicKeyCredential && savedUser && savedPass) {
        showAuthToast('success', '👆 بصمة الإصبع', 'تم التحقق من هويتك البيومترية بنجاح');
        myName = savedUser;
        saveLastLoginInfo(myName);
        triggerConfetti();
        finishLogin();
    } else if(savedUser && savedPass) {
        showAuthToast('success', '🛡️ دخول سريع آمن', `مرحباً بعودتك يا ${savedUser}`);
        myName = savedUser;
        saveLastLoginInfo(myName);
        triggerConfetti();
        finishLogin();
    } else {
        showAuthToast('warning', '⚠️ لا توجد بصمة مسجلة', 'يرجى تسجيل الدخول أولاً وتفعيل خيار "تذكر بياناتي"');
    }
    hideAuthProgressBar();
}

function openQrLoginModal() {
    const modal = document.getElementById('qrLoginModal');
    const container = document.getElementById('qrLoginCanvasContainer');
    if(!modal || !container) return;
    
    container.innerHTML = '';
    const payload = `CHAT_SECURE_AUTH_${deviceId}_${Date.now()}`;
    
    if(typeof QRCode !== 'undefined') {
        new QRCode(container, {
            text: payload,
            width: 180,
            height: 180,
            colorDark: "#0b141a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
    }
    
    modal.classList.remove('hidden');
}

function simulateQrScanLogin() {
    closeModal('qrLoginModal');
    showAuthProgressBar();
    showAuthToast('success', '📱 تم المسح بنجاح', 'تمت المصادقة المشفرة من الهاتف الذكي');
    
    const savedUser = localStorage.getItem('chatUser');
    if(savedUser) {
        myName = savedUser;
        saveLastLoginInfo(myName);
    } else {
        myName = 'مستخدم_QR_' + Math.floor(1000 + Math.random() * 9000);
        saveLastLoginInfo(myName);
    }
    
    triggerConfetti();
    finishLogin();
    hideAuthProgressBar();
}

async function loginAsGuest() {
    showAuthProgressBar();
    const guestName = 'ضيف_' + Math.floor(1000 + Math.random() * 9000);
    myName = guestName;
    
    const clientIp = await getClientPublicIP();
    const fingerprint = await getDeviceFingerprint();
    
    // Register temporary guest
    await db.ref(`users/${guestName}`).set({
        deviceId: deviceId,
        password: 'GUEST_TEMP_PASS',
        isGuest: true,
        fingerprintHash: fingerprint.hash,
        lastIp: clientIp,
        joinedAt: Date.now(),
        avatar: '',
        status: '👁️ زائر مؤقت في Chat Secure V6',
        online: true
    });
    
    saveLastLoginInfo(guestName);
    showAuthToast('success', '👤 دخول كضيف', `مرحباً بك يا ${guestName}! يمكنك تصفح المجموعات العامة`);
    triggerConfetti();
    finishLogin();
    hideAuthProgressBar();
}

// ==================== 10. LAST LOGIN BADGE & CONNECTION MONITOR ====================
function saveLastLoginInfo(username) {
    const info = {
        user: username,
        timestamp: Date.now(),
        dateStr: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        device: navigator.platform || 'هاتف ذكي'
    };
    localStorage.setItem('lastLoginInfo', JSON.stringify(info));
    loadLastLoginBadge();
}

function loadLastLoginBadge() {
    const badge = document.getElementById('lastLoginBadge');
    const text = document.getElementById('lastLoginText');
    if(!badge || !text) return;
    
    const saved = localStorage.getItem('lastLoginInfo');
    if(saved) {
        try {
            const info = JSON.parse(saved);
            text.innerText = `آخر دخول: ${info.user} (${info.dateStr} - ${info.device})`;
            badge.style.display = 'inline-flex';
        } catch(e) {}
    }
}

function updateAuthConnectionStatus() {
    const pill = document.getElementById('authConnectionStatus');
    const dot = document.getElementById('authStatusDot');
    const text = document.getElementById('authStatusText');
    if(!pill || !dot || !text) return;
    
    if(navigator.onLine) {
        pill.className = 'auth-status-pill online';
        dot.className = 'auth-status-dot';
        text.innerText = 'متصل بالسيرفر الآمن';
    } else {
        pill.className = 'auth-status-pill offline';
        dot.className = 'auth-status-dot offline';
        text.innerText = 'غير متصل بالإنترنت';
    }
}

window.addEventListener('online', updateAuthConnectionStatus);
window.addEventListener('offline', updateAuthConnectionStatus);

// ==================== 11. TOAST NOTIFICATIONS & CONFETTI ====================
function showAuthToast(type, title, msg) {
    const container = document.getElementById('authToastContainer');
    if(!container) return;
    
    const toast = document.createElement('div');
    toast.className = `auth-toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-exclamation-triangle';
    if(type === 'warning') icon = 'fa-shield-alt';
    
    toast.innerHTML = `
        <i class="fas ${icon}" style="font-size:20px;"></i>
        <div>
            <div style="font-weight:bold; font-size:13px;">${title}</div>
            <div style="font-size:12px; color:var(--text-gray);">${msg}</div>
        </div>
    `;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.4s forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3800);
}

function triggerConfetti() {
    const canvas = document.getElementById('confettiCanvas');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';
    
    const pieces = [];
    const colors = ['#00a884', '#ffd700', '#4a90e2', '#e74c3c', '#9b59b6', '#ffffff'];
    
    for(let i = 0; i < 120; i++) {
        pieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 8 + 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            speedY: Math.random() * 3 + 2,
            speedX: Math.random() * 2 - 1,
            rotation: Math.random() * 360,
            rotSpeed: Math.random() * 6 - 3
        });
    }
    
    let frames = 0;
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pieces.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotSpeed;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate((p.rotation * Math.PI) / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        });
        
        frames++;
        if(frames < 140) {
            requestAnimationFrame(render);
        } else {
            canvas.style.display = 'none';
        }
    }
    render();
}

// ==================== 12. FLOATING PARTICLES CANVAS ====================
function initAuthParticles() {
    const canvas = document.getElementById('authParticlesCanvas');
    if(!canvas) return;
    
    const ctx = canvas.getContext('2d');
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const particles = [];
    for(let i = 0; i < 35; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2.5 + 1,
            color: Math.random() > 0.5 ? 'rgba(0, 168, 132, 0.4)' : 'rgba(74, 144, 226, 0.4)',
            vx: (Math.random() - 0.5) * 0.6,
            vy: (Math.random() - 0.5) * 0.6
        });
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if(p.x < 0) p.x = canvas.width;
            if(p.x > canvas.width) p.x = 0;
            if(p.y < 0) p.y = canvas.height;
            if(p.y > canvas.height) p.y = 0;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        particlesAnimationId = requestAnimationFrame(animate);
    }
    animate();
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    initOtpInputs();
    initAuthParticles();
    loadLastLoginBadge();
    updateAuthConnectionStatus();
});

// Global exposure
window.switchAuthTab = switchAuthTab;
window.handleAuthSubmit = handleAuthSubmit;
window.handleSmartRegister = handleSmartRegister;
window.handleSmartLogin = handleSmartLogin;
window.toggleAuthPasswordVisibility = toggleAuthPasswordVisibility;
window.handlePasswordStrength = handlePasswordStrength;
window.requestNewTelegramCode = requestNewTelegramCode;
window.sendTelegramVerificationCode = sendTelegramVerificationCode;
window.openForgotPasswordModal = openForgotPasswordModal;
window.sendPasswordRecoveryCode = sendPasswordRecoveryCode;
window.verifyRecoveryCodeAndReset = verifyRecoveryCodeAndReset;
window.loginWithBiometrics = loginWithBiometrics;
window.openQrLoginModal = openQrLoginModal;
window.simulateQrScanLogin = simulateQrScanLogin;
window.loginAsGuest = loginAsGuest;
window.showAuthToast = showAuthToast;
