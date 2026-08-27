'use client';

import { X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

export function AdminDrawer({
  title,
  description,
  children,
  parameter = 'record',
  presentation = 'modal',
}: {
  title: string;
  description?: string;
  children: ReactNode;
  parameter?: string;
  presentation?: 'drawer' | 'modal';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(parameter);
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key !== 'Tab' || !panel) return;
      const elements = Array.from(panel.querySelectorAll<HTMLElement>('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'));
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-50 flex bg-[#020713]/75 backdrop-blur-sm ${presentation === 'modal' ? 'items-center justify-center p-3 sm:p-6' : 'justify-end'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="admin-drawer-title" className={presentation === 'modal' ? 'max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto rounded-xl border border-white/10 bg-[#081225] shadow-[0_24px_80px_rgba(0,0,0,.5)] sm:max-h-[calc(100dvh-3rem)]' : 'h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#081225] shadow-[-24px_0_80px_rgba(0,0,0,.45)]'}>
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/8 bg-[#081225]/95 px-5 py-4 backdrop-blur">
          <div><h2 id="admin-drawer-title" className="text-base font-semibold text-white">{title}</h2>{description ? <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p> : null}</div>
          <button type="button" onClick={close} aria-label="Fechar painel" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
