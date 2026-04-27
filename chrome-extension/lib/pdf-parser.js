/**
 * PDF 파서 — PDF.js 텍스트 추출 + 구조화
 * webpack 번들링 필요 (pdfjs-dist)
 */

import * as pdfjsLib from 'pdfjs-dist';

// PDF.js 워커 설정 (webpack에서 번들)
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * PDF에서 텍스트 추출
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ pages: string[], fullText: string }>}
 */
export async function extractTextFromPDF(buffer) {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pages.push(text);
  }

  return {
    pages,
    fullText: pages.join('\n'),
    pageCount: pdf.numPages,
  };
}

/**
 * PDF를 Base64로 변환 (AI OCR용)
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
export function pdfToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * PDF 인보이스 텍스트에서 기본 정보 추출 (정규식 기반)
 * AI OCR 전 1차 파싱 시도
 */
export function extractInvoiceFields(text) {
  const fields = {};

  // 인보이스 번호
  const invMatch = text.match(/(?:Invoice|INV|인보이스)\s*(?:#|No\.?|번호)?\s*:?\s*([A-Z0-9-]+)/i);
  if (invMatch) fields.invoiceNo = invMatch[1];

  // 날짜
  const dateMatch = text.match(/(?:Date|일자|날짜)\s*:?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i);
  if (dateMatch) fields.date = dateMatch[1];

  // 금액
  const totalMatch = text.match(/(?:Total|합계|총액|TOTAL)\s*:?\s*[$￦]?\s*([0-9,.]+)/i);
  if (totalMatch) fields.totalAmount = parseFloat(totalMatch[1].replace(/,/g, ''));

  // 공급가액
  const supplyMatch = text.match(/(?:Supply|공급가액|Subtotal)\s*:?\s*[$￦]?\s*([0-9,.]+)/i);
  if (supplyMatch) fields.supplyAmount = parseFloat(supplyMatch[1].replace(/,/g, ''));

  // VAT
  const vatMatch = text.match(/(?:VAT|부가세|Tax)\s*:?\s*[$￦]?\s*([0-9,.]+)/i);
  if (vatMatch) fields.vatAmount = parseFloat(vatMatch[1].replace(/,/g, ''));

  // 거래처
  const vendorMatch = text.match(/(?:From|Vendor|공급자|판매자)\s*:?\s*(.+)/i);
  if (vendorMatch) fields.vendorName = vendorMatch[1].trim();

  return fields;
}
