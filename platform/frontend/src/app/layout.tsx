import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'CNC코리아 ERP 자동화',
  description: '이카운트 ERP 업무 자동화 대시보드',
};

const navItems = [
  { href: '/', label: '대시보드', icon: '📊' },
  { href: '/sales', label: '매출 현황', icon: '💰' },
  { href: '/purchases', label: '구매 현황', icon: '📦' },
  { href: '/receivables', label: '채권 현황', icon: '📋' },
  { href: '/inventory', label: '재고 현황', icon: '🏭' },
  { href: '/reports', label: '보고서', icon: '📄' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50">
        <div className="flex min-h-screen">
          {/* 사이드바 */}
          <aside className="w-56 bg-slate-900 text-white flex flex-col">
            <div className="px-4 py-5 border-b border-slate-700">
              <h1 className="text-base font-bold">CNC코리아</h1>
              <p className="text-xs text-slate-400 mt-1">ERP 자동화 대시보드</p>
            </div>
            <nav className="flex-1 py-3">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
              v1.0.0 &copy; kitt.ai
            </div>
          </aside>

          {/* 메인 콘텐츠 */}
          <main className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
