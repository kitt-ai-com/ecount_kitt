/**
 * Side Panel 메인 컨트롤러 — CNC코리아 ERP 자동화
 */

// ── 상태 ──
let currentWorkflow = null;
let parsedData = null;
let isExecuting = false;

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
    document.getElementById('wfTextInput').placeholder = '카톡 주문 내용을 붙여넣기...\n\n예:\n상호: 홍길동 / 박스: A0001 x 50 / 테이프: T001 x 10\n배송지: 서울시 강남구...';
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

async function executeWorkflow() {
  if (!currentWorkflow || isExecuting) return;
  isExecuting = true;
  document.getElementById('btnExecute').disabled = true;
  document.getElementById('btnCancel').disabled = false;
  document.getElementById('statusLog').style.display = '';
  document.getElementById('progressBar').classList.add('active');

  addLog(`워크플로우 실행 시작: ${currentWorkflow}`, 'info');

  try {
    let wfData = {};

    // 워크플로우별 데이터 준비
    if (currentWorkflow === 'kakao-order') {
      wfData.text = document.getElementById('wfTextInput').value;
    } else if (currentWorkflow === 'pre-quote') {
      wfData.width = Number(document.getElementById('boxW')?.value || 0);
      wfData.height = Number(document.getElementById('boxH')?.value || 0);
      wfData.depth = Number(document.getElementById('boxD')?.value || 0);
      wfData.qty = Number(document.getElementById('boxQty')?.value || 100);
    } else if (parsedData) {
      wfData = parsedData;
    }

    // OCR 필요 시 Claude API 호출
    if (wfData.needsOCR) {
      addLog('AI OCR 처리 중...', 'info');
      wfData = await performAIOCR(wfData);
      addLog(`OCR 완료: ${wfData.rows?.length || 0}건 추출`, 'success');
      renderPreview(wfData);
    }

    // background로 워크플로우 실행 요청
    const result = await chrome.runtime.sendMessage({
      action: 'executeWorkflow',
      workflowId: currentWorkflow,
      data: wfData,
    });

    if (result.success) {
      const count = result.results?.length || 1;
      addLog(`완료: ${count}건 처리`, 'success');
      toast(`${count}건 처리 완료`, 'success');
      updateProgress(100);

      // 이력 저장
      await saveHistory({
        workflowId: currentWorkflow,
        count,
        success: true,
      });
    } else {
      addLog(`오류: ${result.error}`, 'fail');
      toast(result.error, 'error');
    }
  } catch (e) {
    addLog(`실행 오류: ${e.message}`, 'fail');
    toast(`실행 실패: ${e.message}`, 'error');
  }

  isExecuting = false;
  document.getElementById('btnExecute').disabled = false;
  document.getElementById('btnCancel').disabled = true;
}

function cancelWorkflow() {
  isExecuting = false;
  addLog('사용자에 의해 취소됨', 'fail');
  document.getElementById('btnExecute').disabled = false;
  document.getElementById('btnCancel').disabled = true;
}

// ── AI OCR ──

async function performAIOCR(data) {
  const apiKey = await getStoredValue('anthropic_api_key');
  if (!apiKey) {
    throw new Error('Claude API 키가 설정되지 않았습니다 (설정 탭에서 입력)');
  }

  const mediaType = data.type === 'pdf' ? 'application/pdf' : 'image/jpeg';
  const prompt = currentWorkflow === 'invoice-ocr'
    ? 'PDF 인보이스에서 다음 정보를 추출해 JSON으로 반환: invoiceNo, date, vendorName, vendorCode, items(prodCode, description, qty, unitPrice, amount), totalAmount, supplyAmount, vatAmount, currency'
    : currentWorkflow === 'receipt-ocr'
    ? '영수증에서 다음 정보를 추출해 JSON으로 반환: date, storeName, category(식비/교통비/사무용품/기타), items(name, qty, price), totalAmount, paymentMethod'
    : '문서에서 구조화된 데이터를 JSON 배열로 추출해주세요.';

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
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: data.base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  const result = await res.json();
  const text = result.content?.[0]?.text || '';

  // JSON 추출
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

  // AI 키 저장
  document.getElementById('btnSaveAiKey').addEventListener('click', async () => {
    const key = document.getElementById('setAnthropicKey').value.trim();
    if (key) {
      await chrome.storage.local.set({ anthropic_api_key: key });
      toast('AI API 키 저장됨', 'success');
    }
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

async function loadSettings() {
  const data = await chrome.storage.local.get(['ecount_credentials', 'anthropic_api_key']);
  if (data.ecount_credentials) {
    document.getElementById('setComCode').value = data.ecount_credentials.comCode || '';
    document.getElementById('setUserId').value = data.ecount_credentials.userId || '';
    document.getElementById('setApiKey').value = data.ecount_credentials.apiCertKey || '';
  } else {
    // 기본 인증 정보 프리필
    document.getElementById('setComCode').value = '184153';
    document.getElementById('setUserId').value = 'CNCKOREA21';
    document.getElementById('setApiKey').value = 'CNCKOREA21';
  }
  if (data.anthropic_api_key) {
    document.getElementById('setAnthropicKey').value = '••••••••';
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
  return data[key] || null;
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
