/**
 * 이카운트 DOM 조작 — API 미지원 기능 폴백
 * MAIN world에서 실행하여 페이지 JS 함수 접근
 */

(() => {
  const LOG = (...args) => console.log('[CNC-ERP Injector]', ...args);

  // 이카운트 내부 함수 호출 래퍼
  window.__cncErpBridge = {
    // 판매전표 저장 (폼 기반)
    saveSaleForm(data) {
      try {
        if (typeof fn_Save === 'function') {
          // 폼 필드 채우기
          setVal('#IO_DATE', data.date);
          setVal('#CUST_CODE', data.custCode);
          setVal('#PROD_CODE', data.prodCode);
          setVal('#QTY', data.qty);
          setVal('#PRICE', data.price);
          setVal('#REMARKS', data.remarks);
          // 저장 함수 호출
          fn_Save();
          return { success: true };
        }
        return { success: false, error: 'fn_Save not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // 구매전표 저장 (폼 기반)
    savePurchaseForm(data) {
      try {
        if (typeof fn_Save === 'function') {
          setVal('#IO_DATE', data.date);
          setVal('#CUST_CODE', data.custCode);
          setVal('#PROD_CODE', data.prodCode);
          setVal('#QTY', data.qty);
          setVal('#PRICE', data.price);
          setVal('#REMARKS', data.remarks);
          fn_Save();
          return { success: true };
        }
        return { success: false, error: 'fn_Save not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // 현재 페이지의 그리드/테이블 데이터 가져오기
    getGridData() {
      try {
        // 이카운트 그리드 객체 접근
        if (typeof oGrid !== 'undefined' && oGrid.getData) {
          return { success: true, data: oGrid.getData() };
        }
        // jqGrid 폴백
        if (typeof $ !== 'undefined' && $.fn.jqGrid) {
          const gridId = $('table.ui-jqgrid-btable').attr('id');
          if (gridId) {
            const data = $(`#${gridId}`).jqGrid('getRowData');
            return { success: true, data };
          }
        }
        return { success: false, error: 'Grid not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    // 엑셀 업로드 트리거
    triggerExcelUpload() {
      try {
        if (typeof fn_ExcelUpload === 'function') {
          fn_ExcelUpload();
          return { success: true };
        }
        // 업로드 버튼 찾기
        const btn = document.querySelector('[onclick*="ExcelUpload"], [onclick*="excel"], .btn-excel-upload');
        if (btn) {
          btn.click();
          return { success: true };
        }
        return { success: false, error: 'Excel upload function not found' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },
  };

  function setVal(selector, value) {
    const el = document.querySelector(selector);
    if (el) {
      el.value = value || '';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  LOG('이카운트 Injector 브릿지 준비 완료');
})();
