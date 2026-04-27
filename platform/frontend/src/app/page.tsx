'use client';

import { useEffect, useState } from 'react';

interface KPI {
  salesTotal: number;
  salesCount: number;
  purchaseTotal: number;
  arTotal: number;
  changeRate: number;
}

function KPICard({ label, value, unit, change }: { label: string; value: string; unit: string; change?: number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}<span className="text-sm font-normal text-gray-500 ml-1">{unit}</span></p>
      {change !== undefined && (
        <p className={`text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% 전일 대비
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [recentWorkflows, setRecentWorkflows] = useState<any[]>([]);

  useEffect(() => {
    // 매출 요약
    fetch('/api/sales/summary')
      .then(r => r.json())
      .then(data => setKpi({
        salesTotal: data.total || 0,
        salesCount: data.count || 0,
        purchaseTotal: 0,
        arTotal: 0,
        changeRate: 0,
      }))
      .catch(() => setKpi({ salesTotal: 0, salesCount: 0, purchaseTotal: 0, arTotal: 0, changeRate: 0 }));

    // 최근 워크플로우
    fetch('/api/workflows/history?limit=5')
      .then(r => r.json())
      .then(data => setRecentWorkflows(data.runs || []))
      .catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">대시보드</h1>
          <p className="text-sm text-gray-500">CNC코리아 ERP 자동화 현황</p>
        </div>
        <div className="text-sm text-gray-400">{new Date().toLocaleDateString('ko-KR')}</div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KPICard label="오늘 매출" value={fmt(kpi?.salesTotal || 0)} unit="원" change={kpi?.changeRate} />
        <KPICard label="매출 건수" value={fmt(kpi?.salesCount || 0)} unit="건" />
        <KPICard label="구매 합계" value={fmt(kpi?.purchaseTotal || 0)} unit="원" />
        <KPICard label="미수금 잔액" value={fmt(kpi?.arTotal || 0)} unit="원" />
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">채널별 매출 비중</h3>
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            이카운트 연결 후 차트가 표시됩니다
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">월별 매출 추이</h3>
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
            이카운트 연결 후 차트가 표시됩니다
          </div>
        </div>
      </div>

      {/* 최근 워크플로우 */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">최근 자동화 실행 이력</h3>
        {recentWorkflows.length === 0 ? (
          <p className="text-sm text-gray-400">실행 이력이 없습니다</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">워크플로우</th>
                <th className="pb-2">상태</th>
                <th className="pb-2">처리건수</th>
                <th className="pb-2">실행시간</th>
              </tr>
            </thead>
            <tbody>
              {recentWorkflows.map((wf: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2">{wf.workflow_id}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${wf.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {wf.status}
                    </span>
                  </td>
                  <td className="py-2">{wf.success_count || 0}건</td>
                  <td className="py-2 text-gray-400">{wf.started_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
