const { ipcRenderer } = require('electron');

// ============================================================
// ELEMENTOS DEL DOM
// ============================================================
const notch = document.getElementById('notch');
const notchProgressBar = document.getElementById('notch-progress-bar');

const viewCompact = document.getElementById('view-compact');
const viewNotification = document.getElementById('view-notification');
const viewExpanded = document.getElementById('view-expanded');

const compactIdle = document.getElementById('compact-idle');
const compactMedia = document.getElementById('compact-media');
const compactDownload = document.getElementById('compact-download');

const compactTime = document.getElementById('compact-time');
const compactBatteryPill = document.getElementById('compact-battery-pill');
const compactBatteryFill = document.getElementById('compact-battery-fill');
const compactBattery = document.getElementById('compact-battery');
const compactWeatherTemp = document.getElementById('compact-weather-temp');

const compactMediaArt = document.getElementById('compact-media-art');
const compactMediaTitle = document.getElementById('compact-media-title');
const compactVisualizer = document.getElementById('compact-visualizer');
const compactLyricsWrap = document.getElementById('compact-lyrics-wrap');
const compactLyricsText = document.getElementById('compact-lyrics-text');

const tvMarqueeTrack = document.getElementById('tv-marquee-track');
const tvMarqueeText = document.getElementById('tv-marquee-text');
const tvMarqueeDup = document.getElementById('tv-marquee-dup');

const compactTvWeatherTime = document.getElementById('compact-tv-weather-time');
const tvTime = document.getElementById('tv-time');
const tvWeatherTemp = document.getElementById('tv-weather-temp');
const compactTvBattery = document.getElementById('compact-tv-battery');
const tvBatteryPill = document.getElementById('tv-battery-pill');
const tvBatteryFill = document.getElementById('tv-battery-fill');
const tvBattery = document.getElementById('tv-battery');

const compactDlName = document.getElementById('compact-dl-name');
const compactDlPercent = document.getElementById('compact-dl-percent');
const compactDlSpeed = document.getElementById('compact-dl-speed');

const notifTitle = document.getElementById('notif-title');
const notifSubtitle = document.getElementById('notif-subtitle');

const vinylDiscHost = document.getElementById('vinyl-disc-host');
const vinylDisc = document.getElementById('vinyl-disc');
const vinylArtImg = document.getElementById('vinyl-art-img');
const expMediaArtist = document.getElementById('exp-media-artist');
const expMediaTitle = document.getElementById('exp-media-title');
const expLyricsWrap = document.getElementById('exp-lyrics-wrap');
const expLyricsText = document.getElementById('exp-lyrics-text');
const mediaProgressTrack = document.getElementById('media-progress-track');
const mediaProgressFill = document.getElementById('media-progress-fill');
const mediaTimePos = document.getElementById('media-time-pos');
const mediaTimeEnd = document.getElementById('media-time-end');
const btnMediaPrev = document.getElementById('btn-media-prev');
const btnMediaPlay = document.getElementById('btn-media-play');
const mediaPlayIcon = document.getElementById('media-play-icon');
const btnMediaNext = document.getElementById('btn-media-next');

const expWeatherTemp = document.getElementById('exp-weather-temp');
const expWeatherCity = document.getElementById('exp-weather-city');
const expSysBattery = document.getElementById('exp-sys-battery');

const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCollapse = document.getElementById('btn-collapse');
const btnCloseApp = document.getElementById('btn-close-app');

// ============================================================
// ESTADO
// ============================================================
let isExpanded = false;
let isNotifying = false;
let isDownloading = false;
let collapseTimeout = null;
let notifTimeout = null;
let currentDownload = null;

let liveMedia = {
  hasMedia: false,
  isPlaying: false,
  title: '',
  artist: '',
  position: 0,
  duration: 0
};

// Sincronización en tiempo real e interpolación de alta precisión
let lastMediaSyncTime = performance.now();
let lastSyncedPosition = 0;
let isMusicPlatformActive = false;
let realtimeTickerStarted = false;
// Compensación de adelanto predictivo (compensa latencia de GSMTC y buffer de audio)
let LYRICS_COMPENSATION_OFFSET_SEC = 0.55;
let lastCoverThumb = null;
let hasAlertedLowBattery = false;

