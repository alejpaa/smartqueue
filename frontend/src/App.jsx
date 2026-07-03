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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('smartqueue_theme') || 'dark';
  });

  // Usar la dirección del backend por defecto
  const backendUrl = 'http://localhost:8000';

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smartqueue_theme', theme);
  }, [theme]);

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
          <svg className="svg-icon" style={styles.brandIcon} viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span className="gradient-text" style={styles.brandText}>SmartQueue</span>
          <span style={styles.brandVersion}>Sistema Activo</span>
        </div>
        <nav style={styles.navLinks}>
          <button
            onClick={() => setActiveTab('client')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'client' ? 'var(--accent-indigo)' : 'var(--text-secondary)',
              background: activeTab === 'client' ? 'rgba(99,102,241,0.12)' : 'none',
              borderColor: activeTab === 'client' ? 'var(--accent-indigo)' : 'transparent',
            }}
          >
            <svg className="svg-icon" viewBox="0 0 24 24">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
              <path d="M13 5v14"/>
              <path d="M9 9h.01"/>
              <path d="M9 15h.01"/>
              <path d="M17 9h.01"/>
              <path d="M17 15h.01"/>
            </svg>
            Registro de Cliente
          </button>
          <button
            onClick={() => setActiveTab('public')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'public' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              background: activeTab === 'public' ? 'rgba(6,182,212,0.12)' : 'none',
              borderColor: activeTab === 'public' ? 'var(--accent-cyan)' : 'transparent',
            }}
          >
            <svg className="svg-icon" viewBox="0 0 24 24">
              <rect width="20" height="15" x="2" y="3" rx="2"/>
              <path d="M12 18v4"/>
              <path d="M8 22h8"/>
            </svg>
            Pantalla de Sala
          </button>
          <button
            onClick={() => setActiveTab('operator')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'operator' ? 'var(--accent-purple)' : 'var(--text-secondary)',
              background: activeTab === 'operator' ? 'rgba(139,92,246,0.12)' : 'none',
              borderColor: activeTab === 'operator' ? 'var(--accent-purple)' : 'transparent',
            }}
          >
            <svg className="svg-icon" viewBox="0 0 24 24">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="m16 11 2 2 4-4"/>
            </svg>
            Terminal de Asesor
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            style={{
              ...styles.navBtn,
              color: activeTab === 'admin' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              background: activeTab === 'admin' ? 'rgba(16,185,129,0.12)' : 'none',
              borderColor: activeTab === 'admin' ? 'var(--accent-emerald)' : 'transparent',
            }}
          >
            <svg className="svg-icon" viewBox="0 0 24 24">
              <line x1="18" x2="18" y1="20" y2="10"/>
              <line x1="12" x2="12" y1="20" y2="4"/>
              <line x1="6" x2="6" y1="20" y2="14"/>
            </svg>
            Panel de Control
          </button>
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={styles.themeToggleBtn}
            title={theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            {theme === 'dark' ? (
              <svg className="svg-icon" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
              </svg>
            ) : (
              <svg className="svg-icon" viewBox="0 0 24 24">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
        </nav>
      </header>

      {/* CUERPO PRINCIPAL */}
      <main className="premium-container">
        {error && (
          <div style={styles.errorBanner} className="fade-in">
            <h4 style={styles.errTitle}>Error de Conexión</h4>
            <p style={styles.errText}>{error}</p>
            <button onClick={fetchInitialData} style={styles.retryBtn}>
              Intentar Reconectar
            </button>
          </div>
        )}

        {!error && loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p className="text-muted">Estableciendo conexión en tiempo real...</p>
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
        <p>© 2026 SmartQueue • Sistema Inteligente de Gestión de Colas</p>
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
    gap: '0.6rem',
  },
  brandIcon: {
    width: '1.6rem',
    height: '1.6rem',
    stroke: 'var(--accent-indigo)',
    strokeWidth: 2.5,
    fill: 'none',
  },
  brandText: {
    fontSize: '1.4rem',
    fontWeight: '800',
    letterSpacing: '-0.02em',
  },
  brandVersion: {
    fontSize: '0.7rem',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '0.2rem 0.5rem',
    borderRadius: '6px',
    marginLeft: '0.4rem',
    color: 'var(--text-secondary)',
    fontWeight: '600',
  },
  navLinks: {
    display: 'flex',
    gap: '0.4rem',
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
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  errorBanner: {
    background: 'rgba(244, 63, 94, 0.05)',
    border: '1px solid rgba(244, 63, 94, 0.15)',
    borderRadius: '12px',
    padding: '2rem',
    textAlign: 'center',
    maxWidth: '600px',
    margin: '4rem auto',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
  },
  errTitle: {
    fontSize: '1.2rem',
    color: 'var(--accent-rose)',
    marginBottom: '0.5rem',
  },
  errText: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    marginBottom: '1.5rem',
  },
  retryBtn: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
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
    border: '3px solid rgba(255,255,255,0.03)',
    borderTop: '3px solid var(--accent-indigo)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  footer: {
    marginTop: 'auto',
    textAlign: 'center',
    padding: '2rem 1.5rem',
    borderTop: '1px solid rgba(255,255,255,0.02)',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  themeToggleBtn: {
    border: '1px solid var(--glass-border-hover)',
    padding: '0.5rem',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.01)',
    color: 'var(--text-primary)',
    marginLeft: '0.5rem',
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
