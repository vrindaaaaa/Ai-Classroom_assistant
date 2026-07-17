import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import Token, UserLogin, UserRegister
from app.utils import create_access_token, hash_password, verify_password

from app.dependencies import get_current_user

logger = logging.getLogger("ai_classroom")
router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
@router.post("/signup", response_model=Token)
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == str(user.email)).first():
        logger.warning("Signup failed because email already exists: %s", user.email)
        raise HTTPException(status_code=409, detail="Email already registered")
    new_user = User(
        name=user.name,
        email=str(user.email),
        password_hash=hash_password(user.password),
        role=user.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    token = create_access_token({"sub": str(new_user.id), "role": new_user.role})
    logger.info("Registered user %s", new_user.email)
    return Token(access_token=token, role=new_user.role, token_type="bearer")

@router.post("/login", response_model=Token)
def login(user: UserLogin, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == str(user.email)).first()
    if not existing_user or not verify_password(user.password, existing_user.password_hash):
        logger.warning("Login failed for %s", user.email)
        raise HTTPException(status_code=401, detail="Invalid Email or Password")
    token = create_access_token({"sub": str(existing_user.id), "role": existing_user.role})
    logger.info("Logged in user %s", existing_user.email)
    return Token(access_token=token, role=existing_user.role, token_type="bearer")

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role,
        "created_at": current_user.created_at,
    }