function startRealtimeTicker() {
  if (realtimeTickerStarted) return;
  realtimeTickerStarted = true;

  function tick() {
    if (liveMedia.hasMedia && liveMedia.isPlaying) {
      const now = performance.now();
      const elapsed = (now - lastMediaSyncTime) / 1000;
      let realPos = lastSyncedPosition + elapsed;
      if (liveMedia.duration > 0 && realPos > liveMedia.duration) {
        realPos = liveMedia.duration;
      }
      liveMedia.position = realPos;

      // Actualizar progreso suave en 60 FPS
      if (liveMedia.duration > 0) {
        const pct = Math.max(0, Math.min(100, (realPos / liveMedia.duration) * 100));
        mediaProgressFill.style.width = `${pct}%`;
        mediaTimePos.textContent = formatTime(realPos);
      }

      // Sincronización de letra en tiempo real con compensación
      if (isMusicPlatformActive) {
        syncLyricsAtTime(realPos + LYRICS_COMPENSATION_OFFSET_SEC, true);
      }
    }
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

// ============================================================
// CICLO DE MARQUEE MODO TV (1 min visible, 8 min escondido)
// ============================================================
let TV_MARQUEE_VISIBLE_MS = 60 * 1000;      // 1 minuto visible
let TV_MARQUEE_HIDDEN_MS = 8 * 60 * 1000;  // 8 minutos escondido

let tvMarqueeTimer = null;
let tvMarqueeVisible = true;
let isTvModeActive = false;
let lastTvTrackKey = '';

function syncTvClockWeather() {
  if (tvTime && compactTime) tvTime.textContent = compactTime.textContent;
  if (tvWeatherTemp && compactWeatherTemp) tvWeatherTemp.textContent = compactWeatherTemp.textContent;
  if (tvBattery && compactBattery) tvBattery.innerHTML = compactBattery.innerHTML;
  if (tvBatteryFill && compactBatteryFill) tvBatteryFill.style.width = compactBatteryFill.style.width;
  if (tvBatteryPill && compactBatteryPill) {
    tvBatteryPill.className = compactBatteryPill.className;
  }
}

function updateTvMarqueeVisualState() {
  if (tvMarqueeTrack) {
    tvMarqueeTrack.classList.toggle('tv-hidden', !tvMarqueeVisible);
  }
  if (compactMedia) {
    compactMedia.classList.toggle('tv-marquee-on', tvMarqueeVisible);
    compactMedia.classList.toggle('tv-marquee-off', !tvMarqueeVisible);
  }
  if (!tvMarqueeVisible) {
    syncTvClockWeather();
  }
}

function startTvMarqueeCycle() {
  if (tvMarqueeTimer) clearTimeout(tvMarqueeTimer);
  tvMarqueeVisible = true;
  updateTvMarqueeVisualState();

  tvMarqueeTimer = setTimeout(() => {
    scheduleTvMarqueeNext(false);
  }, TV_MARQUEE_VISIBLE_MS);
}

function scheduleTvMarqueeNext(makeVisible) {
  if (!isTvModeActive) return;
  tvMarqueeVisible = makeVisible;
  updateTvMarqueeVisualState();

  const nextDelay = tvMarqueeVisible ? TV_MARQUEE_VISIBLE_MS : TV_MARQUEE_HIDDEN_MS;
  tvMarqueeTimer = setTimeout(() => {
    scheduleTvMarqueeNext(!tvMarqueeVisible);
  }, nextDelay);
}

function stopTvMarqueeCycle() {
  if (tvMarqueeTimer) {
    clearTimeout(tvMarqueeTimer);
    tvMarqueeTimer = null;
  }
  isTvModeActive = false;
  tvMarqueeVisible = true;
  lastTvTrackKey = '';
  if (tvMarqueeTrack) {
    tvMarqueeTrack.classList.add('hidden');
    tvMarqueeTrack.classList.remove('tv-hidden');
  }
  if (compactMedia) {
    compactMedia.classList.remove('is-tv-mode', 'tv-marquee-on', 'tv-marquee-off');
  }
  if (notch) {
    notch.classList.remove('is-tv-mode');
  }
}

let wasPlayingMedia = false;
let hpAnimTimer = null;
let tvAnimTimer = null;
let plugAnimTimer = null;

function triggerPlugAnimation(isConnecting) {
  if (plugAnimTimer) clearTimeout(plugAnimTimer);
  cuco.setCondition(isConnecting ? 'plugConnecting' : 'plugDisconnecting', true);
  cuco.setCondition(isConnecting ? 'plugDisconnecting' : 'plugConnecting', false);

  const duration = isConnecting ? 2300 : 2400;
  plugAnimTimer = setTimeout(() => {
    cuco.setCondition('plugConnecting', false);
    cuco.setCondition('plugDisconnecting', false);
    plugAnimTimer = null;
  }, duration);
}

// ============================================================
// CUCO — MASCOTA DEL NOTCH
// ============================================================
// Si el módulo no carga, se usa un sustituto inerte: el notch nunca se rompe.
function createCucoSafe() {
  try {
    const dock = document.getElementById('cuco-dock');
    const caption = document.getElementById('cuco-caption');
    if (window.Cuco && dock) return window.Cuco.create({ dock, caption });
  } catch (err) {
    console.warn('CUCO no pudo iniciarse:', err);
  }
  const noop = () => null;
  return {
    setCondition: noop, react: noop, emit: noop, defineReaction: noop, say: noop,
    beginOperation: () => noop, track: (p) => Promise.resolve(p), onChange: () => noop,
    getState: noop, destroy: noop
  };
}

const cuco = createCucoSafe();
if (cuco && typeof cuco.defineReaction === 'function') {
  cuco.defineReaction('power:low', {
    state: 'surprise',
    duration: 2500,
    tone: 'warn',
    message: 'Batería baja'
  });
}
window.addEventListener('beforeunload', () => cuco.destroy());

// ============================================================
// PREFERENCIAS DEL USUARIO Y AJUSTES EN TIEMPO REAL
// ============================================================
const DEFAULT_PREFS = {
  autostart: false,
  escCollapse: true,
  alwaysOnTop: true,
  coverTint: true,
  batteryPill: true,
  fluidAnim: true,
  borderStyle: 'hairline',
  cucoDance: true,
  cucoTv: true,
  cucoUsb: true,
  cucoSleep: true,
  lyricsSync: true,
  lyricsOffset: 550,
  tvVisibleMin: 1,
  tvHiddenMin: 8,
  usbNotif: true,
  batteryAlert: true
};

let userPrefs = { ...DEFAULT_PREFS };

function applyUserPreferences(prefs) {
  if (!prefs) return;
  userPrefs = { ...userPrefs, ...prefs };

  // 1. Desfase de letras en segundos
  if (userPrefs.lyricsOffset !== undefined) {
    LYRICS_COMPENSATION_OFFSET_SEC = userPrefs.lyricsOffset / 1000;
  }

  // 2. Tiempos de ciclo TV Marquee (en ms)
  if (userPrefs.tvVisibleMin !== undefined) {
    TV_MARQUEE_VISIBLE_MS = Math.max(0.1, userPrefs.tvVisibleMin) * 60 * 1000;
  }
  if (userPrefs.tvHiddenMin !== undefined) {
    TV_MARQUEE_HIDDEN_MS = Math.max(0.1, userPrefs.tvHiddenMin) * 60 * 1000;
  }

  // 3. Tinte dinámico de portada
  if (userPrefs.coverTint === false) {
    clearCoverTint();
  } else if (lastCoverThumb) {
    applyCoverTint(lastCoverThumb);
  }

  // 4. Cápsula de batería o estilo clásico
  notch.classList.toggle('classic-battery', userPrefs.batteryPill === false);

  // 5. Animaciones fluidas
  notch.classList.toggle('no-fluid-anim', userPrefs.fluidAnim === false);

  // 6. Estilo de borde del notch
  notch.classList.remove('border-none', 'border-subtle');
  if (userPrefs.borderStyle === 'none') {
    notch.classList.add('border-none');
  } else if (userPrefs.borderStyle === 'subtle') {
    notch.classList.add('border-subtle');
  }

  // 7. Reacciones de CUCO en tiempo real si hay reproducción activa
  if (isMusicPlatformActive && liveMedia.isPlaying) {
    cuco.setCondition('musicDancing', userPrefs.cucoDance !== false);
  }
  if (isTvModeActive && liveMedia.isPlaying) {
    cuco.setCondition('mediaTv', userPrefs.cucoTv !== false);
  }

  // 8. Sincronización de letras
  if (userPrefs.lyricsSync === false) {
    updateLyricsDisplay('');
  } else if (isMusicPlatformActive && liveMedia.isPlaying) {
    fetchLyrics(liveMedia.artist, liveMedia.title, liveMedia.duration);
    syncLyricsAtTime(liveMedia.position + LYRICS_COMPENSATION_OFFSET_SEC, true);
  }
}

function loadSavedPreferences() {
  try {
    const raw = localStorage.getItem('locknotch_settings');
    if (raw) {
      applyUserPreferences(JSON.parse(raw));
    }
  } catch (err) {
    console.warn('Error cargando preferencias de LockNotch:', err);
  }
}

// Cargar ajustes guardados al arrancar
loadSavedPreferences();

// Inactividad / bloqueo del sistema (powerMonitor en el proceso principal)
ipcRenderer.on('system-idle', (event, data) => {
  if (userPrefs.cucoSleep === false) {
    cuco.setCondition('systemIdle', false);
    cuco.setCondition('locked', false);
    return;
  }
  const state = data && data.state;
  cuco.setCondition('systemIdle', state === 'idle' || state === 'locked');
  cuco.setCondition('locked', state === 'locked');
});

// ============================================================
// CLICK-THROUGH NATIVO Y FOCO
// ============================================================
notch.addEventListener('mouseenter', () => {
  if (collapseTimeout) {
    clearTimeout(collapseTimeout);
    collapseTimeout = null;
  }
  cuco.setCondition('hover', true);
  ipcRenderer.send('set-ignore-mouse-events', false);
});

notch.addEventListener('mouseleave', () => {
  cuco.setCondition('hover', false);
  if (isExpanded) {
    collapseTimeout = setTimeout(() => {
      setExpanded(false);
      ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    }, 600);
  } else if (!isNotifying) {
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }
});

notch.addEventListener('click', (e) => {
  if (e.target.closest('#cuco-dock')) {
    cuco.emit('cuco:tap');
  }
  if (e.target.closest('button') || e.target.closest('.timeline-track')) return;
  if (!isExpanded && !isNotifying) {
    setExpanded(true);
  }
});

if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', (e) => {
    e.stopPropagation();
    ipcRenderer.send('open-settings');
  });
}

