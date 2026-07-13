# 7. Reporte de Pruebas E2E – Automatización de Interfaz
## Ítem 7 (Sección E2E) – Criterio C4: Automatización de Pruebas UI

---

## 7.1 Resumen Ejecutivo

| Parámetro | Valor |
|---|---|
| **Herramienta utilizada** | Playwright v1.61.x |
| **Framework de testing** | @playwright/test |
| **Lenguaje de los scripts** | JavaScript (ES Modules) |
| **Browser principal** | Chromium (Desktop Chrome) |
| **Flujos cubiertos** | 3 (Registro, Llamado, Pantalla Pública) |
| **Total de casos de prueba** | 18 test cases |
| **Directorio de tests** | `frontend/tests/e2e/` |
| **Directorio de resultados** | `frontend/test-results/` |
| **Reporte HTML** | `frontend/playwright-report/index.html` |

---

## 7.2 Estrategia de Pruebas E2E

### Enfoque Adoptado

Las pruebas E2E (End-to-End) automatizan las interacciones reales de un usuario con la interfaz del sistema, validando que los flujos completos funcionen correctamente desde el frontend hasta el backend y vuelta. Se adoptó el principio de **"probar lo que el usuario hace"**, no lo que el código interno hace.

### Criterios de Diseño de los Tests

1. **Independencia**: Cada test puede ejecutarse de manera aislada sin depender del estado dejado por otro test.
2. **Idempotencia**: Los tests son seguros para re-ejecutar; limpian su estado en `beforeEach`.
3. **Tolerancia al caos**: Los timeouts están configurados en 30 segundos para tolerar el middleware de caos (latencia máxima de ~2s).
4. **Modo degradado**: Los tests que dependen del backend se marcan con `test.skip()` automáticamente si el servidor no está disponible, en lugar de fallar.
5. **Evidencia fotográfica**: Cada test crítico genera screenshots guardados en `test-results/`.

### Decisión de Herramienta: Playwright vs Cypress

| Criterio | Playwright ✅ | Cypress |
|---|---|---|
| Multi-browser nativo | Chromium, Firefox, WebKit | Solo Chromium base |
| WebSocket testing | Soportado nativo | Limitado |
| Múltiples páginas simultáneas | Soportado (TC-16) | No soportado |
| Sin restricción same-origin | ✅ | ❌ |
| Integración CI/CD | GitHub Actions oficial | Requiere config adicional |
| Licencia | Apache 2.0 (gratuito) | Gratuito con limitaciones |

**Conclusión**: Playwright fue seleccionado por su soporte nativo de WebSockets (crítico para TC-14 y TC-16), la posibilidad de abrir múltiples páginas simultáneas en el mismo test (TC-16 simula operador + pantalla pública a la vez) y su integración directa con GitHub Actions.

---

## 7.3 Descripción de los Casos de Prueba

### Archivo 1: `01_registro_cliente.spec.js`
**Flujo**: Registro de Cliente y Generación de Ticket

| TC | Descripción | Tipo | Requiere Backend |
|---|---|---|---|
| TC-01 | La vista de Registro de Cliente carga correctamente | Smoke Test | No |
| TC-02 | Muestra error si se envía el formulario vacío | Validación (Caja Negra) | No |
| TC-03 | El campo DNI solo acepta hasta 8 dígitos numéricos | Validación límite | No |
| TC-04 | El cliente genera un ticket con código y visualización QR | Flujo principal E2E | **Sí** |
| TC-05 | El ticket generado se guarda en localStorage | Resiliencia/SQA | No |
| TC-06 | El botón "Solicitar Nuevo Turno" limpia el estado | Flujo de reset | No |

**Técnicas de diseño aplicadas**:
- **Partición de equivalencia** (TC-02): Campo vacío vs campo lleno.
- **Valor límite** (TC-03): DNI de 8 dígitos exactos (límite superior), letras (clase inválida).
- **Caso de uso nominal** (TC-04): Flujo feliz completo.
- **Caso de uso de resiliencia** (TC-05, TC-06): Comportamiento ante pérdida de conexión y recuperación.

---

### Archivo 2: `02_operador_llamado.spec.js`
**Flujo**: Operador – Inicio de Sesión y Llamado de Ticket

