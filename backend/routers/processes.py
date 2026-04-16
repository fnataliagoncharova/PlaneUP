from fastapi import APIRouter, HTTPException

from database import get_connection
from schemas.processes import ProcessCreate, ProcessUpdate


router = APIRouter()


@router.get("/processes")
def get_processes():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select process_id, process_code, process_name, active
        from processes
        order by process_code
        """
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return [
        {
            "process_id": row[0],
            "process_code": row[1],
            "process_name": row[2],
            "is_active": bool(row[3]),
        }
        for row in rows
    ]


@router.post("/processes")
def create_process(payload: ProcessCreate):
    code = (payload.process_code or "").strip()
    name = (payload.process_name or "").strip()
    active = bool(payload.is_active) if payload.is_active is not None else True

    if not code:
        raise HTTPException(status_code=400, detail="process_code is required")
    if not name:
        raise HTTPException(status_code=400, detail="process_name is required")

    conn = get_connection()
    cur = conn.cursor()
    try:
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
        return {
            "process_id": new_row[0],
            "process_code": new_row[1],
            "process_name": new_row[2],
            "is_active": bool(new_row[3]),
        }
    finally:
        cur.close()
        conn.close()


@router.put("/processes/{process_id}")
def update_process(process_id: int, payload: ProcessUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    conn = get_connection()
    cur = conn.cursor()
    try:
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
            new_code = (update_fields["process_code"] or "").strip()
            if not new_code:
                raise HTTPException(status_code=400, detail="process_code is required")
            cur.execute(
                "select 1 from processes where process_code = %s and process_id <> %s",
                (new_code, process_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="process_code must be unique")
            set_clauses.append("process_code = %s")
            params.append(new_code)

        if "process_name" in update_fields:
            new_name = (update_fields["process_name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="process_name is required")
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

        return {
            "process_id": updated[0],
            "process_code": updated[1],
            "process_name": updated[2],
            "is_active": bool(updated[3]),
        }
    finally:
        cur.close()
        conn.close()
