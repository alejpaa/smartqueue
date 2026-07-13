/**
 * ============================================================
 *  SmartQueue — Script de Pruebas de Carga con k6
 *  Persona 3: Ingeniero de Rendimiento (Performance) y SQA
 * ============================================================
 *
 *  FASES:
 *    1. Prueba de carga normal   — creación concurrente de tickets
 *    2. Prueba bajo Caos        — latencia + fallos inyectados
 *    3. Monitoreo SQA           — captura de métricas de latencia
 *
 *  EJECUTAR:
 *    Fase 1 (normal):  k6 run load_test.js
 *    Fase 2 (caos):    k6 run load_test.js -e CHAOS=true
 *    Fase 3 (SQA):     k6 run load_test.js -e SQA_ONLY=true
 *
 *  INSTALAR k6 en Linux:
 *    sudo gpg -k
 *    sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
 *         --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
 *    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
 *         | sudo tee /etc/apt/sources.list.d/k6.list
 *    sudo apt-get update && sudo apt-get install k6
 * ============================================================
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ─── Métricas Personalizadas SQA ───────────────────────────────────────────
const ticketCreationTime  = new Trend('ticket_creation_duration_ms', true);
const callNextTime        = new Trend('call_next_duration_ms',        true);
const metricsQueryTime    = new Trend('sqa_metrics_duration_ms',      true);
const errorRate           = new Rate('error_rate');
const ticketsCreated      = new Counter('tickets_created_total');
const ticketsCalled       = new Counter('tickets_called_total');

// ─── Configuración ──────────────────────────────────────────────────────────
const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:8000';
const CHAOS_MODE  = __ENV.CHAOS       === 'true';
const SQA_ONLY    = __ENV.SQA_ONLY    === 'true';

// IDs de servicios disponibles (1-6 insertados en seed)
const SERVICE_IDS = [1, 2, 3, 4, 5, 6];
// IDs de operadores y ventanillas disponibles
const OPERATOR_IDS   = [1, 2, 3, 4, 5, 6];
const VENTANILLA_IDS = [1, 2, 3, 4];        // solo las ACTIVAS

// ─── Escenarios de Carga ────────────────────────────────────────────────────
export const options = SQA_ONLY
  // Fase 3: Solo monitoreo SQA — tráfico bajo constante
  ? {
      scenarios: {
        sqa_monitor: {
          executor:            'constant-vus',
          vus:                 5,
          duration:            '1m',
          gracefulStop:        '10s',
        },
      },
      thresholds: {
        'sqa_metrics_duration_ms': ['p(95)<500'],
        'error_rate':              ['rate<0.05'],
      },
    }
  : CHAOS_MODE
  // Fase 2: Prueba de Rendimiento bajo Caos
  ? {
      scenarios: {
        // Rampa de carga con caos activo
        chaos_load: {
          executor:            'ramping-vus',
          startVUs:            0,
          stages: [
            { duration: '30s', target: 20  },   // calentamiento
            { duration: '1m',  target: 50  },   // carga media
            { duration: '1m',  target: 100 },   // carga alta (pico de estrés)
            { duration: '30s', target: 0   },   // enfriamiento
          ],
          gracefulRampDown: '10s',
        },
      },
      thresholds: {
        // Bajo caos: toleramos más latencia (SLA degradado)
        'ticket_creation_duration_ms': ['p(95)<3000', 'p(99)<5000'],
        'call_next_duration_ms':       ['p(95)<3000', 'p(99)<5000'],
        'error_rate':                  ['rate<0.60'],   // hasta 60% de error esperado bajo caos total
        'http_req_failed':             ['rate<0.70'],
      },
    }
  // Fase 1: Prueba de Carga Normal
  : {
      scenarios: {
        // Carga constante de tickets concurrentes
        ticket_creation: {
          executor:            'ramping-vus',
          startVUs:            0,
          stages: [
            { duration: '30s', target: 50  },   // rampa de subida
            { duration: '2m',  target: 200 },   // carga sostenida (200 VUs)
            { duration: '30s', target: 300 },   // pico máximo
            { duration: '30s', target: 0   },   // enfriamiento
          ],
          gracefulRampDown: '10s',
        },
        // Operadores llamando turnos en paralelo
        operator_calling: {
          executor:            'constant-vus',
          vus:                 10,
          duration:            '3m',
          startTime:           '30s',           // arranca cuando ya hay tickets
          gracefulStop:        '15s',
        },
      },
      thresholds: {
        // SLA de rendimiento normal (sin caos)
        'ticket_creation_duration_ms': ['p(95)<500',  'p(99)<1000'],
        'call_next_duration_ms':       ['p(95)<600',  'p(99)<1200'],
        'sqa_metrics_duration_ms':     ['p(95)<300'],
        'error_rate':                  ['rate<0.05'],  // menos del 5% de errores
        'http_req_failed':             ['rate<0.05'],
        'http_req_duration':           ['p(95)<800'],
      },
    };

// ─── Datos de prueba ────────────────────────────────────────────────────────
function randomDNI() {
  // DNI de 8 dígitos único por VU + iteración
  return String(10000000 + Math.floor(Math.random() * 89999999));
}

function randomName() {
  const nombres   = ['Carlos','Ana','Luis','María','Jorge','Rosa','Pedro','Lucía','Diego','Sofía'];
  const apellidos = ['García','Torres','Mendoza','Quispe','Ramírez','Villanueva','Silva','Flores'];
  return `${nombres[Math.floor(Math.random() * nombres.length)]} ${apellidos[Math.floor(Math.random() * apellidos.length)]}`;
}

function randomServiceId() {
  return SERVICE_IDS[Math.floor(Math.random() * SERVICE_IDS.length)];
}

function randomOperatorAndVentanilla() {
  return {
    id_operador:   OPERATOR_IDS[Math.floor(Math.random()   * OPERATOR_IDS.length)],
    id_ventanilla: VENTANILLA_IDS[Math.floor(Math.random() * VENTANILLA_IDS.length)],
  };
}

// ─── Helpers HTTP ───────────────────────────────────────────────────────────
const JSON_HEADERS = { 'Content-Type': 'application/json' };

// ─── Setup: activar/desactivar caos antes de las pruebas ───────────────────
export function setup() {
  if (CHAOS_MODE) {
    console.log('🔥 [CHAOS MODE] Activando latencia 800ms + 30% fallos de BD...');
    const res = http.post(
      `${BASE_URL}/api/v1/chaos/config`,
      JSON.stringify({ latency_ms: 800, db_failure_rate: 0.30, server_down: false }),
      { headers: JSON_HEADERS }
    );
    check(res, { 'chaos config aplicada': (r) => r.status === 200 });
  } else {
    // Asegurar caos desactivado en prueba normal
    http.post(
      `${BASE_URL}/api/v1/chaos/config`,
      JSON.stringify({ latency_ms: 0, db_failure_rate: 0.0, server_down: false }),
      { headers: JSON_HEADERS }
    );
    console.log('✅ [NORMAL MODE] Caos desactivado. Iniciando prueba de carga estándar...');
  }

  // Registrar sesiones de operadores activos para poder llamar tickets
  for (let i = 0; i < OPERATOR_IDS.length; i++) {
    http.post(
      `${BASE_URL}/api/v1/operadores/session`,
      JSON.stringify({ id_operador: OPERATOR_IDS[i], id_ventanilla: VENTANILLA_IDS[i % VENTANILLA_IDS.length] }),
      { headers: JSON_HEADERS }
    );
  }

  return { startTime: new Date().toISOString() };
}

// ─── Teardown: restaurar caos a estado normal ───────────────────────────────
export function teardown(data) {
  console.log(`\n🏁 Prueba finalizada. Iniciada: ${data.startTime} | Fin: ${new Date().toISOString()}`);
  http.post(
    `${BASE_URL}/api/v1/chaos/config`,
    JSON.stringify({ latency_ms: 0, db_failure_rate: 0.0, server_down: false }),
    { headers: JSON_HEADERS }
  );
  console.log('🔄 Caos restaurado a valores normales.');
}

// ─── Función principal de VU ────────────────────────────────────────────────
export default function () {
  if (SQA_ONLY) {
    sqaMonitoringScenario();
    return;
  }

  // Escoge aleatoriamente entre crear un ticket o llamar el siguiente
  const roll = Math.random();
  if (roll < 0.70) {
    createTicketScenario();    // 70% del tráfico → creación de tickets
  } else if (roll < 0.90) {
    callNextTicketScenario();  // 20% del tráfico → operadores llamando
  } else {
    sqaMonitoringScenario();   // 10% del tráfico → consulta métricas SQA
  }
}

// ─── ESCENARIO 1: Creación Masiva de Tickets ────────────────────────────────
function createTicketScenario() {
  group('Creación de Ticket (POST /api/v1/tickets)', () => {
    const payload = JSON.stringify({
      nombre:      randomName(),
      dni:         randomDNI(),
      celular:     `9${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`,
      id_servicio: randomServiceId(),
    });

    const startTime = Date.now();
    const res = http.post(`${BASE_URL}/api/v1/tickets`, payload, {
      headers: JSON_HEADERS,
      tags:    { endpoint: 'create_ticket' },
    });
    const duration = Date.now() - startTime;

    ticketCreationTime.add(duration);

    const ok = check(res, {
      'ticket creado (201)':         (r) => r.status === 201,
      'respuesta tiene codigo':       (r) => {
        try { return JSON.parse(r.body).codigo_ticket !== undefined; }
        catch { return false; }
      },
      'latencia < 1s (normal)':      (r) => duration < 1000,
    });

    errorRate.add(!ok);
    if (res.status === 201) ticketsCreated.add(1);

    // Log de degradación bajo caos
    if (CHAOS_MODE && duration > 1500) {
      console.warn(`⚠️  [CAOS] Latencia elevada en ticket creation: ${duration}ms`);
    }
  });

  sleep(Math.random() * 0.5 + 0.1); // 0.1s - 0.6s entre requests
}

// ─── ESCENARIO 2: Llamado del Siguiente Turno ───────────────────────────────
function callNextTicketScenario() {
  group('Llamar Siguiente Ticket (POST /api/v1/tickets/call-next)', () => {
    const { id_operador, id_ventanilla } = randomOperatorAndVentanilla();

    const startTime = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/tickets/call-next?id_operador=${id_operador}&id_ventanilla=${id_ventanilla}`,
      null,
      { tags: { endpoint: 'call_next' } }
    );
    const duration = Date.now() - startTime;

    callNextTime.add(duration);

    const ok = check(res, {
      'ticket llamado (200)':        (r) => r.status === 200,
      'o sin cola (404)':            (r) => r.status === 404,  // aceptable: no hay tickets
      'no error 500 inesperado':     (r) => r.status !== 500 || CHAOS_MODE,
      'latencia aceptable':          (r) => duration < (CHAOS_MODE ? 4000 : 800),
    });

    errorRate.add(res.status >= 500 && !CHAOS_MODE ? 1 : 0);
    if (res.status === 200) ticketsCalled.add(1);

    if (CHAOS_MODE && duration > 2000) {
      console.warn(`⚠️  [CAOS] Degradación en call-next: ${duration}ms (operador ${id_operador})`);
    }
  });

  sleep(Math.random() * 1 + 0.5); // 0.5s - 1.5s entre llamados
}

// ─── ESCENARIO 3: Monitoreo SQA — consulta de métricas ─────────────────────
function sqaMonitoringScenario() {
  group('Monitoreo SQA (GET /api/v1/admin/metrics)', () => {
    const startTime = Date.now();
    const res = http.get(`${BASE_URL}/api/v1/admin/metrics`, {
      tags: { endpoint: 'sqa_metrics' },
    });
    const duration = Date.now() - startTime;

    metricsQueryTime.add(duration);

    check(res, {
      'métricas SQA OK (200)':       (r) => r.status === 200,
      'tiene campo latencias':        (r) => {
        try { return Array.isArray(JSON.parse(r.body).latencias); }
        catch { return false; }
      },
      'tiene uptime':                 (r) => {
        try { return JSON.parse(r.body).uptime_sistema !== undefined; }
        catch { return false; }
      },
      'responde rápido':              (r) => duration < 500,
    });
  });

  // Consultar también la cola activa
  group('Cola Activa (GET /api/v1/tickets/queue)', () => {
    const res = http.get(`${BASE_URL}/api/v1/tickets/queue`, {
      tags: { endpoint: 'queue_status' },
    });
    check(res, {
      'cola OK (200)':               (r) => r.status === 200,
      'respuesta es array':          (r) => {
        try { return Array.isArray(JSON.parse(r.body)); }
        catch { return false; }
      },
    });
  });

  sleep(2); // Las métricas SQA se consultan cada 2s
}
