-- ============================================================
-- MCE Suite — MySQL Database Initialisation
-- Runs automatically on first container start.
-- Creates all required databases for the suite.
-- ============================================================

-- OE Toolkit (oe-toolkit)
CREATE DATABASE IF NOT EXISTS `oe_toolkit`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- MCE Ingestion Engine (mce-tools root app)
CREATE DATABASE IF NOT EXISTS `mce_ingestion`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Sprocket AI Agent (oe-ai-agent-2)
CREATE DATABASE IF NOT EXISTS `agent_chat`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ACC Asset Extractor webapp (acc-tools) — Phase 4
CREATE DATABASE IF NOT EXISTS `acc_webapp`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Legacy mce_main database (kept for backward compatibility)
CREATE DATABASE IF NOT EXISTS `mce_main`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
