(function(){
"use strict";

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
const titleEl = document.getElementById('titleScreen');
const menuEl = document.getElementById('menu');
const mapSelectEl = document.getElementById('mapSelect');
const gameoverEl = document.getElementById('gameover');
const classGridEl = document.getElementById('classGrid');
const mapGridEl = document.getElementById('mapGrid');
const pauseEl = document.getElementById('pauseOverlay');
const recordsEl = document.getElementById('recordsOverlay');
const tutorialEl = document.getElementById('tutorialOverlay');

// ================= SPRITES DE ARMAS (imagens reais) =================
const WEAPON_SHEETS = {
  minigun:   { src: 'minigun.png',   frames: 6, w: 174, h: 13 },
  pistol:    { src: 'pistol.png',    frames: 6, w: 90,  h: 12 },
  revolver:  { src: 'revolver.png',  frames: 6, w: 84,  h: 12 },
  shotgun:   { src: 'shotgun.png',   frames: 6, w: 138, h: 15 },
  sniper:    { src: 'sniper.png',    frames: 6, w: 216, h: 14 },
  subfusile: { src: 'subfusile.png', frames: 6, w: 126, h: 13 },
  uzi:       { src: 'uzi.png',       frames: 6, w: 96,  h: 14 },
  shot:      { src: 'shot.png',      frames: 6, w: 50,  h: 11 },
};
const weaponImages = {};
(function loadWeaponSprites(){
  for (const key of Object.keys(WEAPON_SHEETS)){
    const img = new Image();
    img.src = WEAPON_SHEETS[key].src;
    weaponImages[key] = img;
  }
})();

const CLASS_WEAPON_SPRITE = {
  medico:      { primary: 'subfusile', secondary: 'pistol',    scale: 1.55 },
  assassino:   { primary: 'sniper',    secondary: 'pistol',    scale: 1.35 },
  metralhador: { primary: 'minigun',   secondary: 'pistol',    scale: 1.55 },
  general:     { primary: 'pistol',    secondary: 'subfusile', scale: 1.6 },
  engenheiro:  { primary: 'subfusile', secondary: 'pistol',    scale: 1.55 },
  cacador:     { primary: 'shotgun',   secondary: 'pistol',    scale: 1.45 },
  demolidor:   { primary: 'shotgun',   secondary: 'pistol',    scale: 1.5 },
  lancachamas: { primary: 'minigun',   secondary: 'pistol',    scale: 1.5 },
  soldado:     { primary: 'subfusile', scale: 1.5 },
  sniper:      { primary: 'sniper',    scale: 1.35 },
  pesado:      { primary: 'minigun',   scale: 1.55 },
  batedor:     { primary: 'uzi',       scale: 1.6 },
  grenadeiro:  { primary: 'subfusile', scale: 1.5 },
  miniboss:    { primary: 'minigun',   scale: 1.55 },
  boss:        { primary: 'minigun',   scale: 1.7 },
};

function resolveWeaponSprite(clsKey, weaponSlot){
  const map = CLASS_WEAPON_SPRITE[clsKey];
  if (!map) return { key: 'subfusile', scale: 1.5 };
  if (weaponSlot === 'secondary' && map.secondary) return { key: map.secondary, scale: map.scale };
  return { key: map.primary, scale: map.scale };
}

// ================= SPRITES DE TIROS (All_Fire_Bullet 16x16) =================
const BULLET_SHEET_SRC = 'All_Fire_Bullet_Pixel_16x16_00.png';
const BULLET_CELL = 16;
let bulletSheetImg = null;
(function loadBulletSheet(){
  const img = new Image();
  img.src = BULLET_SHEET_SRC;
  bulletSheetImg = img;
})();

// Animações da spritesheet: col/row em células 16x16
const BULLET_ANIMS = {
  bolt:      { col: 16, row: 13, frames: 6, fps: 16, scale: 2.0, rotate: true },
  orb:       { col: 0,  row: 13, frames: 5, fps: 14, scale: 1.7, rotate: false },
  pellet:    { col: 0,  row: 9,  frames: 5, fps: 18, scale: 1.4, rotate: true },
  arrow:     { col: 16, row: 9,  frames: 4, fps: 12, scale: 2.2, rotate: true },
  flame:     { col: 28, row: 13, frames: 8, fps: 20, scale: 2.1, rotate: true },
  explosive: { col: 11, row: 18, frames: 6, fps: 12, scale: 2.6, rotate: false },
  enemy:     { col: 0,  row: 18, frames: 5, fps: 14, scale: 1.6, rotate: false },
  ally:      { col: 0,  row: 13, frames: 5, fps: 14, scale: 1.55, rotate: false },
  heavy:     { col: 16, row: 13, frames: 6, fps: 14, scale: 2.5, rotate: true },
};

function pickBulletAnim(opts){
  if (opts.flame) return 'flame';
  if (opts.explosive || opts.big) return 'explosive';
  if (opts.owner === 'enemy') return opts.big ? 'heavy' : 'enemy';
  if (opts.owner === 'ally') return 'ally';
  if (opts.pellets && opts.pellets > 1) return 'pellet';
  if (opts.sound === 'sniper' || (opts.damage && opts.damage >= 28)) return 'arrow';
  if (opts.sound === 'shotgun') return 'pellet';
  if (opts.sound === 'pistol') return 'orb';
  if (opts.sound === 'mg' || opts.sound === 'rifle') return 'bolt';
  return 'bolt';
}

function initBulletAnim(b, animKey){
  const a = BULLET_ANIMS[animKey] || BULLET_ANIMS.bolt;
  b.anim = animKey;
  b.animFrame = Math.floor(Math.random() * a.frames);
  b.animTimer = 0;
}

function updateBulletAnim(b, dt){
  if (!b.anim){
    initBulletAnim(b, pickBulletAnim({
      owner: b.owner, flame: !!b.flame, explosive: !!b.explosive, big: !!b.big,
    }));
  }
  const a = BULLET_ANIMS[b.anim];
  if (!a) return;
  b.animTimer = (b.animTimer || 0) + dt;
  const frameMs = 1000 / a.fps;
  while (b.animTimer >= frameMs){
    b.animTimer -= frameMs;
    b.animFrame = ((b.animFrame || 0) + 1) % a.frames;
  }
}

function drawBulletSprite(b, sx, sy){
  const a = BULLET_ANIMS[b.anim] || BULLET_ANIMS.bolt;
  if (!bulletSheetImg || !bulletSheetImg.complete || !bulletSheetImg.naturalWidth) return false;
  const cell = BULLET_CELL;
  const fr = (b.animFrame || 0) % a.frames;
  const srcX = (a.col + fr) * cell;
  const srcY = a.row * cell;
  const scale = a.scale || 1.5;
  const dw = cell * scale;
  const dh = cell * scale;
  const ang = Math.atan2(b.vy, b.vx);

  ctx.save();
  ctx.translate(sx, sy);
  if (a.rotate) ctx.rotate(ang);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(bulletSheetImg, srcX, srcY, cell, cell, -dw/2, -dh/2, dw, dh);
  ctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = prev;
  ctx.restore();
  return true;
}

// ================= PROGRESSO (localStorage) =================
const STORAGE_KEY = 'sfh_ceu_aberto_v1';
function loadProgress(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { highScore:0, bestTime:null, lastClass:null, tutorialSeen:false };
    const d = JSON.parse(raw);
    return {
      highScore: d.highScore|0,
      bestTime: d.bestTime != null ? d.bestTime : null,
      lastClass: d.lastClass || null,
      tutorialSeen: !!d.tutorialSeen,
    };
  } catch(e){
    return { highScore:0, bestTime:null, lastClass:null, tutorialSeen:false };
  }
}
function saveProgress(data){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e){}
}
let progress = loadProgress();

function formatTime(ms){
  if (ms == null || ms < 0) return '—';
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const sec = s % 60;
  return m + ':' + (sec<10?'0':'') + sec;
}

function updateRecordsUI(){
  const body = document.getElementById('recordsBody');
  if (!body) return;
  const best = progress.bestTime != null ? formatTime(progress.bestTime) : '—';
  const last = progress.lastClass && CLASSES[progress.lastClass] ? CLASSES[progress.lastClass].name : '—';
  body.innerHTML = `
    <div class="recRow"><span class="recLabel">Melhor pontuação</span><b>${progress.highScore}</b></div>
    <div class="recRow"><span class="recLabel">Melhor tempo (vitória)</span><b>${best}</b></div>
    <div class="recRow"><span class="recLabel">Última classe</span><b>${last}</b></div>
  `;
}

function showRecords(){
  updateRecordsUI();
  titleEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  if (tutorialEl) tutorialEl.classList.add('hidden');
  recordsEl.classList.remove('hidden');
}

function hideRecords(){
  recordsEl.classList.add('hidden');
  titleEl.classList.remove('hidden');
}

// Mantém o aspect ratio 16:9 do canvas na tela cheia
function fitCanvas(){
  const vv = window.visualViewport;
  const aw = 960, ah = 540;
  const ww = Math.round(vv ? vv.width : window.innerWidth);
  const wh = Math.round(vv ? vv.height : window.innerHeight);
  const scale = Math.min(ww / aw, wh / ah);
  canvas.style.width = Math.floor(aw * scale) + 'px';
  canvas.style.height = Math.floor(ah * scale) + 'px';
  checkOrientation();
}
function isPortraitTouch(){
  return (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && window.innerHeight > window.innerWidth;
}
function checkOrientation(){
  const portrait = isPortraitTouch();
  document.body.classList.toggle('portrait', portrait);
  // pausa sozinho se o celular for virado em pé no meio da partida
  try { if (portrait && running && !paused) togglePause(); } catch(e){ /* jogo ainda carregando */ }
}
window.addEventListener('resize', fitCanvas);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 150));
document.addEventListener('visibilitychange', () => {
  try { if (document.hidden && running && !paused) togglePause(); } catch(e){}
});
// bloqueia menu de segurar (long-press) e zoom por gesto no celular
document.addEventListener('contextmenu', e => e.preventDefault());
['gesturestart','gesturechange','gestureend'].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
fitCanvas();

// Evita scroll / zoom / refresh por gesto no mobile
document.addEventListener('touchmove', e => {
  if (e.target.closest && (e.target.closest('#mobileControls') || e.target === canvas || e.target.closest('#wrap'))) {
    e.preventDefault();
  }
}, { passive: false });

const RESPAWN_WAIT = 5000; // tempo (ms) que aliados e inimigos esperam para voltar após serem derrubados

// ================= ÁUDIO (música procedural + tiros sintetizados via Web Audio API) =================
// Obs.: não é possível incorporar áudio de vídeos do YouTube (direitos autorais). Em vez disso,
// geramos trilhas originais e efeitos de tiro por código — sem depender de nenhum arquivo externo.
let audioCtx = null, masterGain = null, musicGain = null, sfxGain = null, noiseBuffer = null;
let audioMuted = false;
let musicMode = null;       // null | 'normal' | 'boss'
let musicGenToken = 0;      // invalida loops antigos quando a música troca

function initAudio(){
  try {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{});
      return;
    }
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain(); masterGain.gain.value = audioMuted ? 0 : 0.9;
    masterGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain(); musicGain.gain.value = 0;
    musicGain.connect(masterGain);
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = 0.85;
    sfxGain.connect(masterGain);

    const bufferSize = audioCtx.sampleRate * 0.5;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = Math.random()*2-1;

    // Garante resume em qualquer interação futura
    const resume = () => { if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(()=>{}); };
    window.addEventListener('click', resume, { once:true });
    window.addEventListener('keydown', resume, { once:true });
  } catch(e){ /* Web Audio indisponível — o jogo segue sem som */ }
}

function toggleMute(){
  audioMuted = !audioMuted;
  if (masterGain && audioCtx){
    masterGain.gain.setTargetAtTime(audioMuted ? 0 : 0.9, audioCtx.currentTime, 0.05);
  }
  showNotif(audioMuted ? '🔇 Som desativado (M)' : '🔊 Som ativado (M)');
}

// ---- trilha sonora procedural (bambuzal calmo nas ondas normais / tensa na luta do chefe) ----
const MUSIC_PATTERNS = {
  normal: {
    bpm: 96, beats: 16,
    bass: [
      {b:0,  n:130.81, d:1.8, t:'sine'},  {b:4,  n:164.81, d:1.8, t:'sine'},
      {b:8,  n:146.83, d:1.8, t:'sine'},  {b:12, n:196.00, d:1.8, t:'sine'},
    ],
    melody: [
      {b:0,n:523.25,d:0.9,t:'triangle'},{b:1,n:587.33,d:0.4,t:'triangle'},{b:1.5,n:659.25,d:0.4,t:'triangle'},
      {b:2,n:698.46,d:0.9,t:'triangle'},{b:3.5,n:587.33,d:0.4,t:'triangle'},
      {b:4,n:659.25,d:0.9,t:'triangle'},{b:5.5,n:523.25,d:0.9,t:'triangle'},
      {b:7,n:440.00,d:0.9,t:'triangle'},
      {b:8,n:493.88,d:0.9,t:'triangle'},{b:9,n:587.33,d:0.4,t:'triangle'},{b:9.5,n:659.25,d:0.4,t:'triangle'},
      {b:10,n:698.46,d:0.9,t:'triangle'},{b:11.5,n:587.33,d:0.4,t:'triangle'},
      {b:12,n:523.25,d:1.6,t:'triangle'},
      {b:14,n:440.00,d:1.6,t:'triangle'},
    ],
    melGain:0.05, bassGain:0.09,
  },
  boss: {
    bpm: 150, beats: 16,
    bass: [
      {b:0,n:98.00,d:0.42,t:'sawtooth'},{b:0.5,n:98.00,d:0.42,t:'sawtooth'},{b:1,n:110.00,d:0.42,t:'sawtooth'},{b:1.5,n:98.00,d:0.42,t:'sawtooth'},
      {b:2,n:98.00,d:0.42,t:'sawtooth'},{b:2.5,n:98.00,d:0.42,t:'sawtooth'},{b:3,n:116.54,d:0.42,t:'sawtooth'},{b:3.5,n:98.00,d:0.42,t:'sawtooth'},
      {b:4,n:103.83,d:0.42,t:'sawtooth'},{b:4.5,n:103.83,d:0.42,t:'sawtooth'},{b:5,n:116.54,d:0.42,t:'sawtooth'},{b:5.5,n:103.83,d:0.42,t:'sawtooth'},
      {b:6,n:98.00,d:0.42,t:'sawtooth'},{b:6.5,n:98.00,d:0.42,t:'sawtooth'},{b:7,n:87.31,d:0.42,t:'sawtooth'},{b:7.5,n:98.00,d:0.42,t:'sawtooth'},
      {b:8,n:98.00,d:0.42,t:'sawtooth'},{b:8.5,n:98.00,d:0.42,t:'sawtooth'},{b:9,n:110.00,d:0.42,t:'sawtooth'},{b:9.5,n:98.00,d:0.42,t:'sawtooth'},
      {b:10,n:98.00,d:0.42,t:'sawtooth'},{b:10.5,n:98.00,d:0.42,t:'sawtooth'},{b:11,n:116.54,d:0.42,t:'sawtooth'},{b:11.5,n:98.00,d:0.42,t:'sawtooth'},
      {b:12,n:103.83,d:0.42,t:'sawtooth'},{b:12.5,n:103.83,d:0.42,t:'sawtooth'},{b:13,n:130.81,d:0.42,t:'sawtooth'},{b:13.5,n:103.83,d:0.42,t:'sawtooth'},
      {b:14,n:98.00,d:0.42,t:'sawtooth'},{b:14.5,n:92.50,d:0.42,t:'sawtooth'},{b:15,n:87.31,d:0.42,t:'sawtooth'},{b:15.5,n:82.41,d:0.42,t:'sawtooth'},
    ],
    melody: [
      {b:0,n:392.00,d:0.42,t:'square'},{b:1,n:466.16,d:0.42,t:'square'},{b:2,n:392.00,d:0.42,t:'square'},{b:3,n:349.23,d:0.42,t:'square'},
      {b:4,n:415.30,d:0.42,t:'square'},{b:5,n:466.16,d:0.42,t:'square'},{b:6,n:349.23,d:0.42,t:'square'},{b:7,n:311.13,d:0.42,t:'square'},
      {b:8,n:392.00,d:0.42,t:'square'},{b:9,n:466.16,d:0.42,t:'square'},{b:10,n:523.25,d:0.42,t:'square'},{b:11,n:466.16,d:0.42,t:'square'},
      {b:12,n:415.30,d:0.42,t:'square'},{b:13,n:349.23,d:0.42,t:'square'},{b:14,n:311.13,d:0.84,t:'square'},
    ],
    melGain:0.055, bassGain:0.1,
  },
};

function scheduleNote(freq, startTime, dur, type, gain, dest){
  const osc = audioCtx.createOscillator();
  osc.type = type; osc.frequency.setValueAtTime(freq, startTime);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gain, startTime+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime+dur);
  osc.connect(g); g.connect(dest);
  osc.start(startTime); osc.stop(startTime+dur+0.05);
}

function scheduleMusicLoop(mode, token){
  if (!audioCtx || token !== musicGenToken) return;
  const pat = MUSIC_PATTERNS[mode];
  const beatDur = 60/pat.bpm;
  const t0 = audioCtx.currentTime + 0.06;
  for (const nt of pat.bass)   scheduleNote(nt.n, t0+nt.b*beatDur, nt.d*beatDur, nt.t, pat.bassGain, musicGain);
  for (const nt of pat.melody) scheduleNote(nt.n, t0+nt.b*beatDur, nt.d*beatDur, nt.t, pat.melGain, musicGain);
  const loopMs = pat.beats*beatDur*1000;
  setTimeout(() => { if (token === musicGenToken) scheduleMusicLoop(mode, token); }, loopMs - 60);
}

function setMusicMode(mode){
  if (mode === musicMode) return;
  musicMode = mode;
  musicGenToken++;
  const token = musicGenToken;
  if (!audioCtx){ if (mode) initAudio(); }
  if (!audioCtx) return;
  if (!mode){
    musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.5);
    return;
  }
  musicGain.gain.cancelScheduledValues(audioCtx.currentTime);
  musicGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.001);
  musicGain.gain.setTargetAtTime(1, audioCtx.currentTime+0.05, 0.4);
  scheduleMusicLoop(mode, token);
}
function stopAllMusic(){ setMusicMode(null); }

// ---- sons de tiro sintetizados (um timbre por tipo de arma) ----
const GUNSHOT_PARAMS = {
  pistol:  { filt:2600, q:0.7, dur:0.09, thump:130, thumpDur:0.06, vol:0.5 },
  rifle:   { filt:3400, q:0.8, dur:0.08, thump:110, thumpDur:0.07, vol:0.55 },
  mg:      { filt:3000, q:0.6, dur:0.05, thump:150, thumpDur:0.04, vol:0.34 },
  shotgun: { filt:1500, q:0.5, dur:0.20, thump:75,  thumpDur:0.16, vol:0.75 },
  sniper:  { filt:4200, q:1.1, dur:0.22, thump:60,  thumpDur:0.24, vol:0.85 },
  boss:    { filt:1200, q:0.5, dur:0.24, thump:55,  thumpDur:0.22, vol:0.9  },
  turret:  { filt:3600, q:0.7, dur:0.05, thump:160, thumpDur:0.04, vol:0.3  },
  knife:   { filt:5200, q:2.4, dur:0.06, thump:0,   thumpDur:0,    vol:0.4  },
};

function playGunshot(kind, volMul){
  if (!audioCtx || audioMuted || !noiseBuffer) return;
  const p = GUNSHOT_PARAMS[kind] || GUNSHOT_PARAMS.pistol;
  const t = audioCtx.currentTime;
  const vol = p.vol * (volMul==null?1:volMul);

  if (kind === 'knife'){
    // som de corte/whoosh em vez de disparo
    const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
    const filt = audioCtx.createBiquadFilter(); filt.type='bandpass'; filt.frequency.value=p.filt; filt.Q.value=p.q;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+0.008); g.gain.exponentialRampToValueAtTime(0.0001,t+p.dur);
    src.connect(filt); filt.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t+p.dur+0.02);
    return;
  }

  // camada de ruído filtrado (estampido)
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
  const filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = p.filt; filt.Q.value = p.q;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t+p.dur);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t+p.dur+0.02);

  // camada de "murro" grave pra dar peso
  if (p.thump > 0){
    const osc = audioCtx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(p.thump, t); osc.frequency.exponentialRampToValueAtTime(p.thump*0.5, t+p.thumpDur);
    const tg = audioCtx.createGain();
    tg.gain.setValueAtTime(vol*0.9, t); tg.gain.exponentialRampToValueAtTime(0.0001, t+p.thumpDur);
    osc.connect(tg); tg.connect(sfxGain);
    osc.start(t); osc.stop(t+p.thumpDur+0.02);
  }
}

function playBoom(volMul){
  if (!audioCtx || audioMuted || !noiseBuffer) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
  const filt = audioCtx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.setValueAtTime(1800,t); filt.frequency.exponentialRampToValueAtTime(140,t+0.35);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.75*(volMul==null?1:volMul), t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t+0.42);
}

function playJump(){
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(90, t+0.12);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.14);
  osc.connect(g); g.connect(sfxGain); osc.start(t); osc.stop(t+0.15);
}

function playLand(){
  if (!audioCtx || audioMuted || !noiseBuffer) return;
  const t = audioCtx.currentTime;
  const src = audioCtx.createBufferSource(); src.buffer = noiseBuffer;
  const filt = audioCtx.createBiquadFilter(); filt.type='lowpass'; filt.frequency.value=600;
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.1);
  src.connect(filt); filt.connect(g); g.connect(sfxGain); src.start(t); src.stop(t+0.12);
}

function playDeath(){
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t); osc.frequency.exponentialRampToValueAtTime(40, t+0.4);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.45);
  osc.connect(g); g.connect(sfxGain); osc.start(t); osc.stop(t+0.5);
}

function playAbility(){
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'square';
  osc.frequency.setValueAtTime(440, t); osc.frequency.exponentialRampToValueAtTime(880, t+0.15); osc.frequency.exponentialRampToValueAtTime(220, t+0.35);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.4);
  osc.connect(g); g.connect(sfxGain); osc.start(t); osc.stop(t+0.42);
}

function playPickup(){
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t); osc.frequency.exponentialRampToValueAtTime(1200, t+0.08);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.15);
  osc.connect(g); g.connect(sfxGain); osc.start(t); osc.stop(t+0.16);
}

function playGrenadeThrow(){
  if (!audioCtx || audioMuted) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator(); osc.type = 'triangle';
  osc.frequency.setValueAtTime(300, t); osc.frequency.linearRampToValueAtTime(120, t+0.2);
  const g = audioCtx.createGain(); g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t+0.25);
  osc.connect(g); g.connect(sfxGain); osc.start(t); osc.stop(t+0.26);
}

// distância aproximada até a câmera/jogador, pra atenuar tiros de aliados/inimigos distantes
function shotVolumeFor(x){
  if (!player || !player.alive) return 0.5;
  const d = Math.abs(x - (player.x+player.w/2));
  return Math.max(0.12, 1 - d/1100);
}

