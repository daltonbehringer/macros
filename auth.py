import secrets
import bcrypt
from fastapi import Request, HTTPException

from db import get_db

SESSION_MAX_AGE_DAYS = 30


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


async def create_session(db, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    await db.execute(
        "INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id)
    )
    await db.commit()
    return token


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT u.id, u.username FROM sessions s
               JOIN users u ON s.user_id = u.id
               WHERE s.token = ?
               AND s.created_at > datetime('now', ?)""",
            (token, f"-{SESSION_MAX_AGE_DAYS} days"),
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Session expired")
        return {"id": row[0], "username": row[1]}
    finally:
        await db.close()
