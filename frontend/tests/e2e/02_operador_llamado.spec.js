// ============================================================
// TEST E2E: Flujo de Operador – Inicio de Sesión y Llamado
// Persona 1 – SmartQueue / Pruebas de Software UNMSM
// ============================================================
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─── Datos mock ───────────────────────────────────────────────────────────────
const MOCK_SERVICES = [
  { id_servicio: 1, nombre_servicio: 'Atención al Cliente', descripcion: 'Consultas generales' },
];
const MOCK_OPERATORS = [
  { id_operador: 1, nombre: 'Carlos López', codigo_emp: 'OP001' },
  { id_operador: 2, nombre: 'Ana Martínez', codigo_emp: 'OP002' },
];
const MOCK_MODULES = [
  { id_ventanilla: 1, numero_modulo: 1, estado_fisico: 'ACTIVO' },
  { id_ventanilla: 2, numero_modulo: 2, estado_fisico: 'ACTIVO' },
];
const MOCK_SESSION = {
  id_operador: 1,
  id_ventanilla: 1,
  operador: { nombre: 'Carlos López', codigo_emp: 'OP001' },
  ventanilla: { numero_modulo: 1, estado_fisico: 'ACTIVO' },
};
const MOCK_QUEUE_WITH_TICKET = [
  {
    id_ticket: 10,
    codigo_ticket: 'A001',
    estado_turno: 'ESPERA',
    id_ventanilla: null,
    usuario: { nombre: 'Juan Pérez' },
    servicio: { nombre_servicio: 'Atención al Cliente' },
  },
];
const MOCK_CALLED_TICKET = {
  id_ticket: 10,
  codigo_ticket: 'A001',
  estado_turno: 'LLAMADO',
  id_ventanilla: 1,
  usuario: { nombre: 'Juan Pérez', dni: '12345678' },
  servicio: { nombre_servicio: 'Atención al Cliente' },
};

