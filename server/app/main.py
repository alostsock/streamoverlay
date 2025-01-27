from fastapi import FastAPI
from app.config import config

app = FastAPI()


@app.get('/now-playing')
async def now_playing():
    with open(config.now_playing_path, 'r') as f:
        now_playing = f.read().strip()

    return {'message': now_playing}
