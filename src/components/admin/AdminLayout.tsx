import type { ComponentType, CSSProperties, ReactNode } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdminPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-w-0 w-full max-w-[1480px] px-3 py-4 sm:px-4 lg:px-6">
      {children}
    </div>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  backHref,
  backLabel,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/6 pb-4 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0 space-y-1">
        {backHref && backLabel ? (
          <a
            href={backHref}
            className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-400 transition hover:text-slate-200"
          >
            {backLabel}
          </a>
        ) : null}
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7EC3FF]">
            {eyebrow}
          </div>
        ) : null}
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-white sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}

export function AdminContentGrid({
  children,
  sidebar,
  sidebarWidth = '320px',
  className,
}: {
  children: ReactNode;
  sidebar?: ReactNode;
  sidebarWidth?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-w-0 gap-4 2xl:items-start',
        sidebar ? '2xl:grid-cols-[minmax(0,1fr)_var(--admin-sidebar-width)]' : '',
        className
      )}
      style={
        sidebar
          ? ({ '--admin-sidebar-width': sidebarWidth } as CSSProperties)
          : undefined
      }
    >
      <div className="min-w-0">{children}</div>
      {sidebar ? <aside className="min-w-0 space-y-4">{sidebar}</aside> : null}
    </div>
  );
}

export function AdminSectionCard({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'min-w-0 rounded-xl border border-white/6 bg-[#0A1730]/95 shadow-[0_14px_34px_rgba(0,0,0,0.2)]',
        className
      )}
    >
      {(title || description || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/6 px-4 py-3">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-sm font-semibold text-white">{title}</h2> : null}
            {description ? (
              <p className="max-w-2xl text-xs leading-5 text-slate-400">{description}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div className={cn('min-w-0 px-4 py-3', bodyClassName)}>{children}</div>
    </section>
  );
}

export function AdminSidePanel({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <AdminSectionCard title={title} description={description} action={action}>
      {children}
    </AdminSectionCard>
  );
}

export function AdminKpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2 2xl:grid-cols-4">{children}</div>;
}

export function AdminKpiCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/6 bg-[linear-gradient(180deg,rgba(13,26,54,0.98),rgba(8,17,36,0.98))] p-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1E3DFF]/25 bg-[#091427] text-[#5BCBFF]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

export function AdminDataList({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-white/6 rounded-lg border border-white/6">{children}</div>;
}

export function AdminDataListRow({
  leading,
  title,
  description,
  meta,
  action,
}: {
  leading?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-3 bg-[#081225]/70 px-3 py-3 text-xs transition hover:bg-[#0B1831]/80 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0">
          <div className="min-w-0 font-semibold text-white">{title}</div>
          {description ? (
            <div className="mt-1 min-w-0 text-[11px] leading-5 text-slate-400">
              {description}
            </div>
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap gap-1.5">{meta}</div> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 justify-start md:justify-end">{action}</div> : null}
    </div>
  );
}

export function AdminTableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/6 bg-[#071225]/50">
      {children}
    </div>
  );
}

export function AdminModal({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020713]/80 px-4 py-6 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-xl border border-white/10 bg-[#081225] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-4 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {description ? (
              <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 text-slate-300 transition hover:border-rose-400/30 hover:text-white"
            aria-label="Fechar modal"
          >
            ×
          </button>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}
