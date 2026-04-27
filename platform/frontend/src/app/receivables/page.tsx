'use client';

import { useEffect, useState } from 'react';

export default function ReceivablesPage() {
  const [arData, setArData] = useState<any>(null);
  const [grades, setGrades] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/reports/weekly-ar').then(r => r.json()).then(setArData).catch(() => {});
    fetch('/api/accounts/grades').then(r => r.json()).then(setGrades).catch(() => {});
  }, []);

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const gradeColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    caution: 'bg-yellow-100 text-yellow-700',
    dormant: 'bg-orange-100 text-orange-700',
    churned: 'bg-red-100 text-red-700',
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">채권 현황</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">총 미수금</p>
          <p className="text-2xl font-bold text-red-600">{fmt(arData?.total_ar || 0)}원</p>
        </div>
        <div className="bg-white rounded-lg border p-5">
          <p className="text-xs text-gray-500">미수 거래처</p>
          <p className="text-2xl font-bold">{arData?.account_count || 0}개</p>
        </div>
      </div>

      {/* 활동성 등급 분포 */}
      <div className="bg-white rounded-lg border p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3">거래처 활동성 등급</h3>
        <div className="flex gap-3">
          {Object.entries(grades).map(([grade, count]) => (
            <div key={grade} className={`px-4 py-2 rounded-lg text-sm font-medium ${gradeColors[grade] || 'bg-gray-100'}`}>
              {grade}: {count}개
            </div>
          ))}
        </div>
      </div>

      {/* AR Aging 테이블 */}
      <div className="bg-white rounded-lg border p-5">
        <h3 className="text-sm font-semibold mb-3">미수금 상위 거래처</h3>
        {!arData?.accounts?.length ? (
          <p className="text-sm text-gray-400">데이터 없음</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">거래처</th><th className="pb-2">미수잔액</th>
                <th className="pb-2">평균결제일</th><th className="pb-2">등급</th>
              </tr>
            </thead>
            <tbody>
              {arData.accounts.map((a: any, i: number) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2">{a.cust_name}</td>
                  <td className="py-2 font-medium text-red-600">{fmt(a.balance)}원</td>
                  <td className="py-2">{a.avg_payment_days}일</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${gradeColors[a.activity_grade] || 'bg-gray-100'}`}>
                      {a.activity_grade}
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
