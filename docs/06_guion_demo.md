# 6. Guión Técnico de Demo en Vivo
## Ítem 6 de la Rúbrica – Criterio C6: Demostración en Vivo ante el Jurado

---

> [!IMPORTANT]
> **Responsable**: Persona 1 – Líder de Calidad y Automatización E2E
> **Duración estimada de la demo**: 12–15 minutos
> **Apoyo**: Todo el equipo (cada persona presenta su módulo)

---

## 6.1 Checklist de Preparación (1 hora antes)

### Ambiente
- [ ] Backend iniciado: `cd backend && uv run uvicorn app.main:app --reload`
- [ ] Frontend iniciado: `cd frontend && npm run dev`
- [ ] Verificar que `http://localhost:8000/docs` responde (Swagger UI)
- [ ] Verificar que `http://localhost:5173` carga el sistema SmartQueue
- [ ] Browsers abiertos y posicionados:
  - Ventana 1: `http://localhost:5173` → Vista de Registro de Cliente
  - Ventana 2: `http://localhost:5173` → Vista de Terminal de Asesor (pantalla separada o pestaña)
  - Ventana 3: `http://localhost:5173` → Pantalla de Sala (maximizada, simula TV de sala)
  - Ventana 4 (Persona 1): Terminal con Playwright listo para correr tests E2E

### Datos de prueba precargados
- [ ] Verificar que existen al menos 3 servicios en la BD (`/api/v1/servicios`)
- [ ] Verificar que existen al menos 2 operadores (`/api/v1/operadores`)
- [ ] Verificar que existen al menos 2 ventanillas (`/api/v1/ventanillas`)
- [ ] Cola inicialmente vacía (limpiar tickets previos si es necesario)

### Material de apoyo
- [ ] Diapositivas listas en modo presentación
- [ ] Reporte HTML de Playwright generado (`npm run test:e2e:report`)
- [ ] Capturas de pantalla de métricas e2e en carpeta `test-results/`

---

## 6.2 Secuencia de la Demo

### ⏱️ PARTE 1: Introducción del Sistema (3 min) — Persona 1

**Diapositiva 1: Portada**
> *"Buenos días/tardes. Somos el equipo SmartQueue. Hoy presentaremos nuestra implementación de un sistema de gestión de colas en tiempo real y la suite completa de pruebas de software que lo valida."*

**Diapositiva 2: Problemática**
> *"El problema que resolvemos es la gestión ineficiente de colas presenciales. Mostramos cómo pasamos de un prototipo básico a un MVP con integridad transaccional, tiempo real y pruebas automatizadas."*

**Diapositiva 3: Arquitectura**
> *"El sistema se compone de 3 capas: un backend FastAPI con WebSockets, un frontend React en tiempo real, y un middleware de caos para simular condiciones adversas."*
> — Mostrar el diagrama de arquitectura del doc `01_presentacion_sistema.md`

---

### ⏱️ PARTE 2: Demo del Sistema en Vivo (7 min)

#### ESCENA 1: Registro de Cliente (2 min) — Persona 1 al teclado

**Acción**: Abrir la vista **"Registro de Cliente"** en el browser.

> *"Un cliente llega a la institución, accede al kiosco digital y solicita su turno."*

1. Ingresar nombre: `"María García López"`
2. Ingresar DNI: `12345678`
3. Ingresar celular: `987654321`
4. Seleccionar servicio: _(el primero disponible)_
5. Hacer clic en **"Solicitar Turno"**

**Punto de énfasis**: Mostrar el ticket generado con el código (ej: `A001`) y el QR.

> *"El sistema genera un ticket único, muestra el tiempo de espera estimado y simula un código QR de verificación. El ticket también se guarda en localStorage para tolerancia a desconexiones."*

---

#### ESCENA 2: Pantalla de Sala se Actualiza en Tiempo Real (1 min) — Persona 1 señala la Ventana 3

**Mientras el cliente tiene su ticket**, mostrar la **Pantalla de Sala** en paralelo.

> *"Esta es la pantalla de sala de espera. Ahora veremos cómo el operador llama el turno y la pantalla se actualiza automáticamente."*

---

#### ESCENA 3: Operador Llama el Ticket (2 min) — Persona 2/3 al teclado en Ventana 2

**Acción**: En la vista **"Terminal de Asesor"**:

1. Seleccionar operador: _(el primero disponible)_
2. Seleccionar módulo: `Módulo 1`
3. Clic en **"Iniciar Sesión"**
4. Verificar badge **"Sesión Activa"** y estado WebSocket **"Conectado"**
5. Clic en **"Llamar Siguiente Turno"**

**Punto de énfasis**: En el MISMO momento, la **Ventana 3 (Pantalla de Sala)** debe actualizarse automáticamente mostrando `A001 – Ventanilla 1`.

