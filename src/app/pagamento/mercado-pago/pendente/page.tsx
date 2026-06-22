import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import {
  type MercadoPagoReturnSearchParams,
  processMercadoPagoReturn,
} from '../mercado-pago-return';

interface PageProps {
  searchParams?: MercadoPagoReturnSearchParams;
}

export default async function MercadoPagoPendingPage({
  searchParams,
}: PageProps) {
  const result = searchParams
    ? await processMercadoPagoReturn(searchParams)
    : null;

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-16 text-white">
      <section className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-[32px] border border-yellow-400/20 bg-white/[0.03] p-8 text-center">
        <Clock3 className="h-14 w-14 text-yellow-300" />
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-yellow-300">
          Pagamento pendente
        </p>
        <h1 className="text-2xl font-black">Estamos aguardando confirmação</h1>
        <p className="text-sm leading-6 text-brand-muted">
          {result?.status === 'error'
            ? 'Não conseguimos consultar o pagamento agora, mas o pedido continua salvo. O webhook tentará concluir a atualização.'
            : 'Alguns métodos, como boleto ou análise, podem levar mais tempo. O pedido permanece salvo na Zalen enquanto aguardamos o Mercado Pago.'}
        </p>
        {result?.orderNumber ? (
          <p className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white">
            Pedido {result.orderNumber}
          </p>
        ) : null}
        <Link
          href="/"
          className="mt-2 flex h-12 w-full items-center justify-center rounded-xl bg-blue-primary text-sm font-bold text-white"
        >
          Voltar para a loja
        </Link>
      </section>
    </main>
  );
}
