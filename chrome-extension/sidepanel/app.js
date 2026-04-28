/**
 * Side Panel 메인 컨트롤러 — CNC코리아 ERP 자동화
 */

// ── 상태 ──
let currentWorkflow = null;
let parsedData = null;
let pendingWfData = null;  // AI 파싱 완료 후 저장 대기 데이터
let isExecuting = false;
const MASKED_SECRET = '••••••••';

// ── 초기화 ──
document.addEventListener('DOMContentLoaded', async () => {
  initNavTabs();
  initWorkflowGrid();
  initFileDrop();
  initSettings();
  initReports();
  initStats();
  await checkConnection();
  await loadHistory();
});

// ── 네비게이션 탭 ──

function initNavTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

// ── 워크플로우 그리드 ──

function initWorkflowGrid() {
  // 카테고리 필터
  document.querySelectorAll('.wf-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wf-filter').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
      });
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');

      const cat = btn.dataset.cat;
      document.querySelectorAll('.workflow-card').forEach(card => {
        card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
      });
    });
  });

  // 워크플로우 선택
  document.querySelectorAll('.workflow-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.workflow-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectWorkflow(card.dataset.wf);
    });
  });

  // 실행/취소 버튼
  document.getElementById('btnExecute').addEventListener('click', executeWorkflow);
  document.getElementById('btnSaveToEcount').addEventListener('click', saveToEcount);
  document.getElementById('btnCancel').addEventListener('click', cancelWorkflow);
}

function selectWorkflow(wfId) {
  currentWorkflow = wfId;
  parsedData = null;
  const panel = document.getElementById('workflowPanel');
  panel.style.display = '';

  const titles = {
    'kakao-order': '카톡 주문 수집·입력',
    'excel-upload': '엑셀 판매입력 업로드',
    'logistics-format': '물류센터 양식 변환',
    'price-recommend': '거래처별 단가 추천',
    'auto-quote': '자동 견적서',
    'quote-followup': '미전환 견적 알림',
    'pre-quote': '가견적 (박스 추천)',
    'pg-settlement-register': 'PG정산 매출등록 (이니시스)',
    'pg-settlement-reconcile': 'PG정산 대사 (매칭)',
    'pg-settlement-accounting': 'PG정산 회계분개',
    'tax-invoice-match': '세금계산서 매칭 체크',
    'invoice-ocr': '인보이스 OCR',
    'ar-refresh': '채권현황 갱신',
    'pl-report': '매입·매출 리포트',
    'payroll': '급여 자동화',
    'receipt-ocr': '영수증 OCR',
  };

  document.getElementById('wfPanelTitle').textContent = titles[wfId] || wfId;

  // 워크플로우별 UI 설정
  const textArea = document.getElementById('textInputArea');
  const fileDrop = document.getElementById('fileDrop');
  const extraFields = document.getElementById('wfExtraFields');
  textArea.style.display = 'none';
  fileDrop.style.display = '';
  extraFields.innerHTML = '';

  // 텍스트 입력이 필요한 워크플로우
  if (wfId === 'kakao-order') {
    textArea.style.display = '';
    fileDrop.style.display = 'none';
    document.getElementById('wfTextInput').placeholder = '카톡 주문 메시지를 그대로 복사·붙여넣기 하세요.\nAI가 자동으로 거래처/제품/수량/금액을 추출합니다.\n\n예시:\n[홍길동] 오후 3:42\n박스 A0001 50개\n테이프 T001 10개\n서울시 강남구 역삼동 123\n내일 오전 배송 부탁드립니다';
  }

  // 파일 불필요 워크플로우
  if (['ar-refresh', 'quote-followup', 'price-recommend'].includes(wfId)) {
    fileDrop.style.display = 'none';
  }

  // 추가 필드
  if (wfId === 'pre-quote') {
    fileDrop.style.display = 'none';
    extraFields.innerHTML = `
      <div class="form-row"><label>가로 (mm)</label><input type="number" id="boxW" placeholder="300"></div>
      <div class="form-row"><label>세로 (mm)</label><input type="number" id="boxH" placeholder="200"></div>
      <div class="form-row"><label>높이 (mm)</label><input type="number" id="boxD" placeholder="150"></div>
      <div class="form-row"><label>수량</label><input type="number" id="boxQty" value="100"></div>
    `;
  }

  if (wfId === 'logistics-format') {
    extraFields.innerHTML = `
      <div class="form-row"><label>물류센터</label>
        <select id="logisticsCenter">
          <option value="">센터 선택...</option>
          <option value="cj">CJ대한통운</option>
          <option value="hanjin">한진택배</option>
          <option value="lotte">롯데택배</option>
          <option value="custom">직접입력</option>
        </select>
      </div>
      <div class="form-row"><label>수신 메일</label><input type="email" id="logisticsEmail" placeholder="center@logistics.com"></div>
    `;
  }

  if (wfId === 'auto-quote') {
    extraFields.innerHTML = `
      <div class="form-row"><label>거래처</label><input type="text" id="quoteCust" placeholder="거래처명 또는 코드"></div>
      <div class="form-row"><label>수신 메일</label><input type="email" id="quoteEmail" placeholder="client@company.com"></div>
    `;
  }

  if (wfId === 'payroll') {
    extraFields.innerHTML = `
      <div class="form-row"><label>급여월</label><input type="month" id="payMonth"></div>
      <div class="form-row"><label>수신 메일</label><input type="email" id="payrollEmail" placeholder="hr@cnc-korea.com"></div>
    `;
  }

  // PG정산 워크플로우 설정
  if (wfId === 'pg-settlement-register') {
    extraFields.innerHTML = `
      <div class="form-row"><label>거래처코드</label><input type="text" id="pgCustCode" placeholder="거래처코드 (선택)"></div>
      <div class="form-row"><label>품목코드</label><input type="text" id="pgProdCode" placeholder="품목코드 (선택)"></div>
      <div style="font-size:10px;color:var(--gray-500);margin-top:4px;">이니시스 PG정산 엑셀을 업로드하면 매출전표를 자동 등록합니다</div>
    `;
  }

  if (wfId === 'pg-settlement-reconcile') {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    extraFields.innerHTML = `
      <div style="font-size:11px;font-weight:600;margin-bottom:6px;">ECOUNT 매출 조회 기간</div>
      <div class="form-row"><label>시작일</label><input type="date" id="pgRecFrom" value="${monthAgo}"></div>
      <div class="form-row"><label>종료일</label><input type="date" id="pgRecTo" value="${today}"></div>
      <div class="form-row">
        <label>데이터 소스</label>
        <select id="pgRecSource">
          <option value="api">ECOUNT API 조회</option>
          <option value="scrape">ECOUNT 화면 추출</option>
          <option value="both">둘 다 사용</option>
        </select>
      </div>
      <div style="font-size:10px;color:var(--gray-500);margin-top:4px;">PG정산 엑셀을 업로드하고, ECOUNT 매출 데이터와 자동 대사합니다</div>
    `;
  }

  if (wfId === 'pg-settlement-accounting') {
    extraFields.innerHTML = `
      <div style="font-size:11px;font-weight:600;margin-bottom:6px;">계정과목 코드</div>
      <div class="form-row"><label>보통예금</label><input type="text" id="acctBank" value="1110101" placeholder="1110101"></div>
      <div class="form-row"><label>지급수수료</label><input type="text" id="acctFee" value="5230501" placeholder="5230501"></div>
      <div class="form-row"><label>부가세대급금</label><input type="text" id="acctVat" value="1350101" placeholder="1350101"></div>
      <div class="form-row"><label>상품매출</label><input type="text" id="acctSales" value="4010101" placeholder="4010101"></div>
      <div style="font-size:10px;color:var(--gray-500);margin-top:4px;">PG정산 엑셀 → 지급일별 회계 분개 전표를 자동 생성합니다<br>차변: 보통예금 + 수수료 + 부가세 / 대변: 매출</div>
    `;
  }

  // 미리보기/로그 초기화
  document.getElementById('previewWrap').style.display = 'none';
  document.getElementById('statusLog').style.display = 'none';
  document.getElementById('progressBar').classList.remove('active');
  document.getElementById('btnExecute').disabled = false;
  document.getElementById('btnCancel').disabled = true;

  // 파일/텍스트 불필요한 워크플로우는 바로 실행 가능
  if (['ar-refresh', 'quote-followup', 'price-recommend'].includes(wfId)) {
    document.getElementById('btnExecute').disabled = false;
  } else if (wfId === 'pre-quote') {
    document.getElementById('btnExecute').disabled = false;
  } else if (wfId === 'kakao-order') {
    document.getElementById('btnExecute').disabled = true;
    document.getElementById('wfTextInput').addEventListener('input', () => {
      document.getElementById('btnExecute').disabled = !document.getElementById('wfTextInput').value.trim();
    });
  } else {
    document.getElementById('btnExecute').disabled = true;
  }
}

