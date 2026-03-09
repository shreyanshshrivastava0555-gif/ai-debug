"""
LiveDebug AI — API Routes
REST endpoints for error analysis and debugging sessions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from debugging.error_parser import ErrorParser
from debugging.ai_analyzer import AIAnalyzer

router = APIRouter()
error_parser = ErrorParser()
ai_analyzer = AIAnalyzer()


class TerminalErrorRequest(BaseModel):
    raw_output: str
    language: Optional[str] = None  # python, javascript, java, etc.
    file_context: Optional[str] = None  # source code around the error
    session_id: Optional[str] = None


class DebugResponse(BaseModel):
    error_type: str
    error_message: str
    file_path: Optional[str]
    line_number: Optional[int]
    explanation: str
    suggested_fix: str
    code_snippet: Optional[str]
    confidence: float


@router.post("/analyze", response_model=DebugResponse)
async def analyze_error(request: TerminalErrorRequest):
    """
    Accepts raw terminal output, parses the error, and returns AI analysis.
    Called by all editor plugins (VS Code, JetBrains, Neovim).
    """
    # Step 1: Parse raw terminal output into structured error
    parsed = error_parser.parse(request.raw_output, request.language)
    if not parsed:
        raise HTTPException(status_code=400, detail="No recognizable error found in output")

    # Step 2: Send structured error + optional code context to AI
    analysis = await ai_analyzer.analyze(parsed, request.file_context)

    return DebugResponse(
        error_type=parsed["error_type"],
        error_message=parsed["error_message"],
        file_path=parsed.get("file_path"),
        line_number=parsed.get("line_number"),
        explanation=analysis["explanation"],
        suggested_fix=analysis["suggested_fix"],
        code_snippet=analysis.get("code_snippet"),
        confidence=analysis["confidence"],
    )


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "LiveDebug AI Backend"}
