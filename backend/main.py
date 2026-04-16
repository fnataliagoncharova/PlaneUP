from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import get_connection
from routers import (
    planning_router,
    processes_router,
    products_router,
    routes_router,
    semi_finished_router,
)


app = FastAPI(title="PlaneUP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


app.include_router(products_router)
app.include_router(semi_finished_router)
app.include_router(processes_router)
app.include_router(routes_router)
app.include_router(planning_router)
