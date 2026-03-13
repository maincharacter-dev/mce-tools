# MCE Suite — Local Docker Hosting Guide

This document describes the unified Docker environment for the MCE/OE/ACC tool suite. All tools run on your local machine via Docker Compose, with optional remote access via Cloudflare Tunnel.

---

## Architecture Overview

The suite is composed of three GitHub repositories, all managed by a single `docker-compose.yml` that lives in this repo (`mce-tools`).

```
C:\MCE\GitHub\
├── mce-tools\          ← this repo — contains docker-compose.yml (suite root)
│   ├── oe-toolkit\     ← OE Toolkit (the front door, port 3000)
│   ├── knowledge-engine\ ← MCE Knowledge Engine (port 3005)
│   └── [root app]      ← MCE Ingestion Engine (port 3001)
├── oe-ai-agent-2\      ← Sprocket AI Agent (port 3002)
└── acc-tools\          ← ACC Asset Extractor + Data Scraper (port 3003 / 8000)
```

### Service Map

| Service | Container | Port | Database |
| :--- | :--- | :--- | :--- |
| OE Toolkit | `oe-toolkit` | 3000 | MySQL → `mce_main` |
| MCE Ingestion Engine | `mce-tools` | 3001 | MySQL → `mce_main` |
| MCE Knowledge Engine | `knowledge-engine` | 3005 | PostgreSQL → `knowledge_engine` |
| Sprocket AI Agent | `sprocket` | 3002 | MySQL → `agent_chat`, Neo4j |
| ACC Asset Extractor | `acc-webapp` | 3003 | MySQL → `acc_webapp` |
| ACC API (scraper) | `acc-api` | 8000 | PostgreSQL → `acc_tools`, Redis |
| **MySQL 8** | `mce-mysql` | 3306 | — |
| **PostgreSQL 15** | `mce-postgres` | 5432 | — |
| **Neo4j 5** | `mce-neo4j` | 7474/7687 | — |
| **Redis 7** | `mce-redis` | 6379 | — |
| **MinIO** | `mce-minio` | 9000/9001 | — |
| **Nginx** | `mce-nginx` | 80 | — |
| **Cloudflare Tunnel** | `mce-cloudflared` | — | — |

### Remote Access (Cloudflare)

Two public hostnames are configured on a single Cloudflare Tunnel, both pointing at `nginx:80`:

| Hostname | Routes to |
| :--- | :--- |
| `tools.maincharacter.wtf` | OE Toolkit (front door to the suite) |
| `sprocket.maincharacter.wtf` | Sprocket AI Agent (standalone) |

---

## Prerequisites

| Requirement | Minimum | Notes |
| :--- | :--- | :--- |
| Docker Desktop | v4.20+ | Ensure WSL2 backend is enabled on Windows |
| RAM | 8 GB free | 16 GB recommended (Neo4j + all services) |
| Disk | 10 GB free | Neo4j data grows over time |
| Repos cloned | All three | `mce-tools`, `oe-ai-agent-2`, `acc-tools` |

---

## Quick Start

### 1. Create your `.env` file

```bash
cp .env.example .env
# Edit .env and fill in all required values
```

At minimum, set all the `_PASSWORD` values to something secure.

### 2. Start the infrastructure layer

```bash
docker compose up -d
```

This starts MySQL, PostgreSQL, Neo4j, Redis, MinIO, and Nginx. Verify everything is healthy:

```bash
docker compose ps
```

All services should show `healthy` within 60 seconds.

### 3. Verify databases were created

```bash
# MySQL
docker exec mce-mysql mysql -u root -p${MYSQL_ROOT_PASSWORD} -e "SHOW DATABASES;"

# PostgreSQL
docker exec mce-postgres psql -U mce_user -c "\l"
```

You should see `mce_main`, `agent_chat`, `acc_webapp` in MySQL and `knowledge_engine`, `acc_tools` in PostgreSQL.

### 4. Access MinIO console

Open `http://localhost:9001` and log in with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`. Create the following buckets:
- `mce-documents`
- `agent-storage`
- `acc-uploads`

---

## Build Phases

The suite is being built incrementally. Each phase adds more containers to the compose file.

| Phase | Status | What it adds |
| :--- | :--- | :--- |
| **1 — Infrastructure** | ✅ Complete | MySQL, Postgres, Neo4j, Redis, MinIO, Nginx |
| **2 — Sprocket** | 🔲 Pending | `sprocket` container, updated `deploy.yml` |
| **3 — MCE Tools & OE Toolkit** | 🔲 Pending | `mce-tools`, `oe-toolkit`, `knowledge-engine` containers + local auth |
| **4 — ACC Tools** | 🔲 Pending | `acc-webapp`, `acc-api`, `acc-scraper-worker` containers |
| **5 — Nginx + Cloudflare** | 🔲 Pending | Full routing config, remote access |
| **6 — OE Toolkit URL update** | 🔲 Pending | Update tool card URLs from Manus → local |
| **7 — CI/CD** | 🔲 Pending | Org-level runner, `deploy.yml` for all repos |

---

## CI/CD — Auto-Rebuild on Push

Each repository has a `deploy.yml` GitHub Actions workflow that runs on the self-hosted runner on your machine. When you push to `master` in any repo, only that repo's containers are rebuilt — shared infrastructure is never restarted.

| Push to | Containers rebuilt |
| :--- | :--- |
| `mce-tools` | `oe-toolkit`, `mce-tools`, `knowledge-engine` |
| `oe-ai-agent-2` | `sprocket` |
| `acc-tools` | `acc-webapp`, `acc-api`, `acc-scraper-worker` |

The runner must be registered at the **organisation level** (`robachamilton-afk`) so it can serve all three repos.

---

## Useful Commands

```bash
# Start everything
docker compose up -d

# Start with Cloudflare tunnel
docker compose --profile tunnel up -d

# View logs for a specific service
docker compose logs -f oe-toolkit

# Restart a single service (e.g. after a code change)
docker compose build sprocket && docker compose up -d --no-deps sprocket

# Stop everything (data is preserved in volumes)
docker compose down

# Stop everything AND delete all data (full reset)
docker compose down -v
```
