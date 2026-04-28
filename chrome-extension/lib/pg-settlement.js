/**
 * PG정산 처리 모듈 — 이니시스 정산 파싱, ECOUNT 매출 대사, 회계 분개
 */

import * as XLSX from 'xlsx';

// ── 이니시스 정산 엑셀 파싱 ──

/**
 * 이니시스 PG 정산 엑셀 파싱
 * 컬럼: 지급일, 승인일, 주문번호, 거래금액, 수수료, 부가세, 지급액
 * @param {ArrayBuffer} buffer
 * @returns {{ rows: PGSettlementRow[], summary: Object }}
 */
export function parseINICISSettlement(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // 헤더 행 찾기 (지급일, 승인일, 주문번호 포함)
  let headerIdx = -1;
  const headerKeywords = ['지급일', '주문번호', '거래금액'];
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i].map(c => String(c).trim());
    if (headerKeywords.every(kw => row.some(c => c.includes(kw)))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    // 컬럼명이 다를 수 있음 — fallback으로 첫 행 사용
    headerIdx = 0;
  }

  const headers = raw[headerIdx].map(c => normalizeHeader(String(c).trim()));
  const rows = [];

  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i];
    if (!r || r.length === 0) continue;

    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] ?? ''; });

    // 합계/요약/계 행 스킵
    const firstCell = String(r[0] || '').trim();
    if (firstCell.includes('요약') || firstCell.includes('합계') || firstCell.endsWith('계')) continue;
    // 빈 주문번호 행도 스킵 (소계 행)
    const orderNo = findValue(obj, ['주문번호', '주문No', 'ORDER_NO']);
    if (!orderNo) continue;

    const row = {
      paymentDate: formatDate(findValue(obj, ['지급일', '정산일', '입금일', '지급예정일'])),
      approvalDate: formatDate(findValue(obj, ['승인일', '거래일', '매출일'])),
      orderNo: String(orderNo).trim(),
      transactionAmount: parseAmount(findValue(obj, ['거래금액', '매출금액', '결제금액', '거래액'])),
      fee: parseAmount(findValue(obj, ['수수료', 'PG수수료', '결제수수료'])),
      feeVat: parseAmount(findValue(obj, ['부가세', '수수료부가세', 'VAT'])),
      netAmount: parseAmount(findValue(obj, ['지급액', '정산금액', '입금액', '지급금액'])),
    };

    // 지급액이 없으면 계산
    if (!row.netAmount && row.transactionAmount) {
      row.netAmount = row.transactionAmount - row.fee - row.feeVat;
    }

    // 환불 여부 (음수 거래금액)
    row.isRefund = row.transactionAmount < 0;

    rows.push(row);
  }

  // 요약 통계
  const summary = {
    totalCount: rows.length,
    totalTransactionAmount: rows.reduce((s, r) => s + r.transactionAmount, 0),
    totalFee: rows.reduce((s, r) => s + r.fee, 0),
    totalFeeVat: rows.reduce((s, r) => s + r.feeVat, 0),
    totalNetAmount: rows.reduce((s, r) => s + r.netAmount, 0),
    refundCount: rows.filter(r => r.isRefund).length,
    refundAmount: rows.filter(r => r.isRefund).reduce((s, r) => s + r.transactionAmount, 0),
    dateRange: getDateRange(rows),
  };

  return { rows, summary, headers: SETTLEMENT_HEADERS };
}

const SETTLEMENT_HEADERS = ['지급일', '승인일', '주문번호', '거래금액', '수수료', '부가세', '지급액', '환불'];

// ── ECOUNT 매출 대사 (Reconciliation) ──

/**
 * PG정산 데이터와 ECOUNT 매출 데이터 대사
 * @param {PGSettlementRow[]} pgRows - PG 정산 데이터
 * @param {Object[]} ecountRows - ECOUNT 매출전표 데이터 (API 조회 결과)
 * @returns {ReconciliationResult}
 */