// ── 파일 드래그앤드롭 + 업로드 ──

function initFileDrop() {
  const drop = document.getElementById('fileDrop');
  const input = document.getElementById('fileInput');

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener('change', () => {
    if (input.files.length) handleFile(input.files[0]);
  });
}

async function handleFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  addLog(`파일 로드: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`, 'info');

  try {
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      parsedData = await parseExcel(file);
    } else if (ext === 'pdf') {
      parsedData = await parsePDF(file);
    } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      parsedData = await parseImage(file);
    } else {
      toast('지원하지 않는 파일 형식입니다', 'error');
      return;
    }
    renderPreview(parsedData);
    document.getElementById('btnExecute').disabled = false;
    addLog(`파싱 완료: ${parsedData.rows?.length || 0}건`, 'success');
  } catch (e) {
    addLog(`파싱 오류: ${e.message}`, 'fail');
    toast(`파일 파싱 실패: ${e.message}`, 'error');
  }
}

// ── 파일 파싱 (인라인 — webpack 번들 시 import로 교체) ──

async function parseExcel(file) {
  // SheetJS가 번들되어 있을 때
  if (typeof XLSX !== 'undefined') {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headers = rows[0] || [];
    const dataRows = rows.slice(1).map(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = r[i] || '');
      return obj;
    });
    return { headers, rows: dataRows, source: file.name };
  }
  // Fallback: FileReader CSV
  const text = await file.text();
  const lines = text.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  });
  return { headers, rows, source: file.name };
}

async function parsePDF(file) {
  // PDF.js 또는 AI OCR 사용
  const arrayBuf = await file.arrayBuffer();
  // Claude AI OCR로 구조화
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  return { type: 'pdf', base64, fileName: file.name, rows: [], needsOCR: true };
}

async function parseImage(file) {
  const arrayBuf = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
  return { type: 'image', base64, fileName: file.name, rows: [], needsOCR: true };
}

// ── 미리보기 테이블 ──

function renderPreview(data) {
  const wrap = document.getElementById('previewWrap');
  const head = document.getElementById('previewHead');
  const body = document.getElementById('previewBody');

  if (!data.rows || data.rows.length === 0) {
    if (data.needsOCR) {
      wrap.style.display = '';
      head.innerHTML = '<tr><th>AI OCR 필요</th></tr>';
      body.innerHTML = '<tr><td>실행 시 Claude API로 문서를 분석합니다</td></tr>';
    }
    return;
  }

  const headers = data.headers || Object.keys(data.rows[0]);
  head.innerHTML = '<tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr>';
  body.innerHTML = data.rows.slice(0, 50).map(row =>
    '<tr>' + headers.map(h => `<td>${row[h] ?? ''}</td>`).join('') + '</tr>'
  ).join('');
  wrap.style.display = '';
}

// ── 워크플로우 실행 ──

