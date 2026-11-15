'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, FileText, Mic, Users } from 'lucide-react';
import { AiQuotaBadge } from './AiQuotaBadge';

const NAV_ITEMS = [
  { href: '/', label: 'หน้าหลัก', icon: Activity },
  { href: '/planner', label: 'เตรียมสไลด์', icon: FileText },
  { href: '/practice/solo', label: 'ซ้อมเดี่ยว', icon: Mic },
  { href: '/practice/team', label: 'ซ้อมกลุ่ม', icon: Users },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E8DCE0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="app-press flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8DCE0] bg-white p-0.5 shadow-sm">
              <img
                src="/logo-chula.jpg"
                alt="ตราพระเกี้ยว"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-[#1F161A]">
                CuePulse
              </span>
              <p className="text-[11px] text-slate-500 font-medium leading-none">
                สตูดิโอฝึกซ้อมการนำเสนอ • จุฬาฯ
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1 rounded-2xl bg-[#F5EEF0] p-1 border border-[#E8DCE0]">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`app-press flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm transition-all ${
                      active
                        ? 'bg-white text-[#1F161A] border border-[#E8DCE0] shadow-sm font-bold'
                        : 'text-slate-600 hover:bg-white/60 hover:text-[#EC3D6A] border border-transparent font-medium'
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? 'text-[#EC3D6A]' : ''}`} />
                    <span>{item.label}</span>
                    {active && (
                      <span
                        aria-hidden="true"
                        className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[#EC3D6A]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="sm:ml-1 sm:pl-2 sm:border-l sm:border-[#E8DCE0]">
              <AiQuotaBadge />
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Floating App Dock */}
      <nav
        aria-label="เมนูหลักมือถือ"
        className="sm:hidden fixed bottom-2.5 inset-x-2.5 z-40 flex items-center justify-around rounded-2xl border border-[#E8DCE0] bg-white/95 px-2 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-md shadow-lg shadow-slate-900/5"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-press flex flex-1 min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-xs transition-all ${
                active
                  ? 'bg-[#FCE8EE] text-[#BE2257] font-bold'
                  : 'text-slate-500 font-medium hover:text-[#EC3D6A]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#EC3D6A]' : ''}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