// ================= CLASSES DO JOGADOR / ALIADOS (duas armas + habilidade) =================
const CLASSES = {
  medico: {
    name:'Médico', color:'#4CAF50', speed:4.3, maxHealth:130, regen:0.12,
    primary:   { name:'Rifle de Assalto', fireRate:200, damage:10, bulletSpeed:13, pellets:1, spread:0.03, maxAmmo:36, sound:'rifle' },
    secondary: { name:'Pistola',          fireRate:260, damage:9,  bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Escudo Vital', streakNeeded:4, duration:6000, desc:'Escudo de 70 de dano por 6s para você e aliados.', short:'escudo de equipe (70 dmg / 6s)' },
    active: { name:'Regeneração Rápida', cooldown:14000, desc:'Cura 40 e triplica regeneração por 3s.', short:'cura 40 + regen x3 por 3s' },
    desc:'Suporte. Regenera vida sozinho.',
  },
  assassino: {
    name:'Assassino', color:'#9C27B0', speed:6.2, maxHealth:95, regen:0.02,
    primary:   { name:'Rifle de Precisão', fireRate:850, damage:32, bulletSpeed:20, pellets:1, spread:0.003, maxAmmo:10, sound:'sniper' },
    secondary: { name:'Pistola',           fireRate:230, damage:11, bulletSpeed:13, pellets:1, spread:0.03, maxAmmo:18, sound:'pistol' },
    ability: { name:'Investida Sombria', streakNeeded:3, duration:1200, desc:'Dash na mira + invulnerável por 1.2s.', short:'dash na mira + invuln 1.2s' },
    active: { name:'Recuo Sombrio', cooldown:11000, desc:'Recua e fica invulnerável 0.5s.', short:'recuo + invuln 0.5s' },
    desc:'Sniper ágil. Frágil, mas letal de longe.',
  },
  metralhador: {
    name:'Metralhador', color:'#FF5722', speed:3.1, maxHealth:145, regen:0,
    primary:   { name:'Metralhadora', fireRate:95,  damage:6, bulletSpeed:14, pellets:1, spread:0.11,  maxAmmo:85, sound:'mg' },
    secondary: { name:'Pistola',      fireRate:260, damage:9, bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Rajada Perfurante', streakNeeded:5, duration:0, desc:'Atinge todos na linha à frente.', short:'perfura todos na linha à frente' },
    active: { name:'Recarga Tática', cooldown:16000, desc:'Recarrega a arma equipada na hora.', short:'recarrega arma na hora' },
    desc:'Cadência alta. Bom contra grupos.',
  },
  general: {
    name:'General', color:'#3F51B5', speed:4.1, maxHealth:115, regen:0.04,
    primary:   { name:'Duas Pistolas', fireRate:110, damage:8,  bulletSpeed:13, pellets:1, spread:0.05, maxAmmo:44, sound:'pistol' },
    secondary: { name:'Rifle Tático',  fireRate:230, damage:13, bulletSpeed:13, pellets:1, spread:0.02, maxAmmo:30, sound:'rifle' },
    ability: { name:'Barragem de Artilharia', streakNeeded:4, duration:0, desc:'Bombardeia os 4 inimigos mais próximos.', short:'bombardeia 4 inimigos próximos' },
    active: { name:'Marcação de Alvo', cooldown:10000, desc:'Tiro certeiro no inimigo mais próximo.', short:'tiro extra no mais próximo' },
    desc:'Equilibrado. Duas pistolas + rifle.',
  },
  engenheiro: {
    name:'Engenheiro', color:'#FFC107', speed:3.7, maxHealth:105, regen:0,
    primary:   { name:'Rifle Automático', fireRate:220, damage:9, bulletSpeed:12, pellets:1, spread:0.03, maxAmmo:40, sound:'rifle' },
    secondary: { name:'Pistola',          fireRate:260, damage:9, bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Drone de Apoio', streakNeeded:4, duration:8000, desc:'Drone que atira por 8s.', short:'drone atirador por 8s' },
    active: { name:'Construir Torre', cooldown:8000, desc:'Constrói/reconstrói torre automática.', short:'constrói torre automática' },
    turret:true,
    desc:'Suporte. Torre automática + rifle.',
  },
  cacador: {
    name:'Caçador', color:'#795548', speed:3.5, maxHealth:135, regen:0,
    primary:   { name:'Escopeta', fireRate:650, damage:13, bulletSpeed:12, pellets:5, spread:0.13, maxAmmo:20, sound:'shotgun' },
    secondary: { name:'Pistola',  fireRate:260, damage:9, bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Rajada Direcionada', streakNeeded:3, duration:0, desc:'Estilhaços em cone na mira.', short:'estilhaços em cone na mira' },
    active: { name:'Recuo Explosivo', cooldown:12000, desc:'Estilhaços em área ao redor.', short:'dano em área ao redor' },
    desc:'Dano alto de perto. Tiro em leque.',
  },
  demolidor: {
    name:'Demolidor', color:'#E65100', speed:3.4, maxHealth:140, regen:0,
    primary:   { name:'Lançador Explosivo', fireRate:700, damage:22, bulletSpeed:9, pellets:1, spread:0.04, maxAmmo:12, sound:'shotgun', explosive:true, explodeRadius:70 },
    secondary: { name:'Pistola', fireRate:260, damage:9, bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Bombardeio', streakNeeded:4, duration:0, desc:'Lança 3 granadas nos inimigos próximos.', short:'3 granadas nos próximos' },
    active: { name:'Granada de Mão', cooldown:9000, desc:'Arremessa granada na mira.', short:'granada na mira' },
    desc:'Tiros explosivos e granadas. Controle de área.',
  },
  lancachamas: {
    name:'Lança-chamas', color:'#FF6F00', speed:3.6, maxHealth:125, regen:0,
    primary:   { name:'Lança-chamas', fireRate:50, damage:4, bulletSpeed:8, pellets:1, spread:0.18, maxAmmo:120, sound:'mg', flame:true, range:180 },
    secondary: { name:'Pistola', fireRate:260, damage:9, bulletSpeed:12, pellets:1, spread:0.02, maxAmmo:18, sound:'pistol' },
    ability: { name:'Mar de Fogo', streakNeeded:4, duration:0, desc:'Queima todos os inimigos próximos.', short:'queima inimigos próximos' },
    active: { name:'Rajada de Fogo', cooldown:11000, desc:'Chama intensa em cone por 1.5s.', short:'chama em cone 1.5s' },
    desc:'Fogo contínuo de curta distância. Queima grupos.',
  },
};
const CLASS_KEYS = Object.keys(CLASSES);

for (const key in CLASSES) {
  const c = CLASSES[key];
  const card = document.createElement('div');
  card.className = 'classCard';
  card.innerHTML = `
    <div class="icon" style="background:${c.color}"></div>
    <h3>${c.name}</h3>
    <p>${c.desc}</p>
    <div class="stats">❤ ${c.maxHealth} HP &nbsp;·&nbsp; ➤ ${c.speed.toFixed(1)} vel</div>
    <div class="row weapons"><span class="lbl">Armas</span> · ${c.primary.name} / ${c.secondary.name}</div>
    <div class="row active"><span class="lbl">E</span> · ${c.active.name}: ${c.active.short || c.active.desc}</div>
    <div class="row ability"><span class="lbl">F</span> · ${c.ability.name}: ${c.ability.short || c.ability.desc}</div>
  `;
  card.addEventListener('click', () => {
    selectedClassKey = key;
    showMapSelect();
  });
  classGridEl.appendChild(card);
}

// ================= CLASSES DOS INIMIGOS (agora com habilidade própria) =================
const ENEMY_CLASSES = {
  soldado: { name:'Soldado',   color:'#c0392b', speedMul:1.0, hpMul:1.3, fireRate:620,  damageMul:1.0, bulletSpeed:9,  spread:0.13, range:460, maxAmmo:26, sound:'rifle',
    ability:{ name:'Rajada Tática', cooldown:8000 }, behavior:'normal' },
  sniper:  { name:'Sniper',    color:'#2c3e50', speedMul:0.7, hpMul:1.0, fireRate:1250, damageMul:2.3, bulletSpeed:15, spread:0.03, range:650, maxAmmo:9, sound:'sniper',
    ability:{ name:'Tiro Certeiro', cooldown:9500 }, behavior:'cover' },
  pesado:  { name:'Pesado',    color:'#6d4c30', speedMul:0.55,hpMul:2.7, fireRate:180,  damageMul:0.55,bulletSpeed:9,  spread:0.24, range:400, maxAmmo:44, sound:'mg',
    ability:{ name:'Investida Brutal', cooldown:9000 }, behavior:'normal' },
  batedor: { name:'Batedor',   color:'#8e44ad', speedMul:1.5, hpMul:0.95,fireRate:460,  damageMul:0.85,bulletSpeed:10, spread:0.17, range:420, maxAmmo:24, sound:'pistol',
    ability:{ name:'Investida Veloz', cooldown:7000 }, behavior:'climber' },
  grenadeiro: { name:'Grenadeiro', color:'#27ae60', speedMul:0.85, hpMul:1.4, fireRate:900, damageMul:1.1, bulletSpeed:8, spread:0.1, range:380, maxAmmo:12, sound:'rifle',
    ability:{ name:'Granada', cooldown:4500 }, behavior:'grenadier', throwsGrenade:true },
  miniboss: { name:'Oficial de Elite', color:'#8e0000', speedMul:0.9, hpMul:4.5, fireRate:280, damageMul:1.4, bulletSpeed:12, spread:0.08, range:520, maxAmmo:60, sound:'mg',
    ability:{ name:'Barragem de Elite', cooldown:6000 }, behavior:'normal', isMiniBoss:true },
  boss: { name:'Comandante Supremo', color:'#1a1a1a', speedMul:0.6, hpMul:1, fireRate:200, damageMul:1, bulletSpeed:11, spread:0.12, range:600, maxAmmo:9999, sound:'boss',
    ability:{ name:'Barragem Devastadora', cooldown:5000 }, behavior:'normal' },
};
const ENEMY_KEYS = Object.keys(ENEMY_CLASSES);
const NORMAL_ENEMY_KEYS = ENEMY_KEYS.filter(k => k !== 'boss' && k !== 'miniboss');

// Quantidade de abates necessária para completar cada onda (pedido: 10, 20, 30, 40...)
function killsNeededForWave(w){
  if (w === 1) return 10;
  if (w === 2) return 20;
  if (w === 3) return 30;
  if (w === 4) return 40;
  return 40; // ondas 5 em diante mantêm o ritmo até o chefe na onda 6
}
const BOSS_WAVE = 6;
const MINIBOSS_WAVES = [3]; // mini-boss nas ondas 3 (e pode expandir)

// ================= MUNDO (sem chão!) =================
const WORLD_W = 2760;
const GRAVITY = 0.62;
const FALL_LIMIT = 620;
const CAM_Y_MIN = -480; // até onde a câmera pode subir (limite de altura extra do mapa, ex: torre central)

let platforms = [];
let ladders = [];
const BROKEN = { x:1330, y:230, w:540, h:250 };
const TOPF = 70/250;
// duas portas quebradas na fachada da casa (em vez do buraco único de antes)
const DOOR1_START = 0.13, DOOR1_END = 0.32;
const DOOR2_START = 0.63, DOOR2_END = 0.82;
let WALL_SEGMENTS = []; // paredes/teto sólidos: bloqueiam a passagem de balas (não o jogador)

function buildTreehouseWalls(){
  const {x,y,w,h} = BROKEN;
  const wallTop = y + TOPF*h;      // logo abaixo do telhado
  const wallBottom = y + h*0.76;   // até a viga da base (nível do chão interno)
  const d1s = x + w*DOOR1_START, d1e = x + w*DOOR1_END;
  const d2s = x + w*DOOR2_START, d2e = x + w*DOOR2_END;
  WALL_SEGMENTS = [
    { x:x,   y:wallTop, w:(d1s-x),      h:(wallBottom-wallTop) }, // parede antes da porta 1
    { x:d1e, y:wallTop, w:(d2s-d1e),    h:(wallBottom-wallTop) }, // pilar sólido entre as duas portas
    { x:d2e, y:wallTop, w:(x+w-d2e),    h:(wallBottom-wallTop) }, // parede depois da porta 2
    { x:x,   y:wallTop-10, w:w,         h:10 },                   // teto/viga do telhado
  ];
}

// ================= MAPAS =================
const MAPS = {
  bambuzal: {
    name: 'Bambuzal',
    desc: 'Plataformas de madeira no meio do bambuzal. Casa suspensa e torre central.',
    theme: 'bamboo',
    accent: '#7fb06b',
  },
  ruinas: {
    name: 'Ruínas Antigas',
    desc: 'Pilares de pedra e plataformas musgosas. Restos de um templo no ar.',
    theme: 'ruins',
    accent: '#8a7a5a',
  },
  canopy: {
    name: 'Floresta Negra',
    desc: 'Árvores densas tipo pinheiros e plataformas de madeira escura sob o céu noturno.',
    theme: 'night',
    accent: '#2a3a2a',
  },
};
const MAP_KEYS = Object.keys(MAPS);
let currentMapKey = 'bambuzal';
let selectedClassKey = null;

function buildLevel(mapKey){
  currentMapKey = mapKey || currentMapKey || 'bambuzal';
  WALL_SEGMENTS = [];

  if (currentMapKey === 'ruinas'){
    platforms = [
      { x:30,   y:400, w:220, h:18, type:'stone', start:true },
      { x:320,  y:320, w:160, h:16, type:'stone' },
      { x:550,  y:250, w:140, h:16, type:'stone' },
      { x:760,  y:180, w:200, h:16, type:'stone' },
      { x:1040, y:280, w:180, h:16, type:'stone' },
      { x:1280, y:200, w:100, h:14, type:'bridge' },
      { x:1400, y:190, w:280, h:18, type:'stone', broken:true },
      { x:1420, y:320, w:240, h:16, type:'stone' },
      { x:1760, y:260, w:90,  h:14, type:'bridge' },
      { x:1880, y:240, w:200, h:16, type:'stone' },
      { x:2160, y:340, w:180, h:16, type:'stone' },
      { x:2420, y:270, w:200, h:16, type:'stone' },
      { x:700,  y:70,  w:200, h:16, type:'stone', upper:true },
      { x:2000, y:120, w:180, h:16, type:'stone', upper:true },
      { x:80,   y:160, w:150, h:16, type:'stone', upper:true },
      { x:1480, y:-60, w:120, h:16, type:'stone', upper:true, isTowerTop:true },
      { x:450,  y:150, w:130, h:14, type:'moving', moveAxis:'x', moveRange:80, moveSpeed:0.85, baseX:450, baseY:150, phase:0 },
      { x:1600, y:140, w:120, h:14, type:'moving', moveAxis:'y', moveRange:55, moveSpeed:0.65, baseX:1600, baseY:140, phase:2 },
      { x:1100, y:350, w:110, h:14, type:'falling', fallDelay:1600, fallSpeed:0, falling:false, fallTimer:0, originalY:350 },
      { x:2300, y:200, w:100, h:14, type:'falling', fallDelay:2000, fallSpeed:0, falling:false, fallTimer:0, originalY:200 },
    ];
    ladders = [
      { x:780,  y1:70,  y2:180, w:26 },
      { x:2080, y1:120, y2:340, w:26 },
      { x:120,  y1:160, y2:400, w:26 },
      { x:1520, y1:-60, y2:190, w:26 },
    ];
    // paredes de pedra da ruína central
    WALL_SEGMENTS = [
      { x:1400, y:100, w:40, h:90 },
      { x:1640, y:100, w:40, h:90 },
      { x:1400, y:90,  w:280, h:12 },
    ];
  } else if (currentMapKey === 'canopy'){
    platforms = [
      { x:50,   y:390, w:200, h:14, type:'rope', start:true },
      { x:320,  y:310, w:150, h:14, type:'rope' },
      { x:540,  y:220, w:160, h:14, type:'rope' },
      { x:780,  y:280, w:180, h:14, type:'rope' },
      { x:1040, y:180, w:140, h:14, type:'rope' },
      { x:1240, y:300, w:90,  h:12, type:'bridge' },
      { x:1350, y:290, w:200, h:14, type:'rope' },
      { x:1620, y:200, w:160, h:14, type:'rope' },
      { x:1860, y:320, w:90,  h:12, type:'bridge' },
      { x:1980, y:300, w:180, h:14, type:'rope' },
      { x:2240, y:220, w:160, h:14, type:'rope' },
      { x:2480, y:340, w:180, h:14, type:'rope' },
      { x:600,  y:80,  w:180, h:14, type:'rope', upper:true },
      { x:2100, y:100, w:200, h:14, type:'rope', upper:true },
      { x:100,  y:140, w:140, h:14, type:'rope', upper:true },
      { x:1450, y:-50, w:110, h:14, type:'rope', upper:true, isTowerTop:true },
      { x:900,  y:150, w:130, h:14, type:'moving', moveAxis:'x', moveRange:100, moveSpeed:1.0, baseX:900, baseY:150, phase:0.5 },
      { x:1750, y:120, w:120, h:14, type:'moving', moveAxis:'y', moveRange:70, moveSpeed:0.8, baseX:1750, baseY:120, phase:1.2 },
      { x:400,  y:250, w:110, h:14, type:'falling', fallDelay:1500, fallSpeed:0, falling:false, fallTimer:0, originalY:250 },
      { x:2350, y:280, w:100, h:14, type:'falling', fallDelay:1900, fallSpeed:0, falling:false, fallTimer:0, originalY:280 },
    ];
    ladders = [
      { x:650,  y1:80,  y2:280, w:26 },
      { x:2180, y1:100, y2:300, w:26 },
      { x:130,  y1:140, y2:390, w:26 },
      { x:1490, y1:-50, y2:290, w:26 },
    ];
    WALL_SEGMENTS = [];
  } else {
    // bambuzal (padrão)
    platforms = [
      { x:40,   y:380, w:240, h:16, type:'plane', variant:1, start:true },
      { x:360,  y:300, w:190, h:16, type:'plane', variant:2 },
      { x:600,  y:230, w:170, h:16, type:'heli' },
      { x:820,  y:230, w:210, h:16, type:'plane', variant:3 },
      { x:1090, y:320, w:180, h:16, type:'plane', variant:4 },
      { x:1270, y:310, w:80,  h:12, type:'bridge' },
      { x:1350, y:300, w:180, h:14, type:'plane', broken:true, part:'left' },
      { x:1650, y:300, w:220, h:14, type:'plane', broken:true, part:'right' },
      { x:1360, y:420, w:480, h:14, type:'interior' },
      { x:1870, y:280, w:80,  h:12, type:'bridge' },
      { x:1950, y:250, w:190, h:16, type:'plane', variant:5 },
      { x:2220, y:360, w:200, h:16, type:'plane', variant:6 },
      { x:2500, y:280, w:190, h:16, type:'plane', variant:7 },
      { x:800,  y:90,  w:220, h:16, type:'plane', variant:8, upper:true },
      { x:2190, y:190, w:230, h:16, type:'plane', variant:9, upper:true },
      { x:60,   y:150, w:180, h:16, type:'plane', variant:12, upper:true },
      { x:1335, y:-80, w:100, h:16, type:'plane', variant:10, upper:true, isTowerTop:true },
      { x:480,  y:180, w:140, h:14, type:'moving', variant:11, moveAxis:'x', moveRange:90, moveSpeed:0.9, baseX:480, baseY:180, phase:0 },
      { x:1700, y:160, w:130, h:14, type:'moving', variant:13, moveAxis:'y', moveRange:60, moveSpeed:0.7, baseX:1700, baseY:160, phase:1.5 },
      { x:980,  y:270, w:120, h:14, type:'falling', variant:14, fallDelay:1800, fallSpeed:0, falling:false, fallTimer:0, originalY:270 },
      { x:2100, y:320, w:110, h:14, type:'falling', variant:15, fallDelay:2200, fallSpeed:0, falling:false, fallTimer:0, originalY:320 },
    ];
    ladders = [
      { x:900,  y1:90,  y2:230, w:26 },
      { x:2300, y1:190, y2:360, w:26 },
      { x:110,  y1:150, y2:380, w:26 },
      { x:1375, y1:-80,  y2:300, w:26 },
    ];
    buildTreehouseWalls();
  }
}
buildLevel('bambuzal');

// cards de mapa (depois de MAPS existir)
for (const key of MAP_KEYS){
  const m = MAPS[key];
  const card = document.createElement('div');
  card.className = 'mapCard ' + key;
  card.innerHTML = `
    <div class="mapPreview"></div>
    <h3>${m.name}</h3>
    <p>${m.desc}</p>
  `;
  card.addEventListener('click', () => startGame(selectedClassKey, key));
  if (mapGridEl) mapGridEl.appendChild(card);
}

function buildPickups(){
  if (currentMapKey === 'ruinas'){
    return [
      { type:'ammo',   x:380,  y:300, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:1500, y:300, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:2200, y:320, w:24, h:20, active:true, cd:0 },
      { type:'health', x:1920, y:220, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:100,  y:140, w:24, h:20, active:true, cd:0 },
      { type:'health', x:1080, y:260, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:750,  y:50,  w:24, h:20, active:true, cd:0 },
      { type:'health', x:2480, y:250, w:24, h:20, active:true, cd:0 },
      { type:'health', x:1510, y:-80, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:600,  y:230, w:24, h:20, active:true, cd:0 },
    ];
  }
  if (currentMapKey === 'canopy'){
    return [
      { type:'ammo',   x:360,  y:290, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:1400, y:270, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:2280, y:200, w:24, h:20, active:true, cd:0 },
      { type:'health', x:2020, y:280, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:130,  y:120, w:24, h:20, active:true, cd:0 },
      { type:'health', x:820,  y:260, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:650,  y:60,  w:24, h:20, active:true, cd:0 },
      { type:'health', x:2540, y:320, w:24, h:20, active:true, cd:0 },
      { type:'health', x:1480, y:-70, w:24, h:20, active:true, cd:0 },
      { type:'ammo',   x:560,  y:200, w:24, h:20, active:true, cd:0 },
    ];
  }
  // bambuzal
  return [
    { type:'ammo',   x:410,  y:280, w:24, h:20, active:true, cd:0 },
    { type:'ammo',   x:1560, y:400, w:24, h:20, active:true, cd:0 },
    { type:'ammo',   x:2270, y:340, w:24, h:20, active:true, cd:0 },
    { type:'health', x:2000, y:230, w:24, h:20, active:true, cd:0 },
    { type:'ammo',   x:120,  y:130, w:24, h:20, active:true, cd:0 },
    { type:'health', x:1130, y:300, w:24, h:20, active:true, cd:0 },
    { type:'ammo',   x:850,  y:70,  w:24, h:20, active:true, cd:0 },
    { type:'health', x:2560, y:260, w:24, h:20, active:true, cd:0 },
    { type:'health', x:1360, y:-100, w:24, h:20, active:true, cd:0 },
    { type:'ammo',   x:640,  y:210, w:24, h:20, active:true, cd:0 },
  ];
}

// ================= ESTADO =================
let keys = {};
let mouse = { x:0, y:0, down:false };
let camX = 0;
let camY = 0;
let score = 0, wave = 1, killsThisWave = 0, totalKills = 0;
let money = 0;
let shopOpen = false;
let allySpeeches = []; // {x,y,text,life,color}
const SHOP_ITEMS = [
  { id:'damage', label:'🔫 Dano +15%', price:150, max:5 },
  { id:'health', label:'❤️ Vida +25', price:200, max:5 },
  { id:'cooldown', label:'⚡ Cooldown -12%', price:180, max:4 },
  { id:'speed', label:'💨 Velocidade +10%', price:250, max:4 },
];
let shopBought = { damage:0, health:0, cooldown:0, speed:0 };
const ALLY_QUOTES = {
  medico: ['Estou com você!', 'Cura a caminho!', 'Não desista!'],
  assassino: ['Alvo eliminado.', 'Silêncio mortal.', 'Na mira.'],
  metralhador: ['Fogo contínuo!', 'Segura a linha!', 'Rajada!'],
  general: ['Avançar!', 'Segura a esquerda!', 'Ordem dada!'],
  engenheiro: ['Vou colocar uma torre!', 'Drone no ar!', 'Construindo!'],
  cacador: ['À queima-roupa!', 'Fechando!', 'Explodiu!'],
  demolidor: ['Bomba fora!', 'Cuidado com a granada!', 'Demolição!'],
  lancachamas: ['Queima!', 'Mar de fogo!', 'Chama viva!'],
};
let running = false;
let paused = false;
let player, bullets, enemies, allies, particles, ragdolls, pickups, turret, drone, mapTower;
let spawnTimer, allySpawnTimer, notif, deathTimer;
let gameoverMessage = 'VOCÊ CAIU EM COMBATE';
let bossSpawned = false;
let miniBossSpawned = false;
let gameStartTime = 0;

// Novos sistemas de feedback
let screenShake = 0;
let floatingTexts = []; // {x,y,text,color,life,vy,vx}
let grenades = [];      // {x,y,vx,vy,life,owner,damage,radius}
let muzzleFlashes = []; // {x,y,life,ang}
// ambiente vivo
let ambientBirds = [];  // pássaros / insetos (bambuzal)
let ambientFog = [];    // névoa móvel (floresta negra)
let ambientDust = [];   // poeira de pedra (ruínas)

function findStartPlatform(){ return platforms.find(p=>p.start); }
function randomNonStartPlatform(){
  // Prefere plataformas mais baixas e largas para evitar spawns ruins no topo/estreitos
  const candidates = platforms.filter(p => !p.start && !p.isTowerTop && p.w >= 80);
  if (candidates.length === 0) return platforms.find(p => !p.start) || platforms[0];
  // Peso maior para plataformas mais baixas (y maior = mais baixo no mapa)
  const weights = candidates.map(p => Math.max(1, 500 - Math.abs(p.y - 280)));
  const total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i=0;i<candidates.length;i++){
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length-1];
}
function randomNameOffset(){ return (Math.random()-0.5)*16; }

function buildMapTower(){
  const p = platforms.find(pl => pl.isTowerTop);
  if (!p) return null;
  return { x: p.x + p.w/2, y: p.y - 8, cooldown:0, range:480 };
}

function resetState(classKey){
  const c = CLASSES[classKey];
  const sp = findStartPlatform();
  player = {
    classKey, c,
    x: sp.x+30, y: sp.y-46, w:30, h:46,
    vx:0, vy:0, onGround:true, prevY: sp.y-46, facing:1,
    health:c.maxHealth, maxHealth:c.maxHealth,
    currentWeapon:'primary',
    ammo:{ primary:c.primary.maxAmmo, secondary:c.secondary.maxAmmo },
    cooldown:0, alive:true,
    killStreak:0, abilityReady:false, abilityActive:false, abilityTimer:0,
    invulnerable:false, speedMul:1, fireRateMul:1, infiniteAmmo:false,
    shield:0, shieldMax:0, crouching:false,
    activeCooldownTimer:0, regenBoostTimer:0, eInvulnTimer:0, teamShieldTimer:0, climbing:false,
    hitFlash:0, animTimer:0, wasOnGround:true,
    shopDamageMul:1, shopCooldownMul:1, shopSpeedMul:1,
  };
  bullets = []; enemies = []; allies = []; particles = []; ragdolls = [];
  pickups = buildPickups();
  turret = null; drone = null;
  mapTower = buildMapTower();
  score = 0; wave = 1; killsThisWave = 0; totalKills = 0;
  money = 0; shopOpen = false;
  shopBought = { damage:0, health:0, cooldown:0, speed:0 };
  allySpeeches = [];
  spawnTimer = 1200;
  allySpawnTimer = 400;
  notif = { text:'', timer:0 };
  deathTimer = 0;
  camX = 0; camY = 0;
  bossSpawned = false;
  miniBossSpawned = false;
  paused = false;
  screenShake = 0;
  floatingTexts = [];
  grenades = [];
  muzzleFlashes = [];
  initAmbient();
  // Reset plataformas interativas
  for (const p of platforms){
    if (p.type === 'falling'){
      p.falling = false; p.fallSpeed = 0; p.fallTimer = 0; p.y = p.originalY;
    }
    if (p.type === 'moving'){
      p.x = p.baseX; p.y = p.baseY; p.phase = p.phase || 0;
    }
  }
  if (pauseEl) pauseEl.classList.add('hidden');
}

function showTitle(){
  running = false;
  paused = false;
  stopAllMusic();
  setMobileControlsVisible(false);
  titleEl.classList.remove('hidden');
  menuEl.classList.add('hidden');
  if (mapSelectEl) mapSelectEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  if (recordsEl) recordsEl.classList.add('hidden');
  if (tutorialEl) tutorialEl.classList.add('hidden');
}

function showClassSelect(){
  titleEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  if (mapSelectEl) mapSelectEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  if (recordsEl) recordsEl.classList.add('hidden');
}

function showMapSelect(){
  titleEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  if (mapSelectEl) mapSelectEl.classList.remove('hidden');
  gameoverEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
}

function startGame(classKey, mapKey){
  if (!classKey) classKey = selectedClassKey || 'medico';
  if (mapKey) currentMapKey = mapKey;
  buildLevel(currentMapKey);

  // salva última classe
  progress.lastClass = classKey;
  saveProgress(progress);

  resetState(classKey);
  titleEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  if (mapSelectEl) mapSelectEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  if (pauseEl) pauseEl.classList.add('hidden');
  if (recordsEl) recordsEl.classList.add('hidden');

  running = true;
  paused = false;
  gameStartTime = performance.now();
  showNotif('Onda 1');
  lastTime = performance.now();
  requestAnimationFrame(loop);
  initAudio();
  setMusicMode('normal');
  setMobileControlsVisible(true);

  // Tutorial na primeira partida
  if (!progress.tutorialSeen && tutorialEl){
    paused = true; // congela o jogo enquanto lê
    tutorialEl.classList.remove('hidden');
  }
}

function dismissTutorial(){
  if (tutorialEl) tutorialEl.classList.add('hidden');
  progress.tutorialSeen = true;
  saveProgress(progress);
  if (paused && running){
    paused = false;
    lastTime = performance.now();
  }
}

function togglePause(){
  if (!running || !player) return;
  if (!player.alive && deathTimer > 0) return;
  if (shopOpen) return; // loja tem prioridade
  paused = !paused;
  if (pauseEl){
    if (paused) pauseEl.classList.remove('hidden');
    else pauseEl.classList.add('hidden');
  }
  if (paused){
    if (musicGain && audioCtx) musicGain.gain.setTargetAtTime(0.15, audioCtx.currentTime, 0.1);
  } else {
    if (musicGain && audioCtx && musicMode) musicGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.15);
    lastTime = performance.now();
  }
}

function returnToMenu(){
  running = false;
  paused = false;
  shopOpen = false;
  stopAllMusic();
  setMobileControlsVisible(false);
  if (pauseEl) pauseEl.classList.add('hidden');
  gameoverEl.classList.add('hidden');
  menuEl.classList.add('hidden');
  if (mapSelectEl) mapSelectEl.classList.add('hidden');
  if (recordsEl) recordsEl.classList.add('hidden');
  if (tutorialEl) tutorialEl.classList.add('hidden');
  const shopEl = document.getElementById('shopOverlay');
  if (shopEl) shopEl.classList.add('hidden');
  titleEl.classList.remove('hidden');
}

function toggleFullscreen(){
  const el = document.documentElement;
  if (!document.fullscreenElement){
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (req){
      const p = req.call(el);
      const lock = () => { try { screen.orientation.lock('landscape').catch(()=>{}); } catch(e){} };
      if (p && p.then) p.then(lock).catch(()=>{}); else lock();
    }
  } else {
    (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen || (()=>{})).call(document);
  }
}

function showNotif(text){
  if (!notif) notif = { text: '', timer: 0 };
  notif.text = text;
  notif.timer = 1800;
}

function spawnAllySpeech(al){
  const quotes = ALLY_QUOTES[al.classKey] || ['Vamos!'];
  const text = quotes[Math.floor(Math.random()*quotes.length)];
  allySpeeches.push({
    x: al.x + al.w/2,
    y: al.y - 20,
    text,
    life: 1800,
    color: al.c.color,
  });
}

function openShop(completedWave){
  shopOpen = true;
  paused = true;
  const el = document.getElementById('shopOverlay');
  if (!el) return;
  document.getElementById('shopWaveTitle').textContent = 'ONDA ' + completedWave + ' COMPLETA';
  document.getElementById('shopStats').textContent = 'Inimigos eliminados: ' + totalKills + '  ·  Próxima: Onda ' + wave;
  renderShopItems();
  el.classList.remove('hidden');
}

function renderShopItems(){
  const moneyEl = document.getElementById('shopMoney');
  if (moneyEl) moneyEl.textContent = '$' + money;
  const box = document.getElementById('shopItems');
  if (!box) return;
  box.innerHTML = '';
  for (const it of SHOP_ITEMS){
    const lvl = shopBought[it.id] || 0;
    const can = money >= it.price && lvl < it.max;
    const div = document.createElement('div');
    div.className = 'shopItem' + (can ? '' : ' disabled');
    div.innerHTML = `<div class="shopLabel">${it.label} <span style="color:#888;font-size:12px">(${lvl}/${it.max})</span></div><div class="shopPrice">$${it.price}</div>`;
    if (can){
      div.addEventListener('click', () => buyShopItem(it.id));
    }
    box.appendChild(div);
  }
}

function buyShopItem(id){
  const it = SHOP_ITEMS.find(x => x.id === id);
  if (!it || money < it.price || (shopBought[id]||0) >= it.max) return;
  money -= it.price;
  shopBought[id] = (shopBought[id]||0) + 1;
  if (!player) return;
  if (id === 'damage'){
    player.shopDamageMul = 1 + shopBought.damage * 0.15;
  } else if (id === 'health'){
    player.maxHealth += 25;
    player.health = Math.min(player.maxHealth, player.health + 25);
  } else if (id === 'cooldown'){
    player.shopCooldownMul = Math.max(0.5, 1 - shopBought.cooldown * 0.12);
    player.fireRateMul = player.shopCooldownMul;
  } else if (id === 'speed'){
    player.shopSpeedMul = 1 + shopBought.speed * 0.10;
    player.speedMul = player.shopSpeedMul;
  }
  playPickup();
  renderShopItems();
}

function closeShop(){
  shopOpen = false;
  const el = document.getElementById('shopOverlay');
  if (el) el.classList.add('hidden');
  paused = false;
  lastTime = performance.now();
  showNotif('Onda ' + wave + '!');
}

document.getElementById('btnPlay').addEventListener('click', () => {
  initAudio();
  showClassSelect();
});
document.getElementById('btnFullscreen').addEventListener('click', toggleFullscreen);
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) {
  document.getElementById('btnFullscreen').classList.add('hidden');
}
document.getElementById('btnBackTitle').addEventListener('click', showTitle);
document.getElementById('btnBackClass').addEventListener('click', showClassSelect);
document.getElementById('restartBtn').addEventListener('click', () => {
  gameoverEl.classList.add('hidden');
  showTitle();
  stopAllMusic();
});
document.getElementById('pauseContinue').addEventListener('click', () => { if (paused) togglePause(); });
document.getElementById('pauseMenu').addEventListener('click', () => returnToMenu());
document.getElementById('btnRecords').addEventListener('click', showRecords);
document.getElementById('btnCloseRecords').addEventListener('click', hideRecords);
document.getElementById('btnTutorialOk').addEventListener('click', dismissTutorial);
document.getElementById('btnShopContinue').addEventListener('click', closeShop);

// ================= INPUT =================
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const mobileControlsEl = document.getElementById('mobileControls');

function setMobileControlsVisible(show){
  if (!mobileControlsEl) return;
  // Mostra em qualquer dispositivo touch OU tela estreita enquanto a partida roda
  const want = !!(show && running && (isTouchDevice || window.innerWidth <= 900));
  document.body.classList.toggle('playing', !!(show && running));
  if (want) mobileControlsEl.classList.remove('hidden');
  else mobileControlsEl.classList.add('hidden');
}

function pressKey(k, down){
  if (down) keys[k] = true;
  else delete keys[k];
}

function tryUseE(){
  if (!running || !player || !player.alive || paused) return;
  if (player.activeCooldownTimer > 0) return;
  if (player.c.turret) placeTurret();
  else if (player.c.active) activatePlayerActiveSkill();
}
function tryUseF(){
  if (!running || !player || !player.alive || paused) return;
  if (player.abilityReady && !player.abilityActive) activateAbility();
}
function tryToggleWeapon(){
  if (!running || !player || !player.alive || paused) return;
  toggleWeapon();
}

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if (e.key === ' ') e.preventDefault();
  if (k === 'm'){ initAudio(); toggleMute(); }

  if (tutorialEl && !tutorialEl.classList.contains('hidden') && (k === 'escape' || k === 'enter')){
    e.preventDefault();
    dismissTutorial();
    return;
  }

  if (running && k === 'escape'){
    e.preventDefault();
    togglePause();
    return;
  }

  if (!running || !player || !player.alive || paused) return;
  if (k === 'e') tryUseE();
  if (k === 'q') tryToggleWeapon();
  if (k === 'f') tryUseF();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function canvasScale(){
  const rect = canvas.getBoundingClientRect();
  return { sx: canvas.width/rect.width, sy: canvas.height/rect.height, rect };
}
function setMouseFromClient(clientX, clientY){
  const {sx, sy, rect} = canvasScale();
  mouse.x = (clientX - rect.left) * sx;
  mouse.y = (clientY - rect.top) * sy;
}

canvas.addEventListener('mousemove', e => {
  setMouseFromClient(e.clientX, e.clientY);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });

// ---- Touch: mirar no canvas + atirar ao segurar ----
let aimTouchId = null;
canvas.addEventListener('touchstart', e => {
  if (!running) return;
  e.preventDefault();
  initAudio();
  for (const t of e.changedTouches){
    aimTouchId = t.identifier;
    setMouseFromClient(t.clientX, t.clientY);
    mouse.down = true;
    break;
  }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches){
    if (aimTouchId == null || t.identifier === aimTouchId){
      setMouseFromClient(t.clientX, t.clientY);
      mouse.down = true;
    }
  }
}, { passive: false });
function endAimTouch(e){
  for (const t of e.changedTouches){
    if (aimTouchId == null || t.identifier === aimTouchId){
      aimTouchId = null;
      // só solta o tiro se o botão 🔥 não estiver ativo
      if (!keys._mcFire) mouse.down = false;
    }
  }
}
canvas.addEventListener('touchend', endAimTouch, { passive: false });
canvas.addEventListener('touchcancel', endAimTouch, { passive: false });

// ---- Botões virtuais ----
function bindHoldButton(el, onDown, onUp){
  if (!el) return;
  const down = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    initAudio();
    el.classList.add('active');
    onDown();
  };
  const up = (ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    el.classList.remove('active');
    onUp();
  };
  el.addEventListener('touchstart', down, { passive: false });
  el.addEventListener('touchend', up, { passive: false });
  el.addEventListener('touchcancel', up, { passive: false });
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}

