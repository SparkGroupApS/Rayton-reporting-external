# Rayton Reporting App

Internal web application for Rayton reporting, built with FastAPI (Backend) and React (Frontend).

## 🛠 Tech Stack

- **Backend:** FastAPI, SQLModel, Alembic, Python 3.11+
- **Frontend:** React, TypeScript, Vite, Chakra UI, Node.js 20+
- **Database:** SQLite (Dev) / MariaDB (Prod)
- **Infrastructure:** Nginx (Reverse Proxy), PM2 (Process Manager)

---

## 🚀 Local Development Setup

### Prerequisites
1.  **Python:** Install `uv` (Package manager): `curl -LsSf https://astral.sh/uv/install.sh | sh`
2.  **Node.js:** Install via `nvm` (Node Version Manager) and use Node 20+.

### 1. Backend Setup
```bash
cd backend

# Install dependencies
uv sync

# Activate virtual environment
source .venv/bin/activate

# Run database migrations
alembic upgrade head

# Start the backend (runs on port 8000 by default)
# You can use the helper script or run uvicorn directly
./runserver.ps1  # Windows
# OR
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
