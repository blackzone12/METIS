from fastapi import APIRouter
from app.schemas.sync import SyncPayload
from app.services.sync_service import sync_service

router = APIRouter()

@router.post("/sync-logs")
async def sync_logs(payload: SyncPayload):
    """
    Receives JSON data from the Frontend (Dexie.js) and saves it into the SQLite backend database.
    """
    result = sync_service.sync_data(payload)
    return result
