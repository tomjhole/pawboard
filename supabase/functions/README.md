# PawBoard Edge Functions — Stripe payments

Manual payments (cash / bank transfer) work without any of this. These functions
are only needed for **card payments via Stripe Checkout**.

## One-time setup

1. **Create a Stripe account** and grab your API keys (Developers → API keys).
   Start in **test mode** — the keys begin `sk_test_…`.

2. **Set the secrets** (run from the repo root with the Supabase CLI):

   ```bash
   supabase secrets set STRIPE_SECRET_KEY_TEST=sk_test_xxx
   # later, when going live:
   # supabase secrets set STRIPE_SECRET_KEY_LIVE=sk_live_xxx
   ```

   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
   injected automatically — you don't set those.

3. **Deploy the functions:**

   ```bash
   supabase functions deploy create-payment-checkout
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

4. **Add the webhook** in Stripe (Developers → Webhooks → Add endpoint):

   - URL: `https://<project-ref>.functions.supabase.co/stripe-webhook`
   - Event: `checkout.session.completed`
   - Copy the signing secret (`whsec_…`) and set it:

   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```

   While sandboxing, create the endpoint in Stripe **test mode**.

5. In PawBoard: **Settings → Payments** → enable card payments and keep
   **Sandbox (test mode)** on. Take a payment on a booking and use Stripe's test
   card `4242 4242 4242 4242`, any future expiry, any CVC.

## How it fits together

- `create-payment-checkout` — called by the app; computes the amount
  (deposit / balance / full), creates a Checkout Session, writes a **pending**
  `payments` row, returns the redirect URL. Picks the **test** secret key when the
  business has `stripe_test_mode = true`.
- `stripe-webhook` — Stripe calls this after payment; it verifies the signature,
  marks the `payments` row **paid**, and updates the booking's
  `deposit_paid` / `balance_paid` flags.

No Stripe Connect is used — payments go to your own Stripe account.

---

# Email notifications (Resend)

Powers booking confirmations, change/cancel notices, payment receipts, invoices,
owner-portal invites, booking-request acknowledgements, and the daily arrival +
vaccination reminders. Functions: `send-email` (app-triggered) and
`send-reminders` (scheduled). The Stripe webhook also emails card receipts.

## One-time setup

1. **Verify a sending domain in Resend** (Resend → Domains → Add). Add the
   **SPF, DKIM and DMARC** DNS records it gives you. This is what makes mail
   look legitimate (not spam / not "via resend.dev").

2. **Set the secrets:**
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx
   supabase secrets set EMAIL_FROM_ADDRESS=notifications@yourdomain.com   # on the verified domain
   supabase secrets set APP_URL=https://app.yourdomain.com                 # fallback for links
   ```

3. **Deploy:**
   ```bash
   supabase functions deploy send-email
   supabase functions deploy send-reminders --no-verify-jwt
   ```

4. **Schedule the daily reminders** (Supabase Cron — enable `pg_cron` + `pg_net`):
   ```sql
   select cron.schedule('pawboard-reminders', '0 8 * * *', $$
     select net.http_post(
       url := 'https://<project-ref>.functions.supabase.co/send-reminders',
       headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>'));
   $$);
   ```

Mail sends from **`{Business name} <notifications@yourdomain.com>`** with
**Reply-To = the business's own email**, so owners see the kennel as the sender.
Reminders are **Premium**-only and honour each business's toggles in
**Settings → Notifications**.

## Fix the Supabase Auth emails (signup confirmation, reset, magic link)

These are sent by Supabase Auth, *not* the functions above — by default they
look like a generic Supabase email. To brand them:

1. **Authentication → SMTP**: enable custom SMTP using Resend's SMTP credentials,
   sender `PawBoard <noreply@yourdomain.com>` (same verified domain).
2. **Authentication → Email Templates**: paste the branded HTML from
   `supabase/email-templates/` (confirm signup, magic link, reset, invite).

## How it fits together

- `send-email` — verifies the caller can see the entity (RLS), checks the
  business's `email_enabled` + per-type toggle, renders a branded template
  (`_shared/email.ts`), sends via Resend, logs to `email_log`.
- `send-reminders` — daily; for Premium businesses, sends arrival + vaccination
  reminders, de-duping against `email_log` so it never repeats.
- Test card receipt: complete a Stripe test payment → the webhook emails a receipt.
