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
