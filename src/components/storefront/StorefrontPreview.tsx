'use client';
import type { ReactNode } from 'react';

// Keep the preview readable to assistive technology while preventing navigation
// and purchase controls from acting on the central admin host.
export function StorefrontPreview({ children }: { children: ReactNode }) {
  return <div className="relative overflow-hidden rounded-xl border border-white/10" style={{ transform: 'translateZ(0)' }}
    onClickCapture={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onSubmitCapture={(event) => { event.preventDefault(); event.stopPropagation(); }}
    onKeyDownCapture={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); } }}>
    {children}
  </div>;
}
