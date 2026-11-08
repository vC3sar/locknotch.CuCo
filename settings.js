const { ipcRenderer } = require('electron');

// ============================================================
// 1. NAVEGACIÓN POR PESTAÑAS DEL PANEL LATERAL
// ============================================================
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tabId = item.getAttribute('data-tab');
    if (!tabId) return;

    navItems.forEach(btn => btn.classList.remove('active'));
    tabPanes.forEach(pane => pane.classList.remove('active'));

    item.classList.add('active');
    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) {
      targetPane.classList.add('active');
    }
  });
});

// ============================================================
// 2. CONTROLES DE VENTANA
// ============================================================
const btnMinimize = document.getElementById('btn-win-minimize');
const btnClose = document.getElementById('btn-win-close');

if (btnMinimize) {
  btnMinimize.addEventListener('click', () => {
    ipcRenderer.send('settings-minimize');
  });
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    ipcRenderer.send('settings-close');
  });
}

// ============================================================
// 3. GESTIÓN Y PERSISTENCIA DE CONFIGURACIONES
// ============================================================
const DEFAULT_SETTINGS = {
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

function loadSettings() {
  try {
    const saved = localStorage.getItem('locknotch_settings');
    const config = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;

    const setAutostart = document.getElementById('set-autostart');
    const setEscCollapse = document.getElementById('set-esc-collapse');
    const setAlwaysOnTop = document.getElementById('set-always-on-top');
    const setCoverTint = document.getElementById('set-cover-tint');
    const setBatteryPill = document.getElementById('set-battery-pill');
    const setFluidAnim = document.getElementById('set-fluid-anim');
    const setBorderStyle = document.getElementById('set-border-style');
    const setCucoDance = document.getElementById('set-cuco-dance');
    const setCucoTv = document.getElementById('set-cuco-tv');
    const setCucoUsb = document.getElementById('set-cuco-usb');
    const setCucoSleep = document.getElementById('set-cuco-sleep');
    const setLyricsSync = document.getElementById('set-lyrics-sync');
    const setLyricsOffset = document.getElementById('set-lyrics-offset');
    const lyricsOffsetVal = document.getElementById('lyrics-offset-val');
    const setTvVisibleMin = document.getElementById('set-tv-visible-min');
    const setTvHiddenMin = document.getElementById('set-tv-hidden-min');
    const setUsbNotif = document.getElementById('set-usb-notif');
    const setBatteryAlert = document.getElementById('set-battery-alert');

    if (setAutostart) setAutostart.checked = !!config.autostart;
    if (setEscCollapse) setEscCollapse.checked = !!config.escCollapse;
    if (setAlwaysOnTop) setAlwaysOnTop.checked = !!config.alwaysOnTop;
    if (setCoverTint) setCoverTint.checked = !!config.coverTint;
    if (setBatteryPill) setBatteryPill.checked = !!config.batteryPill;
    if (setFluidAnim) setFluidAnim.checked = !!config.fluidAnim;
    if (setBorderStyle) setBorderStyle.value = config.borderStyle || 'hairline';
    if (setCucoDance) setCucoDance.checked = !!config.cucoDance;
    if (setCucoTv) setCucoTv.checked = !!config.cucoTv;
    if (setCucoUsb) setCucoUsb.checked = !!config.cucoUsb;
    if (setCucoSleep) setCucoSleep.checked = !!config.cucoSleep;
    if (setLyricsSync) setLyricsSync.checked = !!config.lyricsSync;
    if (setLyricsOffset) {
      setLyricsOffset.value = config.lyricsOffset || 550;
      if (lyricsOffsetVal) lyricsOffsetVal.textContent = `${setLyricsOffset.value} ms`;
    }
    if (setTvVisibleMin) setTvVisibleMin.value = config.tvVisibleMin || 1;
    if (setTvHiddenMin) setTvHiddenMin.value = config.tvHiddenMin || 8;
    if (setUsbNotif) setUsbNotif.checked = !!config.usbNotif;
    if (setBatteryAlert) setBatteryAlert.checked = !!config.batteryAlert;

    return config;
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

function saveCurrentSettings() {
  const config = {
    autostart: !!document.getElementById('set-autostart')?.checked,
    escCollapse: !!document.getElementById('set-esc-collapse')?.checked,
    alwaysOnTop: !!document.getElementById('set-always-on-top')?.checked,
    coverTint: !!document.getElementById('set-cover-tint')?.checked,
    batteryPill: !!document.getElementById('set-battery-pill')?.checked,
    fluidAnim: !!document.getElementById('set-fluid-anim')?.checked,
    borderStyle: document.getElementById('set-border-style')?.value || 'hairline',
    cucoDance: !!document.getElementById('set-cuco-dance')?.checked,
    cucoTv: !!document.getElementById('set-cuco-tv')?.checked,
    cucoUsb: !!document.getElementById('set-cuco-usb')?.checked,
    cucoSleep: !!document.getElementById('set-cuco-sleep')?.checked,
    lyricsSync: !!document.getElementById('set-lyrics-sync')?.checked,
    lyricsOffset: parseInt(document.getElementById('set-lyrics-offset')?.value || '550', 10),
    tvVisibleMin: parseInt(document.getElementById('set-tv-visible-min')?.value || '1', 10),
    tvHiddenMin: parseInt(document.getElementById('set-tv-hidden-min')?.value || '8', 10),
    usbNotif: !!document.getElementById('set-usb-notif')?.checked,
    batteryAlert: !!document.getElementById('set-battery-alert')?.checked
  };

  try {
    localStorage.setItem('locknotch_settings', JSON.stringify(config));
  } catch (e) {}

  ipcRenderer.send('settings-updated', config);
}

// Escuchar cambios en todos los controles
document.querySelectorAll('input, select').forEach(element => {
  element.addEventListener('change', () => {
    saveCurrentSettings();
  });
});

// Actualización en tiempo real del slider de desfase de letra
const lyricsSlider = document.getElementById('set-lyrics-offset');
const lyricsBadge = document.getElementById('lyrics-offset-val');
if (lyricsSlider && lyricsBadge) {
  lyricsSlider.addEventListener('input', () => {
    lyricsBadge.textContent = `${lyricsSlider.value} ms`;
    saveCurrentSettings();
  });
}

// ============================================================
// 4. BOTONES DE ACCIÓN & PRUEBAS
// ============================================================
const btnCucoGreet = document.getElementById('btn-cuco-greet');
if (btnCucoGreet) {
  btnCucoGreet.addEventListener('click', () => {
    ipcRenderer.send('test-cuco-action', 'greet');
    btnCucoGreet.textContent = '¡Saludando!';
    setTimeout(() => { btnCucoGreet.textContent = 'Saludar a CUCO'; }, 1500);
  });
}

const btnTestPlug = document.getElementById('btn-test-plug');
if (btnTestPlug) {
  btnTestPlug.addEventListener('click', () => {
    ipcRenderer.send('test-usb-action', 'connected');
  });
}

const btnTestUnplug = document.getElementById('btn-test-unplug');
if (btnTestUnplug) {
  btnTestUnplug.addEventListener('click', () => {
    ipcRenderer.send('test-usb-action', 'disconnected');
  });
}

const btnRestartServices = document.getElementById('btn-restart-services');
if (btnRestartServices) {
  btnRestartServices.addEventListener('click', () => {
    ipcRenderer.send('restart-services');
    btnRestartServices.textContent = 'Reiniciando...';
    setTimeout(() => { btnRestartServices.textContent = 'Reiniciado ✓'; }, 1000);
    setTimeout(() => { btnRestartServices.textContent = 'Reiniciar'; }, 2500);
  });
}

// Cargar configuración inicial al abrir la ventana
loadSettings();

// Sincronizar estado real de autostart desde Windows
ipcRenderer.invoke('get-autostart-status').then(enabled => {
  const setAutostart = document.getElementById('set-autostart');
  if (setAutostart) setAutostart.checked = enabled;
}).catch(() => {});

