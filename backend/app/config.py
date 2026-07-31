import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
load_dotenv(ENV_FILE, override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_classroom.db")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

display_key = GEMINI_API_KEY[:8] if GEMINI_API_KEY else "<missing>"
print(f"Loaded API Key: {display_key}...")

if not GEMINI_API_KEY or "REPLACE_WITH_YOUR_ACTUAL" in GEMINI_API_KEY:
    print("WARNING: GEMINI_API_KEY is missing or still set to the placeholder value.")