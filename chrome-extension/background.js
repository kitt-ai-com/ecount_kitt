/**
 * Service Worker — CNC코리아 ERP 자동화 Chrome Extension
 */

const LOG = (...args) => console.log('[CNC-ERP]', ...args);

// 사이드패널 설정
chrome.sidePanel.setOptions({ enabled: true });
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ── 메시지 핸들러 ──

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'testConnection':
      handleTestConnection(msg).then(sendResponse);
      return true;

    case 'executeWorkflow':
      handleWorkflow(msg).then(sendResponse);
      return true;

    case 'parseFile':
      handleParseFile(msg).then(sendResponse);
      return true;

    case 'getStatus':
      sendResponse({ ready: true, version: chrome.runtime.getManifest().version });
      return false;

    case 'injectScript':
      handleInjectScript(msg, sender).then(sendResponse);
      return true;
  }
});

// ── 이카운트 API 연결 테스트 ──

async function handleTestConnection({ comCode, userId, apiCertKey }) {
  try {
    // Step 1: Zone 조회 — https://sboapi.ecount.com/OAPI/V2/Zone
    LOG('Zone 조회 시작:', comCode);
    const zoneRes = await fetch('https://sboapi.ecount.com/OAPI/V2/Zone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ COM_CODE: comCode }),
    });
    const zoneData = await zoneRes.json();
    LOG('Zone 응답:', JSON.stringify(zoneData));

    // Status가 숫자 200 또는 문자열 "200" 모두 허용
    const zoneStatus = String(zoneData.Status);
    if (zoneStatus !== '200') {
      return { success: false, error: `Zone 조회 실패 (Status=${zoneData.Status}): ${zoneData.Error?.Message || JSON.stringify(zoneData).slice(0, 200)}` };
    }

    // Zone 값 추출 — Data.ZONE 또는 Data.Datas.ZONE 또는 Data.DB_SHARD_NO 등 여러 위치 시도
    const dataObj = zoneData.Data?.Datas || zoneData.Data || {};
    const zone = dataObj.ZONE || dataObj.Zone || dataObj.zone
      || zoneData.Data?.ZONE || zoneData.Data?.Zone;

    if (!zone) {
      // Zone 값을 못 찾은 경우 전체 Data를 반환하여 디버깅
      return { success: false, error: `Zone 값을 찾을 수 없습니다. 응답 Data: ${JSON.stringify(zoneData.Data).slice(0, 300)}` };
    }

    // Step 2: 로그인 — https://sboapi{ZONE}.ecount.com/OAPI/V2/OAPILogin
    const baseUrl = `https://sboapi${zone}.ecount.com`;
    LOG('로그인 시도:', baseUrl, 'Zone:', zone);

    const loginRes = await fetch(`${baseUrl}/OAPI/V2/OAPILogin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        COM_CODE: comCode,
        USER_ID: userId,
        API_CERT_KEY: apiCertKey,
        LAN_TYPE: 'ko-KR',
        ZONE: zone,
      }),
    });
    const loginData = await loginRes.json();
    LOG('Login 응답:', JSON.stringify(loginData));

    const loginStatus = String(loginData.Status);
    if (loginStatus !== '200') {
      return { success: false, error: `로그인 실패 (Status=${loginData.Status}): ${loginData.Error?.Message || JSON.stringify(loginData).slice(0, 200)}` };
    }

    // 내부 에러 코드 확인 (Status=200이지만 Data.Code가 실패인 경우)
    // 성공 코드: "00" 또는 없음
    const loginInnerCode = String(loginData.Data?.Code ?? '');
    if (loginInnerCode && loginInnerCode !== '00') {
      const innerMsg = loginData.Data?.Message || loginData.Data?.Datas?.Message || '';
      if (innerMsg.includes('API_CERT_KEY')) {
        return { success: false, error: `API 인증키가 유효하지 않습니다.\n이카운트 → 시스템관리 → Open API 설정에서 인증키를 확인하세요.` };
      }
      if (innerMsg.includes('USER_ID') || innerMsg.includes('사용자')) {
        return { success: false, error: `사용자 ID가 유효하지 않습니다.` };
      }
      return { success: false, error: `로그인 실패 (Code=${loginInnerCode}): ${innerMsg || JSON.stringify(loginData.Data).slice(0, 200)}` };
    }

    // SESSION_ID 추출 — 여러 위치 시도
    const loginDataObj = loginData.Data?.Datas || loginData.Data || {};
    const sessionId = loginDataObj.SESSION_ID || loginDataObj.session_id;
    if (!sessionId) {
      return { success: false, error: `SESSION_ID 없음. 응답: ${JSON.stringify(loginData.Data).slice(0, 300)}` };
    }

    // 세션 저장
    await chrome.storage.local.set({
      ecount_session: { sessionId, zone, baseUrl, savedAt: Date.now() },
      ecount_credentials: { comCode, userId, apiCertKey },
    });

    LOG('연결 성공:', baseUrl, 'Zone:', zone);
    return { success: true, zone, baseUrl, sessionId };
  } catch (e) {
    LOG('연결 오류:', e.message, e.stack);
    return { success: false, error: `연결 오류: ${e.message}` };
  }
}

// ── 워크플로우 실행 ──

async function handleWorkflow({ workflowId, data }) {
  LOG(`워크플로우 실행: ${workflowId}`);
  try {
    const session = await getStoredSession();
    if (!session) return { success: false, error: '이카운트 연결이 필요합니다' };

    switch (workflowId) {
      case 'kakao-order':
        return await workflowKakaoOrder(session, data);
      case 'pg-to-sales':
        return await workflowPGToSales(session, data);
      case 'pg-settlement-register':
        return await workflowPGSettlementRegister(session, data);
      case 'pg-settlement-reconcile':
        return await workflowPGSettlementReconcile(session, data);
      case 'pg-settlement-accounting':
        return await workflowPGSettlementAccounting(session, data);
      case 'invoice-to-purchase':
        return await workflowInvoiceToPurchase(session, data);
      case 'quote-to-email':
        return await workflowQuoteToEmail(session, data);
      case 'cafe24-to-sales':
        return await workflowCafe24ToSales(session, data);
      case 'payroll-entry':
        return await workflowPayrollEntry(session, data);
      case 'bank-deposit-match':
        return await workflowBankDepositMatch(session, data);
      case 'ar-collection':
        return await workflowARCollection(session, data);
      case 'inventory-reorder':
        return await workflowInventoryReorder(session, data);
      case 'daily-report':
        return await workflowDailyReport(session, data);
      default:
        return { success: false, error: `알 수 없는 워크플로우: ${workflowId}` };
    }
  } catch (e) {
    LOG(`워크플로우 오류: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ── 워크플로우 구현 ──

/** 카톡 주문 → AI 파싱 → 이카운트 판매입력 */
async function workflowKakaoOrder(session, { rows }) {
  if (!rows || rows.length === 0) {
    return { success: false, error: '파싱된 주문 데이터가 없습니다' };
  }

  // 기본값 로드 (출하창고, 부서, 거래처)
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const defaults = dfData.ecount_defaults || {};
  const whCode = defaults.whCode || '';
  const deptCode = defaults.deptCode || '';
  const defaultCust = defaults.custCode || '';

  // 사전 검증: 필수 기본값 확인
  if (!whCode) {
    return { success: false, error: '[입력] 출하창고 코드가 설정되지 않았습니다. 설정 탭 > 이카운트 기본값에서 설정하세요.' };
  }
  if (!deptCode) {
    return { success: false, error: '[입력] 부서코드가 설정되지 않았습니다. 설정 탭 > 이카운트 기본값에서 설정하세요.' };
  }

  LOG(`SaveSale 기본값: WH_CD=${whCode}, DEPT_CD=${deptCode}, CUST=${defaultCust || '(공란)'}`);

  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // row 검증: 금액 계산
    const price = Number(row.amount) || (Number(row.unitPrice) * Number(row.qty)) || 0;
    if (price === 0) {
      LOG(`SaveSale [${i + 1}/${rows.length}] 스킵: 금액 없음`, `amount=${row.amount} unitPrice=${row.unitPrice} qty=${row.qty}`);
      results.push({
        row, success: false,
        error: `[입력] 금액 없음 (amount=${row.amount}, unitPrice=${row.unitPrice}, qty=${row.qty})`,
        errorType: 'validation',
      });
      notifySidePanel('progress', { current: i + 1, total: rows.length, status: 'fail' });
      continue;
    }

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const bulkData = {
      IO_DATE: row.orderDate || today,
      WH_CD: whCode,
      DEPT_CD: deptCode,
      CUST: row.custCode || defaultCust,
      PROD_CD: row.prodCode || '',
      PROD_DES: row.prodName || '',
      QTY: Number(row.qty) || 1,
      PRICE: price,
      SUPPLY_AMT: Math.round(price / 1.1),
      VAT_AMT: price - Math.round(price / 1.1),
      REMARKS: `카톡주문 ${row.customerName || ''} ${row.memo || ''}`.trim(),
    };
    const payload = {
      SaleList: [{ Line: i, BulkDatas: bulkData }],
    };

    // 호출 직전 로그
    LOG(`SaveSale [${i + 1}/${rows.length}]`,
      `IO_DATE=${bulkData.IO_DATE}`,
      `CUST=${bulkData.CUST || '(없음)'}`,
      `PROD_CD=${bulkData.PROD_CD || '(없음)'}`,
      `QTY=${bulkData.QTY}`,
      `PRICE=${bulkData.PRICE}`);

    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', payload);

      // 응답 본문 상세 검증 (Status=200이어도 실제 저장 실패 가능)
      const d = res.Data || {};
      const successCnt = Number(d.SuccessCnt ?? d.successCnt ?? -1);
      const failCnt = Number(d.FailCnt ?? d.failCnt ?? 0);
      const details = d.ResultDetails || d.resultDetails || [];
      const slipNos = d.SlipNos || d.slipNos || [];

      LOG(`SaveSale 응답 [${i + 1}]`,
        `Status=${res.Status}`,
        `SuccessCnt=${successCnt}`,
        `FailCnt=${failCnt}`,
        `SlipNos=${JSON.stringify(slipNos)}`,
        `ResultDetails=${JSON.stringify(details).slice(0, 300)}`);

      // 진짜 저장 성공 판정
      const detailsAllOk = details.length === 0 || details.every(r => r.IsSuccess === true || r.isSuccess === true);
      const isRealSuccess = failCnt === 0 && detailsAllOk;

      if (!isRealSuccess) {
        // Status=200이지만 실제 저장 실패
        const errMsgs = details
          .filter(r => r.Errors || r.TotalError)
          .map(r => r.TotalError || JSON.stringify(r.Errors))
          .join('; ');
        results.push({
          row, success: false,
          error: `[서버] 저장 실패 (SuccessCnt=${successCnt}, FailCnt=${failCnt}): ${errMsgs || 'ResultDetails 확인 필요'}`,
          errorType: 'server',
          slipNos,
          resultDetails: details,
        });
      } else {
        results.push({
          row, success: true, response: res,
          slipNos,
          successCnt,
          ioDate: bulkData.IO_DATE,
          resultDetails: details,
        });
      }
    } catch (e) {
      const errorType = e.message.startsWith('[세션]') ? 'session'
        : e.message.startsWith('[네트워크]') ? 'network'
        : e.message.startsWith('[입력]') ? 'validation'
        : 'server';
      results.push({ row, success: false, error: e.message, errorType });

      // 세션 재연결 후 갱신된 세션으로 계속
      if (errorType === 'session') {
        const fresh = await chrome.storage.local.get('ecount_session');
        if (fresh.ecount_session) session = fresh.ecount_session;
      }
    }

    notifySidePanel('progress', {
      current: i + 1,
      total: rows.length,
      status: results[results.length - 1].success ? 'success' : 'fail',
    });
  }

  const successCount = results.filter(r => r.success).length;
  notifySidePanel('workflowComplete', {
    workflowId: 'kakao-order',
    results,
    summary: { total: rows.length, success: successCount, fail: rows.length - successCount },
  });
  return { success: true, results, summary: { total: rows.length, success: successCount, fail: rows.length - successCount } };
}

