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

  LOG('이카운트 Observer 로드 완료', getPageContext().path);
})();
