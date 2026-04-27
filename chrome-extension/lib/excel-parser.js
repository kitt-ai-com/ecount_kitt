/**
 * 엑셀 파서 — PG사/카페24/급여/은행 엑셀 파싱
 * SheetJS(xlsx) 기반, webpack 번들링 필요
 */

import * as XLSX from 'xlsx';

/**
 * 엑셀 파일 파싱 (범용)
 * @param {ArrayBuffer} buffer
 * @returns {{ headers: string[], rows: object[], sheetName: string }}
 */
export function parseExcelBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = raw[0].map(String);
  const rows = raw.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
    return obj;
  });
  return { headers, rows, sheetName };
}

/**
 * INICIS PG 정산 엑셀 파싱
 * 컬럼: 거래일자, 승인번호, 카드사, 결제금액, 수수료, 정산금액, 상점명 등
 */
export function parseINICIS(buffer) {
  const { headers, rows } = parseExcelBuffer(buffer);
  return rows.map(r => ({
    date: formatDate(r['거래일자'] || r['정산일자'] || r['매출일자'] || ''),
    approvalNo: r['승인번호'] || '',
    cardCompany: r['카드사'] || '',
    amount: parseAmount(r['결제금액'] || r['거래금액'] || r['매출금액'] || 0),
    fee: parseAmount(r['수수료'] || r['PG수수료'] || 0),
    settleAmount: parseAmount(r['정산금액'] || r['입금금액'] || 0),
    pgName: 'INICIS',
    remarks: `INICIS ${r['승인번호'] || ''}`,
  }));
}

/**
 * 네이버페이 정산 엑셀 파싱
 */
export function parseNaverPay(buffer) {
  const { headers, rows } = parseExcelBuffer(buffer);
  return rows.map(r => ({
    date: formatDate(r['결제일'] || r['주문일'] || r['정산예정일'] || ''),
    orderNo: r['주문번호'] || '',
    productName: r['상품명'] || '',
    amount: parseAmount(r['결제금액'] || r['상품금액'] || 0),
    fee: parseAmount(r['수수료'] || r['네이버페이수수료'] || 0),
    settleAmount: parseAmount(r['정산금액'] || 0),
    pgName: '네이버페이',
    remarks: `네이버페이 ${r['주문번호'] || ''}`,
  }));
}

/**
 * 카페24 주문 엑셀 파싱
 */
export function parseCafe24Orders(buffer) {
  const { headers, rows } = parseExcelBuffer(buffer);
  return rows.map(r => ({
    orderNo: r['주문번호'] || '',
    orderDate: formatDate(r['주문일시'] || r['주문일'] || ''),
    productName: r['상품명'] || '',
    optionName: r['옵션정보'] || r['옵션'] || '',
    qty: Number(r['수량'] || 1),
    amount: parseAmount(r['결제금액'] || r['판매금액'] || r['상품금액'] || 0),
    buyerName: r['주문자명'] || r['주문자'] || '',
    receiverName: r['수령자명'] || r['수령자'] || '',
    address: r['배송지'] || r['주소'] || '',
    phone: r['연락처'] || r['수령자연락처'] || '',
    zipCode: r['우편번호'] || '',
    memo: r['배송메모'] || r['배송메시지'] || '',
  }));
}

/**
 * 급여대장 엑셀 파싱
 */
export function parsePayroll(buffer) {
  const { headers, rows } = parseExcelBuffer(buffer);
  return rows.map(r => ({
    employeeName: r['성명'] || r['직원명'] || r['이름'] || '',
    employeeNo: r['사번'] || '',
    department: r['부서'] || '',
    basePay: parseAmount(r['기본급'] || 0),
    overtimePay: parseAmount(r['시간외수당'] || r['연장근로수당'] || 0),
    bonus: parseAmount(r['상여'] || r['상여금'] || 0),
    totalPay: parseAmount(r['총지급액'] || r['지급합계'] || 0),
    incomeTax: parseAmount(r['소득세'] || 0),
    localTax: parseAmount(r['주민세'] || r['지방소득세'] || 0),
    nationalPension: parseAmount(r['국민연금'] || 0),
    healthInsurance: parseAmount(r['건강보험'] || 0),
    employmentInsurance: parseAmount(r['고용보험'] || 0),
    totalDeduction: parseAmount(r['공제합계'] || r['총공제액'] || 0),
    netPay: parseAmount(r['실지급액'] || r['차인지급액'] || 0),
    bankName: r['은행명'] || r['은행'] || '',
    accountNo: r['계좌번호'] || '',
    email: r['이메일'] || '',
  }));
}

/**
 * 은행 입금내역 엑셀 파싱
 */
export function parseBankDeposits(buffer) {
  const { headers, rows } = parseExcelBuffer(buffer);
  return rows.map(r => ({
    date: formatDate(r['거래일자'] || r['거래일'] || r['입금일'] || ''),
    description: r['적요'] || r['내용'] || r['거래내용'] || '',
    amount: parseAmount(r['입금액'] || r['입금'] || r['금액'] || 0),
    balance: parseAmount(r['잔액'] || 0),
    counterpart: r['상대계좌'] || r['상대'] || r['거래처'] || '',
    memo: r['메모'] || r['비고'] || '',
  }));
}

/**
 * 파일 유형 자동 감지
 */
export function detectFileType(headers) {
  const h = headers.join(' ').toLowerCase();
  if (h.includes('승인번호') && (h.includes('카드사') || h.includes('inicis'))) return 'inicis';
  if (h.includes('네이버페이') || h.includes('npay')) return 'naverpay';
  if (h.includes('주문번호') && h.includes('배송')) return 'cafe24';
  if (h.includes('기본급') || h.includes('급여') || h.includes('실지급액')) return 'payroll';
  if (h.includes('입금액') || h.includes('적요') || h.includes('잔액')) return 'bank';
  return 'generic';
}

// ── 유틸리티 ──

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }
  return String(val).replace(/[-/.]/g, '').slice(0, 8);
}

function parseAmount(val) {
  if (typeof val === 'number') return Math.round(val);
  return Math.round(Number(String(val).replace(/[^0-9.-]/g, '')) || 0);
}
