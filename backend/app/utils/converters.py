from decimal import Decimal
from typing import Optional


def convert_targets(targets) -> Optional[list]:
    """Decimal을 float로 변환하여 JSON 직렬화 가능하게 함. 빈 항목(가격/수량 없음) 필터링."""
    if not targets:
        return None
    result = []
    for t in targets:
        item = t.model_dump() if hasattr(t, 'model_dump') else t
        # 빈 항목 필터링 (가격과 수량 둘 다 있어야 유효)
        if not item.get('price') or not item.get('quantity'):
            continue
        result.append({
            k: float(v) if isinstance(v, Decimal) else v
            for k, v in item.items()
        })
    return result if result else None
