# ⚡ SmartQueue - Sistema Inteligente de Colas

**SmartQueue** es un sistema digital e inteligente de gestión de colas y turnos de alta concurrencia (clínicas, bancos y municipalidades), desarrollado de acuerdo con las especificaciones y el modelo relacional del informe académico de la **UNMSM**.

Este MVP implementa la arquitectura cliente/servidor desacoplada con notificaciones en tiempo real vía **WebSockets** y una suite completa de aseguramiento de calidad (**SQA**) para verificar la integridad transaccional ACID de las bases de datos.

---

## 🛠️ Stack Tecnológico

*   **Backend**: Python + FastAPI (asíncrono, de alto rendimiento).
*   **Base de Datos**: SQLAlchemy ORM + SQLite (fácil ejecución local con migración nativa a PostgreSQL).
*   **Gestor Backend**: `uv` (administración ultrarrápida de dependencias y entornos virtuales).
*   **Frontend**: React.js (SPA modular creada con Vite).
*   **Gestor Frontend**: `bun` (instalación y ejecución a máxima velocidad).
*   **Diseño**: Vanilla CSS premium (Sleek Dark Mode, Glassmorphism, micro-animaciones) sin dependencias pesadas.

---

## 📋 Estructura de Base de Datos (Relaciones M:N)

Para cumplir con los criterios de evaluación del curso, el sistema implementa y valida de forma estricta las dos relaciones de Muchos a Muchos (M:N) definidas en el modelo lógico:

1.  **Relación Clientes $\leftrightarrow$ Servicios**: Resuelta a través de la tabla asociativa **Ticket** (turno). Un cliente puede solicitar múltiples servicios a lo largo del tiempo, y cada servicio atiende a múltiples clientes al día.
2.  **Relación Operadores $\leftrightarrow$ Ventanillas**: Resuelta a través de la tabla asociativa **Asignacion\_Modulo** (sesión activa). Un operador puede rotar por diferentes ventanillas durante la semana y una ventanilla es compartida por múltiples operadores en turnos distintos.

---

## 🛡️ Aseguramiento de Calidad (SQA) & Transacciones ACID

El módulo de SQA integrado realiza dos tareas fundamentales:

1.  **Pruebas de Integridad Transaccional**: Suite automatizada con `pytest` que simula fallos intermedios en transacciones de escritura (ej. registrar un ticket con ID de servicio erróneo) para validar que el backend aplique un **ROLLBACK** de forma atómica, impidiendo datos huérfanos o inconsistentes.
2.  **Monitoreo de Rendimiento**: Registro en tiempo real de la latencia en milisegundos de las operaciones transaccionales. Estos datos se exponen de forma interactiva en gráficos dentro del panel de administración/SQA.

---

## 🚀 Instrucciones de Inicio Rápido

Sigue estos sencillos pasos para iniciar y ejecutar la plataforma localmente usando `uv` y `bun`:

### 1. Iniciar y Probar el Backend (Python + FastAPI)

Abre una terminal en la carpeta raíz del proyecto y dirígete al backend:

```bash
cd backend
```

#### A. Inicializar y Poblar la Base de Datos (Seed)
Ejecuta el script para crear las tablas relacionales y precargar los datos de prueba (incluyendo los nombres de los autores como operadores activos):
```bash
uv run app/seed.py
```

#### B. Ejecutar la Suite de Pruebas Automatizadas de SQA (Pytest)
Corre los tests unitarios y de consistencia transaccional ACID:
```bash
uv run pytest tests/
```
*(Todos los tests deben pasar exitosamente confirmando la estabilidad del software)*.

#### C. Iniciar el Servidor API de FastAPI
Arranca el servidor en modo desarrollo:
```bash
uv run uvicorn app.main:app --reload
```
*   **API Local**: `http://localhost:8000`
*   **Documentación Swagger**: `http://localhost:8000/docs`

---

### 2. Iniciar el Frontend (React + Vite)

Abre otra terminal en la carpeta raíz del proyecto y dirígete al frontend:

```bash
cd frontend
```

#### A. Instalar las dependencias de Node
Utiliza `bun` para una instalación inmediata:
```bash
bun install
```

#### B. Ejecutar el Servidor del Frontend
Inicia la SPA interactiva:
```bash
bun run dev
```
*   **Portal Web**: `http://localhost:5173` *(Se abrirá automáticamente)*.

---

## 📺 Guía de Demostración del Avance (Flujo de Trabajo)

Para presentar una demostración impecable de este primer avance al profesor del curso:

1.  **Iniciar Sesión de Operador**: Ve a la pestaña **💼 Ventanilla Asesor**, selecciona el nombre **"Alejandro Manuel Padilla"** y asígnate al **Módulo 1**. Esto creará la transacción M:N de sesión de operador en la base de datos de manera atómica.
2.  **Solicitar Turno (Cliente)**: Abre la pestaña **📱 Registro Cliente**, ingresa un DNI ficticio, tu nombre y selecciona el servicio *Consulta Médica*. Haz clic en "Solicitar Turno". Se ejecutará la **Transacción 1** calculando de forma inteligente tu posición y tiempo estimado de espera, imprimiendo un ticket digital y generando un código QR dinámico.
3.  **Llamado en Tiempo Real**: Ve a la pestaña **📺 Pantalla Sala** (que representa la televisión física de la clínica). Verás que está esperando. Regresa a la pestaña del operador y haz clic en **"Llamar Siguiente Turno"**. Al instante, la Pantalla de Sala emitirá una alerta auditiva de campana, un destello visual y **anunciará verbalmente tu turno en voz alta por los altavoces** usando síntesis de voz.
4.  **Cierre y Métricas**: Una vez finalizada la atención simulada, el operador hace clic en **"Cerrar Turno"** (**Transacción 2** con commit atómico). Ve a la pestaña **📈 Panel SQA** para visualizar cómo se han recalculado en vivo los KPIs operativos (tiempo promedio de espera, tasas de abandono) y cómo se registra la latencia exacta de esa transacción en milisegundos en el gráfico analítico.