import Link from 'next/link';
import { XCircle } from 'lucide-react';
import {
  type MercadoPagoReturnSearchParams,
  processMercadoPagoReturn,
} from '../mercado-pago-return';

interface PageProps {
  searchParams?: MercadoPagoReturnSearchParams;
}

export default async function MercadoPagoFailurePage({
  searchParams,
}: PageProps) {
  const result = searchParams
    ? await processMercadoPagoReturn(searchParams)
    : null;

  return (
    <main className="min-h-screen bg-brand-bg px-4 py-16 text-white">
      <section className="mx-auto flex max-w-lg flex-col items-center gap-5 rounded-[32px] border border-red-500/20 bg-white/[0.03] p-8 text-center">
        <XCircle className="h-14 w-14 text-red-300" />
        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-red-300">
          Pagamento não concluído
        </p>
        <h1 className="text-2xl font-black">Não foi possível confirmar</h1>
        <p className="text-sm leading-6 text-brand-muted">
          {result?.status === 'error'
            ? 'Não conseguimos consultar o pagamento agora. Se houver confirmação posterior, o webhook atualizará o pedido.'
            : 'O pedido foi criado, mas o pagamento não foi aprovado pelo Mercado Pago. Você pode voltar para a loja e tentar novamente.'}
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
