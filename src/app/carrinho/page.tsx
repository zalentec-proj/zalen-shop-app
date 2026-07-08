import { getCurrentUser } from '@/modules/auth/auth.service';
import { getCustomerAccountForUser } from '@/modules/customer-account/customer-account.service';
import { MarketingDataLayer } from '@/modules/marketing/MarketingDataLayer';
import { MarketingScripts } from '@/modules/marketing/MarketingScripts';
import { getMarketingRuntimeConfig } from '@/modules/marketing/marketing.service';
import { noindexMetadata } from '@/modules/seo/seo.service';
import { resolveCurrentStoreFromHeaders } from '@/modules/stores/store-resolution';
import CartClient from './CartClient';

export const metadata = {
  title: 'Carrinho — Brasil Drones & Parts',
  ...noindexMetadata,
};

export const dynamic = 'force-dynamic';

export default async function CartPage() {
  const [user, store] = await Promise.all([
    getCurrentUser(),
    resolveCurrentStoreFromHeaders(),
  ]);
  const marketingConfig = await getMarketingRuntimeConfig(store);
  const account =
    user && store
      ? await getCustomerAccountForUser({
          storeId: store.id,
          authUserId: user.id,
          email: user.email,
        })
      : null;

  return (
    <>
      <MarketingScripts config={marketingConfig} />
      <MarketingDataLayer config={marketingConfig} />
      <CartClient
        customerSession={
          user
            ? {
                email: user.email,
                customer: account?.customer
                  ? {
                      name: account.customer.name,
                      email: user.email ?? account.customer.email,
                      phone: account.customer.phone,
                      document: account.customer.document,
                      customerType: account.customer.customerType,
                      legalName: account.customer.legalName,
                      stateRegistration: account.customer.stateRegistration,
                      stateRegistrationExempt:
                        account.customer.stateRegistrationExempt,
                      acceptsMarketing: account.customer.acceptsMarketing,
                      addresses: account.addresses.map((address) => ({
                        id: address.id,
                        label: address.label,
                        recipientName: address.recipientName,
                        phone: address.phone,
                        postalCode: address.postalCode,
                        street: address.street,
                        number: address.number,
                        complement: address.complement,
                        district: address.district,
                        city: address.city,
                        state: address.state,
                        isDefault: address.isDefault,
                      })),
                      shippingAddress: account.customer.defaultAddress
                        ? {
                            postalCode: account.customer.defaultAddress.postalCode,
                            street: account.customer.defaultAddress.street,
                            number: account.customer.defaultAddress.number,
                            complement: account.customer.defaultAddress.complement,
                            district: account.customer.defaultAddress.district,
                            city: account.customer.defaultAddress.city,
                            state: account.customer.defaultAddress.state,
                          }
                        : undefined,
                    }
                  : undefined,
              }
            : null
        }
      />
    </>
  );
}
