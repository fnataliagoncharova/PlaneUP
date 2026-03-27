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