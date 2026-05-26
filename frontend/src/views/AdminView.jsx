import React, { useState, useEffect, useRef } from 'react';

export default function AdminView({ backendUrl }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wsStatus, setWsStatus] = useState('DESCONECTADO');
  const [auditLogs, setAuditLogs] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchMetrics();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/admin/metrics`);
      if (!res.ok) throw new Error('Error al cargar métricas del servidor');
      const data = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const connectWebSocket = () => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const cleanUrl = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${cleanUrl}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsStatus('CONECTADO');
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Agregar logs a la auditoría en tiempo real
        const timestamp = new Date().toLocaleTimeString();
        let logMsg = '';
        
        if (data.event === 'ticket_created') {
          logMsg = `[Transacción 1] Creado ticket ${data.ticket.codigo_ticket} para ${data.ticket.nombre_cliente} (Espera: ${data.ticket.tiempo_espera_estimado} min)`;
        } else if (data.event === 'ticket_called') {
          logMsg = `[Llamado] Ticket ${data.ticket.codigo_ticket} convocado al Módulo ${data.ticket.numero_modulo}`;
        } else if (data.event === 'ticket_closed') {
          logMsg = `[Transacción 2] Cierre de ticket ${data.ticket.codigo_ticket} (Atención Finalizada)`;
        } else if (data.event === 'ticket_no_show') {
          logMsg = `[No Presentado] Ticket ${data.ticket.codigo_ticket} marcado como inasistencia`;
        } else if (data.event === 'operator_session_started') {
          logMsg = `[Sesión] Operador ${data.operador} activo en Ventanilla ${data.ventanilla}`;
        }

        if (logMsg) {
          setAuditLogs(prev => [{ time: timestamp, msg: logMsg }, ...prev].slice(0, 15));
        }

        // Recargar métricas reales del servidor
        fetchMetrics();
      } catch (err) {
        console.error(err);
      }
    };
    ws.onclose = () => {
      setWsStatus('DESCONECTADO');
      setTimeout(connectWebSocket, 5000);
    };
  };

  if (loading && !metrics) {
    return <div style={styles.loading}>Cargando Panel de Calidad SQA...</div>;
  }

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.header}>
        <div>
          <h1 className="gradient-text" style={styles.title}>Panel Analítico SQA</h1>
          <p className="text-muted" style={styles.subtitle}>
            Aseguramiento de Calidad de Software: Monitoreo técnico de latencias ACID e indicadores de servicio en vivo.
          </p>
        </div>
        <div style={styles.wsRow}>
          <span style={{
            ...styles.dot,
            backgroundColor: wsStatus === 'CONECTADO' ? 'var(--accent-green)' : 'var(--accent-red)'
          }}></span>
          <span style={styles.wsText}>Logs SQA: {wsStatus === 'CONECTADO' ? 'Activos' : 'Pausados'}</span>
        </div>
      </div>

      {error && <div style={styles.errorAlert}>{error}</div>}

      {/* TARJETAS DE MÉTRICAS OPERATIVAS */}
      <div style={styles.metricsGrid}>
        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Espera Promedio</span>
          <h2 style={styles.metricValue}>
            {metrics?.tiempo_espera_promedio} <span style={styles.metricUnit}>min</span>
          </h2>
          <p style={{ ...styles.metricFooter, color: 'var(--accent-blue)' }}>
            🎯 Meta SLA: &lt; 15 min
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Tasa de Abandono</span>
          <h2 style={{ ...styles.metricValue, color: metrics?.tasa_abandono > 10 ? 'var(--accent-red)' : 'var(--accent-green)' }}>
            {metrics?.tasa_abandono} <span style={styles.metricUnit}>%</span>
          </h2>
          <p style={styles.metricFooter}>
            📉 Inasistencias y cancelados
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Uptime del Servidor</span>
          <h2 style={{ ...styles.metricValue, color: 'var(--accent-cyan)' }}>
            {metrics?.uptime_sistema} <span style={styles.metricUnit}>%</span>
          </h2>
          <p style={styles.metricFooter}>
            🛡️ Arquitectura tolerante a fallos
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Tickets Atendidos</span>
          <h2 style={{ ...styles.metricValue, color: 'var(--accent-green)' }}>
            {metrics?.total_atendidos} <span style={styles.metricUnit}>/ {metrics?.total_tickets}</span>
          </h2>
          <p style={styles.metricFooter}>
            📋 Cola total hoy
          </p>
        </div>
      </div>

      <div style={styles.detailsGrid}>
        {/* PANEL IZQUIERDO: LATENCIA DE TRANSACCIONES (MONITOREO TÉCNICO SQA) */}
        <div className="glass-card" style={styles.chartCard}>
          <h3 style={styles.cardTitle}>⏱️ LATENCIA DE TRANSACCIONES DE BASE DE DATOS (ms)</h3>
          <p className="text-muted" style={styles.cardDesc}>
            Prueba de Rendimiento SQA: Monitoreo en milisegundos de las últimas transacciones críticas de inserción y actualización en SQLite.
          </p>

          <div style={styles.chartContainer}>
            {metrics?.latencias && metrics.latencias.length > 0 ? (
              <div style={styles.barsRow}>
                {metrics.latencias.map((lat, idx) => (
                  <div key={idx} style={styles.barColumn}>
                    <span style={styles.barValue}>{lat}ms</span>
                    <div style={{
                      ...styles.bar,
                      height: `${Math.min(100, (lat / 50) * 100)}px`,
                      background: lat > 35 ? 'var(--accent-red)' : lat > 20 ? 'var(--accent-orange)' : 'var(--accent-blue)'
                    }}></div>
                    <span style={styles.barLabel}>T-{idx+1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.emptyChart}>Esperando mediciones de transacciones...</div>
            )}
          </div>
          <div style={styles.chartFooter}>
            <span style={{ color: 'var(--accent-green)' }}>● Rápido (&lt;20ms)</span>
            <span style={{ color: 'var(--accent-orange)' }}>● Moderado (20-35ms)</span>
            <span style={{ color: 'var(--accent-red)' }}>● Lento (&gt;35ms)</span>
          </div>
        </div>

        {/* PANEL DERECHO: AUDITORÍA DE TRANSACCIONES ACID EN VIVO */}
        <div className="glass-card" style={styles.logsCard}>
          <h3 style={styles.cardTitle}>📜 REGISTRO DE AUDITORÍA DE TRANSACCIONES SQA</h3>
          <p className="text-muted" style={styles.cardDesc}>
            Trazabilidad de base de datos en tiempo real. Inspecciona los commits de las relaciones Muchos a Muchos.
          </p>

          <div style={styles.logsContainer}>
            {auditLogs.length > 0 ? (
              auditLogs.map((log, idx) => (
                <div key={idx} style={styles.logRow} className="fade-in">
                  <span style={styles.logTime}>{log.time}</span>
                  <span style={styles.logMsg}>{log.msg}</span>
                </div>
              ))
            ) : (
              <div style={styles.emptyLogs}>
                <p>Monitoreando WebSockets...</p>
                <span>Realiza transacciones en los paneles de cliente u operador para ver los registros atómicos.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '1rem 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    paddingBottom: '1rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
  },
  subtitle: {
    fontSize: '0.9rem',
    marginTop: '0.25rem',
  },
  wsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'rgba(255, 255, 255, 0.03)',
    padding: '0.4rem 0.8rem',
    borderRadius: '20px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  wsText: {
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: '1.25rem',
    marginBottom: '2rem',
  },
  metricCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  metricLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  metricValue: {
    fontSize: '2.2rem',
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: '0.5rem',
  },
  metricUnit: {
    fontSize: '1rem',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  metricFooter: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginTop: 'auto',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  chartCard: {
    padding: '1.5rem',
  },
  cardTitle: {
    fontSize: '0.95rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    marginBottom: '0.4rem',
  },
  cardDesc: {
    fontSize: '0.8rem',
    lineHeight: '1.4',
    marginBottom: '2rem',
  },
  chartContainer: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '2rem 1.5rem 1rem 1.5rem',
    minHeight: '200px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  barsRow: {
    display: 'flex',
    gap: '1.25rem',
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  barColumn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    maxWidth: '50px',
  },
  barValue: {
    fontSize: '0.65rem',
    color: 'var(--text-main)',
    marginBottom: '0.4rem',
    fontWeight: '600',
  },
  bar: {
    width: '100%',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.4s ease-out',
    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
  },
  barLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    marginTop: '0.5rem',
    fontWeight: '500',
  },
  emptyChart: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    height: '150px',
    width: '100%',
  },
  chartFooter: {
    display: 'flex',
    justifyContent: 'center',
    gap: '1.5rem',
    fontSize: '0.75rem',
    marginTop: '1.25rem',
    fontWeight: '600',
  },
  logsCard: {
    padding: '1.5rem',
  },
  logsContainer: {
    background: '#04070f',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '12px',
    padding: '1rem',
    minHeight: '265px',
    maxHeight: '265px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
  },
  logRow: {
    display: 'flex',
    gap: '0.75rem',
    padding: '0.4rem 0',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
  },
  logTime: {
    color: 'var(--accent-cyan)',
    fontWeight: 'bold',
  },
  logMsg: {
    color: '#cbd5e1',
    wordBreak: 'break-all',
  },
  emptyLogs: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: 'var(--text-muted)',
    height: '100%',
    padding: '3rem 1rem',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    fontSize: '1.1rem',
    color: 'var(--text-muted)',
  },
  errorAlert: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#fca5a5',
    padding: '0.8rem 1rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
  }
};
