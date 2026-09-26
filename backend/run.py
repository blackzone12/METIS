import os
import sys
import uvicorn

# Ensure 'backend_ai' is on sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

if sys.platform.startswith("win"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

if __name__ == "__main__":
    print("\n========================================================")
    print("METIS AI Integration & Multimodal Runtime is Starting...")
    print("Interactive Workbench: http://localhost:8000")
    print("API Documentation:     http://localhost:8000/docs")
    print("API Catalog:           http://localhost:8000/api")
    print("========================================================\n")
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        app_dir=current_dir
    )
