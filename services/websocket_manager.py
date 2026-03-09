"""
LiveDebug AI — WebSocket Manager
Manages real-time connections from editor plugins.
"""

from fastapi import WebSocket
from typing import Dict
from debugging.error_parser import ErrorParser
from debugging.ai_analyzer import AIAnalyzer


class WebSocketManager:

    def __init__(self):
        self.connections: Dict[str, WebSocket] = {}
        self.error_parser = ErrorParser()
        self.ai_analyzer = AIAnalyzer()

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.connections[client_id] = websocket
        await websocket.send_json({"type": "connected", "client_id": client_id})

    def disconnect(self, client_id: str):
        self.connections.pop(client_id, None)

    async def handle_message(self, client_id: str, data: dict):
        """
        Handle incoming messages from editor plugins.
        Expected format: { "type": "terminal_output", "payload": { "raw_output": "..." } }
        """
        ws = self.connections.get(client_id)
        if not ws:
            return

        msg_type = data.get("type")

        if msg_type == "terminal_output":
            raw = data.get("payload", {}).get("raw_output", "")
            language = data.get("payload", {}).get("language")
            file_context = data.get("payload", {}).get("file_context")

            # Notify client we're processing
            await ws.send_json({"type": "analyzing", "message": "Detecting errors..."})

            parsed = self.error_parser.parse(raw, language)
            if not parsed:
                await ws.send_json({"type": "no_error", "message": "No errors detected."})
                return

            await ws.send_json({
                "type": "error_detected",
                "error_type": parsed["error_type"],
                "error_message": parsed["error_message"],
                "file_path": parsed.get("file_path"),
                "line_number": parsed.get("line_number"),
            })

            # Run AI analysis
            analysis = await self.ai_analyzer.analyze(parsed, file_context)
            await ws.send_json({
                "type": "analysis_complete",
                "explanation": analysis["explanation"],
                "suggested_fix": analysis["suggested_fix"],
                "code_snippet": analysis.get("code_snippet"),
                "confidence": analysis["confidence"],
            })

        elif msg_type == "ping":
            await ws.send_json({"type": "pong"})
