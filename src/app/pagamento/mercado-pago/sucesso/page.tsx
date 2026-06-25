import Link from 'next/link';
import { CheckCircle2, Clock3 } from 'lucide-react';
import { ClearCartOnApproved } from '../ClearCartOnApproved';
import {
  type MercadoPagoReturnSearchParams,
  processMercadoPagoReturn,
} from '../mercado-pago-return';

interface PageProps {
  searchParams?: MercadoPagoReturnSearchParams;
}

export default async function MercadoPagoSuccessPage({
  searchParams,
}: PageProps) {
  const result = searchParams
    ? await processMercadoPagoReturn(searchParams)
    : null;
  const isApproved = result?.status === 'approved';
  const isPending = result?.status === 'pending';
  const accountHref = result?.orderId
    ? `/conta/entrar?next=${encodeURIComponent(`/conta/pedidos/${result.orderId}`)}`
    : '/conta/entrar?next=/conta/pedidos';

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-16 text-white">
      <section className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-[32px] border border-green-accent/20 bg-white/[0.03] p-8 text-center">
        {isPending ? (
          <Clock3 className="h-14 w-14 text-yellow-300" />
        ) : (
          <CheckCircle2 className="h-14 w-14 text-green-accent" />
        )}
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-green-accent">
          {isPending ? 'Pagamento em análise' : 'Pagamento confirmado'}
        </p>
        <h1 className="text-2xl font-black">Recebemos sua compra</h1>
        <p className="text-sm leading-6 text-brand-muted">
          {isApproved
            ? 'O Mercado Pago confirmou o pagamento e a Zalen atualizou o pedido no painel operacional.'
            : isPending
              ? 'O Mercado Pago recebeu o pagamento, mas ainda está concluindo a análise. O pedido permanece salvo.'
              : 'Recebemos o retorno do Mercado Pago. Se o status ainda não estiver finalizado, o webhook concluirá a atualização.'}
        </p>
        {result?.orderNumber ? (
          <p className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white">
            Pedido {result.orderNumber}
          </p>
        ) : null}
        {isApproved ? <ClearCartOnApproved /> : null}
        <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
          <Link
            href={accountHref}
            className="flex h-12 items-center justify-center rounded-xl bg-blue-primary px-4 text-sm font-bold text-white"
          >
            Acompanhar pedido
          </Link>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-bold text-white transition hover:border-white/20"
          >
            Continuar comprando
          </Link>
        </div>
      </section>
    </main>
  );
}