btnCollapse.addEventListener('click', (e) => {
  e.stopPropagation();
  setExpanded(false);
});

btnCloseApp.addEventListener('click', (e) => {
  e.stopPropagation();
  ipcRenderer.send('close-app');
});

// Atajos de teclado para productividad real
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isExpanded) {
    if (userPrefs.escCollapse !== false) {
      setExpanded(false);
    }
  } else if (e.key === ' ' && isExpanded) {
    e.preventDefault();
    ipcRenderer.send('media-control', 'toggle');
  } else if (e.key === 'ArrowRight' && isExpanded) {
    ipcRenderer.send('media-control', 'next');
  } else if (e.key === 'ArrowLeft' && isExpanded) {
    ipcRenderer.send('media-control', 'prev');
  }
});

// ============================================================
// GESTIÓN DE MODOS
// ============================================================
function setExpanded(expanded) {
  const changed = isExpanded !== expanded;
  isExpanded = expanded;
  if (collapseTimeout) { clearTimeout(collapseTimeout); collapseTimeout = null; }
  render();
  if (changed) cuco.emit(expanded ? 'notch:expand' : 'notch:collapse');
}

// Única fuente de verdad visual.
// Prioridad: aviso temporal > expandido > compacto (descarga > música > reposo)
function render() {
  notch.classList.remove('compact', 'expanded', 'notification-mode');
  viewCompact.classList.add('hidden');
  viewNotification.classList.add('hidden');
  viewExpanded.classList.add('hidden');
  vinylDiscHost.classList.remove('visible');

  if (isNotifying) {
    notch.classList.add('notification-mode');
    viewNotification.classList.remove('hidden');
  } else if (isExpanded) {
    notch.classList.add('expanded');
    viewExpanded.classList.remove('hidden');
    vinylDiscHost.classList.add('visible');
    ipcRenderer.send('set-ignore-mouse-events', false);
  } else {
    notch.classList.add('compact');
    viewCompact.classList.remove('hidden');
    updateCompactSubviews();
  }
}

function updateCompactSubviews() {
  const showDownload = isDownloading;
  const showMedia = !showDownload && liveMedia.hasMedia && liveMedia.isPlaying;

  notch.classList.toggle('downloading', showDownload);
  notch.classList.toggle('playing-media', showMedia);
  notch.classList.toggle('is-tv-mode', showMedia && isTvModeActive);
  compactDownload.classList.toggle('hidden', !showDownload);
  compactMedia.classList.toggle('hidden', !showMedia);
  compactIdle.classList.toggle('hidden', showDownload || showMedia);
}