/** PG정산 → 매출전표 자동등록 (이니시스) */
async function workflowPGSettlementRegister(session, { rows, defaults }) {
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const ecDefaults = dfData.ecount_defaults || {};
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.isRefund) continue; // 환불건 스킵

    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{ Line: 0, BulkDatas: {
          IO_DATE: row.approvalDate || row.paymentDate,
          WH_CD: ecDefaults.whCode || '',
          DEPT_CD: ecDefaults.deptCode || '',
          CUST: defaults?.custCode || ecDefaults.custCode || '',
          PROD_CD: defaults?.prodCode || '',
          QTY: 1,
          PRICE: row.transactionAmount,
          SUPPLY_AMT: Math.round(row.transactionAmount / 1.1),
          VAT_AMT: row.transactionAmount - Math.round(row.transactionAmount / 1.1),
          REMARKS: `이니시스 PG ${row.orderNo}`,
        }}],
      });
      results.push({ orderNo: row.orderNo, success: true, response: res });
    } catch (e) {
      results.push({ orderNo: row.orderNo, success: false, error: e.message });
    }

    // 진행률 알림
    notifySidePanel('progress', {
      current: i + 1,
      total: rows.length,
      status: results[results.length - 1].success ? 'success' : 'fail',
    });
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  notifySidePanel('workflowComplete', {
    workflowId: 'pg-settlement-register',
    results,
    summary: { total: rows.length, success: successCount, fail: failCount },
  });
  return { success: true, results, summary: { total: rows.length, success: successCount, fail: failCount } };
}

