# Activate virtual environment
. .venv\Scripts\Activate.ps1

# Start FastAPI with auto-reload
#uvicorn app.main:app --reload
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload 
#--log-level debug
