import io

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from psycopg2 import IntegrityError, errorcodes

from constants import ALLOWED_UNITS
from schemas.products import ProductComponentCreate, ProductComponentUpdate, ProductUpdate
from utils.db import db_cursor
from utils.excel import (
    build_import_response,
    is_blank_excel_row,
    normalize_excel_bool,
    read_excel_rows,
)
from utils.units import normalize_unit


router = APIRouter()


def _serialize_product(row):
    return {
        "product_id": row[0],
        "product_code": row[1],
        "product_name": row[2],
        "unit_of_measure": row[3],
        "is_active": bool(row[4]),
    }


def _serialize_product_component(row):
    return {
        "component_id": row[0],
        "product_id": row[1],
        "semi_finished_id": row[2],
        "semi_finished_code": row[3],
        "semi_finished_name": row[4],
        "route_id": row[5],
        "route_code": row[6],
        "route_name": row[7],
        "component_qty": float(row[8]),
        "product_qty": float(row[9]),
        "priority": row[10],
        "valid_from": str(row[11]) if row[11] else None,
        "valid_to": str(row[12]) if row[12] else None,
        "active": bool(row[13]),
    }


def _serialize_structure_component(component):
    return {
        "semi_finished_code": component["semi_finished_code"],
        "semi_finished_name": component["semi_finished_name"],
        "component_qty": component["component_qty"],
        "product_qty": component["product_qty"],
        "priority": component["priority"],
        "route_code": component["route_code"],
        "route_name": component["route_name"],
    }


def _get_product_row(cur, product_code: str):
    cur.execute(
        """
        select product_id, product_code, product_name
        from products
        where product_code = %s
        """,
        (product_code,),
    )
    return cur.fetchone()


def _get_product_components(cur, product_id: int):
    cur.execute(
        """
        select
            c.component_id,
            c.product_id,
            c.semi_finished_id,
            sf.semi_finished_code,
            sf.semi_finished_name,
            c.route_id,
            r.route_code,
            r.route_name,
            c.component_qty,
            c.product_qty,
            c.priority,
            c.valid_from,
            c.valid_to,
            c.active
        from product_semi_finished_components c
        join semi_finished sf on sf.semi_finished_id = c.semi_finished_id
        join routes r on r.route_id = c.route_id
        where c.product_id = %s
        order by c.priority, c.component_id
        """,
        (product_id,),
    )
    return [_serialize_product_component(row) for row in cur.fetchall()]


def _get_product_component(cur, product_id: int, component_id: int):
    cur.execute(
        """
        select
            c.component_id,
            c.product_id,
            c.semi_finished_id,
            sf.semi_finished_code,
            sf.semi_finished_name,
            c.route_id,
            r.route_code,
            r.route_name,
            c.component_qty,
            c.product_qty,
            c.priority,
            c.valid_from,
            c.valid_to,
            c.active
        from product_semi_finished_components c
        join semi_finished sf on sf.semi_finished_id = c.semi_finished_id
        join routes r on r.route_id = c.route_id
        where c.product_id = %s and c.component_id = %s
        """,
        (product_id, component_id),
    )
    row = cur.fetchone()
    return _serialize_product_component(row) if row else None


def _get_product_component_state(cur, product_id: int, component_id: int):
    cur.execute(
        """
        select
            component_id,
            semi_finished_id,
            route_id,
            component_qty,
            product_qty,
            priority,
            valid_from,
            valid_to,
            active
        from product_semi_finished_components
        where product_id = %s and component_id = %s
        """,
        (product_id, component_id),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "component_id": row[0],
        "semi_finished_id": row[1],
        "route_id": row[2],
        "component_qty": row[3],
        "product_qty": row[4],
        "priority": row[5],
        "valid_from": row[6],
        "valid_to": row[7],
        "active": row[8],
    }


def _ensure_semi_finished_exists(cur, semi_finished_id: int):
    cur.execute(
        "select 1 from semi_finished where semi_finished_id = %s",
        (semi_finished_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="Unknown semi_finished_id")


def _ensure_route_exists(cur, route_id: int):
    cur.execute(
        "select 1 from routes where route_id = %s",
        (route_id,),
    )
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="Unknown route_id")


