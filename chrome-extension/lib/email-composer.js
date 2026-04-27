/**
 * 이메일 작성기 — mailto/Gmail 링크 생성
 */

/**
 * mailto 링크 생성
 */
export function createMailtoLink({ to, cc, subject, body }) {
  const params = new URLSearchParams();
  if (cc) params.set('cc', cc);
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  return `mailto:${to}?${params.toString()}`;
}

/**
 * Gmail compose 링크 생성
 */
export function createGmailLink({ to, cc, subject, body }) {
  const params = new URLSearchParams({
    view: 'cm',
    to: to || '',
    su: subject || '',
    body: body || '',
  });
  if (cc) params.set('cc', cc);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * 견적서 메일 본문 생성
 */
export function composeQuoteEmail({ customerName, quoteNo, totalAmount, validDays = 30 }) {
  return {
    subject: `[CNC코리아] 견적서 송부 (${quoteNo})`,
    body: `${customerName} 담당자님께,

안녕하세요. CNC코리아입니다.

요청하신 견적서를 송부해 드립니다.

■ 견적번호: ${quoteNo}
■ 견적금액: ${Number(totalAmount).toLocaleString()}원 (VAT 포함)
■ 유효기간: 견적일로부터 ${validDays}일

첨부 견적서를 확인 부탁드리며,
궁금하신 점이 있으시면 언제든 연락 주시기 바랍니다.

감사합니다.

CNC코리아 드림`,
  };
}

/**
 * 물류센터 발송 메일 본문
 */
export function composeLogisticsEmail({ centerName, orderCount, date }) {
  return {
    subject: `[CNC코리아] ${date} 출고요청 (${orderCount}건)`,
    body: `${centerName} 담당자님,

안녕하세요. CNC코리아입니다.

금일 출고 요청 데이터를 첨부합니다.

■ 출고일: ${date}
■ 건수: ${orderCount}건

첨부 파일 확인 후 처리 부탁드립니다.

감사합니다.
CNC코리아`,
  };
}

/**
 * 채권 독촉 메일 본문
 */
export function composeAREmail({ customerName, totalBalance, overdueItems }) {
  const itemList = overdueItems.map(i =>
    `  - ${i.date} | ${i.description} | ${Number(i.amount).toLocaleString()}원 (${i.overdueDays}일 경과)`
  ).join('\n');

  return {
    subject: `[CNC코리아] 미수금 확인 요청`,
    body: `${customerName} 담당자님께,

안녕하세요. CNC코리아입니다.

아래 미수금 내역 확인 및 입금 처리를 요청드립니다.

■ 총 미수금: ${Number(totalBalance).toLocaleString()}원
■ 상세 내역:
${itemList}

빠른 확인 부탁드리며,
결제 관련 문의사항이 있으시면 연락 주시기 바랍니다.

감사합니다.
CNC코리아 경영지원팀`,
  };
}

/**
 * 급여명세서 발송 메일 본문
 */
export function composePayslipEmail({ employeeName, payMonth }) {
  return {
    subject: `[CNC코리아] ${payMonth} 급여명세서`,
    body: `${employeeName}님 안녕하세요.

${payMonth} 급여명세서를 송부합니다.
첨부 파일을 확인해 주시기 바랍니다.

문의사항이 있으시면 경영지원팀으로 연락 부탁드립니다.

감사합니다.
CNC코리아 경영지원팀`,
  };
}

/**
 * 새 탭에서 메일 열기
 */
export function openEmail({ to, cc, subject, body, useGmail = true }) {
  const url = useGmail
    ? createGmailLink({ to, cc, subject, body })
    : createMailtoLink({ to, cc, subject, body });
  window.open(url, '_blank');
}