// ============================================================
// MÚSICA EN TIEMPO REAL (WINDOWS GSMTC)
// ============================================================
function formatTime(secs) {
  if (!secs || isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

const svgPlay = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const svgPause = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect width="4" height="16" x="6" y="4" rx="1"/><rect width="4" height="16" x="14" y="4" rx="1"/></svg>';

const fs = require('fs');
const path = require('path');

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  const f = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map((x) => Math.round(x * 255));
}

// Color medio de una franja de la portada, ponderado por saturación y brillo
// (así manda el color vivo de la carátula y no el gris/negro del fondo).
function regionColor(px, size, y0, y1) {
  let r = 0, g = 0, b = 0, wsum = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const R = px[i], G = px[i + 1], B = px[i + 2];
      const max = Math.max(R, G, B), min = Math.min(R, G, B);
      const sat = max ? (max - min) / max : 0;
      const w = (sat * sat + 0.02) * (max / 255);
      r += R * w; g += G * w; b += B * w; wsum += w;
    }
  }
  if (!wsum) return [40, 40, 44];
  return [r / wsum, g / wsum, b / wsum];
}

// Mantiene el tono, pero en un rango de luminosidad que se vea bien sobre negro
function tintify([r, g, b]) {
  let [h, s, l] = rgbToHsl(r, g, b);
  s = Math.min(1, s * 1.15);
  l = Math.min(0.55, Math.max(0.32, l));
  return hslToRgb(h, s, l);
}

function clearCoverTint() {
  notch.style.setProperty('--tint-a', 'rgba(0, 0, 0, 0)');
  notch.style.setProperty('--tint-b', 'rgba(0, 0, 0, 0)');
  notch.classList.remove('light-theme', 'dark-theme');
  // Restaurar contraste base
  notch.style.removeProperty('--theme-text-bright');
  notch.style.removeProperty('--theme-text-sub');
  notch.style.removeProperty('--theme-text-muted');
  notch.style.removeProperty('--theme-ctrl-color');
  notch.style.removeProperty('--theme-ctrl-play-bg');
  notch.style.removeProperty('--theme-ctrl-play-border');
  notch.style.removeProperty('--theme-track-bg');
  notch.style.removeProperty('--theme-track-fill');
  notch.style.removeProperty('--theme-border-subtle');
  notch.style.removeProperty('--theme-text-shadow');
}

async function applyCoverTint(thumbUrl) {
  if (userPrefs.coverTint === false) {
    clearCoverTint();
    return;
  }
  try {
    const cleanUrl = thumbUrl.split('?')[0];
    const file = path.isAbsolute(cleanUrl) ? cleanUrl : path.join(__dirname, cleanUrl);
    const bitmap = await createImageBitmap(new Blob([fs.readFileSync(file)]));
    const S = 24;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, S, S);
    const px = ctx.getImageData(0, 0, S, S).data;

    const a = tintify(regionColor(px, S, 0, S / 2));
    const b = tintify(regionColor(px, S, S / 2, S));

    // Arriba suave (se funde con el bisel), abajo más intenso
    notch.style.setProperty('--tint-a', `rgba(${a[0]}, ${a[1]}, ${a[2]}, 0.20)`);
    notch.style.setProperty('--tint-b', `rgba(${b[0]}, ${b[1]}, ${b[2]}, 0.62)`);

    // Auto-adaptación de contraste de texto según la luminancia del fondo inferior
    // Color percibido de fondo en la mitad inferior (b al 62% sobre base negra):
    const rBg = b[0] * 0.62;
    const gBg = b[1] * 0.62;
    const bBg = b[2] * 0.62;

    // Luminancia relativa perceptiva estándar (WCAG 2.1)
    const toLinear = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    const bgLum = 0.2126 * toLinear(rBg) + 0.7152 * toLinear(gBg) + 0.0722 * toLinear(bBg);

    const isLightBg = bgLum > 0.28;
    notch.classList.toggle('light-theme', isLightBg);
    notch.classList.toggle('dark-theme', !isLightBg);

    if (isLightBg) {
      // Fondo claro/luminoso (carátulas blancas, amarillas o pastel): texto oscuro de alto contraste
      notch.style.setProperty('--theme-text-bright', 'rgba(0, 0, 0, 0.94)');
      notch.style.setProperty('--theme-text-sub', 'rgba(0, 0, 0, 0.74)');
      notch.style.setProperty('--theme-text-muted', 'rgba(0, 0, 0, 0.52)');
      notch.style.setProperty('--theme-ctrl-color', 'rgba(0, 0, 0, 0.80)');
      notch.style.setProperty('--theme-ctrl-play-bg', 'rgba(0, 0, 0, 0.10)');
      notch.style.setProperty('--theme-ctrl-play-border', 'rgba(0, 0, 0, 0.20)');
      notch.style.setProperty('--theme-track-bg', 'rgba(0, 0, 0, 0.15)');
      notch.style.setProperty('--theme-track-fill', 'rgba(0, 0, 0, 0.88)');
      notch.style.setProperty('--theme-border-subtle', 'rgba(0, 0, 0, 0.16)');
      notch.style.setProperty('--theme-text-shadow', 'none');
    } else {
      // Fondo oscuro/saturado (la mayoría de carátulas): texto blanco reforzado con sombra protectora
      notch.style.setProperty('--theme-text-bright', '#FFFFFF');
      notch.style.setProperty('--theme-text-sub', 'rgba(255, 255, 255, 0.84)');
      notch.style.setProperty('--theme-text-muted', 'rgba(255, 255, 255, 0.58)');
      notch.style.setProperty('--theme-ctrl-color', 'rgba(255, 255, 255, 0.85)');
      notch.style.setProperty('--theme-ctrl-play-bg', 'rgba(255, 255, 255, 0.14)');
      notch.style.setProperty('--theme-ctrl-play-border', 'rgba(255, 255, 255, 0.22)');
      notch.style.setProperty('--theme-track-bg', 'rgba(255, 255, 255, 0.18)');
      notch.style.setProperty('--theme-track-fill', '#FFFFFF');
      notch.style.setProperty('--theme-border-subtle', 'rgba(255, 255, 255, 0.10)');
      notch.style.setProperty('--theme-text-shadow', '0 1px 3px rgba(0, 0, 0, 0.60)');
    }
  } catch (e) {
    clearCoverTint();
  }
}

