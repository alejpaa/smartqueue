from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import relationship
from .database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    dni = Column(String, unique=True, index=True, nullable=False)
    celular = Column(String, nullable=True)

    # Relación M:N Nro 1: A través de Ticket
    tickets = relationship("Ticket", back_populates="usuario")

class Servicio(Base):
    __tablename__ = "servicios"

    id_servicio = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre_servicio = Column(String, nullable=False)
    descripcion = Column(String, nullable=True)

    # Relación M:N Nro 1: A través de Ticket
    tickets = relationship("Ticket", back_populates="servicio")

class Ventanilla(Base):
    __tablename__ = "ventanillas"

    id_ventanilla = Column(Integer, primary_key=True, index=True, autoincrement=True)
    numero_modulo = Column(Integer, unique=True, index=True, nullable=False)
    estado_fisico = Column(String, default="ACTIVO") # ACTIVO, MANTENIMIENTO, INACTIVO

    asignaciones = relationship("AsignacionModulo", back_populates="ventanilla")
    tickets = relationship("Ticket", back_populates="ventanilla")

class Operador(Base):
    __tablename__ = "operadores"

    id_operador = Column(Integer, primary_key=True, index=True, autoincrement=True)
    nombre = Column(String, nullable=False)
    codigo_emp = Column(String, unique=True, index=True, nullable=False)

    # Relación M:N Nro 2: A través de AsignacionModulo
    asignaciones = relationship("AsignacionModulo", back_populates="operador")

class Ticket(Base):
    __tablename__ = "tickets"

    id_ticket = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_usuario = Column(Integer, ForeignKey("usuarios.id_usuario"), nullable=False)
    id_servicio = Column(Integer, ForeignKey("servicios.id_servicio"), nullable=False)
    id_ventanilla = Column(Integer, ForeignKey("ventanillas.id_ventanilla"), nullable=True)
    
    codigo_ticket = Column(String, nullable=False)
    estado_turno = Column(String, default="ESPERA") # ESPERA, LLAMADO, ATENDIDO, CANCELADO, NO_PRESENTO
    fecha_creacion = Column(DateTime, default=func.now(), nullable=False)
    hora_inicio_atencion = Column(DateTime, nullable=True)
    hora_fin_atencion = Column(DateTime, nullable=True)
    tiempo_espera_estimado = Column(Integer, default=0) # en minutos

    # Relaciones
    usuario = relationship("Usuario", back_populates="tickets")
    servicio = relationship("Servicio", back_populates="tickets")
    ventanilla = relationship("Ventanilla", back_populates="tickets")

class AsignacionModulo(Base):
    __tablename__ = "asignacion_modulos"

    id_asignacion = Column(Integer, primary_key=True, index=True, autoincrement=True)
    id_operador = Column(Integer, ForeignKey("operadores.id_operador"), nullable=False)
    id_ventanilla = Column(Integer, ForeignKey("ventanillas.id_ventanilla"), nullable=False)
    fecha_sesion = Column(DateTime, default=func.now(), nullable=False)
    activo = Column(Boolean, default=True, nullable=False)

    # Relaciones
    operador = relationship("Operador", back_populates="asignaciones")
    ventanilla = relationship("Ventanilla", back_populates="asignaciones")
