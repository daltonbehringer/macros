from contextlib import asynccontextmanager
from datetime import date

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from db import init_db, get_db
from models import (
    LogRequest, FoodEntry, MealRecord, DayResponse,
    SaveMealRequest, SavedMeal, ClarificationResult,
    RegisterRequest, LoginRequest, UserSettings, SaveMealDirectRequest,
)
from claude_client import parse_food
from auth import (
    hash_password, verify_password, create_session, get_current_user,
)

load_dotenv()

MEALS_COLS = "id, date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_size_g, notes, created_at"
SAVED_COLS = "id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


# --- Auth Endpoints ---


@app.post("/auth/register")
async def register(req: RegisterRequest):
    if len(req.username.strip()) < 1 or len(req.password) < 4:
        raise HTTPException(status_code=400, detail="Username required, password must be 4+ chars")

    db = await get_db()
    try:
        # Check if username taken
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ?", (req.username.strip(),)
        )
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username already taken")

        pw_hash = hash_password(req.password)
        cursor = await db.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (req.username.strip(), pw_hash),
        )
        user_id = cursor.lastrowid
        await db.execute(
            "INSERT INTO user_settings (user_id) VALUES (?)", (user_id,)
        )
        token = await create_session(db, user_id)

        response = JSONResponse({"id": user_id, "username": req.username.strip()})
        response.set_cookie(
            key="session", value=token,
            httponly=True, samesite="lax", max_age=30 * 24 * 3600,
        )
        return response
    finally:
        await db.close()


