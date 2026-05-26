import React, { useState, useEffect } from 'react';
import ClientView from './views/ClientView';
import PublicView from './views/PublicView';
import OperatorView from './views/OperatorView';
import AdminView from './views/AdminView';

export default function App() {
  const [activeTab, setActiveTab] = useState('client'); // client, public, operator, admin
  const [services, setServices] = useState([]);
  const [operators, setOperators] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Usar la dirección del backend por defecto
  const backendUrl = 'http://localhost:8000';

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const [resServices, resOperators, resModules] = await Promise.all([
        fetch(`${backendUrl}/api/v1/servicios`),
        fetch(`${backendUrl}/api/v1/operadores`),
        fetch(`${backendUrl}/api/v1/ventanillas`)
      ]);

      if (!resServices.ok || !resOperators.ok || !resModules.ok) {
        throw new Error('Fallo al obtener datos iniciales de la base de datos.');
      }

      const [servicesData, operatorsData, modulesData] = await Promise.all([
        resServices.json(),
        resOperators.json(),
        resModules.json()
      ]);

      setServices(servicesData);
      setOperators(operatorsData);
      setModules(modulesData);
    } catch (err) {
      setError(
        'No se pudo conectar al servidor backend. Asegúrate de ejecutar el servidor de FastAPI (' +
        'uv run uvicorn app.main:app) en el puerto 8000 e inicializar la base de datos.'
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.appContainer}>
      {/* HEADER DE NAVEGACIÓN GLOWING PREMIUM */}
      <header className="glass-card" style={styles.navbar}>
        <div style={styles.navBrand}>
          <span style={styles.brandEmoji}>⚡</span>
          <span className="gradient-text" style={styles.brandText}>SmartQueue</span>
          <span style={styles.brandVersion}>v1.0 MVP + SQA</span>
        </div>
        <nav style={styles.navLinks}>
          <button
            onClick={() => setActiveTab('client')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'client' ? '#ffffff' : 'var(--text-muted)',
              background: activeTab === 'client' ? 'rgba(59,130,246,0.15)' : 'none',
              borderColor: activeTab === 'client' ? 'var(--accent-blue)' : 'transparent',
            }}
          >
            📱 Registro Cliente
          </button>
          <button
            onClick={() => setActiveTab('public')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'public' ? '#ffffff' : 'var(--text-muted)',
              background: activeTab === 'public' ? 'rgba(6,182,212,0.15)' : 'none',
              borderColor: activeTab === 'public' ? 'var(--accent-cyan)' : 'transparent',
            }}
          >
            📺 Pantalla Sala
          </button>
          <button
            onClick={() => setActiveTab('operator')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'operator' ? '#ffffff' : 'var(--text-muted)',
              background: activeTab === 'operator' ? 'rgba(139,92,246,0.15)' : 'none',
              borderColor: activeTab === 'operator' ? 'var(--accent-purple)' : 'transparent',
            }}
          >
            💼 Ventanilla Asesor
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'admin' ? '#ffffff' : 'var(--text-muted)',
              background: activeTab === 'admin' ? 'rgba(16,185,129,0.15)' : 'none',
              borderColor: activeTab === 'admin' ? 'var(--accent-green)' : 'transparent',
            }}
          >
            📈 Panel SQA
          </button>
        </nav>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="premium-container">
        {error && (
          <div style={styles.errorBanner} className="fade-in">
            <h4 style={styles.errTitle}>⚠️ Error de Conexión</h4>
            <p style={styles.errText}>{error}</p>
            <button onClick={fetchInitialData} style={styles.retryBtn}>
              🔄 Intentar Reconectar
            </button>
          </div>
        )}

        {!error && loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p className="text-muted">Cargando base de datos y servicios en tiempo real...</p>
          </div>
        ) : (
          !error && (
            <div className="fade-in">
              {activeTab === 'client' && (
                <ClientView services={services} backendUrl={backendUrl} />
              )}
              {activeTab === 'public' && (
                <PublicView backendUrl={backendUrl} />
              )}
              {activeTab === 'operator' && (
                <OperatorView operators={operators} modules={modules} backendUrl={backendUrl} />
              )}
              {activeTab === 'admin' && (
                <AdminView backendUrl={backendUrl} />
              )}
            </div>
          )
        )}
      </main>
      
      {/* PIE DE PÁGINA */}
      <footer style={styles.footer}>
        <p>Desarrollado para el avance del Proyecto **SmartQueue** • UNMSM Facultad de Ingeniería de Sistemas e Informática</p>
        <p style={styles.authors}>Autores: J. Brandon Fernandez Cavero • J. David Valqui Vargas • A. Tataje Rodriguez • Alejandro Manuel Padilla Arellano (2026)</p>
      </footer>
    </div>
  );
}

const styles = {
  appContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.8rem 2rem',
    margin: '1rem 1.5rem',
    borderRadius: '16px',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  navBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  brandEmoji: {
    fontSize: '1.4rem',
  },
  brandText: {
    fontSize: '1.4rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  brandVersion: {
    fontSize: '0.7rem',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    marginLeft: '0.5rem',
    color: 'var(--text-muted)',
    fontWeight: '600',
  },
  navLinks: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  navBtn: {
    border: '1px solid transparent',
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: '600',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  errorBanner: {
    background: 'rgba(239, 68, 68, 0.08)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    maxWidth: '650px',
    margin: '4rem auto',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
  },
  errTitle: {
    fontSize: '1.2rem',
    color: '#ef4444',
    marginBottom: '0.5rem',
  },
  errText: {
    fontSize: '0.95rem',
    color: '#fca5a5',
    lineHeight: '1.5',
    marginBottom: '1.5rem',
  },
  retryBtn: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#ffffff',
    borderRadius: '8px',
    padding: '0.6rem 1.5rem',
    fontWeight: '600',
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'all 0.25s ease',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    gap: '1rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.05)',
    borderTop: '3px solid var(--accent-blue)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    padding: '2.5rem 1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.03)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.4rem',
  },
  authors: {
    fontSize: '0.75rem',
    opacity: 0.8,
  }
};

// Insertar animación del spinner en la cabecera
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styleSheet);
}
