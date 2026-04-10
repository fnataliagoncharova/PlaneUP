from fastapi import FastAPI
from db import get_connection

app = FastAPI(title="PlaneUP API")


@app.get("/")
def root():
    return {"message": "PlaneUP backend is running"}


@app.get("/health/db")
def health_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("select current_database();")
    result = cur.fetchone()
    cur.close()
    conn.close()

    return {"database": result[0]}

@app.get("/products")
def get_products():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        select product_id, product_code, product_name
        from products
        order by product_code
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "product_id": row[0],
            "product_code": row[1],
            "product_name": row[2],
        })

    return result

@app.get("/semi-finished")
def get_semi_finished():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        select semi_finished_id, semi_finished_code, semi_finished_name
        from semi_finished
        order by semi_finished_code
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "semi_finished_id": row[0],
            "semi_finished_code": row[1],
            "semi_finished_name": row[2],
        })

    return result

@app.get("/routes")
def get_routes():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        select route_id, route_code, route_name
        from routes
        order by route_code
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "route_id": row[0],
            "route_code": row[1],
            "route_name": row[2],
        })

    return result

@app.get("/sales-plan")
def get_sales_plan():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
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
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "sales_plan_id": row[0],
            "period": row[1],
            "product_code": row[2],
            "product_name": row[3],
            "qty": float(row[4]),
            "due_date": str(row[5]) if row[5] else None,
        })

    return result

@app.get("/production-need")
def get_production_need():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
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
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "production_need_id": row[0],
            "period": row[1],
            "product_code": row[2],
            "product_name": row[3],
            "sales_plan_qty": float(row[4]),
            "safety_stock_qty": float(row[5]),
            "stock_qty": float(row[6]),
            "required_qty": float(row[7]),
        })

    return result

@app.get("/semi-finished-need")
def get_semi_finished_need():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
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
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "semi_finished_need_id": row[0],
            "period": row[1],
            "product_code": row[2],
            "product_name": row[3],
            "semi_finished_code": row[4],
            "semi_finished_name": row[5],
            "required_product_qty": float(row[6]),
            "required_semi_finished_qty": float(row[7]),
            "source_component_id": row[8],
        })

    return result

@app.get("/production-orders")
def get_production_orders():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
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
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "order_id": row[0],
            "route_code": row[1],
            "step_no": row[2],
            "output_semi_finished_code": row[3],
            "planned_qty": float(row[4]),
            "status": row[5],
            "product_code": row[6],
        })

    return result


@app.get("/products/{product_code}/structure")
def get_product_structure(product_code: str):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        select
            p.product_code,
            p.product_name,
            sf.semi_finished_code,
            sf.semi_finished_name,
            c.component_qty,
            c.product_qty,
            c.priority,
            r.route_code,
            r.route_name
        from products p
        join product_semi_finished_components c
            on c.product_id = p.product_id
        join semi_finished sf
            on sf.semi_finished_id = c.semi_finished_id
        join routes r
            on r.route_id = c.route_id
        where p.product_code = %s
        order by c.priority
    """, (product_code,))

    rows = cur.fetchall()

    cur.close()
    conn.close()

    if not rows:
        return {"error": "Product not found"}

    result = {
        "product_code": rows[0][0],
        "product_name": rows[0][1],
        "components": []
    }

    for row in rows:
        result["components"].append({
            "semi_finished_code": row[2],
            "semi_finished_name": row[3],
            "component_qty": float(row[4]),
            "product_qty": float(row[5]),
            "priority": row[6],
            "route_code": row[7],
            "route_name": row[8],
        })

    return result