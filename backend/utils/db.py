from contextlib import contextmanager
from typing import Iterator

from database import get_connection


@contextmanager
def db_cursor() -> Iterator[tuple]:
    """
    Yield (conn, cur) and guarantee both resources are closed.
    """
    conn = get_connection()
    cur = conn.cursor()
    try:
        yield conn, cur
    finally:
        cur.close()
        conn.close()
