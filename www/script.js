(function(){
    "use strict";

    function updateLiveTime() {
        const timeEl = document.getElementById('liveTime');
        if (timeEl) {
            const now = new Date();
            timeEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        }
    }
    updateLiveTime();
    setInterval(updateLiveTime, 1000);

    const todayDateEl = document.getElementById('todayDate');
    if (todayDateEl) {
        todayDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    }

    const pages = {
        home: document.getElementById('homePage'),
        settings: document.getElementById('settingsPage'),
        active: document.getElementById('activePage'),
        history: document.getElementById('historyPage'),
        profile: document.getElementById('profilePage'),
        progress: document.getElementById('progressPage')
    };

    const tabs = document.querySelectorAll('.tab');
    const sessionTab = document.getElementById('sessionTab');
    let sessionActive = false;

    function showPage(pageId) {
        if (!pages[pageId]) return;
        Object.values(pages).forEach(p => { if (p) p.classList.remove('active'); });
        pages[pageId].classList.add('active');
        tabs.forEach(t => {
            t.classList.remove('active');
            if (t.dataset.page === pageId) t.classList.add('active');
        });
        if (pageId === 'progress') { initCharts(); updateStatsSummary(); }
    }

    function updateSessionTabVisibility() {
        if (sessionTab) sessionTab.style.display = sessionActive ? 'flex' : 'none';
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const pageId = tab.dataset.page;
            if (pageId === 'active' && !sessionActive) return;
            showPage(pageId);
        });
    });

    document.querySelectorAll('.back-btn').forEach(btn => btn.addEventListener('click', () => showPage('home')));
    document.getElementById('quickStartBtn')?.addEventListener('click', () => { configuredFreq = 50; configuredMode = 'pulse'; configuredDuration = 30; startActiveSession(); });
    document.getElementById('customSessionBtn')?.addEventListener('click', () => showPage('settings'));
    document.getElementById('scheduleNowBtn')?.addEventListener('click', () => showPage('settings'));
    document.getElementById('viewAllHistory')?.addEventListener('click', () => showPage('history'));

    let configuredFreq = 50, configuredMode = 'pulse', configuredDuration = 30;
    let sessionIntensity = 0, sessionFrequency = 50, sessionMode = 'pulse', secondsRemaining = 1800;
    let timerInterval = null, animFrame = null;

    const settingFreqSlider = document.getElementById('settingFreqSlider');
    const settingFreqValue = document.getElementById('settingFreqValue');
    if (settingFreqSlider) settingFreqSlider.addEventListener('input', e => { configuredFreq = parseInt(e.target.value); settingFreqValue.textContent = configuredFreq + ' Hz'; });

    document.querySelectorAll('.mode-option').forEach(opt => opt.addEventListener('click', () => { document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('active')); opt.classList.add('active'); configuredMode = opt.dataset.mode; }));
    document.querySelectorAll('.duration-option').forEach(opt => opt.addEventListener('click', () => { document.querySelectorAll('.duration-option').forEach(o => o.classList.remove('active')); opt.classList.add('active'); configuredDuration = parseInt(opt.dataset.time); }));

    document.getElementById('startConfiguredSessionBtn')?.addEventListener('click', startActiveSession);

    function startActiveSession() {
        sessionActive = true; sessionIntensity = 0; sessionFrequency = configuredFreq; sessionMode = configuredMode; secondsRemaining = configuredDuration * 60;
        document.getElementById('activeIntensityDisplay').textContent = '0.0';
        document.getElementById('activeFreqDisplay').textContent = sessionFrequency + ' Hz';
        document.getElementById('activeModeDisplay').textContent = { pulse: 'Pulse', continuous: 'Continuous', burst: 'Burst' }[sessionMode] || 'Pulse';
        document.getElementById('activeIntensitySlider').value = '0';
        document.getElementById('activeSliderValue').textContent = '0.0 mA';
        updateTimerDisplay(); startCountdown(); animateWaveform(); updateSessionTabVisibility(); showPage('active');
    }

    function updateTimerDisplay() {
        const d = document.getElementById('activeTimerDisplay'); if (!d) return;
        d.textContent = `${Math.floor(secondsRemaining/60).toString().padStart(2,'0')}:${(secondsRemaining%60).toString().padStart(2,'0')}`;
    }

    function startCountdown() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => { if (secondsRemaining > 0) { secondsRemaining--; updateTimerDisplay(); } if (secondsRemaining <= 0) completeSession(); }, 1000);
    }

    function completeSession() {
        clearInterval(timerInterval); sessionActive = false; updateSessionTabVisibility();
        addSessionToHistory(sessionIntensity, sessionFrequency, sessionMode, configuredDuration); showPage('history');
    }

    function addSessionToHistory(intensity, freq, mode, duration) {
        const list = document.getElementById('fullHistoryList');
        if (!list) return;
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const modeNames = { pulse: 'Pulse', continuous: 'Continuous', burst: 'Burst' };
        const newItem = document.createElement('div');
        newItem.className = 'history-item';
        newItem.innerHTML = `<div class="history-time">${timeStr}</div><div class="history-details"><span>${intensity.toFixed(1)} mA • ${freq} Hz • ${modeNames[mode]}</span><span class="duration-badge">${duration} min</span></div>`;
        const todayGroup = list.querySelector('.history-date-group');
        if (todayGroup) {
            const existingItems = todayGroup.querySelectorAll('.history-item');
            if (existingItems.length >= 2) existingItems[1].remove();
            todayGroup.appendChild(newItem);
        }
    }

    const slider = document.getElementById('activeIntensitySlider');
    slider?.addEventListener('input', e => { sessionIntensity = parseFloat(e.target.value); document.getElementById('activeIntensityDisplay').textContent = sessionIntensity.toFixed(1); document.getElementById('activeSliderValue').textContent = sessionIntensity.toFixed(1) + ' mA'; });

    document.getElementById('activeStopBtn')?.addEventListener('click', () => { clearInterval(timerInterval); sessionActive = false; updateSessionTabVisibility(); addSessionToHistory(sessionIntensity, sessionFrequency, sessionMode, Math.floor((configuredDuration*60 - secondsRemaining)/60)); showPage('history'); });

    const canvas = document.getElementById('activeWaveCanvas'), ctx = canvas?.getContext('2d');

    function animateWaveform() {
        if (!canvas || !ctx) return;
        let waveOffset = 0;
        function draw() {
            if (!sessionActive) return;
            const w = canvas.width, h = canvas.height;
            ctx.clearRect(0, 0, w, h);
            const baseAmp = (h/2 - 6) * (sessionIntensity/20), midY = h/2;
            ctx.beginPath(); ctx.strokeStyle = sessionIntensity > 0 ? '#5A9AB8' : '#3A4A5A'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            const freqFactor = sessionFrequency/50;
            for (let x=0; x<w; x+=2) {
                let y; const t = (x/w)*12 + waveOffset;
                if (sessionMode === 'burst') { const env = Math.sin(x*0.012) > 0.5 ? 1 : 0.2; y = midY + Math.sin(t*1.8*freqFactor) * baseAmp * env; }
                else if (sessionMode === 'continuous') y = midY + Math.sin(t*1.5*freqFactor) * baseAmp;
                else y = midY + Math.sin(t*2.0*freqFactor) * baseAmp;
                x === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
            }
            ctx.stroke();
            waveOffset += (sessionActive && sessionIntensity > 0) ? 0.3 : 0.03;
            if (sessionActive) animFrame = requestAnimationFrame(draw);
        }
        draw();
    }

    let tapCount=0, tapTimer=null;
    document.addEventListener('click', () => { if(!sessionActive) return; tapCount++; clearTimeout(tapTimer); tapTimer=setTimeout(()=>tapCount=0,400); if(tapCount>=3){ clearInterval(timerInterval); sessionActive=false; updateSessionTabVisibility(); showPage('home'); tapCount=0; }});

    document.querySelector('.edit-btn')?.addEventListener('click', ()=>alert('Edit profile coming soon'));

    function initBluetooth() {
        const dot = document.getElementById('btDot'), text = document.getElementById('btText');
        setInterval(() => { const ok = Math.random() > 0.1; if(dot) dot.style.background = ok ? '#4CAF50' : '#f44336'; if(text) text.textContent = ok ? 'SWAT Watch' : 'Reconnecting...'; }, 5000);
    }

    let painChart, intensityChart;
    function initCharts() {
        const pCtx = document.getElementById('painChart')?.getContext('2d'), iCtx = document.getElementById('intensityChart')?.getContext('2d');
        if (!pCtx || !iCtx) return;
        const labels = ['Apr 19','Apr 20','Apr 21','Apr 22'];
        if (painChart) painChart.destroy(); if (intensityChart) intensityChart.destroy();
        painChart = new Chart(pCtx, { type: 'line', data: { labels, datasets: [
            { label: 'Before', data: [6.8, 7.0, 7.2, 7.5], borderColor: '#5A9AB8', tension: 0.3, pointRadius: 3 },
            { label: 'After', data: [3.2, 3.0, 3.5, 3.1], borderColor: '#4CAF50', tension: 0.3, pointRadius: 3 }
        ]}, options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min:0, max:10, grid: { color: '#1E262E' }, ticks: { color: '#8A9BA8' } }, x: { ticks: { color: '#8A9BA8' } } } } });
        intensityChart = new Chart(iCtx, { type: 'line', data: { labels, datasets: [{ data: [6.5, 7.0, 7.5, 8.0], borderColor: '#FF9800', tension: 0.3, pointRadius: 3 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { min:0, max:12, grid: { color: '#1E262E' }, ticks: { color: '#8A9BA8' } }, x: { ticks: { color: '#8A9BA8' } } } } });
    }

    function updateStatsSummary() {
        document.getElementById('avgIntensity').textContent = '7.2 mA';
        document.getElementById('mostUsedMode').textContent = 'Pulse';
        document.getElementById('bestReduction').textContent = '-58%';
    }

    initBluetooth();
    updateSessionTabVisibility();
})();