/** PG정산 ↔ ECOUNT 매출 대사 */
async function workflowPGSettlementReconcile(session, { pgRows, dateFrom, dateTo, ecountTableData }) {
  try {
    let ecountRows = [];

    // 방법1: ECOUNT API로 매출전표 조회
    if (dateFrom && dateTo) {
      const fromDate = dateFrom.replace(/-/g, '');
      const toDate = dateTo.replace(/-/g, '');
      const saleRes = await ecountRequest(session, '/OAPI/V2/Sale/GetSaleList', {
        FROM_DATE: fromDate,
        TO_DATE: toDate,
      });
      const rawRows = saleRes.Data?.Datas || saleRes.Data || [];
      ecountRows = (Array.isArray(rawRows) ? rawRows : []).map(r => ({
        orderNo: r.SLIP_NO || r.ORDER_NO || '',
        issueDate: r.IO_DATE || '',
        taxableAmount: Number(r.SUPPLY_AMT || r.PRICE || 0),
        cardAmount: 0,
        cashReceiptAmount: 0,
        custCode: r.CUST_CODE || '',
        prodCode: r.PROD_CODE || '',
        remarks: r.REMARKS || '',
      }));
    }

    // 방법2: 화면 스크래핑 데이터가 있으면 병합
    if (ecountTableData && ecountTableData.length > 0) {
      const scraped = ecountTableData
        .filter(row => {
          const firstVal = Object.values(row)[0] || '';
          return !firstVal.includes('합계') && !firstVal.includes('요약') && !firstVal.endsWith('계');
        })
        .map(row => ({
          orderNo: String(row['주문번호'] || row['전표번호'] || '').trim(),
          issueDate: String(row['발행일'] || row['전표일자'] || '').replace(/[-/.]/g, ''),
          orderDate: String(row['주문일'] || row['거래일'] || '').replace(/[-/.]/g, ''),
          taxableAmount: parseAmountBG(row['과세매출'] || row['합계 : 과세매출'] || row['공급가액'] || 0),
          cardAmount: parseAmountBG(row['신용카드매출전표'] || row['합계 : 신용카드매출전표'] || 0),
          cashReceiptAmount: parseAmountBG(row['현금영수증'] || row['합계 : 현금영수증'] || 0),
          otherAmount: parseAmountBG(row['기타'] || row['합계 : 기타'] || 0),
        }))
        .filter(r => r.orderNo);
      ecountRows = ecountRows.concat(scraped);
    }

    if (ecountRows.length === 0) {
      return { success: false, error: 'ECOUNT 매출 데이터가 없습니다. 기간을 설정하거나 ECOUNT 화면에서 데이터를 추출하세요.' };
    }

    // 대사 실행
    const pgMap = new Map();
    for (const pg of pgRows) {
      const key = normalizeOrderNoBG(pg.orderNo);
      if (key) pgMap.set(key, pg);
    }

    const ecountMap = new Map();
    for (const ec of ecountRows) {
      const key = normalizeOrderNoBG(ec.orderNo);
      if (key) {
        if (!ecountMap.has(key)) ecountMap.set(key, []);
        ecountMap.get(key).push(ec);
      }
    }

    const matched = [];
    const amountMismatch = [];
    const pgOnly = [];
    const matchedKeys = new Set();

    for (const [pgKey, pg] of pgMap) {
      const ecMatches = ecountMap.get(pgKey);
      if (ecMatches && ecMatches.length > 0) {
        const ec = ecMatches[0];
        const ecAmt = ec.taxableAmount || 0;
        const diff = pg.transactionAmount - ecAmt;
        if (Math.abs(diff) <= 1) {
          matched.push({ pg, ecount: ec, diff: 0 });
        } else {
          amountMismatch.push({ pg, ecount: ec, diff });
        }
        matchedKeys.add(pgKey);
      } else {
        pgOnly.push(pg);
      }
    }

    const ecountOnly = [];
    for (const [key, rows] of ecountMap) {
      if (!matchedKeys.has(key)) {
        ecountOnly.push(...rows);
      }
    }

    const reconcileResult = {
      matched,
      amountMismatch,
      pgOnly,
      ecountOnly,
      summary: {
        totalPG: pgRows.length,
        totalEcount: ecountRows.length,
        matched: matched.length,
        amountMismatch: amountMismatch.length,
        pgOnly: pgOnly.length,
        ecountOnly: ecountOnly.length,
        matchRate: pgRows.length > 0 ? Math.round(((matched.length + amountMismatch.length) / pgRows.length) * 100) : 0,
        pgTotalAmount: pgRows.reduce((s, r) => s + (r.transactionAmount || 0), 0),
        ecountTotalAmount: ecountRows.reduce((s, r) => s + (r.taxableAmount || 0), 0),
      },
    };
    reconcileResult.summary.amountDiff = reconcileResult.summary.pgTotalAmount - reconcileResult.summary.ecountTotalAmount;

    notifySidePanel('workflowComplete', {
      workflowId: 'pg-settlement-reconcile',
      results: reconcileResult,
    });
    return { success: true, reconcileResult };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/** PG정산 → 회계 분개 등록 */
async function workflowPGSettlementAccounting(session, { entries }) {
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    try {
      // 분개 전표 등록 (차변 + 대변)
      const slipItems = [
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
      ];

      const res = await ecountRequest(session, '/OAPI/V2/Slip/SaveSlip', {
        SlipList: slipItems,
      });
      results.push({ date: entry.date, type: entry.type, success: true, response: res });
    } catch (e) {
      results.push({ date: entry.date, type: entry.type, success: false, error: e.message });
    }

    notifySidePanel('progress', {
      current: i + 1,
      total: entries.length,
      status: results[results.length - 1].success ? 'success' : 'fail',
    });
  }

  const successCount = results.filter(r => r.success).length;
  notifySidePanel('workflowComplete', {
    workflowId: 'pg-settlement-accounting',
    results,
    summary: { total: entries.length, success: successCount, fail: entries.length - successCount },
  });
  return { success: true, results };
}

// 유틸: background.js 내부용
function parseAmountBG(val) {
  if (typeof val === 'number') return Math.round(val);
  return Math.round(Number(String(val).replace(/[^0-9.\-]/g, '')) || 0);
}
function normalizeOrderNoBG(no) {
  return String(no).replace(/[-\s]/g, '').trim();
}

/** WF2: PG사 엑셀 → 매출전표 */
async function workflowPGToSales(session, { rows }) {
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const ecDefaults = dfData.ecount_defaults || {};
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{ Line: 0, BulkDatas: {
          IO_DATE: row.date,
          WH_CD: ecDefaults.whCode || '',
          DEPT_CD: ecDefaults.deptCode || '',
          CUST: row.custCode || ecDefaults.custCode || '',
          PROD_CD: row.prodCode || '',
          QTY: row.qty || 1,
          PRICE: row.amount,
          SUPPLY_AMT: Math.round(row.amount / 1.1),
          VAT_AMT: row.amount - Math.round(row.amount / 1.1),
          REMARKS: row.remarks || `PG결제 ${row.pgName || ''}`,
        }}],
      });
      results.push({ row, success: true, response: res });
    } catch (e) {
      results.push({ row, success: false, error: e.message });
    }
  }
  notifySidePanel('workflowComplete', { workflowId: 'pg-to-sales', results });
  return { success: true, results };
}

