// ============================================================
// TEST E2E: Flujo de Registro de Cliente
// Persona 1 – SmartQueue / Pruebas de Software UNMSM
// ============================================================
// Cubre el criterio C4 de la rúbrica (Automatización UI/E2E)
//
// FLUJO PROBADO:
//   1. El cliente accede a la vista "Registro de Cliente"
//   2. Ingresa su nombre, DNI y (opcionalmente) celular
//   3. Selecciona un servicio disponible
//   4. Envía el formulario y recibe el ticket con código y QR
//
// NOTA: Los tests TC-01 a TC-06 usan mocks del backend (page.route)
//       para correr sin necesitar el servidor FastAPI activo.
//       TC-04 intenta contra el backend real y se salta si no está.
// ============================================================

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

// ─── Datos mock del backend ───────────────────────────────────────────────────
const MOCK_SERVICES = [
  { id_servicio: 1, nombre_servicio: 'Atención al Cliente', descripcion: 'Consultas generales' },
  { id_servicio: 2, nombre_servicio: 'Pagos y Cobros', descripcion: 'Trámites de pago' },
];
const MOCK_OPERATORS = [
  { id_operador: 1, nombre: 'Carlos López', codigo_emp: 'OP001' },
];
const MOCK_MODULES = [
  { id_ventanilla: 1, numero_modulo: 1, estado_fisico: 'ACTIVO' },
];
const MOCK_TICKET = {
  id_ticket: 1,
  codigo_ticket: 'A001',
  estado_turno: 'ESPERA',
  tiempo_espera_estimado: 5,
  usuario: { nombre: 'Juan Pérez García', dni: '12345678' },
  servicio: { nombre_servicio: 'Atención al Cliente' },
};

// ─── Helper: interceptar todas las llamadas al backend con mocks ──────────────
async function mockBackendRoutes(page) {
  await page.route('**/api/v1/servicios', route =>
    route.fulfill({ json: MOCK_SERVICES })
  );
  await page.route('**/api/v1/operadores', route =>
    route.fulfill({ json: MOCK_OPERATORS })
  );
  await page.route('**/api/v1/ventanillas', route =>
    route.fulfill({ json: MOCK_MODULES })
  );
  await page.route('**/api/v1/tickets', route => {
    if (route.request().method() === 'POST') {
      route.fulfill({ json: MOCK_TICKET });
    } else {
      route.continue();
    }
  });
  // Bloquear WebSocket para tests que no lo necesitan
  await page.route('**/ws', route => route.abort());
}

// ─── Helper: navegar a la app con mocks activos ───────────────────────────────
async function gotoMocked(page) {
  await mockBackendRoutes(page);
  await page.goto(BASE_URL);
  await page.waitForLoadState('networkidle');
}

// ─── Helper: ir a la pestaña de Registro de Cliente ──────────────────────────
async function goToClientTab(page) {
  const navBtn = page.locator('button', { hasText: 'Registro de Cliente' });
  await navBtn.click();
  await expect(page.locator('h2', { hasText: 'Solicitud de Turno' })).toBeVisible({ timeout: 5000 });
}

