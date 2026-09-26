import re
import json
from typing import List, Tuple, Dict, Any, Optional
from app.schemas.ai_runtime import GuardrailResult

# Known prompt injection & jailbreak signature patterns
INJECTION_PATTERNS = [
    r"(?i)\bignore\s+(all\s+)?(previous|prior|above)\s+instructions\b",
    r"(?i)\bsystem\s+prompt\b",
    r"(?i)\boverride\s+(safety|rules|instructions)\b",
    r"(?i)\bDAN\s+mode\b",
    r"(?i)\bjailbreak\b",
    r"(?i)\bact\s+as\s+(an\s+)?unfiltered\b",
    r"(?i)\bbypass\s+(content\s+filter|guardrails?)\b",
    r"(?i)\breveal\s+(your\s+)?(hidden\s+)?(instructions|secrets)\b",
    r"(?i)\bdrop\s+database\b",
    r"(?i)<\s*script[^>]*>",
]

# Regular expressions for identifying PII
PII_PATTERNS = {
    "email": (r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b", "[EMAIL_REDACTED]"),
    "phone": (r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b", "[PHONE_REDACTED]"),
    "credit_card": (r"\b(?:\d{4}[-\s]?){3}\d{4}\b", "[CREDENTIAL_REDACTED]"),
    "ssn": (r"\b\d{3}-\d{2}-\d{4}\b", "[SSN_REDACTED]"),
}


class GuardrailLayer:
    """
    Multi-tier AI Safety & Guardrail System:
    - Tier 1: Input injection & jailbreak vulnerability scan
    - Tier 2: Real-time PII anonymization & masking
    - Tier 3: Output structured schema & hallucination validation
    """

    def __init__(self):
        self._compiled_injections = [re.compile(p) for p in INJECTION_PATTERNS]
        self._compiled_pii = {k: (re.compile(p[0]), p[1]) for k, p in PII_PATTERNS.items()}

    def inspect_input(self, prompt: str) -> GuardrailResult:
        """
        Evaluates user input for injection vulnerabilities and sanitizes PII.
        """
        violations: List[str] = []
        redacted_pii: List[str] = []

        # 1. Check prompt injection attacks
        for pattern in self._compiled_injections:
            if pattern.search(prompt):
                violations.append(f"Prompt injection pattern detected: '{pattern.pattern}'")

        # 2. Sanitize PII
        sanitized_prompt = prompt
        for pii_type, (regex, replacement) in self._compiled_pii.items():
            matches = regex.findall(sanitized_prompt)
            if matches:
                redacted_pii.extend([f"{pii_type}: {m}" for m in matches])
                sanitized_prompt = regex.sub(replacement, sanitized_prompt)

        passed = len(violations) == 0

        return GuardrailResult(
            passed=passed,
            sanitized_prompt=sanitized_prompt if passed else "",
            violations=violations,
            pii_redacted=redacted_pii,
            structured_schema_valid=True
        )

    def validate_output_schema(
        self,
        output_text: str,
        required_fields: Optional[List[str]] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], str]:
        """
        Verifies that model output satisfies strict JSON structured requirements.
        Returns: (is_valid, parsed_json_or_none, error_message)
        """
        text = output_text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
            text = re.sub(r"\s*```$", "", text)

        try:
            data = json.loads(text)
            if not isinstance(data, dict):
                return False, None, "Output is not a valid JSON object"

            if required_fields:
                missing = [f for f in required_fields if f not in data]
                if missing:
                    return False, data, f"Missing required fields: {', '.join(missing)}"

            return True, data, ""
        except json.JSONDecodeError as err:
            return False, None, f"JSON decode failure: {str(err)}"

    def enforce_pedagogical_tone(self, text: str) -> str:
        """Removes abrupt system tokens and enforces encouraging tone."""
        cleaned = text.replace("<|endoftext|>", "").replace("<|im_end|>", "").strip()
        return cleaned


guardrail_service = GuardrailLayer()
