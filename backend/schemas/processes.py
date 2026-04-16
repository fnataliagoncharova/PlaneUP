from typing import Optional

from pydantic import BaseModel


class ProcessCreate(BaseModel):
    process_code: str
    process_name: str
    is_active: Optional[bool] = True


class ProcessUpdate(BaseModel):
    process_code: Optional[str] = None
    process_name: Optional[str] = None
    is_active: Optional[bool] = None
