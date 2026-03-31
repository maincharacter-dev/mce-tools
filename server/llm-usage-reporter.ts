/**
 * llm-usage-reporter.ts
 *
 * Lightweight usage reporter for mce-workspace (TA/TDD Engine).
 * After every successful LLM call, this module POSTs a usage record to
 * Sprocket's /api/usage/ingest endpoint so all spend is tracked centrally.
 *
 * Design principles:
 *  - Fire-and-forget: never blocks or throws into the caller
 *  - Fails silently: if Sprocket is unreachable, usage is simply not recorded
 *  - No DB dependency: mce-workspace doesn't own the usage DB
 */

import { ENV } from "./_core/env";

export interface UsageRecord {
  model: string;
  promptTokens: number;
  completionTokens: number;
  source?: string;     // e.g. "fact_extraction", "narrative_synthesis"
  projectId?: string;  // numeric project ID as string
}

/**
 * Resolve the Sprocket base URL.
 * Reads SPROCKET_URL from the environment (set in docker-compose).
 * Falls back to localhost for local dev.
 */
function getSprocketUrl(): string {
  return (ENV as any).sprocketUrl ?? process.env.SPROCKET_URL ?? "http://localhost:3010";
}

/**
 * POST a usage record to Sprocket's ingest endpoint.
 * Non-blocking — errors are swallowed.
 */
export async function reportUsage(record: UsageRecord): Promise<void> {
  try {
    const baseUrl = getSprocketUrl();
    const url = `${baseUrl}/api/usage/ingest`;

    const body = JSON.stringify({
      service: "mce-workspace",
      source: record.source ?? "unknown",
      model: record.model,
      promptTokens: record.promptTokens,
      completionTokens: record.completionTokens,
      projectId: record.projectId,
    });

    // Use a short timeout so a slow/unreachable Sprocket never delays processing
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch {
    // Intentionally swallowed — usage reporting must never affect the main flow
  }
}
