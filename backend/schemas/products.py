from datetime import date
from typing import Optional

from pydantic import BaseModel


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    is_active: Optional[bool] = None


class ProductComponentCreate(BaseModel):
    semi_finished_id: int
    route_id: int
    component_qty: float
    product_qty: float
    priority: int = 1
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    active: bool = True


class ProductComponentUpdate(BaseModel):
    semi_finished_id: Optional[int] = None
    route_id: Optional[int] = None
    component_qty: Optional[float] = None
    product_qty: Optional[float] = None
    priority: Optional[int] = None
    valid_from: Optional[date] = None
    valid_to: Optional[date] = None
    active: Optional[bool] = None