// ---- Stick analógico: arraste para os lados (andar) ou para baixo (agachar) ----
let lastMoveDir = 1;
(function setupStick(){
  const base = document.getElementById('mcStick');
  const knob = document.getElementById('mcKnob');
  if (!base || !knob) return;
  let id = null;
  const reset = () => {
    id = null; knob.style.transform = 'translate(-50%,-50%)';
    pressKey('a', false); pressKey('d', false); pressKey('s', false);
    base.classList.remove('active');
  };
  const apply = (t) => {
    const r = base.getBoundingClientRect();
    const R = r.width / 2;
    let dx = t.clientX - (r.left + R), dy = t.clientY - (r.top + R);
    const len = Math.hypot(dx, dy), max = R * 0.62;
    if (len > max){ dx = dx / len * max; dy = dy / len * max; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const dead = R * 0.16;
    pressKey('a', dx < -dead); pressKey('d', dx > dead);
    pressKey('s', dy > R * 0.34 && Math.abs(dx) < R * 0.5);
    if (dx > dead) lastMoveDir = 1; else if (dx < -dead) lastMoveDir = -1;
  };
  base.addEventListener('touchstart', e => {
    e.preventDefault(); e.stopPropagation(); initAudio();
    if (id != null) return;
    const t = e.changedTouches[0]; id = t.identifier;
    base.classList.add('active'); apply(t);
  }, { passive: false });
  base.addEventListener('touchmove', e => {
    e.preventDefault(); e.stopPropagation();
    for (const t of e.changedTouches) if (t.identifier === id) apply(t);
  }, { passive: false });
  const end = e => {
    e.preventDefault(); e.stopPropagation();
    for (const t of e.changedTouches) if (t.identifier === id) reset();
  };
  base.addEventListener('touchend', end, { passive: false });
  base.addEventListener('touchcancel', end, { passive: false });
})();

// ---- Auto-mira: ao segurar 🔥 sem tocar na tela, mira no inimigo mais próximo ----
function autoAimAssist(){
  if (!player || !player.alive) return;
  const px = player.x + player.w/2, py = player.y + player.h*0.4;
  let best = null, bd = 760*760;
  for (const e of enemies){
    if (e.dead) continue;
    const ex = e.x + e.w/2, ey = e.y + e.h*0.4;
    if (ex < camX - 30 || ex > camX + canvas.width + 30) continue;
    const d = (ex-px)*(ex-px) + (ey-py)*(ey-py);
    if (d < bd){ bd = d; best = { x: ex, y: ey }; }
  }
  if (best){ mouse.x = best.x - camX; mouse.y = best.y - camY; }
  else { mouse.x = px - camX + lastMoveDir*220; mouse.y = py - camY; }
}

bindHoldButton(document.getElementById('mcJump'), () => { pressKey(' ', true); pressKey('w', true); }, () => { pressKey(' ', false); pressKey('w', false); });
bindHoldButton(document.getElementById('mcCrouch'), () => pressKey('s', true), () => pressKey('s', false));
bindHoldButton(document.getElementById('mcFire'), () => { keys._mcFire = true; mouse.down = true; }, () => { keys._mcFire = false; if (aimTouchId == null) mouse.down = false; });

const mcQ = document.getElementById('mcQ');
const mcE = document.getElementById('mcE');
const mcF = document.getElementById('mcF');
const mcPause = document.getElementById('mcPause');
function bindTap(el, fn){
  if (!el) return;
  const go = (ev) => { ev.preventDefault(); ev.stopPropagation(); initAudio(); if (navigator.vibrate) navigator.vibrate(12); fn(); };
  el.addEventListener('touchstart', go, { passive: false });
  el.addEventListener('click', go);
}
bindTap(mcQ, tryToggleWeapon);
bindTap(mcE, tryUseE);
bindTap(mcF, tryUseF);
bindTap(mcPause, () => { if (running) togglePause(); });

function toggleWeapon(){
  player.currentWeapon = player.currentWeapon === 'primary' ? 'secondary' : 'primary';
  player.cooldown = Math.min(player.cooldown, 120);
  showNotif(player.c[player.currentWeapon].name);
}

function placeTurret(){
  turret = { x: player.x + player.w/2, y: player.y+player.h-6, health:60, maxHealth:60, cooldown:0, range:340, damageMul:1 };
  player.activeCooldownTimer = player.c.active.cooldown;
  showNotif('Torre construída!');
}

// ================= RECURSO DE CLASSE (tecla E, com cooldown, independente de abates) =================
function activatePlayerActiveSkill(){
  const key = player.classKey;
  const a = player.c.active;
  player.activeCooldownTimer = a.cooldown;
  showNotif('🛠️ ' + a.name + '!');
  playAbility();

  if (key === 'medico'){
    player.health = Math.min(player.maxHealth, player.health + 40);
    player.bonusRegen = 0.5;
    player.regenBoostTimer = 3000;
    spawnParticles(player.x+player.w/2, player.y+player.h/2, '#8CFCA8', 12);
  } else if (key === 'assassino'){
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const wmx = mouse.x+camX, wmy = mouse.y+camY;
    const ang = Math.atan2(wmy-cy, wmx-cx);
    const dist = 130;
    player.x = Math.max(0, Math.min(WORLD_W-player.w, player.x - Math.cos(ang)*dist));
    player.y -= Math.sin(ang)*dist*0.25;
    player.vy = Math.min(player.vy, -3);
    player.invulnerable = true; player.eInvulnTimer = 500;
    spawnParticles(cx,cy,'#d488ff',10);
  } else if (key === 'metralhador'){
    player.ammo[player.currentWeapon] = player.c[player.currentWeapon].maxAmmo;
    spawnParticles(player.x+player.w/2, player.y+player.h/2, '#ffe08a', 8);
  } else if (key === 'general'){
    const t = pickNearestEnemy(player);
    if (t){
      t.health -= 45;
      t.lastHitDirX = Math.sign((t.x)-(player.x)) || 1;
      t.lastKillerType = 'player'; t.lastKillerAlly = null;
      spawnParticles(t.x+t.w/2, t.y+t.h/2, '#ffcc33', 10);
      playGunshot('rifle', shotVolumeFor(t.x));
    }
  } else if (key === 'cacador'){
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    for (const en of enemies){
      if (en.dead) continue;
      const d = Math.hypot((en.x+en.w/2)-cx, (en.y+en.h/2)-cy);
      if (d < 150){
        en.health -= 18;
        en.lastHitDirX = Math.sign((en.x)-(player.x)) || 1;
        en.lastKillerType = 'player'; en.lastKillerAlly = null;
      }
    }
    spawnExplosion(cx,cy);
  } else if (key === 'demolidor'){
    // granada na mira
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const wmx = mouse.x+camX, wmy = mouse.y+camY;
    const ang = Math.atan2(wmy-cy, wmx-cx);
    const speed = 8;
    grenades.push({
      x:cx, y:cy,
      vx: Math.cos(ang)*speed,
      vy: Math.sin(ang)*speed - 3.5,
      life: 1200,
      owner: 'player',
      damage: 55,
      radius: 100
    });
    playGrenadeThrow();
  } else if (key === 'lancachamas'){
    // rajada de fogo em cone
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const wmx = mouse.x+camX, wmy = mouse.y+camY;
    const aimAng = Math.atan2(wmy-cy, wmx-cx);
    for (const en of enemies){
      if (en.dead) continue;
      const ecx = en.x+en.w/2, ecy = en.y+en.h/2;
      const d = Math.hypot(ecx-cx, ecy-cy);
      const angTo = Math.atan2(ecy-cy, ecx-cx);
      let diff = Math.abs(angTo-aimAng);
      if (diff > Math.PI) diff = Math.PI*2-diff;
      if (d < 200 && diff < 0.55){
        en.health -= 28;
        en.lastHitDirX = Math.sign(ecx-cx)||1;
        en.lastKillerType = 'player'; en.lastKillerAlly = null;
        spawnParticles(ecx, ecy, '#ff6600', 8);
      }
    }
    spawnParticles(cx, cy, '#ffaa00', 14);
    spawnParticles(cx, cy, '#ff4400', 10);
  }
}

// ================= HABILIDADES DO JOGADOR (tecla F, precisa de sequência de abates) =================
function activateAbility(){
  const key = player.classKey;
  player.killStreak = 0;
  player.abilityReady = false;
  const dur = player.c.ability.duration;
  showNotif('⚡ ' + player.c.ability.name + '!');
  playAbility();
  addScreenShake(3);

  if (key === 'medico'){
    player.shield = 70; player.shieldMax = 70;
    player.abilityActive = true; player.abilityTimer = dur;
    for (const al of allies){
      if (!al.dead){
        al.shield = 70; al.shieldMax = 70;
        al.teamShieldTimer = dur;
      }
    }
    spawnParticles(player.x+player.w/2, player.y+player.h/2, '#4fc3f7', 16);
  } else if (key === 'assassino'){
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const wmx = mouse.x+camX, wmy = mouse.y+camY;
    const ang = Math.atan2(wmy-cy, wmx-cx);
    const dashDist = 210;
    spawnParticles(cx,cy,'#d488ff',10);
    player.x = Math.max(0, Math.min(WORLD_W-player.w, player.x + Math.cos(ang)*dashDist));
    player.y += Math.sin(ang)*dashDist*0.35;
    player.vy = 0;
    spawnParticles(player.x+player.w/2, player.y+player.h/2, '#d488ff', 14);
    player.invulnerable = true;
    player.abilityActive = true; player.abilityTimer = dur;
  } else if (key === 'metralhador'){
    const cy = player.y+player.h/2;
    const dir = player.facing;
    for (const en of enemies){
      if (en.dead) continue;
      const sameSide = dir > 0 ? (en.x > player.x) : (en.x < player.x);
      const sameLevel = Math.abs((en.y+en.h/2) - cy) < 55;
      if (sameSide && sameLevel && Math.abs(en.x-player.x) < 700){
        en.health -= 55;
        en.lastHitDirX = dir;
        en.lastKillerType = 'player'; en.lastKillerAlly = null;
        spawnParticles(en.x+en.w/2, en.y+en.h/2, '#ffcc33', 8);
      }
    }
    spawnParticles(player.x+player.w/2, cy, '#ffe08a', 6);
  } else if (key === 'general'){
    const sorted = enemies.filter(e=>!e.dead).slice().sort((a,b)=>{
      const da = Math.hypot((a.x)-(player.x), (a.y)-(player.y));
      const db = Math.hypot((b.x)-(player.x), (b.y)-(player.y));
      return da-db;
    }).slice(0,4);
    for (const en of sorted){
      en.health -= 60;
      en.lastHitDirX = Math.random()<0.5?-1:1;
      en.lastKillerType = 'player'; en.lastKillerAlly = null;
      spawnExplosion(en.x+en.w/2, en.y+en.h/2);
    }
  } else if (key === 'engenheiro'){
    drone = { cooldown:0, range:320, timer:dur };
    player.abilityActive = true; player.abilityTimer = dur;
  } else if (key === 'cacador'){
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    const wmx = mouse.x+camX, wmy = mouse.y+camY;
    const aimAng = Math.atan2(wmy-cy, wmx-cx);
    spawnExplosion(cx, cy);
    for (const en of enemies){
      if (en.dead) continue;
      const ecx = en.x+en.w/2, ecy = en.y+en.h/2;
      const d = Math.hypot(ecx-cx, ecy-cy);
      const angTo = Math.atan2(ecy-cy, ecx-cx);
      let diff = Math.abs(angTo-aimAng);
      if (diff > Math.PI) diff = Math.PI*2-diff;
      if (d < 260 && diff < 0.5){
        en.health -= 50;
        en.lastHitDirX = Math.sign(ecx-cx) || 1;
        en.lastKillerType = 'player'; en.lastKillerAlly = null;
      }
    }
  } else if (key === 'demolidor'){
    const sorted = enemies.filter(e=>!e.dead).slice().sort((a,b)=>{
      const da = Math.hypot(a.x-player.x, a.y-player.y);
      const db = Math.hypot(b.x-player.x, b.y-player.y);
      return da-db;
    }).slice(0,3);
    for (const en of sorted){
      const cx = player.x+player.w/2, cy = player.y+player.h/2;
      const ang = Math.atan2((en.y+en.h/2)-cy, (en.x+en.w/2)-cx);
      grenades.push({
        x:cx, y:cy,
        vx: Math.cos(ang)*7.5,
        vy: Math.sin(ang)*7.5 - 3,
        life: 900 + Math.random()*300,
        owner: 'player',
        damage: 48,
        radius: 90
      });
    }
    playGrenadeThrow();
  } else if (key === 'lancachamas'){
    const cx = player.x+player.w/2, cy = player.y+player.h/2;
    for (const en of enemies){
      if (en.dead) continue;
      const d = Math.hypot((en.x+en.w/2)-cx, (en.y+en.h/2)-cy);
      if (d < 220){
        en.health -= 40;
        en.lastHitDirX = Math.sign(en.x-player.x)||1;
        en.lastKillerType = 'player'; en.lastKillerAlly = null;
        spawnParticles(en.x+en.w/2, en.y+en.h/2, '#ff5500', 10);
      }
    }
    spawnParticles(cx, cy, '#ff8800', 18);
    spawnExplosion(cx, cy);
  }
}

// ================= HABILIDADES DOS ALIADOS (ativadas automaticamente pela IA) =================
function activateAllyAbility(al){
  const key = al.classKey;
  al.killStreak = 0;
  al.abilityReady = false;
  const dur = al.c.ability.duration;
  const target = pickNearestEnemy(al);
  showNotif('🤝⚡ Aliado usou ' + al.c.ability.name + '!');

  if (key === 'medico'){
    al.shield = 70; al.shieldMax = 70;
    al.abilityActive = true; al.abilityTimer = dur;
    if (player.alive){ player.shield = 70; player.shieldMax = 70; player.teamShieldTimer = dur; }
    for (const other of allies){
      if (other !== al && !other.dead){ other.shield = 70; other.shieldMax = 70; other.teamShieldTimer = dur; }
    }
    spawnParticles(al.x+al.w/2, al.y+al.h/2, '#4fc3f7', 14);
  } else if (key === 'assassino'){
    if (target){
      const cx = al.x+al.w/2, cy = al.y+al.h/2;
      const ang = Math.atan2((target.y+target.h/2)-cy, (target.x+target.w/2)-cx);
      spawnParticles(cx,cy,'#d488ff',8);
      al.x = Math.max(0, Math.min(WORLD_W-al.w, al.x + Math.cos(ang)*170));
      al.y += Math.sin(ang)*170*0.3;
      al.vy = 0;
      spawnParticles(al.x+al.w/2, al.y+al.h/2, '#d488ff', 10);
    }
    al.invulnerable = true; al.abilityActive = true; al.abilityTimer = dur;
  } else if (key === 'metralhador'){
    const cy = al.y+al.h/2;
    const dir = al.facing;
    for (const en of enemies){
      if (en.dead) continue;
      const sameSide = dir > 0 ? (en.x > al.x) : (en.x < al.x);
      const sameLevel = Math.abs((en.y+en.h/2) - cy) < 55;
      if (sameSide && sameLevel && Math.abs(en.x-al.x) < 650){
        en.health -= 42; en.lastHitDirX = dir;
        en.lastKillerType = 'ally'; en.lastKillerAlly = al;
        spawnParticles(en.x+en.w/2, en.y+en.h/2, '#8fffb0', 6);
      }
    }
  } else if (key === 'general'){
    const sorted = enemies.filter(e=>!e.dead).slice().sort((a,b)=>{
      const da = Math.hypot(a.x-al.x, a.y-al.y);
      const db = Math.hypot(b.x-al.x, b.y-al.y);
      return da-db;
    }).slice(0,3);
    for (const en of sorted){
      en.health -= 42;
      en.lastHitDirX = Math.random()<0.5?-1:1;
      en.lastKillerType = 'ally'; en.lastKillerAlly = al;
      spawnExplosion(en.x+en.w/2, en.y+en.h/2);
    }
  } else if (key === 'engenheiro'){
    al.abilityActive = true; al.abilityTimer = dur; al.fireRateMul = 0.5;
  } else if (key === 'cacador'){
    if (target){
      const cx = al.x+al.w/2, cy = al.y+al.h/2;
      const aimAng = Math.atan2((target.y+target.h/2)-cy, (target.x+target.w/2)-cx);
      spawnExplosion(cx, cy);
      for (const en of enemies){
        if (en.dead) continue;
        const ecx = en.x+en.w/2, ecy = en.y+en.h/2;
        const d = Math.hypot(ecx-cx, ecy-cy);
        const angTo = Math.atan2(ecy-cy, ecx-cx);
        let diff = Math.abs(angTo-aimAng);
        if (diff > Math.PI) diff = Math.PI*2-diff;
        if (d < 240 && diff < 0.5){
          en.health -= 38;
          en.lastHitDirX = Math.sign(ecx-cx) || 1;
          en.lastKillerType = 'ally'; en.lastKillerAlly = al;
        }
      }
    }
  } else if (key === 'demolidor'){
    if (target){
      const cx = al.x+al.w/2, cy = al.y+al.h/2;
      const ang = Math.atan2((target.y+target.h/2)-cy, (target.x+target.w/2)-cx);
      grenades.push({ x:cx, y:cy, vx:Math.cos(ang)*7, vy:Math.sin(ang)*7-3, life:1000, owner:'ally', damage:40, radius:85 });
      playGrenadeThrow();
    }
  } else if (key === 'lancachamas'){
    const cx = al.x+al.w/2, cy = al.y+al.h/2;
    for (const en of enemies){
      if (en.dead) continue;
      if (Math.hypot((en.x+en.w/2)-cx, (en.y+en.h/2)-cy) < 180){
        en.health -= 30;
        en.lastHitDirX = Math.sign(en.x-al.x)||1;
        en.lastKillerType = 'ally'; en.lastKillerAlly = al;
        spawnParticles(en.x+en.w/2, en.y+en.h/2, '#ff6600', 6);
      }
    }
  }
  // fala do aliado
  spawnAllySpeech(al);
}

// ================= HABILIDADES DOS INIMIGOS (por cooldown, automáticas) =================
function triggerEnemyAbility(en, target){
  const cx = en.x+en.w/2, cy = en.y+en.h/2;
  const tx = target.x+target.w/2, ty = target.y+target.h/2;
  const ang = Math.atan2(ty-cy, tx-cx);

  if (en.clsKey === 'soldado'){
    for (let i=0;i<3;i++){
      const off = (i-1)*0.05;
      bullets.push({ x:cx, y:cy, vx:Math.cos(ang+off)*en.cls.bulletSpeed*1.1, vy:Math.sin(ang+off)*en.cls.bulletSpeed*1.1, damage:Math.round(en.damage*0.8), owner:'enemy', life:1800 });
    }
  } else if (en.clsKey === 'sniper'){
    bullets.push({ x:cx, y:cy, vx:Math.cos(ang)*en.cls.bulletSpeed*1.4, vy:Math.sin(ang)*en.cls.bulletSpeed*1.4, damage:Math.round(en.damage*2.6), owner:'enemy', life:2200, big:true });
  } else if (en.clsKey === 'pesado'){
    en.chargeTimer = 900;
    en.chargeDirX = Math.sign(tx-cx) || 1;
  } else if (en.clsKey === 'batedor'){
    en.x += (Math.sign(tx-cx) || 1) * 90;
  } else if (en.clsKey === 'grenadeiro'){
    // joga granada em arco
    const speed = 7.5 + Math.random()*1.5;
    grenades.push({
      x:cx, y:cy,
      vx: Math.cos(ang)*speed,
      vy: Math.sin(ang)*speed - 4.5,
      life: 1400 + Math.random()*400,
      owner: 'enemy',
      damage: Math.round(en.damage * 3.2),
      radius: 95
    });
    playGrenadeThrow();
  } else if (en.clsKey === 'miniboss'){
    for (let i=-2;i<=2;i++){
      const off = i*0.07;
      bullets.push({ x:cx, y:cy, vx:Math.cos(ang+off)*en.cls.bulletSpeed*1.15, vy:Math.sin(ang+off)*en.cls.bulletSpeed*1.15, damage:Math.round(en.damage*1.15), owner:'enemy', life:2000 });
    }
  } else if (en.clsKey === 'boss'){
    for (let i=-3;i<=3;i++){
      const off = i*0.09;
      bullets.push({ x:cx, y:cy, vx:Math.cos(ang+off)*en.cls.bulletSpeed*1.2, vy:Math.sin(ang+off)*en.cls.bulletSpeed*1.2, damage:Math.round(en.damage*1.1), owner:'enemy', life:2200 });
    }
  }
  en.abilityFlash = 500;
  spawnParticles(cx, cy, '#ff66ff', 8);
}

function spawnExplosion(x,y){
  spawnParticles(x,y,'#ffaa33',16);
  spawnParticles(x,y,'#fff2b0',10);
  playBoom(shotVolumeFor(x));
}

// ================= HELPERS =================
function rectsOverlap(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
// checa se o caminho de uma bala (de x0,y0 até x1,y1) atravessa alguma parede/teto sólido
// Usa amostragem densa proporcional à distância para evitar tunneling de balas rápidas
function bulletBlockedByWalls(x0,y0,x1,y1){
  const dist = Math.hypot(x1-x0, y1-y0);
  const steps = Math.max(6, Math.ceil(dist / 4));
  for (let i=0;i<=steps;i++){
    const t = i/steps;
    const px = x0 + (x1-x0)*t, py = y0 + (y1-y0)*t;
    for (const wseg of WALL_SEGMENTS){
      if (px > wseg.x && px < wseg.x+wseg.w && py > wseg.y && py < wseg.y+wseg.h) return {x:px,y:py};
    }
  }
  return null;
}
function platformUnder(entity){
  for (const p of platforms){
    const withinX = entity.x + entity.w > p.x && entity.x < p.x + p.w;
    if (withinX && Math.abs((entity.y+entity.h) - p.y) < 4) return p;
  }
  return null;
}
function ladderAt(entity){
  const cx = entity.x + entity.w/2;
  for (const l of ladders){
    if (cx > l.x - 4 && cx < l.x + l.w + 4 && entity.y + entity.h > l.y1 + 4 && entity.y < l.y2 + 8){
      return l;
    }
  }
  return null;
}
function findNearestPickup(x, type){
  let best = null, bestD = Infinity;
  for (const pk of pickups){
    if (pk.active && pk.type === type){
      const d = Math.abs(pk.x - x);
      if (d < bestD){ bestD = d; best = pk; }
    }
  }
  return best;
}
// alvo mais próximo (jogador ou aliado vivo) para um inimigo
function pickTargetFor(en){
  let best = null, bestD = Infinity;
  if (player.alive){
    best = player;
    bestD = Math.abs((player.x+player.w/2)-(en.x+en.w/2));
  }
  for (const al of allies){
    if (al.dead) continue;
    const d = Math.abs((al.x+al.w/2)-(en.x+en.w/2));
    if (d < bestD){ bestD = d; best = al; }
  }
  return best;
}
// inimigo vivo mais próximo de uma entidade (usado pelos aliados)
function pickNearestEnemy(fromEntity){
  let best = null, bestD = Infinity;
  for (const en of enemies){
    if (en.dead) continue;
    const d = Math.hypot((en.x+en.w/2)-(fromEntity.x+fromEntity.w/2), (en.y+en.h/2)-(fromEntity.y+fromEntity.h/2));
    if (d < bestD){ bestD = d; best = en; }
  }
  return best;
}

function spawnEnemy(){
  const p = randomNonStartPlatform();
  const clsKey = NORMAL_ENEMY_KEYS[Math.floor(Math.random()*NORMAL_ENEMY_KEYS.length)];
  const cls = ENEMY_CLASSES[clsKey];
  const baseHp = 34 * cls.hpMul;
  const hp = Math.round(baseHp * (1 + (wave-1)*0.2));
  const fromLeft = Math.random() < 0.5;
  const y = p.y-40;
  enemies.push({
    x: p.x + (fromLeft? 4 : p.w-30),
    y, w:26, h:40,
    vx:0, speed: (1.15+Math.random()*0.3)*cls.speedMul,
    health: hp, maxHealth: hp,
    fireCooldown: 500+Math.random()*900,
    jumpCooldown: 300+Math.random()*600,
    onGround:false, vy:0, prevY:y,
    lastHitDirX: 1, lastKillerType:null, lastKillerAlly:null,
    cls, clsKey,
    ammo: cls.maxAmmo, maxAmmo: cls.maxAmmo,
    damage: Math.max(3, Math.round((5+wave*0.6)*cls.damageMul)),
    abilityCooldown: cls.ability.cooldown*(0.5+Math.random()*0.5),
    abilityFlash:0, chargeTimer:0, chargeDirX:1,
    dodgeCooldown: 900+Math.random()*1400, dodgeTimer:0, dodgeDirX:1,
    dead:false, respawnTimer:0,
    nameOffsetX: randomNameOffset(),
    hitFlash:0, climbing:false, coverTarget:null, grenadeCd:0,
    legSlowTimer:0, armAimTimer:0,
  });
}

function respawnEnemy(en){
  const p = randomNonStartPlatform();
  const clsKey = NORMAL_ENEMY_KEYS[Math.floor(Math.random()*NORMAL_ENEMY_KEYS.length)];
  const cls = ENEMY_CLASSES[clsKey];
  const baseHp = 34 * cls.hpMul;
  const hp = Math.round(baseHp * (1 + (wave-1)*0.2));
  const fromLeft = Math.random() < 0.5;
  en.cls = cls; en.clsKey = clsKey;
  en.x = p.x + (fromLeft? 4 : p.w-30);
  en.y = p.y-40; en.w=26; en.h=40;
  en.vx = 0; en.vy = 0; en.onGround = false; en.prevY = en.y;
  en.health = hp; en.maxHealth = hp;
  en.speed = (1.15+Math.random()*0.3)*cls.speedMul;
  en.fireCooldown = 500+Math.random()*900;
  en.jumpCooldown = 300+Math.random()*600;
  en.lastHitDirX = 1; en.lastKillerType = null; en.lastKillerAlly = null;
  en.ammo = cls.maxAmmo; en.maxAmmo = cls.maxAmmo;
  en.damage = Math.max(3, Math.round((5+wave*0.6)*cls.damageMul));
  en.abilityCooldown = cls.ability.cooldown*(0.5+Math.random()*0.5);
  en.abilityFlash = 0; en.chargeTimer = 0; en.chargeDirX = 1;
  en.dodgeCooldown = 900+Math.random()*1400; en.dodgeTimer = 0; en.dodgeDirX = 1;
  en.dead = false; en.respawnTimer = 0;
  en.nameOffsetX = randomNameOffset();
  en.hitFlash = 0; en.climbing = false; en.coverTarget = null; en.grenadeCd = 0;
  en.isBoss = false; en.isMiniBoss = false;
  en.legSlowTimer = 0; en.armAimTimer = 0;
}

function spawnMiniBoss(){
  const p = randomNonStartPlatform();
  const cls = ENEMY_CLASSES.miniboss;
  const hp = Math.round(280 * (1 + (wave-1)*0.15));
  const y = p.y - 52;
  enemies.push({
    x: p.x + p.w/2 - 22, y, w:44, h:52,
    vx:0, speed: 1.6*cls.speedMul,
    health: hp, maxHealth: hp,
    fireCooldown: 400,
    jumpCooldown: 300+Math.random()*400,
    onGround:false, vy:0, prevY:y,
    lastHitDirX: 1, lastKillerType:null, lastKillerAlly:null,
    cls, clsKey:'miniboss',
    ammo: cls.maxAmmo, maxAmmo: cls.maxAmmo,
    damage: Math.round(12 + wave*1.2),
    abilityCooldown: 4000,
    abilityFlash:0, chargeTimer:0, chargeDirX:1,
    dodgeCooldown: 1000, dodgeTimer:0, dodgeDirX:1,
    dead:false, respawnTimer:0,
    nameOffsetX: 0,
    hitFlash:0, climbing:false, coverTarget:null, grenadeCd:0,
    isMiniBoss:true,
    legSlowTimer:0, armAimTimer:0,
  });
  showNotif('⚠️ MINI-BOSS: ' + cls.name + '!');
  playAbility();
  addScreenShake(6);
}

function spawnBoss(){
  const p = randomNonStartPlatform();
  const cls = ENEMY_CLASSES.boss;
  const hp = 1950;
  const y = p.y - 96;
  enemies.push({
    x: p.x + p.w/2 - 38, y, w:76, h:96,
    vx:0, speed: 1.5*cls.speedMul,
    health: hp, maxHealth: hp,
    fireCooldown: 500,
    jumpCooldown: 300+Math.random()*400,
    onGround:false, vy:0, prevY:y,
    lastHitDirX: 1, lastKillerType:null, lastKillerAlly:null,
    cls, clsKey:'boss',
    ammo: cls.maxAmmo, maxAmmo: cls.maxAmmo,
    damage: 24,
    abilityCooldown: 3500,
    abilityFlash:0, chargeTimer:0, chargeDirX:1,
    dodgeCooldown: 1200+Math.random()*800, dodgeTimer:0, dodgeDirX:1,
    dead:false, respawnTimer:0,
    nameOffsetX: 0,
    isBoss:true,
    legSlowTimer:0, armAimTimer:0, hitFlash:0, climbing:false, coverTarget:null, grenadeCd:0,
  });
  showNotif('⚠️ CHEFE FINAL: ' + cls.name + '!');
  setMusicMode('boss');
  playAbility();
  addScreenShake(10);
}

function spawnAlly(){
  const p = randomNonStartPlatform();
  const classKey = CLASS_KEYS[Math.floor(Math.random()*CLASS_KEYS.length)];
  const c = CLASSES[classKey];
  const fromLeft = Math.random() < 0.5;
  const y = p.y-46;
  allies.push({
    classKey, c,
    x: p.x + (fromLeft? 4 : p.w-30), y, w:30, h:46,
    vx:0, vy:0, onGround:false, prevY:y, facing: fromLeft?1:-1,
    health:c.maxHealth, maxHealth:c.maxHealth,
    currentWeapon:'primary',
    ammo:{ primary:c.primary.maxAmmo, secondary:c.secondary.maxAmmo },
    cooldown:0, jumpCooldown: 300+Math.random()*600,
    killStreak:0, abilityReady:false, abilityActive:false, abilityTimer:0,
    invulnerable:false, fireRateMul:1,
    shield:0, shieldMax:0, teamShieldTimer:0,
    dead:false, respawnTimer:0,
    nameOffsetX: randomNameOffset(),
  });
}

function respawnAlly(al){
  const p = randomNonStartPlatform();
  const classKey = CLASS_KEYS[Math.floor(Math.random()*CLASS_KEYS.length)];
  const c = CLASSES[classKey];
  const fromLeft = Math.random() < 0.5;
  al.classKey = classKey; al.c = c;
  al.x = p.x + (fromLeft? 4 : p.w-30); al.y = p.y-46; al.w=30; al.h=46;
  al.vx=0; al.vy=0; al.onGround=false; al.prevY = al.y; al.facing = fromLeft?1:-1;
  al.health = c.maxHealth; al.maxHealth = c.maxHealth;
  al.currentWeapon = 'primary';
  al.ammo = { primary:c.primary.maxAmmo, secondary:c.secondary.maxAmmo };
  al.cooldown = 0; al.jumpCooldown = 300+Math.random()*600;
  al.killStreak = 0; al.abilityReady = false; al.abilityActive = false; al.abilityTimer = 0;
  al.invulnerable = false; al.fireRateMul = 1;
  al.shield = 0; al.shieldMax = 0; al.teamShieldTimer = 0;
  al.dead = false; al.respawnTimer = 0;
  al.nameOffsetX = randomNameOffset();
}

const MAX_PARTICLES = 180;
function pushParticle(p){
  if (!particles) return;
  if (particles.length >= MAX_PARTICLES) particles.splice(0, particles.length - MAX_PARTICLES + 1);
  particles.push(p);
}

function spawnParticles(x,y,color,n){
  for (let i=0;i<n;i++){
    pushParticle({ x,y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5-1, life: 300+Math.random()*200, color });
  }
}

function spawnBlood(x,y,n){
  for (let i=0;i<n;i++){
    pushParticle({
      x, y,
      vx:(Math.random()-0.5)*6,
      vy:(Math.random()-0.5)*5 - 2,
      life: 400+Math.random()*300,
      color: Math.random()<0.5 ? '#c0392b' : '#8b0000',
      size: 2+Math.random()*2
    });
  }
}

function spawnWoodChips(x,y,n){
  for (let i=0;i<n;i++){
    pushParticle({
      x, y,
      vx:(Math.random()-0.5)*4,
      vy:(Math.random()-0.5)*3 - 1,
      life: 350+Math.random()*250,
      color: Math.random()<0.6 ? '#8a5a34' : '#c9a877',
      size: 2+Math.random()*2.5
    });
  }
}

function spawnDamageNumber(x,y,dmg,isCrit){
  floatingTexts.push({
    x: x + (Math.random()-0.5)*10,
    y: y - 10,
    text: Math.round(dmg).toString(),
    color: isCrit ? '#ffcc33' : '#fff',
    life: 700,
    vy: -1.8 - Math.random()*0.6,
    vx: (Math.random()-0.5)*0.8,
    size: isCrit ? 18 : 14
  });
}

function spawnHitLabel(x,y,text,color){
  floatingTexts.push({
    x: x + (Math.random()-0.5)*8,
    y: y - 22,
    text: text,
    color: color || '#ffcc33',
    life: 900,
    vy: -1.4,
    vx: (Math.random()-0.5)*0.4,
    size: 13
  });
}

/** Detecta zona do corpo atingida pela bala (relativo ao retângulo do inimigo). */
function getHitZone(en, hitX, hitY){
  const relY = (hitY - en.y) / Math.max(1, en.h);
  const relX = (hitX - en.x) / Math.max(1, en.w);
  // cabeça (topo ~28%)
  if (relY < 0.28) return 'head';
  // pernas (baixo ~30%)
  if (relY > 0.70) return 'leg';
  // braço: laterais do tronco
  if (relY >= 0.28 && relY <= 0.62 && (relX < 0.28 || relX > 0.72)) return 'arm';
  return 'body';
}

function applyBodyPartHit(en, zone, baseDamage, owner){
  let dmg = baseDamage;
  let isCrit = baseDamage >= 25;
  if (zone === 'head'){
    dmg = Math.round(baseDamage * 2);
    isCrit = true;
    spawnHitLabel(en.x+en.w/2, en.y, 'HEADSHOT +' + dmg, '#ffcc33');
    addScreenShake(2);
  } else if (zone === 'leg'){
    en.legSlowTimer = Math.max(en.legSlowTimer || 0, 2800);
    spawnHitLabel(en.x+en.w/2, en.y, 'PERNA — lento', '#88ccff');
  } else if (zone === 'arm'){
    en.armAimTimer = Math.max(en.armAimTimer || 0, 3200);
    spawnHitLabel(en.x+en.w/2, en.y, 'BRAÇO — mira ruim', '#ffaa66');
  }
  // corpo: dano normal, sem label extra
  return { dmg, isCrit };
}

function addScreenShake(amount){
  screenShake = Math.min(14, screenShake + amount);
}

function spawnMuzzleFlash(x,y,ang){
  muzzleFlashes.push({ x, y, life: 60, ang });
}

// ---- ragdoll com partes soltas (cabeça, tronco, 2 braços, 2 pernas) ----
function spawnRagdoll(entity, dirX, dirY, color, launch, isPlayer){
  const cx = entity.x + entity.w/2, cy = entity.y + entity.h/2;
  const baseVx = launch ? dirX*6.5 : (entity.vx||0);
  const baseVy = launch ? (dirY*3.5 - 3.5) : (entity.vy||0) - 2;
  function part(ox, oy, w, h, spin){
    return {
      x: cx+ox-w/2, y: cy+oy-h/2, w, h,
      vx: baseVx + (Math.random()-0.5)*3.2,
      vy: baseVy + (Math.random()-0.5)*3.2 - Math.random()*1.5,
      rot: 0, rotSpeed: spin*(0.9+Math.random()*0.6),
      color,
    };
  }
  const spinDir = dirX<0?-1:1;
  const parts = [
    Object.assign(part(0,-14,10,10,spinDir*0.22), {isHead:true}),
    part(0,0,entity.w*0.7,16, spinDir*0.14),
    part(-entity.w*0.35,-4,14,6, spinDir*0.5),
    part(entity.w*0.35,-2,14,6, spinDir*0.55),
    part(-entity.w*0.22,16,8,18, spinDir*0.32),
    part(entity.w*0.22,16,8,18, spinDir*0.36),
  ];
  ragdolls.push({ parts, life:3200, isPlayer:!!isPlayer });
}

function downEnemy(en, dirX, killerType, killerAlly){
  spawnParticles(en.x+en.w/2, en.y+en.h/2, '#aa2222', 10);
  spawnRagdoll(en, dirX||1, -0.4, en.cls.color, true, false);
  en.dead = true; en.respawnTimer = RESPAWN_WAIT; en.health = 0;
  en.abilityFlash = 0; en.chargeTimer = 0;

  if (en.isBoss){
    score += 500;
    totalKills++;
    stopAllMusic();
    triggerVictory();
    return;
  }
  if (en.isMiniBoss){
    score += 120;
    totalKills++;
    killsThisWave += 5; // conta mais para a onda
    addScreenShake(5);
    spawnBlood(en.x+en.w/2, en.y+en.h/2, 18);
    // não respawna mini-boss
    en.respawnTimer = 999999;
  } else {
    score += 10; killsThisWave++; totalKills++;
    money += 12 + wave * 2;
  }
  if (en.isMiniBoss) money += 80;
  if (killerType === 'player' && player.alive){
    player.killStreak++;
    if (player.killStreak >= player.c.ability.streakNeeded && !player.abilityReady){
      player.abilityReady = true;
      showNotif('HABILIDADE PRONTA! Aperte F');
    }
  } else if (killerType === 'ally' && killerAlly && !killerAlly.dead){
    killerAlly.killStreak++;
    if (killerAlly.killStreak >= killerAlly.c.ability.streakNeeded && !killerAlly.abilityReady){
      killerAlly.abilityReady = true;
    }
  }
  if (wave < BOSS_WAVE && killsThisWave >= killsNeededForWave(wave)){
    const completedWave = wave;
    wave++; killsThisWave = 0;
    money += 40 + completedWave * 15; // bônus de onda
    if (wave >= BOSS_WAVE){
      showNotif('ONDA FINAL — PREPARE-SE!');
    } else {
      openShop(completedWave);
    }
  }
}

function triggerVictory(){
  running = false;
  paused = false;
  if (pauseEl) pauseEl.classList.add('hidden');
  const elapsed = performance.now() - gameStartTime;

  // Salva recordes
  let newRecord = false;
  if (score > progress.highScore){ progress.highScore = score; newRecord = true; }
  if (progress.bestTime == null || elapsed < progress.bestTime){ progress.bestTime = elapsed; newRecord = true; }
  progress.lastClass = player.classKey;
  saveProgress(progress);

  document.getElementById('gameoverTitle').textContent = '🏆 VITÓRIA! CHEFE DERROTADO';
  document.getElementById('finalScore').innerHTML =
    `Pontuação: <b>${score}</b>${score >= progress.highScore ? ' <span style="color:#ffcc33">★ RECORDE!</span>' : ''}<br>` +
    `Abates: <b>${totalKills}</b> · Tempo: <b>${formatTime(elapsed)}</b>${progress.bestTime === elapsed ? ' <span style="color:#ffcc33">★ MELHOR TEMPO!</span>' : ''}<br>` +
    `Classe: <b>${player.c.name}</b> · Onda: ${wave}`;
  setMobileControlsVisible(false);
  setTimeout(()=> gameoverEl.classList.remove('hidden'), 80);
}

function downAlly(al, dirX, dirY, launch){
  spawnParticles(al.x+al.w/2, al.y+al.h/2, '#5ad1ff', 10);
  spawnRagdoll(al, dirX||1, dirY!=null?dirY:-0.3, al.c.color, launch!==false, false);
  al.dead = true; al.respawnTimer = RESPAWN_WAIT; al.health = 0;
  al.abilityActive = false; al.abilityTimer = 0; al.invulnerable = false;
  al.shield = 0; al.shieldMax = 0; al.teamShieldTimer = 0; al.fireRateMul = 1;
  al.abilityReady = false; al.killStreak = 0;
}

function damagePlayer(dmg){
  if (player.shield > 0){
    const absorbed = Math.min(player.shield, dmg);
    player.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) player.health -= dmg;
}

function damageAllyDirect(al, dmg, dirX){
  if (al.shield > 0){
    const absorbed = Math.min(al.shield, dmg);
    al.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) al.health -= dmg;
  if (al.health <= 0 && !al.dead) downAlly(al, dirX||1, -0.35, true);
}

function killPlayer(dirX, dirY, launch, message){
  if (!player.alive) return;
  player.alive = false;
  // Limpa todos os estados de buff/invulnerabilidade para evitar vazamento
  player.invulnerable = false;
  player.abilityActive = false;
  player.abilityTimer = 0;
  player.eInvulnTimer = 0;
  player.teamShieldTimer = 0;
  player.regenBoostTimer = 0;
  player.bonusRegen = 0;
  player.shield = 0;
  player.shieldMax = 0;
  player.speedMul = 1;
  player.fireRateMul = 1;
  player.infiniteAmmo = false;
  drone = null;
  stopAllMusic();
  playDeath();
  addScreenShake(8);
  spawnRagdoll(player, dirX||0, dirY!=null?dirY:-0.3, player.c.color, launch!==false, true);
  deathTimer = 1600;
  gameoverMessage = message || 'VOCÊ CAIU EM COMBATE';
  setMobileControlsVisible(false);
}

// ================= LOOP =================
let lastTime = 0;
function loop(t){
  if (!running) return;
  requestAnimationFrame(loop);
  if (paused){
    // Continua desenhando o frame congelado + overlay de pausa (já no DOM)
    return;
  }
  let dt = t - lastTime; lastTime = t; dt = Math.min(dt, 40);
  const f = dt/16.6667;
  update(f, dt);
  render();
}

// Colisão robusta: usa a posição ANTES do movimento (prevY) para detectar
// a travessia da superfície da plataforma neste frame, independente do
// tamanho do passo de tempo (isso evita "atravessar" o chão em frames
// grandes, como pode acontecer logo no início do jogo).
function applyPlatformCollision(entity){
  entity.onGround = false;
  for (const p of platforms){
    const prevBottom = entity.prevY + entity.h;
    const newBottom = entity.y + entity.h;
    const withinX = entity.x + entity.w > p.x && entity.x < p.x + p.w;
    if (withinX && entity.vy >= 0 && prevBottom <= p.y+1 && newBottom >= p.y){
      entity.y = p.y - entity.h; entity.vy = 0; entity.onGround = true;
    }
  }
}

function update(f, dt){
  if (notif.timer > 0) notif.timer -= dt;

  // Ambiente vivo
  updateAmbient(f, dt);

  // Falas dos aliados
  for (let i=allySpeeches.length-1;i>=0;i--){
    allySpeeches[i].life -= dt;
    allySpeeches[i].y -= 0.4 * f;
    if (allySpeeches[i].life <= 0) allySpeeches.splice(i,1);
  }

  // Screen shake decay
  if (screenShake > 0) screenShake = Math.max(0, screenShake - dt*0.045);

  // Floating damage numbers
  for (let i=floatingTexts.length-1; i>=0; i--){
    const ft = floatingTexts[i];
    ft.x += ft.vx * f;
    ft.y += ft.vy * f;
    ft.vy *= 0.98;
    ft.life -= dt;
    if (ft.life <= 0) floatingTexts.splice(i,1);
  }

  // Muzzle flashes
  for (let i=muzzleFlashes.length-1; i>=0; i--){
    muzzleFlashes[i].life -= dt;
    if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i,1);
  }

  // Plataformas interativas (moving + falling)
  for (const p of platforms){
    if (p.type === 'moving'){
      p.phase = (p.phase || 0) + p.moveSpeed * f * 0.06;
      if (p.moveAxis === 'x'){
        p.x = p.baseX + Math.sin(p.phase) * p.moveRange;
      } else {
        p.y = p.baseY + Math.sin(p.phase) * p.moveRange;
      }
    } else if (p.type === 'falling'){
      if (p.falling){
        p.fallSpeed += GRAVITY * 0.4 * f;
        p.y += p.fallSpeed * f;
        if (p.y > FALL_LIMIT + 200){
          // respawn after delay
          p.fallTimer -= dt;
          if (p.fallTimer <= 0){
            p.y = p.originalY;
            p.falling = false;
            p.fallSpeed = 0;
          }
        }
      }
    }
  }

  // Grenades
  for (let i=grenades.length-1; i>=0; i--){
    const g = grenades[i];
    g.vy += GRAVITY * 0.55 * f;
    g.x += g.vx * f;
    g.y += g.vy * f;
    g.life -= dt;
    // bounce leve em plataformas
    for (const p of platforms){
      if (g.x > p.x && g.x < p.x+p.w && g.y > p.y-4 && g.y < p.y+8 && g.vy > 0){
        g.y = p.y - 2; g.vy *= -0.35; g.vx *= 0.8;
      }
    }
    if (g.life <= 0){
      // explode
      spawnExplosion(g.x, g.y);
      addScreenShake(5);
      playBoom(shotVolumeFor(g.x));
      // dano em área
      const targets = [];
      if (g.owner === 'enemy'){
        if (player.alive) targets.push(player);
        for (const al of allies) if (!al.dead) targets.push(al);
      } else {
        for (const en of enemies) if (!en.dead) targets.push(en);
      }
      for (const t of targets){
        const d = Math.hypot((t.x+t.w/2)-g.x, (t.y+t.h/2)-g.y);
        if (d < g.radius){
          const dmg = Math.round(g.damage * (1 - d/g.radius*0.6));
          if (t === player){
            if (!player.invulnerable){ damagePlayer(dmg); player.hitFlash=150; spawnBlood(t.x+t.w/2,t.y+t.h/2,8); addScreenShake(4); if(player.health<=0) killPlayer(0,-0.4,true); }
          } else if (t.cls){ // enemy
            t.health -= dmg; t.hitFlash=140; t.lastHitDirX = Math.sign(t.x-g.x)||1; t.lastKillerType = g.owner==='player'?'player':'ally';
            spawnBlood(t.x+t.w/2,t.y+t.h/2,8); spawnDamageNumber(t.x+t.w/2,t.y,dmg,true);
          } else { // ally
            damageAllyDirect(t, dmg, Math.sign(t.x-g.x)||1);
          }
        }
      }
      grenades.splice(i,1);
    }
  }

  if (player.alive){
    if (player.abilityActive){
      player.abilityTimer -= dt;
      if (player.abilityTimer <= 0){
        player.abilityActive = false;
        player.abilityTimer = 0;
        if (player.eInvulnTimer <= 0) player.invulnerable = false;
        player.speedMul = player.shopSpeedMul || 1;
        player.fireRateMul = player.shopCooldownMul || 1; player.infiniteAmmo = false;
        if (player.teamShieldTimer <= 0){ player.shield = 0; player.shieldMax = 0; }
        if (player.classKey === 'engenheiro') drone = null;
      }
    }
    if (player.activeCooldownTimer > 0) player.activeCooldownTimer -= dt;
    if (player.regenBoostTimer > 0){
      player.regenBoostTimer -= dt;
      if (player.regenBoostTimer <= 0) player.bonusRegen = 0;
    }
    if (player.eInvulnTimer > 0){
      player.eInvulnTimer -= dt;
      if (player.eInvulnTimer <= 0 && !player.abilityActive) player.invulnerable = false;
    }
    if (player.teamShieldTimer > 0){
      player.teamShieldTimer -= dt;
      if (player.teamShieldTimer <= 0 && !player.abilityActive){ player.shield = 0; player.shieldMax = 0; }
    }
    if (drone){
      drone.timer -= dt;
      if (drone.timer <= 0) drone = null;
    }

    const nearLadder = ladderAt(player);
    if (nearLadder && (keys['w'] || keys['arrowup'] || keys['s'] || keys['arrowdown'])){
      player.climbing = true;
    } else if (!nearLadder){
      player.climbing = false;
    }
    if (player.climbing && keys[' ']) player.climbing = false; // espaço solta da escada
    player.crouching = !player.climbing && !!(keys['s'] || keys['arrowdown']);

    let moveDir = 0;
    if (keys['a'] || keys['arrowleft']) moveDir -= 1;
    if (keys['d'] || keys['arrowright']) moveDir += 1;

    if (player.climbing){
      let climbDir = 0;
      if (keys['w'] || keys['arrowup']) climbDir -= 1;
      if (keys['s'] || keys['arrowdown']) climbDir += 1;
      player.vy = climbDir * 3.4;
      player.vx = moveDir * player.c.speed * 0.55;
      if (moveDir !== 0) player.facing = moveDir;
      player.onGround = false;
    } else {
      const speed = player.c.speed * player.speedMul * (player.crouching ? 0.45 : 1);
      player.vx = moveDir * speed;
      if (moveDir !== 0) player.facing = moveDir;

      if ((keys['w'] || keys[' '] || keys['arrowup']) && player.onGround && !player.crouching){
        player.vy = -13; player.onGround = false;
        playJump();
      }
    }
    // land sound + falling platform trigger
    if (!player.wasOnGround && player.onGround){
      playLand();
      // check falling platform
      const under = platformUnder(player);
      if (under && under.type === 'falling' && !under.falling){
        under.fallTimer = under.fallDelay;
        // start countdown only when stepped
        under._stepped = true;
      }
    }
    player.wasOnGround = player.onGround;
    // count down falling platforms that were stepped
    for (const p of platforms){
      if (p.type === 'falling' && p._stepped && !p.falling){
        p.fallTimer -= dt;
        if (p.fallTimer <= 0){
          p.falling = true;
          p.fallSpeed = 0;
          p.fallTimer = 4000; // time until respawn
          p._stepped = false;
          spawnWoodChips(p.x+p.w/2, p.y, 8);
          playBoom(0.4);
        }
      }
    }

    player.prevY = player.y;
    if (!player.climbing) player.vy += GRAVITY * f;
    player.x += player.vx * f;
    player.y += player.vy * f;
    player.x = Math.max(0, Math.min(WORLD_W-player.w, player.x));

    // encaixa o jogador certinho ao chegar no topo ou na base da escada
    // (a colisão normal de plataforma só registra quedas, não subidas)
    let ladderLanded = false;
    if (player.climbing && nearLadder){
      if (player.y <= nearLadder.y1 - player.h + 4){
        player.y = nearLadder.y1 - player.h;
        player.vy = 0; player.climbing = false; ladderLanded = true;
      } else if (player.y + player.h >= nearLadder.y2){
        player.y = nearLadder.y2 - player.h;
        player.vy = 0; player.climbing = false; ladderLanded = true;
      }
    }

    applyPlatformCollision(player);
    if (ladderLanded) player.onGround = true;
    if (player.climbing && player.onGround) player.climbing = false; // chegou no topo/base da escada

    if (player.y > FALL_LIMIT){
      killPlayer(Math.sign(player.vx)||0, 0.5, false, 'VOCÊ CAIU NO VAZIO');
    }

    const regen = player.c.regen + (player.bonusRegen||0);
    if (regen > 0 && player.health < player.maxHealth){
      player.health = Math.min(player.maxHealth, player.health + regen*f);
    }

    if (player.cooldown > 0) player.cooldown -= dt;
    if (keys._mcFire && aimTouchId == null) autoAimAssist();
    if (mouse.down && player.cooldown <= 0){
      const w = player.c[player.currentWeapon];
      const hasAmmo = player.infiniteAmmo || player.ammo[player.currentWeapon] > 0;
      if (hasAmmo){
        firePlayerWeapon(w);
        if (!player.infiniteAmmo && w.maxAmmo !== Infinity) player.ammo[player.currentWeapon]--;
        player.cooldown = w.fireRate * player.fireRateMul;
      } else {
        player.cooldown = 220;
      }
    }

    for (const pk of pickups){
      if (pk.active && rectsOverlap(player, pk)){
        if (pk.type === 'ammo'){
          player.ammo.primary = player.c.primary.maxAmmo;
          player.ammo.secondary = player.c.secondary.maxAmmo;
          showNotif('Munição recarregada!');
        } else {
          player.health = Math.min(player.maxHealth, player.health+55);
          showNotif('Vida recuperada!');
        }
        playPickup();
        pk.active = false; pk.cd = 14000;
      }
    }

    const targetCamX = player.x + player.w/2 - canvas.width/2;
    const targetCamY = Math.max(CAM_Y_MIN, Math.min(0, player.y + player.h/2 - canvas.height*0.45));
    // câmera suave (lerp) — evita “pulo” seco ao saltar/levar dano
    const camSmooth = 1 - Math.pow(0.86, f);
    camX += (targetCamX - camX) * camSmooth;
    camY += (targetCamY - camY) * camSmooth;
  } else {
    deathTimer -= dt;
    const rag = ragdolls.find(r => r.isPlayer);
    if (rag){
      const targetCamX = rag.parts[1].x + rag.parts[1].w/2 - canvas.width/2;
      const targetCamY = Math.max(CAM_Y_MIN, Math.min(0, rag.parts[1].y - canvas.height*0.45));
      const camSmooth = 1 - Math.pow(0.88, f);
      camX += (targetCamX - camX) * camSmooth;
      camY += (targetCamY - camY) * camSmooth;
    }
    if (deathTimer <= 0 && running){
      running = false;
      paused = false;
      if (pauseEl) pauseEl.classList.add('hidden');
      const elapsed = performance.now() - gameStartTime;

      // Salva high score mesmo na derrota
      let beatRecord = false;
      if (score > progress.highScore){ progress.highScore = score; beatRecord = true; }
      progress.lastClass = player.classKey;
      saveProgress(progress);

      document.getElementById('gameoverTitle').textContent = gameoverMessage;
      document.getElementById('finalScore').innerHTML =
        `Pontuação: <b>${score}</b>${beatRecord ? ' <span style="color:#ffcc33">★ RECORDE!</span>' : ''}<br>` +
        `Abates: <b>${totalKills}</b> · Tempo: <b>${formatTime(elapsed)}</b><br>` +
        `Classe: <b>${player.c.name}</b> · Onda: ${wave}<br>` +
        `<span style="color:#888;font-size:13px">Recorde atual: ${progress.highScore}</span>`;
      setTimeout(()=> gameoverEl.classList.remove('hidden'), 50);
    }
  }
  camX = Math.max(0, Math.min(WORLD_W - canvas.width, camX));
  camY = Math.max(CAM_Y_MIN, Math.min(0, camY));

  for (const pk of pickups){
    if (!pk.active){ pk.cd -= dt; if (pk.cd <= 0) pk.active = true; }
  }

  if (!player.alive){
    updateRagdolls(f, dt);
    updateParticles(f, dt);
    return;
  }

  // ---- balas ----
  for (let i=bullets.length-1; i>=0; i--){
    const b = bullets[i];
    const px0 = b.x, py0 = b.y;
    b.x += b.vx*f; b.y += b.vy*f; b.life -= dt;
    updateBulletAnim(b, dt);
    let remove = false;
    if (b.life <= 0 || b.x < -20 || b.x > WORLD_W+20 || b.y > 900) remove = true;

    if (!remove){
      const hitWall = bulletBlockedByWalls(px0, py0, b.x, b.y);
      if (hitWall){
        spawnWoodChips(hitWall.x, hitWall.y, 6);
        remove = true;
      }
    }

    const bRect = {x:b.x-3,y:b.y-3,w:6,h:6};

    if (!remove && (b.owner === 'player' || b.owner === 'ally')){
      for (const en of enemies){
        if (!en.dead && rectsOverlap(bRect, en)){
          const zone = getHitZone(en, b.x, b.y);
          const hit = applyBodyPartHit(en, zone, b.damage, b.owner);
          en.health -= hit.dmg;
          en.lastHitDirX = Math.sign(b.vx) || 1;
          en.lastKillerType = b.owner;
          en.lastKillerAlly = b.owner === 'ally' ? b.ownerAlly : null;
          en.hitFlash = 120;
          spawnBlood(b.x, b.y, zone === 'head' ? 11 : 7);
          spawnDamageNumber(en.x+en.w/2, en.y, hit.dmg, hit.isCrit);
          if (hit.dmg >= 20 || zone === 'head') addScreenShake(2.5);
          if (b.explosive){
            spawnExplosion(b.x, b.y);
            addScreenShake(4);
            const R = b.explodeRadius || 70;
            for (const en2 of enemies){
              if (en2.dead || en2 === en) continue;
              const d2 = Math.hypot((en2.x+en2.w/2)-b.x, (en2.y+en2.h/2)-b.y);
              if (d2 < R){
                const splash = Math.round(b.damage * (1 - d2/R) * 0.55);
                en2.health -= splash;
                en2.hitFlash = 100;
                en2.lastHitDirX = Math.sign(en2.x - b.x)||1;
                en2.lastKillerType = b.owner;
                en2.lastKillerAlly = b.ownerAlly || null;
                spawnDamageNumber(en2.x+en2.w/2, en2.y, splash, false);
              }
            }
          }
          if (b.flame) spawnParticles(b.x, b.y, '#ff6600', 4);
          remove = true;
          break;
        }
      }
    } else if (!remove && b.owner === 'enemy'){
      if (player.alive && rectsOverlap(bRect, player)){
        if (!player.invulnerable){
          damagePlayer(b.damage);
          player.hitFlash = 140;
          spawnBlood(b.x, b.y, 5);
          spawnDamageNumber(player.x+player.w/2, player.y, b.damage, false);
          addScreenShake(3.5);
          if (player.health <= 0) killPlayer(Math.sign(b.vx)||1, -0.35, true);
        }
        remove = true;
      } else {
        for (const al of allies){
          if (al.dead) continue;
          if (rectsOverlap(bRect, al)){
            if (!al.invulnerable){
              damageAllyDirect(al, b.damage, Math.sign(b.vx)||1);
              al.hitFlash = 120;
              spawnBlood(b.x, b.y, 5);
            }
            remove = true;
            break;
          }
        }
      }
    }
    if (remove) bullets.splice(i,1);
  }
  if (!player.alive) return;

  // ---- inimigos ----
  if (wave >= BOSS_WAVE){
    if (!bossSpawned){
      spawnBoss();
      bossSpawned = true;
    }
  } else {
    // Mini-boss em ondas específicas
    if (MINIBOSS_WAVES.includes(wave) && !miniBossSpawned){
      spawnMiniBoss();
      miniBossSpawned = true;
    }
    const concurrentCap = Math.min(14, 5+Math.floor(wave*1.6));
    if (enemies.length < concurrentCap){
      spawnTimer -= dt;
      if (spawnTimer <= 0){ spawnEnemy(); spawnTimer = Math.max(450, 1700 - wave*80); }
    }
  }
  // Reset miniBoss flag quando a onda avança
  if (!MINIBOSS_WAVES.includes(wave)) miniBossSpawned = false;

  for (let i=enemies.length-1; i>=0; i--){
    const en = enemies[i];

    if (en.dead){
      en.respawnTimer -= dt;
      if (en.respawnTimer <= 0) respawnEnemy(en);
      continue;
    }
    if (en.health <= 0){
      downEnemy(en, en.lastHitDirX, en.lastKillerType, en.lastKillerAlly);
      continue;
    }

    if (en.jumpCooldown > 0) en.jumpCooldown -= dt;
    if (en.abilityFlash > 0) en.abilityFlash -= dt;
    if (en.chargeTimer > 0) en.chargeTimer -= dt;
    if (en.dodgeTimer > 0) en.dodgeTimer -= dt;

    const target = pickTargetFor(en);

    // Estratégia: quando em combate, o inimigo esquiva periodicamente (pulo/passo lateral) para dificultar a mira
    if (target){
      en.dodgeCooldown -= dt;
      if (en.dodgeCooldown <= 0){
        en.dodgeCooldown = 1600 + Math.random()*2000;
        en.dodgeTimer = 260 + Math.random()*180;
        en.dodgeDirX = Math.random() < 0.5 ? -1 : 1;
        if (en.onGround && Math.random() < 0.6){ en.vy = -10.5 - Math.random()*3; }
      }
    }

    // Comportamentos especiais
    if (en.cls.behavior === 'climber' && !en.climbing){
      const nearL = ladderAt(en);
      if (nearL && target && Math.abs((target.y) - en.y) > 40){
        en.climbing = true;
      }
    }
    if (en.climbing){
      const nearL = ladderAt(en);
      if (nearL){
        const wantUp = target && target.y < en.y - 20;
        en.vy = wantUp ? -3.2 : 3.2;
        en.vx = 0;
        if ((wantUp && en.y <= nearL.y1 - en.h + 6) || (!wantUp && en.y + en.h >= nearL.y2 - 4)){
          en.climbing = false;
        }
      } else {
        en.climbing = false;
      }
    }

    // IA: se estiver sem munição ou com pouca vida, vai atrás do recurso mais próximo; senão, persegue o alvo
    let aiTarget = null;
    if (en.ammo <= 0) aiTarget = findNearestPickup(en.x, 'ammo');
    if (!aiTarget && en.health < en.maxHealth*0.4) aiTarget = findNearestPickup(en.x, 'health');
    // Cover seeker: tenta ficar perto de paredes
    if (!aiTarget && en.cls.behavior === 'cover' && WALL_SEGMENTS.length){
      let bestWall = null, bestD = Infinity;
      for (const w of WALL_SEGMENTS){
        const wx = w.x + w.w/2;
        const d = Math.abs(wx - (en.x+en.w/2));
        if (d < bestD && d > 30){ bestD = d; bestWall = w; }
      }
      if (bestWall && bestD < 280) aiTarget = { x: bestWall.x + (en.x < bestWall.x ? -20 : bestWall.w + 20) };
    }
    let desiredDir;
    if (en.climbing) desiredDir = 0;
    else if (aiTarget) desiredDir = Math.sign(aiTarget.x - (en.x+en.w/2)) || 1;
    else if (target) desiredDir = Math.sign((target.x+target.w/2) - (en.x+en.w/2)) || 1;
    else desiredDir = en.vx >= 0 ? 1 : -1;

    // debuffs de parte do corpo
    if (en.legSlowTimer > 0) en.legSlowTimer -= dt;
    if (en.armAimTimer > 0) en.armAimTimer -= dt;
    const slowMul = (en.legSlowTimer > 0) ? 0.42 : 1;

    if (en.chargeTimer > 0){
      en.vx = en.chargeDirX * en.speed * 2.2 * slowMul;
    } else if (en.dodgeTimer > 0){
      en.vx = en.dodgeDirX * en.speed * 2.1 * slowMul;
    } else {
      en.vx = desiredDir * en.speed * slowMul;
    }
    let nextX = en.x + en.vx*f;

    if (en.onGround){
      const under = platformUnder(en);
      if (under){
        const goingOff = nextX < under.x-2 || nextX+en.w > under.x+under.w+2;
        if (goingOff && en.jumpCooldown <= 0){
          en.vy = -12.6;
          en.jumpCooldown = 500+Math.random()*500;
        } else if (goingOff){
          nextX = Math.max(under.x, Math.min(under.x+under.w-en.w, nextX));
        }
      }
    }
    en.x = nextX;
    en.prevY = en.y;
    en.vy += GRAVITY*f;
    en.y += en.vy*f;
    applyPlatformCollision(en);

    if (en.y > FALL_LIMIT+150){ downEnemy(en, 0, null, null); continue; }

    // inimigos também podem pegar os recursos do mapa
    for (const pk of pickups){
      if (pk.active && rectsOverlap(en, pk)){
        if (pk.type === 'ammo'){ en.ammo = en.maxAmmo; }
        else { en.health = Math.min(en.maxHealth, en.health+50); }
        pk.active = false; pk.cd = 14000;
      }
    }

    if (target){
      const dx = (target.x+target.w/2) - (en.x+en.w/2);
      const dist = Math.abs(dx);
      const sameLevel = Math.abs((en.y+en.h/2) - (target.y+target.h/2)) < 60;

      en.fireCooldown -= dt;
      if (dist < en.cls.range && sameLevel && en.fireCooldown <= 0 && en.ammo > 0){
        const baseAng = Math.atan2((target.y+target.h/2)-(en.y+en.h/2), dx);
        const aimBad = (en.armAimTimer > 0) ? 2.8 : 1;
        const ang = baseAng + (Math.random()-0.5)*en.cls.spread * aimBad;
        const eb = { x:en.x+en.w/2, y:en.y+en.h/2, vx:Math.cos(ang)*en.cls.bulletSpeed, vy:Math.sin(ang)*en.cls.bulletSpeed, damage:en.damage, owner:'enemy', life:2200 };
        initBulletAnim(eb, pickBulletAnim({ owner:'enemy', big: !!en.isBoss }));
        bullets.push(eb);
        playGunshot(en.cls.sound || 'pistol', shotVolumeFor(en.x)*0.6);
        en.fireCooldown = en.cls.fireRate + Math.random()*380 - wave*10;
        en.ammo--;
      }

      en.abilityCooldown -= dt;
      if (en.abilityCooldown <= 0 && dist < en.cls.range*1.2){
        triggerEnemyAbility(en, target);
        en.abilityCooldown = en.cls.ability.cooldown*(0.8+Math.random()*0.4);
      }

      if (rectsOverlap(en, target)){
        if (target === player){
          if (!player.invulnerable){
            damagePlayer(0.35*f);
            if (player.health <= 0) killPlayer(Math.sign(player.x-en.x)||1, -0.4, true);
          }
        } else if (!target.invulnerable){
          damageAllyDirect(target, 0.35*f, Math.sign(target.x-en.x)||1);
        }
      }
    }
  }
  if (!player.alive) return;

  // ---- aliados ----
  updateAllies(f, dt);
  if (!player.alive) return;

  // ---- torre ----
  if (turret){
    turret.cooldown -= dt;
    if (turret.cooldown <= 0){
      let target=null, best=Infinity;
      for (const en of enemies){ if (en.dead) continue; const d=Math.abs(en.x-turret.x); if (d<turret.range && d<best){best=d; target=en;} }
      if (target){
        const ang = Math.atan2((target.y+target.h/2)-turret.y, (target.x+target.w/2)-turret.x);
        const tb = { x:turret.x, y:turret.y, vx:Math.cos(ang)*11, vy:Math.sin(ang)*11, damage:10*(turret.damageMul||1), owner:'player', life:1500 };
        initBulletAnim(tb, 'bolt');
        bullets.push(tb);
        playGunshot('turret', shotVolumeFor(turret.x)*0.7);
        turret.cooldown = 380;
      }
    }
  }

  // ---- torre automática central (fixa no mapa, sempre ativa) ----
  if (mapTower){
    mapTower.cooldown -= dt;
    if (mapTower.cooldown <= 0){
      let target=null, best=Infinity;
      for (const en of enemies){ if (en.dead) continue; const d=Math.hypot(en.x-mapTower.x, en.y-mapTower.y); if (d<mapTower.range && d<best){best=d; target=en;} }
      if (target){
        const ang = Math.atan2((target.y+target.h/2)-mapTower.y, (target.x+target.w/2)-mapTower.x);
        const mb = { x:mapTower.x, y:mapTower.y, vx:Math.cos(ang)*12, vy:Math.sin(ang)*12, damage:14, owner:'player', life:1700 };
        initBulletAnim(mb, 'bolt');
        bullets.push(mb);
        playGunshot('turret', shotVolumeFor(mapTower.x)*0.75);
        mapTower.cooldown = 400;
      }
    }
  }

  // ---- drone de apoio (habilidade do engenheiro jogador) ----
  if (drone){
    drone.x = player.x + player.w/2 + Math.sin(performance.now()/250)*10;
    drone.y = player.y - 26;
    drone.cooldown -= dt;
    if (drone.cooldown <= 0){
      let target=null, best=Infinity;
      for (const en of enemies){ if (en.dead) continue; const d=Math.hypot(en.x-drone.x, en.y-drone.y); if (d<drone.range && d<best){best=d; target=en;} }
      if (target){
        const ang = Math.atan2((target.y+target.h/2)-drone.y, (target.x+target.w/2)-drone.x);
        const db = { x:drone.x, y:drone.y, vx:Math.cos(ang)*12, vy:Math.sin(ang)*12, damage:9, owner:'player', life:1500 };
        initBulletAnim(db, 'orb');
        bullets.push(db);
        playGunshot('turret', shotVolumeFor(drone.x)*0.6);
        drone.cooldown = 300;
      }
    }
  }

  updateRagdolls(f, dt);
  updateParticles(f, dt);
}

function updateAllies(f, dt){
  const cap = Math.min(3, 2+Math.floor(wave/3)); // um pouco menos aliados para não dominar
  if (allies.length < cap){
    allySpawnTimer -= dt;
    if (allySpawnTimer <= 0){ spawnAlly(); allySpawnTimer = 5000+Math.random()*3500; }
  }

  for (let i=allies.length-1; i>=0; i--){
    const al = allies[i];

    if (al.dead){
      al.respawnTimer -= dt;
      if (al.respawnTimer <= 0) respawnAlly(al);
      continue;
    }

    if (al.abilityActive){
      al.abilityTimer -= dt;
      if (al.abilityTimer <= 0){
        al.abilityActive = false; al.invulnerable = false; al.shield = 0; al.fireRateMul = 1;
      }
    }
    if (al.cooldown > 0) al.cooldown -= dt;
    if (al.jumpCooldown > 0) al.jumpCooldown -= dt;
    if (al.teamShieldTimer > 0){
      al.teamShieldTimer -= dt;
      if (al.teamShieldTimer <= 0 && !al.abilityActive){ al.shield = 0; al.shieldMax = 0; }
    }

    const target = pickNearestEnemy(al);

    let aiTarget = null;
    if (al.ammo[al.currentWeapon] <= 0 && al.c[al.currentWeapon].maxAmmo !== Infinity){
      const other = al.currentWeapon === 'primary' ? 'secondary' : 'primary';
      if (al.ammo[other] > 0 || al.c[other].maxAmmo === Infinity) al.currentWeapon = other;
      else aiTarget = findNearestPickup(al.x, 'ammo');
    }
    if (!aiTarget && al.health < al.maxHealth*0.4) aiTarget = findNearestPickup(al.x, 'health');

    let desiredDir = 0;
    if (aiTarget){
      desiredDir = Math.sign(aiTarget.x - (al.x+al.w/2)) || 1;
    } else if (target){
      const dist = Math.abs((target.x+target.w/2) - (al.x+al.w/2));
      if (dist > 140){
        desiredDir = Math.sign((target.x+target.w/2) - (al.x+al.w/2)) || 1;
      } else {
        // perto do alvo: em vez de parar, fica se movendo em vaivém (strafe)
        al.strafeTimer = (al.strafeTimer||0) - dt;
        if (al.strafeTimer <= 0){
          al.strafeDir = Math.random()<0.5 ? -1 : 1;
          al.strafeTimer = 450+Math.random()*650;
        }
        desiredDir = al.strafeDir || 1;
      }
    } else {
      // sem inimigos vivos: continua patrulhando em vez de ficar parado
      al.wanderTimer = (al.wanderTimer||0) - dt;
      if (al.wanderTimer <= 0){
        al.wanderDir = Math.random()<0.72 ? (Math.random()<0.5?-1:1) : 0;
        al.wanderTimer = 700+Math.random()*1100;
      }
      desiredDir = al.wanderDir || 0;
    }
    al.vx = desiredDir * al.c.speed;
    if (target){
      al.facing = Math.sign((target.x+target.w/2) - (al.x+al.w/2)) || al.facing;
    } else if (desiredDir !== 0){
      al.facing = desiredDir;
    }

    let nextX = al.x + al.vx*f;
    if (al.onGround){
      const under = platformUnder(al);
      if (under){
        const goingOff = nextX < under.x-2 || nextX+al.w > under.x+under.w+2;
        if (goingOff && al.jumpCooldown <= 0){
          al.vy = -13; al.jumpCooldown = 500+Math.random()*500;
        } else if (goingOff){
          nextX = Math.max(under.x, Math.min(under.x+under.w-al.w, nextX));
        }
      }
    }
    al.x = Math.max(0, Math.min(WORLD_W-al.w, nextX));
    al.prevY = al.y;
    al.vy += GRAVITY*f;
    al.y += al.vy*f;
    applyPlatformCollision(al);

    if (al.y > FALL_LIMIT+150){ downAlly(al, 0, -0.3, false); continue; }

    const regen = al.c.regen || 0;
    if (regen > 0 && al.health < al.maxHealth) al.health = Math.min(al.maxHealth, al.health + regen*f);

    for (const pk of pickups){
      if (pk.active && rectsOverlap(al, pk)){
        if (pk.type === 'ammo'){
          al.ammo.primary = al.c.primary.maxAmmo;
          al.ammo.secondary = al.c.secondary.maxAmmo;
        } else {
          al.health = Math.min(al.maxHealth, al.health+55);
        }
        pk.active = false; pk.cd = 14000;
      }
    }

    if (target){
      const dx = (target.x+target.w/2) - (al.x+al.w/2);
      const dist = Math.abs(dx);
      const sameLevel = Math.abs((al.y+al.h/2) - (target.y+target.h/2)) < 60;
      const w = al.c[al.currentWeapon];
      const hasAmmo = al.ammo[al.currentWeapon] > 0 || w.maxAmmo === Infinity;
      if (dist < 420 && sameLevel && al.cooldown <= 0 && hasAmmo){
        const cx = al.x+al.w/2, cy = al.y+al.h/2-4;
        const ang = Math.atan2((target.y+target.h/2)-cy, (target.x+target.w/2)-cx);
        for (let k=0;k<w.pellets;k++){
          const spreadOff = (w.pellets>1) ? (k-(w.pellets-1)/2)*w.spread : (Math.random()-0.5)*w.spread;
          const a2 = ang + spreadOff;
          const ab = { x:cx, y:cy, vx:Math.cos(a2)*w.bulletSpeed, vy:Math.sin(a2)*w.bulletSpeed, damage:w.damage, owner:'ally', ownerAlly:al, life:1200 };
          initBulletAnim(ab, pickBulletAnim({ owner:'ally', pellets: w.pellets, sound: w.sound, damage: w.damage }));
          bullets.push(ab);
        }
        playGunshot(w.sound || 'pistol', shotVolumeFor(al.x)*0.65);
        if (w.maxAmmo !== Infinity) al.ammo[al.currentWeapon]--;
        al.cooldown = w.fireRate * (al.fireRateMul||1);
        spawnParticles(cx,cy,'#c8ffd8',2);
      }
    }

    if (al.abilityReady && !al.abilityActive) activateAllyAbility(al);
  }
}

function updateRagdolls(f, dt){
  for (let i=ragdolls.length-1;i>=0;i--){
    const r = ragdolls[i];
    let maxY = -Infinity;
    for (const p of r.parts){
      p.vy += GRAVITY*0.4*f;
      p.vx *= 0.996;
      p.x += p.vx*f; p.y += p.vy*f;
      p.rot += p.rotSpeed*f;
      if (p.y > maxY) maxY = p.y;
    }
    r.life -= dt;
    if (!r.isPlayer && (r.life <= 0 || maxY > 950)) ragdolls.splice(i,1);
  }
}
function updateParticles(f, dt){
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx*f; p.y += p.vy*f; p.vy += 0.15*f; p.life -= dt;
    if (p.life <= 0) particles.splice(i,1);
  }
  // hit flash decay
  if (player && player.hitFlash > 0) player.hitFlash -= dt;
  for (const en of enemies) if (en.hitFlash > 0) en.hitFlash -= dt;
  for (const al of allies) if (al.hitFlash > 0) al.hitFlash -= dt;
}

