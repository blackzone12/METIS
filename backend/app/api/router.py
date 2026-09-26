from fastapi import APIRouter
from app.api.endpoints import remediation, scratchpad, voice, ai_runtime, sync, telemetry, answer

api_router = APIRouter()

api_router.include_router(remediation.router, prefix="/remediation", tags=["Multimodal Adaptive Remediation"])
api_router.include_router(scratchpad.router, prefix="/scratchpad", tags=["Physical Scratchpad OCR"])
api_router.include_router(voice.router, prefix="/voice", tags=["Dysgraphia Voice Evaluation"])
api_router.include_router(ai_runtime.router, prefix="/runtime", tags=["AI Runtime Engine"])

api_router.include_router(sync.router, prefix="/sync", tags=["Offline Data Synchronization"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["Live Telemetry & WebSocket"])
api_router.include_router(answer.router, prefix="/session", tags=["Answer & SM-2"])
