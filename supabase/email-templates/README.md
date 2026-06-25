# Supabase Auth email templates

These replace the default Supabase Auth emails (the ones that otherwise look
like a generic Supabase sign-up). Paste each file's HTML into **Supabase
Dashboard → Authentication → Email Templates**, and set the **Subject** lines below.

| Template            | File                   | Subject |
|---------------------|------------------------|---------|
| Confirm signup      | `confirm-signup.html`  | Confirm your email for PawBoard |
| Magic Link          | `magic-link.html`      | Your PawBoard sign-in link |
| Reset Password      | `reset-password.html`  | Reset your PawBoard password |
| Invite user         | `invite.html`          | You've been invited to PawBoard |

These are **global** (sent before we know which business the user belongs to),
so they use PawBoard branding. Pair them with custom SMTP (Authentication → SMTP,
pointed at Resend on your verified domain) so they also send *from* your domain —
see `../functions/README.md`.

Supabase substitutes `{{ .ConfirmationURL }}` (and `{{ .Email }}`, `{{ .Token }}`)
at send time; leave those placeholders intact.
