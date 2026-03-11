import aiosqlite
from pathlib import Path

DB_PATH = Path(__file__).parent / "macros.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                calories_target REAL NOT NULL DEFAULT 2000,
                protein_target REAL NOT NULL DEFAULT 150,
                carbs_target REAL NOT NULL DEFAULT 250,
                fat_target REAL NOT NULL DEFAULT 65
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                meal_type TEXT NOT NULL,
                food_name TEXT NOT NULL,
                calories REAL NOT NULL,
                protein_g REAL NOT NULL,
                carbs_g REAL NOT NULL,
                fat_g REAL NOT NULL,
                serving_size_g REAL,
                notes TEXT,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date)"
        )
        await db.execute("""
            CREATE TABLE IF NOT EXISTS saved_meals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                calories_per_100g REAL NOT NULL,
                protein_per_100g REAL NOT NULL,
                carbs_per_100g REAL NOT NULL,
                fat_per_100g REAL NOT NULL,
                default_serving_g REAL NOT NULL,
                user_id INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(user_id, name)
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_meals_user ON saved_meals(user_id)"
        )
        await db.commit()


async def get_db():
    return await aiosqlite.connect(DB_PATH)
