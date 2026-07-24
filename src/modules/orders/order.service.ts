/**
 * Serviço de pedidos.
 * Regras de negócio ficam aqui: o frontend nunca define preço ou total.
 */

import { z } from 'zod';
import type {
  CreateOrderInput,
  Order,
  OrderItem,
  OrderListItem,
} from './order.types';
import {
  type OrderDataSource,
  type OrderRepositoryResult,
  getOrderByIdFromRepository,
  getOrderByIdForCustomerFromRepository,
  listOrdersByCustomerIdFromRepository,
  listMockOrdersFromRepository,
  listOrdersFromRepository,
  listOrdersWithSourceFromRepository,
  saveOrderToRepository,
  updateOrderExternalErpStateInRepository,
  updateOrderFulfillmentStateInRepository,
} from './order.repository';
import { upsertCheckoutCustomer } from '../customers/customer.service';
import { tryAutoSendOrderToBling } from '../integrations/bling/orders/bling-order-send.service';
import {
  getCustomerTypeFromDocument,
  resolveCheckoutPricing,
} from '../pricing/pricing.service';
import { validateShippingQuoteForCheckout } from '../shipping/shipment.service';

const createOrderInputSchema = z.object({
  storeId: z.string().trim().min(1),
  customerId: z.string().trim().min(1).optional(),
  sendToErp: z.boolean().optional(),
  requirePersistence: z.boolean().optional(),
  shippingQuoteId: z.string().trim().uuid().optional(),
  marketingContext: z.record(z.string(), z.unknown()).optional(),
  customer: z
    .object({
      authUserId: z.string().trim().min(1).optional(),
      name: z.string().trim().min(2).optional(),
      email: z.string().trim().email().optional(),
      phone: z.string().trim().min(8).optional(),
      document: z.string().trim().min(11).optional(),
      customerType: z.enum(['pf', 'pj']).optional(),
      legalName: z.string().trim().min(1).optional(),
      stateRegistration: z.string().trim().min(1).optional(),
      stateRegistrationExempt: z.boolean().optional(),
      acceptsMarketing: z.boolean().optional(),
      shippingAddress: z
        .object({
          recipientName: z.string().trim().min(1).optional(),
          phone: z.string().trim().min(8).optional(),
          postalCode: z.string().trim().min(5).optional(),
          street: z.string().trim().min(1).optional(),
          number: z.string().trim().min(1).optional(),
          complement: z.string().trim().min(1).optional(),
          district: z.string().trim().min(1).optional(),
          city: z.string().trim().min(1).optional(),
          state: z.string().trim().min(2).optional(),
          country: z.string().trim().min(2).optional(),
        })
        .optional(),
    })
    .optional(),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1),
        variantId: z.string().trim().min(1),
        sku: z.string().trim().min(1).optional(),
        name: z.string().trim().min(1).optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().nonnegative().optional(),
      })
    )
    .min(1),
});

