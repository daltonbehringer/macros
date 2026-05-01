import { pgEnum } from "drizzle-orm/pg-core";

export const sexEnum = pgEnum("sex", ["male", "female"]);

export const activityLevelEnum = pgEnum("activity_level", [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
]);

export const unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);

export const mealSourceEnum = pgEnum("meal_source", [
  "llm_parsed",
  "manual",
  "recipe",
]);

export const recipeCreatedByEnum = pgEnum("recipe_created_by", [
  "user",
  "llm",
]);

export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);
