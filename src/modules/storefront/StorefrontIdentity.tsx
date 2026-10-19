'use client';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { StorePresentation } from './presentation';

const IdentityContext = createContext<StorePresentation | null>(null);
export function StorefrontIdentity({ presentation, children }: { presentation: StorePresentation | null; children: ReactNode }) {
  const editorial = presentation?.renderer === 'neutral' && presentation.visualStyle === 'editorial';
  return <IdentityContext.Provider value={presentation}>
    <div className={editorial ? 'storefront-editorial' : undefined} style={presentation ? {
      '--color-blue-primary': presentation.primaryColor,
      '--color-green-accent': presentation.accentColor,
      ...(editorial ? {
        '--color-brand-bg': '#ffffff', '--color-brand-white': '#1b251f',
        '--color-brand-muted': '#626b63', '--color-brand-card': '#f8f7f3',
        '--color-brand-surface': '#f5f3ed', '--color-brand-surface-strong': '#ebece4',
        '--color-brand-border': '#dfe3db', '--color-brand-border-soft': '#e9eae4',
      } : {}),
    } as CSSProperties : undefined}>{children}</div>
  </IdentityContext.Provider>;
}
export function useStorefrontIdentity() { return useContext(IdentityContext); }
