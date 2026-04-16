import io

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook

from constants import ALLOWED_UNITS
from database import get_connection
from schemas.semi_finished import SemiFinishedUpdate
from utils.units import normalize_unit


router = APIRouter()


@router.get("/semi-finished")
def get_semi_finished():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select
            semi_finished_id,
            semi_finished_code,
            semi_finished_name,
            unit,
            degas_days,
            active
        from semi_finished
        order by semi_finished_code
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "semi_finished_id": row[0],
                "semi_finished_code": row[1],
                "semi_finished_name": row[2],
                "unit": row[3],
                "unit_of_measure": row[3],
                "degas_days": row[4],
                "is_active": bool(row[5]),
            }
        )

    return result


@router.get("/semi-finished/import-template")
def get_semi_finished_import_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "semi_finished"
    headers = ["semi_finished_code", "semi_finished_name", "unit_of_measure", "degas_days", "is_active"]
    ws.append(headers)
    ws.append(["SF-EXAMPLE", "РџСЂРёРјРµСЂ РїРѕР»СѓС„Р°Р±СЂРёРєР°С‚Р°", ALLOWED_UNITS[0], 0, "Р”Р°"])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="semi_finished_import_template.xlsx"'},
    )


@router.post("/semi-finished/import")
def import_semi_finished(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="РўСЂРµР±СѓРµС‚СЃСЏ С„Р°Р№Р» .xlsx")

    try:
        wb = load_workbook(file.file)
    except Exception:
        raise HTTPException(status_code=400, detail="РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ Excel-С„Р°Р№Р»")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows or len(rows) < 2:
        raise HTTPException(status_code=400, detail="Р¤Р°Р№Р» РЅРµ СЃРѕРґРµСЂР¶РёС‚ РґР°РЅРЅС‹С…")

    header = [str(h).strip() if h else "" for h in rows[0]]
    expected_header = ["semi_finished_code", "semi_finished_name", "unit_of_measure", "degas_days", "is_active"]
    if [h.lower() for h in header] != expected_header:
        raise HTTPException(status_code=400, detail="РќРµРІРµСЂРЅС‹Р№ Р·Р°РіРѕР»РѕРІРѕРє С„Р°Р№Р»Р°")

    seen_codes = set()
    items = []
    errors = []

    def normalize_bool(val):
        if val is None:
            return None
        if isinstance(val, bool):
            return val
        s = str(val).strip().lower()
        if s in ["РґР°", "yes", "true", "1"]:
            return True
        if s in ["РЅРµС‚", "no", "false", "0"]:
            return False
        return None

    for idx, row in enumerate(rows[1:], start=2):
        code_raw, name_raw, unit_raw, degas_raw, active_raw = row[:5]

        if all(
            (cell is None or (isinstance(cell, str) and cell.strip() == ""))
            for cell in (code_raw, name_raw, unit_raw, active_raw)
        ):
            continue

        row_errors = []
        code = (code_raw or "").strip()
        name = (name_raw or "").strip()

        try:
            unit = normalize_unit(unit_raw)
        except HTTPException as e:
            unit = None
            row_errors.append(e.detail)

        degas_days = 0
        if degas_raw not in (None, ""):
            try:
                degas_days = int(degas_raw)
                if degas_days < 0:
                    raise ValueError()
            except Exception:
                row_errors.append("degas_days РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹Рј С†РµР»С‹Рј")

        active = normalize_bool(active_raw)

        if not code:
            row_errors.append("РЅРµ Р·Р°РїРѕР»РЅРµРЅ semi_finished_code")
        if code in seen_codes:
            row_errors.append("РґСѓР±Р»РёСЂСѓСЋС‰РёР№СЃСЏ semi_finished_code РІ С„Р°Р№Р»Рµ")
        if not name:
            row_errors.append("РЅРµ Р·Р°РїРѕР»РЅРµРЅ semi_finished_name")
        if unit is None:
            row_errors.append("РЅРµРґРѕРїСѓСЃС‚РёРјР°СЏ РµРґРёРЅРёС†Р° РёР·РјРµСЂРµРЅРёСЏ (СЂР°Р·СЂРµС€РµРЅРѕ: РјВІ РёР»Рё Рј.Рї.)")
        if active is None:
            row_errors.append("РЅРµРґРѕРїСѓСЃС‚РёРјРѕРµ Р·РЅР°С‡РµРЅРёРµ is_active (РёСЃРїРѕР»СЊР·СѓР№С‚Рµ Р”Р°/РќРµС‚)")

        if row_errors:
            errors.append({"row": idx, "errors": row_errors})
        else:
            seen_codes.add(code)
            items.append(
                {
                    "semi_finished_code": code,
                    "semi_finished_name": name,
                    "unit_of_measure": unit,
                    "degas_days": degas_days,
                    "is_active": active,
                }
            )

    created = 0
    updated = 0

    if items:
        conn = get_connection()
        cur = conn.cursor()
        try:
            for item in items:
                cur.execute(
                    "select semi_finished_id, degas_days from semi_finished where semi_finished_code = %s",
                    (item["semi_finished_code"],),
                )
                row = cur.fetchone()
                if row:
                    cur.execute(
                        """
                        update semi_finished
                        set semi_finished_name = %s,
                            unit = %s,
                            degas_days = %s,
                            active = %s,
                            updated_at = now()
                        where semi_finished_id = %s
                        """,
                        (
                            item["semi_finished_name"],
                            item["unit_of_measure"],
                            item["degas_days"],
                            item["is_active"],
                            row[0],
                        ),
                    )
                    updated += 1
                else:
                    cur.execute(
                        """
                        insert into semi_finished
                            (semi_finished_code, semi_finished_name, unit, degas_days, active)
                        values (%s, %s, %s, %s, %s)
                        """,
                        (
                            item["semi_finished_code"],
                            item["semi_finished_name"],
                            item["unit_of_measure"],
                            item["degas_days"],
                            item["is_active"],
                        ),
                    )
                    created += 1
            conn.commit()
        finally:
            cur.close()
            conn.close()

    return {
        "processed": len(items),
        "created_count": created,
        "updated_count": updated,
        "error_count": len(errors),
        "errors": errors,
    }


