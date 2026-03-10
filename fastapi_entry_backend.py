"""
LiveDebug AI — Backend API Server
Handles terminal error ingestion, AI analysis, and streaming responses.
Supports: Gemini (primary) + Claude/Anthropic (fallback)
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env before anything else
load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import uvicorn

from api.routes import router
from services.websocket_manager import WebSocketManager

app = FastAPI(
    title="LiveDebug AI",
    description="Real-time AI debugging assistant backend",
    version="1.0.0",
)

# --- CORS Middleware (allows all origins — restrict in production) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WebSocketManager()

# --- REST endpoint: /api/debug/analyze, /api/debug/health ---
app.include_router(router, prefix="/api/debug")

# --- Serve the testing UI at /static ---
app.mount("/static", StaticFiles(directory="static", html=True), name="static")


@app.get("/")
async def root():
    """Redirect root to the testing console."""
    return RedirectResponse(url="/static/index.html")


# --- WebSocket endpoint: /ws/debug ---
@app.websocket("/ws/debug")
async def websocket_debug_endpoint(websocket: WebSocket):
    """
    Single debug WebSocket endpoint.
    Plugins send: { "type": "terminal_output", "payload": { "raw_output": "...", ... } }
    """
    client_id = str(id(websocket))
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)


# --- Legacy route kept for backward compat with existing plugins ---
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)


@app.get("/health")
async def root_health():
    return {"status": "ok", "service": "LiveDebug AI Backend", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("fastapi_entry_backend:app", host="0.0.0.0", port=8000, reload=True)