export function reconcile(pgRows, ecountRows) {
  const result = {
    matched: [],       // PG + ECOUNT 모두 있음
    pgOnly: [],        // PG에만 있음 (ECOUNT 미등록)
    ecountOnly: [],    // ECOUNT에만 있음 (PG 정산 없음)
    amountMismatch: [], // 매칭되었지만 금액 불일치
    summary: {},
  };

  // ECOUNT 데이터를 주문번호 기준 맵 생성
  const ecountMap = new Map();
  for (const row of ecountRows) {
    const key = normalizeOrderNo(row.orderNo || row.ORDER_NO || row.SLIP_NO || '');
    if (key) {
      if (!ecountMap.has(key)) {
        ecountMap.set(key, []);
      }
      ecountMap.get(key).push(row);
    }
  }

  // PG 기준 매칭
  const matchedEcountKeys = new Set();
  for (const pg of pgRows) {
    const pgKey = normalizeOrderNo(pg.orderNo);
    const ecountMatches = ecountMap.get(pgKey);

    if (ecountMatches && ecountMatches.length > 0) {
      const ec = ecountMatches[0];
      const ecAmount = parseAmount(ec.taxableAmount || ec.SUPPLY_AMT || ec.PRICE || 0);
      const diff = pg.transactionAmount - ecAmount;

      if (Math.abs(diff) <= 1) {
        result.matched.push({ pg, ecount: ec, diff: 0 });
      } else {
        result.amountMismatch.push({ pg, ecount: ec, diff });
      }
      matchedEcountKeys.add(pgKey);
    } else {
      result.pgOnly.push(pg);
    }
  }

  // ECOUNT에만 있는 건
  for (const [key, rows] of ecountMap) {
    if (!matchedEcountKeys.has(key)) {
      result.ecountOnly.push(...rows);
    }
  }

  // 요약
  result.summary = {
    totalPG: pgRows.length,
    totalEcount: ecountRows.length,
    matched: result.matched.length,
    pgOnly: result.pgOnly.length,
    ecountOnly: result.ecountOnly.length,
    amountMismatch: result.amountMismatch.length,
    matchRate: pgRows.length > 0
      ? Math.round((result.matched.length / pgRows.length) * 100) : 0,
    pgTotalAmount: pgRows.reduce((s, r) => s + r.transactionAmount, 0),
    ecountTotalAmount: ecountRows.reduce((s, r) =>
      s + parseAmount(r.taxableAmount || r.SUPPLY_AMT || r.PRICE || 0), 0),
  };
  result.summary.amountDiff = result.summary.pgTotalAmount - result.summary.ecountTotalAmount;

  return result;
}

// ── 회계 분개 생성 ──

/**
 * PG정산 데이터 → 회계 분개 전표 생성
 * 분개 패턴:
 *   [정산일] DR 보통예금(지급액) + DR PG수수료(수수료) + DR 부가세대급금(부가세)
 *           CR 매출(거래금액)
 *   [환불 시] DR 매출(거래금액)  CR 보통예금(지급액) + CR PG수수료(수수료) + CR 부가세대급금(부가세)
 *
 * @param {PGSettlementRow[]} rows
 * @param {Object} accountCodes - 계정과목 코드
 * @returns {JournalEntry[]}
 */
export function generateJournalEntries(rows, accountCodes = {}) {
  const codes = {
    bankDeposit: accountCodes.bankDeposit || '1110101',      // 보통예금
    pgFee: accountCodes.pgFee || '5230501',                   // 지급수수료
    inputVat: accountCodes.inputVat || '1350101',             // 부가세대급금
    sales: accountCodes.sales || '4010101',                    // 상품매출
    salesReturn: accountCodes.salesReturn || '4010201',       // 매출환입
    ...accountCodes,
  };

  // 지급일 기준 그룹핑
  const groups = groupByDate(rows, 'paymentDate');
  const entries = [];

  for (const [date, dateRows] of Object.entries(groups)) {
    const salesRows = dateRows.filter(r => !r.isRefund);
    const refundRows = dateRows.filter(r => r.isRefund);

    // 정상 매출 분개
    if (salesRows.length > 0) {
      const totalTx = salesRows.reduce((s, r) => s + r.transactionAmount, 0);
      const totalFee = salesRows.reduce((s, r) => s + r.fee, 0);
      const totalVat = salesRows.reduce((s, r) => s + r.feeVat, 0);
      const totalNet = salesRows.reduce((s, r) => s + r.netAmount, 0);

      entries.push({
        date,
        type: 'sale',
        description: `PG정산 이니시스 ${salesRows.length}건 (${date})`,
        orderCount: salesRows.length,
        debit: [
          { account: codes.bankDeposit, accountName: '보통예금', amount: totalNet },
          { account: codes.pgFee, accountName: '지급수수료', amount: totalFee },
          { account: codes.inputVat, accountName: '부가세대급금', amount: totalVat },
        ],
        credit: [
          { account: codes.sales, accountName: '상품매출', amount: totalTx },
        ],
        orders: salesRows.map(r => r.orderNo),
      });
    }

    // 환불 분개
    if (refundRows.length > 0) {
      const totalTx = Math.abs(refundRows.reduce((s, r) => s + r.transactionAmount, 0));
      const totalFee = Math.abs(refundRows.reduce((s, r) => s + r.fee, 0));
      const totalVat = Math.abs(refundRows.reduce((s, r) => s + r.feeVat, 0));
      const totalNet = Math.abs(refundRows.reduce((s, r) => s + r.netAmount, 0));

      entries.push({
        date,
        type: 'refund',
        description: `PG환불 이니시스 ${refundRows.length}건 (${date})`,
        orderCount: refundRows.length,
        debit: [
          { account: codes.salesReturn, accountName: '매출환입', amount: totalTx },
        ],
        credit: [
          { account: codes.bankDeposit, accountName: '보통예금', amount: totalNet },
          { account: codes.pgFee, accountName: '지급수수료', amount: totalFee },
          { account: codes.inputVat, accountName: '부가세대급금', amount: totalVat },
        ],
        orders: refundRows.map(r => r.orderNo),
      });
    }
  }

  return entries;
}

