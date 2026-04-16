import psycopg2

from config import required_env


def get_connection():
    return psycopg2.connect(
        host=required_env("DB_HOST"),
        port=int(required_env("DB_PORT")),
        dbname=required_env("DB_NAME"),
        user=required_env("DB_USER"),
        password=required_env("DB_PASSWORD"),
    )
