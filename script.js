class EidGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.fixDPI();

        this.score = 0;
        this.timeLeft = 30;
        this.isGameOver = false;
        this.shakeTime = 0;

        // إعدادات اللاعب والخصم
        this.player = { x: 450, y: 275, size: 40, speed: 6.5, hasStick: false };
        this.grandpa = { x: -100, y: -100, size: 60, speed: 3.0, health: 100, active: false };
        
        this.targets = [];
        this.keys = {};
        
        // إعدادات الميني جيم (الأسهم ثابتة)
        this.miniGame = { active: false, sequence: [], index: 0, timer: 5, targetIdx: null };

        this.init();
    }

    fixDPI() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = 900 * dpr;
        this.canvas.height = 550 * dpr;
        this.ctx.scale(dpr, dpr);
    }

    init() {
        window.addEventListener('keydown', e => this.handlePress(e.code, true));
        window.addEventListener('keyup', e => this.handlePress(e.code, false));

        // نظام التحكم (يمين للحركة، يسار للضرب)
        this.setupMobile();

        this.spawnObjects(6, 'GOLD');
        this.startTimers();
        this.gameLoop();
    }

    handlePress(code, isDown) {
        if (isDown) {
            this.keys[code] = true;
            if (this.miniGame.active && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)) {
                this.checkMiniGame(code);
            }
            if (code === 'Space' && this.player.hasStick) this.attackGrandpa();
        } else {
            delete this.keys[code];
        }
    }

    setupMobile() {
        const btns = {
            'btn-up': 'ArrowUp', 'btn-down': 'ArrowDown',
            'btn-left': 'ArrowLeft', 'btn-right': 'ArrowRight', 
            'btn-space': 'Space'
        };
        Object.entries(btns).forEach(([id, code]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.handlePress(code, true); });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.handlePress(code, false); });
        });
    }

    // --- نظام الميني جيم (ثبات الأسهم) ---
    startMiniGame(idx) {
        if (this.miniGame.active) return;
        this.miniGame.active = true;
        this.miniGame.targetIdx = idx;
        this.miniGame.index = 0;
        this.miniGame.timer = 5;

        const arrows = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
        this.miniGame.sequence = Array.from({length: 5}, () => arrows[Math.floor(Math.random()*4)]);

        document.getElementById('mini-game-overlay').style.display = 'flex';
        this.renderMiniGame();
    }

    checkMiniGame(code) {
        if (code === this.miniGame.sequence[this.miniGame.index]) {
            this.miniGame.index++;
            this.renderMiniGame();
            if (this.miniGame.index >= 5) this.completeMiniGame();
        } else {
            // خطأ: تصفير الوقت والتقدم والأسهم تبقى ثابتة
            this.miniGame.index = 0;
            this.miniGame.timer = 5;
            this.renderMiniGame();
        }
    }

    completeMiniGame() {
        this.miniGame.active = false;
        document.getElementById('mini-game-overlay').style.display = 'none';
        this.targets.splice(this.miniGame.targetIdx, 1);
        this.score++;
        this.updateUI();
        if (this.score >= 4) this.transitionToEscaping();
    }

    // --- تحديث الحركة والجدران ---
    update() {
        if (this.isGameOver || this.miniGame.active) return;

        const p = this.player;
        const s = p.speed;

        // جدران الزون (الحدود)
        if ((this.keys['ArrowUp'] || this.keys['KeyW']) && p.y > 5) p.y -= s;
        if ((this.keys['ArrowDown'] || this.keys['KeyS']) && p.y < 500) p.y += s;
        if ((this.keys['ArrowLeft'] || this.keys['KeyA']) && p.x > 5) p.x -= s;
        if ((this.keys['ArrowRight'] || this.keys['KeyD']) && p.x < 850) p.x += s;

        if (this.grandpa.active) {
            const dx = p.x - this.grandpa.x, dy = p.y - this.grandpa.y;
            const dist = Math.hypot(dx, dy);
            this.grandpa.x += (dx/dist) * this.grandpa.speed;
            this.grandpa.y += (dy/dist) * this.grandpa.speed;
            if (dist < 45 && !p.hasStick) this.endGame("عروج صادك! 💀");
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            if (Math.hypot(p.x - this.targets[i].x, p.y - this.targets[i].y) < 40) {
                const t = this.targets[i];
                if (t.type === 'GOLD') { this.targets.splice(i,1); this.score++; if(this.score>=6) this.transitionToStealing(); }
                else if (t.type === 'KID') this.startMiniGame(i);
                else if (t.type === 'STICK') { this.targets.splice(i,1); p.hasStick = true; }
                this.updateUI();
            }
        }
        if (this.shakeTime > 0) this.shakeTime--;
    }

    // --- الضربة السهلة المحدثة ---
    attackGrandpa() {
        const dist = Math.hypot(this.player.x - this.grandpa.x, this.player.y - this.grandpa.y);
        
        if (dist < 130) { // مدى أوسع للضربة
            this.grandpa.health -= 25;
            this.shakeTime = 12;

            // دفع عروج لمسافة بعيدة
            const angle = Math.atan2(this.grandpa.y - this.player.y, this.grandpa.x - this.player.x);
            this.grandpa.x += Math.cos(angle) * 220;
            this.grandpa.y += Math.sin(angle) * 220;

            this.player.hasStick = false;
            this.spawnNewStickClose(); // العصا تطيح قريب منك
            
            if (this.grandpa.health <= 0) this.endGame("كفو! جلدت عروج واسترديت العيدية 🏆");
        }
    }

    spawnNewStickClose() {
        // العصا تظهر في محيط اللاعب ليسهل استكمال الجلد
        let rx = this.player.x + (Math.random() * 150 - 75);
        let ry = this.player.y + (Math.random() * 150 - 75);
        // تأمين بقائها داخل الزون
        rx = Math.max(50, Math.min(850, rx));
        ry = Math.max(50, Math.min(500, ry));
        this.targets = [{ x: rx, y: ry, type: 'STICK' }];
    }

    startTimers() {
        setInterval(() => { if(!this.isGameOver && !this.miniGame.active) { this.timeLeft--; this.updateUI(); if(this.timeLeft<=0) this.endGame("انتهى الوقت! 😢"); } }, 1000);
        setInterval(() => { if(this.miniGame.active) { this.miniGame.timer -= 0.1; document.getElementById('mini-timer-fill').style.width = (this.miniGame.timer/5)*100+"%"; if(this.miniGame.timer<=0) { this.miniGame.index=0; this.miniGame.timer=5; this.renderMiniGame(); } } }, 100);
    }

    draw() {
        this.ctx.save();
        if (this.shakeTime > 0) this.ctx.translate(Math.random()*10-5, Math.random()*10-5);
        this.ctx.clearRect(0, 0, 900, 550);
        this.drawEmoji(this.player.hasStick ? '⚔️' : '😎', this.player.x, this.player.y, 40, '#00f3ff');
        this.targets.forEach(t => this.drawEmoji({GOLD:'💰', KID:'👦', STICK:'🦯'}[t.type], t.x, t.y, 35, '#fff'));
        if (this.grandpa.active) {
            this.drawEmoji('👴', this.grandpa.x, this.grandpa.y, 60, '#ff4757');
            this.ctx.fillStyle = '#ff4757';
            this.ctx.fillRect(this.grandpa.x, this.grandpa.y-20, (this.grandpa.health/100)*60, 5);
        }
        this.ctx.restore();
    }

    drawEmoji(e, x, y, s, c) { this.ctx.shadowBlur = 15; this.ctx.shadowColor = c; this.ctx.font = s+"px Arial"; this.ctx.fillText(e, x, y+s); this.ctx.shadowBlur = 0; }
    spawnObjects(c, t) { this.targets = Array.from({length: c}, () => ({x: Math.random()*800+50, y: Math.random()*400+50, type: t})); }
    transitionToStealing() { this.score=0; this.spawnObjects(4, 'KID'); document.getElementById('status-text').innerText="اسرق حلويات الورعان!"; }
    transitionToEscaping() { this.grandpa.active=true; this.grandpa.x=50; this.grandpa.y=50; this.spawnNewStickClose(); document.getElementById('status-text').innerText="اصقعه بـ ⚔️!"; }
    updateUI() { document.getElementById('score').innerText=this.score; document.getElementById('timer').innerText=this.timeLeft; document.getElementById('main-timer-fill').style.width=(this.timeLeft/30)*100+"%"; }
    renderMiniGame() { document.getElementById('key-container').innerHTML = this.miniGame.sequence.map((k, i) => `<div class="key-box ${i < this.miniGame.index ? 'active' : ''}">${{ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'}[k]}</div>`).join(''); }
    endGame(m) { this.isGameOver=true; alert(m); location.reload(); }
    gameLoop() { this.update(); this.draw(); requestAnimationFrame(() => this.gameLoop()); }
}
window.onload = () => new EidGame();