function firePlayerWeapon(w){
  const cx = player.x + player.w/2, cy = player.y + player.h/2 - 4;
  const worldMouseX = mouse.x + camX, worldMouseY = mouse.y + camY;
  const baseAng = Math.atan2(worldMouseY-cy, worldMouseX-cx);
  const spreadMul = player.crouching ? 0.32 : 1;
  const dmgMul = (player.shopDamageMul || 1);
  for (let i=0;i<w.pellets;i++){
    const effSpread = w.spread*spreadMul;
    const spreadOff = (w.pellets>1) ? (i-(w.pellets-1)/2)*effSpread : (Math.random()-0.5)*effSpread;
    const ang = baseAng + spreadOff;
    const b = {
      x:cx, y:cy,
      vx:Math.cos(ang)*w.bulletSpeed, vy:Math.sin(ang)*w.bulletSpeed,
      damage: Math.round(w.damage * dmgMul),
      owner:'player', life: w.flame ? 280 : (w.explosive ? 1400 : 1200),
    };
    if (w.explosive){ b.explosive = true; b.explodeRadius = w.explodeRadius || 70; b.big = true; }
    if (w.flame){ b.flame = true; b.color = '#ff6600'; }
    initBulletAnim(b, pickBulletAnim({
      owner: 'player', flame: !!w.flame, explosive: !!w.explosive, big: !!b.big,
      pellets: w.pellets, sound: w.sound, damage: w.damage,
    }));
    bullets.push(b);
  }
  playGunshot(w.sound || 'pistol', 1);
  if (w.flame){
    spawnParticles(cx + Math.cos(baseAng)*20, cy + Math.sin(baseAng)*20, '#ff8800', 6);
    spawnParticles(cx + Math.cos(baseAng)*28, cy + Math.sin(baseAng)*28, '#ff4400', 4);
  } else {
    spawnParticles(cx,cy,'#fff2b0',3);
    spawnMuzzleFlash(cx + Math.cos(baseAng)*22, cy + Math.sin(baseAng)*22, baseAng);
  }
  if (w.damage >= 20 || w.pellets > 3 || w.explosive) addScreenShake(1.2);
}

