"""One-time migration script to add multi-user support to an existing macros.db.

Run: python migrate.py [username] [password]
If no args provided, creates a default user 'admin' with password 'admin'.
"""

import asyncio
import sys
import aiosqlite
import bcrypt
from db import DB_PATH


async def migrate():
    username = sys.argv[1] if len(sys.argv) > 1 else "admin"
    password = sys.argv[2] if len(sys.argv) > 2 else "admin"

    async with aiosqlite.connect(DB_PATH) as db:
        # Check if migration already ran
        cursor = await db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        has_users = await cursor.fetchone()

        if has_users:
            print("users table already exists — checking if data needs migration...")
        else:
            # Create new tables
            await db.execute("""
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    password_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                CREATE TABLE sessions (
                    token TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id),
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            await db.execute("""
                CREATE TABLE user_settings (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id),
                    calories_target REAL NOT NULL DEFAULT 2000,
                    protein_target REAL NOT NULL DEFAULT 150,
                    carbs_target REAL NOT NULL DEFAULT 250,
                    fat_target REAL NOT NULL DEFAULT 65
                )
            """)
            print("Created users, sessions, user_settings tables.")

        # Create default user if not exists
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        )
        user_row = await cursor.fetchone()

        if user_row:
            user_id = user_row[0]
            print(f"User '{username}' already exists (id={user_id}).")
        else:
            pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            cursor = await db.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, pw_hash),
            )
            user_id = cursor.lastrowid
            await db.execute(
                "INSERT INTO user_settings (user_id) VALUES (?)", (user_id,)
            )
            print(f"Created user '{username}' (id={user_id}).")

        # Add user_id column to meals if missing
        cursor = await db.execute("PRAGMA table_info(meals)")
        cols = [row[1] for row in await cursor.fetchall()]
        if "user_id" not in cols:
            await db.execute("ALTER TABLE meals ADD COLUMN user_id INTEGER REFERENCES users(id)")
            print("Added user_id column to meals.")

        # Assign orphaned meals to default user
        cursor = await db.execute(
            "UPDATE meals SET user_id = ? WHERE user_id IS NULL", (user_id,)
        )
        if cursor.rowcount > 0:
            print(f"Assigned {cursor.rowcount} existing meals to user '{username}'.")

        # Recreate saved_meals with user_id and UNIQUE(user_id, name)
        cursor = await db.execute("PRAGMA table_info(saved_meals)")
        cols = [row[1] for row in await cursor.fetchall()]
        if "user_id" not in cols:
            await db.execute("""
                CREATE TABLE saved_meals_new (
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
            await db.execute(f"""
                INSERT INTO saved_meals_new (id, name, calories_per_100g, protein_per_100g,
                    carbs_per_100g, fat_per_100g, default_serving_g, user_id, created_at)
                SELECT id, name, calories_per_100g, protein_per_100g,
                    carbs_per_100g, fat_per_100g, default_serving_g, {user_id}, created_at
                FROM saved_meals
            """)
            await db.execute("DROP TABLE saved_meals")
            await db.execute("ALTER TABLE saved_meals_new RENAME TO saved_meals")
            print("Recreated saved_meals with user_id column.")

        # Ensure indexes exist
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_meals_user_date ON meals(user_id, date)"
        )
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_saved_meals_user ON saved_meals(user_id)"
        )

        await db.commit()
        print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
