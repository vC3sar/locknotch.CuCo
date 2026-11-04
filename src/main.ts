import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface DownloadEvent {
  downloadId?: number;
  filename?: string;
  state?: string;
  totalBytes?: number;
  bytesReceived?: number;
  progress?: number;
  speed?: number;
}

// Elementos DOM
const notch = document.getElementById('notch') as HTMLDivElement;
const notchProgressBar = document.getElementById('notch-progress-bar') as HTMLDivElement;

const viewCompact = document.getElementById('view-compact') as HTMLDivElement;
const viewExpanded = document.getElementById('view-expanded') as HTMLDivElement;

const compactIdle = document.getElementById('compact-idle') as HTMLDivElement;
const compactDownload = document.getElementById('compact-download') as HTMLDivElement;

const compactTime = document.getElementById('compact-time') as HTMLSpanElement;
const compactBattery = document.getElementById('compact-battery') as HTMLSpanElement;

const compactDlName = document.getElementById('compact-dl-name') as HTMLSpanElement;
const compactDlPercent = document.getElementById('compact-dl-percent') as HTMLSpanElement;
const compactDlSpeed = document.getElementById('compact-dl-speed') as HTMLSpanElement;

const expDlFilename = document.getElementById('exp-dl-filename') as HTMLDivElement;
const expDlStatus = document.getElementById('exp-dl-status') as HTMLSpanElement;
const expDlSpeed = document.getElementById('exp-dl-speed') as HTMLSpanElement;
const expDlPercentBadge = document.getElementById('exp-dl-percentage-badge') as HTMLDivElement;
const expDlBar = document.getElementById('exp-dl-bar') as HTMLDivElement;
const expDlBytes = document.getElementById('exp-dl-bytes') as HTMLSpanElement;
const expDlRemaining = document.getElementById('exp-dl-remaining') as HTMLSpanElement;

const btnCloseApp = document.getElementById('btn-close-app') as HTMLButtonElement;
const btnCollapse = document.getElementById('btn-collapse') as HTMLButtonElement;
const btnDemoDl = document.getElementById('btn-demo-dl') as HTMLButtonElement;

// Estado
let isExpanded = false;
let isDownloading = false;
let collapseTimeout: number | null = null;
let currentDownload: DownloadEvent | null = null;

// ============================================================
// REPORTAR HIT-RECT A RUST PARA CLICK-THROUGH
// ============================================================
function reportBounds() {
  if (!notch) return;
  const rect = notch.getBoundingClientRect();
  invoke('update_notch_bounds', {
    rect: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    },
  }).catch(() => {});
}

// Observador de cambios de tamaño en el notch
const resizeObserver = new ResizeObserver(() => {
  reportBounds();
});
resizeObserver.observe(notch);
window.addEventListener('resize', reportBounds);

// ============================================================
// CONTROL DE MODOS DEL NOTCH
// ============================================================
function setExpanded(expanded: boolean) {
  isExpanded = expanded;
  if (collapseTimeout) {
    clearTimeout(collapseTimeout);
    collapseTimeout = null;
  }

  if (expanded) {
    notch.classList.remove('compact');
    notch.classList.add('expanded');
    viewCompact.classList.add('hidden');
    viewExpanded.classList.remove('hidden');
    invoke('set_interactive', { interactive: true }).catch(() => {});
  } else {
    notch.classList.remove('expanded');
    notch.classList.add('compact');
    viewExpanded.classList.add('hidden');
    viewCompact.classList.remove('hidden');
    updateCompactSubviews();
  }
}

function updateCompactSubviews() {
  if (isDownloading) {
    notch.classList.add('downloading');
    compactIdle.classList.add('hidden');
    compactDownload.classList.remove('hidden');
  } else {
    notch.classList.remove('downloading');
    compactDownload.classList.add('hidden');
    compactIdle.classList.remove('hidden');
  }
}

// ============================================================
// EVENTOS DEL RATÓN SOBRE EL NOTCH
// ============================================================
notch.addEventListener('mouseenter', () => {
  if (collapseTimeout) {
    clearTimeout(collapseTimeout);
    collapseTimeout = null;
  }
  invoke('set_interactive', { interactive: true }).catch(() => {});
});

notch.addEventListener('mouseleave', () => {
  if (isExpanded) {
    collapseTimeout = window.setTimeout(() => {
      setExpanded(false);
      invoke('set_interactive', { interactive: false }).catch(() => {});
    }, 700);
  } else {
    invoke('set_interactive', { interactive: false }).catch(() => {});
  }
});

notch.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  if (target.closest('button')) return;

  if (!isExpanded) {
    setExpanded(true);
  }
});

btnCollapse.addEventListener('click', (e) => {
  e.stopPropagation();
  setExpanded(false);
});

btnCloseApp.addEventListener('click', () => {
  invoke('close_app').catch(() => {});
});

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

