// LockNotch Chrome Extension Connector
const API_URL = 'http://127.0.0.1:4040/downloads';

// Historial para cálculo de velocidad en MB/s o KB/s
const downloadHistory = new Map();
let pollInterval = null;

function sendToLockNotch(data) {
  fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {
    // Si LockNotch no está abierto, ignorar silenciosamente
  });
}

function cleanFilename(fullPath) {
  if (!fullPath) return 'Descarga';
  return fullPath.split(/[/\\]/).pop();
}

function pollActiveDownloads() {
  chrome.downloads.search({ state: 'in_progress' }, (items) => {
    if (!items || items.length === 0) {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      return;
    }

    const now = Date.now();

    for (const item of items) {
      const prev = downloadHistory.get(item.id);
      let speed = 0;

      if (prev && prev.time < now && item.bytesReceived >= prev.bytes) {
        const dt = (now - prev.time) / 1000;
        if (dt > 0.1) {
          const instantSpeed = (item.bytesReceived - prev.bytes) / dt;
          // Suavizado exponencial para evitar saltos bruscos en el velocímetro
          speed = prev.speed > 0 ? prev.speed * 0.6 + instantSpeed * 0.4 : instantSpeed;
        }
      }

      downloadHistory.set(item.id, {
        bytes: item.bytesReceived,
        time: now,
        speed: speed,
      });

      const total = item.totalBytes > 0 ? item.totalBytes : item.fileSize;
      const progress = total > 0 ? Math.min(100, (item.bytesReceived / total) * 100) : 0;

      sendToLockNotch({
        downloadId: item.id,
        filename: cleanFilename(item.filename),
        state: 'in_progress',
        totalBytes: total,
        bytesReceived: item.bytesReceived,
        progress: progress,
        speed: Math.round(speed),
      });
    }
  });
}

function startPollingIfNeeded() {
  if (!pollInterval) {
    pollActiveDownloads();
    pollInterval = setInterval(pollActiveDownloads, 300);
  }
}

// Iniciar monitoreo cuando se crea una descarga
chrome.downloads.onCreated.addListener((item) => {
  downloadHistory.set(item.id, {
    bytes: item.bytesReceived || 0,
    time: Date.now(),
    speed: 0,
  });
  startPollingIfNeeded();
});

// Eventos de estado (completado, pausado, cancelado)
chrome.downloads.onChanged.addListener((delta) => {
  startPollingIfNeeded();

  if (delta.state) {
    chrome.downloads.search({ id: delta.id }, (results) => {
      if (results && results.length > 0) {
        const item = results[0];
        const isComplete = delta.state.current === 'complete';
        const isInterrupted = delta.state.current === 'interrupted';

        sendToLockNotch({
          downloadId: item.id,
          filename: cleanFilename(item.filename),
          state: delta.state.current,
          totalBytes: item.totalBytes,
          bytesReceived: item.bytesReceived,
          progress: isComplete ? 100 : (item.totalBytes > 0 ? (item.bytesReceived / item.totalBytes) * 100 : 0),
          speed: 0,
        });

        if (isComplete || isInterrupted) {
          downloadHistory.delete(delta.id);
        }
      }
    });
  }
});

// Chequeo inicial al cargar el worker
startPollingIfNeeded();
