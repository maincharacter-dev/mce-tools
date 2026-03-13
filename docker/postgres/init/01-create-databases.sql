-- ============================================================
-- MCE Suite — PostgreSQL Database Initialisation
-- Runs automatically on first container start.
-- Creates all required databases for the suite.
-- ============================================================

-- MCE Knowledge Engine (FastAPI / SQLAlchemy)
SELECT 'CREATE DATABASE knowledge_engine'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'knowledge_engine')\gexec

-- ACC API (FastAPI / Celery scraper and site inspection)
SELECT 'CREATE DATABASE acc_tools'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'acc_tools')\gexec
