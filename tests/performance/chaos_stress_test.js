/**
 * ============================================================
 *  SmartQueue — Script de Estrés Extremo (Chaos Engineering)
 *  Persona 3: Pruebas de Rendimiento bajo Caos
 * ============================================================
 *
 *  Activa el servidor caído (server_down=true) a mitad de la prueba
 *  para medir resiliencia total del sistema.
 *
 *  EJECUTAR:
 *    k6 run chaos_stress_test.js
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const ticketDuration = new Trend('chaos_ticket_duration_ms', true);
const callDuration   = new Trend('chaos_call_duration_ms',   true);
const errorRate      = new Rate('chaos_error_rate');

const BASE_URL    = __ENV.BASE_URL || 'http://localhost:8000';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─── Fases de caos progresivo ────────────────────────────────────────────────
//  Fase A (0-60s):   Sin caos       — línea base de referencia
//  Fase B (60-120s): Latencia 500ms — degradación leve
//  Fase C (120-180s): Latencia 1.5s + 20% fallos BD — degradación media
//  Fase D (180-210s): Latencia 2s + 50% fallos BD   — degradación severa
//  Fase E (210-240s): server_down=true               — caída total del servidor
//  Fase F (240-270s): Recuperación (caos desactivado)
export const options = {
  scenarios: {
    chaos_progression: {
      executor:  'constant-vus',
      vus:       50,
      duration:  '4m30s',
      gracefulStop: '15s',
    },
  },
  thresholds: {
    // El sistema debe manejar al menos 40% de éxito incluso bajo caos severo
    'chaos_error_rate': ['rate<0.60'],
  },
};

// ─── Estado de caos actual (compartido via environment) ──────────────────────
let currentChaosPhase = 'none';

export function setup() {
  // Registrar sesiones de operadores
  for (let i = 1; i <= 4; i++) {
    http.post(
      `${BASE_URL}/api/v1/operadores/session`,
      JSON.stringify({ id_operador: i, id_ventanilla: i }),
      { headers: JSON_HEADERS }
    );
  }

  // Empezar limpio
  http.post(
    `${BASE_URL}/api/v1/chaos/config`,
    JSON.stringify({ latency_ms: 0, db_failure_rate: 0.0, server_down: false }),
    { headers: JSON_HEADERS }
  );

  console.log('🚀 Iniciando prueba de estrés con caos progresivo...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Fase A (0-60s):    Sin caos — línea base');
  console.log('  Fase B (60-120s):  Latencia 500ms');
  console.log('  Fase C (120-180s): Latencia 1500ms + 20% fallos BD');
  console.log('  Fase D (180-210s): Latencia 2000ms + 50% fallos BD');
  console.log('  Fase E (210-240s): Servidor completamente caído (503)');
  console.log('  Fase F (240-270s): Recuperación total');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return { startTime: Date.now() };
}

export function teardown() {
  // Restaurar siempre al final
  http.post(
    `${BASE_URL}/api/v1/chaos/config`,
    JSON.stringify({ latency_ms: 0, db_failure_rate: 0.0, server_down: false }),
    { headers: JSON_HEADERS }
  );
  console.log('\n✅ Caos restaurado. Prueba de estrés finalizada.');
}

// ─── Función principal ───────────────────────────────────────────────────────
export default function (data) {
  const elapsed = (Date.now() - data.startTime) / 1000; // segundos transcurridos

  // Solo el VU 1 controla la configuración del caos
  if (__VU === 1 && __ITER % 10 === 0) {
    applyChaosPhase(elapsed);
  }

  // Todos los VUs ejecutan carga
  runLoadCycle(elapsed);
}

// ─── Aplicar fase de caos según el tiempo transcurrido ──────────────────────
function applyChaosPhase(elapsedSeconds) {
  let config;
  let newPhase;

  if (elapsedSeconds < 60) {
    newPhase = 'A_baseline';
    config = { latency_ms: 0, db_failure_rate: 0.0, server_down: false };
  } else if (elapsedSeconds < 120) {
    newPhase = 'B_latency_500';
    config = { latency_ms: 500, db_failure_rate: 0.0, server_down: false };
  } else if (elapsedSeconds < 180) {
    newPhase = 'C_latency_1500_failures_20';
    config = { latency_ms: 1500, db_failure_rate: 0.20, server_down: false };
  } else if (elapsedSeconds < 210) {
    newPhase = 'D_latency_2000_failures_50';
    config = { latency_ms: 2000, db_failure_rate: 0.50, server_down: false };
  } else if (elapsedSeconds < 240) {
    newPhase = 'E_server_down';
    config = { latency_ms: 0, db_failure_rate: 0.0, server_down: true };
  } else {
    newPhase = 'F_recovery';
    config = { latency_ms: 0, db_failure_rate: 0.0, server_down: false };
  }

  if (newPhase !== currentChaosPhase) {
    currentChaosPhase = newPhase;
    console.log(`\n🔄 [${Math.round(elapsedSeconds)}s] Cambiando a fase: ${newPhase}`);
    http.post(
      `${BASE_URL}/api/v1/chaos/config`,
      JSON.stringify(config),
      { headers: JSON_HEADERS }
    );
  }
}

// ─── Ciclo de carga de un VU ─────────────────────────────────────────────────
function runLoadCycle(elapsed) {
  // Crear ticket
  group('Ticket Creation under Chaos', () => {
    const payload = JSON.stringify({
      nombre:      `Usuario Caos ${__VU}`,
      dni:         String(20000000 + __VU * 1000 + __ITER),
      celular:     `98${String(__VU).padStart(7, '0')}`,
      id_servicio: ((__VU + __ITER) % 6) + 1,
    });

    const t0  = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/tickets`, payload, {
      headers: JSON_HEADERS,
      timeout: '10s', // timeout extendido para caos
    });
    const dur = Date.now() - t0;

    ticketDuration.add(dur);

    const ok = check(res, {
      'respuesta recibida':    (r) => r.status !== 0,
      'no timeout':            ()  => dur < 10000,
      // En fase E (server_down) esperamos 503 — no es error de test
      'status esperado': (r) => [201, 500, 503].includes(r.status),
    });

    errorRate.add(!ok || (res.status >= 500 && elapsed < 210));
  });

  // Llamar siguiente ticket
  group('Call Next under Chaos', () => {
    const opId  = (__VU % 4) + 1;
    const venId = (__VU % 4) + 1;

    const t0  = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/tickets/call-next?id_operador=${opId}&id_ventanilla=${venId}`,
      null,
      { timeout: '10s' }
    );
    const dur = Date.now() - t0;

    callDuration.add(dur);

    check(res, {
      'respuesta recibida':       (r) => r.status !== 0,
      'latencia registrada':      ()  => dur < 10000,
    });
  });

  sleep(0.5);
}
