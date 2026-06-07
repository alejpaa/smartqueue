import React, { useState, useEffect } from 'react';

export default function ClientView({ services, backendUrl }) {
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [celular, setCelular] = useState('');
  const [idServicio, setIdServicio] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState('');
  const [error, setError] = useState('');
  const [successTicket, setSuccessTicket] = useState(null);

  // Cargar ticket desde localStorage para resiliencia (SQA)
  useEffect(() => {
    const savedTicket = localStorage.getItem('smartqueue_active_ticket');
    if (savedTicket) {
      try {
        setSuccessTicket(JSON.parse(savedTicket));
      } catch (e) {
        console.error("Error al cargar ticket guardado:", e);
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nombre || !dni || !idServicio) {
      setError('Por favor complete todos los campos obligatorios (*).');
      return;
    }
    setError('');
    setLoading(true);
    setRetryStatus('');

    const maxRetries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${backendUrl}/api/v1/tickets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nombre,
            dni,
            celular: celular || null,
            id_servicio: parseInt(idServicio)
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          // Si es un error temporal (503), lanzamos para reintentar
          if (response.status === 503 && attempt < maxRetries) {
            throw new Error(`Servidor ocupado (Código 503)`);
          }
          throw new Error(errorData.detail || 'Fallo al generar el ticket');
        }

        const ticketData = await response.json();
        setSuccessTicket(ticketData);
        
        // Guardar en localStorage para tolerancia a caídas
        localStorage.setItem('smartqueue_active_ticket', JSON.stringify(ticketData));
        
        // Reset form
        setNombre('');
        setDni('');
        setCelular('');
        setIdServicio('');
        setRetryStatus('');
        setLoading(false);
        return; // Salir de la función al tener éxito
      } catch (err) {
        console.warn(`Intento ${attempt} de envío fallido:`, err.message);
        if (attempt === maxRetries) {
          setError(`Error tras ${maxRetries} intentos: ${err.message}`);
          setRetryStatus('');
          setLoading(false);
          return;
        }
        // Configurar mensaje de reintento
        setRetryStatus(`Error: ${err.message}. Reintentando envío (${attempt}/${maxRetries}) en ${delay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial
      }
    }
  };

  const handleReset = () => {
    localStorage.removeItem('smartqueue_active_ticket');
    setSuccessTicket(null);
    setError('');
    setRetryStatus('');
  };

  return (
    <div className="client-view-container fade-in" style={styles.container}>
      <div className="glass-card" style={styles.card}>
        {!successTicket ? (
          <>
            <div style={styles.header}>
              <h2 className="gradient-text" style={styles.title}>SmartQueue</h2>
              <p className="text-muted" style={styles.subtitle}>
                Digitaliza tu cola. Escanea el código QR físico de la sede y solicita tu turno en segundos.
              </p>
            </div>

            {error && <div style={styles.errorAlert}>{error}</div>}
            {retryStatus && <div style={styles.retryAlert}>{retryStatus}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div className="form-group">
                <label className="form-label">Nombre y Apellidos *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: Alejandro Padilla"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">DNI (Documento de Identidad) *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ej: 77777777"
                  value={dni}
                  maxLength={8}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Teléfono Celular (Opcional)</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="Ej: 999888777"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selecciona el Servicio *</label>
                <div style={styles.servicesGrid}>
                  {services.map((serv) => (
                    <div
                      key={serv.id_servicio}
                      onClick={() => !loading && setIdServicio(serv.id_servicio.toString())}
                      style={{
                        ...styles.serviceItem,
                        borderColor: idServicio === serv.id_servicio.toString() ? 'var(--accent-blue)' : 'rgba(255,255,255,0.06)',
                        background: idServicio === serv.id_servicio.toString() ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <h4 style={styles.serviceName}>{serv.nombre_servicio}</h4>
                      <p style={styles.serviceDesc}>{serv.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="gradient-btn"
                style={styles.submitBtn}
                disabled={loading}
              >
                {loading ? 'Generando Turno...' : 'Solicitar Turno Digital'}
              </button>
            </form>
          </>
        ) : (
          <div style={styles.successContainer} className="fade-in">
            <div style={styles.successIcon}>✓</div>
            <h3 style={styles.successTitle}>¡Turno Generado Exitosamente!</h3>
            <p className="text-muted" style={styles.successSub}>
              Guarda esta pantalla o toma captura. El sistema te llamará automáticamente.
            </p>

            {/* TICKET DIGITAL PREMIUM */}
            <div style={styles.ticketCard}>
              <div style={styles.ticketHeader}>
                <span style={styles.ticketHospital}>CLÍNICA SMARTQUEUE</span>
                <span className="badge badge-espera">{successTicket.estado_turno}</span>
              </div>
              <div style={styles.ticketBody}>
                <h1 style={styles.ticketCode}>{successTicket.codigo_ticket}</h1>
                <h4 style={styles.ticketService}>{successTicket.servicio?.nombre_servicio || successTicket.servicio}</h4>
                <div style={styles.divider}></div>
                <div style={styles.ticketDetails}>
                  <div style={styles.detailRow}>
                    <span className="text-muted">Paciente:</span>
                    <strong>{successTicket.usuario?.nombre || successTicket.nombre_cliente}</strong>
                  </div>
                  <div style={styles.detailRow}>
                    <span className="text-muted">DNI:</span>
                    <strong>{successTicket.usuario?.dni || successTicket.dni}</strong>
                  </div>
                  <div style={styles.detailRow}>
                    <span className="text-muted">Espera Aprox:</span>
                    <strong style={{ color: 'var(--accent-orange)' }}>
                      ~{successTicket.tiempo_espera_estimado} minutos
                    </strong>
                  </div>
                </div>
              </div>
              
              {/* CÓDIGO QR SIMULADO */}
              <div style={styles.qrContainer}>
                <div style={styles.qrCode}>
                  {/* Patrón de QR simulado con CSS grid */}
                  <div style={styles.qrGrid}>
                    {[...Array(64)].map((_, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: (i % 3 === 0 || i % 7 === 0 || i < 8 || i % 8 === 0 || i > 56) ? '#090d16' : '#ffffff',
                          gridArea: 'span 1'
                        }}
                      />
                    ))}
                  </div>
                </div>
                <p style={styles.qrText}>Escaneo de seguridad del ticket</p>
              </div>
              <div style={styles.ticketFooter}>
                <span>UNMSM - SQA Verification Certified</span>
              </div>
            </div>

            <button onClick={handleReset} className="gradient-btn" style={styles.resetBtn}>
              Pedir otro Turno
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '520px',
    margin: '0 auto',
    padding: '1rem 0'
  },
  card: {
    borderWidth: '1px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '0.95rem',
    lineHeight: '1.4',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  servicesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '0.8rem',
    marginTop: '0.5rem',
  },
  serviceItem: {
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '12px',
    padding: '0.85rem 1rem',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  serviceName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: 'var(--text-main)',
    marginBottom: '0.2rem',
  },
  serviceDesc: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    lineHeight: '1.3',
  },
  submitBtn: {
    marginTop: '1.5rem',
    width: '100%',
    padding: '0.9rem',
  },
  successContainer: {
    textAlign: 'center',
    padding: '1rem 0',
  },
  successIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.12)',
    border: '2px solid var(--accent-green)',
    color: 'var(--accent-green)',
    fontSize: '1.8rem',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  successTitle: {
    fontSize: '1.4rem',
    fontWeight: '700',
    marginBottom: '0.5rem',
  },
  successSub: {
    fontSize: '0.9rem',
    marginBottom: '1.8rem',
  },
  ticketCard: {
    background: '#ffffff',
    color: '#090d16',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 12px 30px rgba(0,0,0,0.15)',
    marginBottom: '2rem',
    textAlign: 'left',
    border: '1px solid #e2e8f0',
  },
  ticketHeader: {
    background: '#090d16',
    color: '#ffffff',
    padding: '0.75rem 1.25rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
  },
  ticketHospital: {
    color: '#60a5fa',
  },
  ticketBody: {
    padding: '1.5rem 1.5rem 1rem 1.5rem',
    textAlign: 'center',
  },
  ticketCode: {
    fontSize: '3.5rem',
    fontWeight: '900',
    color: '#090d16',
    letterSpacing: '-0.03em',
    lineHeight: '1',
    margin: '0.5rem 0',
  },
  ticketService: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#475569',
  },
  divider: {
    borderTop: '2px dashed #cbd5e1',
    margin: '1.25rem 0',
    position: 'relative',
  },
  ticketDetails: {
    textAlign: 'left',
    fontSize: '0.85rem',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 1.5rem 1.5rem 1.5rem',
    background: '#ffffff',
  },
  qrCode: {
    width: '90px',
    height: '90px',
    border: '1px solid #e2e8f0',
    padding: '5px',
    borderRadius: '8px',
    background: '#ffffff',
  },
  qrGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gridTemplateRows: 'repeat(8, 1fr)',
    width: '100%',
    height: '100%',
    gap: '1px',
  },
  qrText: {
    fontSize: '0.7rem',
    color: '#64748b',
    marginTop: '0.5rem',
    fontWeight: '500',
  },
  ticketFooter: {
    background: '#f8fafc',
    padding: '0.75rem 1.25rem',
    borderTop: '1px solid #e2e8f0',
    fontSize: '0.7rem',
    textAlign: 'center',
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: '0.05em',
  },
  resetBtn: {
    width: '100%',
  },
  retryAlert: {
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.2)',
    color: '#fde047',
    padding: '0.8rem 1rem',
    borderRadius: '10px',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
    textAlign: 'center',
    fontWeight: '600'
  }
};
