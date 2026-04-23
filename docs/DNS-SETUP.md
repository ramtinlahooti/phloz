# DNS Setup — phloz.com

This doc is the source of truth for DNS records across the three Phloz
domains:

| Host | Purpose | Hosted on |
|---|---|---|
| `phloz.com` | Marketing site + apex redirect | Vercel (apps/web) |
| `www.phloz.com` | Canonical redirect to `phloz.com` | Vercel |
| `app.phloz.com` | Product | Vercel (apps/app) |
| `inbound.phloz.com` | Receives client email-to-app | Resend inbound |

DNS is managed at the registrar (Cloudflare / Namecheap / wherever the
domain lives). Keep this file in sync whenever records change — future
Claude sessions use it to reason about email deliverability and auth
flows.

---

## 1. Apex + www (Vercel)

Add the domains in the Vercel dashboard for **both** projects (web +
app) and let Vercel drive the exact values. The general shape:

```
phloz.com          A      76.76.21.21
www.phloz.com      CNAME  cname.vercel-dns.com
app.phloz.com      CNAME  cname.vercel-dns.com
```

Verify with:

```bash
dig phloz.com +short
dig app.phloz.com +short
```

Vercel issues + renews certs automatically once the records resolve.

---

## 2. Transactional email — `phloz.com` (Resend outbound)

Used by: invitations, portal magic links, password resets. Configured
under **Resend → Domains → phloz.com**. Resend will give you the exact
values; the shape is:

### 2.1 SPF

One TXT at the apex. Merge with any existing SPF — do NOT create a
second SPF TXT record.

```
phloz.com   TXT   "v=spf1 include:_spf.resend.com ~all"
```

### 2.2 DKIM

Two CNAMEs Resend generates (the selectors include a random suffix;
use the exact ones from Resend):

```
resend._domainkey.phloz.com    CNAME   resend._domainkey.<…>.dkim.resend.com
resend2._domainkey.phloz.com   CNAME   resend2._domainkey.<…>.dkim.resend.com
```

### 2.3 DMARC

Start in `none` mode; tighten to `quarantine` after we've verified
legitimate sends are authenticating for two weeks.

```
_dmarc.phloz.com   TXT   "v=DMARC1; p=none; rua=mailto:dmarc@phloz.com; fo=1"
```

### 2.4 Return-Path / MAIL FROM (optional but recommended)

Resend may ask for a `send.phloz.com` or similar subdomain for
better alignment. Add whatever records it specifies.

---

## 3. Inbound email — `inbound.phloz.com` (Resend inbound)

Used by: email-to-app flow. Each client has
`client-<nanoid>@inbound.phloz.com`; Resend receives the message and
POSTs our webhook.

### 3.1 MX (required)

Resend prints two MX records with priorities; use both for redundancy.
Shape:

```
inbound.phloz.com   MX   10   feedback-smtp.us-east-1.amazonses.com.
inbound.phloz.com   MX   20   feedback-smtp.us-west-2.amazonses.com.
```

(Values vary by region — use what Resend gives you.)

### 3.2 SPF for the inbound subdomain (so bounces authenticate)

```
inbound.phloz.com   TXT   "v=spf1 include:amazonses.com ~all"
```

### 3.3 No DKIM on the inbound subdomain

We don't send from `inbound.phloz.com` — it's receive-only. SPF above
is enough for bounce alignment.

---

## 4. Webhook configuration (Resend dashboard)

Once DNS is green, configure:

- **Webhook endpoint** — `https://app.phloz.com/api/webhooks/resend/inbound`
- **Events** — `email.delivered`, `email.bounced`, `email.complained`,
  `email.delivery_delayed`. Opens/clicks optional.
- **Signing secret** — copy into `RESEND_WEBHOOK_SECRET` on Vercel
  (production + preview).
- **Inbound routing rule** — on `inbound.phloz.com`, catch-all → forward
  to the same endpoint. The handler validates the recipient address
  against `inbound_email_addresses` before accepting.

Local dev tunnels via ngrok:

```bash
ngrok http 3001
# copy https://<subdomain>.ngrok.app/api/webhooks/resend/inbound into
# a *separate* test endpoint on a scratch Resend domain
```

---

## 5. Analytics / search-console records (nice-to-have)

Add the Google Search Console TXT verification + Bing Webmaster TXT
once available; they don't block anything but help SEO tooling.

---

## Verification checklist

- [ ] `phloz.com` resolves and serves the marketing site (200 OK)
- [ ] `app.phloz.com` resolves and serves the product
- [ ] `mail-tester.com` gives the transactional `from` address 10/10
- [ ] Sending a test email from Resend reaches Gmail → lands in inbox,
      not spam
- [ ] Sending a test email TO `client-test@inbound.phloz.com` triggers
      our webhook (visible in Resend logs + Sentry breadcrumb)
- [ ] `_dmarc.phloz.com` returns a valid `p=none` record