def _validate_component_values(cur, values):
    if values["semi_finished_id"] is None:
        raise HTTPException(status_code=400, detail="semi_finished_id is required")
    if values["route_id"] is None:
        raise HTTPException(status_code=400, detail="route_id is required")
    if values["component_qty"] is None or values["component_qty"] <= 0:
        raise HTTPException(status_code=400, detail="component_qty must be > 0")
    if values["product_qty"] is None or values["product_qty"] <= 0:
        raise HTTPException(status_code=400, detail="product_qty must be > 0")
    if values["priority"] is None or int(values["priority"]) < 1:
        raise HTTPException(status_code=400, detail="priority must be >= 1")
    if values["valid_from"] and values["valid_to"] and values["valid_to"] < values["valid_from"]:
        raise HTTPException(status_code=400, detail="valid_to must be >= valid_from")
    if values["active"] is None:
        raise HTTPException(status_code=400, detail="active is required")

    _ensure_semi_finished_exists(cur, values["semi_finished_id"])
    _ensure_route_exists(cur, values["route_id"])


@router.get("/products")
def get_products():
    with db_cursor() as (_, cur):
        cur.execute(
            """
            select
                product_id,
                product_code,
                product_name,
                coalesce(unit_of_measure, unit) as unit_of_measure,
                coalesce(is_active, active, true) as is_active
            from products
            order by product_code
            """
        )
        rows = cur.fetchall()

    return [_serialize_product(row) for row in rows]


