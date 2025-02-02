import os
import asyncio
from asyncio.exceptions import CancelledError
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from app.config import config


app = FastAPI(debug=True)
logger = logging.getLogger('uvicorn')


@app.websocket('/now-playing')
async def now_playing(websocket: WebSocket):
    await websocket.accept()

    path = config.now_playing_path
    now_playing = 'No BGM'
    last_time = None

    try:
        while websocket.application_state == WebSocketState.CONNECTED:
            modified_time = os.stat(path).st_mtime
            if last_time is None or modified_time != last_time:
                last_time = modified_time
                with open(path, 'r') as f:
                    now_playing = f.read().strip()
                    await websocket.send_text(now_playing)
            await asyncio.sleep(0.5)
    except (WebSocketDisconnect, CancelledError):
        logger.error('client disconnected')
