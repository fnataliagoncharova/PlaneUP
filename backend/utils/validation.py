from fastapi import HTTPException


def require_non_empty_string(value, error_detail: str) -> str:
    normalized = (value or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail=error_detail)
    return normalized


def bool_or_default(value, default: bool = True) -> bool:
    return bool(value) if value is not None else default


def parse_non_negative_int(value) -> int:
    parsed = int(value)
    if parsed < 0:
        raise ValueError()
    return parsed
