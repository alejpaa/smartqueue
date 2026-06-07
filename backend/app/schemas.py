from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# ==================== USUARIO ====================
class UsuarioBase(BaseModel):
    nombre: str
    dni: str = Field(..., description="DNI del usuario")
    celular: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    pass

class UsuarioResponse(UsuarioBase):
    id_usuario: int

    class Config:
        from_attributes = True

# ==================== SERVICIO ====================
class ServicioBase(BaseModel):
    nombre_servicio: str
    descripcion: Optional[str] = None

class ServicioResponse(ServicioBase):
    id_servicio: int

    class Config:
        from_attributes = True

# ==================== VENTANILLA ====================
class VentanillaBase(BaseModel):
    numero_modulo: int
    estado_fisico: str = "ACTIVO"

class VentanillaResponse(VentanillaBase):
    id_ventanilla: int

    class Config:
        from_attributes = True

# ==================== OPERADOR ====================
class OperadorBase(BaseModel):
    nombre: str
    codigo_emp: str

class OperadorResponse(OperadorBase):
    id_operador: int

    class Config:
        from_attributes = True

# ==================== ASIGNACION MODULO ====================
class AsignacionCreate(BaseModel):
    id_operador: int
    id_ventanilla: int

class AsignacionResponse(BaseModel):
    id_asignacion: int
    id_operador: int
    id_ventanilla: int
    fecha_sesion: datetime
    activo: bool
    operador: OperadorResponse
    ventanilla: VentanillaResponse

    class Config:
        from_attributes = True

# ==================== TICKET ====================
class TicketCreate(BaseModel):
    nombre: str
    dni: str
    celular: Optional[str] = None
    id_servicio: int

class TicketResponse(BaseModel):
    id_ticket: int
    id_usuario: int
    id_servicio: int
    id_ventanilla: Optional[int] = None
    codigo_ticket: str
    estado_turno: str
    fecha_creacion: datetime
    hora_inicio_atencion: Optional[datetime] = None
    hora_fin_atencion: Optional[datetime] = None
    tiempo_espera_estimado: int
    usuario: UsuarioResponse
    servicio: ServicioResponse
    ventanilla: Optional[VentanillaResponse] = None

    class Config:
        from_attributes = True

# ==================== ESTADÍSTICAS SQA ====================
class SqaMetrics(BaseModel):
    tiempo_espera_promedio: float = 0.0  # en minutos
    tasa_atencion: float = 0.0           # tickets atendidos por hora
    tasa_abandono: float = 0.0           # % de cancelados o no presentados
    total_tickets: int = 0
    total_atendidos: int = 0
    total_espera: int = 0
    total_llamados: int = 0
    total_no_presento: int = 0
    uptime_sistema: float = 100.0        # % simulado
    latencias: List[float] = []          # Tiempos de respuesta de transacciones en ms

# ==================== CONFIGURACIÓN DE CAOS ====================
class ChaosConfig(BaseModel):
    latency_ms: int = Field(0, description="Milisegundos de latencia artificial a inyectar")
    db_failure_rate: float = Field(0.0, description="Tasa de fallos artificiales de base de datos (0.0 a 1.0)")
    server_down: bool = Field(False, description="Simular caida total del servidor backend (503)")

