from contextlib import asynccontextmanager
from datetime import date

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from db import init_db, get_db
from models import (
    LogRequest, FoodEntry, MealRecord, DayResponse,
    SaveMealRequest, SavedMeal, ClarificationResult,
)
from claude_client import parse_food

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return FileResponse("static/index.html")


@app.post("/log")
async def log_food(req: LogRequest):
    # Fetch saved meals for context
    db = await get_db()
    try:
        db.row_factory = None
        cursor = await db.execute("SELECT name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g FROM saved_meals")
        rows = await cursor.fetchall()
        saved_meals = [
            {
                "name": r[0], "calories_per_100g": r[1], "protein_per_100g": r[2],
                "carbs_per_100g": r[3], "fat_per_100g": r[4], "default_serving_g": r[5],
            }
            for r in rows
        ]

        # Parse food via Claude
        try:
            result = await parse_food(req.text, saved_meals)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # If the model needs clarification, return it (not an error)
        if isinstance(result, ClarificationResult):
            return {"status": "clarify", "message": result.message}

        # Store in DB
        entry = FoodEntry(
            food_name=result.food_name, calories=result.calories,
            protein_g=result.protein_g, carbs_g=result.carbs_g, fat_g=result.fat_g,
            serving_size_g=result.serving_size_g, notes=result.notes,
        )
        today = date.today().isoformat()
        cursor = await db.execute(
            """INSERT INTO meals (date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, serving_size_g, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (today, req.meal_type, entry.food_name, entry.calories, entry.protein_g,
             entry.carbs_g, entry.fat_g, entry.serving_size_g, entry.notes),
        )
        await db.commit()
        meal_id = cursor.lastrowid

        # Fetch the full record to return
        cursor = await db.execute("SELECT * FROM meals WHERE id = ?", (meal_id,))
        row = await cursor.fetchone()
        return _row_to_meal(row)
    finally:
        await db.close()


@app.get("/day/{day_date}")
async def get_day(day_date: str):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM meals WHERE date = ? ORDER BY created_at", (day_date,)
        )
        rows = await cursor.fetchall()
        entries = [_row_to_meal(r) for r in rows]
        totals = {
            "calories": round(sum(e.calories for e in entries), 1),
            "protein_g": round(sum(e.protein_g for e in entries), 1),
            "carbs_g": round(sum(e.carbs_g for e in entries), 1),
            "fat_g": round(sum(e.fat_g for e in entries), 1),
        }
        return DayResponse(date=day_date, entries=entries, totals=totals)
    finally:
        await db.close()


@app.delete("/entry/{entry_id}")
async def delete_entry(entry_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM meals WHERE id = ?", (entry_id,))
        await db.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        return {"ok": True}
    finally:
        await db.close()


@app.post("/meals/save")
async def save_meal(req: SaveMealRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM meals WHERE id = ?", (req.entry_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Meal entry not found")

        meal = _row_to_meal(row)
        serving = meal.serving_size_g if meal.serving_size_g and meal.serving_size_g > 0 else 100.0
        factor = 100.0 / serving

        cursor = await db.execute(
            """INSERT INTO saved_meals (name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, default_serving_g)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (req.name, round(meal.calories * factor, 1), round(meal.protein_g * factor, 1),
             round(meal.carbs_g * factor, 1), round(meal.fat_g * factor, 1), serving),
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


@app.get("/meals/saved")
async def list_saved_meals():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM saved_meals ORDER BY name")
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
async def delete_saved_meal(meal_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM saved_meals WHERE id = ?", (meal_id,))
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
