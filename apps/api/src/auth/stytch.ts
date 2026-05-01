import * as stytch from "stytch";
import { env } from "../env";

const SESSION_DURATION_MINUTES = 60 * 24 * 30; // 30 days

export const stytchClient = new stytch.Client({
  project_id: env.STYTCH_PROJECT_ID,
  secret: env.STYTCH_SECRET,
});

export async function sendMagicLink(args: {
  email: string;
  callbackUrl: string;
}): Promise<void> {
  await stytchClient.magicLinks.email.loginOrCreate({
    email: args.email,
    login_magic_link_url: args.callbackUrl,
    signup_magic_link_url: args.callbackUrl,
  });
}

export type StytchAuthResult = {
  stytchUserId: string;
  email: string;
  sessionToken: string;
};

export async function authenticateMagicLink(token: string): Promise<StytchAuthResult> {
  const result = await stytchClient.magicLinks.authenticate({
    token,
    session_duration_minutes: SESSION_DURATION_MINUTES,
  });
  return extractAuth(result);
}

export async function authenticateOAuth(token: string): Promise<StytchAuthResult> {
  const result = await stytchClient.oauth.authenticate({
    token,
    session_duration_minutes: SESSION_DURATION_MINUTES,
  });
  return extractAuth(result);
}

function extractAuth(result: {
  user_id: string;
  session_token: string;
  user: { emails: { email: string }[] };
}): StytchAuthResult {
  const email = result.user.emails[0]?.email;
  if (!email) {
    throw new Error("Stytch result missing email");
  }
  return {
    stytchUserId: result.user_id,
    email,
    sessionToken: result.session_token,
  };
}

export async function authenticateSession(sessionToken: string): Promise<{
  stytchUserId: string;
}> {
  const result = await stytchClient.sessions.authenticate({
    session_token: sessionToken,
  });
  return { stytchUserId: result.session.user_id };
}

export async function revokeSession(sessionToken: string): Promise<void> {
  try {
    await stytchClient.sessions.revoke({ session_token: sessionToken });
  } catch {
    // Already revoked / expired — fine.
  }
}
