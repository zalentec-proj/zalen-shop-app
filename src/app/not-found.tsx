import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070B] px-6 text-white">
      <section className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A1730]/90 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-300">
          Loja não encontrada
        </p>
        <h1 className="mt-3 text-2xl font-semibold">
          Este endereço não está ativo
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Verifique o subdomínio da loja ou acesse o painel pela Zalen Shop.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-blue-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#2f68ff]"
        >
          Ir para o login
        </Link>
      </section>
    </main>
  );
}
