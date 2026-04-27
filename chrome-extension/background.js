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
      case 'pg-to-sales':
        return await workflowPGToSales(session, data);
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

/** WF2: PG사 엑셀 → 매출전표 */
async function workflowPGToSales(session, { rows }) {
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{
          IO_DATE: row.date,
          CUST_CODE: row.custCode || '',
          PROD_CODE: row.prodCode || '',
          QTY: row.qty || 1,
          PRICE: row.amount,
          SUPPLY_AMT: Math.round(row.amount / 1.1),
          VAT_AMT: row.amount - Math.round(row.amount / 1.1),
          REMARKS: row.remarks || `PG결제 ${row.pgName || ''}`,
        }],
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
  const res = await ecountRequest(session, '/OAPI/V2/Purchase/SavePurchase', {
    PurchaseList: [{
      IO_DATE: invoiceData.date,
      CUST_CODE: invoiceData.vendorCode || '',
      PROD_CODE: invoiceData.prodCode || '',
      QTY: invoiceData.qty || 1,
      PRICE: invoiceData.totalAmount,
      SUPPLY_AMT: invoiceData.supplyAmount,
      VAT_AMT: invoiceData.vatAmount,
      REMARKS: `인보이스#${invoiceData.invoiceNo || ''}`,
    }],
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
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{
          IO_DATE: row.orderDate,
          CUST_CODE: row.custCode || '',
          PROD_CODE: row.prodCode || '',
          QTY: row.qty || 1,
          PRICE: row.amount,
          SUPPLY_AMT: Math.round(row.amount / 1.1),
          VAT_AMT: row.amount - Math.round(row.amount / 1.1),
          REMARKS: `카페24 주문#${row.orderNo || ''}`,
        }],
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
  const results = [];
  for (const row of rows) {
    try {
      const res = await ecountRequest(session, '/OAPI/V2/Sale/SaveSale', {
        SaleList: [{
          IO_DATE: row.payDate,
          REMARKS: `급여 ${row.employeeName || ''} ${row.payMonth || ''}`,
          PRICE: row.totalPay,
        }],
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
  if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) return null;
  return session;
}

async function ecountRequest(session, path, body) {
  const baseUrl = session.baseUrl || `https://sboapi${session.zone}.ecount.com`;
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'SESSION_ID': session.sessionId,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.Status === '401') {
    throw new Error('세션 만료 — 재연결이 필요합니다');
  }
  return data;
}

function notifySidePanel(action, data) {
  chrome.runtime.sendMessage({ action, ...data }).catch(() => {});
}