/** 1단계: 데이터 파싱 + 미리보기 (이카운트 저장 안 함) */
async function executeWorkflow() {
  if (!currentWorkflow || isExecuting) return;
  isExecuting = true;
  pendingWfData = null;
  document.getElementById('btnExecute').disabled = true;
  document.getElementById('btnSaveToEcount').style.display = 'none';
  document.getElementById('btnCancel').disabled = false;
  document.getElementById('statusLog').style.display = '';
  document.getElementById('progressBar').classList.add('active');

  addLog(`워크플로우 실행 시작: ${currentWorkflow}`, 'info');

  try {
    let wfData = {};

    if (currentWorkflow === 'kakao-order') {
      const kakaoText = document.getElementById('wfTextInput').value.trim();
      if (!kakaoText) throw new Error('카톡 주문 내용을 입력해주세요');
      addLog('카톡 주문 AI 파싱 중...', 'info');
      const kakaoRows = await parseKakaoOrderText(kakaoText);
      addLog(`AI 파싱 완료: ${kakaoRows.length}건 추출`, 'success');

      const previewData = {
        headers: ['거래처', '제품코드', '제품명', '수량', '단가', '금액', '배송지', '메모'],
        rows: kakaoRows.map(r => ({
          '거래처': r.customerName || '',
          '제품코드': r.prodCode || '',
          '제품명': r.prodName || '',
          '수량': r.qty || '',
          '단가': r.unitPrice ? Number(r.unitPrice).toLocaleString() : '',
          '금액': r.amount ? Number(r.amount).toLocaleString() : '',
          '배송지': r.deliveryAddress || '',
          '메모': r.memo || '',
        })),
      };
      renderPreview(previewData);
      wfData = { rows: kakaoRows };

    } else if (currentWorkflow === 'pre-quote') {
      wfData.width = Number(document.getElementById('boxW')?.value || 0);
      wfData.height = Number(document.getElementById('boxH')?.value || 0);
      wfData.depth = Number(document.getElementById('boxD')?.value || 0);
      wfData.qty = Number(document.getElementById('boxQty')?.value || 100);

    } else if (currentWorkflow === 'pg-settlement-register' && parsedData) {
      wfData = {
        rows: parsePGSettlementRows(parsedData),
        defaults: {
          custCode: document.getElementById('pgCustCode')?.value || '',
          prodCode: document.getElementById('pgProdCode')?.value || '',
        },
      };
      addLog(`PG정산 데이터: ${wfData.rows.length}건 (환불 ${wfData.rows.filter(r => r.isRefund).length}건 제외)`, 'info');

    } else if (currentWorkflow === 'pg-settlement-reconcile' && parsedData) {
      const pgRows = parsePGSettlementRows(parsedData);
      const source = document.getElementById('pgRecSource')?.value || 'api';
      wfData = {
        pgRows,
        dateFrom: document.getElementById('pgRecFrom')?.value || '',
        dateTo: document.getElementById('pgRecTo')?.value || '',
      };
      if (source === 'scrape' || source === 'both') {
        addLog('ECOUNT 화면에서 데이터 추출 시도...', 'info');
        try {
          const tabs = await chrome.tabs.query({ url: '*://*.ecount.com/*' });
          if (tabs.length > 0) {
            const scraped = await chrome.tabs.sendMessage(tabs[0].id, { action: 'extractTableData' });
            if (scraped?.data?.length > 0) {
              wfData.ecountTableData = scraped.data;
              addLog(`ECOUNT 화면에서 ${scraped.data.length}건 추출`, 'success');
            }
          } else {
            addLog('ECOUNT 탭이 열려있지 않습니다. API 조회로 진행합니다.', 'info');
          }
        } catch (e) {
          addLog(`화면 추출 실패: ${e.message}`, 'fail');
        }
      }
      addLog(`PG정산 ${pgRows.length}건 vs ECOUNT (${wfData.dateFrom} ~ ${wfData.dateTo}) 대사 시작`, 'info');

    } else if (currentWorkflow === 'pg-settlement-accounting' && parsedData) {
      const pgRows = parsePGSettlementRows(parsedData);
      const accountCodes = {
        bankDeposit: document.getElementById('acctBank')?.value || '1110101',
        pgFee: document.getElementById('acctFee')?.value || '5230501',
        inputVat: document.getElementById('acctVat')?.value || '1350101',
        sales: document.getElementById('acctSales')?.value || '4010101',
      };
      wfData = { entries: generateJournalEntriesLocal(pgRows, accountCodes) };
      addLog(`회계 분개 ${wfData.entries.length}건 생성 완료`, 'info');
      renderJournalPreview(wfData.entries);

    } else if (parsedData) {
      wfData = parsedData;
    }

    // OCR 필요 시
    if (wfData.needsOCR) {
      addLog('AI OCR 처리 중...', 'info');
      wfData = await performAIOCR(wfData);
      addLog(`OCR 완료: ${wfData.rows?.length || 0}건 추출`, 'success');
      renderPreview(wfData);
    }

    // 파싱 완료 — 저장 대기 상태로 전환
    pendingWfData = wfData;
    addLog('데이터 확인 후 [이카운트 저장] 버튼을 눌러주세요.', 'info');
    document.getElementById('btnSaveToEcount').style.display = '';
    document.getElementById('btnExecute').disabled = false;
    document.getElementById('btnExecute').textContent = '다시 파싱';

  } catch (e) {
    addLog(`실행 오류: ${e.message}`, 'fail');
    toast(`실행 실패: ${e.message}`, 'error');
    document.getElementById('btnExecute').disabled = false;
  }

  isExecuting = false;
  document.getElementById('btnCancel').disabled = true;
}

/** 2단계: 이카운트 저장 (미리보기 확인 후) */
async function saveToEcount() {
  if (!pendingWfData || !currentWorkflow) {
    toast('저장할 데이터가 없습니다. 먼저 실행해주세요.', 'error');
    return;
  }

  isExecuting = true;
  document.getElementById('btnSaveToEcount').disabled = true;
  document.getElementById('btnExecute').disabled = true;
  document.getElementById('btnCancel').disabled = false;

  addLog(`이카운트 저장 시작: ${currentWorkflow}`, 'info');

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'executeWorkflow',
      workflowId: currentWorkflow,
      data: pendingWfData,
    });

    if (result.success) {
      if (currentWorkflow === 'pg-settlement-reconcile' && result.reconcileResult) {
        renderReconcileResult(result.reconcileResult);
        const s = result.reconcileResult.summary;
        addLog(`대사 완료: 매칭 ${s.matched}건, 금액불일치 ${s.amountMismatch}건, PG미등록 ${s.pgOnly}건, ECOUNT미등록 ${s.ecountOnly}건`, 'success');
        toast(`대사 완료 (매칭률 ${s.matchRate}%)`, 'success');
      } else {
        const summary = result.summary;
        if (summary) {
          addLog(`저장 완료: 성공 ${summary.success}건 / 실패 ${summary.fail}건 (전체 ${summary.total}건)`, summary.fail > 0 ? 'fail' : 'success');

          // 실패 상세 표시
          if (result.results) {
            result.results.filter(r => !r.success).forEach(r => {
              addLog(`  실패: ${r.orderNo || r.row?.prodName || '?'} — ${r.error}`, 'fail');
            });
          }
        } else {
          addLog(`저장 완료: ${result.results?.length || 1}건 처리`, 'success');
        }
        toast('이카운트 저장 완료', 'success');
      }
      updateProgress(100);
      await saveHistory({ workflowId: currentWorkflow, count: result.summary?.total || 1, success: true });

      // API 응답 상세 로그 (SlipNo, SuccessCnt, FailCnt, ResultDetails)
      if (result.results) {
        addLog(`API 응답 상세:`, 'info');
        result.results.forEach((r, i) => {
          const status = r.success ? 'success' : 'fail';
          if (r.success) {
            const slips = (r.slipNos || []).join(', ') || '(SlipNo 없음)';
            addLog(`  [${i + 1}] 성공 — IO_DATE=${r.ioDate || '?'}, SlipNo=${slips}, SuccessCnt=${r.successCnt ?? '?'}`, 'success');
          } else {
            addLog(`  [${i + 1}] 실패 — ${r.error}`, 'fail');
            // ResultDetails 에러 상세
            if (r.resultDetails && r.resultDetails.length > 0) {
              r.resultDetails.forEach(d => {
                if (d.Errors || d.TotalError) {
                  addLog(`    에러상세: ${d.TotalError || JSON.stringify(d.Errors)}`, 'fail');
                }
              });
            }
          }
        });
      }
    } else {
      addLog(`저장 오류: ${result.error}`, 'fail');
      toast(result.error, 'error');
    }
  } catch (e) {
    addLog(`저장 오류: ${e.message}`, 'fail');
    toast(`저장 실패: ${e.message}`, 'error');
  }

  pendingWfData = null;
  isExecuting = false;
  document.getElementById('btnSaveToEcount').style.display = 'none';
  document.getElementById('btnSaveToEcount').disabled = false;
  document.getElementById('btnExecute').disabled = false;
  document.getElementById('btnExecute').textContent = '실행';
  document.getElementById('btnCancel').disabled = true;
}

