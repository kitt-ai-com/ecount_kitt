#!/usr/bin/env node
/**
 * PG사 연동 MCP 서버
 * INICIS, 네이버페이 정산 데이터 파싱 및 이카운트 매칭
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'pg-mcp',
  version: '1.0.0',
}, {
  capabilities: { tools: {} },
});

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'pg_parse_inicis',
      description: 'INICIS PG 정산 데이터 파싱 (CSV/JSON 입력)',
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'string', description: 'CSV 또는 JSON 형태의 정산 데이터' } },
        required: ['data'],
      },
    },
    {
      name: 'pg_parse_naverpay',
      description: '네이버페이 정산 데이터 파싱',
      inputSchema: {
        type: 'object',
        properties: { data: { type: 'string' } },
        required: ['data'],
      },
    },
    {
      name: 'pg_match_check',
      description: 'PG 정산 ↔ 이카운트 매출 대사 체크',
      inputSchema: {
        type: 'object',
        properties: {
          pg_data: { type: 'array', description: 'PG 정산 데이터' },
          ecount_data: { type: 'array', description: '이카운트 매출 데이터' },
        },
        required: ['pg_data', 'ecount_data'],
      },
    },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'pg_parse_inicis': {
        const lines = args.data.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(l => {
          const vals = l.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
          return obj;
        });
        return { content: [{ type: 'text', text: JSON.stringify({ pg: 'INICIS', rows, count: rows.length }, null, 2) }] };
      }
      case 'pg_parse_naverpay': {
        const lines = args.data.split('\n').filter(l => l.trim());
        const headers = lines[0].split(',');
        const rows = lines.slice(1).map(l => {
          const vals = l.split(',');
          const obj = {};
          headers.forEach((h, i) => obj[h.trim()] = (vals[i] || '').trim());
          return obj;
        });
        return { content: [{ type: 'text', text: JSON.stringify({ pg: '네이버페이', rows, count: rows.length }, null, 2) }] };
      }
      case 'pg_match_check': {
        const matched = [];
        const unmatched = [];
        for (const pg of (args.pg_data || [])) {
          const found = (args.ecount_data || []).find(e =>
            Math.abs(Number(e.amount || 0) - Number(pg.amount || 0)) < 10
          );
          if (found) matched.push({ pg, ecount: found });
          else unmatched.push(pg);
        }
        return { content: [{ type: 'text', text: JSON.stringify({ matched: matched.length, unmatched: unmatched.length, unmatchedItems: unmatched }, null, 2) }] };
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
