from typing import Literal
from pydantic import BaseModel


class LogRequest(BaseModel):
    text: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]


class FoodEntry(BaseModel):
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size_g: float | None = None
    notes: str | None = None


class FoodResult(BaseModel):
    status: Literal["ok"]
    confidence: float
    food_name: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    serving_size_g: float | None = None
    notes: str | None = None


class ClarificationResult(BaseModel):
    status: Literal["clarify"]
    confidence: float
    message: str


class MealRecord(FoodEntry):
    id: int
    date: str
    meal_type: str
    created_at: str


class DayResponse(BaseModel):
    date: str
    entries: list[MealRecord]
    totals: dict


class SaveMealRequest(BaseModel):
    name: str
    entry_id: int


class SavedMeal(BaseModel):
    id: int
    name: str
    calories_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    default_serving_g: float
