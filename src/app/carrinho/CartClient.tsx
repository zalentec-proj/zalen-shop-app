'use client';

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  IdCard,
  Mail,
  Minus,
  Package,
  Plus,
  Shield,
  ShoppingCart,
  Trash2,
  Truck,
  UserRound,
} from 'lucide-react';
import Footer from '@/components/layout/Footer';
import {
  checkoutCartAction,
  identifyCheckoutCustomerAction,
  previewCheckoutCartAction,
  type CheckoutPreviewActionResult,
} from './actions';
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj, onlyDigits } from '@/modules/customers/br-document';
import {
  createEmptyCart,
  getItemCount,
  removeItem,
  updateQuantity,
} from '@/modules/cart/cart.utils';
import {
  clearStoredCart,
  getStoredCart,
  saveStoredCart,
} from '@/modules/cart/cart.storage';
import type { Cart } from '@/modules/cart/cart.types';
import type { CustomerType } from '@/modules/pricing/pricing.types';

interface Props {
  customerSession: {
    email?: string;
  } | null;
}

type CheckoutStep =
  | 'identificacao'
  | 'cadastro'
  | 'entrega'
  | 'envio'
  | 'pagamento';

type CheckoutPreview = Extract<CheckoutPreviewActionResult, { ok: true }>;

type CustomerState = {
  name: string;
  email: string;
  phone: string;
  document: string;
  customerType: CustomerType;
  legalName: string;
  stateRegistration: string;
  stateRegistrationExempt: boolean;
  acceptsMarketing: boolean;
  postalCode: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
};

type ValidationState = 'empty' | 'valid' | 'invalid' | 'neutral';

const steps: Array<{ id: CheckoutStep; label: string; title: string }> = [
  { id: 'identificacao', label: '1', title: 'Identificação' },
  { id: 'cadastro', label: '2', title: 'Dados' },
  { id: 'entrega', label: '3', title: 'Entrega' },
  { id: 'envio', label: '4', title: 'Envio' },
  { id: 'pagamento', label: '5', title: 'Pagamento' },
];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getCustomerTypeFromDocumentInput(
  document: string,
  fallback: CustomerType
): CustomerType {
  const digits = onlyDigits(document);
  return digits.length === 14 ? 'pj' : digits.length === 11 ? 'pf' : fallback;
}

function getDocumentLabel(customerType: CustomerType) {
  return customerType === 'pj' ? 'CNPJ' : 'CPF';
}

function getDocumentValidationState(document: string, customerType: CustomerType) {
  const digits = onlyDigits(document);

  if (!digits) {
    return 'empty';
  }

  return customerType === 'pj'
    ? isValidCnpj(document)
      ? 'valid'
      : 'invalid'
    : isValidCpf(document)
      ? 'valid'
      : 'invalid';
}

function getGenericValidationState(
  value: string,
  validator: (value: string) => boolean
): ValidationState {
  if (!value.trim()) {
    return 'empty';
  }

  return validator(value) ? 'valid' : 'invalid';
}

function CheckoutInput({
  label,
  value,
  onChange,
  type = 'text',
  validationState = 'neutral',
  icon: Icon,
  helper,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  validationState?: ValidationState;
  icon?: ComponentType<{ className?: string }>;
  helper?: string;
  autoComplete?: string;
}) {
  const borderClass =
    validationState === 'valid'
      ? 'border-green-accent/55 focus:border-green-accent'
      : validationState === 'invalid'
        ? 'border-red-400/60 focus:border-red-400'
        : 'border-brand-border-soft focus:border-blue-primary/60';

  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">
        {label}
      </span>
      <span className="relative block">
        {Icon ? (
          <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
        ) : null}
        <input
          value={value}
          type={type}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          placeholder={label}
          className={`h-11 w-full rounded-xl border bg-[#050A14]/80 px-3 pr-11 text-sm font-semibold text-white outline-none transition placeholder:text-brand-muted ${Icon ? 'pl-10' : ''} ${borderClass}`}
        />
        {validationState === 'valid' ? (
          <span className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-green-accent text-brand-bg">
            <CheckCircle2 className="h-4 w-4" />
          </span>
        ) : null}
      </span>
      {helper ? (
        <span
          className={`mt-1 block text-[11px] font-semibold ${
            validationState === 'invalid' ? 'text-red-200' : 'text-brand-muted'
          }`}
        >
          {helper}
        </span>
      ) : null}
    </label>
  );
}

