/**
 * 문서 생성기 — 견적서, 급여명세서, 보고서 등 엑셀/HTML 생성
 */

/**
 * 견적서 HTML 생성
 */
export function generateQuoteHTML({ companyName, customerName, items, date, quoteNo, validDays = 30 }) {
  const totalSupply = items.reduce((s, i) => s + (i.qty * i.unitPrice), 0);
  const vat = Math.round(totalSupply * 0.1);
  const total = totalSupply + vat;

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><title>견적서 ${quoteNo}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
  h1 { text-align: center; font-size: 24px; margin-bottom: 30px; }
  .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .info-box { width: 48%; }
  .info-box h3 { font-size: 14px; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 8px; }
  .info-box p { font-size: 12px; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  th { background: #2c3e50; color: #fff; padding: 8px; font-size: 12px; text-align: center; }
  td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; text-align: right; }
  td:first-child, td:nth-child(2) { text-align: left; }
  .total-row { font-weight: bold; background: #f8f9fa; }
  .footer { margin-top: 30px; font-size: 11px; color: #666; text-align: center; }
  .stamp { text-align: right; margin-top: 20px; }
</style></head>
<body>
  <h1>견 적 서</h1>
  <div class="info">
    <div class="info-box">
      <h3>수신</h3>
      <p><b>${customerName}</b> 귀하</p>
    </div>
    <div class="info-box">
      <h3>발신</h3>
      <p><b>${companyName || 'CNC코리아'}</b></p>
      <p>견적번호: ${quoteNo || ''}</p>
      <p>견적일자: ${formatDisplayDate(date)}</p>
      <p>유효기간: 견적일로부터 ${validDays}일</p>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>No</th><th>품목</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th></tr>
    </thead>
    <tbody>
      ${items.map((item, i) => `
      <tr>
        <td style="text-align:center">${i + 1}</td>
        <td>${item.prodName || item.description || ''}</td>
        <td>${item.spec || ''}</td>
        <td style="text-align:center">${item.qty.toLocaleString()}</td>
        <td>${item.unitPrice.toLocaleString()}</td>
        <td>${(item.qty * item.unitPrice).toLocaleString()}</td>
      </tr>`).join('')}
      <tr class="total-row">
        <td colspan="5" style="text-align:center">공급가액</td>
        <td>${totalSupply.toLocaleString()}원</td>
      </tr>
      <tr class="total-row">
        <td colspan="5" style="text-align:center">부가세(10%)</td>
        <td>${vat.toLocaleString()}원</td>
      </tr>
      <tr class="total-row">
        <td colspan="5" style="text-align:center"><b>합 계</b></td>
        <td><b>${total.toLocaleString()}원</b></td>
      </tr>
    </tbody>
  </table>
  <div class="stamp"><p>${companyName || 'CNC코리아'} (인)</p></div>
  <div class="footer">본 견적서는 ${validDays}일간 유효합니다.</div>
</body></html>`;
}

/**
 * 급여명세서 HTML 생성
 */
export function generatePayslipHTML({ employeeName, payMonth, basePay, overtimePay, bonus, totalPay, incomeTax, localTax, nationalPension, healthInsurance, employmentInsurance, totalDeduction, netPay }) {
  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>급여명세서</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; }
  h2 { text-align: center; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; font-size: 12px; }
  th { background: #f0f0f0; text-align: center; }
  td:last-child { text-align: right; }
  .highlight { background: #e8f5e9; font-weight: bold; }
</style></head>
<body>
  <h2>급여명세서</h2>
  <p style="text-align:center;font-size:13px;"><b>${employeeName}</b>님 | ${payMonth}</p>
  <table>
    <tr><th colspan="2">지급 항목</th><th colspan="2">공제 항목</th></tr>
    <tr><td>기본급</td><td>${fmt(basePay)}</td><td>소득세</td><td>${fmt(incomeTax)}</td></tr>
    <tr><td>시간외수당</td><td>${fmt(overtimePay)}</td><td>지방소득세</td><td>${fmt(localTax)}</td></tr>
    <tr><td>상여금</td><td>${fmt(bonus)}</td><td>국민연금</td><td>${fmt(nationalPension)}</td></tr>
    <tr><td></td><td></td><td>건강보험</td><td>${fmt(healthInsurance)}</td></tr>
    <tr><td></td><td></td><td>고용보험</td><td>${fmt(employmentInsurance)}</td></tr>
    <tr class="highlight"><td>총 지급액</td><td>${fmt(totalPay)}</td><td>총 공제액</td><td>${fmt(totalDeduction)}</td></tr>
  </table>
  <table><tr class="highlight"><td style="text-align:center"><b>실 수령액</b></td><td style="text-align:right;font-size:16px;"><b>${fmt(netPay)}</b></td></tr></table>
</body></html>`;
}

/**
 * 물류센터 양식 데이터 변환 (CSV 형태)
 */
export function generateLogisticsCSV(orders, centerFormat) {
  const formats = {
    cj: ['주문번호', '수령자명', '수령자연락처', '우편번호', '주소', '상품명', '수량', '배송메시지'],
    hanjin: ['주문번호', '받는분', '받는분전화', '받는분우편번호', '받는분주소', '품명', '수량', '메모'],
    lotte: ['주문번호', '수취인', '수취인핸드폰', '우편번호', '주소', '상품명', '수량', '배송메모'],
  };

  const headers = formats[centerFormat] || formats.cj;
  const rows = orders.map(o => [
    o.orderNo, o.receiverName, o.phone, o.zipCode, o.address,
    o.productName, o.qty, o.memo,
  ]);

  return [headers, ...rows].map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * 기업은행 이체현황서 CSV
 */
export function generateBankTransferCSV(payrollData) {
  const headers = ['이체일자', '수취인명', '수취은행', '수취계좌번호', '이체금액', '적요'];
  const rows = payrollData.map(p => [
    '', p.employeeName, p.bankName, p.accountNo, p.netPay, `급여 ${p.employeeName}`,
  ]);
  return [headers, ...rows].map(r => r.join(',')).join('\n');
}

// 유틸
function fmt(n) { return (Number(n) || 0).toLocaleString() + '원'; }
function formatDisplayDate(d) {
  if (!d) return new Date().toLocaleDateString('ko-KR');
  const s = String(d);
  if (s.length === 8) return `${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`;
  return s;
}