/** WF6: PDF 인보이스 → 구매입력 */
async function workflowInvoiceToPurchase(session, { invoiceData }) {
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const ecDefaults = dfData.ecount_defaults || {};
  const res = await ecountRequest(session, '/OAPI/V2/Purchase/SavePurchase', {
    PurchaseList: [{ Line: 0, BulkDatas: {
      IO_DATE: invoiceData.date,
      WH_CD: ecDefaults.whCode || '',
      DEPT_CD: ecDefaults.deptCode || '',
      CUST: invoiceData.vendorCode || ecDefaults.custCode || '',
      PROD_CD: invoiceData.prodCode || '',
      QTY: invoiceData.qty || 1,
      PRICE: invoiceData.totalAmount,
      SUPPLY_AMT: invoiceData.supplyAmount,
      VAT_AMT: invoiceData.vatAmount,
      REMARKS: `인보이스#${invoiceData.invoiceNo || ''}`,
    }}],
  });
  notifySidePanel('workflowComplete', { workflowId: 'invoice-to-purchase', results: [res] });
  return { success: true, response: res };
}

/** WF10: 견적서 생성 → 메일 */
async function workflowQuoteToEmail(session, { quoteData, emailTo }) {
  // 이카운트에서 제품 정보 조회
  const products = [];
  for (const item of quoteData.items) {
    if (item.prodCode) {
      try {
        const prod = await ecountRequest(session, '/OAPI/V2/Product/GetProductInfo', {
          PROD_CODE: item.prodCode,
        });
        products.push({ ...item, productInfo: prod });
      } catch {
        products.push(item);
      }
    } else {
      products.push(item);
    }
  }
  notifySidePanel('workflowComplete', {
    workflowId: 'quote-to-email',
    results: { quoteData: { ...quoteData, items: products }, emailTo },
  });
  return { success: true, products, quoteData };
}