function updateMediaUI(data) {
  liveMedia = { ...liveMedia, ...data };
  lastSyncedPosition = typeof liveMedia.position === 'number' ? liveMedia.position : 0;
  lastMediaSyncTime = performance.now();
  startRealtimeTicker();

  if (liveMedia.hasMedia && liveMedia.title) {
    expMediaTitle.textContent = liveMedia.title;
    expMediaArtist.textContent = liveMedia.artist || 'Reproducción de Windows';
    compactMediaTitle.textContent = `${liveMedia.title} ${liveMedia.artist ? '· ' + liveMedia.artist : ''}`;

    // Auto-detección de longitud para activar desplazamiento continuo marquee si no cabe
    const compactText = compactMediaTitle.textContent;
    compactMediaTitle.classList.toggle('scrolling', compactText.length > 20);
    expMediaTitle.classList.toggle('scrolling', (liveMedia.title || '').length > 28);

    if (liveMedia.duration > 0) {
      const pct = Math.max(0, Math.min(100, (liveMedia.position / liveMedia.duration) * 100));
      mediaProgressFill.style.width = `${pct}%`;
      mediaTimePos.textContent = formatTime(liveMedia.position);
      mediaTimeEnd.textContent = formatTime(liveMedia.duration);
    } else {
      mediaProgressFill.style.width = '0%';
      mediaTimePos.textContent = formatTime(liveMedia.position);
      mediaTimeEnd.textContent = '--:--';
    }

    if (data.thumbnail) {
      lastCoverThumb = data.thumbnail;
      vinylArtImg.src = data.thumbnail;
      compactMediaArt.src = data.thumbnail;
      applyCoverTint(data.thumbnail);
    }

    if (liveMedia.isPlaying) {
      mediaPlayIcon.innerHTML = svgPause;
      vinylDisc.classList.add('spinning');
      compactMediaArt.classList.add('spinning');
      compactVisualizer.classList.add('animating');
    } else {
      mediaPlayIcon.innerHTML = svgPlay;
      vinylDisc.classList.remove('spinning');
      compactMediaArt.classList.remove('spinning');
      compactVisualizer.classList.remove('animating');
    }
  } else {
    expMediaTitle.textContent = 'Sin reproducción activa';
    expMediaArtist.textContent = 'Inicia Spotify, YouTube o cualquier medio';
    compactMediaTitle.textContent = 'Sin reproducción';
    mediaProgressFill.style.width = '0%';
    mediaTimePos.textContent = '0:00';
    mediaTimeEnd.textContent = '0:00';
    mediaPlayIcon.innerHTML = svgPlay;
    vinylDisc.classList.remove('spinning');
    compactMediaArt.classList.remove('spinning');
    compactVisualizer.classList.remove('animating');
    clearCoverTint();
    compactMediaTitle.classList.remove('scrolling');
    expMediaTitle.classList.remove('scrolling');
    updateLyricsDisplay('');
    stopTvMarqueeCycle();
  }

  const isPlayingMedia = !!(liveMedia.hasMedia && liveMedia.isPlaying);

  // Animaciones gesticuladas: ponerse o quitarse auriculares y sacar TV
  if (isPlayingMedia !== wasPlayingMedia) {
    if (isPlayingMedia) {
      // Se pone los auriculares usando sus manos
      if (hpAnimTimer) clearTimeout(hpAnimTimer);
      cuco.setCondition('headphonesOff', false);
      cuco.setCondition('headphonesOn', true);
      hpAnimTimer = setTimeout(() => {
        cuco.setCondition('headphonesOn', false);
        hpAnimTimer = null;
      }, 950);
    } else {
      // Se quita los auriculares usando sus manos
      if (hpAnimTimer) clearTimeout(hpAnimTimer);
      cuco.setCondition('headphonesOn', false);
      cuco.setCondition('headphonesOff', true);
      hpAnimTimer = setTimeout(() => {
        cuco.setCondition('headphonesOff', false);
        hpAnimTimer = null;
      }, 900);
    }
    wasPlayingMedia = isPlayingMedia;
  }

  cuco.setCondition('media', isPlayingMedia);

  if (isPlayingMedia) {
    const rawApp = (data.appId || '').toLowerCase();
    const rawTitle = (liveMedia.title || '').toLowerCase();
    const rawArtist = (liveMedia.artist || '').toLowerCase();

    // Detección de servicios de streaming de música
    // (Spotify, Apple Music, Mexlify, Deezer, Tidal, Amazon Music, YouTube Music, etc.)
    const isMusicPlatform =
      rawApp.includes('spotify') ||
      rawApp.includes('apple') ||
      rawApp.includes('mexlify') ||
      rawApp.includes('deezer') ||
      rawApp.includes('tidal') ||
      rawApp.includes('music') ||
      rawTitle.includes('spotify') ||
      rawArtist.includes('spotify') ||
      rawTitle.includes('apple music') ||
      rawArtist.includes('apple music') ||
      rawTitle.includes('mexlify') ||
      rawArtist.includes('mexlify');

    isMusicPlatformActive = isMusicPlatform;
    if (isMusicPlatform) {
      stopTvMarqueeCycle();
      cuco.setCondition('musicDancing', userPrefs.cucoDance !== false);
      cuco.setCondition('mediaTv', false);
      cuco.setCondition('tvDeploy', false);
      // Consultar letra en LRCLIB para apps de música
      if (userPrefs.lyricsSync !== false) {
        fetchLyrics(liveMedia.artist, liveMedia.title, liveMedia.duration);
        syncLyricsAtTime(liveMedia.position + LYRICS_COMPENSATION_OFFSET_SEC, true);
      } else {
        updateLyricsDisplay('');
      }
    } else {
      // Si la TV no estaba ya activa, desplegarla una sola vez con animación
      const tvWasActive = cuco.getCondition('mediaTv');
      cuco.setCondition('musicDancing', false);
      cuco.setCondition('mediaTv', userPrefs.cucoTv !== false);
      updateLyricsDisplay(''); // No mostrar letras en videos/navegador

      // Activar modo TV y Marquee continuo que pasa por debajo de CUCO
      isTvModeActive = true;
      notch.classList.add('is-tv-mode');
      compactMedia.classList.add('is-tv-mode');
      syncTvClockWeather();
      if (tvMarqueeTrack) tvMarqueeTrack.classList.remove('hidden');

      const currentTvKey = `${liveMedia.title}__${liveMedia.artist}`.toLowerCase();
      if (currentTvKey !== lastTvTrackKey) {
        lastTvTrackKey = currentTvKey;
        let base = (liveMedia.title || 'Reproduciendo video').trim();
        if (liveMedia.artist && !base.toLowerCase().includes(liveMedia.artist.toLowerCase())) {
          base = `${base}  •  ${liveMedia.artist}`;
        }
        let loopText = base;
        while (loopText.length < 50) {
          loopText += `   •   ${base}`;
        }
        if (tvMarqueeText) tvMarqueeText.textContent = loopText + '   •   ';
        if (tvMarqueeDup) tvMarqueeDup.textContent = loopText + '   •   ';

        isTvModeActive = true;
        startTvMarqueeCycle();
      } else if (!isTvModeActive) {
        isTvModeActive = true;
        startTvMarqueeCycle();
      }

      if (!tvWasActive) {
        cuco.setCondition('tvDeploy', true);
        if (tvAnimTimer) clearTimeout(tvAnimTimer);
        tvAnimTimer = setTimeout(() => {
          cuco.setCondition('tvDeploy', false);
          tvAnimTimer = null;
        }, 1000);
      }
    }
  } else {
    stopTvMarqueeCycle();
    isMusicPlatformActive = false;
    cuco.setCondition('musicDancing', false);
    cuco.setCondition('mediaTv', false);
    cuco.setCondition('tvDeploy', false);
    updateLyricsDisplay('');
  }

  render();
}

