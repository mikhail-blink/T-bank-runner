/**
 * Bank Runner - Telegram WebApp Game
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// --- Configuration ---
const CONFIG = {
    gravity: 0.4, // Reduced for floaty jump
    jumpForce: -13, // Floatier
    groundY: 100, // Distance from bottom
    speed: 4,
    bossSpeed: 4,
    colors: {
        bg: '#2c3e50',
        ground: '#1a1a1a'
    }
};

// --- Assets & Sprites ---
// --- Assets & Sprites ---
const ASSETS_SRC = {
    dania: 'dania_sprites_fixed_1769628642162.png',
    tatiana: 'tatiana_sprites_fixed_1769628657831.png',
    bosses: 'bosses_sprites_fixed_1769628677235.png',
    obstacles: 'obstacles_tbank_rebrand_1769629375357.png',
    bg1: 'bg_level_1_v2_1769631020179.png',
    bg2: 'bg_level_2_v2_1769631033602.png',
    bg3: 'bg_level_3_v2_1769631047174.png'
};

const ASSETS = {};

// Sprite Definitions
const SPRITES = {
    dania: {
        run: { x: 0, y: 0, w: 0.5, h: 0.5 },
        jump: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        hit: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        victory: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    },
    tatiana: {
        run: { x: 0, y: 0, w: 0.5, h: 0.5 },
        jump: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        hit: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        victory: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
    },
    bosses: [
        { name: 'Pasha', idle: { x: 0, y: 0, w: 0.5, h: 0.33 }, attack: { x: 0.5, y: 0, w: 0.5, h: 0.33 } },
        { name: 'Misha', idle: { x: 0, y: 0.33, w: 0.5, h: 0.33 }, attack: { x: 0.5, y: 0.33, w: 0.5, h: 0.33 } },
        { name: 'Nadya', idle: { x: 0, y: 0.66, w: 0.5, h: 0.33 }, attack: { x: 0.5, y: 0.66, w: 0.5, h: 0.33 } }
    ],
    // Obstacles Grid - New T-Bank Sheet (3 Rows)
    atm: { x: 0.1, y: 0, w: 0.8, h: 0.4 }, // ATM centered top
    chaos: { x: 0, y: 0.4, w: 0.33, h: 0.3 }, // Papers
    cone: { x: 0.66, y: 0.4, w: 0.33, h: 0.3 }, // Cone
    // Projectiles Bottom Row
    proj_zzz: { x: 0, y: 0.75, w: 0.2, h: 0.2 },
    proj_tox: { x: 0.2, y: 0.75, w: 0.2, h: 0.2 },
    proj_boss1: { x: 0.4, y: 0.75, w: 0.2, h: 0.2 },
    proj_boss2: { x: 0.6, y: 0.75, w: 0.2, h: 0.2 },
    proj_boss3: { x: 0.8, y: 0.75, w: 0.2, h: 0.2 },
};

// ... (Rest of config)

// Input / System vars
let imagesLoaded = 0;
const totalImages = 4;

function loadAssets() {
    for (let key in ASSETS_SRC) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = ASSETS_SRC[key];
        img.onload = () => {
            ASSETS[key] = processGreenScreen(img);
            imagesLoaded++;
            if (imagesLoaded === totalImages) {
                // Game Start trigger if needed
                console.log('All assets loaded');
                document.getElementById('assets').style.display = 'none'; // Ensure raw hidden
            }
        };
        // Fallback
        ASSETS[key] = img;
    }
}

function processGreenScreen(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const idata = ctx.getImageData(0, 0, c.width, c.height);
    const data = idata.data;
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // Green screen detection: High Green, Low Red/Blue
        if (g > 200 && r < 100 && b < 100) {
            data[i + 3] = 0; // Alpha 0
        }
    }
    ctx.putImageData(idata, 0, 0);
    const newImg = new Image();
    newImg.src = c.toDataURL();
    return newImg;
}

// Start loading
loadAssets();

// --- Game State ---
const GAME = {
    state: 'MENU', // MENU, PLAY, BOSS, VICTORY, GAMEOVER
    width: 0,
    height: 0,
    frame: 0,
    score: 0,
    level: 1,
    maxLevels: 3,
    levelTime: 0,
    levelDuration: 1000, // frames approx 45s? 60fps * 45 = 2700. Let's do 2000 for demo speed
    hp: 3,
    mute: false,
    selectedChar: 'dania',
    entities: [],
    particles: [],
    boss: null,
    screens: {
        select: document.getElementById('screen-character-select'),
        hud: document.getElementById('hud'),
        controls: document.getElementById('mobile-controls'),
        gameover: document.getElementById('screen-game-over'),
        victory: document.getElementById('screen-victory'),
        transition: document.getElementById('screen-transition'),
        resignation: document.getElementById('screen-resignation'),
        screamer: document.getElementById('screen-screamer')
    }
};

// --- Input Handling ---
const INPUT = {
    jump: false,
    shoot: false,
    swipeStartY: 0,
    swipeStartX: 0
};

// --- Character Class ---
class Player {
    constructor(charId) {
        this.charId = charId;
        this.w = 80;
        this.h = 80;
        this.x = 100;
        this.y = GAME.height - CONFIG.groundY - this.h;
        this.vy = 0;
        this.grounded = true;
        this.state = 'run'; // run, jump, hit
        this.hitTimer = 0;
        this.shootCooldown = 0;
    }

    update() {
        // Physics
        this.vy += CONFIG.gravity;
        this.y += this.vy;

        // Ground collision
        const groundLevel = GAME.height - CONFIG.groundY - this.h;
        if (this.y > groundLevel) {
            this.y = groundLevel;
            this.vy = 0;
            this.grounded = true;
            if (this.state === 'jump') this.state = 'run';
        } else {
            this.grounded = false;
        }

        // Input
        if (INPUT.jump && this.grounded) {
            this.vy = CONFIG.jumpForce;
            this.state = 'jump';
            INPUT.jump = false; // consume input
            playSound('jump');
        }

        if (INPUT.shoot && this.shootCooldown <= 0) {
            this.shoot();
            INPUT.shoot = false;
        }

        if (this.shootCooldown > 0) this.shootCooldown--;
        if (this.hitTimer > 0) this.hitTimer--;

        // Determine sprite state
        if (this.hitTimer > 0) this.state = 'hit';
        else if (!this.grounded) this.state = 'jump';
        else this.state = 'run';
    }

    shoot() {
        this.shootCooldown = 15; // 0.25s (Faster)
        GAME.entities.push(new Projectile(this.x + this.w, this.y + this.h / 2, 10, 0, 'player', this.charId));
        playSound('shoot');
    }

    draw(ctx) {
        const img = ASSETS[this.charId];
        const spriteDef = SPRITES[this.charId][this.state] || SPRITES[this.charId]['run'];

        ctx.save();
        if (this.hitTimer > 0 && Math.floor(GAME.frame / 4) % 2 === 0) {
            ctx.globalAlpha = 0.5; // Blink
        }

        // Draw Sub-image
        const sx = spriteDef.x * img.naturalWidth;
        const sy = spriteDef.y * img.naturalHeight;
        const sw = spriteDef.w * img.naturalWidth;
        const sh = spriteDef.h * img.naturalHeight;

        ctx.drawImage(img, sx, sy, sw, sh, this.x, this.y, this.w, this.h);
        ctx.restore();
    }
}

// --- Entities ---
// --- Entities ---
class Obstacle {
    constructor(type) {
        this.type = type; // 'atm', 'chaos', 'cone'

        // Custom sizes
        if (this.type === 'atm') {
            this.w = 70; // Larger ATM
            this.h = 80;
        } else {
            this.w = 50;
            this.h = 50;
        }

        this.x = GAME.width + 50;
        this.y = GAME.height - CONFIG.groundY - this.h + 15; // +15 to fix levitation (ground contact)
        this.active = true;
    }
    update() {
        this.x -= CONFIG.speed;
        if (this.x < -100) this.active = false;
    }
    draw(ctx) {
        const img = ASSETS.obstacles;
        let s = SPRITES[this.type] || SPRITES.atm;
        const sx = s.x * img.naturalWidth;
        const sy = s.y * img.naturalHeight;
        const sw = s.w * img.naturalWidth;
        const sh = s.h * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, this.x, this.y, this.w, this.h);
    }
}

class Projectile {
    constructor(x, y, vx, vy, source, variant) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.source = source; // 'player' or 'boss'
        this.variant = variant;
        this.w = 30;
        this.h = 30;
        this.active = true;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x > GAME.width + 100 || this.x < -100) this.active = false;
    }
    draw(ctx) {
        const img = ASSETS.obstacles; // Projectiles are in obstacle sheet
        let s = SPRITES.proj_zzz;

        if (this.source === 'player') {
            s = (this.variant === 'dania') ? SPRITES.proj_zzz : SPRITES.proj_tox;
        } else if (this.variant === 'ticket') {
            s = SPRITES.proj_boss3; // Use the ticket sprite (last icon)
        } else {
            // Boss projectiles
            if (this.variant === 1) s = SPRITES.proj_boss1;
            else if (this.variant === 2) s = SPRITES.proj_boss2;
            else s = SPRITES.proj_boss3;
        }

        const sx = s.x * img.naturalWidth;
        const sy = s.y * img.naturalHeight;
        const sw = s.w * img.naturalWidth;
        const sh = s.h * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, this.x, this.y, this.w, this.h);
    }
}

class Boss {
    constructor(level) {
        this.level = level;
        this.data = SPRITES.bosses[level - 1];
        this.name = this.data.name;
        this.w = 150;
        this.h = 150;
        this.x = GAME.width - 200;
        this.y = GAME.height - CONFIG.groundY - this.h;
        this.hp = 3 + (level * 2); // Reduced HP (was 5)
        this.maxHp = this.hp;
        this.state = 'idle'; // idle, attack
        this.attackTimer = 0;
        this.moveTimer = 0;
        this.targetY = this.y;
    }

    update() {
        // Boss Movement (float up down slightly)
        this.moveTimer += 0.05;
        this.y = (GAME.height - CONFIG.groundY - this.h) + Math.sin(this.moveTimer) * 50;

        // Attack Logic
        if (this.attackTimer <= 0) {
            this.attack();
            this.attackTimer = 150 - (this.level * 10); // Slower attack (was 100)
        }
        this.attackTimer--;
    }

    attack() {
        this.state = 'attack';
        setTimeout(() => this.state = 'idle', 500);
        // Spawn projectile aimed at player ('ticket' variant)
        const projY = this.y + this.h / 2;
        // Aim logic: vary speed slightly
        const speed = -5 - (this.level * 1.5);
        GAME.entities.push(new Projectile(this.x, projY, speed, 0, 'boss', 'ticket'));
        playSound('shoot');
    }

    draw(ctx) {
        const img = ASSETS.bosses;
        const s = (this.state === 'attack') ? this.data.attack : this.data.idle;

        // Draw HP bar
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x, this.y - 20, this.w, 10);
        ctx.fillStyle = 'green';
        ctx.fillRect(this.x, this.y - 20, this.w * (this.hp / this.maxHp), 10);

        const sx = s.x * img.naturalWidth;
        const sy = s.y * img.naturalHeight;
        const sw = s.w * img.naturalWidth;
        const sh = s.h * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, this.x, this.y, this.w, this.h);
    }
}

// --- Main Game Object ---
let player;

window.game = {
    selectCharacter: (charId) => {
        GAME.selectedChar = charId;
        GAME.screens.select.classList.add('hidden');
        game.startLevel(1);
    },

    startLevel: (lvl) => {
        GAME.level = lvl;
        GAME.hp = 3;
        GAME.levelTime = 0;
        GAME.entities = [];
        GAME.boss = null;
        GAME.state = 'PLAY';
        GAME.gracePeriod = 180; // 3 seconds safe zone at start


        // Update UI
        GAME.screens.hud.classList.remove('hidden');
        if ('ontouchstart' in window) GAME.screens.controls.classList.remove('hidden');
        document.getElementById('level-display').innerText = `Уровень ${lvl}: ${getContent(lvl).bossName}`;
        updateHeartDisplay();

        player = new Player(GAME.selectedChar);
        initAudio();
        startMusic(lvl);
    },

    restartLevel: () => {
        GAME.screens.gameover.classList.add('hidden');
        game.startLevel(GAME.level);
    },

    restartGame: () => {
        GAME.screens.victory.classList.add('hidden');
        GAME.screens.resignation.classList.add('hidden');
        GAME.screens.screamer.classList.add('hidden');
        GAME.screens.gameover.classList.add('hidden');
        GAME.screens.hud.classList.add('hidden');
        GAME.screens.controls.classList.add('hidden');
        GAME.screens.transition.classList.add('hidden');

        GAME.state = 'MENU';
        GAME.screens.select.classList.remove('hidden');
        document.body.style.opacity = '1';
        stopMusic();
    },

    finalDecision: (firedEveryone) => {
        if (firedEveryone) {
            // Show Resignation
            GAME.screens.victory.classList.add('hidden');
            GAME.screens.resignation.classList.remove('hidden');

            const charName = GAME.selectedChar === 'dania' ? 'Даня' : 'Татьяна';
            document.getElementById('resign-name').innerText = charName;

        } else {
            // SCREAMER
            GAME.screens.victory.classList.add('hidden');
            const sc = GAME.screens.screamer;
            sc.classList.remove('hidden');

            // Since we failed to gen image, let's use a terrifying GIF from internet? No.
            // Let's draw a scary face using text or simple CSS shapes, or just RED FLASH.
            const img = document.getElementById('screamer-img');
            img.style.display = 'none'; // hide broken image

            sc.style.backgroundColor = 'red';
            sc.innerHTML = '<h1 style="font-size:5rem; color:black; font-family:impact;">ТЫ УВОЛЕН!!!</h1>';

            // Screen shake loop
            let shake = 0;
            const shakeInt = setInterval(() => {
                shake = (shake === 5) ? -5 : 5;
                sc.style.transform = `translate(${shake}px, ${Math.random() * 10}px)`;
                sc.style.backgroundColor = Math.random() > 0.5 ? 'red' : 'black';
                sc.querySelector('h1').style.color = Math.random() > 0.5 ? 'black' : 'red';
            }, 50);

            // Audio
            playSound('boss_death');
            playTone(100, 2.0); // Low rumble
            playTone(900, 0.5); // High screech

            setTimeout(() => {
                clearInterval(shakeInt);
                Telegram.WebApp.close();
            }, 2500);
        }
    }
};

function getContent(lvl) {
    const names = ['Taskbar Primary', 'Taskbar 2 Line', 'Taskbar 3 Line'];
    return { bossName: names[lvl - 1] };
}

function updateHeartDisplay() {
    let s = '';
    for (let i = 0; i < GAME.hp; i++) s += '❤️';
    document.getElementById('hp-display').innerText = s;
}

// --- Systems ---
function spawnObstacles() {
    if (GAME.state !== 'PLAY') return;
    if (GAME.gracePeriod > 0) return; // Safe zone active
    if (GAME.boss) return; // No obstacles during boss?

    // Ensure minimum distance between obstacles (ignore projectiles)
    // We only care about spacing between OBSTACLES, not bullets
    const obstacles = GAME.entities.filter(e => e instanceof Obstacle);
    const lastObstacle = obstacles[obstacles.length - 1];

    let safeToSpawn = true;
    if (lastObstacle && lastObstacle.x > GAME.width - 400) { // Increased gap slightly for mobile readability
        safeToSpawn = false;
    }

    // Spawn rate roughly every 90-150 frames depending on random
    // And ONLY if safe
    if (safeToSpawn && GAME.frame % 60 === 0 && Math.random() < 0.4) {
        const types = ['atm', 'chaos', 'cone'];
        const type = types[Math.floor(Math.random() * types.length)];
        GAME.entities.push(new Obstacle(type));
    }
}

function checkCollisions() {
    // Player vs Entities
    for (let i = GAME.entities.length - 1; i >= 0; i--) {
        const e = GAME.entities[i];

        // Rect collision simple
        if (e.active && rectIntersect(player.x + 20, player.y + 20, player.w - 40, player.h - 20, e.x + 10, e.y + 10, e.w - 20, e.h - 20)) {
            if (e.source === 'player') continue; // Own bullet

            if (e instanceof Projectile && e.source === 'boss') {
                takeDamage();
                e.active = false;
            } else if (e instanceof Obstacle) {
                takeDamage();
                // e.active = false; // Don't destroy obstacle, just hit
            }
        }

        // Bullet vs Boss
        if (e instanceof Projectile && e.source === 'player' && GAME.boss) {
            if (rectIntersect(e.x, e.y, e.w, e.h, GAME.boss.x, GAME.boss.y, GAME.boss.w, GAME.boss.h)) {
                e.active = false;
                GAME.boss.hp--;
                playSound('hit');
                if (GAME.boss.hp <= 0) {
                    bossDefeated();
                }
            }
        }
    }
}

function rectIntersect(x1, y1, w1, h1, x2, y2, w2, h2) {
    return x2 < x1 + w1 && x2 + w2 > x1 && y2 < y1 + h1 && y2 + h2 > y1;
}

function takeDamage() {
    if (player.hitTimer > 0) return; // Invincible
    player.hitTimer = 60; // 1s
    GAME.hp--;
    updateHeartDisplay();
    playSound('hit');

    // Screen shake
    ctx.translate(5, 0); // extremely cheap shake
    setTimeout(() => ctx.setTransform(1, 0, 0, 1, 0, 0), 50);

    if (GAME.hp <= 0) {
        GAME.state = 'GAMEOVER';
        GAME.screens.gameover.classList.remove('hidden');
        GAME.screens.hud.classList.add('hidden');
    }
}

function bossDefeated() {
    GAME.state = 'BOSS_DEAD'; // Stop updates
    playSound('boss_death');
    stopMusic();

    // Show Transition Screen
    const transScreen = document.getElementById('screen-transition');
    const transTitle = document.getElementById('trans-title');
    const transNext = document.getElementById('trans-next');

    transScreen.classList.remove('hidden');
    transScreen.style.opacity = '0';

    // Fade In
    requestAnimationFrame(() => {
        transScreen.style.transition = 'opacity 0.5s ease-in';
        transScreen.style.opacity = '1';
    });

    setTimeout(() => {
        if (GAME.level < 3) {
            // Update Text for next level WHILE covered
            const prevLine = GAME.level;
            const nextLine = GAME.level + 1;

            // Custom text: "Tasks of line X done, now rotated to line Y"
            transTitle.innerText = "ОТЛИЧНАЯ РАБОТА!";
            transTitle.style.fontSize = "2rem"; // Make it fit better

            transNext.innerHTML = `Таски ${prevLine} линии разгребли,<br>теперь ты ротирован на ${nextLine} линию`;
            transNext.style.textAlign = 'center';
            transNext.style.fontSize = "1.2rem";

            // Wait a bit on the yellow screen
            setTimeout(() => {
                // Background work: Level UP
                game.startLevel(GAME.level + 1);

                // Fade Out Screen to reveal new level
                transScreen.style.opacity = '0';
                setTimeout(() => {
                    transScreen.classList.add('hidden');
                }, 500);
            }, 3000); // Give time to read
        } else {
            // Victory
            transScreen.classList.add('hidden');
            showVictory();
        }
    }, 500);
}

function showVictory() {
    GAME.state = 'VICTORY';
    GAME.screens.victory.classList.remove('hidden');
    GAME.screens.hud.classList.add('hidden');
    // Set victory pose bg
    const v = document.getElementById('victory-pose');
    const imgName = GAME.selectedChar === 'dania' ? 'dania' : 'tatiana'; // We use the sprite sheet logic actually
    // Re-use logic or just CSS
    // Let's use CSS on the element
    // But simplest is to just show screen and let CSS handle the image
    // CSS class needs to be set
    v.style.backgroundImage = `url('img-${GAME.selectedChar}.png')`; // Wait, this is tricky with spritesheets
    // Actually, let's just use the spritesheet in CSS
    v.className = 'victory-image ' + GAME.selectedChar + '-portrait';
    // And override to show the victory cell (bottom right)
    v.style.backgroundPosition = '0 100%';
}

// --- Loop ---
function loop() {
    requestAnimationFrame(loop);

    // Resize (Virtual Resolution: Fixed Height 720p)
    // This ensures consistent gameplay vertical space and crisp pixels
    const VIRTUAL_HEIGHT = 720;
    const aspect = window.innerWidth / window.innerHeight;
    const virtualWidth = VIRTUAL_HEIGHT * aspect;

    // Check if resize needed (compare truncated values)
    if (canvas.width !== Math.floor(virtualWidth) || canvas.height !== VIRTUAL_HEIGHT) {
        canvas.width = Math.floor(virtualWidth);
        canvas.height = VIRTUAL_HEIGHT;
        GAME.width = canvas.width;
        GAME.height = canvas.height;
        ctx.imageSmoothingEnabled = false; // Important for pixel art

        // Fix player position relative to new ground
        if (player) {
            player.y = GAME.height - CONFIG.groundY - player.h;

            // If boss exists, fix Y too
            if (GAME.boss) GAME.boss.y = GAME.height - CONFIG.groundY - GAME.boss.h;
        }
    }

    ctx.clearRect(0, 0, GAME.width, GAME.height);

    if (GAME.state === 'PLAY' || GAME.state === 'BOSS') {
        // Draw Background
        drawBackground(ctx);

        // Ground (Custom Drawing)
        drawGround(ctx);

        // Updates
        if (player) {
            player.update();
            player.draw(ctx);
        }

        GAME.entities.forEach(e => {
            if (e.active) {
                e.update();
                e.draw(ctx);
            }
        });
        GAME.entities = GAME.entities.filter(e => e.active);

        // Level Progress
        GAME.levelTime++;
        if (GAME.gracePeriod > 0) GAME.gracePeriod--;

        if (GAME.levelTime > 2000 && !GAME.boss && GAME.state !== 'BOSS') {
            GAME.state = 'BOSS';

            // Clear all obstacles so player can focus on boss
            GAME.entities = GAME.entities.filter(e => e instanceof Projectile && e.source === 'player');

            GAME.boss = new Boss(GAME.level);
        }

        if (GAME.boss) {
            GAME.boss.update();
            GAME.boss.draw(ctx);
        } else {
            spawnObstacles();
        }

        checkCollisions();

        GAME.frame++;
    }
}

function drawBackground(ctx) {
    let bgImg;
    if (GAME.level === 1) bgImg = ASSETS.bg1;
    else if (GAME.level === 2) bgImg = ASSETS.bg2;
    else bgImg = ASSETS.bg3;

    if (bgImg && bgImg.complete) {
        const parallaxSpeed = 0.5;
        // Tile width equals screen width for seamless filling
        const tileW = GAME.width;
        const tileH = GAME.height;

        // Calculate total distance scrolled
        const speed = CONFIG.speed * parallaxSpeed;
        const totalDist = GAME.frame * speed;

        // Pattern: [Normal] [Flipped] ... (repeats every 2*tileW)
        const patternW = tileW * 2;

        // We need to cover the screen from x=0 to x=GAME.width.
        // We calculate which logical tile index corresponds to the left edge of the screen (x=0).
        // The texture coordinate for X=0 is 'totalDist'.

        const startTileIdx = Math.floor(totalDist / tileW);
        const subOffset = totalDist % tileW;

        // Draw 2 tiles (Current covering 0..tileW-subOffset, Next covering remainder)
        for (let i = 0; i < 2; i++) {
            const idx = startTileIdx + i;
            const drawX = (i * tileW) - subOffset;

            // Check visibility optimization
            if (drawX > GAME.width) continue;

            // If idx is even: Normal. If odd: Flipped.
            const isFlipped = (idx % 2 !== 0);

            if (isFlipped) {
                ctx.save();
                // To flip horizontally around the center of the tile:
                // Translate to the RIGHT edge of the drawing rect, scaling by -1 flips "backwards" to the left
                // drawX is the left edge of where we want to draw.
                // drawX + tileW is the right edge.
                ctx.translate(drawX + tileW, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(bgImg, 0, 0, tileW, tileH);
                ctx.restore();
            } else {
                ctx.drawImage(bgImg, drawX, 0, tileW, tileH);
            }
        }

    } else {
        // Fallback
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, GAME.width, GAME.height);
    }
}

function drawGround(ctx) {
    const y = GAME.height - CONFIG.groundY;
    const h = CONFIG.groundY;
    const w = GAME.width;

    // Level styles
    let baseColor = '#1a1a1a';
    let accentColor = '#333';

    if (GAME.level === 1) {
        baseColor = '#dbe4eb'; // Light tile
        accentColor = '#bdc3c7';
    } else if (GAME.level === 2) {
        baseColor = '#2c3e50'; // Office carpet
        accentColor = '#34495e';
    } else {
        baseColor = '#0b1e16'; // Server dark
        accentColor = '#1e382b';
    }

    // Base fill
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, y, w, h);

    // Scrolling floor texture (speed lines / tiles)
    const speed = CONFIG.speed;
    const offset = (GAME.frame * speed) % 100; // Repeat every 100px

    ctx.fillStyle = accentColor;
    ctx.beginPath();
    // Draw skewed rects or lines for speed
    for (let i = -100; i < w + 100; i += 100) {
        const drawX = i - offset;
        // Draw a floor tile/strip
        ctx.fillRect(drawX, y, 5, h); // Vertical strip
        // Or horizontal perspective lines?
        // Let's do simple vertical tile dividers for speed sensation
    }

    // Top border of ground
    ctx.fillStyle = accentColor;
    ctx.fillRect(0, y, w, 4);
}

// --- Audio System ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let bgmOsc = null;
let bgmGain = null;
let nextNoteTime = 0;
let noteIndex = 0;
let isMuted = false;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startMusic(level) {
    if (GAME.mute || !audioCtx) return;
    stopMusic();

    let sequence = [];
    if (level === 1) sequence = [261.63, 293.66, 329.63, 349.23]; // C majorish
    if (level === 2) sequence = [220, 261.63, 329.63, 440]; // A minorish
    if (level === 3) sequence = [110, 116.54, 110, 103.83]; // Boss weirdness

    let noteIdx = 0;
    const speed = level === 3 ? 100 : 200;

    bgmInterval = setInterval(() => {
        if (GAME.state !== 'PLAY' && GAME.state !== 'BOSS') return;
        playTone(sequence[noteIdx], 0.1);
        noteIdx = (noteIdx + 1) % sequence.length;
    }, speed);
}

function stopMusic() {
    if (bgmInterval) clearInterval(bgmInterval);
    bgmInterval = null;
}

function playTone(freq, dur) {
    if (GAME.mute || !audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square'; // 8-bit style
    osc.frequency.value = freq;
    osc.connect(g);
    g.connect(audioCtx.destination);

    g.gain.setValueAtTime(0.05, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);

    osc.start();
    osc.stop(audioCtx.currentTime + dur);
}

function playSound(type) {
    initAudio(); // Ensure context exists
    if (GAME.mute) return;

    // SFX override music context? better shared.
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g);
    g.connect(audioCtx.destination);

    if (type === 'jump') {
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.1, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'shoot') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.2);
        g.gain.setValueAtTime(0.2, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'victory') {
        stopMusic();
        // Victory melody could go here
    } else if (type === 'boss_death') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.5); // Long slide down

        // Tremolo
        const lfo = audioCtx.createOscillator();
        lfo.type = 'square';
        lfo.frequency.value = 8;
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start();
        lfo.stop(audioCtx.currentTime + 1.5);

        g.gain.setValueAtTime(0.3, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);

        osc.start();
        osc.stop(audioCtx.currentTime + 1.5);
    }
}

// --- Init & Events ---
window.onload = () => {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    // Listeners
    window.addEventListener('keydown', e => {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            INPUT.jump = true;
            e.preventDefault();
        }
        // Shoot: Z, Enter, Shift, or Alt (legacy support but Alt is buggy)
        if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'AltLeft') {
            INPUT.shoot = true;
            e.preventDefault();
        }
    });

    // Touch
    document.addEventListener('touchstart', e => {
        INPUT.swipeStartX = e.touches[0].clientX;
        INPUT.swipeStartY = e.touches[0].clientY;
        // Tap anywhere implies jump if not hitting a button
        if (e.target.tagName !== 'BUTTON') {
            INPUT.jump = true;
        }
    }, { passive: false });

    document.addEventListener('touchmove', e => {
        // e.preventDefault(); 
    }, { passive: false });

    // Mobile buttons
    document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        INPUT.jump = true;
    });
    document.getElementById('btn-shoot').addEventListener('touchstart', (e) => {
        e.stopPropagation();
        INPUT.shoot = true;
    });

    // Mute Button Logic
    document.getElementById('mute-btn').addEventListener('click', (e) => {
        e.stopPropagation();

        // Ensure AudioContext is running (browsers block it until interaction)
        initAudio(); // Initialize if not already
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isMuted = !isMuted;
        const btn = document.getElementById('mute-btn');
        btn.innerText = isMuted ? '🔇' : '🔊';

        if (isMuted) {
            if (bgmGain) bgmGain.gain.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.suspend(); // Suspend the entire audio context
        } else {
            audioCtx.resume(); // Resume the entire audio context
            if (bgmGain) {
                bgmGain.gain.setValueAtTime(0.3, audioCtx.currentTime); // Restore BGM volume
            }
        }
    });

    // Start Loop
    loop();
};