function cancelWorkflow() {
  isExecuting = false;
  pendingWfData = null;
  addLog('사용자에 의해 취소됨', 'fail');
  document.getElementById('btnExecute').disabled = false;
  document.getElementById('btnExecute').textContent = '실행';
  document.getElementById('btnSaveToEcount').style.display = 'none';
  document.getElementById('btnCancel').disabled = true;
}

// ── AI OCR ──

async function performAIOCR(data) {
  const mediaType = data.type === 'pdf' ? 'application/pdf' : 'image/jpeg';
  const prompt = currentWorkflow === 'invoice-ocr'
    ? 'PDF 인보이스에서 다음 정보를 추출해 JSON으로 반환: invoiceNo, date, vendorName, vendorCode, items(prodCode, description, qty, unitPrice, amount), totalAmount, supplyAmount, vatAmount, currency'
    : currentWorkflow === 'receipt-ocr'
    ? '영수증에서 다음 정보를 추출해 JSON으로 반환: date, storeName, category(식비/교통비/사무용품/기타), items(name, qty, price), totalAmount, paymentMethod'
    : '문서에서 구조화된 데이터를 JSON 배열로 추출해주세요.';

  const text = await callAIVision(data.base64, mediaType, prompt);

  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[1]);
    const rows = Array.isArray(parsed) ? parsed : parsed.items || [parsed];
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { ...data, rows, headers, needsOCR: false, ocrResult: parsed };
  }
  return { ...data, rows: [], needsOCR: false, ocrRawText: text };
}

// ── 설정 ──

function initSettings() {
  // 이카운트 연결
  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const comCode = document.getElementById('setComCode').value.trim();
    const userId = document.getElementById('setUserId').value.trim();
    const apiKey = document.getElementById('setApiKey').value.trim();

    if (!comCode || !userId || !apiKey) {
      toast('모든 필드를 입력하세요', 'error');
      return;
    }

    toast('연결 테스트 중...', 'info');
    const result = await chrome.runtime.sendMessage({
      action: 'testConnection',
      comCode, userId, apiCertKey: apiKey,
    });

    if (result.success) {
      toast('이카운트 연결 성공!', 'success');
      updateConnectionStatus(true);
    } else {
      toast(`연결 실패: ${result.error}`, 'error');
    }
  });

  // AI 프로바이더 선택
  const providerSelect = document.getElementById('setAiProvider');
  providerSelect.addEventListener('change', async () => {
    const provider = providerSelect.value;
    await chrome.storage.local.set({ ai_provider: provider });
    toggleProviderSections(provider);
    const labels = { gemini: 'Google Gemini (무료)', opencode: 'OpenCode (무료)', anthropic: 'Anthropic Claude' };
    toast(`AI: ${labels[provider]} 선택됨`, 'info');
  });

  // Gemini 키 저장
  document.getElementById('btnSaveGeminiKey').addEventListener('click', async () => {
    const input = document.getElementById('setGeminiKey');
    const rawKey = input.value.trim();
    const key = rawKey.replace(/[^\x20-\x7E]/g, '');
    const hasStoredKey = input.dataset.hasStoredKey === 'true';

    if (!rawKey) {
      toast(hasStoredKey ? '기존 Gemini 키를 그대로 사용합니다' : 'Gemini API 키를 입력하세요', hasStoredKey ? 'info' : 'error');
      return;
    }
    if (rawKey === MASKED_SECRET || key !== rawKey) {
      toast('실제 Gemini API 키를 입력하세요', 'error');
      return;
    }

    await chrome.storage.local.set({ gemini_api_key: key });
    input.value = '';
    input.dataset.hasStoredKey = 'true';
    input.placeholder = '저장된 Gemini 키가 있습니다. 변경 시에만 새 키를 입력하세요';
    toast('Gemini API 키 저장됨', 'success');
  });

  // OpenCode 키 저장
  document.getElementById('btnSaveOpenCodeKey').addEventListener('click', async () => {
    const input = document.getElementById('setOpenCodeKey');
    const rawKey = input.value.trim();
    const key = rawKey.replace(/[^\x20-\x7E]/g, '');
    const hasStoredKey = input.dataset.hasStoredKey === 'true';

    if (!rawKey) {
      toast(hasStoredKey ? '기존 OpenCode 키를 그대로 사용합니다' : 'OpenCode API 키를 입력하세요', hasStoredKey ? 'info' : 'error');
      return;
    }
    if (rawKey === MASKED_SECRET || key !== rawKey) {
      toast('실제 OpenCode API 키를 입력하세요', 'error');
      return;
    }

    await chrome.storage.local.set({ opencode_api_key: key });
    input.value = '';
    input.dataset.hasStoredKey = 'true';
    input.placeholder = '저장된 OpenCode 키가 있습니다. 변경 시에만 새 키를 입력하세요';
    toast('OpenCode API 키 저장됨', 'success');
  });

  // Anthropic 키 저장
  document.getElementById('btnSaveAiKey').addEventListener('click', async () => {
    const input = document.getElementById('setAnthropicKey');
    const rawKey = input.value.trim();
    const key = rawKey.replace(/[^\x20-\x7E]/g, '');
    const hasStoredKey = input.dataset.hasStoredKey === 'true';

    if (!rawKey) {
      toast(hasStoredKey ? '기존 Anthropic 키를 그대로 사용합니다' : 'Anthropic API 키를 입력하세요', hasStoredKey ? 'info' : 'error');
      return;
    }
    if (rawKey === MASKED_SECRET || key !== rawKey) {
      toast('실제 Anthropic API 키를 입력하세요', 'error');
      return;
    }

    await chrome.storage.local.set({ anthropic_api_key: key });
    input.value = '';
    input.dataset.hasStoredKey = 'true';
    input.placeholder = '저장된 Anthropic 키가 있습니다. 변경 시에만 새 키를 입력하세요';
    toast('Anthropic API 키 저장됨', 'success');
  });

  // 이카운트 기본값 저장
  document.getElementById('btnSaveDefaults').addEventListener('click', async () => {
    const whCode = document.getElementById('setDefaultWH').value.trim();
    const deptCode = document.getElementById('setDefaultDept').value.trim();
    const custCode = document.getElementById('setDefaultCust').value.trim();

    if (!whCode || !deptCode) {
      toast('출하창고와 부서코드는 필수입니다', 'error');
      return;
    }

    await chrome.storage.local.set({
      ecount_defaults: { whCode, deptCode, custCode },
    });
    toast('기본값 저장 완료', 'success');
  });

  // 데이터 관리
  document.getElementById('btnClearData').addEventListener('click', async () => {
    if (confirm('모든 데이터를 초기화합니까?')) {
      await chrome.storage.local.clear();
      toast('데이터 초기화 완료', 'info');
      updateConnectionStatus(false);
    }
  });

  // 저장된 설정 불러오기
  loadSettings();
}

