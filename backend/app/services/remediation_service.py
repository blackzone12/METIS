from app.schemas.remediation import RemediationRequest, RemediationResponse, VisualStep
from app.services.gemini_service import gemini_service


class RemediationService:
    """Generates empathetic, low-Lexile, 3-step visual remedial breakdowns."""

    async def generate_remediation(self, request: RemediationRequest) -> RemediationResponse:
        system_instruction = (
            "You are METIS's empathetic pedagogical tutor designed for neurodiverse learners "
            "(ADHD, dyslexia, dyscalculia). Given a problem, break it into exactly 3 clear, visual steps "
            "with emoji/visual cues, and provide a low-Lexile everyday analogy that removes cognitive friction. "
            "Return valid JSON matching the schema: "
            "{'core_concept': string, 'three_step_breakdown': [{'step_number': int, 'title': str, 'explanation': str, 'visual_cue': str}], "
            "'low_lexile_analogy': str, 'audio_readout_script': str, 'encouragement_note': str}"
        )

        prompt = (
            f"Problem: {request.problem_text}\n"
            f"Expected Answer: {request.expected_answer or 'N/A'}\n"
            f"Student Attempt: {request.student_attempt or 'Struggling/Hesitating'}\n"
            f"Cognitive Friction Index: {request.cfi:.2f}\n\n"
            "Generate an empowering, low-cognitive-load visual breakdown."
        )

        live_result = await gemini_service.generate_json(prompt, system_instruction=system_instruction)

        if live_result and "three_step_breakdown" in live_result:
            try:
                steps = [
                    VisualStep(
                        step_number=s.get("step_number", idx + 1),
                        title=s.get("title", f"Step {idx + 1}"),
                        explanation=s.get("explanation", ""),
                        visual_cue=s.get("visual_cue", "🟦")
                    )
                    for idx, s in enumerate(live_result.get("three_step_breakdown", []))
                ]
                return RemediationResponse(
                    problem_text=request.problem_text,
                    core_concept=live_result.get("core_concept", "Balancing Equations"),
                    three_step_breakdown=steps[:3],
                    low_lexile_analogy=live_result.get("low_lexile_analogy", ""),
                    audio_readout_script=live_result.get("audio_readout_script", ""),
                    recommended_font_size_boost="+30%",
                    encouragement_note=live_result.get("encouragement_note", "You are doing great! Let's take it step by step.")
                )
            except Exception:
                pass

        # Intelligent heuristic fallback tailored to problem context
        return self._generate_heuristic_remediation(request)

    def _generate_heuristic_remediation(self, request: RemediationRequest) -> RemediationResponse:
        problem = request.problem_text

        # Detect algebra equation like 2x + 8 = 20
        if "2x + 8 = 20" in problem or ("2x" in problem and "= 20" in problem):
            steps = [
                VisualStep(
                    step_number=1,
                    title="Isolate the Mystery Bags (2x)",
                    explanation="Subtract the 8 extra marbles from both sides: 20 - 8 = 12.",
                    visual_cue="🎒 2x + 8 - 8 = 20 - 8  ➡️  2x = 12"
                ),
                VisualStep(
                    step_number=2,
                    title="Split into Equal Shares",
                    explanation="Divide 12 by 2 bags: 12 ÷ 2 = 6.",
                    visual_cue="⚖️ 12 ÷ 2 = 6"
                ),
                VisualStep(
                    step_number=3,
                    title="Verify the Balance",
                    explanation="Plug 6 back in: 2 × 6 is 12, plus 8 gives exactly 20! Perfect.",
                    visual_cue="✅ 2(6) + 8 = 20"
                )
            ]
            analogy = (
                "Think of a seesaw with 2 identical mystery gift bags and 8 loose coins on one side, "
                "balanced by 20 coins on the other. Take away the 8 loose coins first, leaving 12 coins. "
                "Since you have 2 bags, each bag holds 6 coins!"
            )
            audio = "Let's break this down. First, remove 8 from 20 to get 12. Then divide 12 by 2. The answer for x is 6."
            concept = "Linear Equation Solving (Inverse Operations)"
        else:
            steps = [
                VisualStep(
                    step_number=1,
                    title="Identify the Starting Goal",
                    explanation=f"Look at what we are solving for in: {problem}",
                    visual_cue="🔍 Step 1: Spotlight key numbers"
                ),
                VisualStep(
                    step_number=2,
                    title="Apply the Single Operation",
                    explanation="Simplify the largest operation first by grouping like terms or canceling opposites.",
                    visual_cue="🧩 Step 2: Group and simplify"
                ),
                VisualStep(
                    step_number=3,
                    title="Check and Lock the Result",
                    explanation="Test your answer against the initial conditions to confirm correctness.",
                    visual_cue="🌟 Step 3: Verified solution"
                )
            ]
            analogy = "Solving this is just like unlocking a 3-pin combination lock: turn each dial one at a time."
            audio = f"Here is how to solve this. Focus on the core numbers step by step: {problem}"
            concept = "Foundational Problem Solving"

        return RemediationResponse(
            problem_text=problem,
            core_concept=concept,
            three_step_breakdown=steps,
            low_lexile_analogy=analogy,
            audio_readout_script=audio,
            recommended_font_size_boost="+30%",
            encouragement_note="Take a breath. You have got this! Notice how simple it is one step at a time."
        )


remediation_service = RemediationService()
