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
const compactBattery = document.getElementById('compact-battery');
const compactWeatherTemp = document.getElementById('compact-weather-temp');

const compactMediaArt = document.getElementById('compact-media-art');
const compactMediaTitle = document.getElementById('compact-media-title');
const compactVisualizer = document.getElementById('compact-visualizer');

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

let wasPlayingMedia = false;
let hpAnimTimer = null;
let tvAnimTimer = null;
let plugAnimTimer = null;

function triggerPlugAnimation(isConnecting) {
  if (plugAnimTimer) clearTimeout(plugAnimTimer);
  cuco.setCondition(isConnecting ? 'plugConnecting' : 'plugDisconnecting', true);
  cuco.setCondition(isConnecting ? 'plugDisconnecting' : 'plugConnecting', false);

  plugAnimTimer = setTimeout(() => {
    cuco.setCondition('plugConnecting', false);
    cuco.setCondition('plugDisconnecting', false);
    plugAnimTimer = null;
  }, 1800);
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
window.addEventListener('beforeunload', () => cuco.destroy());

// Inactividad / bloqueo del sistema (powerMonitor en el proceso principal)
ipcRenderer.on('system-idle', (event, data) => {
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
  if (e.target.closest('button') || e.target.closest('.timeline-track')) return;
  if (!isExpanded && !isNotifying) {
    setExpanded(true);
  }
});

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
    setExpanded(false);
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
  try {
    const file = path.join(__dirname, thumbUrl.split('?')[0]);
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

    if (bgLum > 0.38) {
      // Fondo claro/luminoso (carátulas blancas, amarillas o pastel): texto oscuro de alto contraste
      notch.style.setProperty('--theme-text-bright', 'rgba(0, 0, 0, 0.94)');
      notch.style.setProperty('--theme-text-sub', 'rgba(0, 0, 0, 0.74)');
      notch.style.setProperty('--theme-text-muted', 'rgba(0, 0, 0, 0.52)');
      notch.style.setProperty('--theme-ctrl-color', 'rgba(0, 0, 0, 0.80)');
      notch.style.setProperty('--theme-ctrl-play-bg', 'rgba(0, 0, 0, 0.10)');
      notch.style.setProperty('--theme-ctrl-play-border', 'rgba(0, 0, 0, 0.18)');
      notch.style.setProperty('--theme-track-bg', 'rgba(0, 0, 0, 0.15)');
      notch.style.setProperty('--theme-track-fill', 'rgba(0, 0, 0, 0.88)');
      notch.style.setProperty('--theme-border-subtle', 'rgba(0, 0, 0, 0.12)');
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

  if (liveMedia.hasMedia && liveMedia.title) {
    expMediaTitle.textContent = liveMedia.title;
    expMediaArtist.textContent = liveMedia.artist || 'Reproducción de Windows';
    compactMediaTitle.textContent = `${liveMedia.title} ${liveMedia.artist ? '· ' + liveMedia.artist : ''}`;

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

    if (isMusicPlatform) {
      cuco.setCondition('musicDancing', true);
      cuco.setCondition('mediaTv', false);
      cuco.setCondition('tvDeploy', false);
    } else {
      // Sacar la TV usando las manos
      cuco.setCondition('musicDancing', false);
      cuco.setCondition('mediaTv', true);
      cuco.setCondition('tvDeploy', true);
      if (tvAnimTimer) clearTimeout(tvAnimTimer);
      tvAnimTimer = setTimeout(() => {
        cuco.setCondition('tvDeploy', false);
        tvAnimTimer = null;
      }, 1000);
    }
  } else {
    cuco.setCondition('musicDancing', false);
    cuco.setCondition('mediaTv', false);
    cuco.setCondition('tvDeploy', false);
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
  if (collapseTimeout) { clearTimeout(collapseTimeout); collapseTimeout = null; }
  if (notifTimeout) clearTimeout(notifTimeout);

  const isConnected = data.action === 'connected';
  const name = data.name || (isConnected ? 'Dispositivo USB' : 'Dispositivo retirado');

  notifTitle.textContent = isConnected ? 'Dispositivo conectado' : 'Dispositivo retirado';
  notifSubtitle.textContent = name;

  notch.classList.toggle('disconnected', !isConnected);
  isNotifying = true;
  render();
  cuco.emit(isConnected ? 'usb:connected' : 'usb:disconnected', data);

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
    weatherFailed = false;
  } catch (err) {
    compactWeatherTemp.textContent = '--°';
    expWeatherTemp.textContent = '--°C';
    expWeatherCity.textContent = 'Sin conexión';
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
// RELOJ & BATERÍA
// ============================================================
function updateClock() {
  const now = new Date();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  compactTime.textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    const updateBattery = () => {
      const level = Math.round(battery.level * 100);
      const isCharging = battery.charging;
      compactBattery.textContent = `${level}%`;
      expSysBattery.textContent = `${level}% ${isCharging ? '⚡' : ''}`;
      if (isCharging && !lastChargingState) {
        cuco.emit('power:charging');
      }
      lastChargingState = isCharging;
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
