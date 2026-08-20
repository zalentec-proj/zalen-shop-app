'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import { getMercadoPagoCheckoutPaymentStatusAction } from './actions';

type MercadoPagoBrickController = {
  unmount: () => void;
};

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: 'statusScreen',
      containerId: string,
      settings: Record<string, unknown>
    ) => Promise<MercadoPagoBrickController>;
  };
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string }
) => MercadoPagoInstance;

type MercadoPagoBrowserWindow = Omit<Window, 'MercadoPago'> & {
  MercadoPago?: MercadoPagoConstructor;
  statusScreenBrickController?: MercadoPagoBrickController;
};

type PollingPhase =
  | 'preparing'
  | 'waiting'
  | 'approved'
  | 'rejected'
  | 'expired';

const MAX_POLLING_DURATION_MS = 2 * 60 * 1000;
const POLLING_INTERVAL_MS = 4 * 1000;

function statusMessage(phase: PollingPhase) {
  switch (phase) {
    case 'approved':
      return 'Pagamento confirmado. Estamos preparando seu pedido.';
    case 'rejected':
      return 'O Pix não foi aprovado. Você pode iniciar uma nova tentativa.';
    case 'expired':
      return 'O Pix continua disponível. Acompanhe o pedido enquanto aguardamos a confirmação.';
    case 'preparing':
      return 'Preparando os dados do Pix...';
    default:
      return 'Aguardando a confirmação do Pix. Esta tela será atualizada automaticamente.';
  }
}

