"""One-shot migration: adds student_explanation TEXT column to documents table."""
from app.database import engine
from sqlalchemy import text, inspect

insp = inspect(engine)
cols = [c["name"] for c in insp.get_columns("documents")]
print("Existing columns:", cols)

if "student_explanation" not in cols:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE documents ADD COLUMN student_explanation TEXT DEFAULT ''"))
        conn.commit()
    print("SUCCESS: Column 'student_explanation' added.")
else:
    print("SKIP: Column 'student_explanation' already exists.")