> *"En tiempo real, via WebSocket, la pantalla de sala se actualiza y emite el anuncio de voz: 'Turno A-cero-cero-uno, por favor diríjase a la Ventanilla 1'."*

---

#### ESCENA 4: Finalizar Turno y Middleware de Caos (2 min) — Persona 3 al teclado

1. El operador finaliza el turno: clic en **"Finalizar Turno"**
2. Ir al **Panel de Control (AdminView)** → activar caos con latencia de 500ms y 20% de fallos
3. Registrar un nuevo ticket con el caos activo
4. Mostrar los reintentos con backoff exponencial en el frontend

> *"El sistema implementa la ingeniería del caos: podemos inyectar latencia y fallos para validar la resiliencia. El frontend maneja reintentos automáticos con backoff exponencial."*

---

### ⏱️ PARTE 3: Demo de Pruebas Automatizadas E2E (3 min) — Persona 1

**Acción**: Abrir la terminal y ejecutar:

```bash
cd frontend
npm run test:e2e:headed
```

> *"Ahora ejecutaremos nuestra suite de 18 casos de prueba automatizados con Playwright, cubriendo los 3 flujos principales del sistema."*

**Mientras corren los tests, comentar**:
- TC-01 a TC-06: Flujo de registro de cliente
- TC-07 a TC-12: Flujo del operador
- TC-13 a TC-18: Pantalla pública en tiempo real

**Al finalizar**, ejecutar el reporte:
```bash
npm run test:e2e:report
```

> *"El reporte HTML muestra el estado de cada test, trazas, screenshots y videos de los fallos. Esto se integra en nuestro pipeline CI/CD."*

---

## 6.3 Distribución de Roles durante la Demo

| Segmento | Presentador | Teclado/Mouse |
|---|---|---|
| Introducción + Arquitectura | **Persona 1** | — |
| Escena 1: Registro de Cliente | **Persona 1** | Persona 1 |
| Escena 2: Pantalla de Sala | **Persona 1** (señala) | — |
| Escena 3: Terminal de Asesor | **Persona 2** | Persona 2 |
| Escena 4: Caos + Reintentos | **Persona 3** | Persona 3 |
| Demo E2E Playwright | **Persona 1** | Persona 1 |
| Riesgos + OWASP + Bug Log | **Persona 4** | Persona 4 |
| Conclusiones | **Persona 4** | — |
| Preguntas del jurado | **Todos** | — |

---

## 6.4 Respuestas a Posibles Preguntas del Jurado

| Pregunta Probable | Respuesta Preparada |
|---|---|
| *"¿Por qué WebSockets y no polling?"* | Latencia de notificación de ~2000ms con polling vs <100ms con WebSockets; además elimina carga innecesaria al servidor. |
| *"¿Cómo garantizan la integridad de datos?"* | Mediante transacciones ACID en SQLAlchemy y pruebas de rollback automatizadas con pytest. Si una operación falla a mitad, se deshace completamente. |
| *"¿Qué pasa si el servidor cae?"* | El frontend implementa reintentos con backoff exponencial (3 intentos, delay duplicándose). Los tickets se guardan en localStorage. La pantalla de sala intenta reconectarse al WebSocket cada 3 segundos. |
| *"¿Qué técnicas de caja negra usaron?"* | Partición de equivalencia y valores límite para el campo DNI (8 dígitos), celular (9 dígitos), y estados del ticket (ESPERA, LLAMADO, ATENDIDO, INASISTENCIA). |
| *"¿Playwright vs Cypress?"* | Elegimos Playwright por su soporte nativo multi-browser (Chromium, Firefox, WebKit), su API más moderna, y porque no tiene la restricción de same-origin que tiene Cypress con múltiples dominios. |
| *"¿Qué es el middleware de caos?"* | Es un interceptor que, configurado dinámicamente, inyecta latencia aleatoria, simula caídas del servidor (HTTP 503) y forza rollbacks transaccionales para validar la resiliencia del sistema. |

---

## 6.5 Plan de Contingencia

| Problema | Solución de Respaldo |
|---|---|
| Backend no inicia | Mostrar el video pregrabado de la demo + capturas del reporte Playwright |
| Frontend no conecta al backend | Mostrar `http://localhost:8000/docs` (Swagger) para demostrar los endpoints |
| Los tests E2E fallan en vivo | Mostrar el último reporte HTML guardado y las capturas de pantalla de evidencia |
| WebSocket no conecta | Demostrar el sistema con polling manual (F5 en la pantalla de sala) y explicar que en producción se usaría un servidor dedicado |

---

*Documento preparado por: Persona 1 – Líder de Calidad y Automatización E2E*
*Proyecto: SmartQueue – Pruebas de Software UNMSM – Semana 15*
