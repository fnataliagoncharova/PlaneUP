from typing import Optional

from pydantic import BaseModel


class SemiFinishedUpdate(BaseModel):
    semi_finished_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    is_active: Optional[bool] = None
    degas_days: Optional[int] = None
