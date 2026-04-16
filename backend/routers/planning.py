import datetime
from typing import List

from fastapi import APIRouter, HTTPException

from database import get_connection
from schemas.planning import SalesPlanItem


router = APIRouter()


@router.get("/sales-plan")
def get_sales_plan():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select
            sp.sales_plan_id,
            sp.period,
            p.product_code,
            p.product_name,
            sp.qty,
            sp.due_date
        from sales_plan sp
        join products p on p.product_id = sp.product_id
        order by sp.period, p.product_code
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "sales_plan_id": row[0],
                "period": row[1],
                "product_code": row[2],
                "product_name": row[3],
                "qty": float(row[4]),
                "due_date": str(row[5]) if row[5] else None,
            }
        )

    return result


@router.post("/sales-plan")
def save_sales_plan(items: List[SalesPlanItem]):
    if not items:
        return {"status": "empty", "inserted": 0}

    conn = get_connection()
    cur = conn.cursor()

    try:
        periods = {item.period for item in items}
        for period in periods:
            cur.execute("delete from sales_plan where period = %s", (period,))

        for item in items:
            cur.execute("select product_id from products where product_code = %s", (item.product_code,))
            product_row = cur.fetchone()
            if not product_row:
                raise HTTPException(status_code=400, detail=f"Unknown product_code: {item.product_code}")

            due_date_val = None
            if item.due_date:
                try:
                    due_date_val = datetime.date.fromisoformat(item.due_date)
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid due_date: {item.due_date}")

            cur.execute(
                """
                insert into sales_plan (product_id, period, qty, due_date)
                values (%s, %s, %s, %s)
                """,
                (product_row[0], item.period, item.qty, due_date_val),
            )

        conn.commit()
        return {"status": "ok", "inserted": len(items), "periods": list(periods)}
    finally:
        cur.close()
        conn.close()


@router.get("/production-need")
def get_production_need():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select
            pn.production_need_id,
            pn.period,
            p.product_code,
            p.product_name,
            pn.sales_plan_qty,
            pn.safety_stock_qty,
            pn.stock_qty,
            pn.required_qty
        from production_need pn
        join products p on p.product_id = pn.product_id
        order by pn.period, p.product_code
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "production_need_id": row[0],
                "period": row[1],
                "product_code": row[2],
                "product_name": row[3],
                "sales_plan_qty": float(row[4]),
                "safety_stock_qty": float(row[5]),
                "stock_qty": float(row[6]),
                "required_qty": float(row[7]),
            }
        )

    return result


@router.get("/semi-finished-need")
def get_semi_finished_need():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select
            sfn.semi_finished_need_id,
            sfn.period,
            p.product_code,
            p.product_name,
            sf.semi_finished_code,
            sf.semi_finished_name,
            sfn.required_product_qty,
            sfn.required_semi_finished_qty,
            sfn.source_component_id
        from semi_finished_need sfn
        join products p on p.product_id = sfn.source_product_id
        join semi_finished sf on sf.semi_finished_id = sfn.semi_finished_id
        order by sfn.period, p.product_code, sf.semi_finished_code
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "semi_finished_need_id": row[0],
                "period": row[1],
                "product_code": row[2],
                "product_name": row[3],
                "semi_finished_code": row[4],
                "semi_finished_name": row[5],
                "required_product_qty": float(row[6]),
                "required_semi_finished_qty": float(row[7]),
                "source_component_id": row[8],
            }
        )

    return result


@router.get("/production-orders")
def get_production_orders():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        select
            po.order_id,
            r.route_code,
            po.step_no,
            sf_out.semi_finished_code,
            po.planned_qty,
            po.status,
            p.product_code
        from production_orders po
        join routes r on r.route_id = po.route_id
        join semi_finished sf_out on sf_out.semi_finished_id = po.output_semi_finished_id
        join semi_finished_need sfn on sfn.semi_finished_need_id = po.source_need_id
        join products p on p.product_id = sfn.source_product_id
        order by po.order_id
    """
    )

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "order_id": row[0],
                "route_code": row[1],
                "step_no": row[2],
                "output_semi_finished_code": row[3],
                "planned_qty": float(row[4]),
                "status": row[5],
                "product_code": row[6],
            }
        )

    return result
