'use client';

import { useEffect, useState } from 'react';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any>(null);
  const [lowStock, setLowStock] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/inventory/').then(r => r.json()).then(setInventory).catch(() => {});
    fetch('/api/inventory/low-stock').then(r => r.json()).then(d => setLowStock(d.items || [])).catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">재고 현황</h1>

      {/* 재고 부족 알림 */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-red-700 mb-2">재고 부족 품목 ({lowStock.length}건)</h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((item: any, i: number) => (
              <span key={i} className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs">
                {item.prod_name}: {item.qty}개 (최소 {item.min_stock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 재고 테이블 */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">
            재고 목록 {inventory?.snapshot_date && <span className="text-gray-400 font-normal">({inventory.snapshot_date} 기준)</span>}
          </h3>
          <button className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700" onClick={() => fetch('/api/inventory/sync-ecount', { method: 'POST' })}>
            이카운트 동기화
          </button>
        </div>
        {!inventory?.items?.length ? (
          <p className="text-sm text-gray-400">데이터 없음 — 이카운트 동기화를 실행하세요</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">제품코드</th><th className="pb-2">제품명</th>
                <th className="pb-2">카테고리</th><th className="pb-2">수량</th>
                <th className="pb-2">금액</th><th className="pb-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {inventory.items.map((item: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 font-mono text-xs">{item.prod_code}</td>
                  <td className="py-2">{item.prod_name}</td>
                  <td className="py-2">{item.category || '-'}</td>
                  <td className="py-2">{item.qty}개</td>
                  <td className="py-2">{fmt(item.total_value || 0)}원</td>
                  <td className="py-2">
                    {item.min_stock && item.qty < item.min_stock ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs">부족</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">정상</span>
                    )}
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