// Batería del sistema
if ('getBattery' in navigator) {
  (navigator as any).getBattery().then((battery: any) => {
    const updateBattery = () => {
      const level = Math.round(battery.level * 100);
      compactBattery.textContent = `${level}%`;
    };
    updateBattery();
    battery.addEventListener('levelchange', updateBattery);
  }).catch(() => {});
}

// ============================================================
// FORMATEO Y GESTIÓN DE DESCARGAS
// ============================================================
function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1048576) {
    return `${(bytesPerSec / 1048576).toFixed(1)} MB/s`;
  } else if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) {
    return `${(bytes / 1073741824).toFixed(2)} GB`;
  } else if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(1)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${bytes} B`;
}

export function handleDownloadEvent(ev: DownloadEvent) {
  currentDownload = ev;
  const isComplete = ev.state === 'complete' || (ev.progress !== undefined && ev.progress >= 100);
  const isInterrupted = ev.state === 'interrupted';

  if (isInterrupted) {
    isDownloading = false;
    updateCompactSubviews();
    return;
  }

  isDownloading = !isComplete;
  updateCompactSubviews();

  const progress = Math.max(0, Math.min(100, Math.round(ev.progress || 0)));
  const speed = ev.speed || 0;
  const speedStr = formatSpeed(speed);
  const filename = ev.filename || 'Archivo';

  // Barra de progreso del notch (borde inferior)
  notchProgressBar.style.width = `${progress}%`;

  // Vista Compacta
  compactDlName.textContent = filename;
  compactDlPercent.textContent = isComplete ? '✓' : `${progress}%`;
  compactDlSpeed.textContent = isComplete ? 'Listo' : speedStr;

  // Marquesina automática si el texto es largo
  if (filename.length > 16) {
    compactDlName.classList.add('scrolling');
  } else {
    compactDlName.classList.remove('scrolling');
  }

  // Vista Expandida
  expDlFilename.textContent = filename;
  expDlStatus.textContent = isComplete ? 'Descarga completada' : 'Descargando...';
  expDlSpeed.textContent = isComplete ? 'Completado' : speedStr;
  expDlPercentBadge.textContent = `${progress}%`;
  expDlBar.style.width = `${progress}%`;

  if (ev.totalBytes && ev.totalBytes > 0) {
    const received = ev.bytesReceived || 0;
    expDlBytes.textContent = `${formatBytes(received)} / ${formatBytes(ev.totalBytes)}`;
    if (speed > 0 && !isComplete) {
      const remainingSecs = Math.max(0, Math.round((ev.totalBytes - received) / speed));
      expDlRemaining.textContent = `Quedan ~${remainingSecs}s`;
    } else {
      expDlRemaining.textContent = isComplete ? '✓ Finalizado' : '';
    }
  } else {
    expDlBytes.textContent = `${formatBytes(ev.bytesReceived || 0)}`;
    expDlRemaining.textContent = '';
  }

  // Si se completó, restaurar a modo inactivo tras 3 segundos
  if (isComplete) {
    setTimeout(() => {
      if (currentDownload?.state === 'complete' || (currentDownload?.progress ?? 0) >= 100) {
        isDownloading = false;
        notchProgressBar.style.width = '0%';
        updateCompactSubviews();
      }
    }, 3500);
  }
}

// Escuchar eventos emitidos desde Rust
listen<DownloadEvent>('ln:download', (event) => {
  handleDownloadEvent(event.payload);
});

// ============================================================
// SIMULADOR / DEMO DE DESCARGA (Para pruebas inmediatas)
// ============================================================
btnDemoDl.addEventListener('click', (e) => {
  e.stopPropagation();
  let simProgress = 0;
  const total = 1048576 * 85; // 85 MB
  const fname = 'LockNotch_v2_Setup_Release.zip';

  handleDownloadEvent({
    filename: fname,
    state: 'in_progress',
    totalBytes: total,
    bytesReceived: 0,
    progress: 0,
    speed: 1048576 * 4.5,
  });

  const interval = setInterval(() => {
    simProgress += 4;
    const received = Math.round((simProgress / 100) * total);
    const speed = 1048576 * (3.8 + Math.random() * 1.5);

    if (simProgress >= 100) {
      clearInterval(interval);
      handleDownloadEvent({
        filename: fname,
        state: 'complete',
        totalBytes: total,
        bytesReceived: total,
        progress: 100,
        speed: 0,
      });
    } else {
      handleDownloadEvent({
        filename: fname,
        state: 'in_progress',
        totalBytes: total,
        bytesReceived: received,
        progress: simProgress,
        speed,
      });
    }
  }, 200);
});

// Inicialización de límites inmediatamente
reportBounds();
setTimeout(reportBounds, 100);
setTimeout(reportBounds, 500);
