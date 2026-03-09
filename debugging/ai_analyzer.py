"""
LiveDebug AI — AI Analyzer
Sends structured error data to AI model and returns debugging analysis.
Supports: Google Gemini (primary), Claude (fallback), OpenAI (fallback)
"""

import os
import json
from typing import Optional
import httpx


class AIAnalyzer:

    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY", "")
        self.anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.model = os.getenv("AI_MODEL", "gemini-1.5-pro")

    def _build_prompt(self, parsed_error: dict, file_context: Optional[str]) -> str:
        prompt = f"""You are an expert software debugger. Analyze this error and provide a clear explanation and fix.

ERROR DETAILS:
- Language: {parsed_error.get('language', 'unknown')}
- Error Type: {parsed_error['error_type']}
- Error Message: {parsed_error['error_message']}
- File: {parsed_error.get('file_path', 'unknown')}
- Line: {parsed_error.get('line_number', 'unknown')}

STACK TRACE:
{chr(10).join(parsed_error.get('stack_trace', [])) or 'Not available'}

RAW TERMINAL OUTPUT:
{parsed_error['raw'][:2000]}
"""
        if file_context:
            prompt += f"\nSOURCE CODE CONTEXT:\n{file_context[:3000]}\n"

        prompt += """
Respond with a JSON object (no markdown, just raw JSON):
{
  "explanation": "Clear explanation of what caused the error (2-3 sentences)",
  "suggested_fix": "Step-by-step fix instructions",
  "code_snippet": "Corrected code snippet if applicable, or null",
  "confidence": 0.0 to 1.0
}
"""
        return prompt

    async def analyze(self, parsed_error: dict, file_context: Optional[str] = None) -> dict:
        """Send error to AI model and return structured analysis."""
        prompt = self._build_prompt(parsed_error, file_context)

        if self.gemini_key:
            return await self._call_gemini(prompt)
        elif self.anthropic_key:
            return await self._call_claude(prompt)
        else:
            return self._fallback_analysis(parsed_error)

    async def _call_gemini(self, prompt: str) -> dict:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "maxOutputTokens": 1024},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                url,
                json=payload,
                headers={"x-goog-api-key": self.gemini_key}
            )
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse_ai_response(text)

    async def _call_claude(self, prompt: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                },
                headers={
                    "x-api-key": self.anthropic_key,
                    "anthropic-version": "2023-06-01",
                },
            )
            resp.raise_for_status()
            text = resp.json()["content"][0]["text"]
            return self._parse_ai_response(text)

    def _parse_ai_response(self, text: str) -> dict:
        """Parse JSON response from AI model."""
        try:
            # Strip markdown fences if present
            clean = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            return json.loads(clean)
        except Exception:
            return {
                "explanation": text[:500],
                "suggested_fix": "See explanation above.",
                "code_snippet": None,
                "confidence": 0.5,
            }

    def _fallback_analysis(self, parsed_error: dict) -> dict:
        """Return basic analysis when no AI key is configured."""
        return {
            "explanation": (
                f"A {parsed_error['error_type']} occurred: {parsed_error['error_message']}. "
                f"Please configure GEMINI_API_KEY or ANTHROPIC_API_KEY for AI-powered analysis."
            ),
            "suggested_fix": "Check the error message and stack trace above for details.",
            "code_snippet": None,
            "confidence": 0.1,
        }
