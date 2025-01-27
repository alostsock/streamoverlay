from dataclasses import dataclass

from dotenv import dotenv_values


@dataclass(frozen=True)
class _Config:
    now_playing_path: str


_env = dotenv_values()

config = _Config(now_playing_path=_env['NOW_PLAYING_PATH'])
