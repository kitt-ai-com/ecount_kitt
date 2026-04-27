"""Claude AI 서비스 — 카톡 주문 파싱, 단가 추천, 문서 분석"""

import json
import anthropic

from ..config import settings


async def parse_kakao_order(text: str) -> list[dict]:
    """카톡 주문 메시지 → 구조화된 주문 데이터"""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": f"""카카오톡 B2B 주문 메시지를 이카운트 ERP 판매입력 양식으로 변환하세요.

주문 메시지:
{text}

JSON 배열로 반환:
[{{"customerName":"거래처명","prodCode":"제품코드","prodName":"제품명",
   "qty":수량,"unitPrice":단가,"amount":금액,"deliveryAddress":"배송지","memo":"비고"}}]
JSON만 반환.""",
        }],
    )
    result_text = msg.content[0].text
    return _extract_json(result_text)


async def recommend_price(prod_code: str, cust_code: str, history: list[dict]) -> dict:
    """거래처별 단가 추천"""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""거래 이력을 분석하여 최적 단가를 추천하세요.

제품코드: {prod_code}
거래처코드: {cust_code}
거래 이력 (최근 10건):
{json.dumps(history, ensure_ascii=False)}

JSON으로 반환:
{{"recommendedPrice":추천단가,"reason":"추천근거","minPrice":최저가,"maxPrice":최고가,"avgPrice":평균가}}
JSON만 반환.""",
        }],
    )
    result_text = msg.content[0].text
    return _extract_json(result_text)


async def recommend_box(width: int, height: int, depth: int, qty: int, inventory: list[dict]) -> dict:
    """B2B 가견적 — 치수 기반 최적 박스 추천"""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{
            "role": "user",
            "content": f"""고객이 요청한 박스 치수에 맞는 최적 제품을 추천하세요.

요청 치수: {width}mm x {height}mm x {depth}mm
수량: {qty}개

보유 재고 목록:
{json.dumps(inventory, ensure_ascii=False)}

JSON으로 반환:
{{"recommendedProducts":[{{"prodCode":"","prodName":"","spec":"규격","unitPrice":단가,"qty":{qty},"amount":금액,"fitScore":적합도(1-10),"reason":"추천이유"}}],
 "totalAmount":합계금액,"note":"참고사항"}}
JSON만 반환.""",
        }],
    )
    result_text = msg.content[0].text
    return _extract_json(result_text)


async def detect_churn_risk(account_data: dict, history: list[dict]) -> dict:
    """거래처 이탈 예측"""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": f"""거래처의 이탈 위험을 분석하세요.

거래처 정보:
{json.dumps(account_data, ensure_ascii=False)}

최근 6개월 거래 이력:
{json.dumps(history, ensure_ascii=False)}

JSON으로 반환:
{{"riskLevel":"high/medium/low","riskScore":0-100,"reasons":["이유1","이유2"],"recommendation":"대응방안"}}
JSON만 반환.""",
        }],
    )
    result_text = msg.content[0].text
    return _extract_json(result_text)


def _extract_json(text: str):
    """텍스트에서 JSON 추출"""
    # 코드블록
    import re
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if match:
        return json.loads(match.group(1).strip())
    # 직접 JSON
    match = re.search(r"(\[[\s\S]*\]|\{[\s\S]*\})", text)
    if match:
        return json.loads(match.group(1))
    raise ValueError("JSON 추출 실패")
