import math
import re
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter
from app.schemas.ai_runtime import LearnerProfile, RetrievedContextChunk

# Built-in curriculum concept knowledge base
DEFAULT_KNOWLEDGE_BASE = [
    {
        "id": "kb_fractions_div",
        "topic": "fraction_division",
        "keywords": ["fraction", "division", "divide", "reciprocal", "keep change flip"],
        "content": (
            "Fraction Division Principle: Dividing by a fraction is equivalent to multiplying by its reciprocal. "
            "Visual Analogy: Imagine having 3 whole pizzas and cutting them into 1/2 slices. How many slices do you get? "
            "You get 3 / (1/2) = 3 * 2 = 6 slices."
        )
    },
    {
        "id": "kb_arithmetic_regrouping",
        "topic": "subtraction_borrowing",
        "keywords": ["subtraction", "borrow", "regroup", "carry", "digits"],
        "content": (
            "Regrouping/Borrowing Principle: When subtracting larger digits in lower columns (e.g. 52 - 27), "
            "borrow 1 ten from the tens column (5 tens become 4 tens) to turn 2 units into 12 units (12 - 7 = 5)."
        )
    },
    {
        "id": "kb_photosynthesis",
        "topic": "photosynthesis",
        "keywords": ["photosynthesis", "chlorophyll", "sunlight", "plants", "glucose", "carbon dioxide"],
        "content": (
            "Photosynthesis Mechanism: Plants convert light energy, carbon dioxide (CO2), and water (H2O) into "
            "glucose sugar and oxygen (O2). Chloroplasts containing green chlorophyll act as solar energy harvesters."
        )
    },
    {
        "id": "kb_sm2_spaced_repetition",
        "topic": "memory_decay",
        "keywords": ["sm2", "memory", "retention", "spaced repetition", "interval", "ease factor"],
        "content": (
            "Biometric Spaced Repetition (Modified SM-2): Reviews are scheduled based on memory strength and real-time "
            "cognitive friction (CFI). High physical strain reduces quality score q_bio and triggers an accelerated 4-hour review."
        )
    },
    {
        "id": "kb_dyscalculia_spatial",
        "topic": "dyscalculia_scaffolding",
        "keywords": ["dyscalculia", "struggle", "math anxiety", "spatial", "color code", "number line"],
        "content": (
            "Dyscalculia Scaffolding: Anchor abstract numbers with physical visual grids, color-coded place values, "
            "and continuous number lines to reduce working memory load."
        )
    }
]


def stem_token(word: str) -> str:
    """Lightweight rule-based suffix normalization."""
    word = word.lower()
    for suffix in ("ing", "ions", "ion", "ed", "es", "s"):
        if word.endswith(suffix) and len(word) > len(suffix) + 2:
            return word[:-len(suffix)]
    return word


def tokenize(text: str) -> List[str]:
    """Tokenizes text into lowercase alphanumeric tokens with normalization."""
    tokens = re.findall(r"\b[a-z0-9]+\b", text.lower())
    return [stem_token(t) for t in tokens]


def compute_vector(tokens: List[str]) -> Dict[str, float]:
    """Generates term-frequency vector with L2 normalization."""
    tf = Counter(tokens)
    total = sum(v * v for v in tf.values())
    norm = math.sqrt(total) if total > 0 else 1.0
    return {k: v / norm for k, v in tf.items()}


def cosine_similarity(v1: Dict[str, float], v2: Dict[str, float]) -> float:
    """Calculates cosine similarity between two sparse normalized vectors."""
    common_keys = set(v1.keys()) & set(v2.keys())
    return sum(v1[k] * v2[k] for k in common_keys)


class ContextRetrievalService:
    """
    Hybrid Context Retrieval Engine:
    - Relational Context: Student SM-2 state, current CFI, hesitation history
    - Vector Semantic Context: Cosine similarity vector search over curriculum knowledge base
    """

    def __init__(self, knowledge_base: Optional[List[Dict[str, Any]]] = None):
        self.kb = knowledge_base or DEFAULT_KNOWLEDGE_BASE
        # Precompute vectors for documents in knowledge base
        self._doc_vectors: List[Tuple[Dict[str, Any], Dict[str, float]]] = []
        for doc in self.kb:
            tokens = tokenize(f"{doc['topic']} {' '.join(doc['keywords'])} {doc['content']}")
            self._doc_vectors.append((doc, compute_vector(tokens)))

        # Relational Mock Store (In-memory student records)
        self._student_records: Dict[str, Dict[str, Any]] = {
            "demo_student": {
                "user_id": "demo_student",
                "ease_factor": 2.5,
                "current_interval_days": 1,
                "consecutive_success": 2,
                "known_struggles": ["fraction division", "spatial alignment"],
                "last_evaluated_cfi": 0.65
            }
        }

    def retrieve_relational_context(self, user_id: str, profile: Optional[LearnerProfile] = None) -> RetrievedContextChunk:
        """Retrieves structured relational state (SM-2 retention and biometric history)."""
        student = self._student_records.get(user_id, {
            "user_id": user_id,
            "ease_factor": 2.5,
            "current_interval_days": 1,
            "consecutive_success": 0,
            "known_struggles": [],
            "last_evaluated_cfi": profile.current_cfi if profile else 0.0
        })

        cfi_val = profile.current_cfi if profile else student.get("last_evaluated_cfi", 0.0)
        hesitation = profile.current_hesitation_sec if profile else 0.0

        content = (
            f"Learner ID: {user_id} | SM-2 Ease Factor: {student.get('ease_factor', 2.5):.2f} | "
            f"Review Interval: {student.get('current_interval_days', 1)} days | "
            f"Current Cognitive Friction (CFI): {cfi_val:.2f} | Hesitation: {hesitation:.1f}s | "
            f"Struggle Topics: {', '.join(student.get('known_struggles', [])) or 'None recorded'}"
        )

        return RetrievedContextChunk(
            id=f"relational_{user_id}",
            source_type="relational_sm2",
            content=content,
            relevance_score=1.0
        )

    def retrieve_vector_context(self, query: str, top_k: int = 2) -> List[RetrievedContextChunk]:
        """Performs semantic vector cosine search across educational knowledge base."""
        query_tokens = tokenize(query)
        query_vec = compute_vector(query_tokens)

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for doc, doc_vec in self._doc_vectors:
            score = cosine_similarity(query_vec, doc_vec)
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)

        results: List[RetrievedContextChunk] = []
        for score, doc in scored[:top_k]:
            if score > 0.05 or len(results) == 0:
                results.append(RetrievedContextChunk(
                    id=doc["id"],
                    source_type="vector_knowledge",
                    content=doc["content"],
                    relevance_score=round(float(score), 4)
                ))

        return results

    def assemble_context(self, prompt: str, profile: LearnerProfile) -> List[RetrievedContextChunk]:
        """Synthesizes combined relational and vector context."""
        relational = self.retrieve_relational_context(profile.user_id, profile)
        vector_chunks = self.retrieve_vector_context(prompt, top_k=2)
        return [relational] + vector_chunks


context_retrieval_service = ContextRetrievalService()
