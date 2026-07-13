# Ítem 3 — Diseño de Casos de Prueba
## Proyecto SmartQueue · Pruebas de Software
### Persona 3: Ingeniero de Rendimiento y Diseño de Casos

---

## 1. Introducción

Este documento presenta la **Matriz de Casos de Prueba** del sistema SmartQueue, diseñada mediante tres técnicas complementarias de ingeniería de pruebas:

- **Caja Negra**: Partición de equivalencia y análisis de valores límite
- **Caja Blanca**: Cobertura de caminos básicos en las transacciones ACID
- **Pruebas basadas en Riesgos**: Priorización por criticidad de las relaciones M:N y transacciones críticas

El sistema SmartQueue gestiona colas de atención mediante tickets con transacciones ACID entre las entidades: `usuarios`, `servicios`, `ventanillas`, `operadores` y `tickets`.

---

## 2. Técnica 1 — Caja Negra: Partición de Equivalencia y Valores Límite

### 2.1 Análisis del campo `dni` (POST `/api/v1/tickets`)

El DNI es un campo `String` único, no nulo, usado como identificador del usuario.

#### Particiones de Equivalencia

| Clase | Descripción | Ejemplo | Resultado Esperado |
|-------|-------------|---------|-------------------|
| **CE-01** (válida) | DNI de 8 dígitos numéricos | `"12345678"` | HTTP 201 — Ticket creado |
| **CE-02** (inválida) | DNI vacío | `""` | HTTP 422 — Error de validación |
| **CE-03** (inválida) | DNI con letras | `"ABCD1234"` | HTTP 422 — Error de validación |
| **CE-04** (inválida) | DNI duplicado (usuario ya existe) | `"12345678"` (2da vez) | HTTP 201 — Reutiliza usuario existente |
| **CE-05** (inválida) | DNI con espacios | `"1234 678"` | HTTP 422 o reutilización con error |
| **CE-06** (inválida) | DNI nulo/ausente | `null` | HTTP 422 — Campo requerido |

#### Análisis de Valores Límite

| CAS-ID | Valor de Prueba | Longitud | Frontera | Resultado Esperado |
|--------|----------------|----------|----------|--------------------|
| **VL-01** | `"1234567"` | 7 dígitos | Inferior (debajo) | HTTP 422 — Muy corto |
| **VL-02** | `"12345678"` | 8 dígitos | Mínimo válido | HTTP 201 — Aceptado |
| **VL-03** | `"123456789"` | 9 dígitos | Superior (encima) | HTTP 422 — Muy largo |
| **VL-04** | `"00000000"` | 8 dígitos | Límite inferior de valor | HTTP 201 — Aceptado |
| **VL-05** | `"99999999"` | 8 dígitos | Límite superior de valor | HTTP 201 — Aceptado |

> **Nota**: El modelo actual define `dni` como `String` sin restricción de longitud en BD. Las validaciones VL-01 y VL-03 dependen de que se agregue validación Pydantic (`Field(min_length=8, max_length=8)`). Esto constituye un **riesgo de calidad identificado** (ver Sección 4).

---

### 2.2 Análisis del campo `celular` (POST `/api/v1/tickets`)

Campo opcional (`Optional[str]`).

| CAS-ID | Valor | Clase | Resultado Esperado |
|--------|-------|-------|--------------------|
| **CE-07** | `"987654321"` | Válida (9 dígitos) | HTTP 201 — Aceptado |
| **CE-08** | `null` / omitido | Válida (campo opcional) | HTTP 201 — Aceptado, celular=null |
| **CE-09** | `""` | Inválida (vacío explícito) | HTTP 201 — Aceptado (almacena vacío) |
| **CE-10** | `"9876"` | Borde inferior | HTTP 201 — Aceptado (sin restricción actual) |
| **CE-11** | `"9876543210123"` | Borde superior | HTTP 201 — Aceptado (sin restricción actual) |

---

### 2.3 Análisis del campo `id_servicio` (POST `/api/v1/tickets`)

