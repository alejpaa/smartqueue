// @ts-check
// ============================================================
// CONFIGURACIÓN DE PLAYWRIGHT – SmartQueue E2E
// Persona 1 – Pruebas de Software UNMSM
// ============================================================
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directorio donde están los tests E2E
  testDir: './tests/e2e',

  // Correr tests de forma paralela
  fullyParallel: false,

  // En CI, fallar si hay test.only accidental
  forbidOnly: !!process.env.CI,

  // Reintentos: 1 en local, 2 en CI (tolerancia a flakiness por caos)
  retries: process.env.CI ? 2 : 1,

  // Workers: 1 en CI para evitar condiciones de carrera en la BD
  workers: process.env.CI ? 1 : 2,

  // Reporte HTML interactivo + reporte de línea de comandos
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  // Configuración global de todos los tests
  use: {
    // URL base del frontend (Vite dev server)
    baseURL: 'http://localhost:5173',

    // Capturar trazas en reintentos para depuración
    trace: 'on-first-retry',

    // Captura de pantalla solo en fallos
    screenshot: 'only-on-failure',

    // Video: grabar en fallos para evidencia en el reporte
    video: 'retain-on-failure',

    // Tiempo máximo de espera para acciones
    actionTimeout: 10000,

    // Tiempo máximo de espera para navegación
    navigationTimeout: 15000,
  },

  // Directorio de salida de resultados (screenshots, videos)
  outputDir: 'test-results/',

  // Tiempo máximo global por test (30s – tolerante al middleware de caos)
  timeout: 30000,

  // Proyectos: solo Chromium para demos locales; ampliar en CI
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Descomentar para pruebas multi-browser en CI:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Servidor de desarrollo: Playwright levanta Vite automáticamente antes de los tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,  // Si ya está corriendo, lo reutiliza
    timeout: 60 * 1000,         // 60s para iniciar Vite
  },
});