function toggleProviderSections(provider) {
  document.getElementById('sectionGemini').style.display = provider === 'gemini' ? '' : 'none';
  document.getElementById('sectionOpenCode').style.display = provider === 'opencode' ? '' : 'none';
  document.getElementById('sectionAnthropic').style.display = provider === 'anthropic' ? '' : 'none';
}

async function loadSettings() {
  const data = await chrome.storage.local.get(['ecount_credentials', 'anthropic_api_key', 'opencode_api_key', 'gemini_api_key', 'ai_provider', 'ecount_defaults']);
  if (data.ecount_credentials) {
    document.getElementById('setComCode').value = data.ecount_credentials.comCode || '';
    document.getElementById('setUserId').value = data.ecount_credentials.userId || '';
    document.getElementById('setApiKey').value = data.ecount_credentials.apiCertKey || '';
  } else {
    document.getElementById('setComCode').value = '184153';
    document.getElementById('setUserId').value = 'CNCKOREA21';
    document.getElementById('setApiKey').value = '41ec028204662486ba634e26ff525a0c15';
  }

  // AI 프로바이더 선택 복원
  const provider = data.ai_provider || 'gemini';
  document.getElementById('setAiProvider').value = provider;
  toggleProviderSections(provider);

  // Gemini 키 로드
  loadKeyInput('setGeminiKey', data.gemini_api_key, 'gemini_api_key', 'AIzaSy...');

  // OpenCode 키 로드
  loadKeyInput('setOpenCodeKey', data.opencode_api_key, 'opencode_api_key', 'sk-Lnb...');

  // Anthropic 키 로드
  loadKeyInput('setAnthropicKey', data.anthropic_api_key, 'anthropic_api_key', 'sk-ant-...');

  // 이카운트 기본값 로드
  if (data.ecount_defaults) {
    document.getElementById('setDefaultWH').value = data.ecount_defaults.whCode || '';
    document.getElementById('setDefaultDept').value = data.ecount_defaults.deptCode || '';
    document.getElementById('setDefaultCust').value = data.ecount_defaults.custCode || '';
  }
}

async function loadKeyInput(inputId, storedKey, storageKey, defaultPlaceholder) {
  const input = document.getElementById(inputId);
  input.value = '';
  if (storedKey && storedKey !== MASKED_SECRET && /^[\x20-\x7E]+$/.test(storedKey)) {
    input.dataset.hasStoredKey = 'true';
    input.placeholder = '저장된 키가 있습니다. 변경 시에만 새 키를 입력하세요';
  } else {
    if (storedKey) await chrome.storage.local.remove(storageKey);
    input.dataset.hasStoredKey = 'false';
    input.placeholder = defaultPlaceholder;
  }
}

// ── 연결 상태 ──

async function checkConnection() {
  const data = await chrome.storage.local.get('ecount_session');
  const session = data.ecount_session;
  if (session && Date.now() - session.savedAt < 24 * 60 * 60 * 1000) {
    updateConnectionStatus(true);
  }
}

function updateConnectionStatus(connected) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('connectionText');
  if (connected) {
    dot.classList.add('connected');
    text.textContent = '이카운트 연결됨';
  } else {
    dot.classList.remove('connected');
    text.textContent = '이카운트 미연결';
  }
}

document.getElementById('btnConnect').addEventListener('click', () => {
  // 설정 탭으로 이동
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-page').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('tab-settings').classList.add('active');
});

// ── 보고서 ──

function initReports() {
  // 기본 날짜 설정
  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  document.getElementById('reportFrom').value = monthAgo.toISOString().slice(0, 10);
  document.getElementById('reportTo').value = today.toISOString().slice(0, 10);

  document.getElementById('btnGenReport').addEventListener('click', async () => {
    const type = document.getElementById('reportType').value;
    const from = document.getElementById('reportFrom').value;
    const to = document.getElementById('reportTo').value;

    toast('보고서 생성 중...', 'info');
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'executeWorkflow',
        workflowId: 'daily-report',
        data: { reportType: type, fromDate: from, toDate: to },
      });
      if (result.success) {
        document.getElementById('reportPreview').innerHTML =
          `<div style="padding:8px;background:var(--success-bg);border-radius:6px;">보고서 생성 완료</div>`;
        toast('보고서 생성 완료', 'success');
      } else {
        toast(`보고서 오류: ${result.error}`, 'error');
      }
    } catch (e) {
      toast(`오류: ${e.message}`, 'error');
    }
  });
}

// ── 통계 ──

function initStats() {
  document.querySelectorAll('.stat-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const statId = btn.dataset.stat;
      toast(`${statId} 데이터 조회 중...`, 'info');
      // TODO: 이카운트 API 호출 후 차트/테이블 렌더링
    });
  });
}

// ── 이력 ──

async function loadHistory() {
  const data = await chrome.storage.local.get('workflow_history');
  const history = data.workflow_history || [];
  const list = document.getElementById('historyList');

  if (history.length === 0) {
    list.innerHTML = '<span style="color:var(--gray-500);">실행 이력이 없습니다</span>';
    return;
  }

  list.innerHTML = history.slice(0, 10).map(h => {
    const date = new Date(h.timestamp).toLocaleString('ko-KR');
    const icon = h.success ? '✅' : '❌';
    return `<div style="margin-bottom:4px;">${icon} ${date} — ${h.workflowId} (${h.count}건)</div>`;
  }).join('');
}

