from .database import engine, Base, SessionLocal
from . import models

def seed_db():
    # Asegurar que las tablas estén creadas
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Poblando base de datos con datos de SmartQueue UNMSM...")
        
        # 1. Poblar Servicios
        servicios_data = [
            {"nombre_servicio": "Consulta Médica", "descripcion": "Atención médica general y chequeos de rutina"},
            {"nombre_servicio": "Triaje y Signos Vitales", "descripcion": "Evaluación de presión, temperatura y peso"},
            {"nombre_servicio": "Laboratorio Clínico", "descripcion": "Toma de muestras de sangre, orina y análisis clínicos"},
            {"nombre_servicio": "Caja y Facturación", "descripcion": "Pago de consultas, exámenes y farmacia"}
        ]
        
        for serv in servicios_data:
            exists = db.query(models.Servicio).filter(models.Servicio.nombre_servicio == serv["nombre_servicio"]).first()
            if not exists:
                nuevo_serv = models.Servicio(
                    nombre_servicio=serv["nombre_servicio"],
                    descripcion=serv["descripcion"]
                )
                db.add(nuevo_serv)
                print(f"Servicio agregado: {serv['nombre_servicio']}")

        # 2. Poblar Operadores (Autores del PDF de UNMSM)
        operadores_data = [
            {"nombre": "Juan Brandon Fernandez Cavero", "codigo_emp": "EMP-001"},
            {"nombre": "Jerson David Valqui Vargas", "codigo_emp": "EMP-002"},
            {"nombre": "Anderson Tataje Rodriguez", "codigo_emp": "EMP-003"},
            {"nombre": "Alejandro Manuel Padilla Arellano", "codigo_emp": "EMP-004"}
        ]
        
        for op in operadores_data:
            exists = db.query(models.Operador).filter(models.Operador.codigo_emp == op["codigo_emp"]).first()
            if not exists:
                nuevo_op = models.Operador(
                    nombre=op["nombre"],
                    codigo_emp=op["codigo_emp"]
                )
                db.add(nuevo_op)
                print(f"Operador agregado: {op['nombre']}")

        # 3. Poblar Ventanillas / Módulos
        ventanillas_data = [
            {"numero_modulo": 1, "estado_fisico": "ACTIVO"},
            {"numero_modulo": 2, "estado_fisico": "ACTIVO"},
            {"numero_modulo": 3, "estado_fisico": "ACTIVO"},
            {"numero_modulo": 4, "estado_fisico": "ACTIVO"}
        ]
        
        for vent in ventanillas_data:
            exists = db.query(models.Ventanilla).filter(models.Ventanilla.numero_modulo == vent["numero_modulo"]).first()
            if not exists:
                nueva_vent = models.Ventanilla(
                    numero_modulo=vent["numero_modulo"],
                    estado_fisico=vent["estado_fisico"]
                )
                db.add(nueva_vent)
                print(f"Ventanilla agregada: Módulo {vent['numero_modulo']}")
                
        db.commit()
        print("Base de datos inicializada exitosamente.")
        
    except Exception as e:
        db.rollback()
        print(f"Error al inicializar la base de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
