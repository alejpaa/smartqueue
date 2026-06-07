import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import sys
import os

# Añadir directorio backend al path de python para poder importar app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, get_db
from app.main import app
import app.models as models

# Configuración de base de datos de pruebas aislada para los tests de SQA
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instance")
os.makedirs(DB_DIR, exist_ok=True)
TEST_DB_PATH = os.path.join(DB_DIR, "test_sqa.db")

# Si ya existe, lo eliminamos al iniciar
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except Exception:
        pass

SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Reemplazar la dependencia de la base de datos
def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    # Crear tablas en la BD de pruebas limpia
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Cargar datos base mínimos para los tests
    servicio = models.Servicio(nombre_servicio="Consulta Médica Test", descripcion="Test")
    operador = models.Operador(nombre="Anderson SQA Tester", codigo_emp="EMP-TEST")
    ventanilla = models.Ventanilla(numero_modulo=10, estado_fisico="ACTIVO")
    
    db.add_all([servicio, operador, ventanilla])
    db.commit()
    db.close()
    
    yield
    
    # Restablecer configuración de caos
    from app.main import CHAOS_SETTINGS
    CHAOS_SETTINGS["latency_ms"] = 0
    CHAOS_SETTINGS["db_failure_rate"] = 0.0
    CHAOS_SETTINGS["server_down"] = False

    # Limpiar tablas y cerrar todo
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except Exception:
            pass

# ==================== TESTS SQA: INTEGRACIÓN DE API ====================

def test_get_servicios_api():
    """Prueba que el endpoint exponga correctamente la lista de servicios."""
    response = client.get("/api/v1/servicios")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["nombre_servicio"] == "Consulta Médica Test"

def test_create_ticket_api():
    """Prueba que la Transacción 1 (Registro de Ticket) funcione correctamente."""
    # Enviar payload para crear ticket
    payload = {
        "nombre": "Alejandro Padilla",
        "dni": "77777777",
        "celular": "999888777",
        "id_servicio": 1
    }
    response = client.post("/api/v1/tickets", json=payload)
    assert response.status_code == 201
    data = response.json()
    
    # Validar campos del ticket generado
    assert data["codigo_ticket"].startswith("CON-")  # Prefijo abreviado de Consulta
    assert data["estado_turno"] == "ESPERA"
    assert data["usuario"]["dni"] == "77777777"
    assert data["tiempo_espera_estimado"] > 0

# ==================== TESTS SQA: INTEGRIDAD DE LA BASE DE DATOS (ACID & ROLLBACK) ====================

def test_acid_rollback_on_failed_transaction():
    """
    TEST DE ASEGURAMIENTO DE CALIDAD (SQA):
    Verifica que si ocurre un fallo durante la creación del Ticket (por ejemplo,
    un id_servicio inexistente), el bloque transaccional ACID realice un ROLLBACK completo.
    Garantiza que no se guarde el 'Usuario' en la base de datos de manera inconsistente
    (Atomocidad: todo o nada).
    """
    db = TestingSessionLocal()
    
    # Asegurar que el usuario no existe inicialmente
    dni_test = "99999999"
    usuario_existente = db.query(models.Usuario).filter(models.Usuario.dni == dni_test).first()
    assert usuario_existente is None
    db.close()
    
    # Intentar registrar ticket con id_servicio inexistente (provocará error 404 en FastAPI,
    # pero a nivel transaccional probamos que no quede un Usuario huérfano sin ticket en la base de datos)
    payload = {
        "nombre": "Cliente Fallido",
        "dni": dni_test,
        "celular": "123456789",
        "id_servicio": 999  # ID inexistente
    }
    
    response = client.post("/api/v1/tickets", json=payload)
    assert response.status_code == 404
    
    # Verificar que el usuario 'Cliente Fallido' NO se haya registrado
    # porque la transacción general falló y se aplicó ROLLBACK
    db = TestingSessionLocal()
    usuario_guardado = db.query(models.Usuario).filter(models.Usuario.dni == dni_test).first()
    assert usuario_guardado is None, "ERROR SQA: ¡Se guardó el usuario a pesar de que el ticket falló! (Fallo de Atomicidad)"
    db.close()

