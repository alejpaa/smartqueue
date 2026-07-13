# SmartQueue — Pruebas de Rendimiento (Performance Tests)
## Persona 3: Ingeniero de Rendimiento y Diseño de Casos

---

## 📁 Archivos en esta carpeta

| Archivo | Descripción |
|---------|-------------|
| `load_test.js` | Script principal: prueba de carga normal, bajo caos y monitoreo SQA |
| `chaos_stress_test.js` | Script de estrés extremo con caos progresivo por fases |
| `README.md` | Este archivo — instrucciones de uso |

---

## 🔧 Instalación de k6

```bash
# Linux (Ubuntu/Debian)
sudo gpg -k
sudo gpg --no-default-keyring \
     --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
     --keyserver hkp://keyserver.ubuntu.com:80 \
     --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69

echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
     https://dl.k6.io/deb stable main" \
     | sudo tee /etc/apt/sources.list.d/k6.list

sudo apt-get update && sudo apt-get install k6

# Verificar instalación
k6 version
```

---

## 🚀 Cómo Ejecutar

> **Requisito previo**: el backend debe estar corriendo en `http://localhost:8000`  
> y la base de datos PostgreSQL activa con Docker.

### Fase 1 — Prueba de Carga Normal

Simula hasta **300 usuarios virtuales concurrentes** creando tickets.

```bash
k6 run tests/performance/load_test.js
```

Salida esperada:
- `p95` de creación de ticket **< 500ms**
- `error_rate` **< 5%**

---

### Fase 2 — Prueba bajo Caos (Latencia + Fallos)

Activa el middleware de caos (800ms de latencia + 30% de fallos de BD) durante la carga.

```bash
k6 run tests/performance/load_test.js -e CHAOS=true
```

Endpoints evaluados:
- `POST /api/v1/tickets` — creación de tickets
- `POST /api/v1/tickets/call-next` — llamado de operadores

---

### Fase 3 — Solo Monitoreo SQA

Tráfico liviano que consulta continuamente las métricas de calidad del sistema.

```bash
k6 run tests/performance/load_test.js -e SQA_ONLY=true
```

---

### Prueba de Estrés Extremo con Caos Progresivo

Ejecuta las 6 fases de caos automáticamente durante 4.5 minutos:

```bash
k6 run tests/performance/chaos_stress_test.js
```

| Fase | Tiempo | Configuración |
|------|--------|---------------|
| A | 0–60s | Sin caos (línea base) |
| B | 60–120s | Latencia 500ms |
| C | 120–180s | Latencia 1500ms + 20% fallos BD |
| D | 180–210s | Latencia 2000ms + 50% fallos BD |
| E | 210–240s | Servidor completamente caído (503) |
| F | 240–270s | Recuperación total |

---

### Guardar resultados en JSON para análisis

```bash
k6 run tests/performance/load_test.js --out json=results/load_normal.json
k6 run tests/performance/load_test.js -e CHAOS=true --out json=results/load_chaos.json
k6 run tests/performance/chaos_stress_test.js --out json=results/chaos_stress.json
```

---

## 📊 Métricas Personalizadas SQA

| Métrica | Descripción | SLA Normal | SLA Bajo Caos |
|---------|-------------|-----------|---------------|
| `ticket_creation_duration_ms` | Latencia de creación de ticket | p95 < 500ms | p95 < 3000ms |
| `call_next_duration_ms` | Latencia de llamado de turno | p95 < 600ms | p95 < 3000ms |
| `sqa_metrics_duration_ms` | Latencia de endpoint de métricas | p95 < 300ms | p95 < 500ms |
| `error_rate` | Tasa de errores | < 5% | < 60% |
| `tickets_created_total` | Total de tickets creados exitosamente | — | — |
| `tickets_called_total` | Total de tickets llamados exitosamente | — | — |

---

## 🎯 Endpoints Evaluados

| Método | Endpoint | Escenario |
|--------|----------|-----------|
| `POST` | `/api/v1/tickets` | Creación masiva de tickets |
| `POST` | `/api/v1/tickets/call-next` | Llamado concurrente de operadores |
| `GET`  | `/api/v1/admin/metrics` | Monitoreo SQA en tiempo real |
| `GET`  | `/api/v1/tickets/queue` | Estado de la cola activa |
| `POST` | `/api/v1/chaos/config` | Control del middleware de caos |
