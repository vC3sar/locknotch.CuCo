/* ============================================================
   CUCO — Mascota del notch (vista + controlador)
   ------------------------------------------------------------
   · Inyecta el personaje SVG en el "dock" del notch.
   · Traduce la máquina de estados (cuco-state.js) a atributos
     data-* que cuco.css convierte en expresiones y animaciones.
   · Expone una API interna extensible:
       cuco.emit(evento, payload)          → dispara la reacción registrada
       cuco.defineReaction(evento, config) → registra / sustituye reacciones
       cuco.react(estado, opciones)        → reacción directa
       cuco.setCondition(nombre, valor)    → condiciones del estado base
       cuco.beginOperation() / cuco.track(promise)
       cuco.say(texto, ms)                 → mensaje breve (vista expandida)
       cuco.onChange(fn)                   → escuchar cambios de estado
       cuco.destroy()                      → limpia timers, listeners y DOM
   Rendimiento: el movimiento continuo (flotar / respirar) es CSS sobre
   capas compuestas (solo transform). Los ojos solo se repintan en
   parpadeos y cambios de expresión. Un único timer ambiental.
   ============================================================ */
(function (root) {
  'use strict';

  if (!root || !root.CucoState) {
    console.warn('CUCO: cuco-state.js no está cargado.');
    return;
  }

  const { STATES, createStateMachine } = root.CucoState;

  // ------------------------------------------------------------
  // Personaje (SVG original). viewBox 64×64, dos capas compuestas:
  // cuerpo (brazos + torso) y cabeza (antena, orejas, casco, visor).
  // ------------------------------------------------------------
  const EYE_IDLE = 'M0,-4.5 C2,-4.5 3.5,-2.5 3.5,0 C3.5,2.5 2,4.5 0,4.5 C-2,4.5 -3.5,2.5 -3.5,0 C-3.5,-2.5 -2,-4.5 0,-4.5 Z';
  const MOUTH_IDLE = 'M-2.4,-0.2 C-1.3,0.8 1.3,0.8 2.4,-0.2 C1.4,1.5 -1.4,1.5 -2.4,-0.2 Z';

  const TEMPLATE = `
<div class="cuco" data-state="idle" role="img" aria-label="CUCO">
  <div class="cuco-float">
    <div class="cuco-react">
      <div class="cuco-pose">
        <svg class="cuco-layer cuco-body" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <defs>
            <radialGradient id="cuco-g-shell" cx="34%" cy="22%" r="88%">
              <stop offset="0" stop-color="#FFFFFF"/>
              <stop offset="0.46" stop-color="#EFECFA"/>
              <stop offset="1" stop-color="#BCB4E2"/>
            </radialGradient>
            <linearGradient id="cuco-g-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0.55" stop-color="#5E52A6" stop-opacity="0"/>
              <stop offset="1" stop-color="#5E52A6" stop-opacity="0.30"/>
            </linearGradient>
            <linearGradient id="cuco-g-limb" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#FBFAFF"/>
              <stop offset="1" stop-color="#B9B0E0"/>
            </linearGradient>
            <linearGradient id="cuco-g-ear" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#E7E3F7"/>
              <stop offset="1" stop-color="#A69CD6"/>
            </linearGradient>
            <radialGradient id="cuco-g-visor" cx="50%" cy="28%" r="82%">
              <stop offset="0" stop-color="#1E2546"/>
              <stop offset="0.6" stop-color="#0D1126"/>
              <stop offset="1" stop-color="#060814"/>
            </radialGradient>
            <linearGradient id="cuco-g-eye" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#D5FBFF"/>
              <stop offset="0.38" stop-color="#67E8F9"/>
              <stop offset="1" stop-color="#3B82F6"/>
            </linearGradient>
            <linearGradient id="cuco-g-core" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#3B82F6"/>
              <stop offset="0.5" stop-color="#7DF0FF"/>
              <stop offset="1" stop-color="#3B82F6"/>
            </linearGradient>
            <radialGradient id="cuco-g-bead" cx="38%" cy="34%" r="70%">
              <stop offset="0" stop-color="#E6FDFF"/>
              <stop offset="0.5" stop-color="#67E8F9"/>
              <stop offset="1" stop-color="#2563EB"/>
            </radialGradient>
            <radialGradient id="cuco-g-bead-warn" cx="38%" cy="34%" r="70%">
              <stop offset="0" stop-color="#FFF4DA"/>
              <stop offset="0.5" stop-color="#F5B544"/>
              <stop offset="1" stop-color="#C2700A"/>
            </radialGradient>
            <linearGradient id="cuco-g-scan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#67E8F9" stop-opacity="0"/>
              <stop offset="0.5" stop-color="#67E8F9" stop-opacity="0.32"/>
              <stop offset="1" stop-color="#67E8F9" stop-opacity="0"/>
            </linearGradient>
            <clipPath id="cuco-clip-visor">
              <rect x="15" y="15.5" width="34" height="21" rx="10"/>
            </clipPath>
            <filter id="cuco-f-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="0.9" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <linearGradient id="cuco-g-hp-band" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#38BDF8"/>
              <stop offset="1" stop-color="#0284C7"/>
            </linearGradient>
            <linearGradient id="cuco-g-hp-cup" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#0284C7"/>
              <stop offset="1" stop-color="#0369A1"/>
            </linearGradient>
            <linearGradient id="cuco-g-tv-body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#3F3F46"/>
              <stop offset="1" stop-color="#18181B"/>
            </linearGradient>
            <linearGradient id="cuco-g-tv-screen" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#67E8F9"/>
              <stop offset="0.5" stop-color="#38BDF8"/>
              <stop offset="1" stop-color="#818CF8"/>
            </linearGradient>
            <linearGradient id="cuco-g-cable" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#38BDF8"/>
              <stop offset="1" stop-color="#1E293B"/>
            </linearGradient>
            <linearGradient id="cuco-g-plug" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#94A3B8"/>
              <stop offset="0.5" stop-color="#E2E8F0"/>
              <stop offset="1" stop-color="#64748B"/>
            </linearGradient>
            <radialGradient id="cuco-g-spark" cx="50%" cy="50%" r="50%">
              <stop offset="0" stop-color="#FFFFFF"/>
              <stop offset="0.4" stop-color="#67E8F9"/>
              <stop offset="1" stop-color="#3B82F6" stop-opacity="0"/>
            </radialGradient>
          </defs>

          <g class="cuco-arm cuco-arm-l">
            <rect x="15.5" y="44" width="6" height="12.5" rx="3" fill="url(#cuco-g-limb)"/>
            <rect x="15.5" y="52.6" width="6" height="3.9" rx="1.95" fill="#A99FD8" opacity="0.55"/>
          </g>
          <g class="cuco-arm cuco-arm-r">
            <rect x="42.5" y="44" width="6" height="12.5" rx="3" fill="url(#cuco-g-limb)"/>
            <rect x="42.5" y="52.6" width="6" height="3.9" rx="1.95" fill="#A99FD8" opacity="0.55"/>
          </g>

          <path d="M32,40.5 C40.6,40.5 45.2,45.4 45.2,51.4 C45.2,57.6 39.6,61.2 32,61.2 C24.4,61.2 18.8,57.6 18.8,51.4 C18.8,45.4 23.4,40.5 32,40.5 Z" fill="url(#cuco-g-shell)"/>
          <path d="M32,40.5 C40.6,40.5 45.2,45.4 45.2,51.4 C45.2,57.6 39.6,61.2 32,61.2 C24.4,61.2 18.8,57.6 18.8,51.4 C18.8,45.4 23.4,40.5 32,40.5 Z" fill="url(#cuco-g-shade)"/>
          <ellipse cx="32" cy="42.3" rx="10" ry="2.4" fill="#4E4390" opacity="0.30"/>
          <path d="M23.6,47.2 C24.8,44.6 27.6,43.4 30.6,43.2" fill="none" stroke="#FFFFFF" stroke-width="1" stroke-linecap="round" opacity="0.65"/>
          <rect x="26.4" y="48.2" width="11.2" height="6.4" rx="3.2" fill="#141A30"/>
          <rect class="cuco-core" x="28.6" y="50.4" width="6.8" height="2" rx="1" fill="url(#cuco-g-core)"/>
        </svg>

        <!-- Accesorio: Mini TV retrofuturista que saca y ve -->
        <div class="cuco-tv-prop">
          <svg class="cuco-layer cuco-tv-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <g class="cuco-tv-group">
              <!-- Antenas de la TV -->
              <path d="M28,42 L22,34" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
              <circle cx="21.5" cy="33.5" r="0.9" fill="#CBD5E1"/>
              <path d="M36,42 L42,34" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
              <circle cx="42.5" cy="33.5" r="0.9" fill="#CBD5E1"/>
              <!-- Chasis de la tele -->
              <rect x="21" y="41" width="22" height="15" rx="3.5" fill="url(#cuco-g-tv-body)" stroke="#52525B" stroke-width="0.8"/>
              <!-- Pantalla con resplandor -->
              <rect class="cuco-tv-screen" x="23" y="43" width="13.5" height="11" rx="2" fill="url(#cuco-g-tv-screen)"/>
              <line x1="24.5" y1="45" x2="35" y2="45" stroke="#FFFFFF" stroke-width="0.6" stroke-linecap="round" opacity="0.6"/>
              <!-- Diales / botones -->
              <circle cx="39.5" cy="45.5" r="1.2" fill="#71717A"/>
              <circle cx="39.5" cy="49.5" r="1.2" fill="#71717A"/>
              <!-- Patas -->
              <path d="M24,56 L22.5,59 M40,56 L41.5,59" stroke="#3F3F46" stroke-width="1.2" stroke-linecap="round"/>
            </g>
          </svg>
        </div>

        <!-- Accesorio: Conexión al suelo / Toma de corriente y Cable -->
        <div class="cuco-cable-prop">
          <svg class="cuco-layer cuco-cable-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <g class="cuco-cable-group">
              <!-- Toma / Conector empotrado en el suelo a la derecha -->
              <g class="cuco-floor-socket">
                <ellipse cx="49" cy="59.5" rx="5" ry="1.6" fill="#090D1A" stroke="#334155" stroke-width="0.7"/>
                <ellipse cx="49" cy="59.5" rx="2.5" ry="0.8" fill="#0284C7"/>
              </g>
              <!-- Cable y Enchufe que sostiene CUCO -->
              <g class="cuco-floor-plug">
                <path class="cuco-floor-cord" d="M38,48 C41,51 46,55 49,57.5" fill="none" stroke="url(#cuco-g-cable)" stroke-width="2.2" stroke-linecap="round"/>
                <!-- Cabezal del enchufe -->
                <rect class="cuco-floor-head" x="46.5" y="54" width="5" height="4.5" rx="1.2" fill="#1E293B" stroke="#475569" stroke-width="0.5"/>
                <!-- Clavija metálica hacia el suelo -->
                <rect class="cuco-floor-pin" x="48.1" y="58" width="1.8" height="2" rx="0.3" fill="url(#cuco-g-plug)"/>
              </g>
              <!-- Chispa y Rayos de conexión en el suelo -->
              <circle class="cuco-plug-spark" cx="49" cy="59.5" r="5.5" fill="url(#cuco-g-spark)"/>
              <path class="cuco-plug-rays" d="M49,56.5 L46.5,53.5 M49.5,56.5 L52.5,52.5 M45,59.5 L41.5,58.5 M53,59.5 L56.5,58" fill="none" stroke="#67E8F9" stroke-width="0.9" stroke-linecap="round"/>
            </g>
          </svg>
        </div>

        <div class="cuco-head-pose">
          <svg class="cuco-layer cuco-head" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <g class="cuco-antenna">
              <path d="M32,11 L32,6.2" stroke="#C9C2EA" stroke-width="1.7" stroke-linecap="round"/>
              <circle class="cuco-bead" cx="32" cy="4.4" r="2.5" fill="url(#cuco-g-bead)" filter="url(#cuco-f-glow)"/>
              <circle class="cuco-bead-warn" cx="32" cy="4.4" r="2.5" fill="url(#cuco-g-bead-warn)"/>
            </g>

            <g class="cuco-ear cuco-ear-l">
              <rect x="6" y="19.5" width="7.5" height="13" rx="3.6" fill="url(#cuco-g-ear)"/>
              <rect class="cuco-ear-light" x="7.5" y="22.6" width="1.5" height="6.8" rx="0.75" fill="#67E8F9"/>
            </g>
            <g class="cuco-ear cuco-ear-r">
              <rect x="50.5" y="19.5" width="7.5" height="13" rx="3.6" fill="url(#cuco-g-ear)"/>
              <rect class="cuco-ear-light" x="55" y="22.6" width="1.5" height="6.8" rx="0.75" fill="#67E8F9"/>
            </g>

            <!-- Accesorios: Auriculares -->
            <g class="cuco-headphones">
              <!-- Diadema sobre la cabeza -->
              <path class="cuco-hp-band" d="M8,26 C7,11 20,4.5 32,4.5 C44,4.5 57,11 56,26" fill="none" stroke="url(#cuco-g-hp-band)" stroke-width="2.6" stroke-linecap="round"/>
              <!-- Almohadilla izquierda -->
              <g class="cuco-hp-cup cuco-hp-cup-l">
                <rect x="4" y="18" width="6" height="15" rx="3" fill="url(#cuco-g-hp-cup)"/>
                <ellipse cx="6" cy="25.5" rx="1.5" ry="4.5" fill="#38BDF8"/>
              </g>
              <!-- Almohadilla derecha -->
              <g class="cuco-hp-cup cuco-hp-cup-r">
                <rect x="54" y="18" width="6" height="15" rx="3" fill="url(#cuco-g-hp-cup)"/>
                <ellipse cx="58" cy="25.5" rx="1.5" ry="4.5" fill="#38BDF8"/>
              </g>
            </g>

            <rect x="10" y="9.5" width="44" height="33" rx="15.5" fill="url(#cuco-g-shell)"/>
            <rect x="10" y="9.5" width="44" height="33" rx="15.5" fill="url(#cuco-g-shade)"/>
            <rect x="10" y="9.5" width="44" height="33" rx="15.5" fill="none" stroke="#8F86C8" stroke-opacity="0.35" stroke-width="0.6"/>
            <ellipse cx="22.5" cy="13.9" rx="7.2" ry="2.4" fill="#FFFFFF" opacity="0.8" transform="rotate(-14 22.5 13.9)"/>

            <rect x="13.8" y="14.3" width="36.4" height="23.4" rx="11.2" fill="#2B2F4D"/>
            <rect x="15" y="15.5" width="34" height="21" rx="10" fill="url(#cuco-g-visor)"/>

            <g clip-path="url(#cuco-clip-visor)">
              <rect class="cuco-scan" x="9" y="15.5" width="6" height="21" fill="url(#cuco-g-scan)"/>
              <ellipse class="cuco-blush" cx="20.2" cy="31" rx="2.6" ry="1.3" fill="#C4B5FD"/>
              <ellipse class="cuco-blush" cx="43.8" cy="31" rx="2.6" ry="1.3" fill="#C4B5FD"/>
              <g class="cuco-gaze" filter="url(#cuco-f-glow)">
                <g transform="translate(25.4 25)">
                  <g class="cuco-eye-anim">
                    <path class="cuco-eye" d="${EYE_IDLE}" fill="url(#cuco-g-eye)"/>
                    <circle class="cuco-spark" cx="-1.2" cy="-2" r="0.95" fill="#FFFFFF"/>
                  </g>
                </g>
                <g transform="translate(38.6 25)">
                  <g class="cuco-eye-anim">
                    <g transform="scale(-1 1)"><path class="cuco-eye" d="${EYE_IDLE}" fill="url(#cuco-g-eye)"/></g>
                    <circle class="cuco-spark" cx="-1.2" cy="-2" r="0.95" fill="#FFFFFF"/>
                  </g>
                </g>
                <g transform="translate(32 31.4)">
                  <path class="cuco-mouth" d="${MOUTH_IDLE}" fill="#67E8F9"/>
                </g>
              </g>
              <path d="M18.6,21.4 C19.4,18 23,16.7 30,16.6 C25,17.6 21.6,19 18.6,21.4 Z" fill="#FFFFFF" opacity="0.16"/>
            </g>
          </svg>
        </div>
      </div>
    </div>
  </div>
</div>`;

  // ------------------------------------------------------------
  // Reacciones por defecto para los eventos reales de LockNotch.
  // Cada entrada: { state, duration, priority?, tone?, message? }
  // `message` puede ser texto o función (payload) => texto.
  // ------------------------------------------------------------
  function greeting() {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'Buenos días';
    if (h >= 12 && h < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  const TAP_LINES = ['¡Hola!', 'Aquí estoy', '¿Qué tal?', '¡Bip bop!'];
  let tapIndex = 0;

  const DEFAULT_REACTIONS = {
    'app:ready':         { state: STATES.HAPPY, duration: 1900, message: greeting },
    'cuco:tap':          { state: STATES.HAPPY, duration: 1500, message: () => TAP_LINES[tapIndex++ % TAP_LINES.length] },
    'notch:expand':      { state: STATES.HAPPY, duration: 1800, message: greeting },
    'notch:collapse':    null,
    'usb:connected':     { state: STATES.NOTIFICATION, duration: 3200, message: 'Nuevo dispositivo' },
    'usb:disconnected':  { state: STATES.NOTIFICATION, duration: 3200, tone: 'warn', message: 'Desconectado' },
    'download:complete': { state: STATES.HAPPY, duration: 2600, message: 'Descarga lista' },
    'download:failed':   { state: STATES.ERROR, duration: 3200, message: 'Interrumpida' },
    'operation:failed':  { state: STATES.ERROR, duration: 3000, message: 'Algo falló' },
    'weather:error':     { state: STATES.ERROR, duration: 3000, message: 'Sin conexión' },
    'power:charging':    { state: STATES.HAPPY, duration: 1700, message: 'Cargando' }
  };

  // Condiciones que además se reflejan como data-* para CSS.
  const REFLECTED_CONDITIONS = {
    media: 'music',
    musicDancing: 'musicDancing',
    mediaTv: 'mediaTv',
    headphonesOn: 'hpOn',
    headphonesOff: 'hpOff',
    tvDeploy: 'tvDeploy',
    plugConnecting: 'plugConnecting',
    plugDisconnecting: 'plugDisconnecting',
    locked: 'paused'
  };

  const BLINKING_STATES = new Set([STATES.IDLE, STATES.LISTENING, STATES.WORKING, STATES.NOTIFICATION, STATES.ERROR]);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function createCuco(options = {}) {
    const dock = options.dock;
    if (!dock) throw new Error('CUCO: falta el contenedor (dock).');
    const caption = options.caption || null;
    const captionText = caption ? (caption.querySelector('.cuco-caption-text') || caption) : null;
    const defaultCaption = options.name || 'CUCO';

    const machine = createStateMachine({ baseRules: options.baseRules });
    const reactions = Object.assign({}, DEFAULT_REACTIONS, options.reactions || {});
    const listeners = new Set();

    dock.innerHTML = TEMPLATE;
    const el = dock.querySelector('.cuco');
    const reactEl = el.querySelector('.cuco-react');

    let current = { state: null, id: -1, message: null, tone: null };
    let destroyed = false;
    let sayMessage = null;

    // Timers (uno por propósito, siempre limpiados antes de re-armarse)
    let expiryTimer = null;
    let updateTimer = null;
    let ambientTimer = null;
    let blinkTimer = null;
    let blinkTimer2 = null;
    let lookTimer = null;
    let captionTimer = null;
    let sayTimer = null;
    let danceTimer = null;
    let danceStep = 1;

    // ---------- Accesibilidad: movimiento reducido ----------
    const mq = typeof root.matchMedia === 'function' ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reducedMotion = !!(mq && mq.matches);
    const onMotionPref = (e) => {
      reducedMotion = !!e.matches;
      el.classList.toggle('is-reduced-motion', reducedMotion);
      scheduleAmbient();
    };
    el.classList.toggle('is-reduced-motion', reducedMotion);
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onMotionPref);
      else if (mq.addListener) mq.addListener(onMotionPref);
    }

    // ---------- Interacción: clic sobre CUCO ----------
    // No detiene la propagación: el clic sigue expandiendo el notch como antes.
    const onTap = () => emit('cuco:tap');
    dock.addEventListener('click', onTap);

    // ---------- Núcleo de actualización ----------
    function apply() {
      updateTimer = null;
      if (destroyed) return;
      const next = machine.resolve();

      if (next.state !== current.state) el.dataset.state = next.state;
      if (next.tone !== current.tone) {
        if (next.tone) el.dataset.tone = next.tone;
        else delete el.dataset.tone;
      }

      // Reiniciar la animación de reacción en cada reacción nueva
      if (next.source === 'transient' && next.id !== current.id) restartReaction();

      const prevState = current.state;
      current = next;

      updateCaption();
      armExpiry();

      if (prevState !== next.state) {
        if (next.state !== STATES.IDLE) clearLook();
        for (const fn of listeners) {
          try { fn(next.state, prevState, next); } catch (e) { console.warn('CUCO listener:', e); }
        }
      }
    }

    // Las condiciones se agrupan (evita parpadeos de expresión al entrar/salir rápido con el cursor)
    function requestUpdate(delay = 0) {
      if (destroyed) return;
      if (delay === 0) {
        if (updateTimer) { clearTimeout(updateTimer); updateTimer = null; }
        apply();
        return;
      }
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(apply, delay);
    }

    function armExpiry() {
      if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
      const until = machine.nextExpiry();
      if (until) expiryTimer = setTimeout(() => { expiryTimer = null; apply(); }, Math.max(16, until - Date.now() + 4));
    }

    function restartReaction() {
      reactEl.classList.remove('is-reacting');
      void reactEl.offsetWidth; // reflow puntual para reiniciar la animación CSS
      reactEl.classList.add('is-reacting');
    }

    // ---------- Texto (solo visible con el notch expandido) ----------
    function updateCaption() {
      if (!captionText) return;
      const text = sayMessage || current.message || defaultCaption;
      if (captionText.textContent === text && !captionTimer) return;
      if (captionTimer) clearTimeout(captionTimer);
      caption.classList.add('is-swapping');
      captionTimer = setTimeout(() => {
        captionTimer = null;
        captionText.textContent = text;
        caption.classList.remove('is-swapping');
      }, reducedMotion ? 0 : 140);
    }

    // ---------- Vida ambiental: parpadeo y miradas (un solo timer) ----------
    function scheduleAmbient() {
      if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null; }
      if (destroyed || reducedMotion || machine.getCondition('locked')) return;
      ambientTimer = setTimeout(ambientTick, rand(2600, 6200));
    }

    function ambientTick() {
      ambientTimer = null;
      const s = current.state;
      if (BLINKING_STATES.has(s)) {
        blink();
        if (Math.random() < 0.18) blinkTimer2 = setTimeout(blink, 280);
      }
      if (s === STATES.IDLE && Math.random() < 0.3) look(Math.random() < 0.5 ? 'l' : 'r');
      scheduleAmbient();
    }

    function blink() {
      blinkTimer2 = null;
      if (destroyed) return;
      el.classList.remove('is-blinking');
      void el.offsetWidth;
      el.classList.add('is-blinking');
      if (blinkTimer) clearTimeout(blinkTimer);
      blinkTimer = setTimeout(() => { blinkTimer = null; el.classList.remove('is-blinking'); }, 200);
    }

    function look(dir) {
      el.dataset.look = dir;
      if (lookTimer) clearTimeout(lookTimer);
      lookTimer = setTimeout(clearLook, rand(1100, 1800));
    }

    function clearLook() {
      if (lookTimer) { clearTimeout(lookTimer); lookTimer = null; }
      delete el.dataset.look;
    }

    // ---------- API pública ----------
    function setCondition(name, value) {
      if (destroyed) return;
      if (!machine.setCondition(name, value)) return;

      const attr = REFLECTED_CONDITIONS[name];
      if (attr) {
        if (value) el.dataset[attr] = '';
        else delete el.dataset[attr];
      }
      // Si cambia de canción/modo de música mientras se reproduce, asegurar refresco inmediato
      if (name === 'musicDancing') {
        if (value) {
          startDanceCycle();
        } else {
          stopDanceCycle();
        }
        requestUpdate(0);
        return;
      }
      if (name === 'mediaTv' || name === 'headphonesOn' || name === 'headphonesOff' || name === 'tvDeploy' || name === 'plugConnecting' || name === 'plugDisconnecting') {
        requestUpdate(0);
        return;
      }
      if (name === 'locked') scheduleAmbient();

      requestUpdate(name === 'hover' ? 70 : 0);
    }

    function react(state, opts = {}) {
      if (destroyed) return null;
      const t = machine.pushTransient(state, opts);
      if (t) requestUpdate(0);
      return t ? t.id : null;
    }

    function emit(eventName, payload) {
      if (destroyed) return null;
      const def = reactions[eventName];
      if (!def) return null;
      const cfg = typeof def === 'function' ? def(payload, api) : def;
      if (!cfg || !cfg.state) return null;
      const message = typeof cfg.message === 'function' ? cfg.message(payload) : cfg.message;
      return react(cfg.state, { duration: cfg.duration, priority: cfg.priority, tone: cfg.tone, message });
    }

    function defineReaction(eventName, config) {
      if (config === undefined || config === null) delete reactions[eventName];
      else reactions[eventName] = config;
    }

    function say(text, ms = 2400) {
      if (destroyed) return;
      sayMessage = text || null;
      if (sayTimer) clearTimeout(sayTimer);
      sayTimer = sayMessage ? setTimeout(() => { sayTimer = null; sayMessage = null; updateCaption(); }, ms) : null;
      updateCaption();
    }

    // Operaciones en curso → estado WORKING. Devuelve una función end() idempotente.
    function beginOperation() {
      let ended = false;
      setCondition('busy', (machine.getCondition('busy') | 0) + 1);
      return function end(result = {}) {
        if (ended || destroyed) return;
        ended = true;
        setCondition('busy', Math.max(0, (machine.getCondition('busy') | 0) - 1));
        if (result.ok === false) emit(result.event || 'operation:failed', result);
        else if (result.event) emit(result.event, result);
      };
    }

    // Envuelve una promesa: solo muestra WORKING si tarda más de `delay` ms.
    function track(promise, opts = {}) {
      const delay = Number.isFinite(opts.delay) ? opts.delay : 600;
      let end = null;
      const timer = setTimeout(() => { end = beginOperation(); }, delay);
      const finish = (ok) => {
        clearTimeout(timer);
        if (end) end({ ok, event: ok ? opts.successEvent : opts.errorEvent });
        else if (!ok && opts.errorEvent) emit(opts.errorEvent);
        else if (ok && opts.successEvent) emit(opts.successEvent);
      };
      return Promise.resolve(promise).then(
        (v) => { finish(true); return v; },
        (err) => { finish(false); throw err; }
      );
    }

    function onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    }

    function getState() {
      return current.state;
    }

    // Intercalar entre 5 coreografías de baile diferentes
    function startDanceCycle() {
      if (danceTimer) clearInterval(danceTimer);
      danceStep = 1;
      el.dataset.danceStyle = '1';

      danceTimer = setInterval(() => {
        if (destroyed || !machine.getCondition('musicDancing')) {
          stopDanceCycle();
          return;
        }
        danceStep = (danceStep % 5) + 1;
        el.dataset.danceStyle = String(danceStep);
      }, 15000); // Cambia de estilo cada 15 segundos
    }

    function stopDanceCycle() {
      if (danceTimer) {
        clearInterval(danceTimer);
        danceTimer = null;
      }
      delete el.dataset.danceStyle;
    }

    // Intercalar entre 5 coreografías de baile diferentes
    function startDanceCycle() {
      if (danceTimer) clearInterval(danceTimer);
      danceStep = 1;
      el.dataset.danceStyle = '1';

      danceTimer = setInterval(() => {
        if (destroyed || !machine.getCondition('musicDancing')) {
          stopDanceCycle();
          return;
        }
        danceStep = (danceStep % 5) + 1;
        el.dataset.danceStyle = String(danceStep);
      }, 3400); // Cambia de estilo cada 3.4 segundos
    }

    function stopDanceCycle() {
      if (danceTimer) {
        clearInterval(danceTimer);
        danceTimer = null;
      }
      delete el.dataset.danceStyle;
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      stopDanceCycle();
      for (const t of [expiryTimer, updateTimer, ambientTimer, blinkTimer, blinkTimer2, lookTimer, captionTimer, sayTimer]) {
        if (t) clearTimeout(t);
      }
      dock.removeEventListener('click', onTap);
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener('change', onMotionPref);
        else if (mq.removeListener) mq.removeListener(onMotionPref);
      }
      listeners.clear();
      dock.innerHTML = '';
    }

    const api = {
      STATES,
      setCondition,
      getCondition: (name) => machine.getCondition(name),
      react,
      emit,
      defineReaction,
      say,
      beginOperation,
      track,
      onChange,
      getState,
      destroy
    };

    apply();
    scheduleAmbient();
    return api;
  }

  root.Cuco = { create: createCuco, STATES, DEFAULT_REACTIONS };
})(typeof window !== 'undefined' ? window : null);