/**
 * 분개 전표를 ECOUNT API 요청 형식으로 변환
 * @param {JournalEntry[]} entries
 * @returns {Object[]} ECOUNT SaveSlip 요청 배열
 */
export function toEcountSlipRequests(entries) {
  return entries.map(entry => ({
    SlipList: [
      ...entry.debit.map(d => ({
        IO_DATE: entry.date,
        ACCT_CODE: d.account,
        DR_AMT: d.amount,
        CR_AMT: 0,
        REMARKS: entry.description,
      })),
      ...entry.credit.map(c => ({
        IO_DATE: entry.date,
        ACCT_CODE: c.account,
        DR_AMT: 0,
        CR_AMT: c.amount,
        REMARKS: entry.description,
      })),
    ],
  }));
}

// ── ECOUNT 화면 데이터 파싱 ──

/**
 * ECOUNT 화면에서 추출한 테이블 데이터를 정규화
 * (content script의 extractTableData 결과를 파싱)
 * @param {Object[]} tableData - extractTableData 결과
 * @returns {Object[]} 정규화된 매출 데이터
 */
export function parseEcountTableData(tableData) {
  return tableData
    .filter(row => {
      // 소계/합계 행 제외
      const firstVal = Object.values(row)[0] || '';
      return !firstVal.includes('합계') && !firstVal.includes('요약') && !firstVal.endsWith('계');
    })
    .map(row => ({
      issueDate: formatDate(row['발행일'] || row['전표일자'] || ''),
      orderDate: formatDate(row['주문일'] || row['거래일'] || ''),
      orderNo: String(row['주문번호'] || row['전표번호'] || '').trim(),
      taxableAmount: parseAmount(row['과세매출'] || row['합계 : 과세매출'] || row['공급가액'] || 0),
      cardAmount: parseAmount(row['신용카드매출전표'] || row['합계 : 신용카드매출전표'] || 0),
      cashReceiptAmount: parseAmount(row['현금영수증'] || row['합계 : 현금영수증'] || 0),
      otherAmount: parseAmount(row['기타'] || row['합계 : 기타'] || 0),
    }))
    .filter(row => row.orderNo);
}

/**
 * PG 정산 데이터에서 ECOUNT 매출전표 등록용 데이터 생성
 * @param {PGSettlementRow[]} rows
 * @param {Object} defaults - 기본값 (거래처코드, 품목코드 등)
 * @returns {Object[]} ECOUNT SaveSale 요청 배열
 */
export function toSaleSlipRequests(rows, defaults = {}) {
  return rows
    .filter(r => !r.isRefund)
    .map(row => ({
      SaleList: [{
        IO_DATE: row.approvalDate || row.paymentDate,
        CUST_CODE: defaults.custCode || '',
        PROD_CODE: defaults.prodCode || '',
        QTY: 1,
        PRICE: row.transactionAmount,
        SUPPLY_AMT: Math.round(row.transactionAmount / 1.1),
        VAT_AMT: row.transactionAmount - Math.round(row.transactionAmount / 1.1),
        REMARKS: `이니시스 PG ${row.orderNo}`,
        SLIP_NO: row.orderNo,
      }],
    }));
}

// ── 유틸리티 ──

function normalizeHeader(h) {
  return h.replace(/\s+/g, ' ')
    .replace(/합계\s*[:：]\s*/g, '')
    .trim();
}

function findValue(obj, keys) {
  for (const k of keys) {
    for (const [objKey, val] of Object.entries(obj)) {
      if (objKey.includes(k) || k.includes(objKey)) return val;
    }
  }
  return '';
}

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
  const str = String(val).replace(/[^0-9.\-]/g, '');
  return Math.round(Number(str) || 0);
}

function normalizeOrderNo(no) {
  return String(no).replace(/[-\s]/g, '').trim();
}

function getDateRange(rows) {
  const dates = rows.map(r => r.paymentDate || r.approvalDate).filter(Boolean).sort();
  return { from: dates[0] || '', to: dates[dates.length - 1] || '' };
}

function groupByDate(rows, dateField) {
  const groups = {};
  for (const row of rows) {
    const date = row[dateField] || 'unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(row);
  }
  return groups;
}
