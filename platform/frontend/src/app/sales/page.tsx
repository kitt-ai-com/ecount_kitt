'use client';

import { useEffect, useState } from 'react';

export default function SalesPage() {
  const [summary, setSummary] = useState<any>(null);
  const [byChannel, setByChannel] = useState<any[]>([]);
  const [byProduct, setByProduct] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/sales/summary').then(r => r.json()).then(setSummary).catch(() => {});
    fetch('/api/sales/by-channel').then(r => r.json()).then(setByChannel).catch(() => {});
    fetch('/api/sales/by-product').then(r => r.json()).then(setByProduct).catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">매출 현황</h1>

      {/* 매출 요약 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">매출 합계</p>
          <p className="text-2xl font-bold">{fmt(summary?.total || 0)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">공급가액</p>
          <p className="text-2xl font-bold">{fmt(summary?.supply || 0)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">매출 건수</p>
          <p className="text-2xl font-bold">{summary?.count || 0}건</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 채널별 */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-3">채널별 매출 비중</h3>
          {byChannel.length === 0 ? (
            <p className="text-sm text-gray-400">데이터 없음</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">채널</th><th className="pb-2">건수</th><th className="pb-2">금액</th></tr></thead>
              <tbody>
                {byChannel.map((ch: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{ch.channel}</td>
                    <td className="py-2">{ch.count}건</td>
                    <td className="py-2 font-medium">{fmt(ch.total)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 품목별 */}
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-3">품목별 매출 순위</h3>
          {byProduct.length === 0 ? (
            <p className="text-sm text-gray-400">데이터 없음</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">품목</th><th className="pb-2">수량</th><th className="pb-2">금액</th></tr></thead>
              <tbody>
                {byProduct.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2">{p.prod_name}</td>
                    <td className="py-2">{p.qty}개</td>
                    <td className="py-2 font-medium">{fmt(p.amount)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
