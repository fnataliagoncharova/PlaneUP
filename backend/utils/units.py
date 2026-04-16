import re
from typing import Optional

from fastapi import HTTPException

from constants import ALLOWED_UNITS


def normalize_unit(value: Optional[str]) -> str:
    """
    Normalize user-provided unit strings to canonical values.
    Returns one of ALLOWED_UNITS or raises HTTPException 400.
    """
    if value is None:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимая единица измерения. Допустимые значения: {', '.join(ALLOWED_UNITS)}",
        )

    def clean(s: str) -> str:
        return re.sub(r"[\s\.]+", "", s.lower())

    cleaned = clean(str(value))

    m2_aliases = [
        "м2",
        "м^2",
        "м²",
        "м 2",
        "кв.м",
        "кв м",
        "квадратный метр",
        "квадратные метры",
        "квадратный",
        "квадратные",
        "м кв",
    ]
    mp_aliases = [
        "м",
        "м.п.",
        "мп",
        "м п",
        "пог.м",
        "пог м",
        "погонный метр",
        "погонные метры",
        "погонный",
        "погонные",
        "пм",
        "мпог",
        "м пог",
    ]

    m2_variants = {clean(a) for a in m2_aliases}
    mp_variants = {clean(a) for a in mp_aliases}

    if cleaned in m2_variants:
        return ALLOWED_UNITS[0]
    if cleaned in mp_variants:
        return ALLOWED_UNITS[1]

    raise HTTPException(
        status_code=400,
        detail=f"Недопустимая единица измерения. Допустимые значения: {', '.join(ALLOWED_UNITS)}",
    )