async function saveHistory(entry) {
  const data = await chrome.storage.local.get('workflow_history');
  const history = data.workflow_history || [];
  history.unshift({ ...entry, timestamp: Date.now() });
  if (history.length > 100) history.length = 100;
  await chrome.storage.local.set({ workflow_history: history });
  await loadHistory();
}

// ── 유틸리티 ──

function addLog(message, type = 'info') {
  const log = document.getElementById('statusLog');
  log.style.display = '';
  const div = document.createElement('div');
  div.className = `log-entry ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString('ko-KR')}] ${message}`;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function updateProgress(percent) {
  const bar = document.getElementById('progressBar');
  bar.classList.add('active');
  document.getElementById('progressFill').style.width = `${percent}%`;
}

function toast(message, type = 'info') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

async function getStoredValue(key) {
  const data = await chrome.storage.local.get(key);
  const val = data[key] || null;
  return typeof val === 'string' ? val.trim() : val;
}

/** 현재 선택된 AI 프로바이더와 API 키 반환 */
async function getAIConfig() {
  const data = await chrome.storage.local.get(['ai_provider', 'gemini_api_key', 'opencode_api_key', 'anthropic_api_key']);
  const provider = data.ai_provider || 'gemini';
  const keyMap = { gemini: 'gemini_api_key', opencode: 'opencode_api_key', anthropic: 'anthropic_api_key' };
  const labels = { gemini: 'Gemini', opencode: 'OpenCode', anthropic: 'Anthropic' };

  const apiKey = data[keyMap[provider]];
  if (!apiKey || apiKey === MASKED_SECRET || !/^[\x20-\x7E]+$/.test(apiKey)) {
    throw new Error(`${labels[provider]} API 키가 설정되지 않았습니다 (설정 탭에서 입력)`);
  }
  return { provider, apiKey };
}

/** AI 채팅 API 호출 — 프로바이더별 분기 */
async function callAI(messages, { maxTokens = 4096 } = {}) {
  const { provider, apiKey } = await getAIConfig();

  if (provider === 'gemini') {
    return await callGemini(apiKey, messages, maxTokens);
  }
  if (provider === 'opencode') {
    return await callOpenCode(apiKey, 'deepseek-v4-flash', messages, maxTokens);
  }
  return await callAnthropic(apiKey, messages, maxTokens);
}

/** AI Vision API 호출 — 이미지 포함 */
async function callAIVision(base64Data, mediaType, prompt, { maxTokens = 4096 } = {}) {
  const { provider, apiKey } = await getAIConfig();

  if (provider === 'gemini') {
    return await callGeminiVision(apiKey, base64Data, mediaType, prompt, maxTokens);
  }
  if (provider === 'opencode') {
    const messages = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:${mediaType};base64,${base64Data}` } },
        { type: 'text', text: prompt },
      ],
    }];
    return await callOpenCode(apiKey, 'mimo-v2-pro', messages, maxTokens);
  }
  // anthropic vision
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic API 오류: ${err.error?.message || res.statusText}`);
  }
  const result = await res.json();
  return result.content?.[0]?.text || '';
}

// ── 프로바이더별 호출 함수 ──

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];

async function callGemini(apiKey, messages, maxTokens) {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : m.content }],
  }));

  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    if (res.ok) {
      const result = await res.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 429 || (err.error?.message || '').includes('high demand')) {
      console.log(`[CNC-ERP] ${model} 과부하, 다음 모델 시도...`);
      continue;
    }
    throw new Error(`Gemini API 오류: ${err.error?.message || res.statusText}`);
  }
  throw new Error('Gemini 모델 모두 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
}

async function callGeminiVision(apiKey, base64Data, mediaType, prompt, maxTokens) {
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: mediaType, data: base64Data } },
            { text: prompt },
          ],
        }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    if (res.ok) {
      const result = await res.json();
      return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 503 || res.status === 429 || (err.error?.message || '').includes('high demand')) {
      console.log(`[CNC-ERP] ${model} 과부하, 다음 모델 시도...`);
      continue;
    }
    throw new Error(`Gemini Vision API 오류: ${err.error?.message || res.statusText}`);
  }
  throw new Error('Gemini 모델 모두 과부하 상태입니다. 잠시 후 다시 시도해주세요.');
}

async function callOpenCode(apiKey, model, messages, maxTokens) {
  const res = await fetch('https://opencode.ai/zen/go/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenCode API 오류: ${err.error?.message || res.statusText}`);
  }
  const result = await res.json();
  return result.choices?.[0]?.message?.content || '';
}