function StepCard({
  active,
  done,
  index,
  title,
}: {
  active: boolean;
  done: boolean;
  index: string;
  title: string;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2 transition ${
        active
          ? 'border-blue-primary bg-blue-primary/12 text-white'
          : done
            ? 'border-green-accent/25 bg-green-accent/8 text-green-accent'
            : 'border-brand-border-soft bg-[#050A14]/60 text-brand-muted'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
            active
              ? 'bg-blue-primary text-white'
              : done
                ? 'bg-green-accent text-brand-bg'
                : 'bg-white/5 text-brand-muted'
          }`}
        >
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">
          {title}
        </span>
      </div>
    </div>
  );
}

export default function CartClient({ customerSession }: Props) {
  const [cart, setCart] = useState<Cart>(() => createEmptyCart());
  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutStep>('identificacao');
  const [identifier, setIdentifier] = useState(customerSession?.email ?? '');
  const [customer, setCustomer] = useState<CustomerState>({
    name: '',
    email: customerSession?.email ?? '',
    phone: '',
    document: '',
    customerType: 'pf',
    legalName: '',
    stateRegistration: '',
    stateRegistrationExempt: false,
    acceptsMarketing: false,
    postalCode: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
  });
  const [checkoutPreview, setCheckoutPreview] =
    useState<CheckoutPreview | null>(null);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const itemCount = getItemCount(cart);
  const stepIndex = steps.findIndex((step) => step.id === checkoutStep);
  const activeCustomerType = getCustomerTypeFromDocumentInput(
    customer.document,
    customer.customerType
  );
  const summarySubtotal = checkoutPreview?.subtotal ?? cart.subtotal;
  const summaryShipping =
    checkoutPreview?.shippingTotal ?? (cart.subtotal >= 500 ? 0 : 49.9);
  const summaryTotal =
    checkoutPreview?.total ?? cart.total + summaryShipping;
  const summaryItems = checkoutPreview?.items;

  const actionItems = useMemo(
    () =>
      cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    [cart.items]
  );

  useEffect(() => {
    setCart(getStoredCart());
  }, []);

  function updateCustomer(patch: Partial<CustomerState>) {
    setCheckoutError(null);
    setCustomer((current) => ({
      ...current,
      ...patch,
    }));
    setCheckoutPreview(null);
  }

  function persistCart(nextCart: Cart) {
    setCheckoutPreview(null);
    setCart(saveStoredCart(nextCart));
  }

  function handleUpdateQty(productId: string, variantId: string, qty: number) {
    persistCart(updateQuantity(cart, productId, variantId, qty));
  }

  function handleRemove(productId: string, variantId: string) {
    persistCart(removeItem(cart, productId, variantId));
  }

  async function refreshPreview(nextCustomer = customer) {
    if (actionItems.length === 0) {
      return null;
    }

    const result = await previewCheckoutCartAction({
      items: actionItems,
      document: nextCustomer.document,
      customerType: nextCustomer.customerType,
    });

    if (!result.ok) {
      setCheckoutError(result.error);
      return null;
    }

    setCheckoutPreview(result);
    return result;
  }

  async function handleIdentify() {
    const value = identifier.trim();
    const digits = onlyDigits(value);
    const isDocument = digits.length >= 11;

    if (!isEmail(value) && (!isDocument || !isValidCpfOrCnpj(value))) {
      setCheckoutError('Informe um e-mail, CPF ou CNPJ válido.');
      return;
    }

    setCheckoutError(null);
    setIsLookingUp(true);

    const result = await identifyCheckoutCustomerAction({ identifier: value });

    setIsLookingUp(false);

    if (!result.ok) {
      setCheckoutError(result.error);
      return;
    }

    const nextCustomer: CustomerState = {
      ...customer,
      email: result.customer?.email ?? (isEmail(value) ? value.toLowerCase() : customer.email),
      document: result.customer?.document ?? (isDocument ? digits : customer.document),
      customerType:
        result.customerType ??
        getCustomerTypeFromDocumentInput(isDocument ? digits : customer.document, customer.customerType),
      name: result.customer?.name ?? customer.name,
      phone: result.customer?.phone ?? customer.phone,
      legalName: result.customer?.legalName ?? customer.legalName,
      stateRegistration:
        result.customer?.stateRegistration ?? customer.stateRegistration,
      stateRegistrationExempt:
        result.customer?.stateRegistrationExempt ??
        customer.stateRegistrationExempt,
      postalCode:
        result.customer?.shippingAddress?.postalCode ?? customer.postalCode,
      street: result.customer?.shippingAddress?.street ?? customer.street,
      number: result.customer?.shippingAddress?.number ?? customer.number,
      complement:
        result.customer?.shippingAddress?.complement ?? customer.complement,
      district: result.customer?.shippingAddress?.district ?? customer.district,
      city: result.customer?.shippingAddress?.city ?? customer.city,
      state: result.customer?.shippingAddress?.state ?? customer.state,
    };

    setCustomer(nextCustomer);
    await refreshPreview(nextCustomer);
    setCheckoutStep('cadastro');
  }

  function validateCustomerData() {
    const currentType = getCustomerTypeFromDocumentInput(
      customer.document,
      customer.customerType
    );

    if (customer.name.trim().length < 2) {
      return 'Informe o nome completo para continuar.';
    }

    if (!isEmail(customer.email)) {
      return 'Informe um e-mail válido para acompanhar o pedido.';
    }

    if (onlyDigits(customer.phone).length < 10) {
      return 'Informe um WhatsApp com DDD.';
    }

    if (
      currentType === 'pj'
        ? !isValidCnpj(customer.document)
        : !isValidCpf(customer.document)
    ) {
      return `${getDocumentLabel(currentType)} inválido.`;
    }

    if (currentType === 'pj' && customer.legalName.trim().length < 2) {
      return 'Informe a razão social da empresa.';
    }

    if (
      currentType === 'pj' &&
      !customer.stateRegistrationExempt &&
      customer.stateRegistration.trim().length < 2
    ) {
      return 'Informe a inscrição estadual ou marque isento.';
    }

    return null;
  }

  function validateDeliveryData() {
    if (onlyDigits(customer.postalCode).length < 8) {
      return 'Informe um CEP válido com 8 dígitos.';
    }

    if (customer.street.trim().length < 2) {
      return 'Informe rua ou avenida.';
    }

    if (!customer.number.trim()) {
      return 'Informe o número do endereço.';
    }

    if (customer.district.trim().length < 2) {
      return 'Informe o bairro.';
    }

    if (customer.city.trim().length < 2 || customer.state.trim().length !== 2) {
      return 'Revise cidade e UF.';
    }

    return null;
  }

  async function handleContinueFromRegistration() {
    const validationError = validateCustomerData();

    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    const currentType = getCustomerTypeFromDocumentInput(
      customer.document,
      customer.customerType
    );
    const nextCustomer = {
      ...customer,
      customerType: currentType,
    };

    setCustomer(nextCustomer);
    setCheckoutError(null);
    await refreshPreview(nextCustomer);
    setCheckoutStep('entrega');
  }

  async function handleContinueFromDelivery() {
    const validationError = validateDeliveryData();

    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    setCheckoutError(null);
    await refreshPreview();
    setCheckoutStep('envio');
  }

  async function handleContinueFromShipping() {
    setCheckoutError(null);
    await refreshPreview();
    setCheckoutStep('pagamento');
  }

  async function handleCheckout() {
    const customerError = validateCustomerData();
    const deliveryError = validateDeliveryData();

    if (customerError || deliveryError) {
      setCheckoutError(customerError ?? deliveryError);
      setCheckoutStep(customerError ? 'cadastro' : 'entrega');
      return;
    }

    setCheckoutError(null);
    setIsSubmitting(true);

    const currentType = getCustomerTypeFromDocumentInput(
      customer.document,
      customer.customerType
    );
    const result = await checkoutCartAction({
      customer: {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        document: customer.document,
        customerType: currentType,
        legalName: currentType === 'pj' ? customer.legalName : undefined,
        stateRegistration:
          currentType === 'pj' && !customer.stateRegistrationExempt
            ? customer.stateRegistration
            : undefined,
        stateRegistrationExempt:
          currentType === 'pj' ? customer.stateRegistrationExempt : false,
        shippingAddress: {
          postalCode: customer.postalCode,
          street: customer.street,
          number: customer.number,
          complement: customer.complement,
          district: customer.district,
          city: customer.city,
          state: customer.state.toUpperCase(),
        },
      },
      items: actionItems,
      paymentMethod: 'mercado_pago_checkout_pro',
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setCheckoutError(result.error);
      return;
    }

    if (result.paymentUrl) {
      window.location.href = result.paymentUrl;
      return;
    }

    setCart(createEmptyCart());
    clearStoredCart();
    setOrderNumber(result.orderNumber);
    setCheckoutDone(true);
  }

  if (checkoutDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
        <div className="glass-panel-strong flex w-full max-w-md flex-col items-center gap-6 rounded-[32px] p-10 text-center">
          <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full border-2 border-green-accent/30 bg-green-accent/10">
            <CheckCircle2 className="h-10 w-10 text-green-accent" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-green-accent">
              Pedido confirmado
            </span>
            <h2 className="font-display mt-1 text-2xl font-extrabold text-white">
              Voo Confirmado!
            </h2>
          </div>
          <p className="text-sm text-brand-muted">
            Pedido{' '}
            <span className="font-mono font-bold text-white">{orderNumber}</span>{' '}
            recebido com sucesso.
          </p>
          <div className="w-full rounded-2xl border border-blue-primary/20 bg-blue-primary/10 p-4 text-left">
            <p className="text-xs font-bold text-white">
              Quer comprar mais rápido na próxima?
            </p>
            <p className="mt-1 text-[11px] leading-5 text-brand-muted">
              A conta é opcional e ajuda a acompanhar pedidos futuros.
            </p>
            <Link
              href="/conta/cadastro"
              className="mt-3 flex h-10 items-center justify-center rounded-xl bg-blue-primary text-xs font-bold text-white"
            >
              Criar conta opcional
            </Link>
          </div>
          <Link
            href="/"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-primary text-sm font-bold text-white shadow-[0_6px_20px_rgba(30,61,255,0.3)] transition-all hover:opacity-95"
          >
            Continuar comprando
          </Link>
        </div>
      </div>
    );
  }

  if (itemCount === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-brand-bg px-4">
        <div className="glass-panel flex h-20 w-20 items-center justify-center rounded-full">
          <ShoppingCart className="h-8 w-8 text-brand-muted" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white">Seu carrinho está vazio</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Adicione produtos para continuar.
          </p>
        </div>
        <Link
          href="/"
          className="flex h-12 items-center gap-2 rounded-xl bg-blue-primary px-8 text-sm font-bold text-white shadow-[0_6px_20px_rgba(30,61,255,0.3)] transition-all hover:opacity-95"
        >
          <ArrowLeft className="h-4 w-4" />
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-brand-bg">
      <div className="glow-radial pointer-events-none absolute left-[10%] top-[5%] -z-10 h-[500px] w-[500px] rounded-full opacity-30" />

      <header className="fixed left-0 right-0 top-0 z-50 bg-transparent px-4 py-4 md:px-8">
        <nav className="navbar-glass mx-auto flex h-[72px] max-w-7xl items-center justify-between rounded-full px-6 shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-brand-muted transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Continuar comprando
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-muted" />
            <span className="text-sm font-bold text-white">
              Carrinho ({itemCount} {itemCount === 1 ? 'item' : 'itens'})
            </span>
          </div>
          <div className="hidden w-32 md:block" />
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-12 pt-28 md:px-8">
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="glass-panel rounded-[28px] p-5 md:p-7">
            <div className="flex flex-col gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-primary">
                Checkout
              </p>
              <h1 className="font-display text-2xl font-black text-white">
                Compra sem conta obrigatória
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-brand-muted">
                Identificamos CPF ou CNPJ para aplicar a regra correta de cliente
                e salvar dados fiscais do pedido.
              </p>
            </div>

            <div className="mt-5 grid gap-2 md:grid-cols-5">
              {steps.map((step, index) => (
                <StepCard
                  key={step.id}
                  active={checkoutStep === step.id}
                  done={index < stepIndex}
                  index={step.label}
                  title={step.title}
                />
              ))}
            </div>

            <div className="mt-6">
              {checkoutStep === 'identificacao' ? (
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4">
                    <h2 className="text-lg font-black text-white">
                      Informe e-mail, CPF ou CNPJ
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-brand-muted">
                      Se já existir cadastro na loja, usamos os dados salvos de
                      forma segura. Se não existir, abrimos o cadastro rápido.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
                      <CheckoutInput
                        label="E-mail, CPF ou CNPJ"
                        value={identifier}
                        onChange={(value) => {
                          setCheckoutError(null);
                          setIdentifier(value);
                        }}
                        validationState={
                          !identifier.trim()
                            ? 'empty'
                            : isEmail(identifier) || isValidCpfOrCnpj(identifier)
                              ? 'valid'
                              : 'invalid'
                        }
                        icon={IdCard}
                        helper={
                          identifier.trim() &&
                          !isEmail(identifier) &&
                          !isValidCpfOrCnpj(identifier)
                            ? 'Digite um e-mail, CPF ou CNPJ válido.'
                            : undefined
                        }
                      />
                      <button
                        type="button"
                        onClick={handleIdentify}
                        disabled={isLookingUp}
                        className="mt-auto h-11 rounded-xl bg-blue-primary px-5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(30,61,255,0.3)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isLookingUp ? 'Verificando...' : 'Continuar'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {checkoutStep === 'cadastro' ? (
                <div className="grid gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-white">
                        Informações pessoais
                      </h2>
                      <p className="mt-1 text-sm text-brand-muted">
                        O tipo PF/PJ será aplicado pelo CPF ou CNPJ informado.
                      </p>
                    </div>
                    <label className="flex items-center gap-2 rounded-full border border-brand-border-soft bg-[#050A14]/70 px-3 py-2 text-xs font-bold text-white">
                      <input
                        type="checkbox"
                        checked={customer.customerType === 'pj'}
                        onChange={(event) =>
                          updateCustomer({
                            customerType: event.target.checked ? 'pj' : 'pf',
                            document: '',
                          })
                        }
                      />
                      Cadastrar como Pessoa Jurídica
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <CheckoutInput
                      label="Nome completo"
                      value={customer.name}
                      onChange={(value) => updateCustomer({ name: value })}
                      validationState={getGenericValidationState(
                        customer.name,
                        (value) => value.trim().length >= 2
                      )}
                      icon={UserRound}
                      autoComplete="name"
                    />
                    <CheckoutInput
                      label="E-mail"
                      value={customer.email}
                      onChange={(value) => updateCustomer({ email: value })}
                      validationState={getGenericValidationState(
                        customer.email,
                        isEmail
                      )}
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                    />
                    <CheckoutInput
                      label="Telefone com DDD"
                      value={customer.phone}
                      onChange={(value) => updateCustomer({ phone: value })}
                      validationState={getGenericValidationState(
                        customer.phone,
                        (value) => onlyDigits(value).length >= 10
                      )}
                      autoComplete="tel"
                    />
                    <CheckoutInput
                      label={getDocumentLabel(activeCustomerType)}
                      value={customer.document}
                      onChange={(value) =>
                        updateCustomer({
                          document: value,
                          customerType: getCustomerTypeFromDocumentInput(
                            value,
                            customer.customerType
                          ),
                        })
                      }
                      validationState={getDocumentValidationState(
                        customer.document,
                        activeCustomerType
                      )}
                      icon={FileText}
                      helper={
                        getDocumentValidationState(
                          customer.document,
                          activeCustomerType
                        ) === 'invalid'
                          ? `${getDocumentLabel(activeCustomerType)} inválido.`
                          : undefined
                      }
                    />
                  </div>

                  {activeCustomerType === 'pj' ? (
                    <div className="rounded-2xl border border-blue-primary/20 bg-blue-primary/8 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
                        <Building2 className="h-4 w-4 text-blue-primary" />
                        Informações da empresa
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <CheckoutInput
                          label="Razão social"
                          value={customer.legalName}
                          onChange={(value) =>
                            updateCustomer({ legalName: value })
                          }
                          validationState={getGenericValidationState(
                            customer.legalName,
                            (value) => value.trim().length >= 2
                          )}
                        />
                        <CheckoutInput
                          label="Inscrição estadual"
                          value={customer.stateRegistration}
                          onChange={(value) =>
                            updateCustomer({ stateRegistration: value })
                          }
                          validationState={
                            customer.stateRegistrationExempt
                              ? 'neutral'
                              : getGenericValidationState(
                                  customer.stateRegistration,
                                  (value) => value.trim().length >= 2
                                )
                          }
                        />
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-muted">
                        <input
                          type="checkbox"
                          checked={customer.stateRegistrationExempt}
                          onChange={(event) =>
                            updateCustomer({
                              stateRegistrationExempt: event.target.checked,
                              stateRegistration: event.target.checked
                                ? ''
                                : customer.stateRegistration,
                            })
                          }
                        />
                        Isento de inscrição estadual
                      </label>
                    </div>
                  ) : null}

                  <label className="flex items-center gap-2 text-xs font-semibold text-brand-muted">
                    <input
                      type="checkbox"
                      checked={customer.acceptsMarketing}
                      onChange={(event) =>
                        updateCustomer({ acceptsMarketing: event.target.checked })
                      }
                    />
                    Desejo receber e-mails promocionais
                  </label>

                  <CheckoutActionBar
                    onBack={() => setCheckoutStep('identificacao')}
                    onNext={handleContinueFromRegistration}
                    nextLabel="Salvar dados"
                  />
                </div>
              ) : null}

              {checkoutStep === 'entrega' ? (
                <div className="grid gap-5">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Endereço de entrega
                    </h2>
                    <p className="mt-1 text-sm text-brand-muted">
                      Usaremos o mesmo endereço para cobrança nesta primeira versão.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <CheckoutInput
                      label="CEP"
                      value={customer.postalCode}
                      onChange={(value) => updateCustomer({ postalCode: value })}
                      validationState={getGenericValidationState(
                        customer.postalCode,
                        (value) => onlyDigits(value).length >= 8
                      )}
                      autoComplete="postal-code"
                    />
                    <CheckoutInput
                      label="Rua/Avenida"
                      value={customer.street}
                      onChange={(value) => updateCustomer({ street: value })}
                      validationState={getGenericValidationState(
                        customer.street,
                        (value) => value.trim().length >= 2
                      )}
                      autoComplete="address-line1"
                    />
                    <CheckoutInput
                      label="Número"
                      value={customer.number}
                      onChange={(value) => updateCustomer({ number: value })}
                      validationState={getGenericValidationState(
                        customer.number,
                        (value) => value.trim().length >= 1
                      )}
                    />
                    <CheckoutInput
                      label="Complemento"
                      value={customer.complement}
                      onChange={(value) => updateCustomer({ complement: value })}
                    />
                    <CheckoutInput
                      label="Bairro"
                      value={customer.district}
                      onChange={(value) => updateCustomer({ district: value })}
                      validationState={getGenericValidationState(
                        customer.district,
                        (value) => value.trim().length >= 2
                      )}
                    />
                    <CheckoutInput
                      label="Cidade"
                      value={customer.city}
                      onChange={(value) => updateCustomer({ city: value })}
                      validationState={getGenericValidationState(
                        customer.city,
                        (value) => value.trim().length >= 2
                      )}
                      autoComplete="address-level2"
                    />
                    <CheckoutInput
                      label="UF"
                      value={customer.state}
                      onChange={(value) =>
                        updateCustomer({ state: value.toUpperCase().slice(0, 2) })
                      }
                      validationState={getGenericValidationState(
                        customer.state,
                        (value) => value.trim().length === 2
                      )}
                      autoComplete="address-level1"
                    />
                  </div>
                  <CheckoutActionBar
                    onBack={() => setCheckoutStep('cadastro')}
                    onNext={handleContinueFromDelivery}
                    nextLabel="Continuar para envio"
                  />
                </div>
              ) : null}

              {checkoutStep === 'envio' ? (
                <div className="grid gap-5">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Forma de envio
                    </h2>
                    <p className="mt-1 text-sm text-brand-muted">
                      Melhor Envio ainda não está ativo; usamos regra operacional
                      inicial da Zalen.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-green-accent/25 bg-green-accent/8 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-accent/15">
                        <Truck className="h-5 w-5 text-green-accent" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm font-bold text-white">
                            Entrega Brasil Drones
                          </h3>
                          <span className="text-sm font-black text-green-accent">
                            {summaryShipping === 0
                              ? 'Grátis'
                              : formatCurrency(summaryShipping)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-brand-muted">
                          Frete grátis a partir de {formatCurrency(500)}. Prazo
                          estimado: 2 a 4 dias úteis.
                        </p>
                      </div>
                    </div>
                  </div>
                  <CheckoutActionBar
                    onBack={() => setCheckoutStep('entrega')}
                    onNext={handleContinueFromShipping}
                    nextLabel="Continuar para pagamento"
                  />
                </div>
              ) : null}

              {checkoutStep === 'pagamento' ? (
                <div className="grid gap-5">
                  <div>
                    <h2 className="text-lg font-black text-white">
                      Forma de pagamento
                    </h2>
                    <p className="mt-1 text-sm text-brand-muted">
                      Você será redirecionado para o ambiente seguro do Mercado
                      Pago.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-primary bg-blue-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-primary/20">
                        <CreditCard className="h-5 w-5 text-blue-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Mercado Pago
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-brand-muted">
                          Escolha Pix, cartão ou boleto no checkout do Mercado
                          Pago. Seus dados de pagamento não passam pela Zalen.
                        </p>
                      </div>
                    </div>
                  </div>
                  <CheckoutActionBar
                    onBack={() => setCheckoutStep('envio')}
                    onNext={handleCheckout}
                    nextLabel={
                      isSubmitting ? 'Iniciando pagamento...' : 'Pagar com Mercado Pago'
                    }
                    disabled={isSubmitting}
                  />
                </div>
              ) : null}
            </div>

            {checkoutError ? (
              <p className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-center text-xs font-semibold text-red-200">
                {checkoutError}
              </p>
            ) : null}
          </section>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
            <div className="glass-panel rounded-[28px] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Resumo do pedido</h2>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-muted">
                  {activeCustomerType.toUpperCase()}
                </span>
              </div>
              <div className="mt-2 text-xs text-brand-muted">
                {checkoutPreview?.priceListName
                  ? `Tabela aplicada: ${checkoutPreview.priceListName}`
                  : 'Tabela padrão até validar o documento.'}
              </div>

              <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto pr-1">
                {cart.items.map((item) => {
                  const previewItem = summaryItems?.find(
                    (candidate) =>
                      candidate.productId === item.productId &&
                      candidate.variantId === item.variantId
                  );
                  const unitPrice = previewItem?.unitPrice ?? item.unitPrice;
                  const total = previewItem?.total ?? unitPrice * item.quantity;

                  return (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-3"
                    >
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-border-soft bg-white/[0.03]">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-6 w-6 text-brand-muted" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xs font-bold text-white">
                            {item.name}
                          </h3>
                          {item.sku ? (
                            <p className="mt-0.5 text-[10px] text-brand-muted">
                              SKU: {item.sku}
                            </p>
                          ) : null}
                          <p className="mt-1 text-sm font-extrabold text-green-accent">
                            {formatCurrency(total)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemove(item.productId, item.variantId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border-soft text-brand-muted transition hover:text-white"
                          aria-label={`Remover ${item.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <div className="flex h-9 items-center rounded-xl border border-brand-border-soft bg-white/[0.03]">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQty(
                                item.productId,
                                item.variantId,
                                item.quantity - 1
                              )
                            }
                            className="flex h-full w-9 items-center justify-center text-brand-muted hover:text-white"
                            aria-label={`Diminuir ${item.name}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-8 text-center text-sm font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQty(
                                item.productId,
                                item.variantId,
                                item.quantity + 1
                              )
                            }
                            className="flex h-full w-9 items-center justify-center text-brand-muted hover:text-white"
                            aria-label={`Aumentar ${item.name}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-2 border-t border-brand-border-soft pt-4">
                <SummaryRow label="Subtotal" value={formatCurrency(summarySubtotal)} />
                <SummaryRow
                  label="Frete"
                  value={summaryShipping === 0 ? 'Grátis' : formatCurrency(summaryShipping)}
                  accent={summaryShipping === 0}
                />
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-black text-white">Total</span>
                  <span className="text-2xl font-black text-green-accent">
                    {formatCurrency(summaryTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-green-accent" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-white">
                    Compra segura
                  </p>
                  <p className="mt-1 text-xs leading-5 text-brand-muted">
                    Documento e preço são validados no servidor antes de criar o
                    pedido.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function CheckoutActionBar({
  onBack,
  onNext,
  nextLabel,
  disabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-brand-border-soft pt-5 sm:flex-row sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        className="h-11 rounded-xl border border-brand-border-soft px-5 text-sm font-bold text-brand-muted transition hover:text-white"
      >
        Voltar
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        className="h-11 rounded-xl bg-blue-primary px-6 text-sm font-bold text-white shadow-[0_8px_24px_rgba(30,61,255,0.3)] transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-brand-muted">{label}</span>
      <span className={accent ? 'font-bold text-green-accent' : 'font-bold text-white'}>
        {value}
      </span>
    </div>
  );
}