@router.put("/products/{product_code}")
def update_product(product_code: str, payload: ProductUpdate):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    with db_cursor() as (conn, cur):
        cur.execute(
            "select product_id from products where product_code = %s",
            (product_code,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Product not found")
        product_id = row[0]

        set_clauses = []
        params = []

        if "product_name" in update_fields:
            set_clauses.append("product_name = %s")
            params.append(update_fields["product_name"])

        if "unit_of_measure" in update_fields:
            update_fields["unit_of_measure"] = normalize_unit(update_fields["unit_of_measure"])
            set_clauses.append("unit_of_measure = %s")
            params.append(update_fields["unit_of_measure"])
            set_clauses.append("unit = %s")
            params.append(update_fields["unit_of_measure"])

        if "is_active" in update_fields:
            set_clauses.append("is_active = %s")
            params.append(update_fields["is_active"])
            set_clauses.append("active = %s")
            params.append(update_fields["is_active"])

        set_clauses.append("updated_at = now()")

        if len(params) == 0:
            return {"status": "no_changes"}

        sql = f"""
            update products
            set {', '.join(set_clauses)}
            where product_id = %s
            returning
                product_id,
                product_code,
                product_name,
                coalesce(unit_of_measure, unit) as unit_of_measure,
                coalesce(is_active, active, true) as is_active
        """
        params.append(product_id)
        cur.execute(sql, tuple(params))
        updated = cur.fetchone()
        conn.commit()

        return _serialize_product(updated)


@router.get("/products/import-template")
def get_products_import_template():
    wb = Workbook()
    ws = wb.active
    ws.title = "products"
    headers = ["product_code", "product_name", "unit_of_measure", "is_active"]
    ws.append(headers)
    ws.append(["P-EXAMPLE", "Пример продукции", ALLOWED_UNITS[0], "Да"])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="products_import_template.xlsx"'},
    )


@router.post("/products/import")
def import_products(file: UploadFile = File(...)):
    expected_header = ["product_code", "product_name", "unit_of_measure", "is_active"]
    rows = read_excel_rows(file, expected_header)

    seen_codes = set()
    items = []
    errors = []

    for idx, row in enumerate(rows[1:], start=2):
        product_code, product_name, unit_of_measure, is_active_raw = row[:4]

        if is_blank_excel_row((product_code, product_name, unit_of_measure, is_active_raw)):
            continue
        row_errors = []

        code = (product_code or "").strip()
        name = (product_name or "").strip()
        try:
            unit = normalize_unit(unit_of_measure)
        except HTTPException:
            unit = None
        active_val = normalize_excel_bool(is_active_raw)

        if not code:
            row_errors.append("не заполнен product_code")
        if code in seen_codes:
            row_errors.append("дублирующийся product_code в файле")
        if not name:
            row_errors.append("не заполнен product_name")
        if unit is None:
            row_errors.append("недопустимая единица измерения (разрешено: м² или м.п.)")
        if active_val is None:
            row_errors.append("недопустимое значение is_active (используйте Да/Нет)")

        if row_errors:
            errors.append({"row": idx, "errors": row_errors})
        else:
            seen_codes.add(code)
            items.append(
                {
                    "product_code": code,
                    "product_name": name,
                    "unit_of_measure": unit,
                    "is_active": active_val,
                }
            )

    created = 0
    updated = 0

    if items:
        with db_cursor() as (conn, cur):
            for item in items:
                cur.execute(
                    "select product_id from products where product_code = %s",
                    (item["product_code"],),
                )
                row = cur.fetchone()
                if row:
                    cur.execute(
                        """
                        update products
                        set product_name = %s,
                            unit_of_measure = %s,
                            unit = %s,
                            is_active = %s,
                            active = %s,
                            updated_at = now()
                        where product_id = %s
                        """,
                        (
                            item["product_name"],
                            item["unit_of_measure"],
                            item["unit_of_measure"],
                            item["is_active"],
                            item["is_active"],
                            row[0],
                        ),
                    )
                    updated += 1
                else:
                    cur.execute(
                        """
                        insert into products
                            (product_code, product_name, unit_of_measure, is_active, unit, active)
                        values (%s, %s, %s, %s, %s, %s)
                        """,
                        (
                            item["product_code"],
                            item["product_name"],
                            item["unit_of_measure"],
                            item["is_active"],
                            item["unit_of_measure"],
                            item["is_active"],
                        ),
                    )
                    created += 1
            conn.commit()

    return build_import_response(
        processed_count=len(items),
        created_count=created,
        updated_count=updated,
        errors=errors,
    )


@router.get("/products/{product_code}/components")
def get_product_component_list(product_code: str):
    with db_cursor() as (_, cur):
        product_row = _get_product_row(cur, product_code)
        if not product_row:
            raise HTTPException(status_code=404, detail="Product not found")

        components = _get_product_components(cur, product_row[0])

    return {
        "product_id": product_row[0],
        "product_code": product_row[1],
        "product_name": product_row[2],
        "components": components,
    }


@router.post("/products/{product_code}/components")
def create_product_component(product_code: str, payload: ProductComponentCreate):
    values = payload.dict()

    with db_cursor() as (conn, cur):
        product_row = _get_product_row(cur, product_code)
        if not product_row:
            raise HTTPException(status_code=404, detail="Product not found")

        _validate_component_values(cur, values)

        cur.execute(
            """
            insert into product_semi_finished_components (
                product_id,
                semi_finished_id,
                route_id,
                component_qty,
                product_qty,
                priority,
                valid_from,
                valid_to,
                active
            )
            values (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            returning component_id
            """,
            (
                product_row[0],
                values["semi_finished_id"],
                values["route_id"],
                values["component_qty"],
                values["product_qty"],
                values["priority"],
                values["valid_from"],
                values["valid_to"],
                values["active"],
            ),
        )
        component_id = cur.fetchone()[0]
        conn.commit()

        created = _get_product_component(cur, product_row[0], component_id)
        return created


@router.put("/products/{product_code}/components/{component_id}")
def update_product_component(
    product_code: str,
    component_id: int,
    payload: ProductComponentUpdate,
):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        return {"status": "no_changes"}

    with db_cursor() as (conn, cur):
        product_row = _get_product_row(cur, product_code)
        if not product_row:
            raise HTTPException(status_code=404, detail="Product not found")

        current = _get_product_component_state(cur, product_row[0], component_id)
        if not current:
            raise HTTPException(status_code=404, detail="Product component not found")

        merged_values = {
            "semi_finished_id": update_fields.get("semi_finished_id", current["semi_finished_id"]),
            "route_id": update_fields.get("route_id", current["route_id"]),
            "component_qty": update_fields.get("component_qty", current["component_qty"]),
            "product_qty": update_fields.get("product_qty", current["product_qty"]),
            "priority": update_fields.get("priority", current["priority"]),
            "valid_from": update_fields.get("valid_from", current["valid_from"]),
            "valid_to": update_fields.get("valid_to", current["valid_to"]),
            "active": update_fields.get("active", current["active"]),
        }
        _validate_component_values(cur, merged_values)

        set_clauses = []
        params = []
        for field in [
            "semi_finished_id",
            "route_id",
            "component_qty",
            "product_qty",
            "priority",
            "valid_from",
            "valid_to",
            "active",
        ]:
            if field in update_fields:
                set_clauses.append(f"{field} = %s")
                params.append(update_fields[field])

        if not set_clauses:
            return {"status": "no_changes"}

        params.extend([product_row[0], component_id])
        cur.execute(
            f"""
            update product_semi_finished_components
            set {', '.join(set_clauses)}, updated_at = now()
            where product_id = %s and component_id = %s
            """,
            tuple(params),
        )
        conn.commit()

        updated = _get_product_component(cur, product_row[0], component_id)
        return updated


@router.delete("/products/{product_code}/components/{component_id}")
def delete_product_component(product_code: str, component_id: int):
    with db_cursor() as (conn, cur):
        product_row = _get_product_row(cur, product_code)
        if not product_row:
            raise HTTPException(status_code=404, detail="Product not found")

        current = _get_product_component_state(cur, product_row[0], component_id)
        if not current:
            raise HTTPException(status_code=404, detail="Product component not found")

        try:
            cur.execute(
                """
                delete from product_semi_finished_components
                where product_id = %s and component_id = %s
                """,
                (product_row[0], component_id),
            )
        except IntegrityError as exc:
            conn.rollback()
            if exc.pgcode == errorcodes.FOREIGN_KEY_VIOLATION:
                raise HTTPException(
                    status_code=400,
                    detail="Product component cannot be deleted because it is used in dependent data",
                ) from exc
            raise

        conn.commit()
        return {"status": "deleted"}


@router.get("/products/{product_code}/structure")
def get_product_structure(product_code: str):
    with db_cursor() as (_, cur):
        product_row = _get_product_row(cur, product_code)
        if not product_row:
            return {"error": "Product not found"}

        components = _get_product_components(cur, product_row[0])

    if not components:
        return {"error": "Product not found"}

    return {
        "product_code": product_row[1],
        "product_name": product_row[2],
        "components": [_serialize_structure_component(component) for component in components],
    }


@router.get("/products/{product_code}/needs")
def get_product_needs(product_code: str):
    with db_cursor() as (_, cur):
        cur.execute(
            """
            select
                pn.period,
                pn.required_qty
            from production_need pn
            join products p on p.product_id = pn.product_id
            where p.product_code = %s
            """,
            (product_code,),
        )

        prod_need_row = cur.fetchone()

        cur.execute(
            """
            select
                sf.semi_finished_code,
                sf.semi_finished_name,
                sfn.required_semi_finished_qty
            from semi_finished_need sfn
            join products p on p.product_id = sfn.source_product_id
            join semi_finished sf on sf.semi_finished_id = sfn.semi_finished_id
            where p.product_code = %s
            order by sf.semi_finished_code
            """,
            (product_code,),
        )

        sf_rows = cur.fetchall()

    if not prod_need_row:
        return {"error": "Product not found or no needs"}

    result = {
        "product_code": product_code,
        "production_need": {"period": prod_need_row[0], "required_qty": float(prod_need_row[1])},
        "semi_finished_needs": [],
    }

    for row in sf_rows:
        result["semi_finished_needs"].append(
            {
                "semi_finished_code": row[0],
                "semi_finished_name": row[1],
                "required_qty": float(row[2]),
            }
        )

    return result


@router.get("/products/{product_code}/orders")
def get_product_orders(product_code: str):
    with db_cursor() as (_, cur):
        cur.execute(
            """
            select
                po.order_id,
                r.route_code,
                r.route_name,
                po.step_no,
                sf.semi_finished_code,
                sf.semi_finished_name,
                po.planned_qty,
                po.status
            from production_orders po
            join routes r on r.route_id = po.route_id
            join semi_finished sf on sf.semi_finished_id = po.output_semi_finished_id
            join semi_finished_need sfn on sfn.semi_finished_need_id = po.source_need_id
            join products p on p.product_id = sfn.source_product_id
            where p.product_code = %s
            order by po.order_id
            """,
            (product_code,),
        )

        rows = cur.fetchall()

    if not rows:
        return {"error": "Product not found or no orders"}

    result = {"product_code": product_code, "orders": []}

    for row in rows:
        result["orders"].append(
            {
                "order_id": row[0],
                "route_code": row[1],
                "route_name": row[2],
                "step_no": row[3],
                "output_semi_finished_code": row[4],
                "output_semi_finished_name": row[5],
                "planned_qty": float(row[6]),
                "status": row[7],
            }
        )

    return result


@router.get("/products/{product_code}/actuals")
def get_product_actuals(product_code: str):
    with db_cursor() as (_, cur):
        cur.execute(
            """
            select
                pa.actual_id,
                r.route_code,
                po.step_no,
                sf.semi_finished_code,
                sf.semi_finished_name,
                pa.fact_qty,
                pa.scrap_qty,
                pa.fact_start,
                pa.fact_finish
            from production_actuals pa
            join production_orders po on po.order_id = pa.order_id
            join routes r on r.route_id = po.route_id
            join semi_finished sf on sf.semi_finished_id = po.output_semi_finished_id
            join semi_finished_need sfn on sfn.semi_finished_need_id = po.source_need_id
            join products p on p.product_id = sfn.source_product_id
            where p.product_code = %s
            order by pa.actual_id
            """,
            (product_code,),
        )

        rows = cur.fetchall()

    result = {"product_code": product_code, "actuals": []}

    for row in rows:
        result["actuals"].append(
            {
                "actual_id": row[0],
                "route_code": row[1],
                "step_no": row[2],
                "output_semi_finished_code": row[3],
                "output_semi_finished_name": row[4],
                "fact_qty": float(row[5]),
                "scrap_qty": float(row[6]),
                "fact_start": str(row[7]) if row[7] else None,
                "fact_finish": str(row[8]) if row[8] else None,
            }
        )

    return result
