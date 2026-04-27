"""PDF 파싱 서비스 — PyMuPDF + Claude OCR"""

import base64
import fitz  # PyMuPDF
import anthropic

from ..config import settings


def extract_text_from_pdf(file_bytes: bytes) -> dict:
    """PDF에서 텍스트 추출"""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return {"pages": pages, "full_text": "\n".join(pages), "page_count": len(pages)}


async def ocr_invoice(file_bytes: bytes) -> dict:
    """Proforma Invoice OCR — Claude API"""
    b64 = base64.standard_b64encode(file_bytes).decode()

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "application/pdf", "data": b64}},
                {"type": "text", "text": """이 PDF는 Proforma Invoice입니다. 다음 JSON으로 추출:
{
  "invoiceNo": "", "date": "YYYYMMDD", "vendorName": "", "vendorCode": "",
  "currency": "", "items": [{"description":"","prodCode":"","qty":0,"unitPrice":0,"amount":0}],
  "supplyAmount": 0, "vatAmount": 0, "totalAmount": 0
}
JSON만 반환."""},
            ],
        }],
    )
    import json
    text = msg.content[0].text
    json_match = text[text.find("{"):text.rfind("}") + 1]
    return json.loads(json_match)


async def ocr_receipt(file_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """영수증 OCR — Claude API"""
    b64 = base64.standard_b64encode(file_bytes).decode()

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    msg = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                {"type": "text", "text": """영수증 정보를 JSON으로 추출:
{"date":"YYYYMMDD","storeName":"","category":"식비/교통비/사무용품/접대비/기타",
 "items":[{"name":"","qty":0,"price":0}],"totalAmount":0,"paymentMethod":"카드/현금"}
JSON만 반환."""},
            ],
        }],
    )
    import json
    text = msg.content[0].text
    json_match = text[text.find("{"):text.rfind("}") + 1]
    return json.loads(json_match)
