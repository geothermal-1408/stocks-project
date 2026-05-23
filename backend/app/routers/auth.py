"""Auth API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
import bcrypt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_db, create_access_token, get_current_user

from app.models.user import User

router = APIRouter()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "user"  # "user" or "admin" — demo mode allows self-select


@router.post("/auth/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate and receive JWT token."""
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(
        form_data.password[:72], user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "role": user.role,
    }


@router.post("/auth/register")
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Register a new user (demo mode — role selectable)."""
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == body.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    # Validate role
    if body.role not in ("user", "admin"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'user' or 'admin'",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password[:72]),
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(
        data={"sub": user.email, "role": user.role}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "email": user.email,
        "role": user.role,
    }


@router.get("/auth/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
):
    """Return current user info from JWT."""
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return current_user
