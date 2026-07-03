import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { noindexMetadata } from '@/modules/seo/seo.service';
import {
  getCurrentStorefrontOrigin,
  resolveCurrentStoreFromHeaders,
} from '@/modules/stores/store-resolution';
import {
  type MercadoPagoReturnSearchParams,
  processMercadoPagoReturn,
} from '../mercado-pago-return';

interface PageProps {
  searchParams?: MercadoPagoReturnSearchParams;
}

export const metadata = {
  title: 'Pagamento pendente — Brasil Drones & Parts',
  ...noindexMetadata,
};

export default async function MercadoPagoPendingPage({
  searchParams,
}: PageProps) {
  const result = searchParams
    ? await processMercadoPagoReturn(searchParams)
    : null;
  const store = await resolveCurrentStoreFromHeaders();
  const storefrontOrigin = await getCurrentStorefrontOrigin(store);
  const accountHref = result?.orderId
    ? `${storefrontOrigin}/conta/entrar?next=${encodeURIComponent(`/conta/pedidos/${result.orderId}`)}`
    : `${storefrontOrigin}/conta/entrar?next=/conta/pedidos`;

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
        <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
          <Link
            href={accountHref}
            className="flex h-12 items-center justify-center rounded-xl bg-blue-primary px-4 text-sm font-bold text-white"
          >
            Acompanhar pedido
          </Link>
          <Link
            href={storefrontOrigin}
            className="flex h-12 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-bold text-white transition hover:border-white/20"
          >
            Voltar para a loja
          </Link>
        </div>
      </section>
    </main>
  );
}
