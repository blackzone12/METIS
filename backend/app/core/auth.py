import base64
import hashlib
import hmac
import json
import time
from typing import Optional
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

SECRET_KEY = "metis-ai-runtime-super-secret-key-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_SECONDS = 3600 * 24  # 24 hours

security = HTTPBearer(auto_error=False)


class TokenPayload(BaseModel):
    sub: str          # User ID or Student ID
    role: str = "student"
    session_id: str
    exp: float
    iat: float


def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def base64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(
    subject: str,
    session_id: str = "demo_session",
    role: str = "student",
    expires_in_sec: int = TOKEN_EXPIRE_SECONDS
) -> str:
    """Generates an RFC 7519 compliant HMAC-SHA256 JWT access token."""
    now = time.time()
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "role": role,
        "session_id": session_id,
        "iat": now,
        "exp": now + expires_in_sec
    }

    header_b64 = base64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

    signature = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = base64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str) -> TokenPayload:
    """Decodes and cryptographically verifies an HMAC-SHA256 JWT access token."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            raise HTTPException(status_code=401, detail="Invalid token format")

        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")

        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = base64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise HTTPException(status_code=401, detail="Invalid token signature")

        payload_dict = json.loads(base64url_decode(payload_b64).decode("utf-8"))
        if payload_dict.get("exp", 0) < time.time():
            raise HTTPException(status_code=401, detail="Token has expired")

        return TokenPayload(**payload_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(security)
) -> TokenPayload:
    """FastAPI dependency for authenticating incoming API requests via Bearer JWT."""
    if not credentials:
        # Default mock user for zero-barrier demo mode
        return TokenPayload(
            sub="student_demo_user",
            role="student",
            session_id="session_live_demo",
            exp=time.time() + 3600,
            iat=time.time()
        )

    token = credentials.credentials
    return decode_access_token(token)
