import { getDb } from "./db";
import { accOAuthTokens } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Store ACC OAuth tokens for a user
 */
export async function storeACCTokens(
  userId: number,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
) {
  const db = await getDb();
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Delete existing tokens for this user
  await db.delete(accOAuthTokens).where(eq(accOAuthTokens.userId, userId));

  // Insert new tokens
  await db.insert(accOAuthTokens).values({
    userId,
    accessToken,
    refreshToken: refreshToken || null,
    expiresAt,
  });
}

/**
 * Get ACC OAuth access token for a user
 * Returns null if no token or token is expired
 */
export async function getACCAccessToken(userId: number): Promise<string | null> {
  const db = await getDb();
  const tokens = await db
    .select()
    .from(accOAuthTokens)
    .where(eq(accOAuthTokens.userId, userId))
    .limit(1);

  if (tokens.length === 0) {
    return null;
  }

  const token = tokens[0];

  // Check if token is expired
  if (new Date() >= token.expiresAt) {
    // TODO: Implement token refresh
    return null;
  }

  return token.accessToken;
}

/**
 * Delete ACC OAuth tokens for a user
 */
export async function deleteACCTokens(userId: number) {
  const db = await getDb();
  await db.delete(accOAuthTokens).where(eq(accOAuthTokens.userId, userId));
}

/**
 * Check if user has valid ACC OAuth tokens
 */
export async function hasValidACCTokens(userId: number): Promise<boolean> {
  const token = await getACCAccessToken(userId);
  return token !== null;
}
