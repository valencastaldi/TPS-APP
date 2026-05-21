"""Auth simple por API key para la app móvil de los pileteros."""
from fastapi import Depends, HTTPException, Header, status
from sqlmodel import Session, select
from app.db import get_session
from app.models import Piletero


def require_piletero(
    x_piletero_key: str = Header(..., alias="X-Piletero-Key"),
    session: Session = Depends(get_session),
) -> Piletero:
    """Valida el header X-Piletero-Key y devuelve el Piletero correspondiente.
    El piletero debe estar activo."""
    if not x_piletero_key:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "X-Piletero-Key faltante")

    piletero = session.exec(
        select(Piletero).where(Piletero.api_key == x_piletero_key)
    ).first()

    if not piletero:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "API key inválida")
    if not piletero.is_active:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Piletero desactivado")

    return piletero
