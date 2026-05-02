import type Anthropic from "@anthropic-ai/sdk";
import { forUser, schema } from "@macros/db";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { getDb } from "../db";
import { runChatTurn } from "./loop";
import { buildSystemPrompt } from "./systemPrompt";
import type { ToolContext } from "./tools";

const ChatSendBody = z.object({
  message: z.string().min(1).max(4000),
  /** YYYY-MM-DD in user's local TZ — drives "today" semantics. */
  todayLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** ISO start of "today" UTC, computed by the client from browser TZ. */
  dayStartUtc: z.string().datetime(),
  dayEndUtc: z.string().datetime(),
  /** Optional human-friendly label for prompt rendering, e.g. "Friday, May 1". */
  todayLabel: z.string().min(1).max(100),
});

const HISTORY_TURNS = 20; // last N user/assistant pairs sent back to Claude

export const chatRoutes: FastifyPluginAsync = async (app) => {
  app.post("/chat", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = ChatSendBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid_body", issues: parsed.error.issues });
      return;
    }
    const user = req.user!;
    const { db } = getDb();

    // Sweep messages older than 30 days (rolling retention, per spec).
    await db
      .delete(schema.chatMessages)
      .where(
        sql`created_at < now() - interval '30 days' AND user_id = ${user.id}`,
      );

    // Load profile + today's totals + recent meals to seed the system prompt.
    const {
      profile,
      totalsToday,
      caloriesBurnedToday,
      todayMealLines,
      todayWorkoutLines,
      recentMealLines,
    } = await forUser(db, user.id, async (tx) => {
      const profileRows = await tx
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, user.id))
        .limit(1);
      const profile = profileRows[0] ?? null;

      const start = new Date(parsed.data.dayStartUtc);
      const end = new Date(parsed.data.dayEndUtc);
      const todayMeals = await tx
        .select()
        .from(schema.meals)
        .where(
          and(
            gte(schema.meals.consumedAt, start),
            lt(schema.meals.consumedAt, end),
          ),
        )
        .orderBy(asc(schema.meals.consumedAt));
      const todayWorkouts = await tx
        .select()
        .from(schema.workouts)
        .where(
          and(
            gte(schema.workouts.performedAt, start),
            lt(schema.workouts.performedAt, end),
          ),
        )
        .orderBy(asc(schema.workouts.performedAt));
      const totalsToday = todayMeals.reduce(
        (a, m) => ({
          calories: a.calories + m.calories,
          proteinG: a.proteinG + m.proteinG,
          carbsG: a.carbsG + m.carbsG,
          fatG: a.fatG + m.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      );
      const caloriesBurnedToday = todayWorkouts.reduce(
        (a, w) => a + w.caloriesBurned,
        0,
      );

      const todayMealLines = todayMeals.map(
        (m) =>
          `- [logged ${m.consumedAt.toISOString()}] ${m.description} — ${Math.round(m.calories)} kcal · ${Math.round(m.proteinG)}P / ${Math.round(m.carbsG)}C / ${Math.round(m.fatG)}F`,
      );
      const todayWorkoutLines = todayWorkouts.map(
        (w) =>
          `- [logged ${w.performedAt.toISOString()}] ${w.description} — ${Math.round(w.caloriesBurned)} kcal${
            w.durationMinutes !== null ? ` · ${w.durationMinutes} min` : ""
          }`,
      );

      // "Recent meals" = past 7 days *excluding* today (today is already
      // listed under "Already logged today" — no need to repeat it).
      const sevenDaysAgo = new Date(start);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
      const recent = await tx
        .select()
        .from(schema.meals)
        .where(
          and(
            gte(schema.meals.consumedAt, sevenDaysAgo),
            lt(schema.meals.consumedAt, start),
          ),
        )
        .orderBy(desc(schema.meals.consumedAt))
        .limit(40);
      const recentMealLines = recent.map(
        (m) =>
          `- ${m.consumedAt.toISOString().slice(0, 10)} · ${m.description} (${Math.round(m.calories)} kcal)`,
      );

      return {
        profile,
        totalsToday,
        caloriesBurnedToday,
        todayMealLines,
        todayWorkoutLines,
        recentMealLines,
      };
    });

    // Pull recent chat history (text turns only — tool details aren't required
    // because the system prompt re-grounds totals each turn).
    const history = await forUser(db, user.id, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.chatMessages)
        .orderBy(desc(schema.chatMessages.createdAt))
        .limit(HISTORY_TURNS * 2);
      return rows.reverse();
    });
    const historyMessages: Anthropic.MessageParam[] = history.map((row) => ({
      role: row.role,
      content: row.content,
    }));

    const { stable, volatile } = buildSystemPrompt({
      profile,
      todayLocal: parsed.data.todayLocal,
      todayLabel: parsed.data.todayLabel,
      totalsToday,
      caloriesBurnedToday,
      todayMealLines,
      todayWorkoutLines,
      recentMealLines,
    });

    const ctx: ToolContext = {
      userId: user.id,
      todayLocal: parsed.data.todayLocal,
      dayStartUtc: parsed.data.dayStartUtc,
      dayEndUtc: parsed.data.dayEndUtc,
      db,
    };

    let result;
    try {
      result = await runChatTurn({
        systemStable: stable,
        systemVolatile: volatile,
        history: historyMessages,
        userMessage: parsed.data.message,
        ctx,
      });
    } catch (err) {
      req.log.error({ err }, "chat turn failed");
      reply.code(502).send({ error: "chat_failed" });
      return;
    }

    // Persist the user + assistant turn. Tool details live on the assistant row.
    await forUser(db, user.id, async (tx) => {
      await tx.insert(schema.chatMessages).values([
        {
          userId: user.id,
          role: "user",
          content: parsed.data.message,
        },
        {
          userId: user.id,
          role: "assistant",
          content: result.text,
          toolCalls: result.toolCalls,
        },
      ]);
    });

    return {
      reply: result.text,
      toolCalls: result.toolCalls,
      usage: {
        input: result.usage.input_tokens,
        output: result.usage.output_tokens,
        cacheRead: result.usage.cache_read_input_tokens ?? 0,
        cacheWrite: result.usage.cache_creation_input_tokens ?? 0,
      },
    };
  });

  app.get("/chat/messages", { preHandler: requireAuth }, async (req) => {
    const user = req.user!;
    const { db } = getDb();
    return forUser(db, user.id, async (tx) => {
      return tx
        .select({
          id: schema.chatMessages.id,
          role: schema.chatMessages.role,
          content: schema.chatMessages.content,
          createdAt: schema.chatMessages.createdAt,
        })
        .from(schema.chatMessages)
        .orderBy(asc(schema.chatMessages.createdAt))
        .limit(200);
    });
  });
};
