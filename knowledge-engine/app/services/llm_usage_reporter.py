"""
llm_usage_reporter.py

Lightweight usage reporter for the MCE Knowledge Engine.
After every LLM call, this module POSTs a usage record to Sprocket's
/api/usage/ingest endpoint so all spend is tracked centrally.

Design principles:
  - Fire-and-forget: never blocks or throws into the caller
  - Fails silently: if Sprocket is unreachable, usage is simply not recorded
  - No DB dependency: the KE doesn't own the usage DB
"""

import asyncio
import logging
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Cost estimation
# ---------------------------------------------------------------------------

# Published API pricing as of mid-2025 (USD per million tokens).
# Update as prices change.
_MODEL_PRICING: dict[str, dict[str, float]] = {
    # OpenAI
    "gpt-4o":             {"input": 5.00,  "output": 15.00},
    "gpt-4o-mini":        {"input": 0.15,  "output": 0.60},
    "gpt-4.1":            {"input": 2.00,  "output": 8.00},
    "gpt-4.1-mini":       {"input": 0.40,  "output": 1.60},
    "gpt-4.1-nano":       {"input": 0.10,  "output": 0.40},
    "gpt-4-turbo-preview":{"input": 10.00, "output": 30.00},
    "o3-mini":            {"input": 1.10,  "output": 4.40},
    # Google
    "gemini-2.5-flash":   {"input": 0.075, "output": 0.30},
    "gemini-2.0-flash":   {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro":     {"input": 1.25,  "output": 5.00},
    # Anthropic
    "claude-3-5-sonnet":  {"input": 3.00,  "output": 15.00},
    "claude-3-haiku":     {"input": 0.25,  "output": 1.25},
}
_FALLBACK_PRICING = {"input": 1.00, "output": 4.00}


def estimate_cost_usd(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in USD for a given model and token counts."""
    pricing = _MODEL_PRICING.get(model, _FALLBACK_PRICING)
    return (
        (prompt_tokens / 1_000_000) * pricing["input"]
        + (completion_tokens / 1_000_000) * pricing["output"]
    )


# ---------------------------------------------------------------------------
# Reporter
# ---------------------------------------------------------------------------

async def report_usage(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    source: Optional[str] = None,
    project_id: Optional[str] = None,
) -> None:
    """
    POST a usage record to Sprocket's /api/usage/ingest endpoint.
    Non-blocking — errors are swallowed.

    Args:
        model: LLM model name (e.g. "gpt-4.1-mini")
        prompt_tokens: Number of input tokens used
        completion_tokens: Number of output tokens used
        source: Feature/flow identifier (e.g. "ke_ingestion", "ke_intelligence")
        project_id: Optional project identifier for per-project cost tracking
    """
    sprocket_url = getattr(settings, "sprocket_url", "") or ""
    if not sprocket_url:
        # No Sprocket URL configured — skip silently
        return

    payload = {
        "service": "knowledge-engine",
        "source": source or "unknown",
        "model": model,
        "promptTokens": prompt_tokens,
        "completionTokens": completion_tokens,
        "projectId": project_id,
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.post(
                f"{sprocket_url.rstrip('/')}/api/usage/ingest",
                json=payload,
            )
    except Exception:
        # Intentionally swallowed — usage reporting must never affect the main flow
        pass


def report_usage_sync(
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    source: Optional[str] = None,
    project_id: Optional[str] = None,
) -> None:
    """
    Synchronous wrapper around report_usage for use in non-async contexts.
    Schedules the coroutine on the running event loop if available, otherwise
    creates a new one. Errors are always swallowed.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule as a background task — fire and forget
            asyncio.ensure_future(
                report_usage(model, prompt_tokens, completion_tokens, source, project_id)
            )
        else:
            loop.run_until_complete(
                report_usage(model, prompt_tokens, completion_tokens, source, project_id)
            )
    except Exception:
        pass
