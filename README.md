# 🚀 Invasores Galácticos

Un juego de tipo Space Invaders desarrollado con JavaScript puro, HTML5 Canvas y CSS3. Defiende tu nave espacial contra oleadas de aliens con diferentes patrones de movimiento y capacidades de disparo.

## 📋 Tabla de Contenidos

- [Descripción](#descripción)
- [Características](#características)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Análisis Detallado del Código JavaScript](#análisis-detallado-del-código-javascript)
  - [Configuración Inicial](#1-configuración-inicial)
  - [Sistema de Audio](#2-sistema-de-audio)
  - [Sistema de Assets](#3-sistema-de-assets)
  - [Estado del Juego](#4-estado-del-juego)
  - [Sistema de Entrada](#5-sistema-de-entrada)
  - [Funciones Helper](#6-funciones-helper)
  - [Spawn de Aliens](#7-spawn-de-aliens)
  - [Sistema de Disparos](#8-sistema-de-disparos)
  - [Loop Principal de Actualización](#9-loop-principal-de-actualización)
  - [Sistema de Renderizado](#10-sistema-de-renderizado)
  - [Sistema de Niveles](#11-sistema-de-niveles)
- [Controles](#controles)
- [Requisitos](#requisitos)
- [Instalación](#instalación)

## 🎮 Descripción

**Invasores Galácticos** es un shooter espacial donde controlas una nave en la parte inferior de la pantalla. Los aliens aparecen desde arriba con diferentes formas, velocidades y patrones de movimiento. Algunos aliens pueden disparar proyectiles. El objetivo es destruir tantos aliens como sea posible mientras sobrevives a sus ataques.

### Características Principales

- ✨ **Canvas adaptativo** con soporte para alta densidad de píxeles
- 🎵 **Sistema de audio procedural** usando Web Audio API
- 🎨 **3 tipos de aliens** con formas diferentes según el nivel
- 🎯 **4 patrones de movimiento**優先 para aliens
- 🔫 **Disparo aleatorio** de aliens (no todos pueden disparar)
- 📊 **Sistema de niveles** progresivo con dificultad creciente
- 💫 **Fondo de galaxia** procedural con efecto parallax
- 🎛️ **HUD completo** con estadísticas y información en tiempo real

## 📁 Estructura del Proyecto

```
CBA-JS-GAME-Jones/
├── index.html          # Estructura HTML del juego
├── styles.css          # Estilos y diseño responsive
├── game.js             # Lógica principal del juego (JavaScript)
├── README.md           # Esta documentación
├── .gitignore          # Archivos ignorados por Git
└── assets/
    ├── player.svg      # Imagen de la nave del jugador
    ├── alien.svg       # Alien nivel 1-2 (azul/violeta)
    ├── alien2.svg      # Alien nivel 3-4 (rojo/naranja)
    └── alien3.svg      # Alien nivel 5+ (amarillo/dorado)
```

---

## 🔍 Análisis Detallado del Código JavaScript

El código está encapsulado en una **IIFE (Immediately Invoked Function Expression)** para evitar la contaminación del scope global:

```javascript
(function() {
  // Todo el código del juego aquí
})();
```

### 1. Configuración Inicial

#### Elementos del DOM

```javascript
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
```

- `canvas`: Elemento HTML5 Canvas donde se renderiza el juego
- `ctx`: Contexto 2D del canvas (`alpha: false` mejora el rendimiento)
- Se obtienen referencias a todos los elementos del DOM necesarios (score, hits, level, overlays, botones)

#### Ajuste Responsive del Canvas

```javascript
let pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio взять 1));

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
```

**Explicación:**
- `pixelRatio`: Detecta la densidad de píxeles del dispositivo (1-2x)
- `fitCanvasToParent()`: Ajusta el canvas al contenedor manteniendo calidad en pantallas Retina
- Usa un canvas de alta resolución pero lo escala visualmente
- `setTransform()`: Ajusta el sistema de coordenadas para trabajar con píxeles lógicos

### 2. Sistema de Audio

El juego usa **Web Audio API** para generar sonidos proceduralmente (sin archivos de audio).

#### Inicialización del Audio Context

```javascript
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
}
```

**Motivo:** Los navegadores modernos requieren interacción del usuario para activar el audio. Se inicializa en el primer `keydown`.

#### Envelope Generator

```javascript
function env(durationMs, start=0.001, peak=0.2, end=0.0008, a=5) {
  const g = audioCtx.createGain();
  const t = audioCtx.currentTime;
  g.gain.setValueAtTime(start, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a/1000);
  g.gain.exponentialRampToValueAtTime(end, t + durationMs/1000);
  return g;
}
```

**Función:** Crea una envolvente ADSR para controlar el volumen del sonido:
- `start`: Volumen inicial (muy bajo)
- `peak`: Volumen máximo
- `end`: Volumen final (fade out)
- `a`: Tiempo de ataque (attack) en milisegundos

#### Generador de Tono (Beep)

```javascript
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
```

**Parámetros:**
- `type`: Forma de onda ('square', 'sawtooth', 'sine', 'triangle')
- `freq`: Frecuencia en Hz
- `duration`: Duración en ms
- `detune`: Desviación en cents (±100 cents = 1 semitono)

#### Generador de Ruido (Noise)

```javascript
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
```

**Proceso:**
1. Crea un buffer de audio del tamaño necesario
2. Llena el buffer con valores aleatorios (-1 a 1) = ruido blanco
3. Aplica un filtro **lowpass** para suavizar (sonido de explosión)
4. Aplica la envolvente para el fade out

#### Efectos de Sonido

```javascript
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
```

**Diseño de sonidos:**
- **Disparo jugador**: Dos beeps ascendentes (chirp agudo)
- **Disparo alien**: Tono grave con sawtooth
- **Impacto alien**: Ruido filtrado corto
- **Impacto jugador**: Tono grave + ruido (sonido dramático)

### 3. Sistema de Assets

#### Carga de Imágenes

```javascript
const playerImg = new Image();
const alienImgs = [
  new Image(), // alien.svg - Nivel 1-2
  new Image(), // alien2.svg - Nivel 3-4
  new Image()  // alien3.svg - Nivel 5+
];
playerImg.src = 'assets/player.svg';
alienImgs[0].src = 'assets/alien.svg';
alienImgs[1].src = 'assets/alien2.svg';
alienImgs[2].src = 'assets/alien3.svg';
```

#### Selección de Imagen por Nivel

```javascript
function getAlienImg(level) {
  if (level <= 2) return alienImgs[0];
  if (level <= 4) return alienImgs[1];
  return alienImgs[2];
}
```

**Lógica:**
- Nivel 1-2: Alien azul/violeta
- Nivel 3-4: Alien rojo/naranja
- Nivel 5+: Alien amarillo/dorado

### 4. Estado del Juego

El estado global se almacena en un objeto único:

```javascript
const state = {
  running: true,              // Juego activo/pausado
  gameOver: false,            // Estado de fin de juego
  score: 0,                   // Puntos acumulados
  hits: 0,                    // Impactos recibidos (máx 3)
  level: 1,                   // Nivel actual
  nextLevelAt: 10,            // Score necesario para siguiente nivel
  player: {                   // Información del jugador
    x: 0, y: 0,               // Posición
    w: 52, h: 52,             // Dimensiones
    speed: 420                // Velocidad en píxeles/segundo
  },
  bullets: [],                // Balas del jugador
  alienBullets: [],           // Balas de aliens
  aliens: [],                 // Array de aliens activos
  lastShotAt: 0,              // Timestamp del último disparo
  fireCooldownMs: 180,        // Cooldown entre disparos (ms)
  spawnTimer: 0,              // Timer para spawn de aliens
  spawnEveryMs: 550,          // Intervalo entre spawns
};
```

**Estructura de un alien:**

```javascript
{
  x, y,              // Posición
  w, h,              // Dimensiones (44x44)
  speed,             // Velocidad base
  type,              // 'straight' | 'sine' | 'zigzag' | 'drift'
  t,                 // Tiempo acumulado (para patrones)
  ax,                // Posición X inicial (para patterns)
  amp,               // Amplitud (para sine/drift)
  dir,               // Dirección horizontal (-1 o 1)
  hp,                // Vida (1 o 2)
  canShoot,          // Boolean: puede disparar
  lastShotAt,        // Timestamp del último disparo
  level              // Nivel cuando fue creado (para imagen)
}
```

### 5. Sistema de Entrada

```javascript
const keys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') e.preventDefault();
  keys.add(e.code);
  if (e.code === 'KeyP') togglePause();
  ensureAudio();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
```

**Características:**
- Usa un `Set` para almacenar teclas presionadas (evita duplicados)
- `preventDefault()` en Space evita scroll
- La pausa se maneja directamente en el listener
- `ensureAudio()` activa el audio en la primera interacción

### 6. Funciones Helper

```javascript
function clamp(v, min, max) { 
  return Math.max(min, Math.min(max, v)); 
}

function nowMs() { 
  return performance.now(); 
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && 
         a.y < b.y + b.h && a.y + a.h > b.y;
}
```

**Funciones:**
- `clamp()`: Limita un valor entre min y max
- `nowMs()`: Timestamp de alta precisión para cálculos de tiempo
- `rectsOverlap()`: Detección de colisión AABB (Axis-Aligned Bounding Box)

### 7. Spawn de Aliens

```javascript
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
    x, y, w, h, speed, type, t:0, ax:x, 
    amp:30 + Math.random()*40, 
    dir: Math.random()<0.5?-1:1, 
    hp, canShoot, lastShotAt: 0,
    level: state.level 
  });
}
```

**Lógica:**
1. **Posición aleatoria** en X, aparece desde arriba (y negativo)
2. **Velocidad variable** base (60-220 px/s)
3. **Tipo según nivel**: Más tipos disponibles en niveles altos
4. **Velocidad escalada**: +12% por nivel
5. **HP**: Los aliens 'drift' tienen 2 HP (más resistentes)
6. **Capacidad de disparo**: 30% base + 5% por nivel
7. **Parámetros de movimiento**: Amplitud aleatoria, dirección aleatoria

### 8. Sistema de Disparos

#### Disparo del Jugador

```javascript
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
```

**Características:**
- Sistema de cooldown para limitar rate of fire
- Balas centradas en la nave
- Velocidad fija (520 px/s hacia arriba)
- Reproduce sonido de disparo

#### Disparo de Aliens

```javascript
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
```

**Diferencias con jugador:**
- Cooldown variable (800-2000ms) por alien
- Velocidad variable (280-380 px/s)
- Balas más pequeñas (5x12 vs 6x14)
- Se llama desde el update loop con probabilidad aleatoria

**Activación del disparo alien:**

```javascript
if (a.canShoot && a.y > 0 && a.y < canvas.height / pixelRatio - 100) {
  if (Math.random() < 0.003) { // 0.3% chance per frame
    alienShoot(a);
  }
}
```

- Solo dispara si está visible en pantalla
- Probabilidad muy baja por frame (0.3%) = disparo ocasional

### 9. Loop Principal de Actualización

El juego usa un **game loop** basado en tiempo delta (dt):

```javascript
function update(dt) {
  // dt = tiempo transcurrido en segundos desde último frame
}
```

#### 9.1. Movimiento del Jugador

```javascript
state.player.y = canvas.height / pixelRatio - state.player.h - 22;

let dx = 0;
if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
if (dx !== 0) {
  state.player.x += dx * state.player.speed * dt;
}
state.player.x = clamp(state.player.x, 8, canvas.width / pixelRatio - state.player.w - 8);
```

**Cálculo basado en tiempo:**
- `dx * speed * dt`: Movimiento independiente del framerate
- `dt` en segundos, `speed` en px/s → resultado en píxeles
- Posición Y fija (parte inferior)
- `clamp()` mantiene la nave dentro de los límites

#### 9.2. Actualización de Balas

```javascript
// Balas del jugador (suben)
for (let i = state.bullets.length - 1; i >= 0; i--) {
  const b = state.bullets[i];
  b.y -= b.speed * dt;
  if (b.y + b.h < -30) {
    state.bullets.splice(i, 1);
  }
}

// Balas de aliens (bajan)
for (let i = state.alienBullets.length - 1; i >= 0; i--) {
  const b = state.alienBullets[i];
  b.y += b.speed * dt;
  if (b.y > canvas.height / pixelRatio + 30) {
    state.alienBullets.splice(i, 1);
  }
}
```

**Nota:** Iteración desde el final del array para evitar problemas al eliminar elementos.

#### 9.3. Spawn de Aliens

```javascript
state.spawnTimer += dt * 1000; // convertir a ms
if (state.spawnTimer >= state.spawnEveryMs) {
  state.spawnTimer = 0;
  state.spawnEveryMs = Math.max(200, state.spawnEveryMs - (state.level >= 3 ? 5 : 3));
  spawnAlien();
  if (Math.random() < 0.18) spawnAlien(); // 18% chance de spawn doble
}
```

**Dificultad progresiva:**
- Intervalo entre spawns se reduce progresivamente
- Niveles altos: reducción más rápida (-5ms vs -3ms)
- Mínimo: 200ms entre spawns
- Probabilidad de spawn doble (18%)

#### 9.4. Movimiento de Aliens

```javascript
for (let i = state.aliens.length - 1; i >= 0; i--) {
  const a = state.aliens[i];
  a.t += dt; // tiempo acumulado para patrones
  
  // Movement by type
  if (a.type === 'straight') {
    a.y += a.speed * dt;
  } else if (a.type === 'sine') {
    a.y += a.speed * dt * 0.95; // más lento
    a.x = a.ax + Math.sin(a.t * 3) * a.amp;
  } else if (a.type === 'zigzag') {
    a.y += a.speed * dt * 1.05; // más rápido
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
}
```

**Patrones de movimiento:**

1. **Straight**: Descenso recto, velocidad base
2. **Sine**: Movimiento sinusoidal horizontal, 95% velocidad vertical
3. **Zigzag**: Rebota en bordes, 105% velocidad vertical
4. **Drift**: Movimiento circular suave, 90% velocidad vertical (más lento pero peligroso)

#### 9.5. Sistema de Colisiones

**Balas del jugador vs Aliens:**

```javascript
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
```

**Características:**
- Sistema de HP: algunos aliens requieren múltiples impactos
- Remueve bala y alien en colisión
- Actualiza score y UI
- Reproduce sonido de impacto

**Balas de Aliens vs Jugador:**

```javascript
for (let i = state.alienBullets.length - 1; i >= 0; i--) {
  const b = state.alienBullets[i];
  if (rectsOverlap(b, state.player)) {
    state.alienBullets.splice(i, 1);
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
```

**Aliens vs Jugador (colisión directa):**

Lógica similar pero sin remover la bala alien (es colisión de entidades).

### 10. Sistema de Renderizado

```javascript
function draw() {
  // 1. Limpia el canvas
  ctx.fillStyle = '#070811';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Fondo de estrellas (parallax)
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

  // 3. Dibuja jugador
  ctx.drawImage(playerImg, state.player.x, state.player.y, state.player.w, state.player.h);

  // 4. Dibuja balas del jugador (verde/cyan)
  ctx.fillStyle = '#7cf1c8';
  for (const b of state.bullets) {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // 5. Dibuja balas de aliens (rojo/rosa)
  ctx.fillStyle = '#ff6b81';
  for (const b of state.alienBullets) {
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // 6. Dibuja aliens (imagen según nivel)
  for (const a of state.aliens) {
    const alienImg = getAlienImg(a.level || state.level);
    ctx.drawImage(alienImg, a.x, a.y, a.w, a.h);
  }

  // 7. UI: Barra de vidas
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
```

**Orden de renderizado (Z-order):**
1. Fondo (estrellas)
2. Entidades de juego (jugador, aliens, balas)
3. UI (vidas)

**Optimizaciones:**
- `save()/restore()` para aislar cambios de estilo
- `globalAlpha` para vidas perdidas (transparencia)
- Reutilización de objetos de imagen

#### Loop de Renderizado

```javascript
function loop() {
  const t = nowMs();
  const dt = Math.min(0.033, (t - last) / 1000); // cap a 30 FPS mínimo
  last = t;
  if (state.running) {
    update(dt);
    draw();
  } else {
    draw(); // dibuja aunque esté pausado
  }
  requestAnimationFrame(loop);
}
```

**Características:**
- **Delta time capping**: Limita `dt` a 33ms (30 FPS mínimo) para evitar saltos grandes
- `requestAnimationFrame`: Sincronizado con el refresh rate del navegador
- Renderiza incluso cuando está pausado (para mostrar overlay)

### 11. Sistema de Niveles

```javascript
// Level progression
if (state.score >= state.nextLevelAt) {
  state.level += 1;
  if (levelEl) levelEl.textContent = String(state.level);
  state.nextLevelAt += 10 + Math.floor(state.level * 2);
  state.fireCooldownMs = Math.max(120, state.fireCooldownMs - 10);
  state.spawnEveryMs = Math.max(200, state.spawnEveryMs - 30);
  updateAlienInfo();
}
```

**Progresión:**
- Nivel 1: Score 0-9
- Nivel 2: Score 10-21 (nextLevelAt = 10 + 2*1 = 12... no, espera)
- Fórmula: `nextLevelAt += 10 + floor(level * 2)`
  - Nivel 1→2: +12 (10 + 2)
  - Nivel 2→3: +14 (10 + 4)
  - Nivel 3→4: +16 (10 + 6)
  - etc.

**Ajustes por nivel:**
- **Cooldown de disparo**: Se reduce 10ms por nivel (más rápido)
- **Spawn rate**: Se reduce 30ms por nivel (más aliens)
- **Imagen de aliens**: Cambia según nivel
- **Tipos de aliens**: Más variedad en niveles altos

#### Actualización del HUD

```javascript
function updateAlienInfo() {
  if (!alienTypesEl) return;
  const info = [];
  if (state.level <= 2) {
    info.push({ img: 'assets/alien.svg', text: 'Nivel 1-2: Azul/Violeta' });
  } else if (state.level >= 3 && state.level <= 4) {
    info.push({ img: 'assets/alien2.svg', text: 'Nivel 3-4: Rojo/Naranja' });
  } else if (state.level >= 5) {
    info.push({ img: 'assets/alien3.svg', text: 'Nivel 5+: Amarillo/Dorado' });
  }
  alienTypesEl.innerHTML = info.map(item => 
    `<div class="alien-item">
      <img src="${item.img}" alt="alien">
      <span>${item.text}</span>
    </div>`
  ).join('');
}
```

Actualiza dinámicamente la información de aliens visibles en el HUD.

---

## 🎮 Controles

| Tecla | Acción |
|-------|--------|
| `←` / `A` | Mover izquierda |
| `→` / `D` | Mover derecha |
| `Espacio` | Disparar |
| `P` | Pausar/Continuar |

## 📋 Requisitos

- Navegador web moderno (Chrome, Firefox, Edge, Safari)
- JavaScript habilitado
- No requiere dependencias externas

## 🚀 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/Acer0Felix/CBA-JS-GAME4.git
cd CBA-JS-GAME4
```

2. Abre `index.html` en tu navegador:
   - Opción 1: Doble clic en `index.html`
   - Opción 2: Servidor local:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Node.js (con http-server)
     npx http-server
     ```
   - Luego visita: `http://localhost:8000`

3. ¡Juega! 🎮

---

## 📝 Notas Técnicas

### Rendimiento

- **Canvas optimizado**: Usa `alpha: false` para mejor rendimiento
- **Pixel ratio**: Soporte para pantallas Retina sin pérdida de calidad
- **Delta time**: Cálculos independientes del framerate
- **Iteración inversa**: Para eliminar elementos de arrays sin afectar índices

### Compatibilidad

- **Web Audio API**: Requiere navegador moderno (2014+)
- **Canvas**: Compatible con todos los navegadores modernos
- **RequestAnimationFrame**: Sincronizado con refresh rate

### Arquitectura

- **IIFE**: Encapsula el código para evitar conflictos
- **Estado centralizado**: Todo el estado en un objeto `state`
- **Separación de concerns**: Update y Draw separados
- **Funciones puras**: Helpers sin efectos secundarios

---

## 🎨 Personalización

### Cambiar Dificultad

En `game.js`, ajusta:

```javascript
// Frecuencia de spawn inicial
spawnEveryMs: 550, // aumenta para más fácil

// Velocidad del jugador
speed: 420, // aumenta para más rápido

// Vidas
if (state.hits >= 3) // cambia 3 a otro valor
```

### Agregar Nuevos Tipos de Aliens

1. Crea un nuevo SVG en `assets/alien4.svg`
2. Agrega la imagen al array `alienImgs`
3. Agrega un nuevo patrón de movimiento en el loop de update:
```javascript
else if (a.type === 'newtype') {
  // tu lógica de movimiento
}
```

---

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

## 👤 Autor

**Acer0Felix**

- GitHub: [@Acer0Felix](https://github.com/Acer0Felix)
- Email: felix.e.acero@gmail.com

---

¡Disfruta del juego! 🚀👾