def test_operator_session_integrity():
    """
    Prueba que el registro de sesión del operador mantenga la consistencia.
    Si se registra en un módulo, se deben desactivar sesiones previas del mismo operador.
    """
    # 1. Crear sesión para operador 1 en módulo 10 (id_operador=1, id_ventanilla=1)
    payload = {
        "id_operador": 1,
        "id_ventanilla": 1
    }
    response1 = client.post("/api/v1/operadores/session", json=payload)
    assert response1.status_code == 200
    assert response1.json()["activo"] is True
    
    # 2. Iniciar sesión del mismo operador en otra ventanilla o volver a iniciar
    # Esto debe desactivar automáticamente la sesión previa del mismo operador
    response2 = client.post("/api/v1/operadores/session", json=payload)
    assert response2.status_code == 200
    
    # Verificar en BD que solo quede una asignación activa
    db = TestingSessionLocal()
    activas = db.query(models.AsignacionModulo).filter(
        models.AsignacionModulo.id_operador == 1,
        models.AsignacionModulo.activo == True
    ).count()
    assert activas == 1, "ERROR SQA: Múltiples sesiones activas registradas para el mismo operador"
    db.close()

# ==================== TESTS DE INGENIERÍA DE CAOS SQA ====================

def test_chaos_endpoints():
    """Verifica que los endpoints de configuración de caos funcionen."""
    from app.main import CHAOS_SETTINGS
    
    # GET inicial
    res = client.get("/api/v1/chaos/config")
    assert res.status_code == 200
    assert res.json()["latency_ms"] == 0
    assert res.json()["server_down"] is False

    # POST actualización
    payload = {"latency_ms": 500, "db_failure_rate": 0.5, "server_down": True}
    res_post = client.post("/api/v1/chaos/config", json=payload)
    assert res_post.status_code == 200
    assert res_post.json()["latency_ms"] == 500
    assert res_post.json()["server_down"] is True

    # Comprobar que el estado global en memoria cambió
    assert CHAOS_SETTINGS["latency_ms"] == 500
    assert CHAOS_SETTINGS["server_down"] is True


def test_chaos_server_down_simulation():
    """Comprueba que si el servidor está caído (server_down=True) los endpoints ordinarios dan 503."""
    # Activar caída del servidor
    client.post("/api/v1/chaos/config", json={"latency_ms": 0, "db_failure_rate": 0.0, "server_down": True})

    # Intentar acceder a un endpoint normal
    res = client.get("/api/v1/servicios")
    assert res.status_code == 503
    assert res.json()["detail"] == "Servidor fuera de servicio (Simulacion de Caos)"

    # El endpoint de configuración de caos debe seguir respondiendo para permitir apagar la simulación
    res_config = client.get("/api/v1/chaos/config")
    assert res_config.status_code == 200


def test_chaos_latency_injection():
    """Comprueba que se inyecta latencia de red de forma efectiva."""
    # Activar latencia de 200 ms
    client.post("/api/v1/chaos/config", json={"latency_ms": 200, "db_failure_rate": 0.0, "server_down": False})

    start_time = time.time()
    res = client.get("/api/v1/servicios")
    elapsed_time = (time.time() - start_time) * 1000

    assert res.status_code == 200
    assert elapsed_time >= 200  # Debe haber tardado al menos 200ms


def test_chaos_db_transaction_rollback():
    """
    Verifica que la tasa de fallo de base de datos del 100% (1.0)
    provoque un rollback de la transacción y no escriba datos huérfanos.
    """
    # Activar fallos de base de datos en 100%
    client.post("/api/v1/chaos/config", json={"latency_ms": 0, "db_failure_rate": 1.0, "server_down": False})

    # Asegurar que el usuario no existe inicialmente
    dni_test = "88888888"
    db = TestingSessionLocal()
    usuario_previo = db.query(models.Usuario).filter(models.Usuario.dni == dni_test).first()
    assert usuario_previo is None
    db.close()

    # Intentar registrar un ticket
    payload = {
        "nombre": "Juan Caos",
        "dni": dni_test,
        "celular": "999888777",
        "id_servicio": 1
    }
    
    res = client.post("/api/v1/tickets", json=payload)
    assert res.status_code == 500
    assert "Fallo de integridad transaccional simulado" in res.json()["detail"]

    # Verificar que NO se haya insertado el usuario debido al rollback
    db = TestingSessionLocal()
    usuario_despues = db.query(models.Usuario).filter(models.Usuario.dni == dni_test).first()
    assert usuario_despues is None, "ERROR SQA: Se creó el usuario a pesar de fallar la transacción (Rollback fallido en caos)"
    db.close()