@router.put("/semi-finished/{semi_finished_code}")
def update_semi_finished(semi_finished_code: str, payload: SemiFinishedUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    if "unit_of_measure" in update_fields:
        update_fields["unit_of_measure"] = normalize_unit(update_fields["unit_of_measure"])

    if "degas_days" in update_fields:
        try:
            if update_fields["degas_days"] is None:
                raise ValueError()
            update_fields["degas_days"] = int(update_fields["degas_days"])
            if update_fields["degas_days"] < 0:
                raise ValueError()
        except Exception:
            raise HTTPException(status_code=400, detail="РќРµРґРѕРїСѓСЃС‚РёРјРѕРµ Р·РЅР°С‡РµРЅРёРµ degas_days (С†РµР»РѕРµ РЅРµРѕС‚СЂРёС†Р°С‚РµР»СЊРЅРѕРµ)")

    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "select semi_finished_id from semi_finished where semi_finished_code = %s",
            (semi_finished_code,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Semi-finished not found")
        semi_finished_id = row[0]

        set_clauses = []
        params = []

        if "semi_finished_name" in update_fields:
            set_clauses.append("semi_finished_name = %s")
            params.append(update_fields["semi_finished_name"])

        if "unit_of_measure" in update_fields:
            set_clauses.append("unit = %s")
            params.append(update_fields["unit_of_measure"])

        if "is_active" in update_fields:
            set_clauses.append("active = %s")
            params.append(update_fields["is_active"])

        if "degas_days" in update_fields:
            set_clauses.append("degas_days = %s")
            params.append(update_fields["degas_days"])

        set_clauses.append("updated_at = now()")

        if len(params) == 0:
            return {"status": "no_changes"}

        sql = f"""
            update semi_finished
            set {', '.join(set_clauses)}
            where semi_finished_id = %s
            returning
                semi_finished_id,
                semi_finished_code,
                semi_finished_name,
                unit,
                degas_days,
                active
        """
        params.append(semi_finished_id)
        cur.execute(sql, tuple(params))
        updated = cur.fetchone()
        conn.commit()

        return {
            "semi_finished_id": updated[0],
            "semi_finished_code": updated[1],
            "semi_finished_name": updated[2],
            "unit": updated[3],
            "unit_of_measure": updated[3],
            "degas_days": updated[4],
            "is_active": bool(updated[5]),
        }
    finally:
        cur.close()
        conn.close()
