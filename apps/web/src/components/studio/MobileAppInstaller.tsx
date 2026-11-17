'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  Share,
  Smartphone,
  Watch,
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function MobileAppInstaller() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker for offline shell & Android/iOS installability
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js').catch(() => {
        // Ignore if blocked in private mode
      });
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const ua = window.navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua));

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
      return;
    }
    setShowIosGuide((v) => !v);
  };

  return (
    <div className="rounded-3xl border border-[#F5C6D4] bg-gradient-to-br from-white via-[#FFF9FB] to-[#F5F3FF] p-5 shadow-sm space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FCE8EE] text-[#EC3D6A] border border-[#F9A8D4]">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-[#2B2135]">
              ติดตั้งแอปลงมือถือ & เชื่อมต่อนาฬิกา
            </h2>
            <p className="text-xs text-slate-500">
              {isInstalled
                ? 'ติดตั้งเป็นแอปบนอุปกรณ์นี้แล้ว'
                : 'ใช้งานแบบเต็มจอเหมือนแอปจริงบน iOS และ Android'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ติดตั้งแล้ว
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void handleInstallClick()}
              className="app-press cta-shimmer inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] px-4 py-2 text-xs font-bold text-white shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              {deferredPrompt ? 'ติดตั้งแอปลงมือถือ' : 'วิธีติดตั้งลงมือถือ'}
            </button>
          )}

          <Link
            href="/watch"
            className="app-press inline-flex items-center gap-1.5 rounded-full border border-[#DDD6FE] bg-white hover:bg-[#F5F3FF] px-3.5 py-2 text-xs font-bold text-[#6D28D9]"
          >
            <Watch className="h-3.5 w-3.5" />
            โหมดสมาร์ทวอทช์
          </Link>
        </div>
      </div>

      {showIosGuide && !isInstalled && (
        <div className="rounded-2xl border border-[#E8DCE0] bg-white px-4 py-3 text-xs text-slate-600 space-y-1">
          {isIos ? (
            <p className="flex flex-wrap items-center gap-1.5">
              <span>สำหรับ iPhone / iPad: กดปุ่ม</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-[#1F161A]">
                <Share className="h-3 w-3 text-[#0EA5E9]" />
                แชร์
              </span>
              <span>ที่แถบ Safari แล้วเลือก</span>
              <strong className="text-[#BE2257]">&ldquo;เพิ่มไปยังหน้าจอโฮม&rdquo;</strong>
            </p>
          ) : (
            <p>
              สำหรับ Android Chrome: กดเมนูจุด 3 จุดมุมขวาบน แล้วเลือก{' '}
              <strong className="text-[#BE2257]">&ldquo;ติดตั้งแอป&rdquo;</strong>{' '}
              หรือ &ldquo;เพิ่มลงในหน้าจอหลัก&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
