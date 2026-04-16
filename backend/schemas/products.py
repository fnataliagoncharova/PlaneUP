from typing import Optional

from pydantic import BaseModel


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    is_active: Optional[bool] = None
