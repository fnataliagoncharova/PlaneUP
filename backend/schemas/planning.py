from typing import Optional

from pydantic import BaseModel


class SalesPlanItem(BaseModel):
    product_code: str
    period: str
    qty: float
    due_date: Optional[str] = None