@app.post("/auth/login")
async def login(req: LoginRequest):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, username, password_hash FROM users WHERE username = ?",
            (req.username.strip(),),
        )
        row = await cursor.fetchone()
        if not row or not verify_password(req.password, row[2]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = await create_session(db, row[0])

        response = JSONResponse({"id": row[0], "username": row[1]})
        response.set_cookie(
            key="session", value=token,
            httponly=True, samesite="lax", max_age=30 * 24 * 3600,
        )
        return response
    finally:
        await db.close()


@app.post("/auth/logout")
async def logout(request: Request):
    token = request.cookies.get("session")
    if token:
        db = await get_db()
        try:
            await db.execute("DELETE FROM sessions WHERE token = ?", (token,))
            await db.commit()
        finally:
            await db.close()
    response = JSONResponse({"ok": True})
    response.delete_cookie("session")
    return response


@app.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT calories_target, protein_target, carbs_target, fat_target FROM user_settings WHERE user_id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()
        settings = UserSettings(
            calories_target=row[0], protein_target=row[1],
            carbs_target=row[2], fat_target=row[3],
        ) if row else UserSettings(
            calories_target=2000, protein_target=150,
            carbs_target=250, fat_target=65,
        )
        return {"id": user["id"], "username": user["username"], "settings": settings.model_dump()}
    finally:
        await db.close()


# --- Settings ---


@app.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT calories_target, protein_target, carbs_target, fat_target FROM user_settings WHERE user_id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()
        if not row:
            return UserSettings(calories_target=2000, protein_target=150, carbs_target=250, fat_target=65)
        return UserSettings(
            calories_target=row[0], protein_target=row[1],
            carbs_target=row[2], fat_target=row[3],
        )
    finally:
        await db.close()


@app.put("/settings")
async def update_settings(req: UserSettings, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        await db.execute(
            """INSERT INTO user_settings (user_id, calories_target, protein_target, carbs_target, fat_target)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id) DO UPDATE SET
               calories_target=excluded.calories_target, protein_target=excluded.protein_target,
               carbs_target=excluded.carbs_target, fat_target=excluded.fat_target""",
            (user["id"], req.calories_target, req.protein_target, req.carbs_target, req.fat_target),
        )
        await db.commit()
        return req
    finally:
        await db.close()


# --- Food Logging ---


async def _get_user_saved_meals(db, user_id: int) -> list[dict]:
    db.row_factory = None
    cursor = await db.execute(
        "SELECT name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g FROM saved_meals WHERE user_id = ?",
        (user_id,),
    )
    rows = await cursor.fetchall()
    return [
        {
            "name": r[0], "calories_per_100g": r[1], "protein_per_100g": r[2],
            "carbs_per_100g": r[3], "fat_per_100g": r[4], "default_serving_g": r[5],
        }
        for r in rows
    ]


@app.post("/log")
async def log_food(req: LogRequest, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        saved_meals = await _get_user_saved_meals(db, user["id"])

        try:
            result = await parse_food(req.text, saved_meals)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if isinstance(result, ClarificationResult):
            return {"status": "clarify", "message": result.message}

        entry = FoodEntry(
            food_name=result.food_name, calories=result.calories,
            protein_g=result.protein_g, carbs_g=result.carbs_g, fat_g=result.fat_g,
            serving_size_g=result.serving_size_g, notes=result.notes,
        )
        today = date.today().isoformat()
        cursor = await db.execute(
            """INSERT INTO meals (date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_size_g, notes, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (today, req.meal_type, entry.food_name, entry.calories, entry.protein_g,
             entry.carbs_g, entry.fat_g, entry.serving_size_g, entry.notes, user["id"]),
        )
        await db.commit()
        meal_id = cursor.lastrowid

        cursor = await db.execute(f"SELECT {MEALS_COLS} FROM meals WHERE id = ?", (meal_id,))
        row = await cursor.fetchone()
        return _row_to_meal(row)
    finally:
        await db.close()


@app.get("/day/{day_date}")
async def get_day(day_date: str, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT {MEALS_COLS} FROM meals WHERE date = ? AND user_id = ? ORDER BY created_at",
            (day_date, user["id"]),
        )
        rows = await cursor.fetchall()
        entries = [_row_to_meal(r) for r in rows]
        totals = {
            "calories": round(sum(e.calories for e in entries), 1),
            "protein_g": round(sum(e.protein_g for e in entries), 1),
            "carbs_g": round(sum(e.carbs_g for e in entries), 1),
            "fat_g": round(sum(e.fat_g for e in entries), 1),
        }

        # Include user's targets
        cursor = await db.execute(
            "SELECT calories_target, protein_target, carbs_target, fat_target FROM user_settings WHERE user_id = ?",
            (user["id"],),
        )
        row = await cursor.fetchone()
        targets = UserSettings(
            calories_target=row[0], protein_target=row[1],
            carbs_target=row[2], fat_target=row[3],
        ) if row else None

        return DayResponse(date=day_date, entries=entries, totals=totals, targets=targets)
    finally:
        await db.close()


@app.delete("/entry/{entry_id}")
async def delete_entry(entry_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM meals WHERE id = ? AND user_id = ?", (entry_id, user["id"])
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"ok": True}
    finally:
        await db.close()


@app.post("/meals/save")
async def save_meal(req: SaveMealRequest, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT {MEALS_COLS} FROM meals WHERE id = ? AND user_id = ?", (req.entry_id, user["id"])
        )
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Meal entry not found")

        meal = _row_to_meal(row)
        serving = meal.serving_size_g if meal.serving_size_g and meal.serving_size_g > 0 else 100.0
        factor = 100.0 / serving

        cursor = await db.execute(
            """INSERT INTO saved_meals (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (req.name, round(meal.calories * factor, 1), round(meal.protein_g * factor, 1),
             round(meal.carbs_g * factor, 1), round(meal.fat_g * factor, 1), serving, user["id"]),
        )
        await db.commit()

        return SavedMeal(
            id=cursor.lastrowid, name=req.name,
            calories_per_100g=round(meal.calories * factor, 1),
            protein_per_100g=round(meal.protein_g * factor, 1),
            carbs_per_100g=round(meal.carbs_g * factor, 1),
            fat_per_100g=round(meal.fat_g * factor, 1),
            default_serving_g=serving,
        )
    finally:
        await db.close()


@app.post("/meals/save-direct")
async def save_meal_direct(req: SaveMealDirectRequest, user: dict = Depends(get_current_user)):
    """Parse food via LLM and save directly as a template — does NOT log for the day."""
    db = await get_db()
    try:
        saved_meals = await _get_user_saved_meals(db, user["id"])

        try:
            result = await parse_food(req.text, saved_meals)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        if isinstance(result, ClarificationResult):
            return {"status": "clarify", "message": result.message}

        serving = req.serving_size_g or result.serving_size_g or 100.0
        factor = 100.0 / serving

        cursor = await db.execute(
            """INSERT INTO saved_meals (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g, user_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (req.name, round(result.calories * factor, 1), round(result.protein_g * factor, 1),
             round(result.carbs_g * factor, 1), round(result.fat_g * factor, 1), serving, user["id"]),
        )
        await db.commit()

        return SavedMeal(
            id=cursor.lastrowid, name=req.name,
            calories_per_100g=round(result.calories * factor, 1),
            protein_per_100g=round(result.protein_g * factor, 1),
            carbs_per_100g=round(result.carbs_g * factor, 1),
            fat_per_100g=round(result.fat_g * factor, 1),
            default_serving_g=serving,
        )
    finally:
        await db.close()


@app.get("/meals/saved")
async def list_saved_meals(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            f"SELECT {SAVED_COLS} FROM saved_meals WHERE user_id = ? ORDER BY name", (user["id"],)
        )
        rows = await cursor.fetchall()
        return [
            SavedMeal(
                id=r[0], name=r[1], calories_per_100g=r[2], protein_per_100g=r[3],
                carbs_per_100g=r[4], fat_per_100g=r[5], default_serving_g=r[6],
            )
            for r in rows
        ]
    finally:
        await db.close()


@app.delete("/meals/saved/{meal_id}")
async def delete_saved_meal(meal_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM saved_meals WHERE id = ? AND user_id = ?", (meal_id, user["id"])
        )
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Saved meal not found")
        return {"ok": True}
    finally:
        await db.close()


def _row_to_meal(row) -> MealRecord:
    return MealRecord(
        id=row[0], date=row[1], meal_type=row[2], food_name=row[3],
        calories=row[4], protein_g=row[5], carbs_g=row[6], fat_g=row[7],
        serving_size_g=row[8], notes=row[9], created_at=row[10],
    )