// ─── Helper: mockear todas las rutas del backend ──────────────────────────────
async function mockBackendRoutes(page) {
  await page.route('**/api/v1/servicios', route => route.fulfill({ json: MOCK_SERVICES }));
  await page.route('**/api/v1/operadores', route => route.fulfill({ json: MOCK_OPERATORS }));
  await page.route('**/api/v1/ventanillas', route => route.fulfill({ json: MOCK_MODULES }));
  await page.route('**/api/v1/operadores/session', route => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/api/v1/tickets/queue', route => route.fulfill({ json: MOCK_QUEUE_WITH_TICKET }));
  await page.route('**/api/v1/tickets/call-next**', route => route.fulfill({ json: MOCK_CALLED_TICKET }));
  await page.route('**/api/v1/tickets/**/close', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/v1/tickets/**/no-show', route => route.fulfill({ json: { ok: true } }));
  // Mock WebSocket sin conexión real
  await page.route('**/ws', route => route.abort());
}

async function gotoMocked(page) {
  await mockBackendRoutes(page);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
}

async function goToOperatorTab(page) {
  await page.locator('button', { hasText: 'Terminal de Asesor' }).click();
  await expect(page.locator('h2', { hasText: 'Consola de Ventanilla' })).toBeVisible({ timeout: 5000 });
}

async function loginOperator(page) {
  // Seleccionar primer operador y primer módulo
  const selects = page.locator('select');
  await selects.first().selectOption({ index: 1 });
  await selects.nth(1).selectOption({ index: 1 });
  await page.locator('button[type="submit"]', { hasText: 'Iniciar Sesión' }).click();
  await expect(page.locator('.badge-atendido', { hasText: 'Sesión Activa' })).toBeVisible({ timeout: 5000 });
}

// =============================================================================
test.describe('Flujo 02 – Operador: Inicio de Sesión y Llamado de Ticket', () => {

  test.beforeEach(async ({ page }) => {
    // No hay estado previo que limpiar para el operador
  });

  // ----------------------------------------------------------
  // TC-07: La vista de Terminal de Asesor carga correctamente
  // ----------------------------------------------------------
  test('TC-07: La Terminal de Asesor es accesible desde la navegación', async ({ page }) => {
    await gotoMocked(page);

    const navBtn = page.locator('button', { hasText: 'Terminal de Asesor' });
    await expect(navBtn).toBeVisible();
    await navBtn.click();

    await expect(page.locator('h2', { hasText: 'Consola de Ventanilla' })).toBeVisible();
    // Los dos selects (asesor y módulo) deben estar presentes
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();
    await expect(selects.nth(1)).toBeVisible();
  });

  // ----------------------------------------------------------
  // TC-08: Validación de campos obligatorios en el login
  // ----------------------------------------------------------
  test('TC-08: Muestra error JS si se omiten operador y módulo al iniciar sesión', async ({ page }) => {
    await gotoMocked(page);
    await goToOperatorTab(page);

    // dispatchEvent('submit') salta la validación HTML5 nativa (selects con required)
    // y dispara el handler onSubmit de React directamente.
    await page.locator('form').dispatchEvent('submit');

    // El texto exacto del div de error en OperatorView
    await expect(
      page.getByText('Debe seleccionar Operador y Ventanilla/Módulo.')
    ).toBeVisible({ timeout: 3000 });
  });

  // ----------------------------------------------------------
  // TC-09: El operador inicia sesión correctamente
  // ----------------------------------------------------------
  test('TC-09: El operador puede seleccionar asesor, módulo e iniciar sesión', async ({ page }) => {
    await gotoMocked(page);
    await goToOperatorTab(page);

    // Los selects deben tener opciones cargadas desde el mock
    await expect(page.locator('select').first().locator('option').nth(1)).toBeAttached();

    await loginOperator(page);

    // El panel de atención debe aparecer
    await expect(page.locator('h3', { hasText: 'CONSOLA DE LLAMADO' })).toBeVisible();
    // El nombre del operador debe mostrarse
    await expect(page.locator('h4', { hasText: 'Carlos López' })).toBeVisible();
    // El número de módulo
    await expect(page.locator('strong', { hasText: '1' }).first()).toBeVisible();

    await page.screenshot({ path: 'test-results/TC09-sesion-operador-activa.png' });
  });

  // ----------------------------------------------------------
  // TC-10: El operador llama al siguiente ticket de la cola
  // ----------------------------------------------------------
  test('TC-10: El operador puede llamar el siguiente ticket y ver el código en pantalla', async ({ page }) => {
    // Iniciar con cola que tiene 1 ticket
    await gotoMocked(page, MOCK_QUEUE_WITH_TICKET);

    // Mock dinámico: la cola devuelve estado LLAMADO DESPUÉS de que call-next sea invocado.
    // Esto evita que fetchQueue() sobreescriba currentServing con null.
    let ticketWasCalled = false;
    await page.route('**/api/v1/tickets/call-next**', route => {
      ticketWasCalled = true;
      route.fulfill({ json: MOCK_CALLED_TICKET });
    });
    await page.route('**/api/v1/tickets/queue', route => {
      route.fulfill({ json: ticketWasCalled
        ? [MOCK_CALLED_TICKET]          // Ticket en estado LLAMADO
        : MOCK_QUEUE_WITH_TICKET        // Ticket en estado ESPERA
      });
    });

    await goToOperatorTab(page);
    await loginOperator(page);

    // La cola debe mostrar 1 ticket en ESPERA
    await expect(page.locator('h3', { hasText: /COLA EN ESPERA \(1\)/ })).toBeVisible({ timeout: 5000 });

    // El botón debe estar habilitado
    const callBtn = page.locator('button', { hasText: 'Llamar Siguiente Turno' });
    await expect(callBtn).toBeEnabled({ timeout: 3000 });
    await callBtn.click();

    // El código A001 debe aparecer en la consola del operador
    await expect(page.locator('h1', { hasText: 'A001' })).toBeVisible({ timeout: 8000 });

    // El badge "Llamado en Ventanilla" debe aparecer
    await expect(page.locator('.badge-llamado')).toBeVisible();

    // Los 3 botones de acción deben estar disponibles
    await expect(page.locator('button', { hasText: 'Re-Llamar' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Inasistencia' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Finalizar Turno' })).toBeVisible();

    await page.screenshot({ path: 'test-results/TC10-ticket-llamado.png' });
  });

  // ----------------------------------------------------------
  // TC-11: El indicador WebSocket muestra estado de conexión
  // ----------------------------------------------------------
  test('TC-11: El dashboard del operador muestra el estado del canal WebSocket', async ({ page }) => {
    await gotoMocked(page);
    await goToOperatorTab(page);
    await loginOperator(page);

    // El panel de sesión debe mostrar la fila de "Canal WebSocket"
    await expect(page.locator('span', { hasText: 'Canal WebSocket:' })).toBeVisible();

    // El estado puede ser "Desconectado" (WS mockeado como abortado) o "Reconectando"
    // Lo importante es que no cause un error en la UI
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Unhandled Error');
  });

  // ----------------------------------------------------------
  // TC-12: El botón "Salir" finaliza la sesión del operador
  // ----------------------------------------------------------
  test('TC-12: El botón "Salir" termina la sesión y regresa al formulario de login', async ({ page }) => {
    await gotoMocked(page);
    await goToOperatorTab(page);
    await loginOperator(page);

    // Hacer clic en "Salir"
    await page.locator('button', { hasText: 'Salir' }).click();

    // El formulario de inicio de sesión debe volver a aparecer
    await expect(page.locator('h2', { hasText: 'Consola de Ventanilla' })).toBeVisible();
    await expect(page.locator('button[type="submit"]', { hasText: 'Iniciar Sesión' })).toBeVisible();
    // Verificar que el dashboard ya no está visible
    await expect(page.locator('.badge-atendido')).not.toBeVisible();
  });
});
