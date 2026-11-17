'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FileText,
  Home,
  Mic,
  Settings,
} from 'lucide-react';
import { AiQuotaBadge } from './AiQuotaBadge';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'หน้าหลัก',
    icon: Home,
    isActive: (p) => p === '/',
  },
  {
    href: '/planner',
    label: 'สไลด์',
    icon: FileText,
    isActive: (p) => p.startsWith('/planner'),
  },
  {
    href: '/practice/solo',
    label: 'ซ้อมพูด',
    icon: Mic,
    isActive: (p) => p.startsWith('/practice'),
  },
  {
    href: '/reports',
    label: 'สรุปผล',
    icon: BarChart3,
    isActive: (p) => p.startsWith('/reports') || p.startsWith('/report/'),
  },
  {
    href: '/settings',
    label: 'ตั้งค่า',
    icon: Settings,
    isActive: (p) => p.startsWith('/settings'),
  },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[#E8DCE0] bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <Link href="/" className="app-press flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8DCE0] bg-white p-0.5 shadow-sm">
              <img
                src="/logo-chula.jpg"
                alt="ตราพระเกี้ยว"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-[#2B2135]">
                CuePulse
              </span>
              <p className="text-[10px] text-slate-400 font-medium leading-none">
                Chula Presentation Studio
              </p>
            </div>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <div className="hidden md:flex items-center gap-1 rounded-2xl bg-[#F5EEF0] p-1 border border-[#E8DCE0]">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = item.isActive(pathname);
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
                  </Link>
                );
              })}
            </div>
            <div className="md:ml-1 md:pl-2 md:border-l md:border-[#E8DCE0]">
              <AiQuotaBadge />
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile & Tablet Floating 5-Tab App Dock */}
      <nav
        aria-label="เมนูหลักแอป"
        className="md:hidden fixed bottom-2.5 inset-x-3 z-40 flex items-center justify-around rounded-3xl border border-[#E8DCE0] bg-white/95 px-1.5 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-xl shadow-xl shadow-[#2B2135]/10"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`app-press flex flex-1 min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-[11px] transition-all ${
                active
                  ? 'bg-[#FCE8EE] text-[#BE2257] font-bold'
                  : 'text-slate-500 font-medium hover:text-[#EC3D6A]'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[#EC3D6A]' : ''}`} />
              <span className="truncate max-w-full">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
