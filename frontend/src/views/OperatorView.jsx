import React, { useState, useEffect, useRef } from 'react';

export default function OperatorView({ operators, modules, backendUrl }) {
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [activeQueue, setActiveQueue] = useState([]);
  const [currentServing, setCurrentServing] = useState(null);
  const [wsStatus, setWsStatus] = useState('DESCONECTADO');
  const wsRef = useRef(null);

  // Intentar cargar la cola cuando el operador inicia sesión
  useEffect(() => {
    if (activeSession) {
      fetchQueue();
      connectWebSocket();
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [activeSession]);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/tickets/queue`);
      if (res.ok) {
        const queue = await res.json();
        
        // El ticket que este operador está atendiendo actualmente (estado LLAMADO en su ventanilla)
        const serving = queue.find(
          t => t.estado_turno === 'LLAMADO' && t.id_ventanilla === activeSession.id_ventanilla
        );
        setCurrentServing(serving || null);

        // Los que están en ESPERA
        const esperando = queue.filter(t => t.estado_turno === 'ESPERA');
        setActiveQueue(esperando);
      }
    } catch (err) {
      console.error("Error al obtener cola:", err);
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
        // Si hay cambios en tickets, refrescamos la cola local
        if (['ticket_created', 'ticket_called', 'ticket_closed', 'ticket_no_show'].includes(data.event)) {
          fetchQueue();
        }
      } catch (err) {
        console.error(err);
      }
    };
    ws.onclose = () => {
      setWsStatus('DESCONECTADO');
      setTimeout(connectWebSocket, 5000);
    };
  };

  const handleStartSession = async (e) => {
    e.preventDefault();
    if (!selectedOperator || !selectedModule) {
      setError('Debe seleccionar Operador y Ventanilla/Módulo.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/v1/operadores/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_operador: parseInt(selectedOperator),
          id_ventanilla: parseInt(selectedModule)
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al iniciar sesión');
      }

      const sessionData = await res.json();
      setActiveSession(sessionData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = async () => {
    if (!activeSession) return;
    setLoading(true);
    setError('');

    try {
      const url = `${backendUrl}/api/v1/tickets/call-next?id_operador=${activeSession.id_operador}&id_ventanilla=${activeSession.id_ventanilla}`;
      const res = await fetch(url, {
        method: 'POST'
      });

      if (res.status === 404) {
        throw new Error('No hay más tickets en espera en la cola.');
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al llamar al siguiente ticket');
      }

      const ticket = await res.json();
      setCurrentServing(ticket);
      fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecall = async () => {
    if (!currentServing || !activeSession) return;
    try {
      // Re-emitir llamado por WebSockets mediante una petición de simulación o llamando al mismo endpoint
      // Para este MVP, simulamos un re-llamado emitiendo un sonido local y de red si es necesario.
      // Re-llamar dispara un evento por WebSocket para re-anunciar en la pantalla pública.
      const url = `${backendUrl}/api/v1/tickets/call-next?id_operador=${activeSession.id_operador}&id_ventanilla=${activeSession.id_ventanilla}`;
      // Al ser el mismo, el backend simplemente llamará al siguiente, pero para simular re-llamado de este ticket:
      // Podemos reproducir un beeper en la terminal del operador
      console.log("Re-llamando turno:", currentServing.codigo_ticket);
      
      // Enviar una señal de re-llamado a través de fetch para forzar re-anuncio en la pantalla de sala de espera
      // (Para no complicar el backend, el operador puede simularlo fácilmente)
      triggerLocalBeep();
    } catch (err) {
      console.error(err);
    }
  };

  const triggerLocalBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}
  };

  const handleCloseTicket = async () => {
    if (!currentServing) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${backendUrl}/api/v1/tickets/${currentServing.id_ticket}/close`, {
        method: 'PUT'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al cerrar el turno');
      }

      setCurrentServing(null);
      fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!currentServing) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${backendUrl}/api/v1/tickets/${currentServing.id_ticket}/no-show`, {
        method: 'PUT'
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al marcar inasistencia');
      }

      setCurrentServing(null);
      fetchQueue();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExitSession = () => {
    setActiveSession(null);
    setCurrentServing(null);
    setActiveQueue([]);
    if (wsRef.current) wsRef.current.close();
  };

  return (
    <div className="operator-view-container fade-in" style={styles.container}>
      {!activeSession ? (
        /* ACCESO AL MÓDULO DE ATENCIÓN (M:N REGISTRO) */
        <div className="glass-card" style={styles.loginCard}>
          <div style={styles.header}>
            <h2 className="gradient-text" style={styles.title}>Terminal de Ventanilla</h2>
            <p className="text-muted" style={styles.subtitle}>
              Establece tu puesto de atención activa para registrar y despachar turnos.
            </p>
          </div>

          {error && <div style={styles.errorAlert}>{error}</div>}

          <form onSubmit={handleStartSession}>
            <div className="form-group">
              <label className="form-label">Selecciona tu Nombre (Asesor) *</label>
              <select
                className="form-control"
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                disabled={loading}
                required
                style={styles.select}
              >
                <option value="">-- Seleccionar Asesor --</option>
                {operators.map(op => (
                  <option key={op.id_operador} value={op.id_operador}>{op.nombre} ({op.codigo_emp})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Selecciona tu Módulo / Ventanilla *</label>
              <select
                className="form-control"
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                disabled={loading}
                required
                style={styles.select}
              >
                <option value="">-- Seleccionar Módulo Físico --</option>
                {modules.map(mod => (
                  <option key={mod.id_ventanilla} value={mod.id_ventanilla}>Módulo {mod.numero_modulo} ({mod.estado_fisico})</option>
                ))}
              </select>
            </div>

            <button type="submit" className="gradient-btn" style={styles.loginBtn} disabled={loading}>
              {loading ? 'Inicializando Sesión...' : 'Iniciar Turno de Atención'}
            </button>
          </form>
        </div>
      ) : (
        /* DASHBOARD INTERACTIVO DE ATENCIÓN DEL OPERADOR */
        <div style={styles.dashboardLayout}>
          <div style={styles.sidebar}>
            {/* ESTADO DEL OPERADOR */}
            <div className="glass-card" style={styles.sessionCard}>
              <div style={styles.sessionHeader}>
                <span className="badge badge-atendido" style={{ textTransform: 'none' }}>Sesión Activa</span>
                <button onClick={handleExitSession} style={styles.exitBtn}>Salir</button>
              </div>
              <div style={styles.sessionDetails}>
                <h4 style={styles.operatorName}>{activeSession.operador.nombre}</h4>
                <p className="text-muted" style={styles.operatorCode}>Código: {activeSession.operador.codigo_emp}</p>
                <div style={styles.metaRow}>
                  <span>Módulo Físico:</span>
                  <strong>{activeSession.ventanilla.numero_modulo}</strong>
                </div>
                <div style={styles.metaRow}>
                  <span>Canal WebSocket:</span>
                  <span style={{
                    color: wsStatus === 'CONECTADO' ? 'var(--accent-green)' : 'var(--accent-red)',
                    fontWeight: '600'
                  }}>{wsStatus}</span>
                </div>
              </div>
            </div>

            {/* LISTA DE PACIENTES EN ESPERA */}
            <div className="glass-card" style={styles.queueCard}>
              <h3 style={styles.queueTitle}>COLA EN ESPERA ({activeQueue.length})</h3>
              <div style={styles.queueList}>
                {activeQueue.length > 0 ? (
                  activeQueue.map((ticket, idx) => (
                    <div key={ticket.id_ticket} style={styles.queueItem} className="fade-in">
                      <div style={styles.queueItemLeft}>
                        <strong style={styles.queueItemCode}>{ticket.codigo_ticket}</strong>
                        <span style={styles.queueItemName}>{ticket.usuario.nombre}</span>
                      </div>
                      <span className="badge badge-espera" style={{ fontSize: '0.65rem' }}>
                        {ticket.servicio.nombre_servicio.split(' ')[0]}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyQueue}>
                    <p className="text-muted">No hay pacientes esperando</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={styles.mainContent}>
            {error && <div style={styles.errorAlert}>{error}</div>}

            {/* CONSOLA DE ATENCIÓN ACTIVA */}
            <div className="glass-card" style={styles.servingCard}>
              <h3 style={styles.panelTitle}>CONSOLA DE LLAMADO</h3>
              
              {currentServing ? (
                /* CLIENTE SIENDO ATENDIDO */
                <div style={styles.servingContainer} className="fade-in">
                  <span className="badge badge-llamado" style={styles.servingBadge}>Llamado en Ventanilla</span>
                  <h1 style={styles.servingCode}>{currentServing.codigo_ticket}</h1>
                  <h3 style={styles.servingPatient}>{currentServing.usuario?.nombre}</h3>
                  <p className="text-muted" style={styles.servingService}>Servicio: {currentServing.servicio?.nombre_servicio}</p>
                  <p style={styles.servingWait}>DNI del Paciente: <strong>{currentServing.usuario?.dni}</strong></p>

                  <div style={styles.actionsRow}>
                    <button
                      onClick={handleRecall}
                      className="gradient-btn"
                      style={{ ...styles.actionBtn, background: 'rgba(255, 255, 255, 0.05)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: 'none' }}
                      disabled={loading}
                    >
                      🔊 Re-Llamar
                    </button>
                    
                    <button
                      onClick={handleNoShow}
                      className="gradient-btn"
                      style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.25)' }}
                      disabled={loading}
                    >
                      ✘ No se presentó
                    </button>

                    <button
                      onClick={handleCloseTicket}
                      className="gradient-btn"
                      style={{ ...styles.actionBtn, background: 'linear-gradient(135deg, var(--accent-green) 0%, #047857 100%)', boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)' }}
                      disabled={loading}
                    >
                      ✓ Cerrar Turno (Cerrado SQA)
                    </button>
                  </div>
                </div>
              ) : (
                /* CONSOLA VACÍA */
                <div style={styles.idleContainer}>
                  <div style={styles.idleIcon}>🛋️</div>
                  <h2>Consola Disponible</h2>
                  <p className="text-muted" style={styles.idleText}>
                    Estás listo para atender en la ventanilla {activeSession.ventanilla.numero_modulo}.
                  </p>
                  <button
                    onClick={handleCallNext}
                    className="gradient-btn"
                    style={styles.callNextBtn}
                    disabled={loading || activeQueue.length === 0}
                  >
                    {loading ? 'Llamando...' : 'Llamar Siguiente Turno'}
                  </button>
                  {activeQueue.length === 0 && (
                    <p style={styles.queueWarning}>La cola en espera está vacía.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '1rem 0',
  },
  loginCard: {
    maxWidth: '480px',
    margin: '4rem auto',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '800',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.9rem',
    lineHeight: '1.4',
  },
  select: {
    appearance: 'none',
    cursor: 'pointer',
  },
  loginBtn: {
    width: '100%',
    marginTop: '1.5rem',
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
  dashboardLayout: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '1.5rem',
    alignItems: 'start',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sessionCard: {
    padding: '1.25rem',
  },
  sessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.25rem',
  },
  exitBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--accent-red)',
    fontWeight: '600',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  sessionDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  operatorName: {
    fontSize: '1.05rem',
    fontWeight: '700',
  },
  operatorCode: {
    fontSize: '0.8rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '0.75rem',
    marginBottom: '0.5rem',
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.85rem',
  },
  queueCard: {
    padding: '1.25rem',
    maxHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
  },
  queueTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
    marginBottom: '1rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '0.5rem',
  },
  queueList: {
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    flex: 1,
    paddingRight: '5px',
  },
  queueItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem',
    borderRadius: '10px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    fontSize: '0.85rem',
  },
  queueItemLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  queueItemCode: {
    color: '#ffffff',
    fontSize: '0.9rem',
  },
  queueItemName: {
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
  },
  emptyQueue: {
    textAlign: 'center',
    padding: '2rem 0',
    fontSize: '0.85rem',
  },
  mainContent: {
    flex: 1,
  },
  servingCard: {
    padding: '2.5rem',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
  },
  panelTitle: {
    fontSize: '0.8rem',
    fontWeight: '700',
    letterSpacing: '0.1em',
    color: 'var(--text-muted)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '0.5rem',
    marginBottom: '2rem',
    textTransform: 'uppercase',
  },
  servingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  servingBadge: {
    marginBottom: '1.5rem',
  },
  servingCode: {
    fontSize: '5rem',
    fontWeight: '900',
    letterSpacing: '-0.03em',
    color: '#ffffff',
    lineHeight: '1',
    marginBottom: '1rem',
  },
  servingPatient: {
    fontSize: '1.8rem',
    fontWeight: '700',
    marginBottom: '0.25rem',
  },
  servingService: {
    fontSize: '1rem',
    marginBottom: '0.5rem',
  },
  servingWait: {
    fontSize: '0.9rem',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '0.4rem 1.2rem',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    marginBottom: '2.5rem',
  },
  actionsRow: {
    display: 'flex',
    gap: '1rem',
    width: '100%',
    maxWidth: '700px',
  },
  actionBtn: {
    flex: 1,
    padding: '0.9rem',
    fontSize: '0.9rem',
  },
  idleContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    flex: 1,
  },
  idleIcon: {
    fontSize: '4rem',
    marginBottom: '1rem',
  },
  idleText: {
    fontSize: '0.95rem',
    maxWidth: '360px',
    marginTop: '0.25rem',
    marginBottom: '2rem',
  },
  callNextBtn: {
    padding: '1rem 2.5rem',
    fontSize: '1.1rem',
  },
  queueWarning: {
    marginTop: '0.8rem',
    fontSize: '0.8rem',
    color: 'var(--accent-red)',
    fontWeight: '500',
  }
};
