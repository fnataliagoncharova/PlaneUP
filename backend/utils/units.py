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
            detail=f"РќРµРґРѕРїСѓСЃС‚РёРјР°СЏ РµРґРёРЅРёС†Р° РёР·РјРµСЂРµРЅРёСЏ. Р”РѕРїСѓСЃС‚РёРјС‹Рµ Р·РЅР°С‡РµРЅРёСЏ: {', '.join(ALLOWED_UNITS)}",
        )

    def clean(s: str) -> str:
        return re.sub(r"[\s\.]+", "", s.lower())

    cleaned = clean(str(value))

    m2_aliases = [
        "Рј2",
        "Рј^2",
        "РјВІ",
        "Рј 2",
        "РєРІ.Рј",
        "РєРІ Рј",
        "РєРІР°РґСЂР°С‚РЅС‹Р№ РјРµС‚СЂ",
        "РєРІР°РґСЂР°С‚РЅС‹Рµ РјРµС‚СЂС‹",
        "РєРІР°РґСЂР°С‚РЅС‹Р№",
        "РєРІР°РґСЂР°С‚РЅС‹Рµ",
        "Рј РєРІ",
    ]
    mp_aliases = [
        "Рј",
        "Рј.Рї.",
        "РјРї",
        "Рј Рї",
        "РїРѕРі.Рј",
        "РїРѕРі Рј",
        "РїРѕРіРѕРЅРЅС‹Р№ РјРµС‚СЂ",
        "РїРѕРіРѕРЅРЅС‹Рµ РјРµС‚СЂС‹",
        "РїРѕРіРѕРЅРЅС‹Р№",
        "РїРѕРіРѕРЅРЅС‹Рµ",
        "РїРј",
        "РјРїРѕРі",
        "Рј РїРѕРі",
    ]

    m2_variants = {clean(a) for a in m2_aliases}
    mp_variants = {clean(a) for a in mp_aliases}

    if cleaned in m2_variants:
        return ALLOWED_UNITS[0]
    if cleaned in mp_variants:
        return ALLOWED_UNITS[1]

    raise HTTPException(
        status_code=400,
        detail=f"РќРµРґРѕРїСѓСЃС‚РёРјР°СЏ РµРґРёРЅРёС†Р° РёР·РјРµСЂРµРЅРёСЏ. Р”РѕРїСѓСЃС‚РёРјС‹Рµ Р·РЅР°С‡РµРЅРёСЏ: {', '.join(ALLOWED_UNITS)}",
    )