ipcRenderer.on('media-event', (event, data) => {
  updateMediaUI(data);
});

btnMediaPlay.addEventListener('click', (e) => {
  e.stopPropagation();
  ipcRenderer.send('media-control', 'toggle');
});

btnMediaNext.addEventListener('click', (e) => {
  e.stopPropagation();
  ipcRenderer.send('media-control', 'next');
});

btnMediaPrev.addEventListener('click', (e) => {
  e.stopPropagation();
  ipcRenderer.send('media-control', 'prev');
});

// ============================================================
// EVENTOS USB NATIVOS DE WINDOWS
// ============================================================
// Los avisos temporales tienen prioridad sobre descarga, música y vista expandida.
function handleUsbEvent(data) {
  if (userPrefs.usbNotif === false) return;
  if (collapseTimeout) { clearTimeout(collapseTimeout); collapseTimeout = null; }
  if (notifTimeout) clearTimeout(notifTimeout);

  const isConnected = data.action === 'connected';
  const name = data.name || data.device || (isConnected ? 'Dispositivo USB' : 'Dispositivo retirado');

  notifTitle.textContent = isConnected ? 'Dispositivo conectado' : 'Dispositivo retirado';
  notifSubtitle.textContent = name;

  notch.classList.toggle('disconnected', !isConnected);
  isNotifying = true;
  render();
  if (userPrefs.cucoUsb !== false) {
    triggerPlugAnimation(isConnected);
    cuco.emit(isConnected ? 'usb:connected' : 'usb:disconnected', data);
  }

  notifTimeout = setTimeout(() => {
    isNotifying = false;
    notch.classList.remove('disconnected');
    render();
  }, 3200);
}

ipcRenderer.on('usb-event', (event, data) => {
  handleUsbEvent(data);
});

// ============================================================
// CLIMA REAL (OPEN-METEO)
// ============================================================
async function fetchRealWeather() {
  try {
    let lat = 19.4326;
    let lon = -99.1332;
    let cityName = 'Ubicación local';

    try {
      const geoRes = await fetch('http://ip-api.com/json/?fields=lat,lon,city');
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.lat && geoData.lon) {
          lat = geoData.lat;
          lon = geoData.lon;
          cityName = geoData.city || cityName;
        }
      }
    } catch (e) {}

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const wRes = await fetch(weatherUrl);
    if (!wRes.ok) throw new Error('Error al consultar clima');

    const wData = await wRes.json();
    const temp = Math.round(wData.current_weather.temperature);

    compactWeatherTemp.textContent = `${temp}°`;
    expWeatherTemp.textContent = `${temp}°C`;
    expWeatherCity.textContent = cityName;
    if (tvWeatherTemp) tvWeatherTemp.textContent = `${temp}°`;
    weatherFailed = false;
  } catch (err) {
    compactWeatherTemp.textContent = '--°';
    expWeatherTemp.textContent = '--°C';
    expWeatherCity.textContent = 'Sin conexión';
    if (tvWeatherTemp) tvWeatherTemp.textContent = '--°';
    // CUCO se preocupa solo al perder la conexión, no en cada reintento
    if (!weatherFailed) cuco.emit('weather:error');
    weatherFailed = true;
  }
}

let weatherFailed = false;
const refreshWeather = () => cuco.track(fetchRealWeather(), { delay: 700 });
refreshWeather();
setInterval(refreshWeather, 20 * 60 * 1000);

// ============================================================
// LETRAS SINCRONIZADAS (LRCLIB API)
// ============================================================
let currentTrackKey = '';
let currentSyncedLyrics = []; // [{ time: seconds, text: string }]
let lyricsFetchAbort = null;
let lastLyricsText = '';

