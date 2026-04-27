'use client';

import { useEffect, useState } from 'react';

export default function PurchasesPage() {
  const [summary, setSummary] = useState<any>(null);
  const [slips, setSlips] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/purchases/summary').then(r => r.json()).then(setSummary).catch(() => {});
    fetch('/api/purchases/').then(r => r.json()).then(d => setSlips(d.slips || [])).catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">구매 현황</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">구매 합계</p>
          <p className="text-2xl font-bold">{fmt(summary?.total || 0)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">구매 건수</p>
          <p className="text-2xl font-bold">{summary?.count || 0}건</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-sm font-semibold mb-3">최근 구매 전표</h3>
        {slips.length === 0 ? (
          <p className="text-sm text-gray-400">데이터 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">일자</th><th className="pb-2">거래처</th>
                <th className="pb-2">인보이스#</th><th className="pb-2">금액</th><th className="pb-2">동기화</th>
              </tr>
            </thead>
            <tbody>
              {slips.slice(0, 20).map((s: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2">{s.io_date}</td>
                  <td className="py-2">{s.cust_name || s.cust_code}</td>
                  <td className="py-2">{s.invoice_no || '-'}</td>
                  <td className="py-2 font-medium">{fmt(s.total_amount || 0)}원</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${s.ecount_synced ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.ecount_synced ? '완료' : '미동기화'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
