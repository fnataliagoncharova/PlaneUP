from typing import Optional

from pydantic import BaseModel


class RouteCreate(BaseModel):
    route_code: str
    route_name: str
    is_active: Optional[bool] = True


class RouteUpdate(BaseModel):
    route_code: Optional[str] = None
    route_name: Optional[str] = None
    is_active: Optional[bool] = None


class RouteStepCreate(BaseModel):
    process_id: int
    notes: Optional[str] = None


class RouteStepUpdate(BaseModel):
    process_id: Optional[int] = None
    notes: Optional[str] = None
    step_no: Optional[int] = None
