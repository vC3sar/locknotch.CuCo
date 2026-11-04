/* ============================================================
   CUCO — Máquina de estados (lógica pura, sin DOM)
   ------------------------------------------------------------
   Dos capas:
   · Estado BASE: se deriva de "condiciones" persistentes de la app
     (descargando, música sonando, cursor encima, sistema inactivo...).
   · Reacción TRANSITORIA: un estado temporal con prioridad y caducidad
     (feliz al hacer clic, sorpresa ante un USB, error breve...).
   El estado visible es la reacción vigente o, si no hay, el estado base.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.CucoState = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const STATES = Object.freeze({
    IDLE: 'idle',
    HAPPY: 'happy',
    NOTIFICATION: 'notification',
    WORKING: 'working',
    LISTENING: 'listening',
    SLEEPING: 'sleeping',
    ERROR: 'error'
  });

  const VALID_STATES = new Set(Object.values(STATES));

  // Prioridad por defecto de las reacciones transitorias.
  // Una reacción solo sustituye a otra vigente si su prioridad es >= .
  const TRANSIENT_PRIORITY = Object.freeze({
    idle: 0,
    sleeping: 0,
    happy: 1,
    listening: 1,
    working: 2,
    notification: 3,
    error: 4
  });

  // Reglas del estado base, evaluadas en orden (la primera que cumple gana).
  const DEFAULT_BASE_RULES = Object.freeze([
    {
      state: STATES.WORKING,
      when: (c) => c.downloading === true || (c.busy | 0) > 0,
      message: (c) => (c.downloading ? 'Descargando' : 'Procesando')
    },
    {
      state: STATES.LISTENING,
      when: (c) => c.hover === true || c.media === true,
      message: (c) => {
        if (!c.media) return null;
        if (c.musicDancing) return 'Bailando';
        if (c.mediaTv) return 'Viendo TV';
        return 'Escuchando';
      }
    },
    {
      state: STATES.SLEEPING,
      when: (c) => c.systemIdle === true,
      message: () => 'Descansando'
    }
  ]);

  function createStateMachine(options = {}) {
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const baseRules = Array.isArray(options.baseRules) ? options.baseRules : DEFAULT_BASE_RULES;

    const conditions = Object.create(null);
    let transient = null;
    let seq = 0;

    function setCondition(name, value) {
      if (conditions[name] === value) return false;
      conditions[name] = value;
      return true;
    }

    function getCondition(name) {
      return conditions[name];
    }

    function pushTransient(state, opts = {}) {
      if (!VALID_STATES.has(state)) throw new Error(`CUCO: estado desconocido "${state}"`);
      const t = now();
      const priority = Number.isFinite(opts.priority) ? opts.priority : (TRANSIENT_PRIORITY[state] ?? 1);
      const duration = Math.max(0, Number.isFinite(opts.duration) ? opts.duration : 1600);

      if (transient && transient.until > t && transient.priority > priority) return null;

      transient = {
        id: ++seq,
        state,
        priority,
        until: t + duration,
        message: opts.message ?? null,
        tone: opts.tone ?? null
      };
      return transient;
    }

    function clearTransient(id) {
      if (!transient) return false;
      if (id !== undefined && transient.id !== id) return false;
      transient = null;
      return true;
    }

    function resolve() {
      const t = now();
      if (transient && transient.until <= t) transient = null;

      if (transient) {
        return {
          state: transient.state,
          source: 'transient',
          id: transient.id,
          message: transient.message,
          tone: transient.tone,
          until: transient.until
        };
      }

      for (const rule of baseRules) {
        let ok = false;
        try { ok = !!rule.when(conditions); } catch (e) { ok = false; }
        if (ok) {
          let message = null;
          try { message = rule.message ? rule.message(conditions) : null; } catch (e) { message = null; }
          return { state: rule.state, source: 'base', id: 0, message, tone: rule.tone ?? null, until: null };
        }
      }

      return { state: STATES.IDLE, source: 'base', id: 0, message: null, tone: null, until: null };
    }

    function nextExpiry() {
      return transient ? transient.until : null;
    }

    return { setCondition, getCondition, pushTransient, clearTransient, resolve, nextExpiry };
  }

  return { STATES, TRANSIENT_PRIORITY, DEFAULT_BASE_RULES, createStateMachine };
});