export function PixPaymentStatusScreen({
  orderId,
  orderNumber,
  paymentId,
  publicKey,
  orderPath,
  onApproved,
}: {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  publicKey: string;
  orderPath: string;
  onApproved: (redirectPath: string) => void;
}) {
  const reactId = useId().replace(/:/g, '');
  const containerId = `mercado-pago-status-${reactId}`;
  const [phase, setPhase] = useState<PollingPhase>('preparing');
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(MAX_POLLING_DURATION_MS / 1000)
  );
  const [brickError, setBrickError] = useState<string | null>(null);
  const approvedRedirectRef = useRef<string | null>(null);
  const onApprovedRef = useRef(onApproved);

  useEffect(() => {
    onApprovedRef.current = onApproved;
  }, [onApproved]);

  useEffect(() => {
    let isMounted = true;
    let activeController: MercadoPagoBrickController | null = null;
    const mercadoPagoWindow = window as MercadoPagoBrowserWindow;
    let existingScript: HTMLScriptElement | null = null;

    const renderStatusScreen = () => {
      const container = document.getElementById(containerId);

      if (!container || !mercadoPagoWindow.MercadoPago) {
        return;
      }

      mercadoPagoWindow.statusScreenBrickController?.unmount();
      container.innerHTML = '';

      const mp = new mercadoPagoWindow.MercadoPago(publicKey, { locale: 'pt-BR' });

      mp.bricks()
        .create('statusScreen', containerId, {
          initialization: {
            paymentId,
          },
          callbacks: {
            onReady: () => {
              if (isMounted) {
                setPhase('waiting');
              }
            },
            onError: () => {
              if (isMounted) {
                setBrickError(
                  'Não foi possível exibir o Pix aqui. Você ainda pode acompanhar este pedido.'
                );
              }
            },
          },
        })
        .then((controller) => {
          if (!isMounted) {
            controller.unmount();
            return;
          }

          activeController = controller;
          mercadoPagoWindow.statusScreenBrickController = controller;
        })
        .catch(() => {
          if (isMounted) {
            setBrickError(
              'Não foi possível exibir o Pix aqui. Você ainda pode acompanhar este pedido.'
            );
          }
        });
    };

    if (mercadoPagoWindow.MercadoPago) {
      renderStatusScreen();
    } else {
      existingScript = document.querySelector<HTMLScriptElement>(
        'script[src="https://sdk.mercadopago.com/js/v2"]'
      );

      if (existingScript) {
        existingScript.addEventListener('load', renderStatusScreen, { once: true });
      } else {
        const script = document.createElement('script');
        script.src = 'https://sdk.mercadopago.com/js/v2';
        script.async = true;
        script.onload = renderStatusScreen;
        script.onerror = () => {
          if (isMounted) {
            setBrickError(
              'Não foi possível carregar o Pix agora. Você ainda pode acompanhar este pedido.'
            );
          }
        };
        document.body.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      existingScript?.removeEventListener('load', renderStatusScreen);
      activeController?.unmount();
    };
  }, [containerId, paymentId, publicKey]);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: number | undefined;
    const startedAt = Date.now();

    const scheduleNextPoll = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(MAX_POLLING_DURATION_MS - elapsed, 0);

      if (!isMounted || approvedRedirectRef.current || remaining === 0) {
        if (isMounted && !approvedRedirectRef.current) {
          setPhase('expired');
          setSecondsRemaining(0);
        }
        return;
      }

      setSecondsRemaining(Math.ceil(remaining / 1000));
      timeoutId = window.setTimeout(poll, Math.min(POLLING_INTERVAL_MS, remaining));
    };

    const poll = async () => {
      const result = await getMercadoPagoCheckoutPaymentStatusAction({
        orderId,
        paymentId,
      });

      if (!isMounted || approvedRedirectRef.current) {
        return;
      }

      if (!result.ok) {
        scheduleNextPoll();
        return;
      }

      if (result.status === 'approved') {
        approvedRedirectRef.current = result.redirectPath;
        setPhase('approved');
        setSecondsRemaining(0);
        window.setTimeout(() => onApprovedRef.current(result.redirectPath), 1400);
        return;
      }

      if (
        result.status === 'rejected' ||
        result.status === 'cancelled' ||
        result.status === 'refunded'
      ) {
        setPhase('rejected');
        setSecondsRemaining(0);
        return;
      }

      setPhase('waiting');
      scheduleNextPoll();
    };

    void poll();

    return () => {
      isMounted = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [orderId, paymentId]);

  const isTerminal = phase === 'approved' || phase === 'rejected' || phase === 'expired';
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = String(secondsRemaining % 60).padStart(2, '0');

  return (
    <section className="rounded-2xl border border-blue-primary/45 bg-blue-primary/10 p-4">
      <div className="flex flex-col gap-3 border-b border-blue-primary/20 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-primary/20">
            {phase === 'approved' ? (
              <CheckCircle2 className="h-5 w-5 text-green-accent" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-blue-primary" />
            )}
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              {phase === 'approved' ? 'Pix confirmado' : 'Conclua o Pix'}
            </h3>
            <p className="mt-1 text-xs leading-5 text-brand-muted" aria-live="polite">
              {statusMessage(phase)}
            </p>
          </div>
        </div>
        {!isTerminal ? (
          <div className="inline-flex h-9 items-center gap-2 self-start rounded-lg border border-white/10 bg-[#050A14]/70 px-3 text-xs font-bold text-white">
            <Clock3 className="h-4 w-4 text-blue-primary" />
            {minutes}:{seconds}
          </div>
        ) : null}
      </div>

      <div
        id={containerId}
        className="mt-4 min-h-[360px] overflow-hidden rounded-xl bg-white p-2 text-brand-bg"
      />

      <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-brand-muted">
          <RefreshCw className={`h-3.5 w-3.5 ${isTerminal ? '' : 'animate-spin'}`} />
          {brickError ??
            (isTerminal
              ? 'O status final fica disponível nos detalhes do pedido.'
              : 'Confirmando automaticamente com segurança.')}
        </p>
        <Link
          href={orderPath}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-white/15 px-4 text-xs font-black text-white transition hover:border-white/30"
        >
          Ver pedido {orderNumber}
        </Link>
      </div>
    </section>
  );
}