async function callAnthropic(apiKey, messages, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Anthropic API 오류: ${err.error?.message || res.statusText}`);
  }
  const result = await res.json();
  return result.content?.[0]?.text || '';
}

// ── 카톡 주문 AI 파싱 ──

async function parseKakaoOrderText(text) {
  const prompt = `다음은 카카오톡으로 받은 B2B 주문 메시지입니다.
이를 이카운트 ERP 판매입력 양식으로 변환해주세요.

주문 메시지:
${text}

다음 JSON 배열로 반환:
[
  {
    "customerName": "거래처명",
    "custCode": "거래처코드 (알 수 없으면 빈 문자열)",
    "prodCode": "제품코드 (알 수 없으면 빈 문자열)",
    "prodName": "제품명",
    "qty": 수량(숫자),
    "unitPrice": 단가(숫자, 모르면 0),
    "amount": 금액(숫자, 모르면 0),
    "orderDate": "YYYYMMDD 형식 주문일 (오늘이면 빈 문자열)",
    "deliveryAddress": "배송지 주소",
    "memo": "비고/요청사항"
  }
]

규칙:
- 여러 품목이 있으면 각각 별도 행으로
- 수량 x 단가로 금액 계산 가능하면 계산
- 배송지가 여러 줄이면 한 줄로 합치기
- JSON만 반환하세요.`;

  const responseText = await callAI([{ role: 'user', content: prompt }]);

  const codeBlock = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) return JSON.parse(codeBlock[1].trim());
  const jsonMatch = responseText.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[1]);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  throw new Error('AI 응답에서 주문 데이터를 추출할 수 없습니다');
}

// ── PG정산 헬퍼 함수 ──

/** 파싱된 엑셀 데이터에서 PG정산 행 추출 */
function parsePGSettlementRows(data) {
  if (!data?.rows) return [];

  return data.rows
    .filter(row => {
      // 소계/합계/요약 행 제외
      const firstVal = Object.values(row)[0] || '';
      if (typeof firstVal === 'string') {
        if (firstVal.includes('요약') || firstVal.includes('합계') || firstVal.endsWith('계')) return false;
      }
      // 주문번호 없는 행 제외
      const orderNo = findPGValue(row, ['주문번호', '주문No', 'ORDER_NO']);
      return !!orderNo;
    })
    .map(row => ({
      paymentDate: formatPGDate(findPGValue(row, ['지급일', '정산일', '입금일', '지급예정일'])),
      approvalDate: formatPGDate(findPGValue(row, ['승인일', '거래일', '매출일'])),
      orderNo: String(findPGValue(row, ['주문번호', '주문No', 'ORDER_NO'])).trim(),
      transactionAmount: parsePGAmount(findPGValue(row, ['거래금액', '매출금액', '결제금액', '거래액'])),
      fee: parsePGAmount(findPGValue(row, ['수수료', 'PG수수료', '결제수수료'])),
      feeVat: parsePGAmount(findPGValue(row, ['부가세', '수수료부가세', 'VAT'])),
      netAmount: parsePGAmount(findPGValue(row, ['지급액', '정산금액', '입금액', '지급금액'])),
      isRefund: parsePGAmount(findPGValue(row, ['거래금액', '매출금액', '결제금액', '거래액'])) < 0,
    }));
}

function findPGValue(obj, keys) {
  for (const k of keys) {
    for (const [objKey, val] of Object.entries(obj)) {
      const normalizedKey = objKey.replace(/\s+/g, ' ').replace(/합계\s*[:：]\s*/g, '').trim();
      if (normalizedKey.includes(k) || k.includes(normalizedKey)) return val;
    }
  }
  return '';
}

function formatPGDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    return `${val.getFullYear()}${String(val.getMonth()+1).padStart(2,'0')}${String(val.getDate()).padStart(2,'0')}`;
  }
  return String(val).replace(/[-/.]/g, '').slice(0, 8);
}

function parsePGAmount(val) {
  if (typeof val === 'number') return Math.round(val);
  return Math.round(Number(String(val).replace(/[^0-9.\-]/g, '')) || 0);
}

/** 회계 분개 생성 (로컬) */
function generateJournalEntriesLocal(rows, accountCodes) {
  const codes = {
    bankDeposit: accountCodes.bankDeposit || '1110101',
    pgFee: accountCodes.pgFee || '5230501',
    inputVat: accountCodes.inputVat || '1350101',
    sales: accountCodes.sales || '4010101',
    salesReturn: accountCodes.salesReturn || '4010201',
  };

  // 지급일별 그룹핑
  const groups = {};
  for (const row of rows) {
    const date = row.paymentDate || 'unknown';
    if (!groups[date]) groups[date] = [];
    groups[date].push(row);
  }

  const entries = [];
  for (const [date, dateRows] of Object.entries(groups)) {
    const salesRows = dateRows.filter(r => !r.isRefund);
    const refundRows = dateRows.filter(r => r.isRefund);

    if (salesRows.length > 0) {
      const totalTx = salesRows.reduce((s, r) => s + r.transactionAmount, 0);
      const totalFee = salesRows.reduce((s, r) => s + r.fee, 0);
      const totalVat = salesRows.reduce((s, r) => s + r.feeVat, 0);
      const totalNet = salesRows.reduce((s, r) => s + r.netAmount, 0);

      entries.push({
        date,
        type: 'sale',
        description: `PG정산 이니시스 ${salesRows.length}건 (${formatDateDisplay(date)})`,
        orderCount: salesRows.length,
        debit: [
          { account: codes.bankDeposit, accountName: '보통예금', amount: totalNet },
          { account: codes.pgFee, accountName: '지급수수료', amount: totalFee },
          { account: codes.inputVat, accountName: '부가세대급금', amount: totalVat },
        ],
        credit: [
          { account: codes.sales, accountName: '상품매출', amount: totalTx },
        ],
      });
    }

    if (refundRows.length > 0) {
      const totalTx = Math.abs(refundRows.reduce((s, r) => s + r.transactionAmount, 0));
      const totalFee = Math.abs(refundRows.reduce((s, r) => s + r.fee, 0));
      const totalVat = Math.abs(refundRows.reduce((s, r) => s + r.feeVat, 0));
      const totalNet = Math.abs(refundRows.reduce((s, r) => s + r.netAmount, 0));

      entries.push({
        date,
        type: 'refund',
        description: `PG환불 이니시스 ${refundRows.length}건 (${formatDateDisplay(date)})`,
        orderCount: refundRows.length,
        debit: [
          { account: codes.salesReturn, accountName: '매출환입', amount: totalTx },
        ],
        credit: [
          { account: codes.bankDeposit, accountName: '보통예금', amount: totalNet },
          { account: codes.pgFee, accountName: '지급수수료', amount: totalFee },
          { account: codes.inputVat, accountName: '부가세대급금', amount: totalVat },
        ],
      });
    }
  }

  return entries;
}

function formatDateDisplay(d) {
  if (!d || d.length < 8) return d;
  return `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
}

function formatNumber(n) {
  return Number(n).toLocaleString('ko-KR');
}

