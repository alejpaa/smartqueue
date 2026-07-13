# 1. Presentación del Sistema SmartQueue
## Ítem 1 de la Rúbrica – Criterio C1: Presentación y Alcance del Sistema

---

## 1.1 Introducción y Problemática

Las instituciones públicas y privadas que brindan servicios de atención presencial —como entidades bancarias, hospitales, oficinas municipales y centros de atención al cliente— enfrentan de manera recurrente el problema de la **gestión ineficiente de las colas de espera**. Este fenómeno genera múltiples impactos negativos:

- **Para el usuario**: Tiempos de espera prolongados e inciertos, desinformación sobre el estado de su turno, frustración y abandono del servicio.
- **Para el operador**: Sobrecarga en picos de demanda, dificultad para priorizar servicios y falta de visibilidad sobre el flujo de atención.
- **Para la institución**: Pérdida de eficiencia operativa, aumento en las quejas y reducción de la calidad percibida del servicio.

Según estudios de experiencia de usuario en servicios públicos, **el 60% de las quejas ciudadanas están relacionadas directamente con el tiempo de espera** y la falta de información durante el proceso de atención.

**SmartQueue** nace como respuesta tecnológica a este problema, proponiendo un sistema de gestión de turnos en tiempo real, accesible desde cualquier dispositivo con navegador web, sin necesidad de instalación de software adicional.

---

## 1.2 Descripción del Sistema

**SmartQueue** es un sistema web de gestión inteligente de colas de atención, desarrollado con tecnologías modernas de código abierto. Permite digitalizar y automatizar el ciclo completo de atención, desde que el cliente solicita un turno hasta que el operador finaliza la atención.

### Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| **Backend** | FastAPI (Python) + SQLAlchemy + SQLite | API asíncrona de alto rendimiento, ORM robusto con soporte de transacciones ACID |
| **Frontend** | React 19 + Vite | Interfaz reactiva en tiempo real, renderizado eficiente por componentes |
| **Comunicación en tiempo real** | WebSockets (nativo en FastAPI) | Actualización instantánea entre cliente, operador y pantalla pública sin polling |
| **Base de datos** | SQLite (desarrollo) / PostgreSQL (producción) | Portabilidad para pruebas; escalable a producción |
| **Testing E2E** | Playwright | Automatización de flujos de interfaz con multi-browser support |

### Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENTE BROWSER                       │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ ClientView  │  │ OperatorView │  │  PublicView   │  │
│  │ (Registro)  │  │ (Terminal)   │  │  (Sala/TTS)   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │   REST API     │    WebSocket      │          │
└─────────┼────────────────┼───────────────────┼──────────┘
          │                │                   │
┌─────────▼────────────────▼───────────────────▼──────────┐
│              FASTAPI BACKEND (Puerto 8000)                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │  /tickets   │  │  /operadores │  │  /ws (WS)     │   │
│  │  /servicios │  │  /ventanillas│  │  Chaos MW     │   │
│  └──────┬──────┘  └──────┬───────┘  └───────────────┘   │
└─────────┼────────────────┼──────────────────────────────┘
          │                │
