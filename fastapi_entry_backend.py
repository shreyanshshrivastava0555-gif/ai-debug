"""
LiveDebug AI — Backend API Server
Handles terminal error ingestion, AI analysis, and streaming responses.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.routes import router
from services.websocket_manager import WebSocketManager

app = FastAPI(
    title="LiveDebug AI",
    description="Real-time AI debugging assistant backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = WebSocketManager()

app.include_router(router, prefix="/api")


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.handle_message(client_id, data)
    except WebSocketDisconnect:
        manager.disconnect(client_id)


if __name__ == "__main__":
    uvicorn.run("fastapi_entry_backend:app", host="0.0.0.0", port=8000, reload=True)
