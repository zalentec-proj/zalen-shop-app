import 'server-only';

import {
  findCustomerByAuthUserId,
  findCustomerByEmail,
  linkCustomerAuthUser,
  listCustomerAddresses,
  upsertCustomer,
} from '@/modules/customers/customer.service';
import type { Customer, CustomerAddress } from '@/modules/customers/customer.types';
import {
  getOrderByIdForCustomer,
  listOrdersByCustomerId,
} from '@/modules/orders/order.service';
import { claimGuestOrdersForCustomerInRepository } from '@/modules/orders/order.repository';
import type { OrderListItem } from '@/modules/orders/order.types';
import {
  getLatestPaymentTransactionByOrderId,
  listPaymentTransactionsByOrderIds,
} from '@/modules/payments/payment-transaction.repository';
import type { PaymentTransaction } from '@/modules/payments/payment-transaction.types';
import {
  getShipmentsByOrderId,
  listShipmentsByOrderIds,
} from '@/modules/shipping/shipment.service';
import type { Shipment } from '@/modules/shipping/shipment.types';

export interface CustomerOrderWithDetails extends OrderListItem {
  payment?: PaymentTransaction;
  shipments: Shipment[];
}

export interface CustomerAccount {
  customer: Customer;
  addresses: CustomerAddress[];
  orders: CustomerOrderWithDetails[];
}

function nameFromEmail(email: string) {
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Cliente';
}

export async function linkOrCreateCustomerAccount(input: {
  storeId: string;
  authUserId: string;
  email?: string;
}): Promise<Customer | null> {
  let customer = await findCustomerByAuthUserId({
    storeId: input.storeId,
    authUserId: input.authUserId,
  });

  if (!customer && input.email) {
    const existingByEmail = await findCustomerByEmail({
      storeId: input.storeId,
      email: input.email,
    });

    if (existingByEmail?.authUserId && existingByEmail.authUserId !== input.authUserId) {
      return null;
    }

    if (existingByEmail) {
      customer = await linkCustomerAuthUser({
        storeId: input.storeId,
        customerId: existingByEmail.id,
        authUserId: input.authUserId,
      });
    } else {
      customer = await upsertCustomer({
        storeId: input.storeId,
        authUserId: input.authUserId,
        name: nameFromEmail(input.email),
        email: input.email,
        source: 'checkout',
      });
    }
  }

  if (customer && input.email) {
    await claimGuestOrdersForCustomerInRepository({
      storeId: input.storeId,
      customerId: customer.id,
      verifiedEmail: input.email,
    });
  }

  return customer;
}

function groupPaymentsByOrderId(payments: PaymentTransaction[]) {
  return payments.reduce((accumulator, payment) => {
    if (!accumulator.has(payment.orderId)) {
      accumulator.set(payment.orderId, payment);
    }

    return accumulator;
  }, new Map<string, PaymentTransaction>());
}

function groupShipmentsByOrderId(shipments: Shipment[]) {
  return shipments.reduce((accumulator, shipment) => {
    const current = accumulator.get(shipment.orderId) ?? [];
    current.push(shipment);
    accumulator.set(shipment.orderId, current);
    return accumulator;
  }, new Map<string, Shipment[]>());
}

export async function getCustomerAccountForUser(input: {
  storeId: string;
  authUserId: string;
  email?: string;
}): Promise<CustomerAccount | null> {
  const customer = await linkOrCreateCustomerAccount(input);

  if (!customer) {
    return null;
  }

  const addresses = await listCustomerAddresses({
    storeId: input.storeId,
    customerId: customer.id,
  });
  const orders = await listOrdersByCustomerId({
    storeId: input.storeId,
    customerId: customer.id,
  });
  const orderIds = orders.map((order) => order.id);
  const [payments, shipments] = await Promise.all([
    listPaymentTransactionsByOrderIds({
      storeId: input.storeId,
      orderIds,
    }),
    listShipmentsByOrderIds({
      storeId: input.storeId,
      orderIds,
    }),
  ]);
  const paymentsByOrderId = groupPaymentsByOrderId(payments);
  const shipmentsByOrderId = groupShipmentsByOrderId(shipments);

  return {
    customer,
    addresses,
    orders: orders.map((order) => ({
      ...order,
      payment: paymentsByOrderId.get(order.id),
      shipments: shipmentsByOrderId.get(order.id) ?? [],
    })),
  };
}

export async function getCustomerOrderForUser(input: {
  storeId: string;
  authUserId: string;
  email?: string;
  orderId: string;
}): Promise<CustomerOrderWithDetails | null> {
  const customer = await linkOrCreateCustomerAccount(input);

  if (!customer) {
    return null;
  }

  const order = await getOrderByIdForCustomer({
    storeId: input.storeId,
    customerId: customer.id,
    orderId: input.orderId,
  });

  if (!order) {
    return null;
  }

  const [payment, shipments] = await Promise.all([
    getLatestPaymentTransactionByOrderId({
      storeId: input.storeId,
      orderId: order.id,
    }),
    getShipmentsByOrderId({
      storeId: input.storeId,
      orderId: order.id,
    }),
  ]);

  return {
    ...order,
    payment: payment ?? undefined,
    shipments,
  };
}
