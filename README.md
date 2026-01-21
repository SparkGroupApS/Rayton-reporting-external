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

###2. Frontend Setup

cd frontend

# Install dependencies
npm install

# Start the dev server (runs on port 5173)
npm run dev


📦 Production Deployment
The production environment runs on a Linux (Ubuntu) server using Nginx as a reverse proxy and PM2 to manage application processes.

Backend Port: 8010 (Proxied via Nginx)

Frontend: Static files served by Nginx (Built via npm run build)

Quick Deploy
SSH into the production server and run the deployment script:

Bash

# Switch to application user
sudo su - webapp

# Run deploy script (pulls code, updates backend, rebuilds frontend, restarts PM2)
./deploy.sh
Manual Update
git pull origin main

Backend: cd backend && uv sync

Frontend: cd frontend && npm install && npm run build

Restart: pm2 restart all
