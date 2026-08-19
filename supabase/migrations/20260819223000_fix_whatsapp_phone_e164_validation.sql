-- The initial Evolution migration escaped the leading `+` twice. In PostgreSQL
-- regex syntax that matches a literal backslash, so valid E.164 values such as
-- +5545999999999 were rejected before a verification code could be created.

alter table public.customer_contact_preferences
  drop constraint if exists customer_contact_preferences_phone_e164_check;

alter table public.customer_contact_preferences
  add constraint customer_contact_preferences_phone_e164_check
  check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

alter table public.customer_contact_verifications
  drop constraint if exists customer_contact_verifications_phone_e164_check;

alter table public.customer_contact_verifications
  add constraint customer_contact_verifications_phone_e164_check
  check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

alter table public.whatsapp_message_deliveries
  drop constraint if exists whatsapp_message_deliveries_recipient_phone_e164_check;

alter table public.whatsapp_message_deliveries
  add constraint whatsapp_message_deliveries_recipient_phone_e164_check
  check (recipient_phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
