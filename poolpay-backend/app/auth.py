"""Autenticación: API Key para machine-to-machine + JWT para el panel web."""
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# ── Configuración ────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "cambia-esta-clave-secreta-por-una-generada")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 horas

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")  # debe cambiarse en .env

# API Key (acceso máquina a máquina, ej. webhooks propios)
_API_KEY = os.getenv("API_KEY", "")
_API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# JWT (acceso desde el panel web)
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Helpers ──────────────────────────────────────────────────────────────────
def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def authenticate_user(username: str, password: str) -> bool:
    """Valida credenciales contra las variables de entorno."""
    if username != ADMIN_USERNAME:
        return False
    # Si la contraseña en .env está hasheada (empieza con $2b$) la verificamos;
    # si no, comparación directa (para desarrollo).
    if ADMIN_PASSWORD.startswith("$2b$"):
        return verify_password(password, ADMIN_PASSWORD)
    return password == ADMIN_PASSWORD


# ── Dependencias FastAPI ──────────────────────────────────────────────────────
def require_api_key(key: str = Security(_API_KEY_HEADER)) -> None:
    """Valida X-API-Key. Si API_KEY está vacía, deshabilitada (dev)."""
    if not _API_KEY:
        return
    if key != _API_KEY:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API Key inválida")


async def require_jwt(token: str = Depends(_oauth2_scheme)) -> dict:
    """Valida el JWT enviado en el header Authorization: Bearer <token>."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesión inválida o expirada",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        return {"username": username}
    except JWTError:
        raise credentials_exception


async def require_auth(
    api_key: str = Security(_API_KEY_HEADER),
    token: str = Depends(_oauth2_scheme),
) -> None:
    """Acepta CUALQUIERA de los dos métodos: API Key o JWT.

    Usado en los routers: máquinas usan API Key, el panel web usa JWT.
    """
    # 1. API Key (máquina a máquina)
    if _API_KEY and api_key == _API_KEY:
        return
    # 2. JWT (panel web)
    if token:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("sub"):
                return
        except JWTError:
            pass
    # 3. Sin credenciales en dev
    if not _API_KEY and SECRET_KEY == "cambia-esta-clave-secreta-por-una-generada":
        return  # modo dev sin config
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Autenticación requerida",
        headers={"WWW-Authenticate": "Bearer"},
    )
