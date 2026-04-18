from fastapi import APIRouter, HTTPException

from schemas.processes import ProcessCreate, ProcessUpdate
from utils.db import db_cursor
from utils.validation import bool_or_default, require_non_empty_string


router = APIRouter()


def _serialize_process(row):
    return {
        "process_id": row[0],
        "process_code": row[1],
        "process_name": row[2],
        "is_active": bool(row[3]),
    }


@router.get("/processes")
def get_processes():
    with db_cursor() as (_, cur):
        cur.execute(
            """
            select process_id, process_code, process_name, active
            from processes
            order by process_code
            """
        )
        rows = cur.fetchall()

    return [_serialize_process(row) for row in rows]


@router.post("/processes")
def create_process(payload: ProcessCreate):
    code = require_non_empty_string(payload.process_code, "process_code is required")
    name = require_non_empty_string(payload.process_name, "process_name is required")
    active = bool_or_default(payload.is_active, default=True)

    with db_cursor() as (conn, cur):
        cur.execute("select process_id from processes where process_code = %s", (code,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="process_code must be unique")

        cur.execute(
            """
            insert into processes (process_code, process_name, active)
            values (%s, %s, %s)
            returning process_id, process_code, process_name, active
            """,
            (code, name, active),
        )
        new_row = cur.fetchone()
        conn.commit()
        return _serialize_process(new_row)


@router.put("/processes/{process_id}")
def update_process(process_id: int, payload: ProcessUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    with db_cursor() as (conn, cur):
        cur.execute(
            "select process_id, process_code from processes where process_id = %s",
            (process_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Process not found")

        set_clauses = []
        params = []

        if "process_code" in update_fields:
            new_code = require_non_empty_string(
                update_fields["process_code"],
                "process_code is required",
            )
            cur.execute(
                "select 1 from processes where process_code = %s and process_id <> %s",
                (new_code, process_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="process_code must be unique")
            set_clauses.append("process_code = %s")
            params.append(new_code)

        if "process_name" in update_fields:
            new_name = require_non_empty_string(
                update_fields["process_name"],
                "process_name is required",
            )
            set_clauses.append("process_name = %s")
            params.append(new_name)

        if "is_active" in update_fields:
            set_clauses.append("active = %s")
            params.append(update_fields["is_active"])

        set_clauses.append("updated_at = now()")

        sql = f"""
            update processes
            set {', '.join(set_clauses)}
            where process_id = %s
            returning process_id, process_code, process_name, active
        """
        params.append(process_id)
        cur.execute(sql, tuple(params))
        updated = cur.fetchone()
        conn.commit()

        return _serialize_process(updated)
