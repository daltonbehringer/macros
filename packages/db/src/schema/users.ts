import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  activityLevelEnum,
  sexEnum,
  unitSystemEnum,
} from "./enums";

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    stytchUserId: text("stytch_user_id").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_stytch_user_id_idx").on(t.stytchUserId),
    uniqueIndex("users_email_idx").on(t.email),
  ],
);

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  age: integer("age"),
  sex: sexEnum("sex"),
  activityLevel: activityLevelEnum("activity_level"),
  dailyCalorieTarget: real("daily_calorie_target"),
  dailyProteinG: real("daily_protein_g"),
  dailyCarbsG: real("daily_carbs_g"),
  dailyFatG: real("daily_fat_g"),
  unitSystem: unitSystemEnum("unit_system").notNull().default("imperial"),
  timezone: text("timezone").notNull().default("UTC"),
  // Reserved for future flags / per-user prefs that don't earn a column yet.
  preferences: jsonb("preferences").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