// ================= RENDER =================
// ---- fundo: bambuzal com neblina, bambus em parallax e canópia escura embaixo ----
function drawBambooStalk(x,y,h,w,color,knotColor){
  ctx.save(); ctx.translate(x,y);
  ctx.fillStyle = color;
  ctx.fillRect(-w/2,0,w,h);
  ctx.strokeStyle = knotColor; ctx.lineWidth = Math.max(1,w*0.18);
  const segs = Math.max(3, Math.round(h/46));
  for (let i=1;i<segs;i++){
    const sy = (h/segs)*i;
    ctx.beginPath(); ctx.moveTo(-w/2-1,sy); ctx.lineTo(w/2+1,sy); ctx.stroke();
  }
  ctx.fillStyle = color;
  for (let i=0;i<2;i++){
    const sy = h*0.15 + i*h*0.3;
    ctx.beginPath();
    ctx.ellipse((i%2===0?-1:1)*w*1.6, sy, w*1.4, w*0.55, (i%2===0?-0.5:0.5), 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBambooLayer(seed, count, parallax, colorStalk, colorKnot, minW, maxW, alpha){
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i=0;i<count;i++){
    const spacing = (WORLD_W+600)/count;
    const wx = (i*spacing + seed) - camX*parallax;
    const bx = ((wx % (WORLD_W+600)) + (WORLD_W+600)) % (WORLD_W+600) - 300;
    const w = minW + ((i*53)%(maxW-minW));
    const sway = Math.sin(performance.now()/1800 + i)* (2+parallax*3);
    drawBambooStalk(bx+sway, -20, canvas.height+40, w, colorStalk, colorKnot);
  }
  ctx.restore();
}

function drawMapBackground(){
  const theme = (MAPS[currentMapKey] && MAPS[currentMapKey].theme) || 'bamboo';
  if (theme === 'ruins') drawRuinsBackground();
  else if (theme === 'night') drawNightBackground();
  else drawBambooBackground();
}

function drawBambooBackground(){
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#e8f4d0');
  g.addColorStop(0.22,'#c8e0a0');
  g.addColorStop(0.5,'#8fbe70');
  g.addColorStop(0.78,'#5a8a48');
  g.addColorStop(1,'#243f24');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
  // vinheta suave nas bordas
  const vg = ctx.createRadialGradient(canvas.width/2, canvas.height*0.35, canvas.height*0.2, canvas.width/2, canvas.height*0.5, canvas.width*0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10,20,8,0.18)');
  ctx.fillStyle = vg;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // raios de sol mais suaves e volumosos
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff9d0';
  for (let i=0;i<8;i++){
    const bx = ((i*160 - camX*0.07)%1300+1300)%1300 - 90;
    ctx.beginPath();
    ctx.moveTo(bx,0); ctx.lineTo(bx+60,0); ctx.lineTo(bx-10,canvas.height); ctx.lineTo(bx-80,canvas.height);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  // camadas de bambu mais densas e com mais profundidade
  drawBambooLayer(15,  14, 0.08, '#a8c878', '#7a9a50', 7, 13, 0.35);
  drawBambooLayer(70,  13, 0.18, '#8ab85a', '#5a7e38', 11, 18, 0.55);
  drawBambooLayer(150, 12, 0.32, '#6a9a48', '#3e6a28', 15, 24, 0.72);
  drawBambooLayer(240, 10, 0.48, '#548238', '#2e5018', 20, 30, 0.88);
  drawBambooLayer(320, 8,  0.62, '#3e6828', '#1e3a10', 24, 36, 0.97);

  // canópia inferior mais densa e irregular
  ctx.save();
  ctx.fillStyle = 'rgba(20,38,16,0.82)';
  for (let i=0;i<22;i++){
    const wx = (i*170 - camX*0.55) % (WORLD_W+500);
    const bx = ((wx%1700)+1700)%1700 - 220;
    ctx.beginPath(); ctx.ellipse(bx, 555+((i*31)%48), 110, 42, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawRuinsBackground(){
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#ece0c4'); g.addColorStop(0.35,'#c8b890');
  g.addColorStop(0.7,'#8a7a58'); g.addColorStop(1,'#3e3428');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  // névoa dourada
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#f5eedd';
  for (let i=0;i<6;i++){
    const bx = ((i*260 - camX*0.05)%1500+1500)%1500 - 120;
    ctx.beginPath(); ctx.ellipse(bx, 100+i*70, 220, 55, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // pilares distantes (parallax mais rico)
  ctx.save();
  for (let i=0;i<12;i++){
    const wx = (i*250 - camX*0.18);
    const bx = ((wx % 1500)+1500)%1500 - 110;
    const h = 160 + (i%4)*70;
    ctx.globalAlpha = 0.28 + (i%3)*0.04;
    ctx.fillStyle = '#6a5a40';
    ctx.fillRect(bx, canvas.height - h, 26, h);
    // capitel
    ctx.fillStyle = '#8a7a55';
    ctx.fillRect(bx-10, canvas.height - h - 14, 46, 16);
    // rachadura sutil
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx+6, canvas.height - h + 30); ctx.lineTo(bx+14, canvas.height - h + 90); ctx.stroke();
  }
  ctx.restore();

  // colunas médias com mais detalhes
  ctx.save();
  for (let i=0;i<8;i++){
    const wx = (i*340 - camX*0.42);
    const bx = ((wx % 1650)+1650)%1650 - 130;
    ctx.globalAlpha = 0.68;
    // corpo da coluna
    ctx.fillStyle = '#5a4a32';
    ctx.fillRect(bx, 180, 38, 420);
    // volume (highlight)
    ctx.fillStyle = 'rgba(200,180,140,0.12)';
    ctx.fillRect(bx, 180, 12, 420);
    // rachaduras
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(bx+10, 240); ctx.lineTo(bx+22, 400); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx+28, 280); ctx.lineTo(bx+18, 450); ctx.stroke();
    // capitel + base
    ctx.fillStyle = '#7a6a48';
    ctx.fillRect(bx-12, 168, 62, 18);
    ctx.fillRect(bx-8, 580, 54, 14);
    // blocos horizontais
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let j=0;j<6;j++){
      const yy = 200 + j*60;
      ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx+38, yy); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawChristmasTree(x, baseY, height, color, trunkColor, detail){
  // Pinheiro denso estilo floresta (sem enfeites) — mais camadas e volume
  const layers = detail ? 6 : 5;
  const trunkH = height * 0.16;
  const trunkW = Math.max(8, height * 0.09);
  // sombra suave na base
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, baseY - 2, height * 0.22, 8, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
  // tronco com leve volume
  ctx.fillStyle = trunkColor;
  ctx.fillRect(x - trunkW/2, baseY - trunkH, trunkW, trunkH);
  ctx.fillStyle = 'rgba(255,220,160,0.08)';
  ctx.fillRect(x - trunkW/2, baseY - trunkH, trunkW * 0.35, trunkH);
  // camadas cônicas sobrepostas (mais realistas)
  for (let i = 0; i < layers; i++){
    const t = i / (layers - 1);
    const layerH = height * (0.26 - t * 0.028);
    const layerW = height * (0.62 - t * 0.09);
    const ly = baseY - trunkH - (height * 0.105) * i - layerH * 0.28;
    // face principal
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, ly - layerH * 0.75);
    ctx.lineTo(x + layerW/2, ly + layerH * 0.38);
    ctx.lineTo(x - layerW/2, ly + layerH * 0.38);
    ctx.closePath();
    ctx.fill();
    // sombra lateral (volume)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(x, ly - layerH * 0.75);
    ctx.lineTo(x + layerW/2, ly + layerH * 0.38);
    ctx.lineTo(x + layerW * 0.12, ly + layerH * 0.1);
    ctx.closePath();
    ctx.fill();
    // highlight no lado iluminado pela lua
    ctx.fillStyle = 'rgba(120,180,140,0.12)';
    ctx.beginPath();
    ctx.moveTo(x, ly - layerH * 0.75);
    ctx.lineTo(x - layerW * 0.15, ly + layerH * 0.05);
    ctx.lineTo(x - layerW/2, ly + layerH * 0.38);
    ctx.closePath();
    ctx.fill();
  }
  // topo pontudo
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, baseY - height * 0.92);
  ctx.lineTo(x + height * 0.07, baseY - height * 0.78);
  ctx.lineTo(x - height * 0.07, baseY - height * 0.78);
  ctx.closePath();
  ctx.fill();
}

function drawNightBackground(){
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0,'#030810'); g.addColorStop(0.35,'#0a1424');
  g.addColorStop(0.7,'#0e1c18'); g.addColorStop(1,'#08120c');
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);

  // estrelas densas
  ctx.save();
  for (let i=0;i<90;i++){
    const sx = ((i*97 + 40) % canvas.width);
    const sy = ((i*53 + 20) % (canvas.height*0.52));
    const tw = 0.3 + Math.sin(performance.now()/420 + i)*0.45;
    ctx.globalAlpha = tw;
    ctx.fillStyle = i % 7 === 0 ? '#ffe8a0' : '#eef';
    ctx.beginPath(); ctx.arc(sx, sy, 0.9+(i%4)*0.35, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();

  // lua com brilho
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = '#d8e8ff';
  ctx.beginPath(); ctx.arc(canvas.width*0.78, 70, 55, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#f0e8c8';
  ctx.beginPath(); ctx.arc(canvas.width*0.78, 68, 28, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#030810';
  ctx.beginPath(); ctx.arc(canvas.width*0.78+11, 60, 22, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // Floresta densa de pinheiros grandes em 4 camadas de parallax
  const treeLayers = [
    { count: 14, parallax: 0.08, hMin: 140, hMax: 220, color: '#0a1e12', trunk: '#120c06', alpha: 0.35, detail: false },
    { count: 12, parallax: 0.20, hMin: 180, hMax: 280, color: '#0c2416', trunk: '#150e06', alpha: 0.55, detail: false },
    { count: 11, parallax: 0.38, hMin: 220, hMax: 340, color: '#0a1c12', trunk: '#100a04', alpha: 0.78, detail: true },
    { count: 9,  parallax: 0.58, hMin: 260, hMax: 400, color: '#081610', trunk: '#0c0804', alpha: 0.95, detail: true },
  ];
  for (const layer of treeLayers){
    ctx.save();
    ctx.globalAlpha = layer.alpha;
    for (let i=0; i<layer.count; i++){
      const spacing = (WORLD_W + 600) / layer.count;
      const wx = (i * spacing + 60 + (i%3)*40) - camX * layer.parallax;
      const bx = ((wx % (WORLD_W + 600)) + (WORLD_W + 600)) % (WORLD_W + 600) - 280;
      const h = layer.hMin + ((i * 53 + i*i*7) % (layer.hMax - layer.hMin));
      const sway = Math.sin(performance.now()/2400 + i * 1.3) * (2 + layer.parallax * 3);
      drawChristmasTree(bx + sway, canvas.height + 18, h, layer.color, layer.trunk, layer.detail);
    }
    ctx.restore();
  }

  // névoa baixa densa
  ctx.save();
  ctx.fillStyle = 'rgba(15,28,24,0.55)';
  for (let i=0;i<16;i++){
    const bx = ((i*160 - camX*0.32)%1500+1500)%1500 - 160;
    ctx.beginPath(); ctx.ellipse(bx, 525+((i%5)*12), 140, 48, 0, 0, Math.PI*2); ctx.fill();
  }
  // segunda camada de névoa mais alta e clara
  ctx.fillStyle = 'rgba(30,50,45,0.18)';
  for (let i=0;i<8;i++){
    const bx = ((i*220 - camX*0.18)%1400+1400)%1400 - 100;
    ctx.beginPath(); ctx.ellipse(bx, 380+((i%3)*30), 180, 35, 0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

const LEAF_COLORS = ['#8fbf4a','#a9d15c','#c9a63d','#7fa93f','#d6b24a','#c4d96a','#9ab84a'];
const LEAVES = Array.from({length:70}, (_,i) => ({
  seedX: (i*41.3)%(canvas.width+100) - 50,
  seedDelay: (i*733)%12000,
  fallSpeed: 0.016 + (i%6)*0.0055,
  swayAmp: 16+(i%5)*7,
  swayFreq: 0.35+(i%4)*0.22,
  phase: i*1.17,
  size: 4+(i%5)*2.2,
  rotSpeed: 0.4+(i%4)*0.35,
  color: LEAF_COLORS[i%LEAF_COLORS.length],
}));

function initAmbient(){
  ambientBirds = [];
  ambientFog = [];
  ambientDust = [];
  // pássaros / insetos (bambuzal)
  for (let i=0;i<10;i++){
    ambientBirds.push({
      x: Math.random()*WORLD_W,
      y: 40 + Math.random()*280,
      vx: (Math.random()<0.5?-1:1) * (0.6 + Math.random()*1.4),
      vy: 0,
      phase: Math.random()*Math.PI*2,
      size: 3 + Math.random()*3,
      kind: Math.random()<0.55 ? 'bird' : 'bug',
    });
  }
  // névoa móvel (floresta negra)
  for (let i=0;i<8;i++){
    ambientFog.push({
      x: Math.random()*WORLD_W,
      y: 200 + Math.random()*280,
      w: 160 + Math.random()*220,
      h: 40 + Math.random()*50,
      vx: (Math.random()-0.5)*0.35,
      phase: Math.random()*Math.PI*2,
      alpha: 0.12 + Math.random()*0.14,
    });
  }
  // poeira de pedra (ruínas)
  for (let i=0;i<28;i++){
    ambientDust.push({
      x: Math.random()*WORLD_W,
      y: 80 + Math.random()*400,
      vx: (Math.random()-0.5)*0.4,
      vy: 0.05 + Math.random()*0.25,
      size: 1 + Math.random()*2.5,
      life: 2000 + Math.random()*4000,
      maxLife: 4000,
      phase: Math.random()*Math.PI*2,
    });
  }
}

function updateAmbient(f, dt){
  const theme = (MAPS[currentMapKey] && MAPS[currentMapKey].theme) || 'bamboo';
  if (theme === 'bamboo'){
    for (const b of ambientBirds){
      b.phase += 0.08 * f;
      b.x += b.vx * f;
      b.y += Math.sin(b.phase) * 0.35 * f + b.vy * f;
      if (b.x < -40) b.x = WORLD_W + 20;
      if (b.x > WORLD_W + 40) b.x = -20;
      if (b.y < 20) b.y = 20;
      if (b.y > 360) b.y = 360;
      // ocasionalmente muda direção
      if (Math.random() < 0.002) b.vx *= -1;
    }
  }
  if (theme === 'night'){
    for (const fog of ambientFog){
      fog.phase += 0.015 * f;
      fog.x += fog.vx * f + Math.sin(fog.phase)*0.15;
      if (fog.x < -fog.w) fog.x = WORLD_W;
      if (fog.x > WORLD_W) fog.x = -fog.w;
    }
  }
  if (theme === 'ruins'){
    for (const d of ambientDust){
      d.phase += 0.04 * f;
      d.x += d.vx * f + Math.sin(d.phase)*0.1;
      d.y += d.vy * f;
      d.life -= dt;
      if (d.life <= 0 || d.y > 520){
        d.x = Math.random()*WORLD_W;
        d.y = 60 + Math.random()*200;
        d.life = d.maxLife;
      }
    }
  }
}

function drawAmbient(){
  const theme = (MAPS[currentMapKey] && MAPS[currentMapKey].theme) || 'bamboo';
  if (theme === 'bamboo'){
    for (const b of ambientBirds){
      const sx = b.x - camX, sy = b.y - camY;
      if (sx < -30 || sx > canvas.width+30) continue;
      ctx.save();
      ctx.translate(sx, sy);
      if (b.kind === 'bird'){
        // pássaro simples em V
        const wing = Math.sin(b.phase*2.2)*0.5;
        ctx.strokeStyle = 'rgba(30,40,20,0.75)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-b.size*1.4, wing*b.size);
        ctx.lineTo(0, 0);
        ctx.lineTo(b.size*1.4, wing*b.size);
        ctx.stroke();
      } else {
        // inseto / vaga-lume leve
        ctx.globalAlpha = 0.5 + Math.sin(b.phase*3)*0.3;
        ctx.fillStyle = '#c8e070';
        ctx.beginPath(); ctx.arc(0, 0, b.size*0.45, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.beginPath(); ctx.arc(0, 0, b.size*1.2, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
  }
  if (theme === 'night'){
    for (const fog of ambientFog){
      const sx = fog.x - camX, sy = fog.y - camY;
      ctx.save();
      ctx.globalAlpha = fog.alpha * (0.85 + Math.sin(fog.phase)*0.15);
      ctx.fillStyle = '#1a2e28';
      ctx.beginPath();
      ctx.ellipse(sx, sy, fog.w*0.5, fog.h*0.5, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = fog.alpha * 0.5;
      ctx.fillStyle = '#243830';
      ctx.beginPath();
      ctx.ellipse(sx + fog.w*0.15, sy + 8, fog.w*0.35, fog.h*0.35, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (theme === 'ruins'){
    for (const d of ambientDust){
      const sx = d.x - camX, sy = d.y - camY;
      if (sx < -10 || sx > canvas.width+10) continue;
      const a = Math.min(1, d.life / 800) * 0.55;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#c4b08a';
      ctx.fillRect(sx, sy, d.size, d.size*0.7);
      ctx.globalAlpha = 1;
    }
  }
}

function drawLeaves(){
  const theme = (MAPS[currentMapKey] && MAPS[currentMapKey].theme) || 'bamboo';
  if (theme === 'night') return; // sem folhas no mapa Floresta Negra
  const t = performance.now();
  for (const lf of LEAVES){
    const cycle = (canvas.height+80)/lf.fallSpeed;
    const localT = (t + lf.seedDelay) % cycle;
    const y = -40 + localT*lf.fallSpeed;
    const x = lf.seedX + Math.sin((t/1000)*lf.swayFreq + lf.phase)*lf.swayAmp;
    const rot = (t/900)*lf.rotSpeed + lf.phase;
    ctx.save();
    ctx.translate(x,y); ctx.rotate(rot);
    ctx.globalAlpha = theme === 'ruins' ? 0.4 : 0.72;
    ctx.fillStyle = theme === 'ruins' ? '#a89060' : lf.color;
    ctx.beginPath();
    ctx.ellipse(0,0,lf.size,lf.size*0.55,0,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.moveTo(-lf.size,0); ctx.lineTo(lf.size,0); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ---- plataformas de madeira suspensas ----
function drawWoodPlank(x,y,w,h){
  ctx.save(); ctx.translate(x-camX, y-camY);

  // cordas com volume + nós
  ctx.strokeStyle = 'rgba(70,50,25,0.8)'; ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.moveTo(w*0.08,0); ctx.lineTo(w*0.02,-40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.92,0); ctx.lineTo(w*0.98,-40); ctx.stroke();
  ctx.strokeStyle = 'rgba(160,130,70,0.4)'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(w*0.08-1.2,0); ctx.lineTo(w*0.02-1.2,-40); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.92+1.2,0); ctx.lineTo(w*0.98+1.2,-40); ctx.stroke();
  // nós de corda
  ctx.fillStyle = '#6a4a22';
  ctx.beginPath(); ctx.arc(w*0.08, 1, 3.2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(w*0.92, 1, 3.2, 0, Math.PI*2); ctx.fill();

  // sombra sob a plataforma (mais suave)
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(w/2, h+8, w*0.5, 8, 0, 0, Math.PI*2);
  ctx.fill();

  // tábuas com volume
  ctx.fillStyle = '#7a4e28';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = '#9a6a3a';
  ctx.fillRect(0,0,w,h*0.45);
  ctx.fillStyle = 'rgba(255,235,190,0.22)';
  ctx.fillRect(0,0,w,h*0.28);
  // highlight topo (superfície pisável)
  ctx.fillStyle = 'rgba(255,245,210,0.4)';
  ctx.fillRect(0,0,w,2.8);
  // borda inferior + lateral
  ctx.fillStyle = 'rgba(25,12,4,0.5)';
  ctx.fillRect(0,h-3.5,w,3.5);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0,0,2,h);
  ctx.fillRect(w-2,0,2,h);
  // veios de tábuas
  ctx.strokeStyle = '#5a3818'; ctx.lineWidth = 1.4;
  const planks = Math.max(2, Math.round(w/22));
  for (let i=1;i<planks;i++){
    const px = (w/planks)*i;
    ctx.beginPath(); ctx.moveTo(px,1); ctx.lineTo(px,h-1); ctx.stroke();
    // micro-fissura
    if (i % 3 === 0){
      ctx.strokeStyle = 'rgba(40,20,8,0.35)';
      ctx.beginPath(); ctx.moveTo(px-3, h*0.3); ctx.lineTo(px+3, h*0.7); ctx.stroke();
      ctx.strokeStyle = '#5a3818';
    }
  }
  // nós de madeira
  ctx.fillStyle = 'rgba(50,28,10,0.45)';
  for (let i=0;i<planks;i++){
    if (i%2===0){
      const nx = (w/planks)*(i+0.5);
      ctx.beginPath(); ctx.ellipse(nx, h*0.45, 3.2, 2.2, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,15,5,0.3)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(nx, h*0.45, 3.2, 2.2, 0, 0, Math.PI*2); ctx.stroke();
    }
  }

  // apoios em X (bambu/madeira)
  ctx.strokeStyle = '#4a6a30'; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(w*0.12,h); ctx.lineTo(w*0.32,h+22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.32,h); ctx.lineTo(w*0.12,h+22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.68,h); ctx.lineTo(w*0.88,h+22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.88,h); ctx.lineTo(w*0.68,h+22); ctx.stroke();

  ctx.restore();
}

function drawStonePlatform(x,y,w,h){
  ctx.save(); ctx.translate(x-camX, y-camY);
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(w/2, h+7, w*0.48, 7, 0, 0, Math.PI*2);
  ctx.fill();
  // base de pedra em camadas
  ctx.fillStyle = '#5a4a32';
  ctx.fillRect(-2,0,w+4,h+6);
  ctx.fillStyle = '#8a7a58';
  ctx.fillRect(0,0,w,h);
  // topo claro (pisável)
  ctx.fillStyle = 'rgba(230,210,170,0.22)';
  ctx.fillRect(0,0,w,h*0.35);
  ctx.fillStyle = 'rgba(255,240,200,0.25)';
  ctx.fillRect(0,0,w,2.5);
  // volume lateral
  ctx.fillStyle = 'rgba(220,200,160,0.14)';
  ctx.fillRect(0,0,w*0.28,h);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(w*0.75,0,w*0.25,h);
  // blocos
  ctx.strokeStyle = 'rgba(30,22,12,0.45)'; ctx.lineWidth = 1.4;
  const blocks = Math.max(2, Math.round(w/26));
  for (let i=1;i<blocks;i++){
    const px = (w/blocks)*i;
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,h); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0,h*0.5); ctx.lineTo(w,h*0.5); ctx.stroke();
  // rachaduras
  ctx.strokeStyle = 'rgba(20,14,8,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.15, 2); ctx.lineTo(w*0.22, h*0.45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.7, h*0.2); ctx.lineTo(w*0.78, h-2); ctx.stroke();
  // musgo irregular
  ctx.fillStyle = 'rgba(50,90,35,0.55)';
  ctx.fillRect(1, 0, w*0.22, 3.5);
  ctx.fillRect(w*0.4, 0, w*0.18, 2.5);
  ctx.fillRect(w*0.7, 0, w*0.25, 3);
  // highlight topo
  ctx.fillStyle = 'rgba(255,240,200,0.15)';
  ctx.fillRect(0,0,w,2);
  // pequenas rachaduras
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.3, 2); ctx.lineTo(w*0.35, h-2); ctx.stroke();
  ctx.restore();
}

function drawRopePlatform(x,y,w,h){
  ctx.save(); ctx.translate(x-camX, y-camY);
  // cordas longas subindo (mais escuras e com volume)
  ctx.strokeStyle = 'rgba(70,50,28,0.65)'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(w*0.1,0); ctx.lineTo(w*0.04,-52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.9,0); ctx.lineTo(w*0.96,-52); ctx.stroke();
  ctx.strokeStyle = 'rgba(120,90,50,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(w*0.1-1,0); ctx.lineTo(w*0.04-1,-52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.9+1,0); ctx.lineTo(w*0.96+1,-52); ctx.stroke();
  // sombra
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(w/2, h+5, w*0.45, 6, 0, 0, Math.PI*2);
  ctx.fill();
  // madeira escura (floresta negra) com volume
  ctx.fillStyle = '#241a12';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle = 'rgba(90,70,45,0.2)';
  ctx.fillRect(0,0,w,h*0.4);
  // highlight sutil no topo
  ctx.fillStyle = 'rgba(140,110,70,0.2)';
  ctx.fillRect(0,0,w,2.5);
  // borda inferior mais escura
  ctx.fillStyle = 'rgba(8,5,2,0.55)';
  ctx.fillRect(0,h-2.5,w,2.5);
  // veios / tábuas
  ctx.strokeStyle = '#140e08'; ctx.lineWidth = 1.4;
  const planks = Math.max(2, Math.round(w/20));
  for (let i=1;i<planks;i++){
    const px = (w/planks)*i;
    ctx.beginPath(); ctx.moveTo(px,0); ctx.lineTo(px,h); ctx.stroke();
  }
  // nós de madeira escuros
  ctx.fillStyle = 'rgba(10,6,3,0.5)';
  for (let i=0;i<planks;i++){
    if (i%2===0){
      ctx.beginPath();
      ctx.ellipse((w/planks)*(i+0.5), h*0.5, 2.8, 1.8, 0, 0, Math.PI*2);
      ctx.fill();
    }
  }
  // lanterna pequena ocasional com brilho
  if (w > 100){
    ctx.fillStyle = 'rgba(255,190,70,0.7)';
    ctx.beginPath(); ctx.arc(w*0.5, -9, 4, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,160,40,0.22)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(w*0.5, -9, 9, 0, Math.PI*2); ctx.stroke();
    // cabo da lanterna
    ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(w*0.5, -5); ctx.lineTo(w*0.5, 0); ctx.stroke();
  }
  ctx.restore();
}

function drawWoodCabin(x,y,w,h){
  drawWoodPlank(x,y,w,h);
  ctx.save(); ctx.translate(x-camX,y-camY);
  const hw = w*0.6, hx = w*0.2, roofH = 22, wallH = 30;

  ctx.fillStyle = '#7a5230';
  ctx.fillRect(hx, -wallH, hw, wallH);
  ctx.strokeStyle = '#4f3419'; ctx.lineWidth = 1.2;
  for (let i=1;i<4;i++){
    const wx = hx + (hw/4)*i;
    ctx.beginPath(); ctx.moveTo(wx,-wallH); ctx.lineTo(wx,0); ctx.stroke();
  }

  // teto de bambu/palha
  ctx.fillStyle = '#3f6b2e';
  ctx.beginPath();
  ctx.moveTo(hx-9, -wallH);
  ctx.lineTo(hx+hw/2, -wallH-roofH);
  ctx.lineTo(hx+hw+9, -wallH);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#274a1c'; ctx.lineWidth = 1;
  for (let i=0;i<=4;i++){
    const t = i/4;
    ctx.beginPath();
    ctx.moveTo(hx-9+(hw+18)*t, -wallH-1);
    ctx.lineTo(hx+hw/2, -wallH-roofH+2);
    ctx.stroke();
  }

  // janelinha acesa
  ctx.fillStyle = 'rgba(255,224,138,0.85)';
  ctx.fillRect(hx+hw*0.34, -wallH*0.68, hw*0.3, wallH*0.42);
  ctx.strokeStyle = '#4f3419'; ctx.lineWidth = 1.4;
  ctx.strokeRect(hx+hw*0.34, -wallH*0.68, hw*0.3, wallH*0.42);

  ctx.restore();
}

// ---- ponte de corda (liga duas plataformas, o jogador anda por cima) ----
function drawRopeBridge(x,y,w,h){
  drawWoodPlank(x,y,w,h);
  ctx.save(); ctx.translate(x-camX,y-camY);
  ctx.strokeStyle = 'rgba(90,70,40,0.8)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(w,-15); ctx.stroke();
  const posts = Math.max(2, Math.round(w/26));
  for (let i=0;i<=posts;i++){
    const px = (w/posts)*i;
    ctx.beginPath(); ctx.moveTo(px,-15); ctx.lineTo(px,2); ctx.stroke();
  }
  ctx.restore();
}

// ---- torre central alta (estrutura fixa e visível de longe, com a torre automática no topo) ----
function drawCentralTowerStructure(){
  const p = platforms.find(pl => pl.isTowerTop);
  if (!p) return;
  const baseX = p.x + p.w/2 - camX;
  const topY = p.y + p.h - camY;
  const bottomY = 300 - camY; // desce até a plataforma quebrada mais próxima
  ctx.save();
  // pilar central de bambu grosso sustentando a torre
  ctx.strokeStyle = '#5c7a3e'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(baseX-30, topY); ctx.lineTo(baseX-30, bottomY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(baseX+30, topY); ctx.lineTo(baseX+30, bottomY); ctx.stroke();
  ctx.strokeStyle = '#3f5c28'; ctx.lineWidth = 5;
  for (let i=1;i<6;i++){
    const yy = topY + ((bottomY-topY)/6)*i;
    ctx.beginPath(); ctx.moveTo(baseX-30,yy); ctx.lineTo(baseX+30,yy-14); ctx.stroke();
  }
  ctx.restore();
}

// ---- escada de bambu (o jogador escala segurando W/S perto dela) ----
function drawLadder(l){
  const sx = l.x - camX;
  const sy1 = l.y1 - camY, sy2 = l.y2 - camY;
  ctx.save();
  ctx.strokeStyle = '#5c7a3e'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(sx+3, sy1); ctx.lineTo(sx+3, sy2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx+l.w-3, sy1); ctx.lineTo(sx+l.w-3, sy2); ctx.stroke();
  ctx.strokeStyle = '#8a5a34'; ctx.lineWidth = 3.4;
  const rungs = Math.max(2, Math.round((sy2-sy1)/22));
  for (let i=0;i<=rungs;i++){
    const ry = sy1 + (sy2-sy1)*(i/rungs);
    ctx.beginPath(); ctx.moveTo(sx+3, ry); ctx.lineTo(sx+l.w-3, ry); ctx.stroke();
  }
  ctx.restore();
}

// ---- porta quebrada, pendurada torta na entrada (só visual — não bloqueia passagem) ----
function drawBrokenDoor(localX, wallTop, wallBottom, hinge){
  ctx.save();
  ctx.translate(localX, wallBottom);
  ctx.rotate(hinge * 0.55);
  const dh = (wallBottom-wallTop)*0.92, dw = 26;
  ctx.fillStyle = '#5c3c20';
  ctx.fillRect(hinge>0?-dw:0, -dh, dw, dh);
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.4;
  ctx.strokeRect(hinge>0?-dw:0, -dh, dw, dh);
  ctx.beginPath(); ctx.moveTo(hinge>0?-dw:dw, -dh*0.2); ctx.lineTo(hinge>0?0:0, -dh*0.5); ctx.stroke();
  ctx.restore();
}

// ---- grande casa de madeira suspensa: paredes, teto e duas portas quebradas ----
// bloqueia balas nas partes sólidas (ver WALL_SEGMENTS); as portas e o buraco do meio deixam passar.
function drawTreehouse(){
  const {x,y,w,h} = BROKEN;
  ctx.save(); ctx.translate(x-camX, y-camY);
  const wallTop = TOPF*h, wallBottom = h*0.76;
  const d1s = w*DOOR1_START, d1e = w*DOOR1_END;
  const d2s = w*DOOR2_START, d2e = w*DOOR2_END;

  // interior escuro por trás de tudo
  ctx.fillStyle = 'rgba(15,10,6,0.6)';
  ctx.fillRect(0, wallTop, w, wallBottom-wallTop);

  // telhado (parte de cima, sólido — é o "teto" que bloqueia tiros vindos de cima)
  ctx.fillStyle = '#3f6b2e';
  ctx.beginPath();
  ctx.moveTo(-14, wallTop); ctx.lineTo(w/2, wallTop-46); ctx.lineTo(w+14, wallTop);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#274a1c'; ctx.lineWidth = 1;
  for (let i=0;i<=7;i++){
    const t = i/7;
    ctx.beginPath(); ctx.moveTo(-14+(w+28)*t, wallTop-1); ctx.lineTo(w/2, wallTop-44); ctx.stroke();
  }
  ctx.fillStyle = '#5c7a3e'; ctx.fillRect(0, wallTop-6, w, 10); // viga do teto

  // trecho de parede antes da porta 1
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(0, wallTop, d1s, wallBottom-wallTop);
  // pilar sólido entre as duas portas
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(d1e, wallTop, d2s-d1e, wallBottom-wallTop);
  // trecho de parede depois da porta 2
  ctx.fillStyle = '#6b4a2e'; ctx.fillRect(d2e, wallTop, w-d2e, wallBottom-wallTop);

  // veios de madeira nas partes sólidas
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  for (let i=1;i<10;i++){
    const px = (w/10)*i;
    if (px < d1s || (px > d1e && px < d2s) || px > d2e){
      ctx.beginPath(); ctx.moveTo(px, wallTop+2); ctx.lineTo(px, wallBottom-2); ctx.stroke();
    }
  }

  // viga da base (chão interno)
  ctx.fillStyle = '#4a341e'; ctx.fillRect(0, wallBottom, w, 6);

  // as duas portas quebradas, penduradas tortas nas entradas
  drawBrokenDoor(d1s, wallTop, wallBottom, 1);
  drawBrokenDoor(d2e, wallTop, wallBottom, -1);

  // pedaços de tábua quebrada e cordas de sustentação subindo pro bambuzal
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath(); ctx.moveTo(w*0.9,wallTop+2); ctx.lineTo(w*0.99,wallTop-30); ctx.lineTo(w*0.93,wallTop+6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,54,30,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(w*0.04,wallTop-6); ctx.lineTo(0,wallTop-46); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w*0.96,wallTop-6); ctx.lineTo(w,wallTop-46); ctx.stroke();

  ctx.restore();
}

function drawPlatformShape(p){
  if (p.broken || p.type === 'interior') return; // casa de madeira / ruína central
  const theme = (MAPS[currentMapKey] && MAPS[currentMapKey].theme) || 'bamboo';

  if (p.type === 'bridge'){
    drawRopeBridge(p.x, p.y, p.w, 12);
  } else if (p.type === 'stone'){
    drawStonePlatform(p.x, p.y, p.w, p.h || 16);
  } else if (p.type === 'rope'){
    drawRopePlatform(p.x, p.y, p.w, p.h || 14);
  } else if (p.type === 'heli' || p.variant === 3 || p.variant === 5 || p.variant === 7){
    drawWoodCabin(p.x, p.y, p.w, 34);
  } else if (p.type === 'moving'){
    if (theme === 'ruins') drawStonePlatform(p.x, p.y, p.w, 14);
    else if (theme === 'night') drawRopePlatform(p.x, p.y, p.w, 14);
    else drawWoodPlank(p.x, p.y, p.w, 14);
    ctx.save();
    ctx.fillStyle = 'rgba(100,200,255,0.7)';
    ctx.font = '700 11px Rajdhani'; ctx.textAlign='center';
    ctx.fillText(p.moveAxis==='x' ? '↔' : '↕', p.x-camX + p.w/2, p.y-camY - 6);
    ctx.restore();
  } else if (p.type === 'falling'){
    if (theme === 'ruins') drawStonePlatform(p.x, p.y, p.w, 14);
    else if (theme === 'night') drawRopePlatform(p.x, p.y, p.w, 14);
    else drawWoodPlank(p.x, p.y, p.w, 14);
    if (p._stepped && !p.falling){
      ctx.save();
      ctx.fillStyle = 'rgba(255,80,40,0.85)';
      ctx.font = '700 12px Rajdhani'; ctx.textAlign='center';
      ctx.fillText('!', p.x-camX + p.w/2, p.y-camY - 6);
      ctx.restore();
    }
  } else {
    drawWoodPlank(p.x, p.y, p.w, 34);
  }
}

function drawPickup(pk){
  if (!pk.active) return;
  const sx = pk.x-camX;
  const bob = Math.sin(performance.now()/300 + pk.x)*3;
  ctx.save(); ctx.translate(sx, pk.y-camY+bob);
  if (pk.type === 'ammo'){
    // Caixa de munição 3D estilizada (estilo militar)
    const bw = pk.w + 4, bh = pk.h + 2;
    // sombra
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(bw/2, bh+3, bw*0.42, 3.5, 0, 0, Math.PI*2);
    ctx.fill();
    // corpo da caixa (verde oliva militar)
    ctx.fillStyle = '#4a5c28';
    ctx.fillRect(0, 2, bw, bh-2);
    // tampa / topo com leve 3D
    ctx.fillStyle = '#6a7e38';
    ctx.fillRect(0, 0, bw, 6);
    // highlight topo
    ctx.fillStyle = 'rgba(200,220,140,0.25)';
    ctx.fillRect(1, 1, bw-2, 3);
    // borda metal
    ctx.strokeStyle = '#2a3418';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, bw, bh);
    // faixa amarela diagonal / faixas de alerta
    ctx.fillStyle = '#e8c020';
    ctx.fillRect(2, 8, bw-4, 3.5);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(2, 11.5, bw-4, 1.2);
    // símbolo de munição (cartucho estilizado)
    ctx.fillStyle = '#c8a010';
    ctx.fillRect(bw*0.22, 14, 4, 7);
    ctx.fillRect(bw*0.42, 14, 4, 7);
    ctx.fillRect(bw*0.62, 14, 4, 7);
    // pontas dos cartuchos
    ctx.fillStyle = '#e8d080';
    ctx.beginPath(); ctx.arc(bw*0.22+2, 14, 2.2, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(bw*0.42+2, 14, 2.2, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.arc(bw*0.62+2, 14, 2.2, Math.PI, 0); ctx.fill();
    // trava / fecho metálico
    ctx.fillStyle = '#8a9a60';
    ctx.fillRect(bw*0.38, -2, bw*0.24, 4);
    ctx.fillStyle = '#3a4020';
    ctx.fillRect(bw*0.42, -1, bw*0.16, 2);
  } else {
    // kit de vida (cruz médica em caixa)
    const bw = pk.w + 2, bh = pk.h + 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(bw/2, bh+3, bw*0.4, 3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(0, 0, bw, bh);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(1, 1, bw-2, bh*0.35);
    ctx.strokeStyle = '#7a1f14';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, bw, bh);
    // cruz branca
    ctx.fillStyle = '#fff';
    ctx.fillRect(bw*0.38, 4, bw*0.24, bh-8);
    ctx.fillRect(4, bh*0.35, bw-8, bh*0.28);
  }
  ctx.restore();
}

function drawHealthBar(x,y,w,h,hp,maxHp,color){
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x-1,y-1,w+2,h+2);
  ctx.fillStyle = '#222'; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = color; ctx.fillRect(x,y, w*Math.max(0,hp/maxHp), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(x,y,w,h);
}

// ======== SPRITES PROCEDURAIS ========
// Desenha um soldado estilizado (jogador / aliado / inimigo)
// opts: { color, facing, crouch, climbing, hitFlash, invuln, isEnemy, clsKey, weaponAng, scale, isBoss }
function drawSoldierSprite(ox, oy, opts){
  const {
    color = '#4CAF50',
    facing = 1,
    crouch = false,
    climbing = false,
    hitFlash = 0,
    invuln = false,
    isEnemy = false,
    clsKey = '',
    weaponAng = 0,
    scale = 1,
    isBoss = false,
    isMiniBoss = false,
    moving = false,
    onGround = true,
    weaponSlot = 'primary',
    firing = false,
  } = opts;

  const t = performance.now();
  const s = scale;
  const flash = hitFlash > 0;
  const bodyCol = flash ? '#ffffff' : color;
  const darkCol = flash ? '#dddddd' : shadeColor(color, -35);
  const skinCol = flash ? '#fff' : '#e0b088';
  const bootCol = flash ? '#ccc' : (isEnemy ? '#1a1208' : '#2a2a2a');
  const pantCol = flash ? '#bbb' : (isEnemy ? '#3d2a1a' : '#3a3a45');

  // sombra (encolhe no ar)
  {
    const shadowScale = onGround && !climbing ? 1 : 0.45;
    ctx.save();
    ctx.globalAlpha = onGround && !climbing ? 0.32 : 0.12;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(ox, oy + 44 * s, 14 * s * shadowScale, 4.5 * s * shadowScale, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(facing < 0 ? -s : s, s);
  ctx.translate(-15, 0);

  let alpha = 1;
  if (invuln) alpha = 0.55 + Math.sin(t/60)*0.25;
  if (flash) alpha = 0.45 + Math.sin(t/28)*0.45;
  ctx.globalAlpha = alpha;

  const crouchMul = crouch ? 0.72 : 1;
  // idle breathe + walk bob + jump tuck
  const idleBob = (!moving && onGround && !climbing) ? Math.sin(t / 320) * 0.8 : 0;
  const walkPhase = (moving && onGround && !climbing) ? t / 78 : 0;
  const walk = Math.sin(walkPhase);
  const walkBob = (moving && onGround && !climbing) ? Math.abs(Math.sin(walkPhase)) * 1.6 : 0;
  const inAir = !onGround && !climbing;
  const bodyYOff = idleBob - walkBob + (inAir ? -2 : 0) + (crouch ? 2 : 0);

  const bodyH = 22 * crouchMul;
  const legBase = 28 * crouchMul;

  // --- pernas com rotação (bem mais legível) ---
  const legAngL = inAir ? 0.55 : (climbing ? Math.sin(t/120)*0.35 : walk * 0.55);
  const legAngR = inAir ? -0.45 : (climbing ? -Math.sin(t/120)*0.35 : -walk * 0.55);

  function drawLeg(hipX, hipY, ang){
    ctx.save();
    ctx.translate(hipX, hipY);
    ctx.rotate(ang);
    // calça
    ctx.fillStyle = pantCol;
    roundRect(-3.5, 0, 7, 13, 2);
    // bota
    ctx.fillStyle = bootCol;
    roundRect(-4.5, 11, 10, 5, 1.5);
    // sola
    ctx.fillStyle = shadeColor(bootCol, -25);
    ctx.fillRect(-4.5, 14.5, 10, 1.5);
    ctx.restore();
  }
  drawLeg(12, legBase - 1 + bodyYOff * 0.3, legAngL);
  drawLeg(20, legBase - 1 + bodyYOff * 0.3, legAngR);

  // --- tronco / colete com contorno ---
  ctx.save();
  ctx.translate(0, bodyYOff);
  // sombra interna do corpo
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(1, 10, 30, bodyH, 3);
  ctx.fillStyle = bodyCol;
  roundRect(-1, 8, 32, bodyH, 3);
  // highlight ombro
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(1, 9, 28, 3);
  // faixa / colete
  ctx.fillStyle = darkCol;
  ctx.fillRect(2, 12, 26, 4);
  // bolsos
  ctx.fillStyle = shadeColor(color, -20);
  ctx.fillRect(4, 18, 8, 6);
  ctx.fillRect(18, 18, 8, 6);
  // costura dos bolsos
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(4.5, 18.5, 7, 5);
  ctx.strokeRect(18.5, 18.5, 7, 5);
  ctx.restore();

  // --- braços ---
  const armY = 12 + bodyYOff;
  let localAng = weaponAng;
  localAng = Math.max(-2.35, Math.min(2.35, localAng));
  // recuo leve ao atirar
  const recoil = firing ? -0.12 : 0;

  // braço da arma
  ctx.save();
  ctx.translate(26, armY + 4);
  ctx.rotate(localAng * 0.92 + recoil);
  ctx.fillStyle = bodyCol;
  roundRect(0, -3.2, 14, 6.4, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, 0.5, 14, 2.5);
  ctx.fillStyle = skinCol;
  ctx.beginPath(); ctx.arc(14, 0, 3.6, 0, Math.PI*2); ctx.fill();
  // luva / contorno da mão
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(14, 0, 3.6, 0, Math.PI*2); ctx.stroke();
  ctx.restore();

  // braço de trás (balança no walk)
  const backArmSwing = (moving && onGround) ? walk * 0.35 : Math.sin(t/400)*0.08;
  ctx.save();
  ctx.translate(5, armY + 2);
  ctx.rotate(0.15 + backArmSwing);
  ctx.fillStyle = bodyCol;
  roundRect(-2, 0, 6, 12, 2);
  ctx.fillStyle = skinCol;
  ctx.beginPath(); ctx.arc(1, 12, 3.2, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // --- cabeça (com bob) ---
  const headBob = (moving && onGround) ? walk * 0.8 : idleBob * 0.5;
  const headY = (crouch ? 4 : 2) + bodyYOff + headBob;
  // pescoço
  ctx.fillStyle = skinCol;
  ctx.fillRect(13, headY + 10, 5, 4);
  // cabeça
  ctx.fillStyle = skinCol;
  ctx.beginPath(); ctx.arc(15, headY + 6, 8.8, 0, Math.PI*2); ctx.fill();
  // sombra na bochecha
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(12, headY + 8, 3, 4, 0, 0, Math.PI*2); ctx.fill();

  drawHelmet(15, headY, color, clsKey, isEnemy, isBoss, isMiniBoss, flash);

  // olho
  if (!flash){
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(18.2, headY + 5.2, 1.7, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(18.7, headY + 4.7, 0.65, 0, Math.PI*2); ctx.fill();
    // sobrancelha
    ctx.strokeStyle = 'rgba(40,25,15,0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16.5, headY + 3.2);
    ctx.lineTo(20, headY + 2.8);
    ctx.stroke();
  }

  drawClassBodyDetails(clsKey, color, isEnemy, flash, crouchMul);

  // --- arma ---
  ctx.save();
  ctx.translate(26, armY + 4);
  ctx.rotate(localAng + recoil);
  drawWeapon(0, 0, clsKey, isEnemy, weaponSlot, firing);
  ctx.restore();

  // detalhes extras por classe (inimigo)
  if (isEnemy && clsKey === 'grenadeiro'){
    // granada na cintura
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(6, 24, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(4, 20, 4, 3);
  }
  if (isEnemy && (isBoss || isMiniBoss)){
    // ombreiras
    ctx.fillStyle = darkCol;
    ctx.fillRect(-4, 10, 8, 6);
    ctx.fillRect(26, 10, 8, 6);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function shadeColor(hex, percent){
  // simples darken/lighten
  const num = parseInt(hex.replace('#',''), 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0x00FF) + percent;
  let b = (num & 0x0000FF) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + (0x1000000 + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

function roundRect(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fill();
}

function drawClassBodyDetails(clsKey, color, isEnemy, flash, crouchMul){
  if (flash || isEnemy) return;
  const dark = shadeColor(color, -30);
  // faixa / insignia única por classe no peito
  if (clsKey === 'medico'){
    ctx.fillStyle = '#fff';
    ctx.fillRect(12, 14, 6, 2);
    ctx.fillRect(14, 12, 2, 6);
  } else if (clsKey === 'assassino'){
    ctx.fillStyle = dark;
    ctx.fillRect(4, 11, 22, 3);
    ctx.fillStyle = '#d488ff';
    ctx.fillRect(13, 11, 4, 3);
  } else if (clsKey === 'metralhador'){
    ctx.fillStyle = '#333';
    ctx.fillRect(6, 16, 18, 5);
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(8, 17, 4, 3);
  } else if (clsKey === 'general'){
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(15, 12); ctx.lineTo(17, 16); ctx.lineTo(13, 16);
    ctx.closePath(); ctx.fill();
  } else if (clsKey === 'engenheiro'){
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(11, 14, 8, 3);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
    ctx.strokeRect(11, 14, 8, 3);
  } else if (clsKey === 'cacador'){
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(5, 15, 20, 4);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(7, 16, 4, 2);
  } else if (clsKey === 'demolidor'){
    ctx.fillStyle = '#bf360c';
    ctx.fillRect(6, 15, 18, 5);
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(12, 16, 6, 3);
  } else if (clsKey === 'lancachamas'){
    ctx.fillStyle = '#e65100';
    ctx.fillRect(5, 14, 20, 5);
    ctx.fillStyle = '#ffab00';
    ctx.fillRect(8, 15, 5, 3);
  }
}

function drawHelmet(cx, cy, color, clsKey, isEnemy, isBoss, isMiniBoss, flash){
  const c = flash ? '#eee' : color;
  const dark = flash ? '#ccc' : shadeColor(color, -40);

  if (isBoss){
    ctx.fillStyle = flash ? '#555' : '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 11, 8, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = flash ? '#888' : '#333';
    ctx.fillRect(cx-10, cy+1, 20, 5);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(cx-6, cy+2, 12, 3);
    return;
  }
  if (isMiniBoss){
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10, 7.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath(); ctx.arc(cx, cy-2, 2.5, 0, Math.PI*2); ctx.fill();
    return;
  }
  // ---- classes do jogador / aliados ----
  if (clsKey === 'medico'){
    // capacete médico + cruz branca grande
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 9.8, 7.2, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx-1.8, cy-4, 3.6, 9);
    ctx.fillRect(cx-4.5, cy-0.8, 9, 3.2);
    ctx.fillStyle = dark;
    ctx.fillRect(cx-9, cy+2, 18, 3);
    return;
  }
  if (clsKey === 'assassino'){
    // capuz / boina roxa com sombra
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10, 6.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-10, cy+1, 20, 4);
    // aba lateral
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(cx+8, cy+2); ctx.lineTo(cx+14, cy+5); ctx.lineTo(cx+8, cy+6);
    ctx.closePath(); ctx.fill();
    return;
  }
  if (clsKey === 'metralhador'){
    // capacete pesado largo com viseira
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 11, 7.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-11, cy+2, 22, 5);
    ctx.fillStyle = '#222';
    ctx.fillRect(cx-7, cy+3, 14, 2.5);
    return;
  }
  if (clsKey === 'general'){
    // quepe militar com estrela
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+2, 9.5, 5.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-10, cy+2, 20, 3.5);
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(cx, cy-2); ctx.lineTo(cx+2.2, cy+1.5); ctx.lineTo(cx-2.2, cy+1.5);
    ctx.closePath(); ctx.fill();
    return;
  }
  if (clsKey === 'engenheiro'){
    // capacete de obra + antena
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-10, cy+2, 20, 3.5);
    ctx.strokeStyle = '#ffcc33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx+7, cy-1); ctx.lineTo(cx+12, cy-11); ctx.stroke();
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath(); ctx.arc(cx+12, cy-11, 2.5, 0, Math.PI*2); ctx.fill();
    return;
  }
  if (clsKey === 'cacador'){
    // chapéu de caçador com aba larga
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+2, 10.5, 5.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-11, cy+2, 22, 3);
    ctx.fillStyle = shadeColor(color, -20);
    ctx.fillRect(cx-13, cy+4, 26, 2.5);
    return;
  }
  if (clsKey === 'demolidor'){
    // capacete reforçado laranja
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10.5, 7.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-11, cy+2, 22, 4);
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(cx-4, cy-1, 8, 3);
    return;
  }
  if (clsKey === 'lancachamas'){
    // máscara / capacete com respirador
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-10, cy+2, 20, 4);
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(cx+4, cy+5, 3.5, 0, Math.PI*2); ctx.fill();
    return;
  }
  // inimigos
  if (clsKey === 'sniper'){
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+2, 9, 5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-9, cy+1, 18, 3);
    return;
  }
  if (clsKey === 'pesado'){
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+1, 10.5, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-10, cy+2, 20, 4);
    return;
  }
  if (clsKey === 'grenadeiro'){
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+2, 9, 6, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx+3, cy+5, 3, 0, Math.PI*2); ctx.stroke();
    return;
  }
  if (clsKey === 'batedor'){
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(cx, cy+2, 9, 5.5, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(cx-9, cy+2, 18, 3);
    return;
  }
  // padrão soldado
  ctx.fillStyle = c;
  ctx.beginPath(); ctx.ellipse(cx, cy+1, 9.5, 7, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = dark;
  ctx.fillRect(cx-9, cy+2, 18, 3.5);
}

function drawWeaponSpriteSheet(key, frame, drawX, drawY, scale){
  const sheet = WEAPON_SHEETS[key];
  const img = weaponImages[key];
  if (!sheet || !img || !img.complete || !img.naturalWidth) return false;
  const fw = Math.floor(sheet.w / sheet.frames);
  const fh = sheet.h;
  const fr = Math.max(0, Math.min(sheet.frames - 1, frame|0));
  const sx = fr * fw;
  const dw = fw * scale;
  const dh = fh * scale;
  const prevSmooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx, 0, fw, fh, drawX, drawY - dh * 0.55, dw, dh);
  ctx.imageSmoothingEnabled = prevSmooth;
  return true;
}

function drawWeapon(x, y, clsKey, isEnemy, weaponSlot, firing){
  ctx.save();
  ctx.translate(x, y);

  const slot = weaponSlot || 'primary';
  const resolved = resolveWeaponSprite(clsKey, slot);
  const key = resolved.key;
  const scale = resolved.scale || 1.5;

  let frame = 0;
  if (firing) frame = 1 + (Math.floor(performance.now() / 40) % 2);

  const drawn = drawWeaponSpriteSheet(key, frame, 2, 0, scale);

  if (drawn && clsKey === 'general' && slot === 'primary'){
    ctx.save();
    ctx.translate(2, 5);
    ctx.rotate(0.12);
    drawWeaponSpriteSheet('revolver', frame, 0, 0, scale * 0.92);
    ctx.restore();
  }

  if (!drawn){
    ctx.fillStyle = isEnemy ? '#2c2c2c' : '#1a1a1a';
    ctx.fillRect(0, -2.5, 20, 5);
    ctx.fillStyle = '#111';
    ctx.fillRect(16, -3.5, 8, 7);
  }

  if (clsKey === 'lancachamas' && slot === 'primary'){
    const t = performance.now();
    const flicker = 0.7 + Math.sin(t / 30) * 0.3;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = '#ffab00';
    ctx.beginPath();
    ctx.moveTo(28, 0); ctx.lineTo(36, -5); ctx.lineTo(34, 0); ctx.lineTo(36, 5);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4400';
    ctx.beginPath();
    ctx.moveTo(28, 0); ctx.lineTo(33, -2.5); ctx.lineTo(32, 0); ctx.lineTo(33, 2.5);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawPlayer(){
  const sx = player.x - camX;
  const sy = player.y - camY;
  const crouch = player.crouching;
  const yOff = crouch ? player.h * 0.28 : 0;

  // Ability ready glow
  if (player.abilityReady && !player.abilityActive){
    ctx.save();
    ctx.globalAlpha = 0.4 + Math.sin(performance.now()/180)*0.3;
    ctx.strokeStyle = '#4dd0e1';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#4dd0e1';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(sx+player.w/2, sy + player.h/2, player.w*1.2, player.h*0.9, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }

  const worldMouseX = mouse.x + camX;
  const worldMouseY = mouse.y + camY;
  const cx = player.x + player.w/2;
  const cy = player.y + player.h/2 - 4;
  const dx = worldMouseX - cx;
  const dy = worldMouseY - cy;
  // personagem inteiro vira para o lado da mira
  const facing = dx >= 0 ? 1 : -1;
  // ângulo local: 0 = frente do personagem, independente do lado
  const localAim = Math.atan2(dy, Math.abs(dx) < 0.01 ? 0.01 : Math.abs(dx));

  drawSoldierSprite(sx + player.w/2, sy + yOff, {
    color: player.c.color,
    facing,
    crouch,
    climbing: player.climbing,
    hitFlash: player.hitFlash || 0,
    invuln: player.invulnerable,
    isEnemy: false,
    clsKey: player.classKey,
    weaponAng: localAim,
    scale: 1,
    moving: Math.abs(player.vx) > 0.4,
    onGround: player.onGround,
    weaponSlot: player.currentWeapon || 'primary',
    firing: (() => {
      const w = player.c[player.currentWeapon];
      const maxCd = (w.fireRate || 200) * (player.fireRateMul || 1);
      return player.cooldown > maxCd - 100;
    })(),
  });

  drawHealthBar(sx-2, sy-16, player.w+4, 6, player.health, player.maxHealth, '#4CAF50');

  if (player.shield > 0){
    ctx.save();
    ctx.globalAlpha = 0.45 + Math.sin(performance.now()/150)*0.15;
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(sx+player.w/2, sy+player.h/2, player.w*0.95, player.h*0.75, 0, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
    drawHealthBar(sx-2, sy-24, player.w+4, 5, player.shield, player.shieldMax, '#4fc3f7');
  }

  if (player.climbing){
    ctx.fillStyle = 'rgba(120,220,255,0.9)'; ctx.font = '700 13px Rajdhani'; ctx.textAlign='center';
    ctx.fillText('⬆ ESCADA', sx+player.w/2, sy-30);
    ctx.textAlign='left';
  } else if (player.crouching){
    ctx.fillStyle = 'rgba(255,220,100,0.85)'; ctx.font = '700 12px Rajdhani'; ctx.textAlign='center';
    ctx.fillText('⬇ AGACHADO', sx+player.w/2, sy-30);
    ctx.textAlign='left';
  }
}

function drawEnemy(en){
  const sx = en.x - camX;
  const sy = en.y - camY;

  let facing = en.vx >= 0 ? 1 : -1;
  let localAim = 0;
  const target = pickTargetFor(en);
  if (target){
    const dx = (target.x + target.w/2) - (en.x + en.w/2);
    const dy = (target.y + target.h/2) - (en.y + en.h/2);
    facing = dx >= 0 ? 1 : -1;
    localAim = Math.atan2(dy, Math.abs(dx) < 0.01 ? 0.01 : Math.abs(dx));
  }

  const scale = en.isBoss ? 1.55 : (en.isMiniBoss ? 1.2 : 1);

  drawSoldierSprite(sx + en.w/2, sy, {
    color: en.cls.color,
    facing,
    crouch: false,
    climbing: !!en.climbing,
    hitFlash: en.hitFlash || 0,
    invuln: false,
    isEnemy: true,
    clsKey: en.clsKey,
    weaponAng: localAim,
    scale,
    isBoss: !!en.isBoss,
    isMiniBoss: !!en.isMiniBoss,
    moving: Math.abs(en.vx) > 0.3,
    onGround: en.onGround,
    weaponSlot: 'primary',
    firing: (en.fireCooldown || 0) > ((en.cls && en.cls.fireRate) || 400) - 120,
  });

  const barW = en.w + (en.isBoss ? 20 : 4);
  drawHealthBar(sx + en.w/2 - barW/2, sy - 18 - (en.isBoss?6:0), barW, en.isBoss?7:5, en.health, en.maxHealth, '#ff5555');

  ctx.fillStyle = en.isMiniBoss || en.isBoss ? '#ffcc33' : 'rgba(255,255,255,0.85)';
  ctx.font = (en.isBoss ? '700 14px' : en.isMiniBoss ? '700 12px' : '600 11px') + ' Rajdhani';
  ctx.textAlign = 'center';
  ctx.fillText(en.cls.name, sx + en.w/2 + (en.nameOffsetX||0), sy - 22 - (en.isBoss?8:0));
  ctx.textAlign = 'left';

  if (en.abilityFlash > 0){
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(performance.now()/40)*0.3;
    ctx.strokeStyle = '#ff66ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(sx + en.w/2, sy + en.h/2, 22 * scale, 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawAlly(al){
  const sx = al.x - camX;
  const sy = al.y - camY;

  let facing = al.facing || 1;
  let localAim = 0;
  const target = pickNearestEnemy(al);
  if (target){
    const dx = (target.x + target.w/2) - (al.x + al.w/2);
    const dy = (target.y + target.h/2) - (al.y + al.h/2);
    facing = dx >= 0 ? 1 : -1;
    localAim = Math.atan2(dy, Math.abs(dx) < 0.01 ? 0.01 : Math.abs(dx));
  }

  // anel de aliado
  ctx.save();
  ctx.strokeStyle = 'rgba(90,220,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx + al.w/2, sy + 8, 13, 0, Math.PI*2);
  ctx.stroke();
  ctx.restore();

  drawSoldierSprite(sx + al.w/2, sy, {
    color: al.c.color,
    facing,
    crouch: false,
    climbing: false,
    hitFlash: al.hitFlash || 0,
    invuln: al.invulnerable,
    isEnemy: false,
    clsKey: al.classKey,
    weaponAng: localAim,
    scale: 1,
    moving: Math.abs(al.vx) > 0.3,
    onGround: al.onGround,
    weaponSlot: al.currentWeapon || 'primary',
    firing: (() => {
      const slot = al.currentWeapon || 'primary';
      const w = al.c && al.c[slot];
      const maxCd = (w && w.fireRate) || 200;
      return (al.cooldown || 0) > maxCd - 100;
    })(),
  });

  drawHealthBar(sx-2, sy-16, al.w+4, 5, al.health, al.maxHealth, '#5ad1ff');
  if (al.shield > 0) drawHealthBar(sx-2, sy-23, al.w+4, 4, al.shield, al.shieldMax, '#4fc3f7');

  ctx.fillStyle = 'rgba(160,230,255,0.95)';
  ctx.font = '600 11px Rajdhani';
  ctx.textAlign = 'center';
  ctx.fillText('🤝 '+al.c.name, sx+al.w/2+(al.nameOffsetX||0), sy-28);
  ctx.textAlign = 'left';

  if (al.abilityReady){
    ctx.save();
    ctx.globalAlpha = 0.7 + Math.sin(performance.now()/150)*0.3;
    ctx.fillStyle = '#4dd0e1';
    ctx.font = '700 14px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText('⚡', sx+al.w/2, sy-40);
    ctx.textAlign = 'left';
    ctx.restore();
  }
}

function drawTurret(){
  if (!turret) return;
  const sx = turret.x - camX;
  const sy = turret.y - camY;
  const t = performance.now();

  // base
  ctx.fillStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.ellipse(sx, sy+2, 16, 6, 0, 0, Math.PI*2);
  ctx.fill();

  // corpo principal
  ctx.fillStyle = turret.damageMul > 1 ? '#ff8f1f' : '#FFC107';
  roundRect(sx-14, sy-32, 28, 30, 4);

  // detalhe de metal
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(sx-10, sy-28, 20, 4);
  ctx.fillRect(sx-8, sy-18, 16, 8);

  // canhão
  let ang = -Math.PI/2;
  let target = null, best = Infinity;
  for (const en of enemies){
    if (en.dead) continue;
    const d = Math.abs(en.x - turret.x);
    if (d < turret.range && d < best){ best = d; target = en; }
  }
  if (target){
    ang = Math.atan2((target.y+target.h/2) - (turret.y-20), (target.x+target.w/2) - turret.x);
  }
  ctx.save();
  ctx.translate(sx, sy-20);
  ctx.rotate(ang);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, -4, 22, 8);
  ctx.fillStyle = '#444';
  ctx.fillRect(18, -5, 6, 10);
  ctx.restore();

  // LED piscando
  ctx.fillStyle = Math.sin(t/200) > 0 ? '#0f0' : '#050';
  ctx.beginPath(); ctx.arc(sx+8, sy-26, 2.5, 0, Math.PI*2); ctx.fill();

  // barra de vida da torre
  drawHealthBar(sx-16, sy-42, 32, 4, turret.health, turret.maxHealth, '#FFC107');
}

function drawMapTower(){
  if (!mapTower) return;
  const sx = mapTower.x - camX;
  const sy = mapTower.y - camY;

  // poste duplo de bambu
  ctx.strokeStyle = '#5c7a3e';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(sx-12, sy); ctx.lineTo(sx-12, sy+48); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx+12, sy); ctx.lineTo(sx+12, sy+48); ctx.stroke();
  // travessas
  ctx.strokeStyle = '#3f5c28';
  ctx.lineWidth = 3;
  for (let i=0;i<4;i++){
    const yy = sy + 8 + i*12;
    ctx.beginPath(); ctx.moveTo(sx-12, yy); ctx.lineTo(sx+12, yy-6); ctx.stroke();
  }

  // cabine
  ctx.fillStyle = '#6b4a2e';
  roundRect(sx-24, sy-44, 48, 40, 3);
  ctx.strokeStyle = '#3a2410';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(sx-24, sy-44, 48, 40);

  // janelas
  ctx.fillStyle = 'rgba(255,220,120,0.7)';
  ctx.fillRect(sx-16, sy-36, 10, 10);
  ctx.fillRect(sx+6, sy-36, 10, 10);

  // telhado
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.moveTo(sx-30, sy-44);
  ctx.lineTo(sx, sy-72);
  ctx.lineTo(sx+30, sy-44);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#7a2010';
  ctx.lineWidth = 1;
  ctx.stroke();

  // canhão
  let target=null, best=Infinity;
  for (const en of enemies){
    if (en.dead) continue;
    const d = Math.hypot(en.x-mapTower.x, en.y-mapTower.y);
    if (d < mapTower.range && d < best){ best=d; target=en; }
  }
  let ang = 0;
  if (target) ang = Math.atan2((target.y+target.h/2)-mapTower.y, (target.x+target.w/2)-mapTower.x);

  ctx.save();
  ctx.translate(sx, sy-24);
  ctx.rotate(ang);
  ctx.fillStyle = '#222';
  ctx.fillRect(0, -5, 26, 10);
  ctx.fillStyle = '#555';
  ctx.fillRect(22, -6, 8, 12);
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawDrone(){
  if (!drone) return;
  const sx = drone.x - camX;
  const sy = drone.y - camY;
  const t = performance.now();
  const spin = t / 40;

  ctx.save();
  ctx.translate(sx, sy);

  // hélices (blur)
  ctx.strokeStyle = 'rgba(180,240,255,0.35)';
  ctx.lineWidth = 2;
  for (let i=0;i<4;i++){
    const a = spin + i * Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a)*4, Math.sin(a)*4);
    ctx.lineTo(Math.cos(a)*18, Math.sin(a)*18);
    ctx.stroke();
  }

  // corpo
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.fillStyle = '#4dd0e1';
  ctx.beginPath();
  ctx.ellipse(0, -2, 9, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // olho / sensor
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(0, 1, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#0f0';
  ctx.beginPath(); ctx.arc(0.5, 0.5, 1.5, 0, Math.PI*2); ctx.fill();

  // brilho
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-4, -3, 4, 2, -0.4, 0, Math.PI*2);
  ctx.fill();

  ctx.restore();
}

function drawBullets(){
  for (const b of bullets){
    const sx = b.x - camX, sy = b.y - camY;
    // garante anim se a bala foi criada antes do sistema de sprites
    if (!b.anim){
      initBulletAnim(b, pickBulletAnim({
        owner: b.owner, flame: !!b.flame, explosive: !!b.explosive, big: !!b.big,
      }));
    }
    if (!drawBulletSprite(b, sx, sy)){
      // fallback círculos se a sheet não carregou
      if (b.big){
        ctx.fillStyle = b.owner==='enemy' ? '#ff6b6b' : '#ffe066';
        ctx.beginPath(); ctx.arc(sx, sy, 5.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx, sy, 2.5, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.fillStyle = b.owner==='player' ? '#ffeb3b' : (b.owner==='ally' ? '#8fffb0' : '#ff3d3d');
        ctx.beginPath(); ctx.arc(sx, sy, 3.2, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.beginPath(); ctx.arc(sx - b.vx*0.4, sy - b.vy*0.4, 2, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

function drawParticles(){
  for (const p of particles){
    ctx.globalAlpha = Math.max(0, p.life/500);
    ctx.fillStyle = p.color;
    const s = p.size || 3;
    ctx.fillRect(p.x-camX - s/2, p.y-camY - s/2, s, s);
    ctx.globalAlpha = 1;
  }
}

function drawRagdoll(r){
  for (const p of r.parts){
    ctx.save();
    ctx.translate(p.x-camX+p.w/2, p.y-camY+p.h/2);
    ctx.rotate(p.rot);
    ctx.globalAlpha = 0.95;
    if (p.isHead){ ctx.fillStyle = '#e0b088'; ctx.beginPath(); ctx.arc(0,0,p.w/2,0,Math.PI*2); ctx.fill(); }
    else { ctx.fillStyle = p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

function drawHUD(){
  // painel principal
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(10,10,250,86);
  ctx.fillStyle = player.c.color; ctx.font = '700 16px Rajdhani';
  ctx.fillText(player.c.name, 20, 28);
  drawHealthBar(20,34,226,13, player.health, player.maxHealth, '#4CAF50');

  // dicas canto inferior direito — texto sólido
  ctx.fillStyle = '#eeeeee'; ctx.font = '600 13px Rajdhani'; ctx.textAlign='right';
  ctx.fillText(audioMuted ? '🔇 M' : '🔊 M', canvas.width-12, canvas.height-12);
  ctx.fillText('ESC pausar', canvas.width-12, canvas.height-28);
  ctx.textAlign='left';

  const w = player.c[player.currentWeapon];
  const otherKey = player.currentWeapon==='primary' ? 'secondary':'primary';
  const wOther = player.c[otherKey];
  ctx.fillStyle = '#ffdd44'; ctx.font = '700 14px Rajdhani';
  const ammoTxt = player.infiniteAmmo ? '∞' : (w.maxAmmo===Infinity ? '∞' : player.ammo[player.currentWeapon]+'/'+w.maxAmmo);
  ctx.fillText('▶ '+w.name+': '+ammoTxt, 20, 64);
  // arma secundária — branco sólido e legível
  ctx.fillStyle = '#ffffff'; ctx.font = '600 12px Rajdhani';
  const otherAmmoTxt = wOther.maxAmmo===Infinity ? '∞' : player.ammo[otherKey]+'/'+wOther.maxAmmo;
  ctx.fillText('  '+wOther.name+': '+otherAmmoTxt+'  (Q)', 20, 80);

  // recurso E
  const eReady = player.activeCooldownTimer <= 0;
  const eCdPct = eReady ? 1 : Math.max(0, 1 - player.activeCooldownTimer/player.c.active.cooldown);
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(10,102,250,20);
  ctx.fillStyle = eReady ? '#7ee787' : '#444';
  ctx.fillRect(12,104, 246*eCdPct, 16);
  ctx.strokeStyle = eReady ? '#9f9' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = eReady ? 2 : 1;
  ctx.strokeRect(10,102,250,20);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 13px Rajdhani'; ctx.textAlign='center';
  ctx.fillText(eReady ? ('🛠️ '+player.c.active.name+'  [E]') : ('🛠️ '+Math.ceil(player.activeCooldownTimer/1000)+'s'), 135, 116);
  ctx.textAlign='left';

  // habilidade F
  const streakPct = Math.min(1, player.killStreak/player.c.ability.streakNeeded);
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(10,126,250,22);
  ctx.fillStyle = player.abilityReady ? '#4dd0e1' : '#444';
  ctx.fillRect(12,128, 246*streakPct, 18);
  ctx.strokeStyle = player.abilityReady ? '#6ef' : 'rgba(0,0,0,0.5)'; ctx.lineWidth = player.abilityReady ? 2 : 1;
  ctx.strokeRect(10,126,250,22);
  ctx.fillStyle = '#ffffff'; ctx.font = '700 13px Rajdhani'; ctx.textAlign='center';
  ctx.fillText(player.abilityReady ? ('⚡ '+player.c.ability.name+'  [F]') : ('⚡ '+player.killStreak+'/'+player.c.ability.streakNeeded), 135, 142);
  ctx.textAlign='left';

  // pontos / onda / dinheiro
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(canvas.width-186,10,176,70);
  ctx.fillStyle = '#ffcc33'; ctx.font = '700 17px Rajdhani';
  ctx.fillText('Pontos: '+score, canvas.width-18, 28);
  ctx.fillStyle = '#88ddff'; ctx.font = '700 15px Rajdhani';
  ctx.fillText('Onda: '+wave+(wave>=BOSS_WAVE?' (BOSS)':''), canvas.width-18, 48);
  ctx.fillStyle = '#8f8'; ctx.font = '700 15px Rajdhani';
  ctx.fillText('$'+money, canvas.width-18, 68);
  ctx.textAlign = 'left';

  // aliados — fundo escuro pra não sumir no bambuzal
  const aliveAllies = allies.filter(a=>!a.dead).length;
  const allyTxt = '🤝 Aliados: '+aliveAllies+'/'+allies.length;
  ctx.font = '700 13px Rajdhani';
  const allyW = ctx.measureText(allyTxt).width + 14;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(10, 154, allyW, 20);
  ctx.fillStyle = '#7ef0ff';
  ctx.fillText(allyTxt, 16, 168);

  if (notif.timer > 0){
    ctx.textAlign='center'; ctx.globalAlpha = Math.min(1, notif.timer/300);
    ctx.font = '700 26px Rajdhani'; ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4;
    ctx.strokeText(notif.text, canvas.width/2, 90); ctx.fillText(notif.text, canvas.width/2, 90);
    ctx.globalAlpha = 1; ctx.textAlign='left';
  }

  if (player.c.turret && !turret && player.alive && player.activeCooldownTimer <= 0){
    const tip = 'Pressione E para construir uma torre';
    ctx.font = '700 13px Rajdhani';
    const tipW = ctx.measureText(tip).width + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(10, 178, tipW, 20);
    ctx.fillStyle = '#ffe066';
    ctx.fillText(tip, 16, 192);
  }
}

function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Screen shake
  const shakeX = screenShake > 0 ? (Math.random()-0.5)*screenShake*2 : 0;
  const shakeY = screenShake > 0 ? (Math.random()-0.5)*screenShake*2 : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawMapBackground();
  drawLeaves();
  drawAmbient();
  if (currentMapKey === 'bambuzal'){
    drawCentralTowerStructure();
    drawTreehouse();
  }
  for (const p of platforms) drawPlatformShape(p);
  for (const l of ladders) drawLadder(l);
  // ruínas: desenha pilares da ruína central se houver broken
  if (currentMapKey === 'ruinas'){
    for (const p of platforms){
      if (p.broken){
        ctx.save();
        ctx.fillStyle = '#6a5a40';
        ctx.fillRect(p.x-camX, p.y-camY-80, 30, 80);
        ctx.fillRect(p.x-camX+p.w-30, p.y-camY-80, 30, 80);
        ctx.fillStyle = '#8a7a55';
        ctx.fillRect(p.x-camX-8, p.y-camY-92, 46, 14);
        ctx.fillRect(p.x-camX+p.w-38, p.y-camY-92, 46, 14);
        ctx.restore();
      }
    }
  }
  drawTurret();
  drawMapTower();
  drawDrone();
  for (const en of enemies) if (!en.dead) drawEnemy(en);
  for (const al of allies) if (!al.dead) drawAlly(al);
  for (const pk of pickups) drawPickup(pk);
  // grenades
  for (const g of grenades){
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(g.x-camX, g.y-camY, 6, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath(); ctx.arc(g.x-camX, g.y-camY-3, 2.5, 0, Math.PI*2); ctx.fill();
  }
  drawBullets();
  // muzzle flashes
  for (const mf of muzzleFlashes){
    const alpha = mf.life / 60;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff8c0';
    ctx.beginPath();
    ctx.arc(mf.x-camX, mf.y-camY, 8+ (1-alpha)*6, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(mf.x-camX, mf.y-camY, 4, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  drawParticles();
  for (const r of ragdolls) drawRagdoll(r);
  if (player.alive) drawPlayer();
  // floating damage numbers
  for (const ft of floatingTexts){
    ctx.save();
    ctx.globalAlpha = Math.min(1, ft.life/250);
    ctx.font = `700 ${ft.size||14}px Rajdhani`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(ft.text, ft.x-camX, ft.y-camY);
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x-camX, ft.y-camY);
    ctx.restore();
  }
  // falas dos aliados
  for (const sp of allySpeeches){
    const sx = sp.x - camX, sy = sp.y - camY;
    ctx.save();
    ctx.globalAlpha = Math.min(1, sp.life/400);
    ctx.font = '700 12px Rajdhani';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(sp.text).width + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(sx - tw/2, sy - 14, tw, 18);
    ctx.strokeStyle = sp.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - tw/2, sy - 14, tw, 18);
    ctx.fillStyle = '#fff';
    ctx.fillText(sp.text, sx, sy);
    ctx.restore();
  }
  ctx.restore(); // end shake
  drawHUD();
}

})();