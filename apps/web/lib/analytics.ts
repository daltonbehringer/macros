import { track as vercelTrack } from "@vercel/analytics";

/**
 * Single source of truth for the custom-event name vocabulary. Adding a new
 * event means adding a name here; using one anywhere else is a typecheck
 * error. Page views are recorded automatically by `<Analytics />` and don't
 * need to be tracked here.
 *
 * Per the analytics plan: no PII, no message content, no emails. Event
 * properties are intentionally empty for the MVP — easier to add fields later
 * than to remove them once the dashboard chart is built.
 */
type EventName =
  | "signup_completed"
  | "onboarding_completed"
  | "meal_logged_via_chat"
  | "meal_logged_manual"
  | "workout_logged"
  | "delete_account";

export function track(event: EventName): void {
  // Wrap in try/catch so a network blip or ad-blocker doesn't surface as a
  // user-facing error. Analytics failures are non-blocking by definition.
  try {
    vercelTrack(event);
  } catch {
    /* swallow */
  }
}

const MEAL_TOOLS = new Set(["log_meal", "log_meal_from_recipe"]);
const WORKOUT_TOOLS = new Set(["log_workout"]);

/**
 * Inspect the tool calls from a chat turn and fire the corresponding
 * "_via_chat" events. Fires at most one event per kind per turn — if a single
 * message logged three meals, we count it once. Saves quota.
 */
export function trackChatToolCalls(calls: { name: string }[]): void {
  if (calls.some((c) => MEAL_TOOLS.has(c.name))) track("meal_logged_via_chat");
  if (calls.some((c) => WORKOUT_TOOLS.has(c.name))) track("workout_logged");
}