| TC | Descripción | Tipo | Requiere Backend |
|---|---|---|---|
| TC-07 | La Terminal de Asesor es accesible desde la navegación | Smoke Test | No |
| TC-08 | Muestra error si se intenta iniciar sesión sin campos | Validación | No |
| TC-09 | El operador puede seleccionar asesor, módulo e iniciar sesión | Flujo principal E2E | **Sí** |
| TC-10 | El operador puede llamar el siguiente ticket y ver el código | Flujo principal E2E | **Sí** |
| TC-11 | El indicador WebSocket muestra estado de conexión | Integración tiempo real | **Sí** |
| TC-12 | El botón "Salir" termina la sesión y regresa al login | Flujo de cierre | **Sí** |

**Técnicas de diseño aplicadas**:
- **Relación M:N** (TC-09): Verifica que la asignación operador-ventanilla funciona correctamente.
- **Estado de UI reactivo** (TC-11): Verifica el indicador de conexión WebSocket.
- **Flujo alternativo** (TC-12): Camino de salida de la sesión.

---

### Archivo 3: `03_pantalla_publica.spec.js`
**Flujo**: Pantalla Pública de Sala de Espera

| TC | Descripción | Tipo | Requiere Backend |
|---|---|---|---|
| TC-13 | La Pantalla de Sala es accesible y muestra el estado inicial | Smoke Test | No |
| TC-14 | La pantalla establece conexión WebSocket con el backend | Integración WS | **Sí** |
| TC-15 | La pantalla muestra estado de espera cuando no hay tickets | Estado vacío | Parcial |
| TC-16 | La pantalla se actualiza automáticamente al llamar un ticket | **Integración E2E completa** | **Sí** |
| TC-17 | La navegación entre pestañas no rompe la vista pública | Estabilidad UI | No |
| TC-18 | El toggle de tema dark/light funciona correctamente | UI/UX | No |

**Técnicas de diseño aplicadas**:
- **Prueba de integración de extremo a extremo** (TC-16): Usa 2 contextos de browser simultáneos para simular el flujo real completo (operador + pantalla pública).
- **Prueba de WebSocket** (TC-14): Intercepta eventos de WebSocket para verificar conectividad.
- **Prueba de estado vacío** (TC-15): Verifica comportamiento con cola sin tickets.
- **Prueba de regresión de UI** (TC-17, TC-18): Valida estabilidad de componentes tras interacciones complejas.

---

## 7.4 Configuración del Entorno de Pruebas

### `playwright.config.js` – Parámetros Clave

```javascript
{
  testDir: './tests/e2e',      // Directorio de specs
  fullyParallel: false,         // Secuencial (evita race conditions en BD)
  retries: 1,                   // 1 reintento en local (tolerancia a caos)
  workers: 2,                   // 2 workers en local
  timeout: 30000,               // 30s por test (caos puede añadir ~2s de latencia)
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
  }
}
```

### Comandos de Ejecución

```bash
# Ejecutar todos los tests (modo headless)
npm run test:e2e

# Ejecutar con browser visible (para demo en vivo)
npm run test:e2e:headed

# Abrir UI interactiva de Playwright
npm run test:e2e:ui

# Ver reporte HTML del último run
npm run test:e2e:report

# Solo Chromium (más rápido para validaciones rápidas)
npm run test:e2e:chromium
```

---

## 7.5 Resultados de la Suite (Plantilla de Llenado)

> [!NOTE]
> Esta sección debe completarse con los resultados reales después de ejecutar la suite con el backend corriendo. La plantilla está lista para ser llenada con datos reales.

### Resumen de Ejecución

| Metric | Valor |
|---|---|
| Total de tests | 18 |
| ✅ Pasados | _completar_ |
| ❌ Fallados | _completar_ |
| ⏭️ Saltados (backend offline) | _completar_ |
| Tiempo total de ejecución | _completar_ (ej: 45.3s) |
| Browser | Chromium |
| Fecha de ejecución | _completar_ |

### Resultados por Archivo

