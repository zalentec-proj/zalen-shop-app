'use client';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import type { StorePresentation } from './presentation';

const IdentityContext = createContext<StorePresentation | null>(null);
export function StorefrontIdentity({ presentation, children }: { presentation: StorePresentation | null; children: ReactNode }) {
  return <IdentityContext.Provider value={presentation}>
    <div style={presentation ? {
      '--color-blue-primary': presentation.primaryColor,
      '--color-green-accent': presentation.accentColor,
    } as CSSProperties : undefined}>{children}</div>
  </IdentityContext.Provider>;
}
export function useStorefrontIdentity() { return useContext(IdentityContext); }
