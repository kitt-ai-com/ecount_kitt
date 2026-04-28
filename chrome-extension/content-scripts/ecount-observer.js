/**
 * MutationObserver — 이카운트 페이지 상태 감시
 * API 미지원 기능의 DOM 변경 감지 및 데이터 수집
 */

(() => {
  const LOG = (...args) => console.log('[CNC-ERP Observer]', ...args);

  // 현재 이카운트 페이지 정보
  function getPageContext() {
    const url = location.href;
    const path = location.pathname;
    return {
      url,
      path,
      isSalePage: /sale/i.test(path),
      isPurchasePage: /purchase/i.test(path),
      isInventoryPage: /inventory|stock/i.test(path),
      isAccountPage: /account|cust/i.test(path),
    };
  }

  // DOM 변경 감시
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // 모달/팝업 감지
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            checkForDialog(node);
            checkForDataTable(node);
          }
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // 확인/경고 다이얼로그 감지
  function checkForDialog(node) {
    const text = node.textContent || '';
    if (text.includes('저장되었습니다') || text.includes('등록되었습니다')) {
      LOG('저장 완료 감지');
      chrome.runtime.sendMessage({ action: 'domEvent', type: 'saveComplete', text });
    }
    if (text.includes('오류') || text.includes('실패')) {
      LOG('오류 감지:', text.slice(0, 100));
      chrome.runtime.sendMessage({ action: 'domEvent', type: 'error', text: text.slice(0, 200) });
    }
  }

  // 데이터 테이블 감지 (리스트 페이지)
  function checkForDataTable(node) {
    const tables = node.querySelectorAll ? node.querySelectorAll('table') : [];
    if (tables.length > 0) {
      LOG('테이블 감지:', tables.length, '개');
    }
  }

  // 사이드패널에서 DOM 조작 요청 수신
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fillForm') {
      fillFormFields(msg.fields);
      sendResponse({ success: true });
    }
    if (msg.action === 'clickButton') {
      clickButton(msg.selector);
      sendResponse({ success: true });
    }
    if (msg.action === 'extractTableData') {
      const data = extractTableData(msg.selector);
      sendResponse({ success: true, data });
    }
    if (msg.action === 'extractSettlementData') {
      const data = extractSettlementData();
      sendResponse({ success: true, data });
    }
    if (msg.action === 'extractSalesData') {
      const data = extractSalesData();
      sendResponse({ success: true, data });
    }
    if (msg.action === 'getPageContext') {
      sendResponse(getPageContext());
    }
  });

  // 폼 필드 채우기
  function fillFormFields(fields) {
    for (const [selector, value] of Object.entries(fields)) {
      const el = document.querySelector(selector);
      if (el) {
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        LOG(`필드 설정: ${selector} = ${value}`);
      }
    }
  }

  // 버튼 클릭
  function clickButton(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.click();
      LOG(`클릭: ${selector}`);
    }
  }

  // 테이블 데이터 추출
  function extractTableData(selector) {
    const table = document.querySelector(selector || 'table');
    if (!table) return [];

    const rows = [];
    const headerCells = table.querySelectorAll('thead th, thead td');
    const headers = Array.from(headerCells).map(th => th.textContent.trim());

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cells = tr.querySelectorAll('td');
      const row = {};
      cells.forEach((td, i) => {
        row[headers[i] || `col${i}`] = td.textContent.trim();
      });
      if (Object.values(row).some(v => v)) rows.push(row);
    });

    return rows;
  }

  // PG정산/매출 데이터 추출 — 이카운트 그리드 테이블에서 데이터 수집
  function extractSettlementData() {
    return extractGridData(['지급일', '승인일', '주문번호', '거래금액', '수수료', '부가세', '지급액']);
  }

  function extractSalesData() {
    return extractGridData(['발행일', '주문일', '주문번호', '과세매출', '신용카드매출전표', '현금영수증', '기타']);
  }

  /**
   * 이카운트 그리드 테이블에서 데이터 추출 (범용)
   * jqGrid, 일반 table, AG Grid 등 다양한 그리드 지원
   */
  function extractGridData(expectedHeaders) {
    const rows = [];

    // 1. jqGrid 탐색
    const jqGrids = document.querySelectorAll('.ui-jqgrid-btable, [id$="_grid"], .jqgrow');
    if (jqGrids.length > 0) {
      const gridTable = document.querySelector('.ui-jqgrid-btable') || document.querySelector('table[role="grid"]');
      if (gridTable) {
        return extractFromTable(gridTable, expectedHeaders);
      }
    }

    // 2. 일반 테이블 탐색 (헤더 기반 매칭)
    const tables = document.querySelectorAll('table');
    for (const table of tables) {
      const headerRow = table.querySelector('thead tr, tr:first-child');
      if (!headerRow) continue;
      const headerText = headerRow.textContent;
      // 기대 헤더 중 2개 이상 매칭되면 대상 테이블
      const matchCount = expectedHeaders.filter(h => headerText.includes(h)).length;
      if (matchCount >= 2) {
        return extractFromTable(table, expectedHeaders);
      }
    }

    // 3. AG Grid 또는 커스텀 그리드
    const agGrid = document.querySelector('.ag-body-viewport, .ag-center-cols-container');
    if (agGrid) {
      const agRows = agGrid.querySelectorAll('.ag-row');
      for (const agRow of agRows) {
        const cells = agRow.querySelectorAll('.ag-cell');
        const row = {};
        cells.forEach((cell, i) => {
          const header = expectedHeaders[i] || `col${i}`;
          row[header] = cell.textContent.trim();
        });
        if (Object.values(row).some(v => v)) rows.push(row);
      }
      return rows;
    }

    // 4. iframe 내부 탐색
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeTables = iframeDoc.querySelectorAll('table');
          for (const table of iframeTables) {
            const headerRow = table.querySelector('thead tr, tr:first-child');
            if (!headerRow) continue;
            const headerText = headerRow.textContent;
            const matchCount = expectedHeaders.filter(h => headerText.includes(h)).length;
            if (matchCount >= 2) {
              return extractFromTable(table, expectedHeaders);
            }
          }
        }
      } catch (e) {
        // cross-origin iframe는 접근 불가
      }
    }

    LOG('그리드 데이터를 찾을 수 없습니다');
    return rows;
  }

  function extractFromTable(table, expectedHeaders) {
    const rows = [];
    // 헤더 추출
    const headerCells = table.querySelectorAll('thead th, thead td');
    let headers;
    if (headerCells.length > 0) {
      headers = Array.from(headerCells).map(th => th.textContent.trim());
    } else {
      // 첫 행을 헤더로
      const firstRow = table.querySelector('tr');
      headers = firstRow ? Array.from(firstRow.querySelectorAll('td, th')).map(c => c.textContent.trim()) : expectedHeaders;
    }

    // 데이터 행 추출
    const dataRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
    for (const tr of dataRows) {
      const cells = tr.querySelectorAll('td');
      if (cells.length === 0) continue;

      const row = {};
      cells.forEach((td, i) => {
        const key = headers[i] || `col${i}`;
        row[key] = td.textContent.trim();
      });

      // 빈 행, 합계/요약 행 제외
      const firstVal = Object.values(row)[0] || '';
      if (!Object.values(row).some(v => v)) continue;

      rows.push(row);
    }

    LOG(`테이블에서 ${rows.length}건 추출 완료`);
    return rows;
  }

  LOG('이카운트 Observer 로드 완료', getPageContext().path);
})();
