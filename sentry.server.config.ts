import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV,
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    delete event.user;
    delete event.request?.cookies;
    delete event.request?.data;
    return event;
  },
});
