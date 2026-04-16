import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


load_dotenv(Path(__file__).resolve().parent / ".env")


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_connection():
    return psycopg2.connect(
        host=_required_env("DB_HOST"),
        port=int(_required_env("DB_PORT")),
        dbname=_required_env("DB_NAME"),
        user=_required_env("DB_USER"),
        password=_required_env("DB_PASSWORD"),
    )