function generateOrderNumber(): string {
  return `BD-${Math.floor(100000 + Math.random() * 900000)}`;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function listOrders(storeId: string): Promise<OrderListItem[]> {
  return listOrdersFromRepository(storeId);
}

export async function listOrdersWithSource(
  storeId: string
): Promise<
  OrderRepositoryResult<OrderListItem[]>
> {
  return listOrdersWithSourceFromRepository(storeId);
}

export async function listMockOrders(storeId: string): Promise<OrderListItem[]> {
  return listMockOrdersFromRepository(storeId);
}

export type { OrderDataSource };

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const parsed = createOrderInputSchema.parse(input);
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const customerType =
    parsed.customer?.customerType ??
    getCustomerTypeFromDocument(parsed.customer?.document);
  const pricing = await resolveCheckoutPricing({
    storeId: parsed.storeId,
    customerType,
    items: parsed.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    })),
  });
  const shippingAddress = parsed.customer?.shippingAddress;
  const shippingQuote = parsed.shippingQuoteId
    ? await validateShippingQuoteForCheckout({
        storeId: parsed.storeId,
        quoteId: parsed.shippingQuoteId,
        subtotal: pricing.subtotal,
        pricingFingerprint: pricing.pricingFingerprint,
        destinationPostalCode: shippingAddress?.postalCode ?? '',
        items: parsed.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
        })),
      })
    : null;

  if (parsed.requirePersistence && !shippingQuote) {
    throw new Error('shipping_quote_required');
  }

  const shippingTotal = shippingQuote?.price ?? 0;
  const orderTotal = roundCurrency(
    pricing.subtotal + shippingTotal - pricing.discountTotal
  );

  const resolvedItems = pricing.items.map((item) => ({
    id: crypto.randomUUID(),
    storeId: item.storeId,
    orderId,
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    baseUnitPrice: item.baseUnitPrice,
    unitPrice: item.unitPrice,
    total: item.total,
    discountPercentage: item.discountPercentage,
    productDiscountTotal: item.productDiscountTotal,
    customerType: item.customerType,
    priceListId: item.priceListId,
    priceListName: item.priceListName,
  })) satisfies OrderItem[];

  const storeId = resolvedItems[0]?.storeId ?? parsed.storeId;

  if (resolvedItems.some((item) => item.storeId !== storeId)) {
    throw new Error('Order contains products from different stores.');
  }

  const customer = parsed.customer
    ? await upsertCheckoutCustomer({
        storeId,
        authUserId: parsed.customer.authUserId,
        name: parsed.customer.name ?? 'Cliente sem nome',
        email: parsed.customer.email,
        phone: parsed.customer.phone,
        document: parsed.customer.document,
        customerType,
        legalName: parsed.customer.legalName,
        stateRegistration: parsed.customer.stateRegistration,
        stateRegistrationExempt: parsed.customer.stateRegistrationExempt,
        acceptsMarketing: parsed.customer.acceptsMarketing,
        source: 'checkout',
        address: parsed.customer.shippingAddress
          ? {
              recipientName: parsed.customer.shippingAddress.recipientName,
              phone: parsed.customer.shippingAddress.phone,
              postalCode: parsed.customer.shippingAddress.postalCode,
              street: parsed.customer.shippingAddress.street,
              number: parsed.customer.shippingAddress.number,
              complement: parsed.customer.shippingAddress.complement,
              district: parsed.customer.shippingAddress.district,
              city: parsed.customer.shippingAddress.city,
              state: parsed.customer.shippingAddress.state,
              country: parsed.customer.shippingAddress.country,
            }
          : undefined,
      })
    : null;

  const items = resolvedItems.map((item) => ({ ...item, storeId }));

  const order: Order = {
    id: orderId,
    storeId,
    orderNumber: generateOrderNumber(),
    customerId: customer?.id ?? parsed.customerId,
    customer: {
      name: customer?.name ?? parsed.customer?.name,
      email: customer?.email ?? parsed.customer?.email,
      phone: customer?.phone ?? parsed.customer?.phone,
      document: customer?.document ?? parsed.customer?.document,
      customerType,
      legalName:
        customer?.legalName ??
        parsed.customer?.legalName,
      stateRegistration:
        customer?.stateRegistration ??
        parsed.customer?.stateRegistration,
      stateRegistrationExempt:
        customer?.stateRegistrationExempt ??
        parsed.customer?.stateRegistrationExempt,
      shippingAddress:
        customer?.defaultAddress
          ? {
              recipientName: customer.defaultAddress.recipientName,
              phone: customer.defaultAddress.phone,
              postalCode: customer.defaultAddress.postalCode,
              street: customer.defaultAddress.street,
              number: customer.defaultAddress.number,
              complement: customer.defaultAddress.complement,
              district: customer.defaultAddress.district,
              city: customer.defaultAddress.city,
              state: customer.defaultAddress.state,
              country: customer.defaultAddress.country,
            }
          : parsed.customer?.shippingAddress,
    },
    status: 'pending',
    paymentStatus: 'pending',
    fulfillmentStatus: 'unfulfilled',
    subtotal: pricing.subtotal,
    shippingTotal,
    shippingMethodId: shippingQuote?.methodId,
    shippingQuoteId: shippingQuote?.id,
    shippingProviderKey: shippingQuote?.providerKey,
    shippingServiceCode: shippingQuote?.serviceCode,
    shippingServiceName: shippingQuote?.serviceName,
    shippingCarrierName: shippingQuote?.carrierName,
    shippingDeliveryMinDays: shippingQuote?.deliveryMinDays,
    shippingDeliveryMaxDays: shippingQuote?.deliveryMaxDays,
    shippingMetadata: shippingQuote
      ? {
          destinationPostalCode: shippingQuote.destinationPostalCode,
          itemsHash: shippingQuote.itemsHash,
          expiresAt: shippingQuote.expiresAt,
          quoteOnly: shippingQuote.rawPayload.quoteOnly === true,
          deliveryTimeLabel: shippingQuote.deliveryTimeLabel,
          package: shippingQuote.rawPayload.package,
          quote: shippingQuote.rawPayload,
        }
      : {},
    marketingContext: parsed.marketingContext ?? {},
    discountTotal: pricing.discountTotal,
    productDiscountTotal: pricing.productSavingsTotal,
    total: orderTotal,
    customerType,
    customerLegalName:
      customer?.legalName ??
      parsed.customer?.legalName,
    customerStateRegistration:
      customer?.stateRegistration ??
      parsed.customer?.stateRegistration,
    customerStateRegistrationExempt:
      customer?.stateRegistrationExempt ??
      parsed.customer?.stateRegistrationExempt,
    priceListId: pricing.priceListId,
    priceListName: pricing.priceListName,
    fiscalInfo: {
      customerType,
      legalName:
        customer?.legalName ??
        parsed.customer?.legalName,
      stateRegistration:
        customer?.stateRegistration ??
        parsed.customer?.stateRegistration,
      stateRegistrationExempt:
        customer?.stateRegistrationExempt ??
        parsed.customer?.stateRegistrationExempt,
      document: customer?.document ?? parsed.customer?.document,
    },
    externalErpSyncStatus: 'pending',
    items,
    createdAt: now,
    updatedAt: now,
  };

  const savedOrder = await saveOrderToRepository(order, {
    requirePersistence: parsed.requirePersistence,
  });

  if (parsed.sendToErp !== false) {
    await tryAutoSendOrderToBling({
      storeId: savedOrder.storeId,
      orderId: savedOrder.id,
    });
  }

  return savedOrder;
}

export async function createMockOrder(input: CreateOrderInput): Promise<Order> {
  return createOrder(input);
}

export async function getOrderById(
  storeId: string,
  orderId: string
): Promise<OrderListItem | null> {
  return getOrderByIdFromRepository(storeId, orderId);
}

export async function listOrdersByCustomerId(input: {
  storeId: string;
  customerId: string;
}): Promise<OrderListItem[]> {
  return listOrdersByCustomerIdFromRepository(input);
}

export async function getOrderByIdForCustomer(input: {
  storeId: string;
  customerId: string;
  orderId: string;
}): Promise<OrderListItem | null> {
  return getOrderByIdForCustomerFromRepository(input);
}

export async function markOrderErpSyncError(input: {
  storeId: string;
  orderId: string;
  errorCode: string;
}) {
  return updateOrderExternalErpStateInRepository({
    storeId: input.storeId,
    orderId: input.orderId,
    status: 'error',
    lastError: input.errorCode,
  });
}

export async function markOrderShipmentState(input: {
  storeId: string;
  orderId: string;
  status: 'shipped' | 'delivered' | 'processing';
  fulfillmentStatus: 'partial' | 'fulfilled' | 'unfulfilled';
}) {
  return updateOrderFulfillmentStateInRepository(input);
}
