import re
import logging

from app.schemas.voice   import VoiceAnswerRequest, VoiceAnswerResponse
from app.core.db         import execute
from app.core.db_queries import SESSION_GET_ID_BY_CODE, VOICE_EVENT_INSERT

logger = logging.getLogger("metis.voice")


class VoiceService:
    """Evaluates verbal answers for dysgraphic / motor-fatigued learners."""

    # ─────────────────────────────────────────────────────────────────────────
    # Text normalisation
    # ─────────────────────────────────────────────────────────────────────────

    _NUM_MAP = {
        "zero": "0",  "one":   "1",  "two":    "2",  "three": "3",
        "four": "4",  "five":  "5",  "six":    "6",  "seven": "7",
        "eight": "8", "nine":  "9",  "ten":   "10",  "eleven": "11",
        "twelve": "12",
    }
    _FILLERS = [
        "i think the answer is", "the answer is",
        "it's", "it is", "x is", "x equals", "equals", "is",
    ]

    def normalize_spoken_text(self, text: str) -> str:
        text = text.lower().strip()
        for word, digit in self._NUM_MAP.items():
            text = re.sub(rf"\b{word}\b", digit, text)
        for filler in self._FILLERS:
            text = text.replace(filler, " ")
        text = re.sub(r"[^\w\s\.\-]", "", text)
        return text.strip()

    # ─────────────────────────────────────────────────────────────────────────
    # Semantic evaluation
    # ─────────────────────────────────────────────────────────────────────────

    def evaluate_spoken_answer(self, request: VoiceAnswerRequest) -> VoiceAnswerResponse:
        norm_speech    = self.normalize_spoken_text(request.transcribed_speech)
        norm_expected  = self.normalize_spoken_text(request.expected_answer)

        if   norm_speech == norm_expected:                                             is_correct, similarity = True,  1.00
        elif norm_expected in norm_speech.split():                                     is_correct, similarity = True,  0.95
        elif norm_speech and norm_expected and (
                norm_speech in norm_expected or norm_expected in norm_speech):          is_correct, similarity = True,  0.85
        else:                                                                           is_correct, similarity = False, 0.20

        phrase = (
            "Spot on! Spoken answer verified."
            if is_correct
            else f"Voice captured: '{request.transcribed_speech}'. Let's double check."
        )

        # ── MySQL persistence (best-effort — session_code is optional) ────────
        if request.session_code:
            rows = execute(SESSION_GET_ID_BY_CODE, (request.session_code,), fetch=True)
            if rows:
                execute(
                    VOICE_EVENT_INSERT,
                    (
                        rows[0][0],
                        request.transcribed_speech,
                        len(request.transcribed_speech.split()),
                        request.duration_ms      or 0,
                        request.hesitation_count or 0,
                        round(1.0 - similarity, 3),
                    ),
                )

        return VoiceAnswerResponse(
            transcribed_speech     = request.transcribed_speech,
            normalized_speech      = norm_speech,
            expected_answer        = request.expected_answer,
            is_semantically_correct = is_correct,
            confidence             = 0.95,
            phonetic_similarity    = similarity,
            feedback_phrase        = phrase,
        )


voice_service = VoiceService()
