import Link from 'next/link';
import { LogOut } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { customerSignOutAction } from './actions';

interface CustomerAccountHeaderProps {
  email?: string;
}

export default function CustomerAccountHeader({
  email,
}: CustomerAccountHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-border bg-[#090E17]/90 px-5 py-4">
      <Link href="/" className="inline-flex">
        <Logo size="sm" />
      </Link>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <nav className="flex items-center gap-3 text-sm font-semibold text-brand-muted">
          <Link href="/" className="hover:text-white">
            Loja
          </Link>
          <Link href="/conta" className="hover:text-white">
            Minha conta
          </Link>
          <Link href="/conta/pedidos" className="hover:text-white">
            Meus pedidos
          </Link>
        </nav>
        {email ? (
          <span className="hidden max-w-[220px] truncate rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-brand-muted md:inline">
            {email}
          </span>
        ) : null}
        <form action={customerSignOutAction}>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-red-400/30 px-3 text-xs font-bold text-red-200 transition hover:bg-red-500/10 hover:text-red-100"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
