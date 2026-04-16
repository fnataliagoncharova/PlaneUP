from fastapi import APIRouter, HTTPException
from psycopg2 import IntegrityError, errorcodes

from constants import ROUTE_STEP_DELETE_BLOCKED_MESSAGE
from database import get_connection
from schemas.routes import RouteCreate, RouteStepCreate, RouteStepUpdate, RouteUpdate


router = APIRouter()


@router.get("/routes")
def get_routes():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select route_id, route_code, route_name, active
        from routes
        order by route_code
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "route_id": row[0],
                "route_code": row[1],
                "route_name": row[2],
                "is_active": bool(row[3]),
            }
        )

    return result


@router.post("/routes")
def create_route(payload: RouteCreate):
    code = (payload.route_code or "").strip()
    name = (payload.route_name or "").strip()
    active = bool(payload.is_active) if payload.is_active is not None else True

    if not code:
        raise HTTPException(status_code=400, detail="route_code is required")
    if not name:
        raise HTTPException(status_code=400, detail="route_name is required")

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("select route_id from routes where route_code = %s", (code,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="route_code must be unique")

        cur.execute(
            """
            insert into routes (route_code, route_name, active)
            values (%s, %s, %s)
            returning route_id, route_code, route_name, active
            """,
            (code, name, active),
        )
        new_row = cur.fetchone()
        conn.commit()
        return {
            "route_id": new_row[0],
            "route_code": new_row[1],
            "route_name": new_row[2],
            "is_active": bool(new_row[3]),
        }
    finally:
        cur.close()
        conn.close()


@router.put("/routes/{route_id}")
def update_route(route_id: int, payload: RouteUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("select route_id, route_code from routes where route_id = %s", (route_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Route not found")

        set_clauses = []
        params = []

        if "route_code" in update_fields:
            new_code = (update_fields["route_code"] or "").strip()
            if not new_code:
                raise HTTPException(status_code=400, detail="route_code is required")
            cur.execute(
                "select 1 from routes where route_code = %s and route_id <> %s",
                (new_code, route_id),
            )
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="route_code must be unique")
            set_clauses.append("route_code = %s")
            params.append(new_code)

        if "route_name" in update_fields:
            new_name = (update_fields["route_name"] or "").strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="route_name is required")
            set_clauses.append("route_name = %s")
            params.append(new_name)

        if "is_active" in update_fields:
            set_clauses.append("active = %s")
            params.append(update_fields["is_active"])

        set_clauses.append("updated_at = now()")

        sql = f"""
            update routes
            set {', '.join(set_clauses)}
            where route_id = %s
            returning route_id, route_code, route_name, active
        """
        params.append(route_id)
        cur.execute(sql, tuple(params))
        updated = cur.fetchone()
        conn.commit()

        return {
            "route_id": updated[0],
            "route_code": updated[1],
            "route_name": updated[2],
            "is_active": bool(updated[3]),
        }
    finally:
        cur.close()
        conn.close()


@router.get("/routes/{route_id}/steps")
def get_route_steps(route_id: int):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        select
            rs.route_step_id,
            rs.step_no,
            rs.process_id,
            p.process_code,
            p.process_name,
            coalesce(rs.notes, '')
        from route_steps rs
        join routes r on r.route_id = rs.route_id
        join processes p on p.process_id = rs.process_id
        where rs.route_id = %s
        order by rs.step_no
        """,
        (route_id,),
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return [
        {
            "route_step_id": r[0],
            "step_no": r[1],
            "process_id": r[2],
            "process_code": r[3],
            "process_name": r[4],
            "notes": r[5],
        }
        for r in rows
    ]


@router.post("/routes/{route_id}/steps")
def add_route_step(route_id: int, payload: RouteStepCreate):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("select route_id from routes where route_id = %s", (route_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Route not found")

        cur.execute("select process_id, process_code, process_name from processes where process_id = %s", (payload.process_id,))
        proc_row = cur.fetchone()
        if not proc_row:
            raise HTTPException(status_code=400, detail="Unknown process_id")

        cur.execute(
            "select coalesce(max(step_no), 0) + 1 from route_steps where route_id = %s",
            (route_id,),
        )
        next_no = cur.fetchone()[0]

        cur.execute(
            """
            insert into route_steps (route_id, step_no, process_id, notes)
            values (%s, %s, %s, %s)
            returning route_step_id, step_no, process_id, notes
            """,
            (route_id, next_no, payload.process_id, payload.notes),
        )
        new_row = cur.fetchone()
        conn.commit()

        return {
            "route_step_id": new_row[0],
            "step_no": new_row[1],
            "process_id": new_row[2],
            "process_code": proc_row[1],
            "process_name": proc_row[2],
            "notes": new_row[3] or "",
        }
    finally:
        cur.close()
        conn.close()


@router.put("/route-steps/{route_step_id}")
def update_route_step(route_step_id: int, payload: RouteStepUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "select route_id, step_no, process_id, notes from route_steps where route_step_id = %s",
            (route_step_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Route step not found")
        route_id, old_step_no, old_process_id, old_notes = row

        if "process_id" in update_fields:
            cur.execute(
                "select process_code, process_name from processes where process_id = %s",
                (update_fields["process_id"],),
            )
            proc_row = cur.fetchone()
            if not proc_row:
                raise HTTPException(status_code=400, detail="Unknown process_id")
        else:
            cur.execute(
                "select process_code, process_name from processes where process_id = %s",
                (old_process_id,),
            )
            proc_row = cur.fetchone()

        if "step_no" in update_fields and update_fields["step_no"] is not None:
            new_no = int(update_fields["step_no"])
            if new_no < 1:
                raise HTTPException(status_code=400, detail="step_no must be >= 1")
            if new_no != old_step_no:
                if new_no < old_step_no:
                    cur.execute(
                        """
                        update route_steps
                        set step_no = step_no + 1
                        where route_id = %s and step_no >= %s and step_no < %s and route_step_id <> %s
                        """,
                        (route_id, new_no, old_step_no, route_step_id),
                    )
                else:
                    cur.execute(
                        """
                        update route_steps
                        set step_no = step_no - 1
                        where route_id = %s and step_no <= %s and step_no > %s and route_step_id <> %s
                        """,
                        (route_id, new_no, old_step_no, route_step_id),
                    )
                old_step_no = new_no

        set_clauses = []
        params = []

        if "process_id" in update_fields:
            set_clauses.append("process_id = %s")
            params.append(update_fields["process_id"])

        if "notes" in update_fields:
            set_clauses.append("notes = %s")
            params.append(update_fields["notes"])

        if "step_no" in update_fields and update_fields["step_no"] is not None:
            set_clauses.append("step_no = %s")
            params.append(update_fields["step_no"])

        if set_clauses:
            cur.execute(
                f"""
                update route_steps
                set {', '.join(set_clauses)}, updated_at = now()
                where route_step_id = %s
                returning route_step_id, step_no, process_id, notes
                """,
                tuple(params + [route_step_id]),
            )
            updated = cur.fetchone()
        else:
            updated = (route_step_id, old_step_no, old_process_id, old_notes)

        conn.commit()

        return {
            "route_step_id": updated[0],
            "step_no": updated[1],
            "process_id": updated[2],
            "process_code": proc_row[0],
            "process_name": proc_row[1],
            "notes": updated[3] or "",
        }
    finally:
        cur.close()
        conn.close()


@router.delete("/route-steps/{route_step_id}")
def delete_route_step(route_step_id: int):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "select route_id, step_no from route_steps where route_step_id = %s",
            (route_step_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Route step not found")
        route_id, step_no = row

        cur.execute(
            "select 1 from route_step_material_flow where route_id = %s and step_no = %s limit 1",
            (route_id, step_no),
        )
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=ROUTE_STEP_DELETE_BLOCKED_MESSAGE)

        cur.execute(
            "select 1 from production_orders where route_id = %s and step_no = %s limit 1",
            (route_id, step_no),
        )
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=ROUTE_STEP_DELETE_BLOCKED_MESSAGE)

        try:
            cur.execute("delete from route_steps where route_step_id = %s", (route_step_id,))
        except IntegrityError as exc:
            conn.rollback()
            if exc.pgcode == errorcodes.FOREIGN_KEY_VIOLATION:
                raise HTTPException(status_code=400, detail=ROUTE_STEP_DELETE_BLOCKED_MESSAGE) from exc
            raise

        conn.commit()
        return {"status": "deleted"}
    finally:
        cur.close()
        conn.close()
