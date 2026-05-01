import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { recipeCreatedByEnum } from "./enums";
import { users } from "./users";

export type RecipeIngredient = { name: string; quantity: string };

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    ingredients: jsonb("ingredients")
      .$type<RecipeIngredient[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    caloriesPerServing: real("calories_per_serving").notNull(),
    proteinG: real("protein_g").notNull(),
    carbsG: real("carbs_g").notNull(),
    fatG: real("fat_g").notNull(),
    servings: real("servings").notNull().default(1),
    createdBy: recipeCreatedByEnum("created_by").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("recipes_user_idx").on(t.userId)],
);
