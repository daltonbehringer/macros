import type {
  ChatQuota,
  CreateMealInput,
  CreateRecipeInput,
  CreateWorkoutInput,
  Meal,
  Recipe,
  UpdateRecipeInput,
  UpdateUserProfile,
  UserProfile,
  Workout,
} from "@macros/shared";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const STYTCH_PUBLIC_TOKEN =
  process.env.NEXT_PUBLIC_STYTCH_PUBLIC_TOKEN ?? "";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    /** Full parsed JSON response body, when present. Lets specific handlers
     * read structured payloads like the `quota` field on a 429 without a
     * second fetch. */
    public data?: unknown,
  ) {
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
    let body: unknown = null;
    try {
      body = await res.json();
      const e = (body as { error?: string }).error;
      if (e) code = e;
    } catch {}
    throw new ApiError(res.status, code, body);
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
      body: JSON.stringify({ email, origin: window.location.origin }),
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
      quota: ChatQuota;
    }>("/chat", { method: "POST", body: JSON.stringify(body) }),
  getChatQuota: () => request<ChatQuota>("/chat/quota"),
  listChatMessages: () =>
    request<
      Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        createdAt: string;
      }>
    >("/chat/messages"),
  listRecipes: (q?: string) =>
    request<Recipe[]>(`/recipes${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createRecipe: (body: CreateRecipeInput) =>
    request<Recipe>("/recipes", { method: "POST", body: JSON.stringify(body) }),
  updateRecipe: (id: string, patch: UpdateRecipeInput) =>
    request<Recipe>(`/recipes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  deleteRecipe: (id: string) =>
    request<{ ok: true }>(`/recipes/${id}`, { method: "DELETE" }),
  logRecipe: (id: string, servings: number) =>
    request<Meal>(`/recipes/${id}/log`, {
      method: "POST",
      body: JSON.stringify({ servings }),
    }),
  getHistory: (args: { from: string; to: string; timezone?: string }) => {
    const qs = new URLSearchParams({ from: args.from, to: args.to });
    if (args.timezone) qs.set("timezone", args.timezone);
    return request<HistoryResponse>(`/history?${qs.toString()}`);
  },
};

export type HistoryResponse = {
  from: string;
  to: string;
  timezone: string;
  targets: {
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    tdeeKcal: number | null;
  } | null;
  days: Array<{
    date: string;
    caloriesConsumed: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    caloriesBurned: number;
  }>;
};


