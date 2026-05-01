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
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
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
  profile: {
    userId: string;
    heightCm: number | null;
    weightKg: number | null;
    age: number | null;
    sex: "male" | "female" | null;
    activityLevel:
      | "sedentary"
      | "light"
      | "moderate"
      | "active"
      | "very_active"
      | null;
    dailyCalorieTarget: number | null;
    dailyProteinG: number | null;
    dailyCarbsG: number | null;
    dailyFatG: number | null;
    unitSystem: "metric" | "imperial";
    timezone: string;
  } | null;
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
};