┌─────────▼────────────────▼──────────────┐
│          SQLite / SQLAlchemy ORM         │
│  Tickets · Usuarios · Servicios (M:N)   │
│  Operadores · Ventanillas (M:N)          │
└──────────────────────────────────────────┘
```

---

## 1.3 Alcance del Sistema

### 1.3.1 Funcionalidades Incluidas (In-Scope)

| ID | Funcionalidad | Vista Asociada |
|---|---|---|
| F01 | Registro de cliente con DNI y celular → generación de ticket con código único | ClientView |
| F02 | Visualización del ticket digital con código QR simulado y estado en tiempo real | ClientView |
| F03 | Persistencia del ticket en localStorage para tolerancia a desconexiones | ClientView |
| F04 | Autenticación operacional: asignación de operador a ventanilla/módulo (relación M:N) | OperatorView |
| F05 | Llamado del siguiente ticket de la cola por parte del operador | OperatorView |
| F06 | Acciones de gestión del turno: Re-llamar, Finalizar Turno, Marcar Inasistencia | OperatorView |
| F07 | Pantalla pública de sala con actualización en tiempo real via WebSocket | PublicView |
| F08 | Síntesis de voz (TTS) para anuncio del turno llamado en la sala de espera | PublicView |
| F09 | Panel SQA: métricas de latencia, configuración del middleware de caos | AdminView |
| F10 | Middleware de caos: inyección de latencia, tasas de error y fallos transaccionales | Backend |
| F11 | Pruebas de rollback ACID para garantizar integridad transaccional | Backend |

### 1.3.2 Funcionalidades Excluidas (Out-of-Scope)

- Integración con sistemas biométricos o lectores de DNI físicos.
- Sistema de pagos o cobros integrados.
- Aplicación móvil nativa (iOS/Android).
- Módulo de reportes históricos y analytics avanzado (BI).
- Autenticación de usuarios con roles y permisos (se maneja por sesión de operador).

---

## 1.4 Objetivos del Sistema

### Objetivo General
Desarrollar un sistema web de gestión de colas de atención en tiempo real que reduzca el tiempo de espera percibido, mejore la transparencia del proceso de atención y valide la calidad del software mediante una suite integral de pruebas automatizadas.

### Objetivos Específicos

1. **Digitalizar el proceso de obtención de turnos** eliminando la dependencia de tickets físicos y reduciendo errores de gestión manual.
2. **Proveer información en tiempo real** a los clientes sobre el estado de su turno mediante WebSockets y síntesis de voz.
3. **Garantizar la integridad transaccional** del sistema mediante pruebas de rollback ACID en operaciones críticas de la base de datos.
4. **Medir y simular comportamiento bajo condiciones adversas** mediante el middleware de caos (latencia, caídas y fallos transaccionales).
5. **Demostrar buenas prácticas de SQA** implementando una pipeline CI/CD con pruebas automatizadas, análisis de cobertura y escaneo de seguridad.

---

## 1.5 Justificación de la Evolución Técnica del MVP

El sistema evolucionó de un prototipo básico de registro de turnos a un MVP con las siguientes mejoras técnicas justificadas desde la perspectiva de calidad de software:

| Evolución | Justificación Técnica |
|---|---|
| **WebSockets** en lugar de polling HTTP | Reducción de latencia de notificación de ~2000ms a <100ms; eliminación de carga innecesaria al servidor |
| **Relaciones M:N** (Clientes ↔ Servicios, Operadores ↔ Ventanillas) | Flexibilidad operacional: un operador puede ser asignado a múltiples módulos; un módulo puede ser atendido por múltiples operadores en diferentes turnos |
| **Middleware de Caos** | Implementación del principio de "Ingeniería del Caos" para validar la resiliencia del sistema ante fallos reales de infraestructura |
| **Reintentos con backoff exponencial** en el frontend | Tolerancia a fallos transitorios del servidor sin afectar la experiencia del usuario |
| **Síntesis de voz (TTS)** en la pantalla pública | Accesibilidad mejorada para personas con discapacidad visual; cumplimiento de principios WCAG |
| **Suite de pruebas automatizadas** | Verificación continua de la calidad del software; base para la integración en el pipeline CI/CD |

---

## 1.6 Métricas del Proyecto

| Métrica | Valor Actual |
|---|---|
| Líneas de código (backend) | ~2,500 LOC |
| Líneas de código (frontend) | ~4,000 LOC |
| Endpoints REST disponibles | 12+ |
| Cobertura de pruebas backend (pytest) | En expansión (objetivo: ≥85%) |
| Tests E2E automatizados | 18 casos de prueba (Playwright) |
| Flujos principales cubiertos | 3 (Registro, Llamado, Visualización) |

---

*Documento preparado por: Persona 1 – Líder de Calidad y Automatización E2E*
*Proyecto: SmartQueue – Pruebas de Software UNMSM – Semana 15*
