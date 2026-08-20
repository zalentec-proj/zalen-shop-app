import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { getGuestCheckoutOrderAccess } from '@/modules/payments/guest-checkout-access.service';
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
  title: 'Pagamento não concluído — Brasil Drones & Parts',
  ...noindexMetadata,
};

export default async function MercadoPagoFailurePage({
  searchParams,
}: PageProps) {
  const result = searchParams
    ? await processMercadoPagoReturn(searchParams)
    : null;
  const store = await resolveCurrentStoreFromHeaders();
  const [storefrontOrigin, guestAccess] = await Promise.all([
    getCurrentStorefrontOrigin(store),
    result?.orderId
      ? getGuestCheckoutOrderAccess({
          storeId: store.id,
          orderId: result.orderId,
        })
      : Promise.resolve(null),
  ]);
  const orderHref = guestAccess
    ? `${storefrontOrigin}/pedido/${guestAccess.order.id}`
    : result?.orderId
      ? `${storefrontOrigin}/conta/entrar?next=${encodeURIComponent(`/conta/pedidos/${result.orderId}`)}`
    : `${storefrontOrigin}/conta/entrar?next=/conta/pedidos`;

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
        <div className="mt-2 grid w-full gap-2 sm:grid-cols-2">
          <Link
            href={orderHref}
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
