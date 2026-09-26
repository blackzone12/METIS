import math
import re
from typing import List, Optional
from app.schemas.ai_runtime import AttentionWeight, LearnerProfile, RetrievedContextChunk


def generate_simple_token_embedding(token: str, dim: int = 16) -> List[float]:
    """Generates a deterministic pseudo-embedding vector for a token."""
    h = 2166136261
    for char in token:
        h = ((h ^ ord(char)) * 16777619) & 0xFFFFFFFF

    vec: List[float] = []
    for i in range(dim):
        val = math.sin((h + i * 31) * 0.001)
        vec.append(val)

    # Normalize vector to unit length
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def dot_product(v1: List[float], v2: List[float]) -> float:
    return sum(a * b for a, b in zip(v1, v2))


def softmax(scores: List[float], temperature: float = 1.0) -> List[float]:
    """Applies numerically stable softmax with temperature scaling."""
    if not scores:
        return []
    temp = max(1e-5, temperature)
    scaled = [s / temp for s in scores]
    max_s = max(scaled)
    exp_scores = [math.exp(s - max_s) for s in scaled]
    sum_exp = sum(exp_scores) or 1.0
    return [e / sum_exp for e in exp_scores]


class SelfAttentionEngine:
    """
    Scaled Dot-Product Self-Attention and Dynamic Relevance Weighting Engine:
    Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V
    Weighs token relevance across query tokens, retrieved context, and biometric struggle signals.
    """

    def __init__(self, embedding_dim: int = 16):
        self.d_k = embedding_dim
        self.scale = math.sqrt(float(self.d_k))

    def compute_contextual_attention(
        self,
        prompt: str,
        contexts: List[RetrievedContextChunk],
        learner_profile: Optional[LearnerProfile] = None
    ) -> List[AttentionWeight]:
        """
        Computes dynamic token attention distribution across prompt and context chunks.
        Elevates attention weights for high-friction concepts if CFI is elevated.
        """
        # Tokenize query prompt
        raw_tokens = re.findall(r"\b[a-zA-Z0-9_\-\/]+\b", prompt)
        if not raw_tokens:
            return []

        # Deduplicate while preserving order
        unique_tokens = list(dict.fromkeys(raw_tokens))

        # Query vectors (Q)
        query_vectors = [generate_simple_token_embedding(t, self.d_k) for t in unique_tokens]

        # Key pool (K): Context tokens & biometric tokens
        context_corpus = " ".join([c.content for c in contexts])
        context_tokens = list(dict.fromkeys(re.findall(r"\b[a-zA-Z0-9_\-\/]+\b", context_corpus)))
        if not context_tokens:
            context_tokens = unique_tokens

        key_vectors = [generate_simple_token_embedding(t, self.d_k) for t in context_tokens]

        # Compute raw dot-product attention scores
        raw_scores: List[float] = []
        cfi = learner_profile.current_cfi if learner_profile else 0.0

        for q_token, q_vec in zip(unique_tokens, query_vectors):
            # Maximum cross-attention against context keys
            k_sims = [dot_product(q_vec, k_vec) / self.scale for k_vec in key_vectors]
            max_sim = max(k_sims) if k_sims else 0.5

            # Biometric attention boost: If learner experiences cognitive friction (CFI > 0.5),
            # amplify attention weight for conceptual/difficulty terms
            is_concept_term = len(q_token) > 4
            biometric_boost = (cfi * 0.4) if is_concept_term else 0.0

            raw_scores.append(max_sim + biometric_boost)

        # Softmax normalize scores to obtain valid attention probability distribution
        norm_weights = softmax(raw_scores, temperature=0.85)

        attention_weights: List[AttentionWeight] = []
        for token, w in zip(unique_tokens, norm_weights):
            attention_weights.append(AttentionWeight(
                token=token,
                weight=round(float(w), 4),
                source="query"
            ))

        # Sort by attention weight descending for explainability
        attention_weights.sort(key=lambda x: x.weight, reverse=True)
        return attention_weights


self_attention_engine = SelfAttentionEngine()