| CAS-ID | Valor | Clase | Resultado Esperado |
|--------|-------|-------|--------------------|
| **CE-12** | `1` — `6` | Válida (servicios existentes) | HTTP 201 — Ticket creado |
| **CE-13** | `0` | Inválida (fuera de rango) | HTTP 404 — Servicio no existe |
| **CE-14** | `9999` | Inválida (ID inexistente) | HTTP 404 — Servicio no existe |
| **CE-15** | `-1` | Inválida (negativo) | HTTP 422 o HTTP 404 |
| **CE-16** | `null` | Inválida (requerido) | HTTP 422 — Campo requerido |

---

### 2.4 Análisis de creación de Sesión de Operador (POST `/api/v1/operadores/session`)

| CAS-ID | `id_operador` | `id_ventanilla` | Clase | Resultado Esperado |
|--------|---------------|-----------------|-------|--------------------|
| **CE-17** | `1` | `1` | Válida | HTTP 200 — Sesión creada |
| **CE-18** | `9999` | `1` | Inválida | HTTP 404 — Operador no existe |
| **CE-19** | `1` | `9999` | Inválida | HTTP 404 — Ventanilla no existe |
| **CE-20** | `1` (ya activo) | `2` | Borde — reasignación | HTTP 200 — Desactiva sesión previa, crea nueva |
| **CE-21** | `2` | `1` (ya ocupada) | Borde — ventanilla ocupada | HTTP 200 — Desactiva asignación previa en V1 |

---

### 2.5 Análisis de Llamado de Ticket (POST `/api/v1/tickets/call-next`)

| CAS-ID | Condición | Resultado Esperado |
|--------|-----------|-------------------|
| **CE-22** | Operador con sesión activa + hay tickets en ESPERA | HTTP 200 — Ticket LLAMADO |
| **CE-23** | Operador sin sesión activa | HTTP 400 — Sin sesión activa |
| **CE-24** | Operador con sesión + cola vacía | HTTP 404 — No hay tickets |
| **CE-25** | `id_operador` o `id_ventanilla` inexistentes | HTTP 400 — Sin sesión activa |

---

## 3. Técnica 2 — Caja Blanca: Caminos Básicos de Transacciones ACID

### 3.1 Transacción 1: Registro de Ticket (`POST /api/v1/tickets`)

**Diagrama de flujo simplificado:**

```
[Inicio]
   │
   ▼
[Validar id_servicio] ─── NO EXISTE ──► [HTTP 404] ──► [Fin]
   │
   ▼ EXISTE
[Buscar usuario por DNI]
   │
   ├── NO EXISTE ──► [Crear usuario] ──► [flush()]
   │
   └── EXISTE ──────► [Actualizar nombre/celular]
   │
   ▼
[Calcular código de ticket (prefijo + contador diario)]
   │
   ▼
[Calcular tiempo estimado de espera]
   │
   ▼
[Insertar Ticket]
   │
   ▼
[simulate_db_failure_if_active()] ─── FALLO ──► [rollback()] ──► [HTTP 500]
   │
   ▼ SIN FALLO
[db.commit()] ──── ERROR ──► [rollback()] ──► [HTTP 500]
   │
   ▼ ÉXITO
[WebSocket broadcast]
   │
   ▼
[HTTP 201 — Ticket creado]
```

#### Casos de Prueba de Caminos Básicos

| CAS-ID | Camino | Condición | Resultado Esperado |
|--------|--------|-----------|-------------------|
| **CB-01** | Camino feliz — nuevo usuario | `dni` nuevo + `id_servicio` válido | HTTP 201, usuario creado, ticket generado |
| **CB-02** | Camino feliz — usuario existente | `dni` existente | HTTP 201, usuario reutilizado, datos actualizados |
| **CB-03** | Servicio inválido | `id_servicio` no existe | HTTP 404, sin inserción en BD |
| **CB-04** | Fallo DB simulado (caos) | `db_failure_rate > 0` + RNG activa | HTTP 500 + rollback ejecutado (sin ticket huérfano) |
| **CB-05** | Primer ticket del día | Contador diario = 0 | Código = `SER-001` |
| **CB-06** | Décimo ticket del día | Contador diario = 9 | Código = `SER-010` |
| **CB-07** | Cero operadores activos | `operadores_activos = 0` | `tiempo_estimado = personas_en_espera * 10` |
| **CB-08** | Con operadores activos | `operadores_activos > 0` | `tiempo_estimado = (espera * 8) / operadores` |