/** WF1: 카페24 주문 → 판매입력 */
async function workflowCafe24ToSales(session, { rows }) {
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const ecDefaults = dfData.ecount_defaults || {};
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{ Line: 0, BulkDatas: {
          IO_DATE: row.orderDate,
          WH_CD: ecDefaults.whCode || '',
          DEPT_CD: ecDefaults.deptCode || '',
          CUST: row.custCode || ecDefaults.custCode || '',
          PROD_CD: row.prodCode || '',
          QTY: row.qty || 1,
          PRICE: row.amount,
          SUPPLY_AMT: Math.round(row.amount / 1.1),
          VAT_AMT: row.amount - Math.round(row.amount / 1.1),
          REMARKS: `카페24 주문#${row.orderNo || ''}`,
        }}],
      });
      results.push({ row, success: true, response: res });
    } catch (e) {
      results.push({ row, success: false, error: e.message });
    }
  }
  return { success: true, results };
}

/** WF4: 급여대장 → 급여 입력 */
async function workflowPayrollEntry(session, { rows }) {
  const dfData = await chrome.storage.local.get('ecount_defaults');
  const ecDefaults = dfData.ecount_defaults || {};
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{ Line: 0, BulkDatas: {
          IO_DATE: row.payDate,
          WH_CD: ecDefaults.whCode || '',
          DEPT_CD: ecDefaults.deptCode || '',
          REMARKS: `급여 ${row.employeeName || ''} ${row.payMonth || ''}`,
          PRICE: row.totalPay,
        }}],
      });
      results.push({ row, success: true, response: res });
    } catch (e) {
      results.push({ row, success: false, error: e.message });
    }
  }
  return { success: true, results };
}

