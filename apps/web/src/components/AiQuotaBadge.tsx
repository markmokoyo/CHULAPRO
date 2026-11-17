'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Cpu } from 'lucide-react';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';
import { getAiRequestHeaders } from '@/services/storage';

export function emitQuotaUpdated(quota?: AiQuotaSnapshot) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('cuepulse:ai-quota-updated', { detail: quota })
  );
}

export function AiQuotaBadge() {
  const [quota, setQuota] = useState<AiQuotaSnapshot | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-status', {
        headers: getAiRequestHeaders(),
      });
      if (res.ok) {
        setQuota((await res.json()) as AiQuotaSnapshot);
      }
    } catch {
      // ignore network error
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const handler = (e: Event) => {
      const custom = e as CustomEvent<AiQuotaSnapshot | undefined>;
      if (custom.detail) {
        setQuota(custom.detail);
      } else {
        void fetchStatus();
      }
    };
    window.addEventListener('cuepulse:ai-quota-updated', handler);
    return () => window.removeEventListener('cuepulse:ai-quota-updated', handler);
  }, [fetchStatus]);

  const statusColor = !quota?.configured
    ? 'bg-amber-400'
    : quota.rateLimited
      ? 'bg-rose-400'
      : 'bg-emerald-400';

  const label = !quota
    ? 'AI'
    : !quota.configured
      ? 'Offline'
      : quota.rateLimited
        ? `${quota.retryAfterSec}s`
        : 'AI พร้อม';

  return (
    <Link
      href="/settings"
      title="ตั้งค่า Gemini AI และโควตา"
      className="app-press flex items-center gap-1.5 min-h-[36px] rounded-full border border-[#E8DCE0] bg-[#FAF6F7] hover:border-[#EC3D6A] hover:bg-[#FFF0F5] px-3 py-1 text-xs font-semibold text-[#2B2135] transition"
    >
      <span className={`h-2 w-2 rounded-full ${statusColor}`} />
      <Cpu className="h-3.5 w-3.5 text-[#EC3D6A]" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
