const { app, BrowserWindow, screen, ipcMain, powerMonitor, Tray, Menu } = require('electron');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

// Prevenir múltiples instancias y conflictos de caché/puertos
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Directorio de datos aislado (evita errores de cache_util_win)
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'LockNotch_Profile'));
} catch (e) {}

let win = null;
let settingsWin = null;
let tray = null;
let mediaProcess = null;
let usbProcess = null;
let server = null;

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.bounds;
  const winWidth = 600;
  const winHeight = 380;
  const x = Math.round((screenWidth - winWidth) / 2);

  win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile('index.html');

  win.on('closed', () => {
    win = null;
  });
}

app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender);
  if (targetWin) targetWin.setIgnoreMouseEvents(ignore, options);
});

ipcMain.on('media-control', (event, action) => {
  if (mediaProcess && mediaProcess.stdin && !mediaProcess.stdin.destroyed) {
    try {
      mediaProcess.stdin.write(action + '\n');
    } catch (e) {}
  }
});

ipcMain.on('close-app', () => {
  app.quit();
});

// ============================================================
// VENTANA DE CONFIGURACIÓN & BANDEJA DE SISTEMA (TRAY)
// ============================================================
function openSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    return;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const winWidth = 780;
  const winHeight = 540;
  const x = Math.round((screenWidth - winWidth) / 2);
  const y = Math.round((screenHeight - winHeight) / 2);

  settingsWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    resizable: false,
    transparent: true,
    backgroundColor: '#0c0c0e',
    show: false,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWin.loadFile('settings.html');

  settingsWin.once('ready-to-show', () => {
    settingsWin.show();
    settingsWin.focus();
  });

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, 'assets', 'tray_icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('LockNotch • Dynamic Island');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Configuración...',
        click: () => openSettingsWindow()
      },
      { type: 'separator' },
      {
        label: 'Expandir / Colapsar Notch',
        click: () => {
          if (win && !win.isDestroyed()) win.webContents.send('toggle-expand');
        }
      },
      {
        label: 'Reiniciar Servicios',
        click: () => restartServices()
      },
      { type: 'separator' },
      {
        label: 'Salir de LockNotch',
        click: () => app.quit()
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => openSettingsWindow());
    tray.on('double-click', () => openSettingsWindow());
  } catch (err) {
    console.warn('Error al inicializar Tray:', err.message);
  }
}

function restartServices() {
  if (mediaProcess) {
    try { mediaProcess.kill(); } catch (e) {}
    mediaProcess = null;
  }
  if (usbProcess) {
    try { usbProcess.kill(); } catch (e) {}
    usbProcess = null;
  }
  setTimeout(() => {
    startMediaBridge();
    startUsbMonitor();
  }, 400);
}

ipcMain.on('open-settings', () => openSettingsWindow());

ipcMain.on('settings-minimize', () => {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.minimize();
});

ipcMain.on('settings-close', () => {
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.close();
});

ipcMain.handle('get-autostart-status', () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch (e) {
    return false;
  }
});

ipcMain.on('settings-updated', (event, config) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('settings-sync', config);
  }
  if (config.alwaysOnTop !== undefined && win && !win.isDestroyed()) {
    win.setAlwaysOnTop(!!config.alwaysOnTop, 'screen-saver');
  }
  if (config.autostart !== undefined) {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!config.autostart,
        path: process.execPath,
        args: []
      });
    } catch (e) {
      console.warn('Error configurando autostart:', e);
    }
  }
});

ipcMain.on('test-cuco-action', (event, action) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('cuco-test', action);
  }
});

ipcMain.on('test-usb-action', (event, action) => {
  if (win && !win.isDestroyed()) {
    win.webContents.send('usb-event', {
      type: 'usb',
      action: action,
      device: 'Memoria USB Kingston 3.0',
      drive: 'E:'
    });
  }
});

ipcMain.on('restart-services', () => {
  restartServices();
});

// Lee líneas JSON de un proceso hijo y las reenvía a la UI
function pipeJsonLines(proc, type, channel) {
  let buffer = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.type === type) send(channel, parsed);
      } catch (e) {}
    }
  });
}

// ============================================================
// USB: script persistente (eventos WMI + diff de unidades/periféricos)
// ============================================================
function startUsbMonitor() {
  const scriptPath = path.join(__dirname, 'scripts', 'usb_monitor.ps1');
  try {
    usbProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });
    pipeJsonLines(usbProcess, 'usb', 'usb-event');
    usbProcess.on('error', (err) => console.warn('USB monitor error:', err.message));
    usbProcess.on('exit', () => { usbProcess = null; });
  } catch (err) {
    console.warn('No se pudo lanzar el monitor USB:', err.message);
  }
}

// ============================================================
// MEDIA: puente GSMTC (.NET)
// ============================================================
function startMediaBridge() {
  const exePath = path.join(__dirname, 'scripts', 'media-service', 'bin', 'Release', 'net8.0-windows10.0.19041.0', 'media-service.exe');
  const assetsDir = path.join(__dirname, 'assets');
  try {
    mediaProcess = spawn(exePath, [assetsDir], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    pipeJsonLines(mediaProcess, 'media', 'media-event');
    mediaProcess.on('error', (err) => console.warn('Media bridge error:', err.message));
  } catch (err) {
    console.warn('No se pudo lanzar el puente de medios:', err.message);
  }
}

// ============================================================
// HTTP local: descargas de Chrome (+ /usb para diagnóstico)
// ============================================================
function startHttpServer() {
  server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/settings') {
      openSettingsWindow();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'settings_opened' }));
    }

    const routes = { '/downloads': 'download-event', '/usb': 'usb-event', '/media': 'media-event' };
    const channel = routes[req.url];

    if (req.method === 'POST' && channel) {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          send(channel, JSON.parse(body));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'invalid json' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(4040, '127.0.0.1', () => {
    console.log('Servidor HTTP de LockNotch escuchando en http://127.0.0.1:4040');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') console.warn('Puerto 4040 en uso por instancia previa.');
    else console.error('Error HTTP server:', err.message);
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  startHttpServer();
  startMediaBridge();
  startUsbMonitor();

  // Monitor de suspensión / bloqueo / inactividad del sistema para CUCO
  if (powerMonitor) {
    powerMonitor.on('suspend', () => send('system-idle', { state: 'locked' }));
    powerMonitor.on('lock-screen', () => send('system-idle', { state: 'locked' }));
    powerMonitor.on('resume', () => send('system-idle', { state: 'active' }));
    powerMonitor.on('unlock-screen', () => send('system-idle', { state: 'active' }));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  for (const p of [mediaProcess, usbProcess]) {
    if (p) { try { p.kill(); } catch (e) {} }
  }
  if (server) { try { server.close(); } catch (e) {} }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
