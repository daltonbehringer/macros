import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, forUser, schema, type DbHandle } from "../index";
import { resetTestDatabase, testDatabaseUrl } from "./setup";

const { users, userProfiles, meals, workouts, recipes, chatMessages } = schema;

let handle: DbHandle;
let userA: string;
let userB: string;

beforeAll(async () => {
  await resetTestDatabase();

  // Run migrations against the freshly-created test DB.
  const migrationSql = postgres(testDatabaseUrl(), { max: 1 });
  const migrationDb = drizzle(migrationSql);
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  await migrationSql.end();

  handle = createClient(testDatabaseUrl(), { max: 4 });
});

afterAll(async () => {
  await handle.close();
});

beforeEach(async () => {
  // Truncate user-scoped tables. CASCADE clears FK-dependent rows (meals,
  // workouts, recipes, chat_messages, user_profiles all reference users).
  await handle.db.execute(
    sql`TRUNCATE TABLE users, user_profiles, meals, workouts, recipes, chat_messages RESTART IDENTITY CASCADE`,
  );

  const [a] = await handle.db
    .insert(users)
    .values({ stytchUserId: "stytch-a", email: "a@example.com" })
    .returning({ id: users.id });
  const [b] = await handle.db
    .insert(users)
    .values({ stytchUserId: "stytch-b", email: "b@example.com" })
    .returning({ id: users.id });
  if (!a || !b) throw new Error("failed to seed users");
  userA = a.id;
  userB = b.id;
});

describe("forUser() — input validation", () => {
  it("rejects empty userId", async () => {
    await expect(
      forUser(handle.db, "", async () => null),
    ).rejects.toThrow(/invalid userId/);
  });

  it("rejects non-uuid userId", async () => {
    await expect(
      forUser(handle.db, "not-a-uuid", async () => null),
    ).rejects.toThrow(/invalid userId/);
  });

  it("sets the GUC inside the transaction", async () => {
    const seen = await forUser(handle.db, userA, async (tx) => {
      const rows = await tx.execute<{ user_id: string }>(
        sql`select current_setting('app.current_user_id', true) as user_id`,
      );
      return rows[0]?.user_id;
    });
    expect(seen).toBe(userA);
  });
});

describe("RLS isolation — meals", () => {
  it("user A cannot SELECT user B's meals", async () => {
    await forUser(handle.db, userB, async (tx) => {
      await tx.insert(meals).values({
        userId: userB,
        description: "B's lunch",
        calories: 500,
        proteinG: 30,
        carbsG: 50,
        fatG: 20,
      });
    });

    const fromA = await forUser(handle.db, userA, async (tx) => {
      return tx.select().from(meals);
    });
    expect(fromA).toHaveLength(0);

    const fromB = await forUser(handle.db, userB, async (tx) => {
      return tx.select().from(meals);
    });
    expect(fromB).toHaveLength(1);
  });

  it("user A cannot UPDATE user B's meal", async () => {
    const [bMeal] = await forUser(handle.db, userB, async (tx) => {
      return tx
        .insert(meals)
        .values({
          userId: userB,
          description: "B's dinner",
          calories: 700,
          proteinG: 40,
          carbsG: 70,
          fatG: 25,
        })
        .returning({ id: meals.id });
    });
    if (!bMeal) throw new Error("setup failed");

    const updated = await forUser(handle.db, userA, async (tx) => {
      return tx
        .update(meals)
        .set({ description: "hacked by A" })
        .where(sql`id = ${bMeal.id}`)
        .returning({ id: meals.id });
    });
    expect(updated).toHaveLength(0);

    // Confirm B's row is intact.
    const [stillB] = await forUser(handle.db, userB, async (tx) => {
      return tx.select().from(meals);
    });
    expect(stillB?.description).toBe("B's dinner");
  });

  it("user A cannot INSERT a meal for user B (WITH CHECK fails)", async () => {
    await expect(
      forUser(handle.db, userA, async (tx) => {
        return tx.insert(meals).values({
          userId: userB, // wrong owner — WITH CHECK should reject
          description: "spoofed by A",
          calories: 100,
          proteinG: 1,
          carbsG: 1,
          fatG: 1,
        });
      }),
    ).rejects.toThrow(/row-level security/i);

    // No row landed.
    const fromB = await forUser(handle.db, userB, async (tx) => {
      return tx.select().from(meals);
    });
    expect(fromB).toHaveLength(0);
  });

  it("user A cannot DELETE user B's meal", async () => {
    const [bMeal] = await forUser(handle.db, userB, async (tx) => {
      return tx
        .insert(meals)
        .values({
          userId: userB,
          description: "B's snack",
          calories: 200,
          proteinG: 5,
          carbsG: 30,
          fatG: 5,
        })
        .returning({ id: meals.id });
    });
    if (!bMeal) throw new Error("setup failed");

    const deleted = await forUser(handle.db, userA, async (tx) => {
      return tx
        .delete(meals)
        .where(sql`id = ${bMeal.id}`)
        .returning({ id: meals.id });
    });
    expect(deleted).toHaveLength(0);

    const [stillB] = await forUser(handle.db, userB, async (tx) => {
      return tx.select().from(meals);
    });
    expect(stillB?.id).toBe(bMeal.id);
  });
});

describe("RLS isolation — every user-scoped table", () => {
  it("isolates user_profiles", async () => {
    await forUser(handle.db, userB, async (tx) => {
      await tx.insert(userProfiles).values({ userId: userB, age: 30 });
    });
    const fromA = await forUser(handle.db, userA, async (tx) => {
      return tx.select().from(userProfiles);
    });
    expect(fromA).toHaveLength(0);
  });

  it("isolates workouts", async () => {
    await forUser(handle.db, userB, async (tx) => {
      await tx.insert(workouts).values({
        userId: userB,
        description: "B's run",
        caloriesBurned: 400,
      });
    });
    const fromA = await forUser(handle.db, userA, async (tx) => {
      return tx.select().from(workouts);
    });
    expect(fromA).toHaveLength(0);
  });

  it("isolates recipes", async () => {
    await forUser(handle.db, userB, async (tx) => {
      await tx.insert(recipes).values({
        userId: userB,
        name: "B's smoothie",
        ingredients: [{ name: "banana", quantity: "1" }],
        caloriesPerServing: 200,
        proteinG: 5,
        carbsG: 40,
        fatG: 2,
      });
    });
    const fromA = await forUser(handle.db, userA, async (tx) => {
      return tx.select().from(recipes);
    });
    expect(fromA).toHaveLength(0);
  });

  it("isolates chat_messages", async () => {
    await forUser(handle.db, userB, async (tx) => {
      await tx.insert(chatMessages).values({
        userId: userB,
        role: "user",
        content: "B's secret message",
      });
    });
    const fromA = await forUser(handle.db, userA, async (tx) => {
      return tx.select().from(chatMessages);
    });
    expect(fromA).toHaveLength(0);
  });
});

describe("RLS — no GUC means no rows", () => {
  it("app_user role with no GUC sees nothing on RLS-protected tables", async () => {
    await forUser(handle.db, userA, async (tx) => {
      await tx.insert(meals).values({
        userId: userA,
        description: "A's breakfast",
        calories: 300,
        proteinG: 20,
        carbsG: 30,
        fatG: 10,
      });
    });

    // Simulate an application code path that runs as app_user but forgets
    // to set the GUC. RLS should filter all rows — failing closed.
    const leaked = await handle.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE app_user`);
      return tx.select().from(meals);
    });
    expect(leaked).toHaveLength(0);
  });
});
