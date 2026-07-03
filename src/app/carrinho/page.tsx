import { getCurrentUser } from '@/modules/auth/auth.service';
import { linkOrCreateCustomerAccount } from '@/modules/customer-account/customer-account.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CartClient from './CartClient';

export const metadata = {
  title: 'Carrinho — Brasil Drones & Parts',
};

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const user = await getCurrentUser();
  const store = user ? await resolveCurrentStoreFromHeaders() : null;
  const customer =
    user && store
      ? await linkOrCreateCustomerAccount({
          storeId: store.id,
          authUserId: user.id,
          email: user.email,
        })
      : null;

  return (
    <CartClient
      customerSession={
        user
          ? {
              email: user.email,
              customer: customer
                ? {
                    name: customer.name,
                    email: user.email ?? customer.email,
                    phone: customer.phone,
                    document: customer.document,
                    customerType: customer.customerType,
                    legalName: customer.legalName,
                    stateRegistration: customer.stateRegistration,
                    stateRegistrationExempt:
                      customer.stateRegistrationExempt,
                    acceptsMarketing: customer.acceptsMarketing,
                    shippingAddress: customer.defaultAddress
                      ? {
                          postalCode: customer.defaultAddress.postalCode,
                          street: customer.defaultAddress.street,
                          number: customer.defaultAddress.number,
                          complement: customer.defaultAddress.complement,
                          district: customer.defaultAddress.district,
                          city: customer.defaultAddress.city,
                          state: customer.defaultAddress.state,
                        }
                      : undefined,
                  }
                : undefined,
            }
          : null
      }
    />
  );
}
