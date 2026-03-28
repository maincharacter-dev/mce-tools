/**
 * Knowledge Engine API Client
 *
 * Thin HTTP client that proxies requests from OE Toolkit's tRPC layer
 * to the MCE Knowledge Engine (FastAPI) REST API.
 *
 * The Knowledge Engine runs at KNOWLEDGE_ENGINE_URL (default: http://knowledge-engine:8000).
 * It requires no authentication — it sits inside the Docker network.
 */
import { ENV } from "./_core/env";

const BASE = ENV.knowledgeEngineUrl.replace(/\/$/, "");

async function keGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Knowledge Engine request failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<T>;
}

async function kePost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Knowledge Engine request failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

// ─── Health ──────────────────────────────────────────────────────────────────

export interface KeHealth {
  status: string;
  environment: string;
}

export async function getKeHealth(): Promise<KeHealth> {
  return keGet<KeHealth>("/health");
}

// ─── Intelligence Status ─────────────────────────────────────────────────────

export interface KeStatus {
  total_projects: number;
  total_risks: number;
  total_site_conditions: number;
  total_outcomes: number;
  total_design_standards: number;
  total_equipment_records: number;
  data_quality_score: number;
  coverage_by_type: Record<string, number>;
  last_updated: string;
}

export async function getKeStatus(): Promise<KeStatus> {
  return keGet<KeStatus>("/api/intelligence/status");
}

// ─── Intelligence Gaps ───────────────────────────────────────────────────────

export interface KeGaps {
  gaps: Array<{ area: string; description: string }>;
  recommendations: string[];
  priority_areas: string[];
}

export async function getKeGaps(): Promise<KeGaps> {
  return keGet<KeGaps>("/api/intelligence/gaps");
}

// ─── Risks ───────────────────────────────────────────────────────────────────

export interface KeRisk {
  id: string;
  project_id: string;
  risk_type: string;
  category: string;
  description: string;
  likelihood: string;
  impact: string;
  occurred: boolean;
  outcome_description?: string;
  mitigation_used?: string;
  mitigation_effective?: boolean;
  created_at: string;
}

export interface KeSimilarRisksResponse {
  risks: KeRisk[];
  total_count: number;
  confidence: { score: number; level: string; projects_count: number; explanation: string };
}

export async function getKeSimilarRisks(
  project_type: string,
  risk_type?: string,
  category?: string,
  limit = 20,
): Promise<KeSimilarRisksResponse> {
  return kePost<KeSimilarRisksResponse>("/api/intelligence/risks/similar", {
    project_type,
    risk_type,
    category,
    limit,
  });
}

export interface KeRisksByCategoryResponse {
  category: string;
  risks: KeRisk[];
  occurrence_rate: number;
  avg_impact_score: number;
  confidence: { score: number; level: string; projects_count: number; explanation: string };
}

export async function getKeRisksByCategory(
  category: string,
  project_type?: string,
): Promise<KeRisksByCategoryResponse> {
  return kePost<KeRisksByCategoryResponse>("/api/intelligence/risks/by-category", {
    category,
    project_type,
  });
}

// ─── Benchmarks ──────────────────────────────────────────────────────────────

export interface KeBenchmarkEstimate {
  cost_estimate: { low: number; mid: number; high: number; unit: string };
  schedule_estimate: { low: number; mid: number; high: number; unit: string };
  cost_drivers: Array<{ factor: string; impact: string }>;
  schedule_drivers: Array<{ factor: string; impact: string }>;
  confidence: { score: number; level: string; projects_count: number; explanation: string };
  similar_projects_count: number;
}

export async function getKeBenchmarkEstimate(
  project_type: string,
  capacity_mw: number,
  region?: string,
): Promise<KeBenchmarkEstimate> {
  return kePost<KeBenchmarkEstimate>("/api/intelligence/benchmarks/estimate", {
    project_type,
    capacity_mw,
    region,
  });
}