// =============================================================================
test.describe('Flujo 01 – Registro de Cliente y Generación de Ticket', () => {

  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('smartqueue_active_ticket')).catch(() => {});
  });

  // ----------------------------------------------------------
  // TC-01: Carga correcta de la vista de registro
  // ----------------------------------------------------------
  test('TC-01: La vista de Registro de Cliente carga correctamente', async ({ page }) => {
    await gotoMocked(page);

    const navBtn = page.locator('button', { hasText: 'Registro de Cliente' });
    await expect(navBtn).toBeVisible();
    await navBtn.click();

    // El formulario de solicitud de turno debe ser visible
    await expect(page.locator('h2', { hasText: 'Solicitud de Turno' })).toBeVisible();
    await expect(page.locator('input[placeholder*="Alejandro"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="77777777"]')).toBeVisible();
  });

  // ----------------------------------------------------------
  // TC-02: Validación de campos obligatorios vacíos
  // ----------------------------------------------------------
  test('TC-02: Muestra error JS si falta seleccionar servicio (campos requeridos)', async ({ page }) => {
    await gotoMocked(page);
    await goToClientTab(page);

    // Llenar nombre y DNI para que el navegador no bloquee esos campos required.
    // El servicio NO se selecciona → idServicio queda vacío.
    await page.locator('input[placeholder*="Alejandro"]').fill('Test Usuario');
    await page.locator('input[placeholder*="77777777"]').fill('12345678');

    // dispatchEvent('submit') salta la validación HTML5 nativa del navegador
    // y dispara el handler onSubmit de React directamente.
    await page.locator('form').dispatchEvent('submit');

    // El texto exacto del div de error en ClientView
    await expect(
      page.getByText('Por favor complete todos los campos obligatorios (*).') 
    ).toBeVisible({ timeout: 3000 });
  });

  // ----------------------------------------------------------
  // TC-03: Validación del campo DNI (solo números, máx 8)
  // ----------------------------------------------------------
  test('TC-03: El campo DNI solo acepta hasta 8 dígitos numéricos', async ({ page }) => {
    await gotoMocked(page);
    await goToClientTab(page);

    const dniInput = page.locator('input[placeholder*="77777777"]');
    // Intentar ingresar letras mezcladas con números
    await dniInput.fill('ABCD1234');
    const value = await dniInput.inputValue();
    // El campo debe filtrar letras y solo mostrar dígitos
    expect(value).toMatch(/^\d+$/);
    expect(value.length).toBeLessThanOrEqual(8);
  });

  // ----------------------------------------------------------
  // TC-04: Generación exitosa de ticket (con mock del backend)
  // ----------------------------------------------------------
  test('TC-04: El cliente genera un ticket con código y visualización QR', async ({ page }) => {
    await gotoMocked(page);
    await goToClientTab(page);

    // Esperar a que los servicios mock carguen
    await expect(page.locator('h4', { hasText: 'Atención al Cliente' })).toBeVisible({ timeout: 5000 });

    // Llenar el formulario
    await page.locator('input[placeholder*="Alejandro"]').fill('Juan Pérez García');
    await page.locator('input[placeholder*="77777777"]').fill('12345678');
    await page.locator('input[placeholder*="999"]').fill('987654321');

    // Seleccionar el primer servicio
    await page.locator('h4', { hasText: 'Atención al Cliente' }).click();

    // Enviar el formulario
    await page.locator('button[type="submit"]', { hasText: 'Solicitar Turno' }).click();

    // Esperar la confirmación del ticket
    await expect(page.locator('h3', { hasText: 'Turno Confirmado' })).toBeVisible({ timeout: 8000 });

    // Verificar que el código de ticket A001 se muestra
    await expect(page.locator('h1', { hasText: 'A001' })).toBeVisible();

    // Verificar que el QR visual está presente
    await expect(page.locator('p', { hasText: 'Verificación digital' })).toBeVisible();

    // Verificar el badge de estado ESPERA
    await expect(page.locator('.badge-espera')).toBeVisible();

    // Captura de pantalla como evidencia
    await page.screenshot({ path: 'test-results/TC04-ticket-generado.png' });
  });

  // ----------------------------------------------------------
  // TC-05: El ticket se persiste en localStorage (tolerancia a fallos)
  // ----------------------------------------------------------
  test('TC-05: El ticket guardado en localStorage se carga automáticamente al recargar', async ({ page }) => {
    // Navegar con mocks activos primero para inicializar
    await gotoMocked(page);

    // Inyectar ticket mock en localStorage
    await page.evaluate((ticket) => {
      localStorage.setItem('smartqueue_active_ticket', JSON.stringify(ticket));
    }, MOCK_TICKET);

    // Recargar con mocks activos – el ticket debe aparecer automáticamente
    await page.route('**/api/v1/servicios', route => route.fulfill({ json: MOCK_SERVICES }));
    await page.route('**/api/v1/operadores', route => route.fulfill({ json: MOCK_OPERATORS }));
    await page.route('**/api/v1/ventanillas', route => route.fulfill({ json: MOCK_MODULES }));
    await page.route('**/ws', route => route.abort());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // La vista de cliente es la pestaña por defecto y debe mostrar el ticket guardado
    await expect(
      page.locator('h3', { hasText: 'Turno Confirmado' })
    ).toBeVisible({ timeout: 6000 });

    await expect(page.locator('h1', { hasText: 'A001' })).toBeVisible();
  });

  // ----------------------------------------------------------
  // TC-06: Botón "Solicitar Nuevo Turno" limpia el estado
  // ----------------------------------------------------------
  test('TC-06: El botón "Solicitar Nuevo Turno" limpia el ticket y muestra el formulario', async ({ page }) => {
    await gotoMocked(page);

    // Inyectar ticket mock en localStorage
    await page.evaluate((ticket) => {
      localStorage.setItem('smartqueue_active_ticket', JSON.stringify(ticket));
    }, MOCK_TICKET);

    // Recargar con mocks
    await page.route('**/api/v1/servicios', route => route.fulfill({ json: MOCK_SERVICES }));
    await page.route('**/api/v1/operadores', route => route.fulfill({ json: MOCK_OPERATORS }));
    await page.route('**/api/v1/ventanillas', route => route.fulfill({ json: MOCK_MODULES }));
    await page.route('**/ws', route => route.abort());

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Confirmar que el ticket mock está visible
    await expect(page.locator('h1', { hasText: 'A001' })).toBeVisible({ timeout: 6000 });

    // Hacer clic en "Solicitar Nuevo Turno"
    await page.locator('button', { hasText: 'Solicitar Nuevo Turno' }).click();

    // El formulario debe volver a mostrarse
    await expect(page.locator('h2', { hasText: 'Solicitud de Turno' })).toBeVisible();

    // El localStorage debe haberse limpiado
    const storedTicket = await page.evaluate(() =>
      localStorage.getItem('smartqueue_active_ticket')
    );
    expect(storedTicket).toBeNull();
  });
});
