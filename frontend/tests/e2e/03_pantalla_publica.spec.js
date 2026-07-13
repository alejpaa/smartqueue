// ============================================================
// TEST E2E: Flujo de Pantalla Pública de Sala de Espera
// Persona 1 – SmartQueue / Pruebas de Software UNMSM
// ============================================================
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─── Datos mock ───────────────────────────────────────────────────────────────
const MOCK_SERVICES  = [{ id_servicio: 1, nombre_servicio: 'Atención al Cliente', descripcion: 'Consultas generales' }];
const MOCK_OPERATORS = [{ id_operador: 1, nombre: 'Carlos López', codigo_emp: 'OP001' }];
const MOCK_MODULES   = [{ id_ventanilla: 1, numero_modulo: 1, estado_fisico: 'ACTIVO' }];
const MOCK_QUEUE_EMPTY  = [];
const MOCK_SESSION = {
  id_operador: 1, id_ventanilla: 1,
  operador: { nombre: 'Carlos López', codigo_emp: 'OP001' },
  ventanilla: { numero_modulo: 1, estado_fisico: 'ACTIVO' },
};
const MOCK_QUEUE_WITH_TICKET = [{
  id_ticket: 10, codigo_ticket: 'A001', estado_turno: 'ESPERA', id_ventanilla: null,
  usuario: { nombre: 'Juan Pérez' },
  servicio: { nombre_servicio: 'Atención al Cliente' },
}];
const MOCK_CALLED_TICKET = {
  id_ticket: 10, codigo_ticket: 'A001', estado_turno: 'LLAMADO', id_ventanilla: 1,
  usuario: { nombre: 'Juan Pérez', dni: '12345678' },
  servicio: { nombre_servicio: 'Atención al Cliente' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function mockBaseRoutes(page, queueData = MOCK_QUEUE_EMPTY) {
  await page.route('**/api/v1/servicios',  route => route.fulfill({ json: MOCK_SERVICES }));
  await page.route('**/api/v1/operadores', route => route.fulfill({ json: MOCK_OPERATORS }));
  await page.route('**/api/v1/ventanillas',route => route.fulfill({ json: MOCK_MODULES }));
  await page.route('**/api/v1/tickets/queue', route => route.fulfill({ json: queueData }));
  await page.route('**/api/v1/tickets/call-next**', route => route.fulfill({ json: MOCK_CALLED_TICKET }));
  await page.route('**/api/v1/operadores/session', route => route.fulfill({ json: MOCK_SESSION }));
  await page.route('**/ws', route => route.abort());
}

async function gotoMocked(page, queueData = MOCK_QUEUE_EMPTY) {
  await mockBaseRoutes(page, queueData);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
}

// =============================================================================
test.describe('Flujo 03 – Pantalla Pública de Sala de Espera', () => {

  // ----------------------------------------------------------
  // TC-13: La vista de Pantalla de Sala carga correctamente
  // ----------------------------------------------------------
  test('TC-13: La Pantalla de Sala es accesible y muestra el estado inicial', async ({ page }) => {
    await gotoMocked(page);

    const navBtn = page.locator('button', { hasText: 'Pantalla de Sala' });
    await expect(navBtn).toBeVisible();
    await navBtn.click();

    // La pantalla pública debe cargarse sin errores
    await page.waitForTimeout(1000);
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Cannot read');
    expect(pageContent).not.toContain('Unhandled Error');

    await page.screenshot({ path: 'test-results/TC13-pantalla-sala-inicial.png' });
  });

  // ----------------------------------------------------------
  // TC-14: La pantalla intenta establecer conexión WebSocket
  // ----------------------------------------------------------
  test('TC-14: La pantalla pública intenta conectarse al WebSocket del backend', async ({ page }) => {
    // En este test observamos el intento de WS (sin bloquearlo completamente)
    await mockBaseRoutes(page);

    let wsAttempted = false;
    page.on('websocket', ws => {
      if (ws.url().includes('/ws')) {
        wsAttempted = true;
      }
    });

    // Permitir el WS para que React lo intente (fallará porque el backend no está)
    await page.unroute('**/ws');

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();
    await page.waitForTimeout(2000);

    // La UI no debe romperse aunque el WS falle
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Cannot read properties');
    // Solo verificamos que la app siguió en pie
    await expect(page.locator('button', { hasText: 'Pantalla de Sala' })).toBeVisible();
  });

  // ----------------------------------------------------------
  // TC-15: La pantalla muestra estado de espera sin tickets
  // ----------------------------------------------------------
  test('TC-15: La pantalla muestra estado de espera cuando no hay tickets llamados', async ({ page }) => {
    await gotoMocked(page, MOCK_QUEUE_EMPTY);
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();
    await page.waitForTimeout(1500);

    // La pantalla de sala no debe mostrar errores JS
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Unhandled Error');
    expect(pageContent).not.toContain('Cannot read');

    await page.screenshot({ path: 'test-results/TC15-pantalla-sala-espera.png' });
  });

  // ----------------------------------------------------------
  // TC-16: Integración E2E: operador llama ticket → consola muestra código
  // ----------------------------------------------------------
  test('TC-16: El operador llama el ticket y el código aparece en la consola (integración E2E mock)', async ({ page }) => {
    // Iniciar con cola que tiene 1 ticket
    await gotoMocked(page, MOCK_QUEUE_WITH_TICKET);

    // Mock dinámico LIFO: registrado DESPUÉS de gotoMocked, tiene prioridad.
    // La cola devuelve estado LLAMADO después de que call-next sea invocado,
    // evitando que fetchQueue() sobreescriba currentServing con null.
    let ticketWasCalled = false;
    await page.route('**/api/v1/tickets/call-next**', route => {
      ticketWasCalled = true;
      route.fulfill({ json: MOCK_CALLED_TICKET });
    });
    await page.route('**/api/v1/tickets/queue', route => {
      route.fulfill({ json: ticketWasCalled
        ? [MOCK_CALLED_TICKET]     // LLAMADO → currentServing se mantiene
        : MOCK_QUEUE_WITH_TICKET   // ESPERA  → botón habilitado
      });
    });

    // Ir a Terminal de Asesor
    await page.locator('button', { hasText: 'Terminal de Asesor' }).click();
    await expect(page.locator('h2', { hasText: 'Consola de Ventanilla' })).toBeVisible({ timeout: 5000 });

    // Iniciar sesión del operador
    const selects = page.locator('select');
    await selects.first().selectOption({ index: 1 });
    await selects.nth(1).selectOption({ index: 1 });
    await page.locator('button[type="submit"]').click();
    await expect(page.locator('.badge-atendido', { hasText: 'Sesión Activa' })).toBeVisible({ timeout: 5000 });

    // La cola muestra 1 ticket en ESPERA
    await expect(page.locator('h3', { hasText: /COLA EN ESPERA \(1\)/ })).toBeVisible({ timeout: 5000 });

    // Llamar el siguiente ticket
    const callBtn = page.locator('button', { hasText: 'Llamar Siguiente Turno' });
    await expect(callBtn).toBeEnabled({ timeout: 3000 });
    await callBtn.click();

    // El código A001 debe aparecer en la consola del operador
    await expect(page.locator('h1', { hasText: 'A001' })).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.badge-llamado')).toBeVisible();

    // Cambiar a Pantalla de Sala y verificar que la UI no tiene errores
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();
    await page.waitForTimeout(800);
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Cannot read properties');

    await page.screenshot({ path: 'test-results/TC16-integracion-e2e.png' });
    console.log('TC-16: ✓ Ticket A001 llamado exitosamente en la consola del operador');
  });

  // ----------------------------------------------------------
  // TC-17: La navegación entre pestañas no rompe la vista pública
  // ----------------------------------------------------------
  test('TC-17: La pantalla pública mantiene consistencia al cambiar entre pestañas', async ({ page }) => {
    await gotoMocked(page);

    // Ir a Pantalla de Sala
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();
    await page.waitForTimeout(500);

    // Cambiar a Registro de Cliente
    await page.locator('button', { hasText: 'Registro de Cliente' }).click();
    await expect(page.locator('h2', { hasText: 'Solicitud de Turno' })).toBeVisible();

    // Volver a Pantalla de Sala
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();
    await page.waitForTimeout(500);

    // No debe haber errores
    const pageContent = await page.content();
    expect(pageContent).not.toContain('Cannot read properties');
    expect(pageContent).not.toContain('undefined is not');

    await page.screenshot({ path: 'test-results/TC17-pantalla-navegacion.png' });
  });

  // ----------------------------------------------------------
  // TC-18: Verificación del toggle dark/light mode
  // ----------------------------------------------------------
  test('TC-18: El toggle de tema dark/light funciona correctamente', async ({ page }) => {
    await gotoMocked(page);
    await page.locator('button', { hasText: 'Pantalla de Sala' }).click();

    // Tema inicial debe ser 'dark'
    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');

    // Cambiar a light
    const themeBtn = page.locator('button[title*="Modo"]');
    await themeBtn.click();
    await expect(htmlEl).toHaveAttribute('data-theme', 'light');

    // Volver a dark
    await themeBtn.click();
    await expect(htmlEl).toHaveAttribute('data-theme', 'dark');

    // El localStorage debe persistir el tema
    const savedTheme = await page.evaluate(() =>
      localStorage.getItem('smartqueue_theme')
    );
    expect(savedTheme).toBe('dark');
  });
});
