'use client';

import { useState, useTransition } from 'react';
import { CheckCircle2, Loader2, QrCode, RefreshCw, Send, Webhook } from 'lucide-react';
import {
  adoptExistingWhatsAppInstanceAction,
  configureWhatsAppWebhookAction,
  createWhatsAppConnectionAction,
  reconnectWhatsAppAction,
  refreshWhatsAppConnectionAction,
  sendWhatsAppOperationalTestAction,
  saveWhatsAppNotificationSettingsAction,
} from './actions';
import type { WhatsAppAdminState, WhatsAppNotificationEvent } from '@/modules/integrations/evolution-whatsapp/evolution-whatsapp.types';
import { formatBrazilianPhone } from '@/lib/phone/brazilian-phone';

const eventOptions: Array<{ key: WhatsAppNotificationEvent; label: string }> = [
  { key: 'access_code', label: 'Código de acesso' },
  { key: 'order_received', label: 'Pedido recebido' },
  { key: 'payment_pending', label: 'Pagamento pendente' },
  { key: 'payment_approved', label: 'Pagamento aprovado' },
  { key: 'payment_failed', label: 'Pagamento recusado' },
  { key: 'shipment_posted', label: 'Postagem e rastreio' },
  { key: 'shipment_in_transit', label: 'Em trânsito' },
  { key: 'shipment_out_for_delivery', label: 'Saiu para entrega' },
  { key: 'shipment_delivered', label: 'Pedido entregue' },
  { key: 'shipment_exception', label: 'Exceção de entrega' },
  { key: 'shipment_cancelled', label: 'Pedido cancelado' },
  { key: 'operator_order_received', label: 'Operação: novo pedido' },
  { key: 'operator_payment_approved', label: 'Operação: pagamento aprovado' },
];

function Button({ children, onClick, disabled = false }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/50 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{children}</button>;
}

export function WhatsAppConnectionPanel({ initialState }: { initialState: WhatsAppAdminState }) {
  const [state, setState] = useState(initialState);
  const [instanceName, setInstanceName] = useState('');
  const [alertPhone, setAlertPhone] = useState('');
  const [enabled, setEnabled] = useState(initialState.notificationsEnabled);
  const [events, setEvents] = useState<WhatsAppNotificationEvent[]>(initialState.enabledEvents);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const run = (operation: () => Promise<{ qrCodeDataUrl?: string; [key: string]: unknown } | void>, success: string) => {
    setNotice(undefined);
    startTransition(async () => {
      try {
        const result = await operation();
        setQrCodeDataUrl(result?.qrCodeDataUrl);
        setNotice(success);
      } catch {
        setNotice('Não foi possível concluir a ação agora. Confira a configuração do servidor e tente novamente.');
      }
    });
  };

  const toggle = (key: WhatsAppNotificationEvent) => setEvents((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  return (
    <div className="space-y-6">
      {notice ? <p className="rounded-xl border border-blue-400/30 bg-blue-400/10 px-4 py-3 text-sm text-blue-100">{notice}</p> : null}
      <section className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-white">Conexão da loja</h2><p className="mt-1 text-sm text-slate-400">Uma única instância WhatsApp por loja. QR Code não fica salvo.</p></div><span className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200">{state.connectionStatus.replace('_', ' ')}</span></div>
        {state.instanceName ? <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2"><p><span className="text-slate-500">Instância:</span> {state.instanceName}</p><p><span className="text-slate-500">Número:</span> {state.ownerPhoneMasked ?? 'Aguardando leitura do QR'}</p></div> : <div className="mt-5 space-y-3"><label className="block text-sm text-slate-300">Vincular instância existente<input value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder="ex.: brasil_drones" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><div className="flex flex-wrap gap-3"><Button disabled={pending || !instanceName.trim()} onClick={() => run(() => adoptExistingWhatsAppInstanceAction(instanceName), 'Instância vinculada à loja.')}>Vincular instância</Button><Button disabled={pending} onClick={() => run(createWhatsAppConnectionAction, 'Leia o QR Code abaixo para conectar o WhatsApp.')}>Criar conexão</Button></div></div>}
        {state.instanceName ? <div className="mt-5 flex flex-wrap gap-3"><Button disabled={pending} onClick={() => run(reconnectWhatsAppAction, 'Leia o QR Code abaixo para reconectar.')}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />} Reconectar</Button><Button disabled={pending} onClick={() => run(refreshWhatsAppConnectionAction, 'Estado da conexão atualizado.')}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Atualizar estado</Button><Button disabled={pending} onClick={() => run(configureWhatsAppWebhookAction, 'Webhook configurado para os eventos de conexão e entrega.')}><Webhook className="h-4 w-4" /> Configurar webhook</Button></div> : null}
        {qrCodeDataUrl ? <div className="mt-6 max-w-xs rounded-2xl bg-white p-4"><img src={qrCodeDataUrl} alt="QR Code temporário do WhatsApp" className="aspect-square w-full" /><p className="mt-3 text-center text-xs text-slate-700">Use o WhatsApp da loja para ler este QR Code.</p></div> : null}
      </section>
      <section className="rounded-2xl border border-slate-700 bg-slate-950/70 p-5"><h2 className="text-lg font-semibold text-white">Notificações transacionais</h2><p className="mt-1 text-sm text-slate-400">Somente clientes com telefone confirmado e consentimento ativo recebem mensagens.</p><label className="mt-5 flex items-center gap-3 text-sm font-medium text-slate-200"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Ativar notificações por WhatsApp</label><label className="mt-4 block text-sm text-slate-300">Telefone de alerta operacional<input value={alertPhone} onChange={(event) => setAlertPhone(formatBrazilianPhone(event.target.value))} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder={state.alertPhoneMasked ?? '(00) 00000-0000'} aria-label="Telefone de alerta operacional" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white" /></label><div className="mt-5 grid gap-2 sm:grid-cols-2">{eventOptions.map((event) => <label key={event.key} className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300"><input type="checkbox" checked={events.includes(event.key)} onChange={() => toggle(event.key)} /> {event.label}</label>)}</div><div className="mt-5 flex flex-wrap gap-3"><Button disabled={pending} onClick={() => run(() => saveWhatsAppNotificationSettingsAction({ alertPhone, notificationsEnabled: enabled, enabledEvents: events }), 'Preferências salvas.')}><CheckCircle2 className="h-4 w-4" /> Salvar preferências</Button><Button disabled={pending} onClick={() => run(sendWhatsAppOperationalTestAction, 'Teste entrou na fila de envio para o telefone operacional.')}><Send className="h-4 w-4" /> Enviar teste</Button></div></section>
    </div>
  );
}