| Archivo | TC | Estado | Duración | Observaciones |
|---|---|---|---|---|
| `01_registro_cliente.spec.js` | TC-01 | ✅ / ❌ | _ms_ | |
| `01_registro_cliente.spec.js` | TC-02 | ✅ / ❌ | _ms_ | |
| `01_registro_cliente.spec.js` | TC-03 | ✅ / ❌ | _ms_ | |
| `01_registro_cliente.spec.js` | TC-04 | ✅ / ❌ | _ms_ | |
| `01_registro_cliente.spec.js` | TC-05 | ✅ / ❌ | _ms_ | |
| `01_registro_cliente.spec.js` | TC-06 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-07 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-08 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-09 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-10 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-11 | ✅ / ❌ | _ms_ | |
| `02_operador_llamado.spec.js` | TC-12 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-13 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-14 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-15 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-16 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-17 | ✅ / ❌ | _ms_ | |
| `03_pantalla_publica.spec.js` | TC-18 | ✅ / ❌ | _ms_ | |

### Capturas de Pantalla de Evidencia

> Adjuntar capturas generadas en `frontend/test-results/`:
> - `TC04-ticket-generado.png` — Ticket con código y QR
> - `TC09-sesion-operador-activa.png` — Dashboard del operador activo
> - `TC10-ticket-llamado.png` — Código del ticket en la consola del operador
> - `TC13-pantalla-sala-inicial.png` — Pantalla de sala en estado inicial
> - `TC15-pantalla-sala-espera.png` — Pantalla de sala sin tickets
> - `TC16-pantalla-actualizada.png` — Pantalla de sala con ticket llamado (integración E2E)
> - `TC16-operador-llamando.png` — Terminal del operador durante el llamado
> - `TC17-pantalla-navegacion.png` — Pantalla tras cambio de pestaña

---

## 7.6 Análisis de Cobertura Funcional E2E

```
Funcionalidades del sistema vs cobertura de tests E2E:

✅ F01 – Registro de cliente con DNI         → TC-04, TC-03
✅ F02 – Ticket digital con QR               → TC-04
✅ F03 – Persistencia en localStorage        → TC-05, TC-06
✅ F04 – Asignación operador-ventanilla (M:N)→ TC-09
✅ F05 – Llamado del siguiente ticket        → TC-10, TC-16
✅ F06 – Acciones: Re-llamar, Finalizar      → TC-10 (verifica visibilidad de botones)
✅ F07 – Pantalla pública en tiempo real     → TC-16 (integración completa)
⚠️ F08 – TTS (síntesis de voz)              → TC-16 (indirecto; requiere verificación manual)
❌ F09 – Panel SQA / AdminView              → No cubierto en esta suite
❌ F10 – Middleware de caos                  → Cubierto por reintentos en TC-04
✅ F11 – Tolerancia a fallos UI             → TC-02, TC-08, TC-15

Cobertura funcional E2E: 8/11 funcionalidades = 73%
```

---

## 7.7 Defectos Encontrados durante el Desarrollo de la Suite

| ID | Descripción | Severidad | Estado |
|---|---|---|---|
| BUG-E2E-01 | El selector de servicios no tiene `data-testid`, dificultando la localización robusta | Media | Documentado |
| BUG-E2E-02 | El TTS no puede verificarse automáticamente con Playwright (API de Audio no expuesta) | Baja | Aceptado (verificación manual) |
| BUG-E2E-03 | TC-16 puede fallar por race condition si el WebSocket tarda >3s en reconectarse | Media | Mitigado con timeout de 5s |

---

## 7.8 Recomendaciones de Mejora

1. **Agregar `data-testid`** a elementos clave del DOM (ticket code, form inputs, status indicators) para hacer los selectores más robustos y menos frágiles ante cambios de CSS.
2. **Implementar un modo mock** del backend para correr los tests sin necesidad del servidor activo (útil en entornos de CI donde el backend puede no estar disponible).
3. **Ampliar la cobertura** al Panel SQA (AdminView) con tests de configuración del middleware de caos.
4. **Agregar tests de accesibilidad** con `@axe-core/playwright` para verificar el cumplimiento WCAG durante la ejecución E2E.

---

*Documento preparado por: Persona 1 – Líder de Calidad y Automatización E2E*
*Proyecto: SmartQueue – Pruebas de Software UNMSM – Semana 15*