/** 대사 결과 렌더링 */
function renderReconcileResult(result) {
  const wrap = document.getElementById('previewWrap');
  const head = document.getElementById('previewHead');
  const body = document.getElementById('previewBody');
  wrap.style.display = '';

  const s = result.summary;

  // 요약 카드 + 상세 테이블
  let html = `
    <tr><td colspan="6" style="padding:0">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:8px;background:var(--gray-50);">
        <div style="text-align:center;padding:8px;background:#fff;border-radius:6px;border:1px solid var(--gray-200);">
          <div style="font-size:10px;color:var(--gray-500);">매칭률</div>
          <div style="font-size:18px;font-weight:700;color:${s.matchRate >= 90 ? 'var(--success)' : s.matchRate >= 70 ? 'var(--warning)' : 'var(--danger)'}">${s.matchRate}%</div>
        </div>
        <div style="text-align:center;padding:8px;background:#fff;border-radius:6px;border:1px solid var(--gray-200);">
          <div style="font-size:10px;color:var(--gray-500);">PG건수</div>
          <div style="font-size:16px;font-weight:700;">${s.totalPG}</div>
        </div>
        <div style="text-align:center;padding:8px;background:#fff;border-radius:6px;border:1px solid var(--gray-200);">
          <div style="font-size:10px;color:var(--gray-500);">ECOUNT건수</div>
          <div style="font-size:16px;font-weight:700;">${s.totalEcount}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;padding:4px 8px 8px;background:var(--gray-50);">
        <div style="text-align:center;font-size:10px;"><span style="color:var(--success);font-weight:700;">${s.matched}</span><br>매칭</div>
        <div style="text-align:center;font-size:10px;"><span style="color:var(--warning);font-weight:700;">${s.amountMismatch}</span><br>금액불일치</div>
        <div style="text-align:center;font-size:10px;"><span style="color:var(--danger);font-weight:700;">${s.pgOnly}</span><br>PG만</div>
        <div style="text-align:center;font-size:10px;"><span style="color:var(--danger);font-weight:700;">${s.ecountOnly}</span><br>ECOUNT만</div>
      </div>
      ${Math.abs(s.amountDiff) > 0 ? `<div style="padding:4px 8px 8px;background:var(--gray-50);font-size:10px;text-align:center;color:var(--danger);">금액 차이: ${formatNumber(s.amountDiff)}원</div>` : ''}
    </td></tr>`;

  // 금액 불일치 상세
  if (result.amountMismatch.length > 0) {
    html += `<tr><td colspan="6" style="background:var(--warning-bg);font-weight:700;font-size:11px;padding:6px 8px;">금액 불일치 (${result.amountMismatch.length}건)</td></tr>`;
    html += '<tr><th>주문번호</th><th>PG금액</th><th>ECOUNT금액</th><th>차이</th></tr>';
    for (const item of result.amountMismatch) {
      html += `<tr>
        <td>${item.pg.orderNo}</td>
        <td style="text-align:right">${formatNumber(item.pg.transactionAmount)}</td>
        <td style="text-align:right">${formatNumber(item.ecount.taxableAmount || 0)}</td>
        <td style="text-align:right;color:var(--danger);font-weight:600">${formatNumber(item.diff)}</td>
      </tr>`;
    }
  }

  // PG에만 있는 건
  if (result.pgOnly.length > 0) {
    html += `<tr><td colspan="6" style="background:var(--danger-bg);font-weight:700;font-size:11px;padding:6px 8px;">ECOUNT 미등록 (${result.pgOnly.length}건)</td></tr>`;
    html += '<tr><th>주문번호</th><th>승인일</th><th>거래금액</th><th>수수료</th><th>지급액</th></tr>';
    for (const pg of result.pgOnly.slice(0, 30)) {
      html += `<tr>
        <td>${pg.orderNo}</td>
        <td>${formatDateDisplay(pg.approvalDate)}</td>
        <td style="text-align:right">${formatNumber(pg.transactionAmount)}</td>
        <td style="text-align:right">${formatNumber(pg.fee)}</td>
        <td style="text-align:right">${formatNumber(pg.netAmount)}</td>
      </tr>`;
    }
    if (result.pgOnly.length > 30) {
      html += `<tr><td colspan="5" style="text-align:center;color:var(--gray-500);">... 외 ${result.pgOnly.length - 30}건</td></tr>`;
    }
  }

  // ECOUNT에만 있는 건
  if (result.ecountOnly.length > 0) {
    html += `<tr><td colspan="6" style="background:var(--primary-bg);font-weight:700;font-size:11px;padding:6px 8px;">PG정산 없음 (${result.ecountOnly.length}건)</td></tr>`;
    html += '<tr><th>주문번호</th><th>발행일</th><th>과세매출</th><th>카드매출</th><th>현금영수증</th></tr>';
    for (const ec of result.ecountOnly.slice(0, 30)) {
      html += `<tr>
        <td>${ec.orderNo}</td>
        <td>${formatDateDisplay(ec.issueDate)}</td>
        <td style="text-align:right">${formatNumber(ec.taxableAmount || 0)}</td>
        <td style="text-align:right">${formatNumber(ec.cardAmount || 0)}</td>
        <td style="text-align:right">${formatNumber(ec.cashReceiptAmount || 0)}</td>
      </tr>`;
    }
    if (result.ecountOnly.length > 30) {
      html += `<tr><td colspan="5" style="text-align:center;color:var(--gray-500);">... 외 ${result.ecountOnly.length - 30}건</td></tr>`;
    }
  }

  head.innerHTML = '';
  body.innerHTML = html;
}

/** 분개 미리보기 렌더링 */
function renderJournalPreview(entries) {
  const wrap = document.getElementById('previewWrap');
  const head = document.getElementById('previewHead');
  const body = document.getElementById('previewBody');
  wrap.style.display = '';

  let totalDebit = 0;
  let totalCredit = 0;

  let html = '';
  for (const entry of entries) {
    const bgColor = entry.type === 'refund' ? 'var(--danger-bg)' : 'var(--success-bg)';
    const label = entry.type === 'refund' ? '환불' : '매출';

    html += `<tr><td colspan="4" style="background:${bgColor};font-weight:700;font-size:11px;padding:6px 8px;">
      [${formatDateDisplay(entry.date)}] ${label} - ${entry.description}
    </td></tr>`;
    html += '<tr style="background:var(--gray-50)"><th>구분</th><th>계정과목</th><th style="text-align:right">차변(DR)</th><th style="text-align:right">대변(CR)</th></tr>';

    for (const d of entry.debit) {
      totalDebit += d.amount;
      html += `<tr>
        <td style="color:var(--primary);font-weight:600">차변</td>
        <td>${d.accountName} (${d.account})</td>
        <td style="text-align:right;font-weight:600">${formatNumber(d.amount)}</td>
        <td style="text-align:right;color:var(--gray-300)">-</td>
      </tr>`;
    }
    for (const c of entry.credit) {
      totalCredit += c.amount;
      html += `<tr>
        <td style="color:var(--danger);font-weight:600">대변</td>
        <td>${c.accountName} (${c.account})</td>
        <td style="text-align:right;color:var(--gray-300)">-</td>
        <td style="text-align:right;font-weight:600">${formatNumber(c.amount)}</td>
      </tr>`;
    }
  }

  html += `<tr style="background:var(--gray-100);font-weight:700;">
    <td colspan="2">합계</td>
    <td style="text-align:right">${formatNumber(totalDebit)}</td>
    <td style="text-align:right">${formatNumber(totalCredit)}</td>
  </tr>`;

  if (totalDebit !== totalCredit) {
    html += `<tr><td colspan="4" style="color:var(--danger);text-align:center;font-size:10px;">차대 불일치: ${formatNumber(totalDebit - totalCredit)}</td></tr>`;
  }

  head.innerHTML = '';
  body.innerHTML = html;
}

// ── 메시지 리스너 ──

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'workflowComplete') {
    addLog(`워크플로우 ${msg.workflowId} 완료`, 'success');
  }
  if (msg.action === 'progress') {
    const pct = Math.round((msg.current / msg.total) * 100);
    updateProgress(pct);
    addLog(`[${msg.current}/${msg.total}] ${msg.status}`, msg.status === 'success' ? 'success' : 'fail');
  }
});
