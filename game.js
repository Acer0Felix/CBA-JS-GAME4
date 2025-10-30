/* Invasores Galácticos - Canvas Game */
(function() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const scoreEl = document.getElementById('score');
  const hitsEl = document.getElementById('hits');
  const levelEl = document.getElementById('level');
  const finalScoreEl = document.getElementById('final-score');
  const overlayEl = document.getElementById('overlay');
  const gameoverEl = document.getElementById('gameover');
  const restartBtn = document.getElementById('restart');
  const toggleStarsBtn = document.getElementById('toggle-stars');
  const alienTypesEl = document.getElementById('alien-types');

  let pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function fitCanvasToParent() {
    const parent = canvas.parentElement;
    const bounds = parent.getBoundingClientRect();
    const cssW = Math.floor(bounds.width);
    const cssH = Math.floor(bounds.height);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * pixelRatio);
    canvas.height = Math.floor(cssH * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  fitCanvasToParent();
  window.addEventListener('resize', fitCanvasToParent);

  // Assets
  const playerImg = new Image();
  const alienImgs = [
    new Image(), // alien.svg - L1-2
    new Image(), // alien2.svg - L3-4
    new Image(), // alien3.svg - L5-6
    new Image(), // alien4.svg - L7-8
    new Image(), // alien5.svg - L9-10
    new Image(), // alien6.svg - L11-12
    new Image()  // alien7.svg - L13+
  ];
  playerImg.src = 'assets/player.svg';
  const alienSrcs = [
    'assets/alien.svg',
    'assets/alien2.svg',
    'assets/alien3.svg',
    'assets/alien4.svg',
    'assets/alien5.svg',
    'assets/alien6.svg',
    'assets/alien7.svg'
  ];
  // Load with graceful fallback to previous sprite if missing
  for (let i = 0; i < alienImgs.length; i++) {
    const img = alienImgs[i];
    img.src = alienSrcs[i];
    img.onerror = () => {
      // fallback to last available lower-tier image
      for (let j = i - 1; j >= 0; j--) {
        if (alienImgs[j].complete) { img.src = alienImgs[j].src; break; }
      }
    };
  }

  // Get alien image based on level
  function getAlienImg(level) {
    if (level <= 2) return alienImgs[0];
    if (level <= 4) return alienImgs[1];
    if (level <= 6) return alienImgs[2];
    if (level <= 8) return alienImgs[3];
    if (level <= 10) return alienImgs[4];
    if (level <= 12) return alienImgs[5];
    return alienImgs[6];
  }

  // Audio (WebAudio) - initialized on first interaction
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioCtx = new Ctx();
    }
  }
  function env(durationMs, start=0.001, peak=0.2, end=0.0008, a=5) {
    const g = audioCtx.createGain();
    const t = audioCtx.currentTime;
    g.gain.setValueAtTime(start, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a/1000);
    g.gain.exponentialRampToValueAtTime(end, t + durationMs/1000);
    return g;
  }
  function beep({type='square', freq=440, duration=120, detune=0}) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = env(duration, 0.001, 0.2, 0.0008, 4);
    o.type = type;
    o.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if (detune) o.detune.setValueAtTime(detune, audioCtx.currentTime);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + duration/1000);
  }
  function noise({duration=160, cutoff=1200}) {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * (duration/1000);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = cutoff;
    const g = env(duration, 0.001, 0.25, 0.0008, 2);
    src.connect(filt).connect(g).connect(audioCtx.destination);
    src.start();
  }
  const sfx = {
    shoot() {
      ensureAudio();
      beep({type:'square', freq:520, duration:90});
      beep({type:'square', freq:820, duration:60, detune:6});
    },
    alienShoot() {
      ensureAudio();
      beep({type:'sawtooth', freq:280, duration:80});
    },
    alienHit() {
      ensureAudio();
      noise({duration:140, cutoff:900});
    },
    playerHit() {
      ensureAudio();
      beep({type:'sawtooth', freq:180, duration:220});
      noise({duration:220, cutoff:500});
    }
  };

  // Starfield backdrop (procedural)
  const stars = [];
  let starsEnabled = true;
  function initStars() {
    stars.length = 0;
    const count = Math.floor((canvas.width * canvas.height) / (90_000));
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvas.width / pixelRatio,
        y: Math.random() * canvas.height / pixelRatio,
        r: Math.random() * 1.2 + 0.2,
        s: Math.random() * 20 + 10
      });
    }
  }
  initStars();
  window.addEventListener('resize', initStars);

  // Mini stars parallax layer (reacts to player movement)
  const miniStars = [];
  function initMiniStars() {
    miniStars.length = 0;
    const count = Math.floor((canvas.width * canvas.height) / (60_000));
    for (let i = 0; i < count; i++) {
      miniStars.push({
        x: Math.random() * canvas.width / pixelRatio,
        y: Math.random() * canvas.height / pixelRatio,
        r: Math.random() * 0.9 + 0.2,
        s: Math.random() * 18 + 8 // base speed factor
      });
    }
  }
  initMiniStars();
  window.addEventListener('resize', initMiniStars);

  // Game state
  const state = {
    running: true,
    gameOver: false,
    score: 0,
    hits: 0,
    level: 1,
    nextLevelAt: 10,
    player: { x: 0, y: 0, w: 52, h: 52, speed: 420 },
    bullets: [], // {x,y,w,h,speed}
    alienBullets: [], // {x,y,w,h,speed} - bullets from aliens
    aliens: [], // {x,y,w,h,speed,type,t,ax,amp,dir,hp,canShoot,lastShotAt}
    asteroids: [], // {x,y,w,h,sx,sy,hp,rot,sr}
    lastShotAt: 0,
    fireCooldownMs: 180,
    spawnTimer: 0,
    spawnEveryMs: 550,
    spawnEveryMsMin: 520,
    twinSpawnChance: 0,
    asteroidChance: 0.005,
    asteroidCap: 2,
  };

  function resetGame() {
    state.running = true;
    state.gameOver = false;
    state.score = 0;
    state.hits = 0;
    state.bullets.length = 0;
    state.alienBullets.length = 0;
    state.aliens.length = 0;
    state.asteroids.length = 0;
    state.lastShotAt = 0;
    state.spawnTimer = 0;
    state.spawnEveryMs = 550;
    state.spawnEveryMsMin = 520;
    state.twinSpawnChance = 0;
    state.asteroidChance = 0.005;
    state.asteroidCap = 2;
    state.level = 1;
    state.nextLevelAt = 10;
    scoreEl.textContent = '0';
    hitsEl.textContent = '0';
    if (levelEl) levelEl.textContent = '1';
    gameoverEl.classList.add('hidden');
    overlayEl.classList.add('hidden');
    updateAlienInfo();
  }

  // Input
  const keys = new Set();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (e.code === 'KeyP') togglePause();
    ensureAudio();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));

  function togglePause() {
    if (state.gameOver) return;
    state.running = !state.running;
    overlayEl.classList.toggle('hidden', state.running);
  }

  restartBtn.addEventListener('click', () => {
    resetGame();
  });

  toggleStarsBtn.addEventListener('click', () => {
    starsEnabled = !starsEnabled;
  });

  // Update HUD with active alien types by level
  function updateAlienInfo() {
    if (!alienTypesEl) return;
    let img = 'assets/alien.svg';
    let text = '';
    if (state.level <= 2) { img = 'assets/alien.svg'; text = 'Nivel 1-2'; }
    else if (state.level <= 4) { img = 'assets/alien2.svg'; text = 'Nivel 3-4'; }
    else if (state.level <= 6) { img = 'assets/alien3.svg'; text = 'Nivel 5-6'; }
    else if (state.level <= 8) { img = 'assets/alien4.svg'; text = 'Nivel 7-8'; }
    else if (state.level <= 10) { img = 'assets/alien5.svg'; text = 'Nivel 9-10'; }
    else if (state.level <= 12) { img = 'assets/alien6.svg'; text = 'Nivel 11-12'; }
    else { img = 'assets/alien7.svg'; text = 'Nivel 13+'; }
    alienTypesEl.innerHTML = `<div class="alien-item">
      <img src="${img}" alt="alien">
      <span>${text}</span>
    </div>`;
  }

  // Level-based difficulty parameters
  function getLevelDifficulty(level) {
    if (level <= 2) return { minSpawn: 520, twin: 0.0, asteroidChance: 0.005, asteroidCap: 2 };
    if (level <= 4) return { minSpawn: 480, twin: 0.10, asteroidChance: 0.008, asteroidCap: 3 };
    if (level <= 6) return { minSpawn: 420, twin: 0.18, asteroidChance: 0.012, asteroidCap: 4 };
    if (level <= 8) return { minSpawn: 360, twin: 0.22, asteroidChance: 0.016, asteroidCap: 5 };
    if (level <= 10) return { minSpawn: 300, twin: 0.26, asteroidChance: 0.020, asteroidCap: 6 };
    if (level <= 12) return { minSpawn: 260, twin: 0.30, asteroidChance: 0.024, asteroidCap: 7 };
    return { minSpawn: 220, twin: 0.34, asteroidChance: 0.028, asteroidCap: 8 };
  }
  function applyDifficultyForLevel() {
    const d = getLevelDifficulty(state.level);
    state.spawnEveryMsMin = d.minSpawn;
    state.twinSpawnChance = d.twin;
    state.asteroidChance = d.asteroidChance;
    state.asteroidCap = d.asteroidCap;
  }
  applyDifficultyForLevel();

  // Helpers
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function nowMs() { return performance.now(); }
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function spawnAlien() {
    const margin = 20;
    const w = 44, h = 44;
    const x = Math.random() * (canvas.width / pixelRatio - margin * 2 - w) + margin;
    const y = -h - Math.random() * 60;
    const baseSpeed = 60 + Math.random() * 160; // variable base speed
    // Choose type by level
    let pool = ['straight','sine'];
    if (state.level >= 2) pool.push('zigzag');
    if (state.level >= 3) pool.push('drift');
    const type = pool[Math.floor(Math.random() * pool.length)];
    const speed = baseSpeed * (1 + (state.level - 1) * 0.12);
    const hp = type === 'drift' ? 2 : 1;
    // Random chance to shoot (30-50% depending on level)
    const shootChance = 0.3 + (state.level - 1) * 0.05;
    const canShoot = Math.random() < shootChance;
    state.aliens.push({ 
      x, y, w, h, speed, type, t:0, ax:x, amp:30 + Math.random()*40, 
      dir: Math.random()<0.5?-1:1, hp, canShoot, lastShotAt: 0,
      level: state.level // store level when created
    });
  }

  // Asteroids
  function spawnAsteroid() {
    const size = 24 + Math.random() * 24; // 24-48px
    const w = size, h = size;
    const x = Math.random() * (canvas.width / pixelRatio - w - 16) + 8;
    const y = -h - Math.random() * 80;
    const sy = 30 + Math.random() * 40; // vertical speed
    const sx = (Math.random() * 2 - 1) * 20; // slight horizontal drift
    const hp = size > 36 ? 3 : 2;
    state.asteroids.push({ x, y, w, h, sx, sy, hp, rot: Math.random()*Math.PI, sr: (Math.random()*2-1)*0.8 });
  }

  function alienShoot(alien) {
    const t = nowMs();
    const cooldown = 800 + Math.random() * 1200; // variable cooldown
    if (t - alien.lastShotAt < cooldown) return;
    alien.lastShotAt = t;
    const bw = 5, bh = 12;
    state.alienBullets.push({
      x: alien.x + alien.w / 2 - bw / 2,
      y: alien.y + alien.h,
      w: bw,
      h: bh,
      speed: 280 + Math.random() * 100
    });
    sfx.alienShoot();
  }

  function shoot() {
    const t = nowMs();
    if (t - state.lastShotAt < state.fireCooldownMs) return;
    state.lastShotAt = t;
    const bw = 6, bh = 14;
    state.bullets.push({
      x: state.player.x + state.player.w / 2 - bw / 2,
      y: state.player.y - bh + 4,
      w: bw,
      h: bh,
      speed: 520
    });
    sfx.shoot();
  }

  // Main loop
  let last = nowMs();
  function update(dt) {
    // Player position baseline
    state.player.y = canvas.height / pixelRatio - state.player.h - 22;

    // Input horizontal
    let dx = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
    if (dx !== 0) {
      state.player.x += dx * state.player.speed * dt;
    }
    state.player.x = clamp(state.player.x, 8, canvas.width / pixelRatio - state.player.w - 8);

    // Shoot
    if (keys.has('Space')) shoot();

    // Bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y -= b.speed * dt;
      if (b.y + b.h < -30) {
        state.bullets.splice(i, 1);
      }
    }

    // Spawn aliens
    state.spawnTimer += dt * 1000;
    if (state.spawnTimer >= state.spawnEveryMs) {
      state.spawnTimer = 0;
      // dynamic difficulty: faster spawns over time
      state.spawnEveryMs = Math.max(state.spawnEveryMsMin, state.spawnEveryMs - (state.level >= 3 ? 5 : 3));
      spawnAlien();
      if (Math.random() < state.twinSpawnChance) spawnAlien();
    }

    // Occasionally spawn asteroids (independent cadence)
    if (Math.random() < state.asteroidChance) {
      if (state.asteroids.length < state.asteroidCap) spawnAsteroid();
    }

    // Aliens
    for (let i = state.aliens.length - 1; i >= 0; i--) {
      const a = state.aliens[i];
      a.t += dt;
      // Movement by type
      if (a.type === 'straight') {
        a.y += a.speed * dt;
      } else if (a.type === 'sine') {
        a.y += a.speed * dt * 0.95;
        a.x = a.ax + Math.sin(a.t * 3) * a.amp;
      } else if (a.type === 'zigzag') {
        a.y += a.speed * dt * 1.05;
        a.x += a.dir * 160 * dt;
        if (a.x < 8 || a.x > canvas.width / pixelRatio - a.w - 8) a.dir *= -1;
      } else if (a.type === 'drift') {
        a.y += a.speed * dt * 0.9;
        a.x += Math.cos(a.t * 1.6 + a.ax) * 40 * dt;
      }
      if (a.y > canvas.height / pixelRatio + 60) {
        state.aliens.splice(i, 1);
        continue;
      }
      // Alien shooting (only if canShoot and on screen)
      if (a.canShoot && a.y > 0 && a.y < canvas.height / pixelRatio - 100) {
        if (Math.random() < 0.003) { // small random chance each frame
          alienShoot(a);
        }
      }
    }

    // Aliens vs Asteroids collisions (destroy alien on impact)
    for (let i = state.aliens.length - 1; i >= 0; i--) {
      const a = state.aliens[i];
      let collided = false;
      for (let k = state.asteroids.length - 1; k >= 0; k--) {
        const r = state.asteroids[k];
        if (rectsOverlap(a, r)) { collided = true; break; }
      }
      if (collided) {
        state.aliens.splice(i, 1);
        sfx.alienHit();
      }
    }

    // Alien bullets
    for (let i = state.alienBullets.length - 1; i >= 0; i--) {
      const b = state.alienBullets[i];
      b.y += b.speed * dt;
      if (b.y > canvas.height / pixelRatio + 30) {
        state.alienBullets.splice(i, 1);
      }
    }

    // Asteroids movement
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
      const a = state.asteroids[i];
      a.x += a.sx * dt;
      a.y += a.sy * dt;
      a.rot += a.sr * dt;
      if (a.x < 4 || a.x > canvas.width / pixelRatio - a.w - 4) a.sx *= -1;
      if (a.y > canvas.height / pixelRatio + 60) {
        state.asteroids.splice(i, 1);
      }
    }

    // Collisions bullets vs aliens
    for (let i = state.aliens.length - 1; i >= 0; i--) {
      const a = state.aliens[i];
      let destroyed = false;
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        if (rectsOverlap(a, b)) {
          state.bullets.splice(j, 1);
          a.hp -= 1;
          sfx.alienHit();
          if (a.hp <= 0) {
            state.aliens.splice(i, 1);
            state.score += 1;
            scoreEl.textContent = String(state.score);
            destroyed = true;
          }
          break;
        }
      }
      if (destroyed) continue;
    }

    // Collisions bullets vs asteroids
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
      const a = state.asteroids[i];
      for (let j = state.bullets.length - 1; j >= 0; j--) {
        const b = state.bullets[j];
        if (rectsOverlap(a, b)) {
          state.bullets.splice(j, 1);
          a.hp -= 1;
          sfx.alienHit();
          if (a.hp <= 0) {
            state.asteroids.splice(i, 1);
          }
          break;
        }
      }
    }

    // Collisions alien bullets vs player
    for (let i = state.alienBullets.length - 1; i >= 0; i--) {
      const b = state.alienBullets[i];
      if (rectsOverlap(b, state.player)) {
        state.alienBullets.splice(i, 1);
        state.hits += 1;
        hitsEl.textContent = String(state.hits);
        sfx.playerHit();
        // End game after 3 hits
        if (state.hits >= 3) {
          state.gameOver = true;
          state.running = false;
          finalScoreEl.textContent = String(state.score);
          gameoverEl.classList.remove('hidden');
          break;
        }
      }
    }

    // Collisions aliens vs player
    for (let i = state.aliens.length - 1; i >= 0; i--) {
      const a = state.aliens[i];
      if (rectsOverlap(a, state.player)) {
        state.aliens.splice(i, 1);
        state.hits += 1;
        hitsEl.textContent = String(state.hits);
        sfx.playerHit();
        // End game after 3 hits
        if (state.hits >= 3) {
          state.gameOver = true;
          state.running = false;
          finalScoreEl.textContent = String(state.score);
          gameoverEl.classList.remove('hidden');
          break;
        }
      }
    }

    // Collisions asteroids vs player
    for (let i = state.asteroids.length - 1; i >= 0; i--) {
      const a = state.asteroids[i];
      if (rectsOverlap(a, state.player)) {
        state.asteroids.splice(i, 1);
        state.hits += 1;
        hitsEl.textContent = String(state.hits);
        sfx.playerHit();
        if (state.hits >= 3) {
          state.gameOver = true;
          state.running = false;
          finalScoreEl.textContent = String(state.score);
          gameoverEl.classList.remove('hidden');
          break;
        }
      }
    }

    // Level progression
    if (state.score >= state.nextLevelAt) {
      state.level += 1;
      if (levelEl) levelEl.textContent = String(state.level);
      state.nextLevelAt += 10 + Math.floor(state.level * 2);
      state.fireCooldownMs = Math.max(120, state.fireCooldownMs - 10);
      state.spawnEveryMs = Math.max(200, state.spawnEveryMs - 30);
      updateAlienInfo();
      applyDifficultyForLevel();
    }

    // Stars parallax
    for (const s of stars) {
      s.y += (s.s * dt) * 0.08;
      if (s.y > canvas.height / pixelRatio) {
        s.y = -2; s.x = Math.random() * canvas.width / pixelRatio;
      }
    }

    // Mini stars: subtle forward-motion illusion
    // Move slightly downward and opposite to player horizontal input
    for (const ms of miniStars) {
      ms.y += (ms.s * dt) * 0.12;
      ms.x -= dx * 80 * dt; // opposite to player input
      if (ms.y > canvas.height / pixelRatio) {
        ms.y = -1; ms.x = Math.random() * canvas.width / pixelRatio;
      }
      if (ms.x < -2) ms.x = canvas.width / pixelRatio + 2;
      if (ms.x > canvas.width / pixelRatio + 2) ms.x = -2;
    }
  }

  function draw() {
    // Clear
    ctx.fillStyle = '#070811';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Starfield
    if (starsEnabled) {
      ctx.save();
      ctx.fillStyle = 'rgba(188,208,255,0.7)';
      for (const s of stars) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Mini stars (render as tiny horizontal streaks)
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const ms of miniStars) {
      const w = Math.max(1, Math.min(3, ms.r * 2.2));
      const h = Math.max(1, ms.r * 1.2);
      ctx.fillRect(ms.x, ms.y, w, h);
    }
    ctx.restore();

    // Player
    ctx.drawImage(playerImg, state.player.x, state.player.y, state.player.w, state.player.h);

    // Bullets (player)
    ctx.fillStyle = '#7cf1c8';
    for (const b of state.bullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Alien bullets
    ctx.fillStyle = '#ff6b81';
    for (const b of state.alienBullets) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Aliens
    for (const a of state.aliens) {
      const alienImg = getAlienImg(a.level || state.level);
      ctx.drawImage(alienImg, a.x, a.y, a.w, a.h);
    }

    // Asteroids (draw as rough rocks)
    for (const a of state.asteroids) {
      const cx = a.x + a.w/2;
      const cy = a.y + a.h/2;
      const r = Math.min(a.w, a.h) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a.rot);
      ctx.beginPath();
      const jag = 8;
      for (let i = 0; i < jag; i++) {
        const ang = (i / jag) * Math.PI * 2;
        const rr = r * (0.8 + Math.random()*0.3);
        const x = Math.cos(ang) * rr;
        const y = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = '#6e6f75';
      ctx.strokeStyle = '#3e4046';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // UI: lives bar
    const margin = 12;
    for (let i = 0; i < 3; i++) {
      const x = canvas.width / pixelRatio - margin - (i + 1) * 18;
      const y = margin;
      ctx.globalAlpha = i < 3 - state.hits ? 1 : 0.25;
      ctx.fillStyle = '#98ffe2';
      ctx.fillRect(x, y, 12, 12);
      ctx.globalAlpha = 1;
    }
  }

  function loop() {
    const t = nowMs();
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    if (state.running) {
      update(dt);
      draw();
    } else {
      draw();
    }
    requestAnimationFrame(loop);
  }

  // Initialize player position after images load for consistency
  function centerPlayer() {
    state.player.x = canvas.width / pixelRatio / 2 - state.player.w / 2;
    state.player.y = canvas.height / pixelRatio - state.player.h - 22;
  }
  playerImg.onload = centerPlayer;
  window.addEventListener('resize', centerPlayer);

  // Initialize HUD
  updateAlienInfo();

  requestAnimationFrame(loop);
})();


