## Quick context (what this repo is)

Full-stack FastAPI + React template customized for Reporting_FastAPIReact.
- Backend: FastAPI (SQLModel/Pydantic), Alembic migrations, MQTT integration, runs in Docker or locally via `uv`/`uvicorn`.
- Frontend: Vite + React + TypeScript. Generated OpenAPI client lives under `frontend/src/client`.
- Orchestration: Docker Compose + Traefik for local and production routing.

## High-level architecture & data flows (read these files first)
- `backend/app/main.py` — application lifecycle: DB initialization, MQTT startup/shutdown, router include. Look here to understand startup ordering and app.state usage for mqtt.
- `backend/app/core/config.py` — authoritative settings (env_file='../.env'). Contains `mqtt_config` property and DB connection strings; many env vars are expected at repo root `.env`.
- `docker-compose.yml` & `docker-compose.override.yml` — service boundaries (db, prestart, backend, frontend, adminer) and Traefik labels for routing.
- `frontend/package.json` & `frontend/src` — frontend entry, dev/build scripts and generated client usage (`npm run dev`, `npm run generate-client`).

Example patterns to follow
- MQTT: use `settings.mqtt_config` and the `mqtt` FastMQTT instance in `app.state.mqtt_client` (see `backend/app/main.py`).
- DB / migrations: run alembic inside the backend container; migration files are tracked under `backend/app/alembic/versions`.
- Config loading: backend Settings reads `../.env`, so envs live at repo root (not inside `backend/`).

Developer workflows (commands and where to run them)
- Bring up full stack (dev): from repo root: `docker compose watch` (uses `docker-compose.yml` + overrides). See `development.md`.
- Backend local dev (without Docker): from `backend/`: `uv sync` (install deps), activate `.venv`, then `uvicorn app.main:app --reload` (or run `runserver.ps1` on Windows).
- Frontend local dev: from `frontend/`: `npm install` then `npm run dev` (Vite on port 5173).
- Generate frontend client: top-level `./scripts/generate-client.sh` or `cd frontend && npm run generate-client` (openapi json is at `/api/v1/openapi.json`).
- Backend tests: `bash ./backend/scripts/test.sh` (or in-container: `docker compose exec backend bash scripts/tests-start.sh`).
- Frontend E2E: with stack up (backend available): `npx playwright test`.

CI/CD / automation
- See `.github/workflows/*` for GitHub Actions; key workflows: `deploy-staging.yml`, `deploy-production.yml`, `test-backend.yml`, `playwright.yml`.
- Secrets expected by workflows are listed in `deployment.md` and comments in `deployment.md` (e.g., `DOMAIN_*`, `STACK_NAME_*`, `POSTGRES_PASSWORD`, `SECRET_KEY`).

Project-specific conventions and gotchas
- Environment location: Settings uses `env_file="../.env"`. Keep a single `.env` at the repo root. Don't assume `backend/.env`.
- Multiple DB mentions: code/config sometimes references MariaDB (`mariadb+asyncmy`) while `docker-compose.yml` uses Postgres. Verify which DB is active for your environment — this is a common mismatch to watch for when running locally vs. CI.
- Python environment manager: `uv` is used (see `backend/README.md`). Prefer `uv sync` / `uv run` commands when working with Python tasks.
- Linting & formatting: backend uses `ruff`, `mypy`, and `pre-commit` via `uv`; frontend uses `biome` for linting.

Where to look for examples
- API routes + router composition: `backend/app/api/` and `backend/app/api/main.py` (see `app.include_router(...)` in `app/main.py`).
- Models & CRUD: `backend/app/models.py`, `backend/app/crud.py`.
- MQTT handlers: `backend/app/mqtt_handlers.py` and `backend/app/test_mqtt.py` for tests/examples.
- Pre-start and setup scripts: `backend/scripts/prestart.sh` and `backend/runserver.ps1`.

When you change the OpenAPI schema
- After backend schema changes: run generator: `./scripts/generate-client.sh` (commits generated client under `frontend/src/client`).

If something looks inconsistent
- Search `mariadb|postgres|asyncmy` and `docker-compose.yml` to confirm DB engine for the target environment.
- If startup fails, check `backend` container logs and the `prestart` service (it runs `scripts/prestart.sh`) — many migrations/initialization steps run there.

Goal for AI edits
- Narrow scope: prefer small, self-contained changes (one feature/bugfix per PR) and include unit tests (`backend/tests/` or `frontend/tests/`) when applicable.
- When updating API shapes: update backend models, run Alembic revision, then update the frontend client with the generator and commit both changes together.

Questions for you / next steps
- Do you want this file to include command snippets for Windows PowerShell workflows (e.g., `runserver.ps1`) explicitly? If yes I will add a short Windows dev checklist.

References: `README.md`, `development.md`, `deployment.md`, `backend/README.md`, `docker-compose.yml`, `backend/app/main.py`, `backend/app/core/config.py`, `frontend/package.json`, `.github/workflows/`.

## LLMs & AI Agents (Optional)
- The repo supports a `llms.txt` manifest (repo root or `docs/`) to make documentation available to LLM tools.
- Place `llms.txt` (or `llms-full.txt`, `llms-components.txt`, `llms-styling.txt`, `llms-theming.txt`, `llms-v3-migration.txt`) under the repo root or `docs/`.
- Cursor: Use @Docs or register the `llms` files in the Cursor UI.
- Windstatic / Windsurfer: Reference `llms.txt` in `.windsurfrules`.
- ChatGPT/Claude: Use a retrieval plugin (vector store) to index the contents of `llms.txt` for better retrieval-augmented responses.
- Keep them up-to-date with a scheduled GitHub Action (optional) that re-fetches from `https://chakra-ui.com/`.

## Copilot / AI Editing Preferences
- Scope: Prefer small changes and one goal per PR.
- Tests: Include unit tests for backend changes in `backend/tests/` and ensure frontend tests & E2E are stable.
- OpenAPI changes: Update backend models → generate OpenAPI → `./scripts/generate-client.sh` → update frontend client.
- Security: NEVER include secrets or `.env` in repo; use secrets and env vars in CI.
- If unsure, add a PR description summarizing the goal; the assistant should request a follow-up review step when touching migrations or public API changes.

## Quick Windows dev checklist
- Backend (PS):
  ```powershell
  cd backend
  uv sync
  .\.venv\Scripts\Activate.ps1 # if using venv
  uv run pytest
  uvicorn app.main:app --reload
  ```
-Frontend (PS):
  ```powershell
  cd frontend
  npm install
  npm run dev
  ```
