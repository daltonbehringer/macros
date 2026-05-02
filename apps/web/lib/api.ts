import type {
  CreateMealInput,
  CreateWorkoutInput,
  Meal,
  UpdateUserProfile,
  UserProfile,
  Workout,
} from "@macros/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const STYTCH_PUBLIC_TOKEN =
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN ?? "";

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(`api ${status}: ${code}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body !== undefined && init.body !== null;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(hasBody ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = "unknown_error";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {}
    throw new ApiError(res.status, code);
  }
  return res.json() as Promise<T>;
}

export type Me = {
  user: { id: string; email: string };
  profile: UserProfile | null;
};

export const api = {
  me: () => request<Me>("/me"),
  sendMagicLink: (email: string) =>
    request<{ ok: true }>("/auth/magic-link/send", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  authenticate: (token: string, type: "magic_links" | "oauth") =>
    request<{ user: { id: string; email: string } }>("/auth/authenticate", {
      method: "POST",
      body: JSON.stringify({ token, type }),
    }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  getProfile: () => request<UserProfile>("/profile"),
  updateProfile: (patch: UpdateUserProfile) =>
    request<UserProfile>("/profile", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteAllData: () =>
    request<{ ok: true }>("/me/data", {
      method: "DELETE",
      body: JSON.stringify({ confirmation: "DELETE" }),
    }),
  listMeals: (range: { from: string; to: string }) =>
    request<Meal[]>(`/meals?${new URLSearchParams(range).toString()}`),
  createMeal: (body: CreateMealInput) =>
    request<Meal>("/meals", { method: "POST", body: JSON.stringify(body) }),
  deleteMeal: (id: string) =>
    request<{ ok: true }>(`/meals/${id}`, { method: "DELETE" }),
  listWorkouts: (range: { from: string; to: string }) =>
    request<Workout[]>(`/workouts?${new URLSearchParams(range).toString()}`),
  createWorkout: (body: CreateWorkoutInput) =>
    request<Workout>("/workouts", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteWorkout: (id: string) =>
    request<{ ok: true }>(`/workouts/${id}`, { method: "DELETE" }),
  sendChat: (body: {
    message: string;
    todayLocal: string;
    todayLabel: string;
    dayStartUtc: string;
    dayEndUtc: string;
  }) =>
    request<{
      reply: string;
      toolCalls: Array<{ name: string; input: unknown; result: unknown }>;
      usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    }>("/chat", { method: "POST", body: JSON.stringify(body) }),
  listChatMessages: () =>
    request<
      Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        createdAt: string;
      }>
    >("/chat/messages"),
};