---

### 3.2 Transacción 2: Cierre de Turno (`PUT /api/v1/tickets/{id_ticket}/close`)

| CAS-ID | Camino | Condición | Resultado Esperado |
|--------|--------|-----------|-------------------|
| **CB-09** | Camino feliz | Ticket existe + estado = `LLAMADO` | HTTP 200, estado → `ATENDIDO`, hora_fin registrada |
| **CB-10** | Ticket no existe | `id_ticket` inválido | HTTP 404 — Ticket no encontrado |
| **CB-11** | Estado incorrecto | Ticket en `ESPERA` o `ATENDIDO` | HTTP 400 — Estado inválido para cierre |
| **CB-12** | Fallo DB en commit | `db_failure_rate > 0` | HTTP 500 + rollback (ticket permanece en LLAMADO) |

---

### 3.3 Middleware de Caos (`chaos_middleware`)

| CAS-ID | Configuración | Endpoint | Resultado Esperado |
|--------|---------------|----------|--------------------|
| **CB-13** | `server_down = true` | Cualquier endpoint (excepto `/chaos`) | HTTP 503 |
| **CB-14** | `server_down = true` | `POST /api/v1/chaos/config` | HTTP 200 — Excluido del middleware |
| **CB-15** | `latency_ms = 1000` | `POST /api/v1/tickets` | Respuesta con ~1000ms de delay adicional |
| **CB-16** | `db_failure_rate = 1.0` | `POST /api/v1/tickets` | HTTP 500 — Fallo garantizado (100%) |

---

## 4. Técnica 3 — Pruebas basadas en Riesgos

### 4.1 Identificación de Riesgos

| ID | Riesgo | Probabilidad | Impacto | Prioridad |
|----|--------|-------------|---------|-----------|
| **R-01** | **Condición de carrera en tickets**: dos VUs crean ticket con mismo DNI simultáneamente | Alta | Alto | 🔴 Crítico |
| **R-02** | **Inconsistencia M:N Operador-Ventanilla**: sesión activa no se desactiva correctamente | Media | Alto | 🔴 Crítico |
| **R-03** | **Rollback incompleto**: fallo de BD deja ticket creado sin usuario | Baja | Alto | 🟠 Alto |
| **R-04** | **Ticket llamado sin operador activo**: `call-next` sin sesión válida procesa el ticket | Baja | Alto | 🟠 Alto |
| **R-05** | **Desbordamiento de cola**: sistema degrada bajo > 500 tickets simultáneos en ESPERA | Media | Medio | 🟡 Medio |
| **R-06** | **DNI sin validación de longitud**: DNI de 1 dígito o 50 dígitos se acepta | Alta | Medio | 🟡 Medio |
| **R-07** | **Endpoint de caos sin autenticación**: cualquier cliente puede inyectar caos | Alta | Alto | 🔴 Crítico |
| **R-08** | **WebSocket desconectado durante broadcast**: excepción no manejada detiene la TX | Baja | Medio | 🟡 Medio |

---

### 4.2 Matriz de Priorización de Casos de Prueba basada en Riesgos

