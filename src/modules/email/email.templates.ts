import 'server-only';

import type { StoreEmailTemplateKey } from './email.types';

interface StoreEmailTemplateContext {
  storeName: string;
  preview: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footer?: string;
}

function escapeHtml(value: string | undefined) {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderStoreLayout(input: StoreEmailTemplateContext) {
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#1E3DFF;color:#fff;text-decoration:none;font-weight:700;border-radius:10px;padding:12px 18px;margin-top:18px">${escapeHtml(input.ctaLabel)}</a>`
      : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(input.preview)}</title>
  </head>
  <body style="margin:0;background:#f5f7fb;color:#111827;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">${escapeHtml(input.preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;border:1px solid #e5e7eb;overflow:hidden">
            <tr>
              <td style="padding:28px 28px 16px;text-align:center">
                <div style="font-size:22px;font-weight:800;color:#0f172a">${escapeHtml(input.storeName)}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 28px 34px">
                <h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#111827">${escapeHtml(input.title)}</h1>
                <div style="font-size:15px;line-height:1.7;color:#374151">${input.body}</div>
                ${cta}
                <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#6b7280">${escapeHtml(input.footer ?? 'Se voce nao solicitou este e-mail, pode ignora-lo com seguranca.')}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderCustomerLoginCodeEmail(input: {
  storeName: string;
  code: string;
  accountUrl: string;
}) {
  const subject = `Seu codigo de acesso - ${input.storeName}`;
  const body = `<p style="margin:0 0 14px">Use o codigo abaixo para acessar sua conta em <strong>${escapeHtml(input.storeName)}</strong>.</p>
<div style="background:#f3f4f6;border-radius:12px;text-align:center;font-size:40px;letter-spacing:6px;font-weight:800;color:#111827;padding:18px 10px;margin:18px 0">${escapeHtml(input.code)}</div>
<p style="margin:0">Este codigo expira em poucos minutos. Nao compartilhe este codigo com ninguem.</p>`;

  return {
    subject,
    html: renderStoreLayout({
      storeName: input.storeName,
      preview: 'Use este codigo para acessar sua conta.',
      title: 'Codigo de acesso',
      body,
      ctaLabel: 'Abrir minha conta',
      ctaUrl: input.accountUrl,
    }),
    text: [
      `${input.storeName}`,
      '',
      `Use este codigo para acessar sua conta: ${input.code}`,
      'Este codigo expira em poucos minutos. Nao compartilhe este codigo com ninguem.',
      '',
      input.accountUrl,
    ].join('\n'),
  };
}

export function renderOrderReceivedEmail(input: {
  storeName: string;
  orderNumber: string;
  orderUrl: string;
}) {
  return {
    subject: `Pedido ${input.orderNumber} recebido`,
    html: renderStoreLayout({
      storeName: input.storeName,
      preview: `Recebemos o pedido ${input.orderNumber}.`,
      title: 'Pedido recebido',
      body: `<p style="margin:0">Recebemos o pedido <strong>${escapeHtml(input.orderNumber)}</strong>. Voce pode acompanhar o andamento pela sua conta.</p>`,
      ctaLabel: 'Acompanhar pedido',
      ctaUrl: input.orderUrl,
    }),
    text: `Recebemos o pedido ${input.orderNumber}. Acompanhe em ${input.orderUrl}`,
  };
}

export function renderPaymentStatusEmail(input: {
  storeName: string;
  orderNumber: string;
  orderUrl: string;
  status: 'approved' | 'pending' | 'failed';
}) {
  const labels = {
    approved: {
      subject: `Pagamento aprovado - pedido ${input.orderNumber}`,
      title: 'Pagamento aprovado',
      body: 'Seu pagamento foi aprovado e o pedido seguirá para processamento.',
    },
    pending: {
      subject: `Pagamento pendente - pedido ${input.orderNumber}`,
      title: 'Pagamento pendente',
      body: 'Seu pagamento ainda esta pendente. Avisaremos quando houver atualizacao.',
    },
    failed: {
      subject: `Pagamento nao aprovado - pedido ${input.orderNumber}`,
      title: 'Pagamento nao aprovado',
      body: 'Nao conseguimos confirmar o pagamento deste pedido. Voce pode tentar novamente pelo checkout.',
    },
  }[input.status];

  return {
    subject: labels.subject,
    html: renderStoreLayout({
      storeName: input.storeName,
      preview: labels.subject,
      title: labels.title,
      body: `<p style="margin:0">${escapeHtml(labels.body)}</p><p style="margin:14px 0 0">Pedido: <strong>${escapeHtml(input.orderNumber)}</strong></p>`,
      ctaLabel: 'Ver pedido',
      ctaUrl: input.orderUrl,
    }),
    text: `${labels.title}\n\nPedido: ${input.orderNumber}\n${labels.body}\n\n${input.orderUrl}`,
  };
}

export function renderShipmentTrackingEmail(input: {
  storeName: string;
  orderNumber: string;
  orderUrl: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
}) {
  const trackingLine = input.trackingCode
    ? `<p style="margin:14px 0 0">Codigo de rastreio: <strong>${escapeHtml(input.trackingCode)}</strong></p>`
    : '';
  const carrierLine = input.carrier
    ? `<p style="margin:14px 0 0">Transportadora: <strong>${escapeHtml(input.carrier)}</strong></p>`
    : '';

  return {
    subject: `Pedido ${input.orderNumber} enviado`,
    html: renderStoreLayout({
      storeName: input.storeName,
      preview: `Seu pedido ${input.orderNumber} foi enviado.`,
      title: 'Pedido enviado',
      body: `<p style="margin:0">Seu pedido <strong>${escapeHtml(input.orderNumber)}</strong> foi atualizado com informacoes de envio.</p>${carrierLine}${trackingLine}`,
      ctaLabel: input.trackingUrl ? 'Rastrear entrega' : 'Ver pedido',
      ctaUrl: input.trackingUrl ?? input.orderUrl,
    }),
    text: [
      `Pedido ${input.orderNumber} enviado`,
      input.carrier ? `Transportadora: ${input.carrier}` : undefined,
      input.trackingCode ? `Codigo de rastreio: ${input.trackingCode}` : undefined,
      input.trackingUrl ?? input.orderUrl,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function isMarketingTemplate(templateKey: StoreEmailTemplateKey) {
  return templateKey === 'cart_abandoned' || templateKey === 'product_suggestions';
}
