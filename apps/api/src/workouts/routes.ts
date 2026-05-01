import { forUser, schema } from "@macros/db";
import { CreateWorkoutInput } from "@macros/shared";
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

export const workoutRoutes: FastifyPluginAsync = async (app) => {
  app.post("/workouts", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = CreateWorkoutInput.safeParse(req.body);
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
        .insert(schema.workouts)
        .values({
          userId: user.id,
          description: parsed.data.description,
          caloriesBurned: parsed.data.caloriesBurned,
          durationMinutes: parsed.data.durationMinutes ?? null,
          performedAt: parsed.data.performedAt
            ? new Date(parsed.data.performedAt)
            : new Date(),
        })
        .returning();
      return inserted[0];
    });
  });

  app.get("/workouts", { preHandler: requireAuth }, async (req, reply) => {
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
        .from(schema.workouts)
        .where(
          and(
            gte(schema.workouts.performedAt, new Date(parsed.data.from)),
            lt(schema.workouts.performedAt, new Date(parsed.data.to)),
          ),
        )
        .orderBy(desc(schema.workouts.performedAt));
    });
  });

  app.delete(
    "/workouts/:id",
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
          .delete(schema.workouts)
          .where(eq(schema.workouts.id, parsed.data.id))
          .returning({ id: schema.workouts.id });
      });
      if (deleted.length === 0) {
        reply.code(404).send({ error: "not_found" });
        return;
      }
      return { ok: true };
    },
  );
};