| CAS-ID | Caso de Prueba | Riesgo Cubierto | Prioridad | Técnica |
|--------|----------------|-----------------|-----------|---------|
| **RB-01** | Crear 50 tickets con el mismo DNI concurrentemente (k6, 50 VUs) | R-01 | 🔴 Crítico | Rendimiento + Caja Negra |
| **RB-02** | Asignar mismo operador a dos ventanillas simultáneamente | R-02 | 🔴 Crítico | Caja Blanca |
| **RB-03** | Asignar dos operadores a la misma ventanilla simultáneamente | R-02 | 🔴 Crítico | Caja Blanca |
| **RB-04** | Activar `db_failure_rate=1.0` y verificar que no queden tickets huérfanos en BD | R-03 | 🟠 Alto | Caja Blanca + Caos |
| **RB-05** | Llamar ticket sin sesión de operador activa | R-04 | 🟠 Alto | Caja Negra |
| **RB-06** | Crear 500 tickets y medir degradación del tiempo de respuesta | R-05 | 🟡 Medio | Rendimiento |
| **RB-07** | Enviar DNI de 1, 3, 7 y 9 dígitos al endpoint de tickets | R-06 | 🟡 Medio | Valores Límite |
| **RB-08** | Llamar `POST /api/v1/chaos/config` sin autenticación desde cliente externo | R-07 | 🔴 Crítico | Seguridad / Caja Negra |
| **RB-09** | Desconectar WebSocket durante creación de ticket y verificar rollback | R-08 | 🟡 Medio | Caja Blanca |

---

### 4.3 Relaciones M:N — Casos de Prueba Específicos

#### Relación M:N 1: Usuarios ↔ Servicios (a través de `tickets`)

| CAS-ID | Escenario | Resultado Esperado |
|--------|-----------|-------------------|
| **MN-01** | Un usuario solicita tickets para 3 servicios distintos | 3 tickets creados, todos vinculados al mismo `id_usuario` |
| **MN-02** | Mismo servicio atendido por múltiples usuarios | Múltiples tickets con diferente `id_usuario`, mismo `id_servicio` |
| **MN-03** | Eliminar usuario con tickets activos | Debe fallar por FK o cascada (verificar integridad) |

#### Relación M:N 2: Operadores ↔ Ventanillas (a través de `asignacion_modulos`)

| CAS-ID | Escenario | Resultado Esperado |
|--------|-----------|-------------------|
| **MN-04** | Operador cambia de ventanilla (de V1 a V2) | V1 se marca `activo=false`, nueva asignación V2 `activo=true` |
| **MN-05** | Ventanilla V1 reasignada de Op1 a Op2 | Op1-V1 se desactiva, Op2-V1 se activa |
| **MN-06** | Consultar historial de asignaciones de un operador | Todas las asignaciones (activas e inactivas) disponibles en BD |

---

## 5. Resumen de Cobertura

| Técnica | Casos Diseñados | Cobertura Principal |
|---------|----------------|---------------------|
| Caja Negra (Partición Eq.) | 25 casos (CE-01 a CE-25) | Entradas de los 4 endpoints principales |
| Caja Negra (Valores Límite) | 5 casos (VL-01 a VL-05) | Campo `dni` |
| Caja Blanca (Caminos Básicos) | 16 casos (CB-01 a CB-16) | Transacciones ACID + middleware caos |
| Basadas en Riesgos | 9 casos (RB-01 a RB-09) | Riesgos R-01 a R-08 |
| Relaciones M:N | 6 casos (MN-01 a MN-06) | Integridad referencial |
| **TOTAL** | **61 casos de prueba** | — |

---

## 6. Hallazgos y Defectos Identificados en el Diseño

| DEF-ID | Descripción | Severidad | Estado |
|--------|-------------|-----------|--------|
| **DEF-01** | `dni` no tiene validación de longitud (acepta 1–∞ caracteres) | 🟡 Media | Abierto |
| **DEF-02** | Endpoint `POST /api/v1/chaos/config` no requiere autenticación | 🔴 Alta | Abierto |
| **DEF-03** | Campo `celular` acepta cualquier cadena sin formato válido | 🟢 Baja | Abierto |
| **DEF-04** | `hora_inicio_atencion` se guarda como `func.now()` en el ORM pero retorna isoformat sin timezone | 🟡 Media | Abierto |
