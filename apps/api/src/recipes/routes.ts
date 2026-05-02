import { forUser, schema } from "@macros/db";
import { CreateRecipeInput, UpdateRecipeInput } from "@macros/shared";
import { asc, eq, ilike } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { getDb } from "../db";

const ListQuery = z.object({ q: z.string().min(1).max(200).optional() });
const IdParam = z.object({ id: z.string().uuid() });
const LogRecipeBody = z.object({
  servings: z.number().positive(),
  consumedAt: z.string().datetime().optional(),
});

export const recipeRoutes: FastifyPluginAsync = async (app) => {
  app.post("/recipes", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateRecipeInput.safeParse(req.body);
    if (!parsed.success) {
      reply
        .code(400)
        .send({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    return forUser(db, user.id, async (tx) => {
      const inserted = await tx
        .insert(schema.recipes)
        .values({
          userId: user.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          ingredients: parsed.data.ingredients ?? [],
          caloriesPerServing: parsed.data.caloriesPerServing,
          proteinG: parsed.data.proteinG,
          carbsG: parsed.data.carbsG,
          fatG: parsed.data.fatG,
          servings: parsed.data.servings,
          createdBy: "user",
        })
        .returning();
      return inserted[0];
    });
  });

  app.get("/recipes", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_query" });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    return forUser(db, user.id, async (tx) => {
      const where = parsed.data.q
        ? ilike(schema.recipes.name, `%${parsed.data.q}%`)
        : undefined;
      return tx
        .select()
        .from(schema.recipes)
        .where(where)
        .orderBy(asc(schema.recipes.name));
    });
  });

  app.get("/recipes/:id", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = IdParam.safeParse(req.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_id" });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    const found = await forUser(db, user.id, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.recipes)
        .where(eq(schema.recipes.id, parsed.data.id))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!found) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return found;
  });

  app.put("/recipes/:id", { preHandler: requireAuth }, async (req, reply) => {
    const idParse = IdParam.safeParse(req.params);
    const bodyParse = UpdateRecipeInput.safeParse(req.body);
    if (!idParse.success || !bodyParse.success) {
      reply.code(400).send({ error: "invalid_request" });
      return;
    }
    const patch = Object.fromEntries(
      Object.entries(bodyParse.data).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(patch).length === 0) {
      reply.code(400).send({ error: "empty_patch" });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    const updated = await forUser(db, user.id, async (tx) => {
      const rows = await tx
        .update(schema.recipes)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(schema.recipes.id, idParse.data.id))
        .returning();
      return rows[0] ?? null;
    });
    if (!updated) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return updated;
  });

  app.delete(
    "/recipes/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_id" });
        return;
      }
      const user = req.user!;
      const { db } = getDb();
      const deleted = await forUser(db, user.id, async (tx) => {
        return tx
          .delete(schema.recipes)
          .where(eq(schema.recipes.id, parsed.data.id))
          .returning({ id: schema.recipes.id });
      });
      if (deleted.length === 0) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      return { ok: true };
    },
  );

  /** Log a meal from a saved recipe — multiplies per-serving macros by `servings`. */
  app.post(
    "/recipes/:id/log",
    { preHandler: requireAuth },
    async (req, reply) => {
      const idParse = IdParam.safeParse(req.params);
      const bodyParse = LogRecipeBody.safeParse(req.body);
      if (!idParse.success || !bodyParse.success) {
        reply.code(400).send({ error: "invalid_request" });
        return;
      }
      const user = req.user!;
      const { db } = getDb();
      try {
        return await forUser(db, user.id, async (tx) => {
          const rows = await tx
            .select()
            .from(schema.recipes)
            .where(eq(schema.recipes.id, idParse.data.id))
            .limit(1);
          const recipe = rows[0];
          if (!recipe) throw new Error("recipe_not_found");
          const factor = bodyParse.data.servings;
          const inserted = await tx
            .insert(schema.meals)
            .values({
              userId: user.id,
              description: `${recipe.name} (${factor} ${factor === 1 ? "serving" : "servings"})`,
              calories: round1(recipe.caloriesPerServing * factor),
              proteinG: round1(recipe.proteinG * factor),
              carbsG: round1(recipe.carbsG * factor),
              fatG: round1(recipe.fatG * factor),
              consumedAt: bodyParse.data.consumedAt
                ? new Date(bodyParse.data.consumedAt)
                : new Date(),
              source: "recipe",
              recipeId: recipe.id,
            })
            .returning();
          return inserted[0];
        });
      } catch (err) {
        if (err instanceof Error && err.message === "recipe_not_found") {
          reply.code(404).send({ error: "not_found" });
          return;
        }
        throw err;
      }
    },
  );
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
