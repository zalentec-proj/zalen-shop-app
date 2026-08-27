'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Box, MapPin, ShieldCheck, Store } from 'lucide-react';
import {
  AdminPageFrame,
  AdminPageHeader,
  AdminSectionCard,
} from '@/components/admin/AdminLayout';

interface SettingsShellProps {
  children: ReactNode;
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getSettingsPageMeta(pathname: string) {
  if (pathname.startsWith('/admin/configuracoes/loja-online')) {
    return {
      title: 'Loja online',
      description: 'Categorias, navbar e experiência pública da loja ativa.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/pagamentos')) {
    return {
      title: 'Meios de pagamento',
      description: 'Formas de recebimento disponíveis ou planejadas para a loja ativa.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/precos')) {
    return {
      title: 'Preços',
      description: 'Regras de preço e benefícios para clientes da loja ativa.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/envios')) {
    return {
      title: 'Meios de envio',
      description: 'Opções de entrega, retirada e logística previstas para a operação.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/dominios')) {
    return {
      title: 'Domínios',
      description: 'Domínio padrão, domínio próprio e orientação visual de DNS.',
    };
  }

  if (pathname.startsWith('/admin/configuracoes/compatibilidade')) {
    return {
      title: 'Compatibilidade por modelo',
      description: 'Vínculos auditáveis entre peças, acessórios e os modelos DJI da loja ativa.',
    };
  }

  return {
    title: 'Configurações',
    description: 'Operação, canais e preferências da loja ativa dentro da Zalen Shop.',
  };
}

export function SettingsShell({
  children,
}: SettingsShellProps) {
  const pathname = usePathname();
  const pageMeta = getSettingsPageMeta(pathname);

  return (
    <AdminPageFrame>
      <AdminPageHeader
        eyebrow="Configurações da loja"
        title={pageMeta.title}
        description={pageMeta.description}
      />
      <section className="pt-4">{children}</section>
    </AdminPageFrame>
  );
}

export function SettingsPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AdminSectionCard
      title={title}
      description={description}
      action={action}
      className={className}
    >
      {children}
    </AdminSectionCard>
  );
}

export function SettingsBadge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'disabled' | 'info';
  children: ReactNode;
}) {
  const toneClass = {
    neutral: 'border-white/8 bg-[#081225] text-slate-300',
    success: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
    warning: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
    disabled: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
    info: 'border-[#1E3DFF]/30 bg-[#1E3DFF]/10 text-[#A9C7FF]',
  }[tone];

  return (
    <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold', toneClass)}>
      {children}
    </span>
  );
}

export function SettingsActionButton({
  children,
  disabled,
  variant = 'secondary',
}: {
  children: ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition',
        variant === 'primary'
          ? 'border border-[#1E3DFF]/35 bg-[linear-gradient(135deg,#1E3DFF,#0EA5E9)] text-white shadow-[0_10px_20px_rgba(30,61,255,0.2)] hover:brightness-110'
          : 'border border-white/8 bg-[#081225] text-slate-200 hover:border-[#1E3DFF]/35 hover:text-white',
        disabled && 'cursor-not-allowed opacity-60 hover:brightness-100'
      )}
    >
      {children}
    </button>
  );
}

export { Box, MapPin, ShieldCheck, Store };