/** WF5: 은행 입금내역 → 입금 매칭 */
async function workflowBankDepositMatch(session, { deposits }) {
  const results = [];
  for (const dep of deposits) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveDeposit', {
        DepositList: [{
          IO_DATE: dep.date,
          CUST_CODE: dep.custCode || '',
          DEPOSIT_AMT: dep.amount,
          REMARKS: dep.description || '',
        }],
      });
      results.push({ deposit: dep, success: true, response: res });
    } catch (e) {
      results.push({ deposit: dep, success: false, error: e.message });
    }
  }
  return { success: true, results };
}

/** WF7: 채권 현황 → 독촉 메일 */
async function workflowARCollection(session, { overdueAccounts }) {
  // 거래처별 미수금 조회 후 데이터 반환 (메일 발송은 사이드패널에서 처리)
  const arData = [];
  for (const acct of overdueAccounts) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/GetDepositList', {
        CUST_CODE: acct.custCode,
        FROM_DATE: acct.fromDate,
        TO_DATE: acct.toDate,
      });
      arData.push({ account: acct, deposits: res, balance: acct.balance });
    } catch (e) {
      arData.push({ account: acct, error: e.message });
    }
  }
  return { success: true, arData };
}

/** WF8: 재고 조회 → 발주 리스트 */
async function workflowInventoryReorder(session, { minStockRules }) {
  const reorderList = [];
  try {
    const inv = await ecountRequest(session, '/OAPI/V2/Inventory/GetInventoryList', {});
    const items = inv.Data?.Datas || [];
    for (const item of items) {
      const rule = minStockRules?.find(r => r.prodCode === item.PROD_CODE);
      if (rule && Number(item.QTY || 0) < rule.minStock) {
        reorderList.push({
          prodCode: item.PROD_CODE,
          prodName: item.PROD_NAME,
          currentQty: Number(item.QTY),
          minStock: rule.minStock,
          reorderQty: rule.reorderQty || rule.minStock * 2,
        });
      }
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true, reorderList };
}

/** WF9: 일간 보고서 */
async function workflowDailyReport(session, { reportDate }) {
  const date = reportDate || new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const [sales, purchases] = await Promise.all([
    ecountRequest(session, '/OAPI/V2/Sale/GetSaleList', { FROM_DATE: date, TO_DATE: date }),
    ecountRequest(session, '/OAPI/V2/Purchase/GetPurchaseList', { FROM_DATE: date, TO_DATE: date }),
  ]);
  const report = {
    date,
    salesCount: sales.Data?.Datas?.length || 0,
    salesTotal: (sales.Data?.Datas || []).reduce((s, r) => s + Number(r.PRICE || 0), 0),
    purchaseCount: purchases.Data?.Datas?.length || 0,
    purchaseTotal: (purchases.Data?.Datas || []).reduce((s, r) => s + Number(r.PRICE || 0), 0),
  };
  return { success: true, report };
}

// ── 파일 파싱 핸들러 ──

async function handleParseFile({ fileType, fileData }) {
  // 파싱은 사이드패널에서 처리, background는 중계만
  return { success: true, type: fileType };
}

// ── 콘텐츠 스크립트 실행 ──

async function handleInjectScript({ tabId, script, args }) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: new Function('return ' + script)(),
      args: args || [],
    });
    return { success: true, result: result?.[0]?.result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── 유틸리티 ──

async function getStoredSession() {
  const data = await chrome.storage.local.get('ecount_session');
  const session = data.ecount_session;
  if (!session) return null;
  if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
    LOG('세션 24시간 경과 — 자동 재연결 시도');
    try {
      return await reconnectEcountSession();
    } catch (e) {
      LOG('자동 재연결 실패:', e.message);
      return null;
    }
  }
  return session;
}

