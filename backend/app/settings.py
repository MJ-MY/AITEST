import os

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


# 后端独立项目：只读取 `backend/.env`（以及可选的 `backend/.env.local`）
_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(_BACKEND_ROOT, ".env.local"), override=False)
load_dotenv(os.path.join(_BACKEND_ROOT, ".env"), override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    app_name: str = "AITEST Backend"
    environment: str = "local"

    # DashScope（通义千问）
    DASHSCOPE_API_KEY: str | None = None

    # MiniMax（OpenAI 兼容接口）
    MINIMAX_API_KEY: str | None = None
    MINIMAX_BASE_URL: str = "https://api.minimax.io/v1"
    MINIMAX_STREAM: str = "true"

    # 上游超时（毫秒）
    UPSTREAM_TIMEOUT_MS: int = 180_000
    FETCH_MS_WEATHER: int = 12_000

    # 易客天气
    YIKETIANQI_APPID: str | None = None
    YIKETIANQI_APPSECRET: str | None = None


settings = Settings()

