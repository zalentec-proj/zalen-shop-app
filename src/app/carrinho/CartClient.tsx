'use client';

import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  IdCard,
  Mail,
  MapPin,
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
  lookupCheckoutPostalCodeAction,
  processMercadoPagoBrickPaymentAction,
  previewCheckoutCartAction,
  quoteCheckoutShippingAction,
  requestCheckoutAccountCodeAction,
  requestCheckoutEmailCodeAction,
  switchCheckoutAccountAction,
  type CheckoutPreviewActionResult,
  type CheckoutShippingQuoteActionResult,
  verifyCheckoutAccountCodeAction,
  verifyCheckoutEmailCodeAction,
} from './actions';
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj, onlyDigits } from '@/modules/customers/br-document';
import {
  getEmailTypoErrorMessage,
  normalizeEmailAddress,
} from '@/modules/customers/email-validation';
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
import { pushMarketingEvent } from '@/modules/marketing/marketing.client';
import type { CustomerType } from '@/modules/pricing/pricing.types';
import { PixPaymentStatusScreen } from './PixPaymentStatusScreen';
import { resolveCheckoutEntryStep } from './checkout-experience';

type CheckoutSessionCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
  customerType?: CustomerType;
  legalName?: string;
  stateRegistration?: string;
  stateRegistrationExempt?: boolean;
  acceptsMarketing?: boolean;
  addresses?: CheckoutSessionAddress[];
  shippingAddress?: {
    postalCode?: string;
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
  };
};

type CheckoutSessionAddress = {
  id: string;
  label: string;
  recipientName?: string;
  phone?: string;
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
  isDefault: boolean;
};

interface Props {
  customerSession: {
    email?: string;
    customer?: CheckoutSessionCustomer;
  } | null;
}

type CheckoutStep =
  | 'identificacao'
  | 'validacao'
  | 'cadastro'
  | 'entrega'
  | 'envio'
  | 'pagamento';

type CheckoutPreview = Extract<CheckoutPreviewActionResult, { ok: true }>;
type CheckoutShippingOption = Extract<
  CheckoutShippingQuoteActionResult,
  { ok: true }
>['shippingOptions'][number];

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

type CheckoutActionItem = {
  productId: string;
  variantId: string;
  quantity: number;
};

type ShippingQuoteRefreshOptions = {
  force?: boolean;
  silent?: boolean;
};

type ValidationState = 'empty' | 'valid' | 'invalid' | 'neutral';
type EmailVerificationStatus = 'idle' | 'sent' | 'verified';

type EmailVerificationState = {
  email: string;
  status: EmailVerificationStatus;
  token: string;
  message?: string;
  error?: string;
};

type AccountValidationState = {
  identifier: string;
  emailHint?: string;
  token: string;
  message?: string;
  error?: string;
  deliveredChannels?: Array<'email' | 'whatsapp'>;
  pendingChannels?: Array<'whatsapp'>;
};

type PostalCodeLookupState = {
  postalCode?: string;
  status: 'idle' | 'loading' | 'found' | 'error';
  message?: string;
};

type MercadoPagoBrickSession = {
  orderId: string;
  orderNumber: string;
  amount: number;
  preferenceId: string;
  publicKey: string;
  environment: 'test' | 'production';
  paymentAttemptKey: string;
  fallbackPaymentUrl?: string;
};

type PixPaymentStatusSession = {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  publicKey: string;
};

type MercadoPagoBrickController = {
  unmount: () => void;
};

type MercadoPagoBrickCallbacks = {
  onReady?: () => void;
  onSubmit?: (data: MercadoPagoBrickSubmitData) => Promise<void>;
  onError?: (error: unknown) => void;
};

type MercadoPagoBrickSubmitData = Record<string, unknown> & {
  formData?: Record<string, unknown> | null;
};

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: 'payment',
      containerId: string,
      settings: Record<string, unknown> & { callbacks?: MercadoPagoBrickCallbacks }
    ) => Promise<MercadoPagoBrickController>;
  };
};

type MercadoPagoConstructor = new (
  publicKey: string,
  options?: { locale?: string }
) => MercadoPagoInstance;

declare global {
  interface Window {
    MercadoPago?: MercadoPagoConstructor;
    paymentBrickController?: MercadoPagoBrickController;
  }
}

const steps: Array<{ id: CheckoutStep; label: string; title: string }> = [
  { id: 'identificacao', label: '1', title: 'Identificação' },
  { id: 'validacao', label: '2', title: 'Conta' },
  { id: 'cadastro', label: '3', title: 'Dados' },
  { id: 'entrega', label: '4', title: 'Entrega' },
  { id: 'envio', label: '5', title: 'Envio' },
  { id: 'pagamento', label: '6', title: 'Pagamento' },
];

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getMercadoPagoBrickFormData(
  data: MercadoPagoBrickSubmitData
): Record<string, unknown> {
  if (isRecord(data.formData)) {
    const rootData = { ...data };
    delete rootData.formData;

    return Object.fromEntries(
      Object.entries({
        ...rootData,
        ...data.formData,
      }).filter(([, value]) => value !== undefined)
    );
  }

  if ('selectedPaymentMethod' in data || 'paymentMethod' in data) {
    return {};
  }

  return data;
}

function getBrickPaymentMethodId(formData: Record<string, unknown>) {
  const value = formData.payment_method_id;

  return typeof value === 'string' ? value.trim().toLowerCase() : undefined;
}

