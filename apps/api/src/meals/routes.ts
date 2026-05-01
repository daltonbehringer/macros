import { forUser, schema } from "@macros/db";
import { CreateMealInput } from "@macros/shared";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { getDb } from "../db";

const RangeQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const IdParam = z.object({ id: z.string().uuid() });

export const mealRoutes: FastifyPluginAsync = async (app) => {
  app.post("/meals", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateMealInput.safeParse(req.body);
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
        .insert(schema.meals)
        .values({
          userId: user.id,
          description: parsed.data.description,
          calories: parsed.data.calories,
          proteinG: parsed.data.proteinG,
          carbsG: parsed.data.carbsG,
          fatG: parsed.data.fatG,
          consumedAt: parsed.data.consumedAt
            ? new Date(parsed.data.consumedAt)
            : new Date(),
          source: "manual",
        })
        .returning();
      return inserted[0];
    });
  });

  app.get("/meals", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = RangeQuery.safeParse(req.query);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_range" });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    return forUser(db, user.id, async (tx) => {
      return tx
        .select()
        .from(schema.meals)
        .where(
          and(
            gte(schema.meals.consumedAt, new Date(parsed.data.from)),
            lt(schema.meals.consumedAt, new Date(parsed.data.to)),
          ),
        )
        .orderBy(desc(schema.meals.consumedAt));
    });
  });

  app.delete("/meals/:id", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = IdParam.safeParse(req.params);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_id" });
      return;
    }
    const user = req.user!;
    const { db } = getDb();
    const deleted = await forUser(db, user.id, async (tx) => {
      return tx
        .delete(schema.meals)
        .where(eq(schema.meals.id, parsed.data.id))
        .returning({ id: schema.meals.id });
    });
    if (deleted.length === 0) {
      reply.code(404).send({ error: "not_found" });
      return;
    }
    return { ok: true };
  });
};
