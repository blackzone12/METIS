import json
import logging
import os
import re
from typing import Optional, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger("metis.llm")


def extract_json_from_text(text: str) -> Dict[str, Any]:
    """Extracts valid JSON even if wrapped in markdown codeblocks."""
    text = text.strip()
    if text.startswith("```"):
        # Strip markdown ```json ... ```
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        # Try finding first { and last }
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except Exception:
                pass
    return {}


class GeminiService:
    """
    Multi-provider LLM Client supporting:
    1. Google Gemini Flash API (native SDK)
    2. OpenRouter (e.g. google/gemma-4-26b-a4b-it:free, google/gemma-2-9b-it:free)
    3. OpenAI-Compatible API endpoints
    4. Offline high-fidelity pedagogical simulation fallback
    """

    def __init__(self):
        self.gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY", "")
        self.openrouter_key = (
            settings.OPENROUTER_API_KEY or
            settings.OPENAI_API_KEY or
            os.environ.get("OPENROUTER_API_KEY", "") or
            os.environ.get("OPENAI_API_KEY", "")
        )
        self.gemini_client = None

        if self.gemini_key:
            try:
                from google import genai
                self.gemini_client = genai.Client(api_key=self.gemini_key)
                logger.info("Google Gemini Client initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize google-genai client: {e}.")

        if self.openrouter_key:
            logger.info(f"OpenRouter / OpenAI endpoint configured with model: {settings.LLM_MODEL}")

        if not self.gemini_key and not self.openrouter_key:
            logger.info("No external LLM key detected. Running in high-fidelity offline simulation mode.")

    def is_live(self) -> bool:
        return (self.gemini_client is not None) or bool(self.openrouter_key)

    async def generate_json(self, prompt: str, system_instruction: Optional[str] = None) -> Dict[str, Any]:
        """Calls OpenRouter or Gemini with structured JSON output."""
        # Option A: OpenRouter / OpenAI Compatible Endpoint (e.g. google/gemma-4-26b-a4b-it:free)
        if self.openrouter_key:
            try:
                headers = {
                    "Authorization": f"Bearer {self.openrouter_key}",
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://metis.local",
                    "X-Title": "METIS Retention AI"
                }
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt + "\n\nImportant: Output ONLY raw JSON."})

                payload = {
                    "model": settings.LLM_MODEL,
                    "messages": messages,
                    "response_format": {"type": "json_object"}
                }

                url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        parsed = extract_json_from_text(content)
                        if parsed:
                            return parsed
                    else:
                        logger.warning(f"OpenRouter request returned status {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Error during OpenRouter generation ({settings.LLM_MODEL}): {e}")

        # Option B: Native Google Gemini SDK
        if self.gemini_client:
            try:
                config: Dict[str, Any] = {"response_mime_type": "application/json"}
                if system_instruction:
                    config["system_instruction"] = system_instruction

                response = self.gemini_client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=prompt,
                    config=config
                )
                return extract_json_from_text(response.text)
            except Exception as e:
                logger.error(f"Error during Gemini generation: {e}")

        return {}

    async def generate_multimodal_json(
        self,
        prompt: str,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        system_instruction: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calls Multimodal endpoint for handwriting scratchpad OCR."""
        # Native Google Gemini Multimodal
        if self.gemini_client and image_bytes:
            try:
                from google.genai import types
                parts = [
                    types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                    prompt
                ]
                config: Dict[str, Any] = {"response_mime_type": "application/json"}
                if system_instruction:
                    config["system_instruction"] = system_instruction

                response = self.gemini_client.models.generate_content(
                    model=settings.GEMINI_MODEL,
                    contents=parts,
                    config=config
                )
                return extract_json_from_text(response.text)
            except Exception as e:
                logger.error(f"Error during multimodal Gemini call: {e}")

        return {}


gemini_service = GeminiService()