// Parsea formato LRC estándar: "[00:12.34] Letra de la canción"
// y divide líneas largas en momentos naturales para que quepan sin salirse
function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split(/\r?\n/);
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let match;
    const timestamps = [];
    while ((match = timeRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseFloat('0.' + match[3]);
      timestamps.push(min * 60 + sec + ms);
    }
    const cleanText = trimmed.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
    if (!cleanText) continue;

    for (const t of timestamps) {
      result.push({ time: t, text: cleanText });
    }
  }

  result.sort((a, b) => a.time - b.time);

  // Segmenta líneas largas en momentos breves para que quepan holgadas sin cortarse
  const segmented = [];
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const nextTime = i + 1 < result.length ? result[i + 1].time : item.time + 4.0;
    // La duración de canto activa de la frase (máximo 4.5s para no sobrepasar a pausas)
    const activeDur = Math.min(Math.max(1.8, nextTime - item.time), 4.5);
    const maxChars = 28; // Longitud generosa para aprovechar todo el ancho del ala derecha

    if (item.text.length > maxChars) {
      const words = item.text.split(/\s+/);
      const chunks = [];
      let currentChunk = '';

      for (const w of words) {
        if (!currentChunk) {
          currentChunk = w;
        } else if ((currentChunk + ' ' + w).length <= maxChars) {
          currentChunk += ' ' + w;
        } else {
          chunks.push(currentChunk);
          currentChunk = w;
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      const chunkDur = activeDur / chunks.length;
      chunks.forEach((chunk, idx) => {
        segmented.push({
          time: item.time + idx * chunkDur,
          text: chunk
        });
      });
    } else {
      segmented.push(item);
    }
  }

  return segmented;
}

async function fetchLyrics(artist, title, duration) {
  if (userPrefs.lyricsSync === false) {
    updateLyricsDisplay('');
    return;
  }
  const durKey = duration && duration > 0 ? Math.round(duration) : 0;
  const trackKey = `${artist}__${title}__${durKey}`.toLowerCase();
  if (trackKey === currentTrackKey) return;
  currentTrackKey = trackKey;
  currentSyncedLyrics = [];
  lastLyricsText = '';
  updateLyricsDisplay('');

  if (lyricsFetchAbort) lyricsFetchAbort.abort();
  lyricsFetchAbort = new AbortController();

  try {
    let cleanTitle = title.replace(/\([^)]*\)|\[[^\]]*\]|-.*$/g, '').trim();
    let cleanArtist = artist.replace(/\([^)]*\)|\[[^\]]*\]/g, '').trim();

    // 1. Intento exacto inicial con /api/get
    const params = new URLSearchParams({
      track_name: cleanTitle || title,
      artist_name: cleanArtist || artist
    });
    if (duration && duration > 0) params.append('duration', String(Math.round(duration)));

    const url = `https://lrclib.net/api/get?${params.toString()}`;
    const res = await fetch(url, {
      signal: lyricsFetchAbort.signal,
      headers: { 'User-Agent': 'LockNotch/2.0.0 (https://github.com/vCesar/LockNotch)' }
    });

    if (res.ok) {
      const json = await res.json();
      const trackDur = Number(json.duration) || 0;
      // Si tiene syncedLyrics y la duración coincide con alta precisión (<= 3.5s), usarla directamente
      if (json.syncedLyrics && (!duration || !trackDur || Math.abs(trackDur - duration) <= 3.5)) {
        currentSyncedLyrics = parseLrc(json.syncedLyrics);
        return;
      }
    }

    // 2. Búsqueda amplia con /api/search para comparar y elegir la versión cuya duración total sea la más parecida
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanArtist} ${cleanTitle}`)}`;
    const searchRes = await fetch(searchUrl, {
      signal: lyricsFetchAbort.signal,
      headers: { 'User-Agent': 'LockNotch/2.0.0 (https://github.com/vCesar/LockNotch)' }
    });

    if (searchRes.ok) {
      const results = await searchRes.json();
      const candidates = (Array.isArray(results) ? results : []).filter(
        (r) => r && r.syncedLyrics && !r.instrumental
      );

      if (candidates.length > 0) {
        if (duration && duration > 0) {
          // Ordenar candidatos por diferencia absoluta mínima con la duración de la canción en reproducción
          candidates.sort((a, b) => {
            const diffA = Math.abs((Number(a.duration) || 0) - duration);
            const diffB = Math.abs((Number(b.duration) || 0) - duration);
            return diffA - diffB;
          });
        }

        const bestMatch = candidates[0];
        if (bestMatch && bestMatch.syncedLyrics) {
          currentSyncedLyrics = parseLrc(bestMatch.syncedLyrics);
        }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      currentSyncedLyrics = [];
    }
  }
}

function updateLyricsDisplay(text) {
  if (text === lastLyricsText) return;
  lastLyricsText = text;

  if (text) {
    compactLyricsWrap.classList.remove('hidden');
    expLyricsWrap.classList.remove('hidden');

    compactLyricsText.classList.add('phrase-change');
    expLyricsText.classList.add('phrase-change');

    setTimeout(() => {
      compactLyricsText.textContent = text;
      expLyricsText.textContent = text;
      compactLyricsText.classList.remove('phrase-change');
      expLyricsText.classList.remove('phrase-change');

      // Auto-detección de desbordamiento para desplazamiento suave tipo marquee
      const wrapWidth = compactLyricsWrap.clientWidth || 175;
      const textWidth = compactLyricsText.scrollWidth || 0;
      if (textWidth > wrapWidth + 2) {
        const overflow = Math.ceil(textWidth - wrapWidth + 12);
        compactLyricsText.style.setProperty('--lyrics-overflow', `-${overflow}px`);
        compactLyricsText.classList.add('scrolling-lyrics');
        compactLyricsWrap.classList.add('is-scrolling');
      } else {
        compactLyricsText.classList.remove('scrolling-lyrics');
        compactLyricsWrap.classList.remove('is-scrolling');
        compactLyricsText.style.removeProperty('--lyrics-overflow');
      }
    }, 120);
  } else {
    compactLyricsWrap.classList.add('hidden');
    expLyricsWrap.classList.add('hidden');
    compactLyricsText.classList.remove('scrolling-lyrics');
    compactLyricsWrap.classList.remove('is-scrolling');
    compactLyricsText.style.removeProperty('--lyrics-overflow');
    compactLyricsText.textContent = '♪';
    expLyricsText.textContent = '♪';
  }
}

