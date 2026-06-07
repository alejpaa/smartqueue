import React, { useState, useEffect, useRef } from 'react';

export default function PublicView({ backendUrl }) {
  const [currentCalled, setCurrentCalled] = useState(null);
  const [recentCalled, setRecentCalled] = useState([]);
  const [wsStatus, setWsStatus] = useState('DESCONECTADO');
  const wsRef = useRef(null);

  // Intentar cargar la cola activa inicial al montar
  useEffect(() => {
    fetchActiveQueue();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchActiveQueue = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/v1/tickets/queue`);
      if (res.ok) {
        const queue = await res.json();
        // Filtrar tickets en estado 'LLAMADO'
        const llamados = queue.filter(t => t.estado_turno === 'LLAMADO');
        if (llamados.length > 0) {
          // El más reciente en ser llamado es el último en tener hora_inicio_atencion
          const ordenados = llamados.sort((a, b) => new Date(b.hora_inicio_atencion) - new Date(a.hora_inicio_atencion));
          setCurrentCalled(ordenados[0]);
          if (ordenados.length > 1) {
            setRecentCalled(ordenados.slice(1, 6));
          }
        }
      }
    } catch (err) {
      console.error("Error al cargar cola inicial:", err);
    }
  };

  const connectWebSocket = () => {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Reemplazar http por ws para la conexión websocket
    const cleanUrl = backendUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}//${cleanUrl}/ws`;

    console.log("Conectando WebSocket a:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('CONECTADO');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Evento WebSocket recibido:", data);

        if (data.event === 'ticket_called') {
          const newCalled = {
            codigo_ticket: data.ticket.codigo_ticket,
            nombre_cliente: data.ticket.nombre_cliente,
            servicio: { nombre_servicio: data.ticket.servicio },
            ventanilla: { numero_modulo: data.ticket.numero_modulo }
          };

          // Actualizar estados
          setCurrentCalled(prev => {
            if (prev) {
              setRecentCalled(old => [prev, ...old].slice(0, 5));
            }
            return newCalled;
          });

          // Reproducir alerta auditiva y anunciar por voz
          triggerAudioAlert(data.ticket.codigo_ticket, data.ticket.numero_modulo);
        } else if (data.event === 'ticket_closed' || data.event === 'ticket_no_show') {
          // Si el ticket cerrado es el actual, lo limpiamos o recargamos
          fetchActiveQueue();
        }
      } catch (err) {
        console.error("Error al procesar mensaje de WebSocket:", err);
      }
    };

    ws.onclose = () => {
      setWsStatus('RECONECTANDO');
      // Intentar reconexión cada 3 segundos
      setTimeout(connectWebSocket, 3000);
    };
  };

  // Reproduce una alerta visual y auditiva combinada
  const triggerAudioAlert = (code, module) => {
    // 1. Sonido de campana electrónico usando la API de Web Audio nativa
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      // Primera nota (Do)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.5);

      // Segunda nota (Mi)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
        gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.6);
      }, 150);

    } catch (e) {
      console.warn("No se pudo iniciar contexto de audio nativo:", e);
    }

    // 2. Anuncio de Voz Sintetizado (Text-to-Speech)
    if ('speechSynthesis' in window) {
      // Cancelar cualquier discurso en curso
      window.speechSynthesis.cancel();

      const messageText = `Turno, ${code.split('').join(' ')}, por favor acercarse a la ventanilla ${module}`;
      const utterance = new SpeechSynthesisUtterance(messageText);
      utterance.lang = 'es-PE'; // Español Peruano / Latino
      utterance.rate = 0.9;     // Velocidad ligeramente pausada
      utterance.pitch = 1.0;
      
      // Intentar buscar una voz en español adecuada si está disponible
      const voices = window.speechSynthesis.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith('es'));
      if (esVoice) utterance.voice = esVoice;

      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div style={styles.container} className="fade-in">
      <div style={styles.header}>
        <div style={styles.logoRow}>
          <h1 className="gradient-text" style={styles.logo}>SmartQueue</h1>
          <span style={styles.tagline}>Módulo de Sala de Espera</span>
        </div>
        <div style={styles.statusRow}>
          <span style={{
            ...styles.dot,
            backgroundColor: wsStatus === 'CONECTADO' ? 'var(--accent-green)' : wsStatus === 'RECONECTANDO' ? 'var(--accent-orange)' : 'var(--accent-red)'
          }}></span>
          <span style={styles.wsText}>
            {wsStatus === 'CONECTADO' ? 'En Vivo' : wsStatus === 'RECONECTANDO' ? 'Reconectando...' : 'Desconectado'}
          </span>
        </div>
      </div>

      <div style={styles.mainGrid}>
        {/* PANEL PRINCIPAL: TURNO ACTUAL LLAMADO */}
        <div className="glass-card" style={styles.mainCard}>
          <h3 style={styles.panelTitle}>AHORA ATENDIENDO</h3>
          {currentCalled ? (
            <div style={styles.calloutContainer} className="fade-in">
              <div style={styles.glowCircle}>
                <h1 style={styles.codeText}>{currentCalled.codigo_ticket}</h1>
              </div>
              <h2 style={styles.moduleText}>
                IR A: <span style={{ color: 'var(--accent-purple)' }}>VENTANILLA {currentCalled.ventanilla?.numero_modulo}</span>
              </h2>
              <div style={styles.ticketMetaData}>
                <span style={styles.patientMeta}>Paciente: {currentCalled.nombre_cliente}</span>
                <span style={styles.serviceMeta}>{currentCalled.servicio?.nombre_servicio}</span>
              </div>
            </div>
          ) : (
            <div style={styles.emptyState}>
              <p>Esperando llamados de ventanilla...</p>
              <span style={styles.subEmpty}>Los turnos activos aparecerán en esta pantalla.</span>
            </div>
          )}
        </div>

        {/* PANEL LATERAL: HISTORIAL DE TURNOS LLAMADOS */}
        <div className="glass-card" style={styles.sidebarCard}>
          <h3 style={styles.panelTitle}>TURNOS RECIENTES</h3>
          <div style={styles.recentList}>
            {recentCalled.length > 0 ? (
              recentCalled.map((t, idx) => (
                <div key={idx} style={styles.recentItem} className="fade-in">
                  <div style={styles.recentItemLeft}>
                    <h3 style={styles.recentCode}>{t.codigo_ticket}</h3>
                    <span style={styles.recentServ}>{t.servicio?.nombre_servicio}</span>
                  </div>
                  <div style={styles.recentItemRight}>
                    <span style={styles.recentModuleBadge}>Ventanilla {t.ventanilla?.numero_modulo}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={styles.emptySidebar}>
                <p className="text-muted">No hay llamados previos</p>
              </div>
            )}
          </div>
          
          {/* SECCIÓN QR PARA ACCESO MÓVIL */}
          <div style={styles.qrAccessContainer}>
            <div style={styles.qrAccessDivider}></div>
            <h4 style={styles.qrAccessTitle}>📱 Registro Móvil</h4>
            <p className="text-muted" style={styles.qrAccessDesc}>
              Escanea este código QR con tu celular para solicitar tu turno digitalmente.
            </p>
            <div style={styles.qrAccessBox}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(window.location.origin)}`}
                alt="QR Registro Móvil"
                style={styles.qrAccessImg}
              />
            </div>
            <span style={styles.qrAccessUrl}>{window.location.origin}</span>
          </div>
        </div>
      </div>

      {/* MARQUEE / TICKER INFORMATIVO SQA */}
      <div style={styles.tickerContainer}>
        <div style={styles.tickerContent}>
          <span>⚠️ <strong>INFORMACIÓN AL PACIENTE:</strong> Por favor tenga a la mano su DNI.</span>
          <span>•</span>
          <span>📱 <strong>ATENCIÓN DIGITAL:</strong> Puede revisar el estado de la cola escaneando el código QR de su ticket en su celular.</span>
          <span>•</span>
          <span>🎓 <strong>PROYECTO UNMSM:</strong> SmartQueue SQA Framework - Verificando la calidad e integridad del servicio de atención ciudadana.</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '80vh',
    padding: '1rem 0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    paddingBottom: '1rem',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.8rem',
  },
  logo: {
    fontSize: '2.2rem',
    fontWeight: '800',
  },
  tagline: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    fontWeight: '500',
  },
  statusRow: {
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
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1.5rem',
    flex: 1,
    alignItems: 'stretch',
  },
  mainCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem',
    textAlign: 'center',
    background: 'radial-gradient(circle at center, rgba(139, 92, 246, 0.05) 0%, rgba(18, 24, 38, 0.75) 100%)',
  },
  panelTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    letterSpacing: '0.15em',
    color: 'var(--text-muted)',
    marginBottom: '2rem',
    textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    paddingBottom: '0.5rem',
    width: '100%',
    textAlign: 'center',
  },
  calloutContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  glowCircle: {
    width: '260px',
    height: '260px',
    borderRadius: '50%',
    background: 'rgba(18, 24, 38, 0.9)',
    border: '3px solid var(--accent-purple)',
    boxShadow: '0 0 30px rgba(139, 92, 246, 0.3), inset 0 0 20px rgba(139, 92, 246, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '2rem',
    animation: 'pulse-border 2s infinite',
  },
  codeText: {
    fontSize: '5rem',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  moduleText: {
    fontSize: '2.5rem',
    fontWeight: '800',
    letterSpacing: '-0.01em',
    marginBottom: '1rem',
  },
  ticketMetaData: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    background: 'rgba(255, 255, 255, 0.02)',
    padding: '0.8rem 2rem',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  },
  patientMeta: {
    fontSize: '1rem',
    fontWeight: '600',
    color: 'var(--text-main)',
  },
  serviceMeta: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    color: 'var(--text-muted)',
    fontSize: '1.2rem',
  },
  subEmpty: {
    fontSize: '0.9rem',
    marginTop: '0.5rem',
    opacity: 0.7,
  },
  sidebarCard: {
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
  },
  recentItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    transition: 'all 0.25s ease',
  },
  recentItemLeft: {
    display: 'flex',
    flexDirection: 'column',
  },
  recentCode: {
    fontSize: '1.3rem',
    fontWeight: '700',
    color: '#ffffff',
  },
  recentServ: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
  },
  recentItemRight: {
    display: 'flex',
    alignItems: 'center',
  },
  recentModuleBadge: {
    fontSize: '0.8rem',
    fontWeight: '600',
    padding: '0.35rem 0.75rem',
    borderRadius: '8px',
    background: 'rgba(139, 92, 246, 0.1)',
    color: 'var(--accent-purple)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
  },
  emptySidebar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    fontSize: '0.9rem',
  },
  tickerContainer: {
    marginTop: '2rem',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '10px',
    overflow: 'hidden',
    padding: '0.8rem 1rem',
  },
  tickerContent: {
    display: 'flex',
    gap: '3rem',
    animation: 'marquee 25s linear infinite',
    whiteSpace: 'nowrap',
    fontSize: '0.85rem',
    color: 'var(--text-main)',
  },
  qrAccessContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: '1rem',
  },
  qrAccessDivider: {
    width: '100%',
    borderTop: '1px dashed rgba(255, 255, 255, 0.08)',
    marginBottom: '1rem',
  },
  qrAccessTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: '0.3rem',
  },
  qrAccessDesc: {
    fontSize: '0.7rem',
    lineHeight: '1.3',
    maxWidth: '240px',
    marginBottom: '0.8rem',
  },
  qrAccessBox: {
    background: '#ffffff',
    padding: '6px',
    borderRadius: '8px',
    display: 'inline-flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '0.4rem',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  qrAccessImg: {
    width: '100px',
    height: '100px',
    display: 'block',
  },
  qrAccessUrl: {
    fontSize: '0.65rem',
    color: 'var(--accent-blue)',
    fontFamily: 'monospace',
    fontWeight: '600',
  }
};

// Insertar animación de marquesina en la cabecera del documento de forma programada
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    @keyframes marquee {
      0% { transform: translateX(100%); }
      100% { transform: translateX(-100%); }
    }
  `;
  document.head.appendChild(styleSheet);
}
