'use client';

import { useState } from 'react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('daily');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { id: 'daily', label: '일간 매출 보고서' },
    { id: 'weekly-ar', label: '주간 채권 현황' },
    { id: 'monthly-pl', label: '월간 매입·매출 리포트' },
    { id: 'client-rank', label: '거래처 매출 순위' },
  ];

  const generateReport = async () => {
    setLoading(true);
    try {
      let url = `/api/reports/${reportType}`;
      if (reportType === 'monthly-pl') {
        const now = new Date();
        url += `?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setReportData(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const downloadExcel = () => {
    window.open(`/api/reports/download/${reportType}`, '_blank');
  };

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">보고서</h1>

      {/* 보고서 선택 */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3">보고서 생성</h3>
        <div className="flex gap-2 mb-4">
          {reportTypes.map(rt => (
            <button
              key={rt.id}
              onClick={() => { setReportType(rt.id); setReportData(null); }}
              className={`px-4 py-2 rounded-md text-sm ${reportType === rt.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {rt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={generateReport} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? '생성 중...' : '보고서 생성'}
          </button>
          {reportData && (
            <button onClick={downloadExcel} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700">
              엑셀 다운로드
            </button>
          )}
        </div>
      </div>

      {/* 보고서 결과 */}
      {reportData && (
        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold mb-3">보고서 결과</h3>

          {reportType === 'daily' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">매출 합계</p>
                <p className="text-lg font-bold">{fmt(reportData.total_sales || 0)}원</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">매출 건수</p>
                <p className="text-lg font-bold">{reportData.total_count || 0}건</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">전일 대비</p>
                <p className={`text-lg font-bold ${(reportData.change_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {(reportData.change_rate || 0) >= 0 ? '+' : ''}{(reportData.change_rate || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          )}

          {reportType === 'weekly-ar' && (
            <div>
              <p className="text-lg font-bold text-red-600 mb-3">총 미수금: {fmt(reportData.total_ar || 0)}원</p>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">거래처</th><th className="pb-2">미수잔액</th><th className="pb-2">등급</th></tr></thead>
                <tbody>
                  {(reportData.accounts || []).slice(0, 10).map((a: any, i: number) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2">{a.cust_name}</td>
                      <td className="py-2 font-medium">{fmt(a.balance)}원</td>
                      <td className="py-2">{a.activity_grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportType === 'monthly-pl' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">매출</p>
                <p className="text-lg font-bold text-green-600">{fmt(reportData.total_sales || 0)}원</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500">매입</p>
                <p className="text-lg font-bold text-red-600">{fmt(reportData.total_purchases || 0)}원</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">이익 (마진 {reportData.margin_rate || 0}%)</p>
                <p className="text-lg font-bold">{fmt(reportData.gross_profit || 0)}원</p>
              </div>
            </div>
          )}

          {reportType === 'client-rank' && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b">
                <th className="pb-2">#</th><th className="pb-2">거래처</th><th className="pb-2">매출</th><th className="pb-2">점유율</th><th className="pb-2">누적</th>
              </tr></thead>
              <tbody>
                {(reportData.accounts || []).map((a: any) => (
                  <tr key={a.rank} className="border-b border-gray-50">
                    <td className="py-2">{a.rank}</td>
                    <td className="py-2">{a.cust_name}</td>
                    <td className="py-2 font-medium">{fmt(a.total_sales)}원</td>
                    <td className="py-2">{a.share_pct}%</td>
                    <td className="py-2">{a.cumulative_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <pre className="mt-4 p-3 bg-gray-50 rounded text-xs overflow-auto max-h-48">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