function syncLyricsAtTime(currentTimeSec, isMusicPlatform) {
  if (!isMusicPlatform || !currentSyncedLyrics.length) {
    updateLyricsDisplay('');
    return;
  }

  // Buscar el verso más cercano a currentTimeSec
  let currentPhrase = '';
  for (let i = 0; i < currentSyncedLyrics.length; i++) {
    if (currentSyncedLyrics[i].time <= currentTimeSec) {
      currentPhrase = currentSyncedLyrics[i].text;
    } else {
      break;
    }
  }

  updateLyricsDisplay(currentPhrase);
}
function updateClock() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  compactTime.textContent = timeStr;
  if (tvTime) tvTime.textContent = timeStr;
}
setInterval(updateClock, 1000);
updateClock();

const svgBolt = '<svg class="battery-bolt-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h8l-1 8 11-13h-8l1-7z"/></svg>';

if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    const updateBattery = () => {
      const level = Math.round(battery.level * 100);
      const isCharging = battery.charging;
      const isLow = level <= 20;

      const boltHtml = isCharging ? svgBolt : '';
      const labelHtml = `${boltHtml}${level}%`;

      if (compactBattery) compactBattery.innerHTML = labelHtml;
      if (tvBattery) tvBattery.innerHTML = labelHtml;

      const fillPct = `${Math.max(4, Math.min(100, level))}%`;
      if (compactBatteryFill) compactBatteryFill.style.width = fillPct;
      if (tvBatteryFill) tvBatteryFill.style.width = fillPct;

      if (compactBatteryPill) {
        compactBatteryPill.classList.toggle('is-charging', isCharging);
        compactBatteryPill.classList.toggle('is-low', isLow);
      }
      if (tvBatteryPill) {
        tvBatteryPill.classList.toggle('is-charging', isCharging);
        tvBatteryPill.classList.toggle('is-low', isLow);
      }

      expSysBattery.textContent = `${level}% ${isCharging ? '⚡' : ''}`;
      if (isCharging !== lastChargingState) {
        triggerPlugAnimation(isCharging);
        if (isCharging) {
          cuco.emit('power:charging');
        }
      }
      lastChargingState = isCharging;

      if (isLow && !isCharging && userPrefs.batteryAlert !== false && !hasAlertedLowBattery) {
        hasAlertedLowBattery = true;
        cuco.emit('power:low');
      } else if (!isLow || isCharging) {
        hasAlertedLowBattery = false;
      }
    };
    let lastChargingState = battery.charging;
    updateBattery();
    battery.addEventListener('levelchange', updateBattery);
    battery.addEventListener('chargingchange', updateBattery);
  }).catch(() => {});
}

// ============================================================
// DESCARGAS REALES DE CHROME
// ============================================================
function formatSpeed(bytesPerSec) {
  if (bytesPerSec >= 1048576) {
    return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  } else if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}

// Si Chrome deja de reportar (descarga cancelada, extensión caída), no nos quedamos congelados.
const DOWNLOAD_STALE_MS = 6000;
const DOWNLOAD_DONE_MS = 2800;
let lastDownloadEventAt = 0;
let downloadWatchdog = null;
let downloadDoneTimer = null;

function clearDownload(interrupted = false) {
  isDownloading = false;
  currentDownload = null;
  cuco.setCondition('downloading', false);
  if (interrupted) {
    cuco.emit('download:failed');
  }
  notchProgressBar.style.width = '0%';
  if (downloadWatchdog) { clearInterval(downloadWatchdog); downloadWatchdog = null; }
  if (downloadDoneTimer) { clearTimeout(downloadDoneTimer); downloadDoneTimer = null; }
  render();
}

function handleDownloadEvent(ev) {
  currentDownload = ev;
  lastDownloadEventAt = Date.now();
  if (downloadDoneTimer) { clearTimeout(downloadDoneTimer); downloadDoneTimer = null; }

  const isComplete = ev.state === 'complete' || (ev.progress !== undefined && ev.progress >= 100);
  const isInterrupted = ev.state === 'interrupted' || ev.state === 'cancelled';

  if (isInterrupted) {
    clearDownload(true);
    return;
  }

  isDownloading = true;
  cuco.setCondition('downloading', true);

  const progress = Math.max(0, Math.min(100, Math.round(ev.progress || 0)));
  const speed = ev.speed || 0;
  const filename = ev.filename || 'Archivo';

  notchProgressBar.style.width = `${progress}%`;
  compactDlName.textContent = filename;
  compactDlPercent.textContent = isComplete ? '✓' : `${progress}%`;
  compactDlSpeed.textContent = isComplete ? 'Listo' : formatSpeed(speed);
  compactDlName.classList.toggle('scrolling', filename.length > 15);

  if (isComplete) {
    cuco.setCondition('downloading', false);
    cuco.emit('download:complete');
    // Mostramos el ✓ un momento y luego liberamos la isla
    if (downloadWatchdog) { clearInterval(downloadWatchdog); downloadWatchdog = null; }
    downloadDoneTimer = setTimeout(clearDownload, DOWNLOAD_DONE_MS);
  } else if (!downloadWatchdog) {
    downloadWatchdog = setInterval(() => {
      if (Date.now() - lastDownloadEventAt > DOWNLOAD_STALE_MS) clearDownload();
    }, 1000);
  }

  render();
}

ipcRenderer.on('download-event', (event, data) => {
  handleDownloadEvent(data);
});

// ============================================================
// CONFIGURACIÓN DINÁMICA & ACCIONES DE BANDEJA (IPC)
// ============================================================
ipcRenderer.on('toggle-expand', () => {
  setExpanded(!isExpanded);
});

ipcRenderer.on('cuco-test', (event, action) => {
  if (action === 'greet' && cuco) {
    cuco.emit('cuco:tap');
  }
});

ipcRenderer.on('settings-sync', (event, config) => {
  applyUserPreferences(config);
});