function formatDeliveryWindow(option: CheckoutShippingOption) {
  if (option.deliveryTimeLabel) {
    return option.deliveryTimeLabel;
  }

  if (
    option.deliveryMinDays === undefined ||
    option.deliveryMaxDays === undefined
  ) {
    return 'Prazo a confirmar';
  }

  if (option.deliveryMinDays === option.deliveryMaxDays) {
    return `${option.deliveryMinDays} dia(s) úteis`;
  }

  return `${option.deliveryMinDays} a ${option.deliveryMaxDays} dias úteis`;
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

function getInitialCheckoutStep(
  customerSession: Props['customerSession']
): CheckoutStep {
  const initialCustomer = getInitialCustomerState(customerSession);

  return resolveCheckoutEntryStep({
    hasVerifiedSession: Boolean(customerSession?.email),
    hasCustomerData: hasRequiredCustomerData(initialCustomer),
    hasDeliveryData: hasRequiredDeliveryData(initialCustomer),
  });
}

function getInitialCustomerState(
  customerSession: Props['customerSession']
): CustomerState {
  const sessionCustomer = customerSession?.customer;
  const document = sessionCustomer?.document ?? '';
  const customerType = getCustomerTypeFromDocumentInput(
    document,
    sessionCustomer?.customerType ?? 'pf'
  );

  return {
    name: sessionCustomer?.name ?? '',
    email: sessionCustomer?.email ?? customerSession?.email ?? '',
    phone: sessionCustomer?.phone ?? '',
    document,
    customerType,
    legalName: sessionCustomer?.legalName ?? '',
    stateRegistration: sessionCustomer?.stateRegistration ?? '',
    stateRegistrationExempt:
      sessionCustomer?.stateRegistrationExempt ?? false,
    acceptsMarketing: sessionCustomer?.acceptsMarketing ?? false,
    postalCode: sessionCustomer?.shippingAddress?.postalCode ?? '',
    street: sessionCustomer?.shippingAddress?.street ?? '',
    number: sessionCustomer?.shippingAddress?.number ?? '',
    complement: sessionCustomer?.shippingAddress?.complement ?? '',
    district: sessionCustomer?.shippingAddress?.district ?? '',
    city: sessionCustomer?.shippingAddress?.city ?? '',
    state: sessionCustomer?.shippingAddress?.state ?? '',
  };
}

function getAddressPatch(address: CheckoutSessionAddress) {
  return {
    postalCode: address.postalCode ?? '',
    street: address.street ?? '',
    number: address.number ?? '',
    complement: address.complement ?? '',
    district: address.district ?? '',
    city: address.city ?? '',
    state: address.state ?? '',
  };
}

function formatSavedAddress(address: CheckoutSessionAddress) {
  return [
    [address.street, address.number].filter(Boolean).join(', '),
    address.district,
    [address.city, address.state].filter(Boolean).join('/'),
    address.postalCode ? `CEP ${address.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(' • ');
}

function formatCustomerAddress(customer: CustomerState) {
  return [
    [customer.street, customer.number].filter(Boolean).join(', '),
    customer.complement,
    customer.district,
    [customer.city, customer.state].filter(Boolean).join('/'),
    customer.postalCode ? `CEP ${customer.postalCode}` : undefined,
  ]
    .filter(Boolean)
    .join(' • ');
}

function hasRequiredCustomerData(customer: CustomerState) {
  const currentType = getCustomerTypeFromDocumentInput(
    customer.document,
    customer.customerType
  );

  if (customer.name.trim().length < 2) {
    return false;
  }

  if (!isEmail(customer.email) || getEmailTypoErrorMessage(customer.email)) {
    return false;
  }

  if (onlyDigits(customer.phone).length < 10) {
    return false;
  }

  if (
    currentType === 'pj'
      ? !isValidCnpj(customer.document)
      : !isValidCpf(customer.document)
  ) {
    return false;
  }

  if (currentType === 'pj' && customer.legalName.trim().length < 2) {
    return false;
  }

  if (
    currentType === 'pj' &&
    !customer.stateRegistrationExempt &&
    customer.stateRegistration.trim().length < 2
  ) {
    return false;
  }

  return true;
}

function getPricingCustomerPayload(customer: CustomerState) {
  if (!hasRequiredCustomerData(customer)) {
    return undefined;
  }

  return {
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    document: customer.document,
    legalName: customer.legalName || undefined,
    stateRegistration: customer.stateRegistrationExempt
      ? undefined
      : customer.stateRegistration || undefined,
    stateRegistrationExempt: customer.stateRegistrationExempt,
    acceptsMarketing: customer.acceptsMarketing,
  };
}

function hasRequiredDeliveryData(customer: CustomerState) {
  return (
    onlyDigits(customer.postalCode).length === 8 &&
    customer.street.trim().length >= 2 &&
    Boolean(customer.number.trim()) &&
    customer.district.trim().length >= 2 &&
    customer.city.trim().length >= 2 &&
    customer.state.trim().length === 2
  );
}

function getShippingQuoteRequestKey(
  customer: CustomerState,
  items: CheckoutActionItem[]
) {
  if (items.length === 0 || !hasRequiredDeliveryData(customer)) {
    return null;
  }

  return JSON.stringify({
    customerType: getCustomerTypeFromDocumentInput(
      customer.document,
      customer.customerType
    ),
    document: onlyDigits(customer.document),
    items,
    shippingAddress: {
      postalCode: onlyDigits(customer.postalCode),
      street: customer.street.trim(),
      number: customer.number.trim(),
      complement: customer.complement.trim(),
      district: customer.district.trim(),
      city: customer.city.trim(),
      state: customer.state.trim().toUpperCase(),
    },
  });
}

function isShippingSensitiveCustomerPatch(patch: Partial<CustomerState>) {
  return (
    patch.document !== undefined ||
    patch.customerType !== undefined ||
    patch.postalCode !== undefined ||
    patch.street !== undefined ||
    patch.number !== undefined ||
    patch.complement !== undefined ||
    patch.district !== undefined ||
    patch.city !== undefined ||
    patch.state !== undefined
  );
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
      className={`min-w-0 overflow-hidden rounded-2xl border px-2.5 py-2 transition ${
        active
          ? 'border-blue-primary bg-blue-primary/12 text-white'
          : done
            ? 'border-green-accent/25 bg-green-accent/8 text-green-accent'
            : 'border-brand-border-soft bg-[#050A14]/60 text-brand-muted'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
            active
              ? 'bg-blue-primary text-white'
              : done
                ? 'bg-green-accent text-brand-bg'
                : 'bg-white/5 text-brand-muted'
          }`}
        >
          {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index}
        </span>
        <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.08em] sm:text-[11px] sm:tracking-[0.1em]">
          {title}
        </span>
      </div>
    </div>
  );
}

export default function CartClient({ customerSession }: Props) {
  const [cart, setCart] = useState<Cart>(() => createEmptyCart());
  const [checkoutStep, setCheckoutStep] =
    useState<CheckoutStep>(() => getInitialCheckoutStep(customerSession));
  const [identifier, setIdentifier] = useState(
    customerSession?.customer?.document ??
      customerSession?.customer?.email ??
      customerSession?.email ??
      ''
  );
  const [customer, setCustomer] = useState<CustomerState>(() =>
    getInitialCustomerState(customerSession)
  );
  const [savedAddresses, setSavedAddresses] = useState<CheckoutSessionAddress[]>(
    () => customerSession?.customer?.addresses ?? []
  );
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<
    string | null
  >(
    () =>
      customerSession?.customer?.addresses?.find((address) => address.isDefault)
        ?.id ??
      customerSession?.customer?.addresses?.[0]?.id ??
      null
  );
  const initialVerifiedEmail = customerSession?.email
    ? normalizeEmailAddress(customerSession.email)
    : '';
  const [emailVerification, setEmailVerification] =
    useState<EmailVerificationState>({
      email: initialVerifiedEmail,
      status: initialVerifiedEmail ? 'verified' : 'idle',
      token: '',
      message: initialVerifiedEmail ? 'E-mail validado.' : undefined,
    });
  const [accountValidation, setAccountValidation] =
    useState<AccountValidationState>({
      identifier: '',
      token: '',
    });
  const [postalCodeLookup, setPostalCodeLookup] =
    useState<PostalCodeLookupState>({
      status: 'idle',
    });
  const [checkoutPreview, setCheckoutPreview] =
    useState<CheckoutPreview | null>(null);
  const [shippingOptions, setShippingOptions] = useState<
    CheckoutShippingOption[]
  >([]);
  const [selectedShippingQuoteId, setSelectedShippingQuoteId] = useState<
    string | null
  >(null);
  const [checkoutDone, setCheckoutDone] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentSession, setPaymentSession] =
    useState<MercadoPagoBrickSession | null>(null);
  const [pixPaymentStatusSession, setPixPaymentStatusSession] =
    useState<PixPaymentStatusSession | null>(null);
  const [brickRenderKey, setBrickRenderKey] = useState(0);
  const [brickStatus, setBrickStatus] = useState<
    'idle' | 'loading' | 'ready' | 'processing' | 'error' | 'done'
  >('idle');
  const [isBrickScriptLoaded, setIsBrickScriptLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isQuotingShipping, setIsQuotingShipping] = useState(false);
  const [isSendingAccountCode, setIsSendingAccountCode] = useState(false);
  const [accountCodeCooldown, setAccountCodeCooldown] = useState(0);
  const [isVerifyingAccountCode, setIsVerifyingAccountCode] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [isVerifyingEmailCode, setIsVerifyingEmailCode] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const [isKnownCustomer, setIsKnownCustomer] = useState(
    () => Boolean(customerSession?.email && customerSession.customer)
  );

  useEffect(() => {
    if (accountCodeCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setAccountCodeCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [accountCodeCooldown]);
  const checkoutAttemptIdRef = useRef<string | null>(null);
  const shippingQuoteRequestKeyRef = useRef<string | null>(null);
  const shippingQuoteRequestIdRef = useRef(0);
  const lastPostalCodeLookupRef = useRef<string | null>(null);
  const currentPostalCodeRef = useRef('');
  const viewCartTrackedRef = useRef(false);

  const itemCount = getItemCount(cart);
  const isExpressCheckout =
    isKnownCustomer && hasRequiredCustomerData(customer);
  const visibleSteps = isExpressCheckout ? steps.slice(3) : steps;
  const stepIndex = visibleSteps.findIndex((step) => step.id === checkoutStep);
  const activeCustomerType = getCustomerTypeFromDocumentInput(
    customer.document,
    customer.customerType
  );
  const selectedShippingOption = shippingOptions.find(
    (option) => option.quoteId === selectedShippingQuoteId
  );
  const summaryCatalogSubtotal =
    checkoutPreview?.catalogSubtotal ?? cart.subtotal;
  const summarySubtotal = checkoutPreview?.subtotal ?? cart.subtotal;
  const summaryProductSavings =
    checkoutPreview?.productSavingsTotal ?? 0;
  const summaryDiscount = checkoutPreview?.discountTotal ?? 0;
  const summaryShipping = selectedShippingOption?.price ?? 0;
  const summaryShippingLabel = selectedShippingOption?.serviceName
    ? `Frete (${selectedShippingOption.serviceName})`
    : 'Frete';
  const summaryTotal = summarySubtotal + summaryShipping - summaryDiscount;
  const summaryItems = checkoutPreview?.items;
  const normalizedCustomerEmail = normalizeEmailAddress(customer.email);
  const currentPostalCodeDigits = onlyDigits(customer.postalCode);
  const isCheckoutEmailVerified =
    Boolean(normalizedCustomerEmail) &&
    emailVerification.status === 'verified' &&
    emailVerification.email === normalizedCustomerEmail;
  currentPostalCodeRef.current = currentPostalCodeDigits;

  const actionItems = useMemo(
    () =>
      cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    [cart.items]
  );
  const shippingQuoteRequestKey = useMemo(
    () => getShippingQuoteRequestKey(customer, actionItems),
    [
      actionItems,
      customer.city,
      customer.complement,
      customer.customerType,
      customer.district,
      customer.document,
      customer.number,
      customer.postalCode,
      customer.state,
      customer.street,
    ]
  );
  const hasFreshShippingOptions =
    Boolean(shippingQuoteRequestKey) &&
    shippingQuoteRequestKeyRef.current === shippingQuoteRequestKey &&
    shippingOptions.length > 0;
  const paymentBrickContainerId = `paymentBrick_container_${brickRenderKey}`;

  useEffect(() => {
    setCart(getStoredCart());
  }, []);

  useEffect(() => {
    if (!shippingQuoteRequestKey) {
      return;
    }

    if (
      shippingQuoteRequestKeyRef.current === shippingQuoteRequestKey &&
      shippingOptions.length > 0
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshShippingQuotes(customer, {
        silent: !isExpressCheckout,
      });
    }, isExpressCheckout ? 0 : 450);

    return () => window.clearTimeout(timeoutId);
  }, [isExpressCheckout, shippingQuoteRequestKey]);

  useEffect(() => {
    if (viewCartTrackedRef.current || cart.items.length === 0) {
      return;
    }

    viewCartTrackedRef.current = true;
    pushMarketingEvent({
      event: 'view_cart',
      event_id: `view_cart:${Date.now()}`,
      ecommerce: {
        currency: 'BRL',
        value: cart.total,
        items: (summaryItems ?? cart.items).map((item) => ({
          item_id: item.sku ?? item.variantId,
          item_name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
      },
    });
  }, [cart.items, cart.total]);

  useEffect(() => {
    const digits = onlyDigits(customer.postalCode);

    if (digits.length !== 8) {
      lastPostalCodeLookupRef.current = null;
      setPostalCodeLookup((current) =>
        current.status === 'idle'
          ? current
          : {
              status: 'idle',
            }
      );
      return;
    }

    if (lastPostalCodeLookupRef.current === digits) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      lastPostalCodeLookupRef.current = digits;
      setPostalCodeLookup({
        postalCode: digits,
        status: 'loading',
        message: 'Consultando CEP...',
      });

      const result = await lookupCheckoutPostalCodeAction({
        postalCode: digits,
      });

      if (currentPostalCodeRef.current !== digits) {
        return;
      }

      if (!result.ok) {
        setPostalCodeLookup({
          postalCode: digits,
          status: 'error',
          message: result.error,
        });
        return;
      }

      resetCheckoutAttempt();
      setCheckoutPreview(null);
      clearShippingSelection();
      setCustomer((current) => {
        if (onlyDigits(current.postalCode) !== digits) {
          return current;
        }

        return {
          ...current,
          postalCode: result.address.postalCode,
          street: result.address.street ?? '',
          district: result.address.district ?? '',
          city: result.address.city,
          state: result.address.state,
        };
      });
      setCheckoutError(null);
      setPostalCodeLookup({
        postalCode: result.address.postalCode,
        status: 'found',
        message:
          result.address.street && result.address.district
            ? 'Endereço localizado. Complete número e complemento se houver.'
            : 'CEP localizado. Complete os campos que faltarem.',
      });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [customer.postalCode]);

  useEffect(() => {
    if (!paymentSession) {
      setBrickStatus('idle');
      return;
    }

    if (window.MercadoPago) {
      setIsBrickScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.mercadopago.com/js/v2"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => {
        setIsBrickScriptLoaded(Boolean(window.MercadoPago));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => setIsBrickScriptLoaded(Boolean(window.MercadoPago));
    script.onerror = () => {
      setBrickStatus('error');
      setCheckoutError(
        'Não foi possível carregar o pagamento seguro. Tente novamente em instantes.'
      );
    };
    document.body.appendChild(script);
  }, [paymentSession]);

  useEffect(() => {
    if (!paymentSession || !isBrickScriptLoaded || !window.MercadoPago) {
      return;
    }

    let isMounted = true;
    let activeController: MercadoPagoBrickController | null = null;
    const container = document.getElementById(paymentBrickContainerId);

    if (!container) {
      return;
    }

    setBrickStatus('loading');
    window.paymentBrickController?.unmount();
    container.innerHTML = '';

    const [firstName = customer.name, ...lastNameParts] = customer.name
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const documentDigits = onlyDigits(customer.document);
    const mp = new window.MercadoPago(paymentSession.publicKey, {
      locale: 'pt-BR',
    });

    const payer = {
      email: normalizeEmailAddress(customer.email),
      entityType:
        documentDigits.length === 14 ? 'association' : 'individual',
      ...(paymentSession.environment === 'production'
        ? {
            firstName,
            lastName: lastNameParts.join(' '),
            identification: {
              type: documentDigits.length === 14 ? 'CNPJ' : 'CPF',
              number: documentDigits,
            },
            address: {
              zipCode: onlyDigits(customer.postalCode),
              streetName: customer.street,
              streetNumber: customer.number,
              neighborhood: customer.district,
              city: customer.city,
              federalUnit: customer.state.toUpperCase(),
            },
          }
        : {}),
    };

    mp.bricks()
      .create('payment', paymentBrickContainerId, {
        initialization: {
          amount: paymentSession.amount,
          preferenceId: paymentSession.preferenceId,
          payer,
        },
        customization: {
          visual: {
            style: {
              theme: 'dark',
            },
          },
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            bankTransfer: 'all',
            ticket: 'all',
            mercadoPago: 'all',
          },
        },
        callbacks: {
          onReady: () => {
            if (isMounted) {
              setBrickStatus('ready');
            }
          },
          onSubmit: async (submitData) => {
            setCheckoutError(null);
            setBrickStatus('processing');

            const formData = getMercadoPagoBrickFormData(submitData);
            const isPixPayment = getBrickPaymentMethodId(formData) === 'pix';
            const result = await processMercadoPagoBrickPaymentAction({
              orderId: paymentSession.orderId,
              idempotencyKey: paymentSession.paymentAttemptKey,
              formData,
            });

            if (!result.ok) {
              setBrickStatus('ready');
              setCheckoutError(result.error);
              setBrickRenderKey((current) => current + 1);
              throw new Error(result.error);
            }

            setBrickStatus('done');
            setCheckoutError(result.message);
            resetCheckoutAttempt();
            setCart(createEmptyCart());
            clearStoredCart();

            if (
              result.status === 'pending' &&
              result.paymentId &&
              (result.paymentMethodId?.toLowerCase() === 'pix' || isPixPayment)
            ) {
              setPaymentSession(null);
              setPixPaymentStatusSession({
                orderId: result.orderId,
                orderNumber: result.orderNumber,
                paymentId: result.paymentId,
                publicKey: paymentSession.publicKey,
              });
              return;
            }

            window.location.href = result.redirectPath;
          },
          onError: () => {
            if (!isMounted) {
              return;
            }

            setBrickStatus('error');
            setCheckoutError(
              'Não foi possível montar o pagamento seguro. Tente novamente.'
            );
          },
        },
      })
      .then((controller) => {
        if (!isMounted) {
          controller.unmount();
          return;
        }

        window.paymentBrickController = controller;
        activeController = controller;
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setBrickStatus('error');
        setCheckoutError(
          'Não foi possível preparar o pagamento seguro. Tente novamente.'
        );
      });

    return () => {
      isMounted = false;
      activeController?.unmount();
    };
  }, [
    brickRenderKey,
    customer,
    isBrickScriptLoaded,
    paymentBrickContainerId,
    paymentSession,
  ]);

  function resetCheckoutAttempt() {
    checkoutAttemptIdRef.current = null;
  }

  function clearShippingSelection() {
    shippingQuoteRequestKeyRef.current = null;
    shippingQuoteRequestIdRef.current += 1;
    setIsQuotingShipping(false);
    setShippingOptions([]);
    setSelectedShippingQuoteId(null);
  }

  function getCheckoutAttemptId() {
    checkoutAttemptIdRef.current ??= crypto.randomUUID();
    return checkoutAttemptIdRef.current;
  }

  function syncEmailVerificationForEmail(email: string) {
    const normalizedEmail = normalizeEmailAddress(email);

    setEmailVerification((current) => {
      if (current.status === 'verified' && current.email === normalizedEmail) {
        return current;
      }

      return {
        email: normalizedEmail,
        status: 'idle',
        token: '',
      };
    });
  }

  function updateCustomer(patch: Partial<CustomerState>) {
    setCheckoutError(null);
    resetCheckoutAttempt();
    if (patch.email !== undefined) {
      syncEmailVerificationForEmail(patch.email);
    }
    const shouldRefreshShipping = isShippingSensitiveCustomerPatch(patch);

    setCustomer((current) => ({
      ...current,
      ...patch,
    }));

    if (shouldRefreshShipping) {
      setCheckoutPreview(null);
      clearShippingSelection();
    }
  }

  function applySavedAddress(address: CheckoutSessionAddress) {
    setSelectedSavedAddressId(address.id);
    updateCustomer(getAddressPatch(address));
  }

  function getCustomerFromSnapshot(snapshot: CheckoutSessionCustomer): CustomerState {
    const document = snapshot.document ?? '';
    const customerType = getCustomerTypeFromDocumentInput(
      document,
      snapshot.customerType ?? 'pf'
    );

    return {
      name: snapshot.name ?? '',
      email: snapshot.email ?? '',
      phone: snapshot.phone ?? '',
      document,
      customerType,
      legalName: snapshot.legalName ?? '',
      stateRegistration: snapshot.stateRegistration ?? '',
      stateRegistrationExempt: snapshot.stateRegistrationExempt ?? false,
      acceptsMarketing: snapshot.acceptsMarketing ?? false,
      postalCode: snapshot.shippingAddress?.postalCode ?? '',
      street: snapshot.shippingAddress?.street ?? '',
      number: snapshot.shippingAddress?.number ?? '',
      complement: snapshot.shippingAddress?.complement ?? '',
      district: snapshot.shippingAddress?.district ?? '',
      city: snapshot.shippingAddress?.city ?? '',
      state: snapshot.shippingAddress?.state ?? '',
    };
  }

  async function applyHydratedCustomer(snapshot: CheckoutSessionCustomer) {
    const nextCustomer = getCustomerFromSnapshot(snapshot);
    const nextAddresses = snapshot.addresses ?? [];
    const defaultAddress = nextAddresses.find((address) => address.isDefault);

    resetCheckoutAttempt();
    setCustomer(nextCustomer);
    setSavedAddresses(nextAddresses);
    setSelectedSavedAddressId(
      defaultAddress?.id ?? nextAddresses[0]?.id ?? null
    );
    setIsKnownCustomer(true);
    setIdentifier(nextCustomer.document || nextCustomer.email);
    setCheckoutError(null);
    setEmailVerification({
      email: normalizeEmailAddress(nextCustomer.email),
      status: 'verified',
      token: '',
      message: 'E-mail validado.',
    });
    setCheckoutStep(
      resolveCheckoutEntryStep({
        hasVerifiedSession: true,
        hasCustomerData: hasRequiredCustomerData(nextCustomer),
        hasDeliveryData: hasRequiredDeliveryData(nextCustomer),
      })
    );
    await refreshPreview(nextCustomer);
  }

  function persistCart(nextCart: Cart) {
    setCheckoutPreview(null);
    clearShippingSelection();
    resetCheckoutAttempt();
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
      customer: getPricingCustomerPayload(nextCustomer),
    });

    if (!result.ok) {
      setCheckoutError(result.error);
      return null;
    }

    setCheckoutPreview(result);
    return result;
  }

  async function refreshShippingQuotes(
    nextCustomer = customer,
    options: ShippingQuoteRefreshOptions = {}
  ) {
    const requestKey = getShippingQuoteRequestKey(nextCustomer, actionItems);

    if (!requestKey) {
      if (!options.silent) {
        clearShippingSelection();
      }
      return null;
    }

    if (
      !options.force &&
      shippingQuoteRequestKeyRef.current === requestKey &&
      shippingOptions.length > 0
    ) {
      return {
        ok: true,
        customerType: activeCustomerType,
        catalogSubtotal:
          checkoutPreview?.catalogSubtotal ?? cart.subtotal,
        subtotal: checkoutPreview?.subtotal ?? cart.subtotal,
        productSavingsTotal:
          checkoutPreview?.productSavingsTotal ?? 0,
        discountTotal: checkoutPreview?.discountTotal ?? 0,
        shippingOptions,
      } satisfies CheckoutShippingQuoteActionResult;
    }

    shippingQuoteRequestKeyRef.current = requestKey;
    const requestId = shippingQuoteRequestIdRef.current + 1;
    shippingQuoteRequestIdRef.current = requestId;
    setIsQuotingShipping(true);

    const result = await quoteCheckoutShippingAction({
      items: actionItems,
      customer: getPricingCustomerPayload(nextCustomer),
      forceRefresh: options.force,
      shippingAddress: {
        postalCode: nextCustomer.postalCode,
        street: nextCustomer.street,
        number: nextCustomer.number,
        complement: nextCustomer.complement,
        district: nextCustomer.district,
        city: nextCustomer.city,
        state: nextCustomer.state.toUpperCase(),
      },
    });

    if (
      shippingQuoteRequestIdRef.current !== requestId ||
      shippingQuoteRequestKeyRef.current !== requestKey
    ) {
      return null;
    }

    setIsQuotingShipping(false);

    if (!result.ok) {
      if (!options.silent) {
        setCheckoutError(result.error);
      }
      clearShippingSelection();
      return null;
    }

    setShippingOptions(result.shippingOptions);
    setSelectedShippingQuoteId((current) => {
      const currentStillAvailable = result.shippingOptions.some(
        (option) => option.quoteId && option.quoteId === current
      );

      if (currentStillAvailable) {
        return current;
      }

      return result.shippingOptions.find((option) => option.quoteId)?.quoteId ?? null;
    });
    return result;
  }

  async function handleIdentify() {
    const value = identifier.trim();
    const digits = onlyDigits(value);
    const isDocument = digits.length >= 11;
    const emailTypoMessage = isEmail(value)
      ? getEmailTypoErrorMessage(value)
      : null;

    if (!isEmail(value) && (!isDocument || !isValidCpfOrCnpj(value))) {
      setCheckoutError('Informe um e-mail, CPF ou CNPJ válido.');
      return;
    }

    if (emailTypoMessage) {
      setCheckoutError(emailTypoMessage);
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

    if (result.status === 'authenticated_customer' && result.customer) {
      await applyHydratedCustomer(result.customer);
      return;
    }

    if (result.status === 'existing_customer_requires_code') {
      const baseAccountValidation = {
        identifier: value,
        emailHint: result.emailHint,
        token: '',
        message:
          result.message ??
          'Identificamos seu cadastro. Envie o código para continuar.',
      };

      setAccountValidation(baseAccountValidation);
      setCustomer((current) => ({
        ...current,
        document: isDocument ? digits : current.document,
        customerType:
          result.customerType ??
          getCustomerTypeFromDocumentInput(
            isDocument ? digits : current.document,
            current.customerType
          ),
      }));
      setCheckoutStep('validacao');
      setIsSendingAccountCode(true);

      const codeResult = await requestCheckoutAccountCodeAction({
        identifier: value,
      });

      setIsSendingAccountCode(false);

      setAccountValidation((current) => ({
        ...current,
        emailHint: codeResult.ok ? codeResult.emailHint : current.emailHint,
        message: codeResult.ok ? codeResult.message : undefined,
        error: codeResult.ok ? undefined : codeResult.error,
        deliveredChannels: codeResult.ok ? codeResult.deliveredChannels : [],
        pendingChannels: codeResult.ok ? codeResult.pendingChannels : [],
      }));
      if (codeResult.ok) setAccountCodeCooldown(60);
      return;
    }

    const nextCustomer: CustomerState = {
      ...customer,
      email:
        result.customer?.email ??
        (isEmail(value) ? normalizeEmailAddress(value) : customer.email),
      document:
        result.customer?.document ?? (isDocument ? digits : customer.document),
      customerType:
        result.customerType ??
        getCustomerTypeFromDocumentInput(
          isDocument ? digits : customer.document,
          customer.customerType
        ),
    };

    resetCheckoutAttempt();
    setCustomer(nextCustomer);
    syncEmailVerificationForEmail(nextCustomer.email);
    await refreshPreview(nextCustomer);
    setCheckoutStep('cadastro');
  }

  async function handleSendAccountCode() {
    if (!accountValidation.identifier) {
      setCheckoutStep('identificacao');
      return;
    }

    if (accountCodeCooldown > 0) return;

    setIsSendingAccountCode(true);

    const result = await requestCheckoutAccountCodeAction({
      identifier: accountValidation.identifier,
    });

    setIsSendingAccountCode(false);

    if (!result.ok) {
      setAccountValidation((current) => ({
        ...current,
        error: result.error,
        message: undefined,
      }));
      return;
    }

    setAccountValidation((current) => ({
      ...current,
      emailHint: result.emailHint,
      message: result.message,
      error: undefined,
      deliveredChannels: result.deliveredChannels,
      pendingChannels: result.pendingChannels,
    }));
    setAccountCodeCooldown(60);
  }

  async function handleVerifyAccountCode() {
    const token = accountValidation.token.trim();

    if (!accountValidation.identifier || token.length < 4) {
      setAccountValidation((current) => ({
        ...current,
        error: 'Informe o código recebido por e-mail ou WhatsApp.',
      }));
      return;
    }

    setIsVerifyingAccountCode(true);

    const result = await verifyCheckoutAccountCodeAction({
      identifier: accountValidation.identifier,
      token,
    });

    setIsVerifyingAccountCode(false);

    if (!result.ok) {
      setAccountValidation((current) => ({
        ...current,
        error: result.error,
        message: undefined,
      }));
      return;
    }

    setAccountValidation((current) => ({
      ...current,
      token: '',
      message: result.message,
      error: undefined,
    }));
    await applyHydratedCustomer({
      ...result.customer,
      email: result.email,
    });
  }

  async function handleSwitchCheckoutAccount() {
    setIsSwitchingAccount(true);
    const result = await switchCheckoutAccountAction();
    setIsSwitchingAccount(false);

    if (!result.ok) {
      setCheckoutError(result.error);
      return;
    }

    resetCheckoutAttempt();
    clearShippingSelection();
    setCheckoutPreview(null);
    setIdentifier('');
    setCustomer(getInitialCustomerState(null));
    setEmailVerification({
      email: '',
      status: 'idle',
      token: '',
    });
    setAccountValidation({
      identifier: '',
      token: '',
    });
    setSavedAddresses([]);
    setSelectedSavedAddressId(null);
    setIsKnownCustomer(false);
    setCheckoutError(null);
    setCheckoutStep('identificacao');
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

    const emailTypoMessage = getEmailTypoErrorMessage(customer.email);

    if (emailTypoMessage) {
      return emailTypoMessage;
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

    resetCheckoutAttempt();
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
    setCheckoutStep('envio');

    const previewPromise = refreshPreview();
    const quotesPromise = hasFreshShippingOptions
      ? Promise.resolve({
          ok: true,
          customerType: activeCustomerType,
          catalogSubtotal:
            checkoutPreview?.catalogSubtotal ?? cart.subtotal,
          subtotal: checkoutPreview?.subtotal ?? cart.subtotal,
          productSavingsTotal:
            checkoutPreview?.productSavingsTotal ?? 0,
          discountTotal: checkoutPreview?.discountTotal ?? 0,
          shippingOptions,
        } satisfies CheckoutShippingQuoteActionResult)
      : refreshShippingQuotes(customer, {
          force: true,
        });

    const [preview, quotes] = await Promise.all([previewPromise, quotesPromise]);

    if (!preview) {
      setCheckoutStep('entrega');
      return;
    }

    if (!quotes) {
      return;
    }
  }

  async function handleContinueFromShipping() {
    if (!selectedShippingQuoteId) {
      setCheckoutError('Selecione uma forma de envio para continuar.');
      return;
    }

    setCheckoutError(null);
    pushMarketingEvent({
      event: 'begin_checkout',
      event_id: `begin_checkout:${getCheckoutAttemptId()}`,
      ecommerce: {
        currency: 'BRL',
        value: summaryTotal,
        shipping: summaryShipping,
        items: cart.items.map((item) => ({
          item_id: item.sku ?? item.variantId,
          item_name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
        })),
      },
      meta: {
        eventName: 'InitiateCheckout',
        contentIds: cart.items.map((item) => item.sku ?? item.variantId),
      },
    });
    setCheckoutStep('pagamento');
  }

  async function handleSendEmailCode() {
    const email = normalizeEmailAddress(customer.email);

    if (!isEmail(email)) {
      setCheckoutError('Informe um e-mail válido para receber o código.');
      setCheckoutStep('cadastro');
      return;
    }

    const emailTypoMessage = getEmailTypoErrorMessage(email);

    if (emailTypoMessage) {
      setCheckoutError(emailTypoMessage);
      setCheckoutStep('cadastro');
      return;
    }

    setCheckoutError(null);
    setIsSendingEmailCode(true);

    const result = await requestCheckoutEmailCodeAction({ email });

    setIsSendingEmailCode(false);

    if (!result.ok) {
      setEmailVerification({
        email,
        status: 'idle',
        token: '',
        error: result.error,
      });
      return;
    }

    setEmailVerification({
      email: result.email,
      status: 'sent',
      token: '',
      message: result.message,
    });
  }

  async function handleVerifyEmailCode() {
    const email = normalizeEmailAddress(customer.email);
    const token = emailVerification.token.trim();

    if (!isEmail(email) || token.length < 4) {
      setEmailVerification((current) => ({
        ...current,
        email,
        error: 'Informe o código recebido por e-mail.',
      }));
      return;
    }

    setIsVerifyingEmailCode(true);

    const result = await verifyCheckoutEmailCodeAction({
      email,
      token,
      customer: {
        name: customer.name,
        email,
        phone: customer.phone,
        document: customer.document,
        customerType: getCustomerTypeFromDocumentInput(
          customer.document,
          customer.customerType
        ),
        legalName: customer.legalName || undefined,
        stateRegistration:
          customer.stateRegistrationExempt
            ? undefined
            : customer.stateRegistration || undefined,
        stateRegistrationExempt: customer.stateRegistrationExempt,
        acceptsMarketing: customer.acceptsMarketing,
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
    });

    setIsVerifyingEmailCode(false);

    if (!result.ok) {
      setEmailVerification((current) => ({
        ...current,
        email,
        error: result.error,
        message: undefined,
      }));
      return;
    }

    setCheckoutError(null);
    setEmailVerification({
      email: result.email,
      status: 'verified',
      token: '',
      message: result.message,
    });
    await refreshPreview(customer);
    await refreshShippingQuotes(customer, { force: true, silent: true });
  }

  async function handleCheckout() {
    const customerError = validateCustomerData();
    const deliveryError = validateDeliveryData();

    if (customerError || deliveryError) {
      setCheckoutError(customerError ?? deliveryError);
      setCheckoutStep(customerError ? 'cadastro' : 'entrega');
      return;
    }

    if (!selectedShippingQuoteId) {
      setCheckoutError('Selecione uma forma de envio antes do pagamento.');
      setCheckoutStep('envio');
      return;
    }

    if (!isCheckoutEmailVerified) {
      setCheckoutError('Valide o e-mail com o código recebido antes do pagamento.');
      setCheckoutStep('pagamento');
      return;
    }

    setCheckoutError(null);
    setPaymentSession(null);
    setPixPaymentStatusSession(null);
    setBrickStatus('idle');
    setIsSubmitting(true);

    const currentType = getCustomerTypeFromDocumentInput(
      customer.document,
      customer.customerType
    );
    const result = await checkoutCartAction({
      checkoutAttemptId: getCheckoutAttemptId(),
      shippingQuoteId: selectedShippingQuoteId,
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
        acceptsMarketing: customer.acceptsMarketing,
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
      paymentMethod: 'mercado_pago_payment_brick',
    });

    setIsSubmitting(false);

    if (!result.ok) {
      if (result.recovery === 'refresh_shipping') {
        resetCheckoutAttempt();
        clearShippingSelection();
        setCheckoutStep('envio');

        const refreshedQuotes = await refreshShippingQuotes(customer, {
          force: true,
        });

        if (refreshedQuotes) {
          setCheckoutError(result.error);
        }

        return;
      }

      setCheckoutError(result.error);
      return;
    }

    if (result.paymentMode === 'checkout_pro') {
      resetCheckoutAttempt();
      window.location.href = result.paymentUrl;
      return;
    }

    setPaymentSession({
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      amount: result.amount,
      preferenceId: result.preferenceId,
      publicKey: result.publicKey,
      environment: result.environment,
      paymentAttemptKey: result.paymentAttemptKey,
      fallbackPaymentUrl: result.fallbackPaymentUrl,
    });
    setBrickStatus('loading');
    setCheckoutError(null);
    return;
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
              Acompanhe seu pedido
            </p>
            <p className="mt-1 text-[11px] leading-5 text-brand-muted">
              Use o mesmo e-mail validado para ver pagamentos, pedidos e rastreio.
            </p>
            <Link
              href="/conta"
              className="mt-3 flex h-10 items-center justify-center rounded-xl bg-blue-primary text-xs font-bold text-white"
            >
              Ir para minha conta
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
                {isExpressCheckout
                  ? 'Finalizar compra'
                  : 'Compra sem senha obrigatória'}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-brand-muted">
                {isExpressCheckout
                  ? 'Seus dados já estão carregados. Revise a entrega e siga para o pagamento.'
                  : 'Validamos o e-mail para ligar o pedido ao comprador e usamos CPF ou CNPJ para aplicar a regra correta de cliente.'}
              </p>
            </div>

            <div
              className={`mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 ${
                isExpressCheckout ? '' : 'xl:grid-cols-6'
              }`}
            >
              {visibleSteps.map((step, index) => (
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
                          setAccountValidation({
                            identifier: '',
                            token: '',
                          });
                          setIdentifier(value);
                        }}
                        validationState={
                          !identifier.trim()
                            ? 'empty'
                            : (isEmail(identifier) &&
                                !getEmailTypoErrorMessage(identifier)) ||
                                isValidCpfOrCnpj(identifier)
                              ? 'valid'
                              : 'invalid'
                        }
                        icon={IdCard}
                        helper={
                          identifier.trim()
                            ? getEmailTypoErrorMessage(identifier) ??
                              (!isEmail(identifier) &&
                              !isValidCpfOrCnpj(identifier)
                                ? 'Digite um e-mail, CPF ou CNPJ válido.'
                                : undefined)
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

              {checkoutStep === 'validacao' ? (
                <div className="grid gap-5">
                  <div className="rounded-2xl border border-blue-primary/25 bg-blue-primary/8 p-5">
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-primary">
                        Validação de acesso
                      </p>
                      <h2 className="text-lg font-black text-white">
                        Valide seu acesso para continuar
                      </h2>
                      <p className="max-w-2xl text-sm leading-6 text-brand-muted">
                        Para proteger seus dados, confirme o código enviado aos
                        canais já validados da sua conta. Quando e-mail e
                        WhatsApp estão ativos, os dois recebem exatamente o
                        mesmo código.
                      </p>
                      {accountValidation.deliveredChannels?.length ||
                      accountValidation.pendingChannels?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2" aria-label="Canais usados para enviar o código">
                          {accountValidation.deliveredChannels?.includes('email') ? (
                            <span className="rounded-full border border-green-accent/35 bg-green-accent/10 px-2.5 py-1 text-[11px] font-bold text-green-accent">
                              E-mail enviado
                            </span>
                          ) : null}
                          {accountValidation.deliveredChannels?.includes('whatsapp') ? (
                            <span className="rounded-full border border-green-accent/35 bg-green-accent/10 px-2.5 py-1 text-[11px] font-bold text-green-accent">
                              WhatsApp enviado
                            </span>
                          ) : null}
                          {accountValidation.pendingChannels?.includes('whatsapp') ? (
                            <span className="rounded-full border border-amber-300/35 bg-amber-300/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                              WhatsApp em nova tentativa
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-[1fr_180px]">
                      <input
                        value={accountValidation.token}
                        onChange={(event) =>
                          setAccountValidation((current) => ({
                            ...current,
                            token: event.target.value
                              .replace(/\D/g, '')
                              .slice(0, 12),
                            error: undefined,
                          }))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="Código de acesso"
                        className="h-11 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/80 px-3 text-center text-lg font-black tracking-[0.24em] text-white outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal placeholder:text-brand-muted focus:border-green-accent/60"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyAccountCode}
                        disabled={
                          isVerifyingAccountCode ||
                          accountValidation.token.trim().length < 4
                        }
                        className="h-11 rounded-xl bg-green-accent px-5 text-sm font-black text-brand-bg transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
                      >
                        {isVerifyingAccountCode ? 'Validando...' : 'Validar'}
                      </button>
                    </div>

                    {accountValidation.message || accountValidation.error ? (
                      <p
                        className={`mt-3 text-xs font-semibold ${
                          accountValidation.error
                            ? 'text-red-200'
                            : 'text-green-accent'
                        }`}
                      >
                        {accountValidation.error ?? accountValidation.message}
                      </p>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-brand-border-soft pt-4">
                      <button
                        type="button"
                        onClick={() => setCheckoutStep('identificacao')}
                        className="h-10 rounded-xl border border-brand-border-soft px-4 text-xs font-bold text-brand-muted transition hover:text-white"
                      >
                        Alterar e-mail/CPF/CNPJ
                      </button>
                      <button
                        type="button"
                        onClick={handleSendAccountCode}
                        disabled={isSendingAccountCode || accountCodeCooldown > 0}
                        className="h-10 rounded-xl border border-blue-primary/40 px-4 text-xs font-bold text-blue-primary transition hover:bg-blue-primary hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSendingAccountCode
                          ? 'Enviando...'
                          : accountCodeCooldown > 0
                            ? `Reenviar em ${accountCodeCooldown}s`
                            : 'Reenviar código'}
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

                  {customer.email ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-brand-border-soft bg-white/[0.03] p-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-muted">
                          Conta do checkout
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">
                          {customer.email}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleSwitchCheckoutAccount}
                        disabled={isSwitchingAccount}
                        className="h-10 rounded-xl border border-brand-border-soft px-4 text-xs font-bold text-brand-muted transition hover:border-blue-primary/60 hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {isSwitchingAccount ? 'Saindo...' : 'Sair ou trocar'}
                      </button>
                    </div>
                  ) : null}

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
                        (value) =>
                          isEmail(value) && !getEmailTypoErrorMessage(value)
                      )}
                      icon={Mail}
                      type="email"
                      autoComplete="email"
                      helper={getEmailTypoErrorMessage(customer.email) ?? undefined}
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
                  {savedAddresses.length > 0 ? (
                    <div className="grid gap-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-black text-white">
                          Endereços salvos
                        </h3>
                        <Link
                          href="/conta/enderecos"
                          className="text-xs font-bold text-blue-primary hover:text-white"
                        >
                          Gerenciar endereços
                        </Link>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {savedAddresses.map((address) => {
                          const checked = address.id === selectedSavedAddressId;

                          return (
                            <label
                              key={address.id}
                              className={`rounded-2xl border p-4 transition ${
                                checked
                                  ? 'border-green-accent/40 bg-green-accent/10'
                                  : 'border-brand-border-soft bg-white/[0.02] hover:border-blue-primary/40'
                              }`}
                            >
                              <input
                                type="radio"
                                name="savedAddress"
                                className="sr-only"
                                checked={checked}
                                onChange={() => applySavedAddress(address)}
                              />
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-black text-white">
                                    {address.label}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-brand-muted">
                                    {formatSavedAddress(address)}
                                  </p>
                                </div>
                                {address.isDefault ? (
                                  <span className="rounded-full border border-green-accent/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-green-accent">
                                    Padrão
                                  </span>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 md:grid-cols-2">
                    <CheckoutInput
                      label="CEP"
                      value={customer.postalCode}
                      onChange={(value) => updateCustomer({ postalCode: value })}
                      validationState={
                        postalCodeLookup.status === 'error'
                          ? 'invalid'
                          : postalCodeLookup.status === 'found'
                            ? 'valid'
                            : getGenericValidationState(
                                customer.postalCode,
                                (value) => onlyDigits(value).length >= 8
                              )
                      }
                      autoComplete="postal-code"
                      helper={postalCodeLookup.message}
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
                    onBack={() =>
                      setCheckoutStep(
                        isExpressCheckout ? 'pagamento' : 'cadastro'
                      )
                    }
                    onNext={handleContinueFromDelivery}
                    nextLabel={
                      isExpressCheckout
                        ? 'Atualizar endereço e frete'
                        : 'Continuar para envio'
                    }
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
                      Escolha uma opção calculada pela loja ativa. O valor será
                      revalidado no servidor antes do pagamento.
                    </p>
                  </div>
                  {isQuotingShipping ? (
                    <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4 text-sm font-semibold text-brand-muted">
                      {shippingOptions.length > 0
                        ? 'Atualizando opções de envio...'
                        : 'Calculando opções de envio...'}
                    </div>
                  ) : null}
                  <div className="grid gap-3">
                    {shippingOptions.map((option) => {
                      const checked =
                        option.quoteId === selectedShippingQuoteId;
                      const deliveryWindow = formatDeliveryWindow(option);

                      return (
                        <label
                          key={option.quoteId ?? option.serviceCode}
                          className={`rounded-2xl border p-4 transition ${
                            checked
                              ? 'border-green-accent/40 bg-green-accent/10'
                              : 'border-brand-border-soft bg-white/[0.02] hover:border-blue-primary/40'
                          }`}
                        >
                          <input
                            type="radio"
                            name="shippingQuote"
                            className="sr-only"
                            checked={checked}
                            onChange={() => {
                              resetCheckoutAttempt();
                              setSelectedShippingQuoteId(option.quoteId ?? null);
                            }}
                          />
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-accent/15">
                              <Truck className="h-5 w-5 text-green-accent" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-bold text-white">
                                  {option.serviceName}
                                </h3>
                                <span className="text-sm font-black text-green-accent">
                                  {option.price === 0
                                    ? 'Grátis'
                                    : formatCurrency(option.price)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-brand-muted">
                                {option.carrierName ??
                                  option.description ??
                                  'Entrega para o endereço informado.'}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold text-brand-muted">
                                <span className="rounded-full border border-white/10 px-2 py-1">
                                  {deliveryWindow}
                                </span>
                                <span className="rounded-full border border-white/10 px-2 py-1">
                                  {option.kind === 'pickup' ? 'Retirada' : 'Entrega'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {!isQuotingShipping && shippingOptions.length === 0 ? (
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm font-semibold text-amber-100">
                        Nenhuma forma de envio ativa para este endereço.
                      </div>
                    ) : null}
                  </div>
                  <CheckoutActionBar
                    onBack={() =>
                      setCheckoutStep(
                        isExpressCheckout ? 'pagamento' : 'entrega'
                      )
                    }
                    onNext={handleContinueFromShipping}
                    nextLabel="Continuar para pagamento"
                    disabled={
                      !selectedShippingQuoteId ||
                      (isQuotingShipping && shippingOptions.length === 0)
                    }
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
                      {isExpressCheckout
                        ? 'Confirme o endereço e o frete calculado antes de pagar.'
                        : 'Valide o e-mail antes de abrir o pagamento seguro.'}
                    </p>
                  </div>
                  {isExpressCheckout ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-primary/15">
                              <MapPin className="h-5 w-5 text-blue-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                                Entrega para
                              </p>
                              <p className="mt-1 text-xs font-semibold leading-5 text-white">
                                {formatCustomerAddress(customer)}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckoutError(null);
                              setCheckoutStep('entrega');
                            }}
                            className="shrink-0 text-xs font-bold text-blue-primary transition hover:text-white"
                          >
                            Alterar
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-brand-border-soft bg-white/[0.02] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-accent/15">
                              <Truck className="h-5 w-5 text-green-accent" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-muted">
                                Frete
                              </p>
                              {selectedShippingOption ? (
                                <>
                                  <p className="mt-1 text-xs font-bold text-white">
                                    {selectedShippingOption.serviceName} ·{' '}
                                    {selectedShippingOption.price === 0
                                      ? 'Grátis'
                                      : formatCurrency(selectedShippingOption.price)}
                                  </p>
                                  <p className="mt-1 text-[11px] text-brand-muted">
                                    {formatDeliveryWindow(selectedShippingOption)}
                                  </p>
                                </>
                              ) : (
                                <p className="mt-1 text-xs font-semibold text-brand-muted">
                                  {isQuotingShipping
                                    ? 'Calculando automaticamente...'
                                    : 'Frete ainda não calculado.'}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCheckoutError(null);
                              if (!selectedShippingOption) {
                                void refreshShippingQuotes(customer, {
                                  force: true,
                                });
                                return;
                              }

                              setCheckoutStep('envio');
                            }}
                            disabled={
                              isQuotingShipping && shippingOptions.length === 0
                            }
                            className="shrink-0 text-xs font-bold text-blue-primary transition hover:text-white disabled:cursor-wait disabled:opacity-50"
                          >
                            {selectedShippingOption ? 'Alterar' : 'Recalcular'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div
                    className={`rounded-2xl border p-4 ${
                      isCheckoutEmailVerified
                        ? 'border-green-accent/35 bg-green-accent/10'
                        : 'border-brand-border-soft bg-white/[0.02]'
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-accent/15">
                          {isCheckoutEmailVerified ? (
                            <CheckCircle2 className="h-5 w-5 text-green-accent" />
                          ) : (
                            <Mail className="h-5 w-5 text-green-accent" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            {isCheckoutEmailVerified
                              ? 'E-mail validado'
                              : 'Validar e-mail'}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-brand-muted">
                            {normalizedCustomerEmail || 'Informe o e-mail do comprador'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSendEmailCode}
                        disabled={isSendingEmailCode || isCheckoutEmailVerified}
                        className="h-10 rounded-xl border border-green-accent/30 px-4 text-xs font-bold text-green-accent transition hover:bg-green-accent/10 disabled:cursor-default disabled:opacity-60"
                      >
                        {isSendingEmailCode
                          ? 'Enviando...'
                          : isCheckoutEmailVerified
                            ? 'Validado'
                            : emailVerification.status === 'sent'
                              ? 'Reenviar código'
                              : 'Enviar código'}
                      </button>
                    </div>

                    {!isCheckoutEmailVerified ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
                        <input
                          value={emailVerification.token}
                          onChange={(event) =>
                            setEmailVerification((current) => ({
                              ...current,
                              token: event.target.value
                                .replace(/\D/g, '')
                                .slice(0, 12),
                              error: undefined,
                            }))
                          }
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="Código"
                          className="h-11 w-full rounded-xl border border-brand-border-soft bg-[#050A14]/80 px-3 text-center text-lg font-black tracking-[0.24em] text-white outline-none transition placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal placeholder:text-brand-muted focus:border-green-accent/60"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyEmailCode}
                          disabled={
                            isVerifyingEmailCode ||
                            emailVerification.token.trim().length < 4
                          }
                          className="h-11 rounded-xl bg-green-accent px-5 text-sm font-black text-brand-bg transition hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
                        >
                          {isVerifyingEmailCode ? 'Validando...' : 'Validar'}
                        </button>
                      </div>
                    ) : null}

                    {emailVerification.message || emailVerification.error ? (
                      <p
                        className={`mt-3 text-xs font-semibold ${
                          emailVerification.error
                            ? 'text-red-200'
                            : 'text-green-accent'
                        }`}
                      >
                        {emailVerification.error ?? emailVerification.message}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-blue-primary bg-blue-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-primary/20">
                        <CreditCard className="h-5 w-5 text-blue-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">
                          Pagamento seguro
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-brand-muted">
                          Escolha Pix, cartão ou boleto na próxima etapa, sem
                          refazer os dados do pedido.
                        </p>
                      </div>
                    </div>
                  </div>
                  {pixPaymentStatusSession ? (
                    <PixPaymentStatusScreen
                      orderId={pixPaymentStatusSession.orderId}
                      orderNumber={pixPaymentStatusSession.orderNumber}
                      paymentId={pixPaymentStatusSession.paymentId}
                      publicKey={pixPaymentStatusSession.publicKey}
                      onApproved={(redirectPath) => {
                        window.location.href = redirectPath;
                      }}
                    />
                  ) : paymentSession ? (
                    <div className="rounded-2xl border border-brand-border-soft bg-[#050A14]/80 p-4">
                      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white">
                            Pedido {paymentSession.orderNumber}
                          </h3>
                          <p className="mt-1 text-xs text-brand-muted">
                            Total a pagar: {formatCurrency(paymentSession.amount)}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted">
                          {paymentSession.environment === 'test'
                            ? 'Sandbox'
                            : 'Produção'}
                        </span>
                      </div>
                      <div
                        id={paymentBrickContainerId}
                        className="min-h-[360px] overflow-hidden rounded-xl bg-white p-2 text-brand-bg"
                      />
                      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <p className="text-xs font-semibold text-brand-muted">
                          {brickStatus === 'loading'
                            ? 'Preparando pagamento seguro...'
                            : brickStatus === 'processing'
                              ? 'Processando pagamento...'
                              : brickStatus === 'error'
                                ? 'Não foi possível abrir o pagamento embutido.'
                                : 'Se a tentativa falhar, você poderá pagar este mesmo pedido novamente.'}
                        </p>
                        {paymentSession.fallbackPaymentUrl ? (
                          <a
                            href={paymentSession.fallbackPaymentUrl}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-blue-primary/40 px-4 text-xs font-black text-blue-primary transition hover:bg-blue-primary/10"
                          >
                            Abrir pagamento
                          </a>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentSession(null);
                          setBrickStatus('idle');
                          setCheckoutStep('envio');
                        }}
                        disabled={brickStatus === 'processing'}
                        className="mt-4 h-10 rounded-xl border border-white/10 px-4 text-sm font-bold text-brand-muted transition hover:border-white/25 hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        Voltar ao envio
                      </button>
                    </div>
                  ) : (
                    <CheckoutActionBar
                      onBack={() => setCheckoutStep('envio')}
                      onNext={handleCheckout}
                      nextLabel={
                        isSubmitting
                          ? 'Preparando pagamento...'
                          : isQuotingShipping
                            ? 'Calculando frete...'
                            : !selectedShippingQuoteId
                              ? 'Frete indisponível'
                              : 'Abrir pagamento'
                      }
                      disabled={
                        isSubmitting ||
                        !isCheckoutEmailVerified ||
                        isQuotingShipping ||
                        !selectedShippingQuoteId
                      }
                    />
                  )}
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
                <SummaryRow
                  label={summaryProductSavings > 0 ? 'Subtotal público' : 'Subtotal'}
                  value={formatCurrency(
                    summaryProductSavings > 0
                      ? summaryCatalogSubtotal
                      : summarySubtotal
                  )}
                />
                {summaryProductSavings > 0 ? (
                  <SummaryRow
                    label="Desconto PJ"
                    value={`- ${formatCurrency(summaryProductSavings)}`}
                    accent
                  />
                ) : null}
                <SummaryRow
                  label={summaryShippingLabel}
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