/** 저장된 credentials로 ECOUNT 재로그인 → 새 세션 반환 */
async function reconnectEcountSession() {
  const creds = await chrome.storage.local.get('ecount_credentials');
  const { comCode, userId, apiCertKey } = creds.ecount_credentials || {};
  if (!comCode || !userId || !apiCertKey) {
    throw new Error('[세션] 저장된 인증 정보 없음 — 설정 탭에서 연결 필요');
  }

  LOG('세션 재연결 시작:', comCode);

  const zoneRes = await fetch('https://sboapi.ecount.com/OAPI/V2/Zone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ COM_CODE: comCode }),
  });
  const zoneData = await zoneRes.json();
  if (String(zoneData.Status) !== '200') {
    throw new Error(`[세션] Zone 조회 실패: ${zoneData.Error?.Message || ''}`);
  }
  const dataObj = zoneData.Data?.Datas || zoneData.Data || {};
  const zone = dataObj.ZONE || dataObj.Zone || dataObj.zone || zoneData.Data?.ZONE;
  if (!zone) throw new Error('[세션] Zone 값 없음');

  const baseUrl = `https://sboapi${zone}.ecount.com`;
  const loginRes = await fetch(`${baseUrl}/OAPI/V2/OAPILogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      COM_CODE: comCode, USER_ID: userId, API_CERT_KEY: apiCertKey,
      LAN_TYPE: 'ko-KR', ZONE: zone,
    }),
  });
  const loginData = await loginRes.json();
  if (String(loginData.Status) !== '200') {
    throw new Error(`[세션] 재로그인 실패: ${loginData.Error?.Message || ''}`);
  }
  const loginObj = loginData.Data?.Datas || loginData.Data || {};
  const innerCode = String(loginObj.Code ?? '');
  if (innerCode && innerCode !== '00') {
    throw new Error(`[세션] 재로그인 내부 오류 (${innerCode}): ${loginObj.Message || ''}`);
  }
  const sessionId = loginObj.SESSION_ID || loginObj.session_id;
  if (!sessionId) throw new Error('[세션] SESSION_ID 없음');

  const session = { sessionId, zone, baseUrl, savedAt: Date.now() };
  await chrome.storage.local.set({ ecount_session: session });
  LOG('세션 재연결 성공:', baseUrl, 'SID:', sessionId.slice(0, 8) + '...');
  return session;
}

async function ecountRequest(session, path, body, _retried = false) {
  const baseUrl = session.baseUrl || `https://sboapi${session.zone}.ecount.com`;
  LOG(`API 요청: ${path}`, `SID존재=${!!session.sessionId}`, JSON.stringify(body).slice(0, 300));

  let data;
  try {
    const url = `${baseUrl}${path}?SESSION_ID=${encodeURIComponent(session.sessionId)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    // HTTP 에러여도 JSON body 파싱 시도 (ECOUNT는 500에도 JSON 반환)
    const rawText = await res.text().catch(() => '');
    try {
      data = JSON.parse(rawText);
    } catch {
      // JSON 파싱 실패 = 진짜 네트워크/서버 오류
      LOG(`API HTTP 오류: ${path} status=${res.status}`, rawText.slice(0, 200));
      throw new Error(`[네트워크] ECOUNT HTTP ${res.status}: ${res.statusText}`);
    }
    if (!res.ok) {
      LOG(`API HTTP ${res.status}: ${path}`, JSON.stringify(data).slice(0, 300));
    }
  } catch (e) {
    if (e.message.startsWith('[네트워크]') || e.message.startsWith('[세션]')) throw e;
    LOG(`API fetch 실패: ${path} baseUrl=${baseUrl}`, e.message);
    throw new Error(`[네트워크] ${path} 요청 실패: ${e.message}`);
  }

  LOG(`API 응답: ${path}`, `Status=${data.Status}`,
    (data.Error?.Message || data.Data?.Message || '').slice(0, 100));

  // 세션 무효 감지
  const isSessionInvalid =
    String(data.Status) === '401' ||
    (data.Error?.Message || '').includes('로그인') ||
    (data.Data?.Message || '').includes('로그인') ||
    (String(data.Status) === '500' && JSON.stringify(data).includes('로그인'));

  if (isSessionInvalid && !_retried) {
    LOG('세션 무효 감지 — 자동 재연결 시도');
    await chrome.storage.local.remove('ecount_session');
    try {
      const newSession = await reconnectEcountSession();
      return await ecountRequest(newSession, path, body, true);
    } catch (reconnErr) {
      throw new Error(`[세션] 자동 재연결 실패: ${reconnErr.message}`);
    }
  }

  // ECOUNT 내부 에러 체크
  const status = String(data.Status || '');
  if (status && status !== '200') {
    const errMsg = data.Error?.Message || data.Data?.Message || JSON.stringify(data).slice(0, 200);
    throw new Error(`[서버] ECOUNT API 오류 (${status}): ${errMsg}`);
  }
  return data;
}

function notifySidePanel(action, data) {
  chrome.runtime.sendMessage({ action, ...data }).catch(() => {});
}
