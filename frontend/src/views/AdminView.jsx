import React, { useState, useEffect, useRef } from 'react';

export default function AdminView({ backendUrl }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wsStatus, setWsStatus] = useState('DESCONECTADO');
  const [auditLogs, setAuditLogs] = useState([]);
  const wsRef = useRef(null);

  // Estados de Ingeniería de Caos
  const [chaosConfig, setChaosConfig] = useState({
    latency_ms: 0,
    db_failure_rate: 0.0,
    server_down: false
  });
  const [requestStats, setRequestStats] = useState({ total: 0, success: 0 });
  const [mttrInfo, setMttrInfo] = useState({ mttr: null, lastOutageTime: null });

  useEffect(() => {
    fetchMetrics();
    fetchChaosConfig();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchChaosConfig = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/chaos/config`);
      if (res.ok) {
        const data = await res.json();
        setChaosConfig(data);
      }
    } catch (err) {
      console.error("Error al cargar configuración de caos:", err);
    }
  };

  const updateChaos = async (updatedFields) => {
    const updatedConfig = { ...chaosConfig, ...updatedFields };
    try {
      const res = await fetch(`${backendUrl}/api/v1/chaos/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      if (res.ok) {
        const data = await res.json();
        setChaosConfig(data);
        const timestamp = new Date().toLocaleTimeString();
        const msg = `[Simulación] Configuración actualizada: Latencia=${data.latency_ms}ms, Fallos DB=${Math.round(data.db_failure_rate*100)}%, Caída del Backend=${data.server_down ? 'ACTIVA' : 'INACTIVA'}`;
        setAuditLogs(prev => [{ time: timestamp, msg }, ...prev].slice(0, 15));
      }
    } catch (err) {
      console.error("Error al actualizar configuración de caos:", err);
    }
  };

  const fetchMetrics = async () => {
    setRequestStats(prev => ({ ...prev, total: prev.total + 1 }));
    try {
      const res = await fetch(`${backendUrl}/api/v1/admin/metrics`);
      if (!res.ok) throw new Error('Error al cargar métricas del servidor');
      const data = await res.json();
      setMetrics(data);
      setError('');
      setRequestStats(prev => ({ ...prev, success: prev.success + 1 }));
      
      // Calcular MTTR en recuperación exitosa
      setMttrInfo(prev => {
        if (prev.lastOutageTime) {
          const recoveryTime = ((Date.now() - prev.lastOutageTime) / 1000).toFixed(1);
          const timestamp = new Date().toLocaleTimeString();
          setAuditLogs(logs => [
            { time: timestamp, msg: `[Sistema] Backend restablecido en ${recoveryTime}s (MTTR)` },
            ...logs
          ].slice(0, 15));
          return { mttr: recoveryTime, lastOutageTime: null };
        }
        return prev;
      });
    } catch (err) {
      setError(err.message);
      setMttrInfo(prev => {
        if (!prev.lastOutageTime) {
          return { ...prev, lastOutageTime: Date.now() };
        }
        return prev;
      });
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
          logMsg = `[Turno Creado] Ticket ${data.ticket.codigo_ticket} para ${data.ticket.nombre_cliente} (Espera: ${data.ticket.tiempo_espera_estimado} min)`;
        } else if (data.event === 'ticket_called') {
          logMsg = `[Turno Llamado] Ticket ${data.ticket.codigo_ticket} convocado al Módulo ${data.ticket.numero_modulo}`;
        } else if (data.event === 'ticket_closed') {
          logMsg = `[Turno Finalizado] Cierre de ticket ${data.ticket.codigo_ticket} (Atención Finalizada)`;
        } else if (data.event === 'ticket_no_show') {
          logMsg = `[Inasistencia] Ticket ${data.ticket.codigo_ticket} marcado como inasistencia`;
        } else if (data.event === 'operator_session_started') {
          logMsg = `[Asesor Activo] Operador ${data.operador} activo en Ventanilla ${data.ventanilla}`;
        } else if (data.event === 'chaos_config_changed') {
          logMsg = `[Simulación] Configuración sincronizada: Latencia=${data.chaos_config.latency_ms}ms, Caída=${data.chaos_config.server_down ? 'SÍ' : 'NO'}`;
          setChaosConfig(data.chaos_config);
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
    return <div style={styles.loading}>Cargando Panel de Control...</div>;
  }

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.header}>
        <div>
          <h1 className="gradient-text" style={styles.title}>Panel de Control</h1>
          <p className="text-muted" style={styles.subtitle}>
            Supervisión operativa y métricas de rendimiento en tiempo real.
          </p>
        </div>
        <div style={styles.wsRow}>
          <span style={{
            ...styles.dot,
            backgroundColor: wsStatus === 'CONECTADO' ? 'var(--accent-emerald)' : 'var(--accent-rose)'
          }}></span>
          <span style={styles.wsText}>Canal de Eventos: {wsStatus === 'CONECTADO' ? 'Activo' : 'Desconectado'}</span>
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
          <p style={{ ...styles.metricFooter, color: 'var(--accent-indigo)' }}>
            SLA de Servicio: &lt; 15 min
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Tasa de Abandono</span>
          <h2 style={{ ...styles.metricValue, color: metrics?.tasa_abandono > 10 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>
            {metrics?.tasa_abandono} <span style={styles.metricUnit}>%</span>
          </h2>
          <p style={styles.metricFooter}>
            Índice de inasistencias y cancelados
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Uptime del Servidor</span>
          <h2 style={{ ...styles.metricValue, color: 'var(--accent-cyan)' }}>
            {metrics?.uptime_sistema} <span style={styles.metricUnit}>%</span>
          </h2>
          <p style={styles.metricFooter}>
            Disponibilidad general de sistemas
          </p>
        </div>

        <div className="glass-card" style={styles.metricCard}>
          <span style={styles.metricLabel}>Tickets Atendidos</span>
          <h2 style={{ ...styles.metricValue, color: 'var(--accent-emerald)' }}>
            {metrics?.total_atendidos} <span style={styles.metricUnit}>/ {metrics?.total_tickets}</span>
          </h2>
          <p style={styles.metricFooter}>
            Volumen de colas registrado hoy
          </p>
        </div>
      </div>

      {/* PANEL DE CONTROL DE INGENIERÍA DEL CAOS */}
      <div className="glass-card fade-in" style={styles.chaosPanel}>
        <div style={styles.chaosHeader}>
          <svg className="svg-icon svg-icon-lg" style={{ color: 'var(--accent-indigo)', marginRight: '1rem', width: '2.5rem', height: '2.5rem' }} viewBox="0 0 24 24">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <div>
            <h3 style={styles.chaosTitle}>Simulador de Resiliencia</h3>
            <p className="text-muted" style={styles.chaosSubtitle}>
              Configure condiciones extremas de red y bases de datos para evaluar el comportamiento de la aplicación en tiempo real.
            </p>
          </div>
        </div>

        <div style={styles.chaosContent}>
          {/* CONTROL: LATENCIA */}
          <div style={styles.chaosControlItem}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>Simular Latencia de Red</span>
              <span style={{
                ...styles.controlValue,
                color: chaosConfig.latency_ms > 1000 ? 'var(--accent-rose)' : chaosConfig.latency_ms > 200 ? 'var(--accent-amber)' : 'var(--accent-indigo)'
              }}>
                {chaosConfig.latency_ms} ms
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="2000"
              step="100"
              value={chaosConfig.latency_ms}
              onChange={(e) => updateChaos({ latency_ms: parseInt(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.controlDesc}>Introduce un retraso artificial en milisegundos a todos los endpoints del negocio.</span>
          </div>

          {/* CONTROL: FALLOS DE TRANSACCIÓN */}
          <div style={styles.chaosControlItem}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>Tasa de Fallos de Transacción (Base de Datos)</span>
              <span style={{
                ...styles.controlValue,
                color: chaosConfig.db_failure_rate > 0.5 ? 'var(--accent-rose)' : chaosConfig.db_failure_rate > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)'
              }}>
                {Math.round(chaosConfig.db_failure_rate * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={chaosConfig.db_failure_rate}
              onChange={(e) => updateChaos({ db_failure_rate: parseFloat(e.target.value) })}
              style={styles.slider}
            />
            <span style={styles.controlDesc}>Probabilidad de abortar transacciones de base de datos para forzar reversiones automáticas.</span>
          </div>

          {/* CONTROL: SERVIDOR CAÍDO */}
          <div style={styles.chaosControlItem}>
            <div style={styles.controlHeader}>
              <span style={styles.controlLabel}>Simular Caída del Backend</span>
            </div>
            <button
              onClick={() => updateChaos({ server_down: !chaosConfig.server_down })}
              style={{
                ...styles.toggleBtn,
                background: chaosConfig.server_down ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.03)',
                borderColor: chaosConfig.server_down ? 'var(--accent-rose)' : 'rgba(255,255,255,0.08)',
                color: chaosConfig.server_down ? 'var(--accent-rose)' : 'var(--text-primary)'
              }}
            >
              {chaosConfig.server_down ? 'Servidor Offline' : 'Servidor Activo'}
            </button>
            <span style={styles.controlDesc}>Retorna error de servidor offline (código 503) en todas las operaciones del backend.</span>
          </div>

          {/* MONITOR DE RESILIENCIA SQA */}
          <div style={styles.resilienceMonitor}>
            <h4 style={styles.resilienceTitle}>Métricas de Resiliencia</h4>
            <div style={styles.resilienceMetrics}>
              <div style={styles.resilienceMetricBox}>
                <span style={styles.resilienceLabel}>Éxito de Peticiones</span>
                <span style={{
                  ...styles.resilienceValue,
                  color: requestStats.total === 0 ? 'var(--text-primary)' : (requestStats.success / requestStats.total) > 0.9 ? 'var(--accent-emerald)' : (requestStats.success / requestStats.total) > 0.5 ? 'var(--accent-amber)' : 'var(--accent-rose)'
                }}>
                  {requestStats.total === 0 ? '100%' : `${((requestStats.success / requestStats.total) * 100).toFixed(1)}%`}
                </span>
              </div>
              <div style={styles.resilienceMetricBox}>
                <span style={styles.resilienceLabel}>Tiempo de Recuperación</span>
                <span style={{ ...styles.resilienceValue, color: 'var(--accent-cyan)' }}>
                  {mttrInfo.mttr ? `${mttrInfo.mttr}s` : 'Estable'}
                </span>
              </div>
            </div>
            <button
              onClick={() => updateChaos({ latency_ms: 0, db_failure_rate: 0.0, server_down: false })}
              style={styles.resetChaosBtn}
            >
              Restablecer Configuración
            </button>
          </div>
        </div>
      </div>

      <div style={styles.detailsGrid}>
        {/* PANEL IZQUIERDO: LATENCIA DE TRANSACCIONES */}
        <div className="glass-card" style={styles.chartCard}>
          <h3 style={styles.cardTitle}>LATENCIA DE TRANSACCIONES (DB)</h3>
          <p className="text-muted" style={styles.cardDesc}>
            Monitoreo en milisegundos del tiempo de respuesta del motor de base de datos.
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
                      background: lat > 35 ? 'var(--accent-rose)' : lat > 20 ? 'var(--accent-amber)' : 'var(--accent-indigo)'
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
            <span style={{ color: 'var(--accent-emerald)' }}>● Rápido (&lt;20ms)</span>
            <span style={{ color: 'var(--accent-amber)' }}>● Moderado (20-35ms)</span>
            <span style={{ color: 'var(--accent-rose)' }}>● Lento (&gt;35ms)</span>
          </div>
        </div>

        {/* PANEL DERECHO: AUDITORÍA EN VIVO */}
        <div className="glass-card" style={styles.logsCard}>
          <h3 style={styles.cardTitle}>BITÁCORA DE EVENTOS</h3>
          <p className="text-muted" style={styles.cardDesc}>
            Monitoreo en vivo de transacciones y estados de colas.
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
                <p>Monitoreando canal de eventos...</p>
                <span>Realice operaciones en los paneles de cliente u operador para ver registros de actividad.</span>
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
    background: 'var(--console-bg)',
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
  },
  chaosPanel: {
    padding: '1.5rem',
    marginBottom: '1.5rem',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  chaosHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  chaosIcon: {
    fontSize: '1.5rem',
    background: 'rgba(239, 68, 68, 0.12)',
    padding: '0.4rem 0.6rem',
    borderRadius: '8px',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#ef4444',
  },
  chaosTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#ffffff',
  },
  chaosSubtitle: {
    fontSize: '0.8rem',
    marginTop: '0.1rem',
  },
  chaosContent: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1.5rem',
    alignItems: 'stretch',
  },
  chaosControlItem: {
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '10px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  controlHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  controlLabel: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: 'var(--text-main)',
  },
  controlValue: {
    fontSize: '0.85rem',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  controlDesc: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    lineHeight: '1.3',
  },
  slider: {
    width: '100%',
    accentColor: 'var(--accent-indigo)',
    cursor: 'pointer',
    height: '6px',
    borderRadius: '3px',
    background: 'rgba(255, 255, 255, 0.1)',
  },
  toggleBtn: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: '600',
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  resilienceMonitor: {
    background: 'rgba(99, 102, 241, 0.02)',
    border: '1px solid rgba(99, 102, 241, 0.08)',
    borderRadius: '10px',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '0.75rem',
  },
  resilienceTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'var(--accent-indigo)',
  },
  resilienceMetrics: {
    display: 'flex',
    gap: '1rem',
  },
  resilienceMetricBox: {
    flex: 1,
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    borderRadius: '6px',
    padding: '0.5rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resilienceLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
    marginBottom: '0.2rem',
  },
  resilienceValue: {
    fontSize: '1rem',
    fontWeight: '800',
  },
  resetChaosBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: 'var(--text-main)',
    padding: '0.45rem',
    fontSize: '0.75rem',
    fontWeight: '600',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
    textAlign: 'center',
  }
};
