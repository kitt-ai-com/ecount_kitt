/**
 * AI OCR — Claude API 기반 문서 구조화
 * PDF/이미지 → 구조화된 JSON 데이터 추출
 */

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

/**
 * 이미지/PDF를 Claude로 OCR 처리
 * @param {string} base64 - 파일 base64
 * @param {string} mediaType - MIME type
 * @param {string} prompt - 추출 지시 프롬프트
 * @param {string} apiKey - Anthropic API 키
 */
export async function performOCR(base64, mediaType, prompt, apiKey) {
  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Claude API 오류: ${err.error?.message || res.statusText}`);
  }

  const result = await res.json();
  return result.content?.[0]?.text || '';
}

/**
 * Proforma Invoice OCR
 */
export async function ocrInvoice(base64, mediaType, apiKey) {
  const prompt = `이 PDF/이미지는 Proforma Invoice(견적송장)입니다.
다음 정보를 JSON으로 추출해주세요:

{
  "invoiceNo": "인보이스 번호",
  "date": "YYYYMMDD 형식 날짜",
  "vendorName": "공급자/판매자 이름",
  "vendorCode": "거래처 코드 (없으면 빈 문자열)",
  "currency": "통화 (USD/KRW/CNY 등)",
  "items": [
    {
      "description": "품목 설명",
      "prodCode": "제품 코드 (없으면 빈 문자열)",
      "qty": 수량(숫자),
      "unitPrice": 단가(숫자),
      "amount": 금액(숫자)
    }
  ],
  "supplyAmount": 공급가액(숫자),
  "vatAmount": 부가세(숫자),
  "totalAmount": 합계금액(숫자)
}

JSON만 반환하세요.`;

  const text = await performOCR(base64, mediaType, prompt, apiKey);
  return extractJSON(text);
}

/**
 * 영수증 OCR
 */
export async function ocrReceipt(base64, mediaType, apiKey) {
  const prompt = `이 이미지는 영수증/거래명세서입니다.
다음 정보를 JSON으로 추출해주세요:

{
  "date": "YYYYMMDD 형식 날짜",
  "storeName": "가맹점명",
  "category": "식비/교통비/사무용품/접대비/통신비/기타 중 하나",
  "items": [
    { "name": "품목명", "qty": 수량, "price": 금액 }
  ],
  "totalAmount": 합계금액(숫자),
  "paymentMethod": "카드/현금/계좌이체",
  "cardNo": "카드번호 뒷4자리 (있으면)"
}

JSON만 반환하세요.`;

  const text = await performOCR(base64, mediaType, prompt, apiKey);
  return extractJSON(text);
}

/**
 * 카톡 주문 텍스트 파싱 (LLM)
 */
export async function parseKakaoOrder(text, apiKey) {
  const prompt = `다음은 카카오톡으로 받은 B2B 주문 메시지입니다.
이를 이카운트 ERP 판매입력 양식으로 변환해주세요.

주문 메시지:
${text}

다음 JSON 배열로 반환:
[
  {
    "customerName": "거래처명",
    "prodCode": "제품코드 (추정)",
    "prodName": "제품명",
    "qty": 수량(숫자),
    "unitPrice": 단가(숫자, 모르면 0),
    "amount": 금액(숫자, 모르면 0),
    "deliveryAddress": "배송지",
    "memo": "비고"
  }
]

JSON만 반환하세요.`;

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const result = await res.json();
  const responseText = result.content?.[0]?.text || '';
  return extractJSON(responseText);
}

// ── 유틸 ──

function extractJSON(text) {
  // 코드블록 내 JSON
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) {
    return JSON.parse(codeBlock[1].trim());
  }
  // 직접 JSON
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  throw new Error('JSON 추출 실패');
}
