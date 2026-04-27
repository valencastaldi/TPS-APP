"""Router de autenticación — /auth/login y /auth/me."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.auth import authenticate_user, create_access_token, require_jwt

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """Obtener un JWT. Body: username + password (form-data)."""
    if not authenticate_user(form_data.username, form_data.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token({"sub": form_data.username})
    return TokenResponse(access_token=token, username=form_data.username)


@router.get("/me")
async def me(user: dict = Depends(require_jwt)):
    """Retorna info del usuario autenticado (útil para validar sesión)."""
    return {"username": user["username"]}
