#!/usr/bin/env node
/**
 * 이카운트 MCP 서버
 * Claude에서 이카운트 ERP 데이터를 조회/입력할 수 있는 MCP 도구 제공
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const ZONE_URL = 'https://sboapi.ecount.com/OAPI/V2/Zone';
let sessionId = null;
let zone = null;
let baseUrl = null;

const server = new Server({
  name: 'ecount-mcp',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

// ── 인증 ──

async function ensureSession() {
  if (sessionId) return;
  const comCode = process.env.ECOUNT_COM_CODE;
  const userId = process.env.ECOUNT_USER_ID;
  const apiKey = process.env.ECOUNT_API_CERT_KEY;
  if (!comCode || !userId || !apiKey) throw new Error('이카운트 환경변수 미설정');

  // Zone
  const zoneRes = await fetch(ZONE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ COM_CODE: comCode }),
  });
  const zoneData = await zoneRes.json();
  const dataObj = zoneData.Data?.Datas || zoneData.Data || {};
  zone = dataObj.ZONE || dataObj.Zone || dataObj.zone || zoneData.Data?.ZONE || zoneData.Data?.Zone;
  if (!zone) throw new Error(`Zone 값 없음: ${JSON.stringify(zoneData.Data).slice(0, 300)}`);
  baseUrl = `https://sboapi${zone}.ecount.com`;

  // Login
  const loginRes = await fetch(`${baseUrl}/OAPI/V2/OAPILogin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ COM_CODE: comCode, USER_ID: userId, API_CERT_KEY: apiKey, LAN_TYPE: 'ko-KR', ZONE: zone }),
  });
  const loginData = await loginRes.json();
  const loginObj = loginData.Data?.Datas || loginData.Data || {};
  sessionId = loginObj.SESSION_ID || loginObj.session_id;
}

async function ecountRequest(path, body) {
  await ensureSession();
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', SESSION_ID: sessionId },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

// ── 도구 목록 ──

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'ecount_get_sales',
      description: '이카운트 매출 전표 조회. from_date, to_date를 YYYYMMDD 형식으로 전달.',
      inputSchema: {
        type: 'object',
        properties: {
          from_date: { type: 'string', description: 'YYYYMMDD' },
          to_date: { type: 'string', description: 'YYYYMMDD' },
        },
        required: ['from_date', 'to_date'],
      },
    },
    {
      name: 'ecount_create_sale',
      description: '이카운트 매출 전표 등록',
      inputSchema: {
        type: 'object',
        properties: {
          io_date: { type: 'string' },
          cust_code: { type: 'string' },
          prod_code: { type: 'string' },
          qty: { type: 'number' },
          price: { type: 'number' },
          remarks: { type: 'string' },
        },
        required: ['io_date', 'price'],
      },
    },
    {
      name: 'ecount_get_purchases',
      description: '이카운트 구매 전표 조회',
      inputSchema: {
        type: 'object',
        properties: {
          from_date: { type: 'string' },
          to_date: { type: 'string' },
        },
        required: ['from_date', 'to_date'],
      },
    },
    {
      name: 'ecount_get_inventory',
      description: '이카운트 재고 현황 조회',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ecount_get_products',
      description: '이카운트 제품 목록 조회',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ecount_get_accounts',
      description: '이카운트 거래처 목록 조회',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'ecount_get_receivables',
      description: '이카운트 채권(미수금) 현황 조회',
      inputSchema: {
        type: 'object',
        properties: {
          from_date: { type: 'string' },
          to_date: { type: 'string' },
        },
      },
    },
  ],
}));

// ── 도구 실행 ──

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'ecount_get_sales':
        result = await ecountRequest('/OAPI/V2/Sale/GetSaleList', { FROM_DATE: args.from_date, TO_DATE: args.to_date });
        break;
      case 'ecount_create_sale':
        result = await ecountRequest('/OAPI/V2/Sale/SaveSale', {
          SaleList: [{
            IO_DATE: args.io_date,
            CUST_CODE: args.cust_code || '',
            PROD_CODE: args.prod_code || '',
            QTY: args.qty || 1,
            PRICE: args.price,
            REMARKS: args.remarks || '',
          }],
        });
        break;
      case 'ecount_get_purchases':
        result = await ecountRequest('/OAPI/V2/Purchase/GetPurchaseList', { FROM_DATE: args.from_date, TO_DATE: args.to_date });
        break;
      case 'ecount_get_inventory':
        result = await ecountRequest('/OAPI/V2/Inventory/GetInventoryList', {});
        break;
      case 'ecount_get_products':
        result = await ecountRequest('/OAPI/V2/Product/GetProductList', {});
        break;
      case 'ecount_get_accounts':
        result = await ecountRequest('/OAPI/V2/Account/GetAccountList', {});
        break;
      case 'ecount_get_receivables':
        result = await ecountRequest('/OAPI/V2/Sale/GetDepositList', { FROM_DATE: args.from_date || '', TO_DATE: args.to_date || '' });
        break;
      default:
        return { content: [{ type: 'text', text: `알 수 없는 도구: ${name}` }] };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    return { content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true };
  }
});

// ── 서버 시작 ──

const transport = new StdioServerTransport();
server.connect(transport);
