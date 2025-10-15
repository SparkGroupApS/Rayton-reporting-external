# Activate virtual environment
. .venv\Scripts\Activate.ps1

# Start FastAPI with auto-reload
uvicorn app.main:app --reload
