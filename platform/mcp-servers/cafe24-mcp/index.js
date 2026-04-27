#!/usr/bin/env node
/**
 * 카페24 연동 MCP 서버
 * 카페24 쇼핑몰 주문 조회 및 이카운트 연동
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'cafe24-mcp',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

const CAFE24_API = 'https://{mall_id}.cafe24api.com/api/v2';

function getCafe24Headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.CAFE24_ACCESS_TOKEN || ''}`,
    'X-Cafe24-Api-Version': '2024-06-01',
  };
}

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'cafe24_get_orders',
      description: '카페24 주문 목록 조회',
      inputSchema: {
        type: 'object',
        properties: {
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD' },
          order_status: { type: 'string', description: '주문상태 (N00=입금전, N10=결제완료 등)' },
        },
      },
    },
    {
      name: 'cafe24_get_products',
      description: '카페24 상품 목록 조회',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
        },
      },
    },
    {
      name: 'cafe24_order_to_ecount',
      description: '카페24 주문을 이카운트 판매입력 형식으로 변환',
      inputSchema: {
        type: 'object',
        properties: {
          orders: { type: 'array', description: '카페24 주문 데이터 배열' },
        },
        required: ['orders'],
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  const mallId = process.env.CAFE24_MALL_ID;

  try {
    switch (name) {
      case 'cafe24_get_orders': {
        const params = new URLSearchParams();
        if (args.start_date) params.set('start_date', args.start_date);
        if (args.end_date) params.set('end_date', args.end_date);
        if (args.order_status) params.set('order_status', args.order_status);
        const url = CAFE24_API.replace('{mall_id}', mallId) + `/admin/orders?${params}`;
        const res = await fetch(url, { headers: getCafe24Headers() });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'cafe24_get_products': {
        const url = CAFE24_API.replace('{mall_id}', mallId) + `/admin/products?limit=${args.limit || 50}`;
        const res = await fetch(url, { headers: getCafe24Headers() });
        const data = await res.json();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
      case 'cafe24_order_to_ecount': {
        const converted = (args.orders || []).map(order => ({
          IO_DATE: (order.order_date || '').replace(/-/g, '').slice(0, 8),
          CUST_CODE: '',
          PROD_CODE: order.product_code || '',
          QTY: order.quantity || 1,
          PRICE: order.payment_amount || order.order_amount || 0,
          SUPPLY_AMT: Math.round((order.payment_amount || 0) / 1.1),
          VAT_AMT: (order.payment_amount || 0) - Math.round((order.payment_amount || 0) / 1.1),
          REMARKS: `카페24 #${order.order_id || ''}`,
        }));
        return { content: [{ type: 'text', text: JSON.stringify({ converted, count: converted.length }, null, 2) }] };
      }
      default:
        return { content: [{ type: 'text', text: `알 수 없는 도구: ${name}` }] };
    }
  } catch (e) {
    return { content: [{ type: 'text', text: `오류: ${e.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
