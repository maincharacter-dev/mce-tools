-- ============================================================
-- MCE Suite — MySQL Database Initialisation
-- Runs automatically on first container start.
-- Creates all required databases for the suite.
-- ============================================================

-- OE Toolkit + MCE Ingestion Engine
CREATE DATABASE IF NOT EXISTS `mce_main`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Sprocket AI Agent
CREATE DATABASE IF NOT EXISTS `agent_chat`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ACC Asset Extractor webapp
CREATE DATABASE IF NOT EXISTS `acc_webapp`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Grant the root user access to all (already has it, but explicit for clarity)
-- Individual app users can be added here as the suite grows.
