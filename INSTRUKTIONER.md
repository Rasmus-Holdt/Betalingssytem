# Betalingssystem – sådan får du det til at køre

Dette er hele systemet: en formular hvor du taster kundenavn + pris, den laver et
Stripe-betalingslink, kunden betaler, du får en e-mail, og alle betalinger vises
automatisk på en liste (`/kunder.html`) — det er din "database", ingen ekstra
opsætning nødvendig.

Alt koden er lavet. Du skal bare gøre 4 ting, alle i browseren, ingen terminal.

## Hvad er hvad

- `public/index.html` – formularen hvor du opretter et betalingslink
- `public/kunder.html` – oversigt over alle der har betalt
- `public/success.html` – siden kunden ser efter betaling
- `netlify/functions/create-payment-link.js` – laver Stripe-linket
- `netlify/functions/stripe-webhook.js` – modtager besked fra Stripe når nogen betaler, gemmer det
- `netlify/functions/list-payments.js` – henter listen til kunder.html

## 1. Læg koden på GitHub (5 min)

1. Opret en gratis konto på [github.com](https://github.com) (hvis du ikke har en).
2. Klik **New repository** → giv den et navn, f.eks. `betalingssystem` → **Create repository**.
3. Klik **uploading an existing file** → træk hele denne mappes indhold ind (alle filer og mapper) → **Commit changes**.

## 2. Deploy på Netlify (5 min)

1. Opret en gratis konto på [netlify.com](https://netlify.com) (kræver ikke betalingskort).
2. **Add new site → Import an existing project → Deploy with GitHub** → vælg dit repo.
3. Netlify finder selv indstillingerne (fra `netlify.toml`). Klik bare **Deploy**.
4. Efter et par minutter får du en adresse, f.eks. `https://dit-navn.netlify.app`. Det er din live side.

## 3. Forbind Stripe (10 min)

**A. Hent din secret key:**
1. Log ind på [dashboard.stripe.com](https://dashboard.stripe.com), tjek at **"Test mode"** er slået til (øverst).
2. Gå til **Developers → API keys**.
3. Kopiér **Secret key** (starter med `sk_test_...`).

**B. Læg den ind i Netlify:**
1. På dit site i Netlify: **Site configuration → Environment variables → Add a variable**.
2. Navn: `STRIPE_SECRET_KEY`, værdi: den nøgle du kopierede. Gem.

**C. Opret webhook (så Stripe kan fortælle systemet at der er betalt):**
1. I Stripe: **Developers → Webhooks → Add endpoint**.
2. Endpoint-URL: `https://DIT-SITE.netlify.app/.netlify/functions/stripe-webhook`
3. Vælg event: `checkout.session.completed`.
4. Opret, og kopiér **Signing secret** (starter med `whsec_...`).
5. Læg den i Netlify som en ny environment variable: `STRIPE_WEBHOOK_SECRET`.

**D. Redeploy:**
- Gå til **Deploys** i Netlify → **Trigger deploy → Deploy site**, så de nye nøgler bliver taget i brug.

## 4. Slå e-mail-notifikationer til (2 min)

Stripe sender selv e-mails til dig — du skal ikke bygge noget til det:
1. I Stripe: **Settings (tandhjulet) → Profile → Communication preferences** (eller søg "notifications" i søgefeltet).
2. Slå notifikationer til for betalinger.

Du får desuden altid overblikket i **Stripe Dashboard → Payments**.

## Sådan bruger du systemet

1. Gå til `https://dit-site.netlify.app`.
2. Skriv kundenavn, og udfyld ét eller begge beløbsfelter:
   - **Engangsbeløb** – opkræves med det samme.
   - **Månedligt beløb** – starter et abonnement.
   - Udfylder du begge, samles de i ét link/én regning (fx "Hjemmeside 500 kr.
     engang + 200 kr. om måneden").
3. Klik **Lav betalingslink** → kopiér linket → send det til kunden (SMS, mail, hvad du vil).
4. Kunden betaler via Stripes betalingsside.
5. Du får en e-mail, og betalingen dukker automatisk op på `/kunder.html`.

## Test det først (vigtigt!)

Så længe du bruger `sk_test_...`-nøglen, er alt i test-mode — ingen rigtige penge
flyttes. Brug Stripes testkort til at simulere en betaling:

- Kortnummer: `4242 4242 4242 4242`
- Udløbsdato: en vilkårlig fremtidig dato (f.eks. 12/34)
- CVC: hvilke som helst 3 tal
- Postnummer: hvilke som helst tal

Når du er klar til rigtige betalinger, skifter du bare "Test mode" fra i Stripe,
henter dine **live** nøgler (`sk_live_...` og `whsec_...` fra en ny live-webhook),
og opdaterer de samme to environment variables i Netlify.

## Hvis noget ikke virker

- **"STRIPE_SECRET_KEY mangler"** når du opretter et link → du har ikke sat
  environment variablen, eller har ikke redeployet efter du satte den.
- **Betaling går igennem, men dukker ikke op i `/kunder.html`** → tjek at
  webhook-endpointet er korrekt, og at `STRIPE_WEBHOOK_SECRET` er sat. I Stripe
  under **Developers → Webhooks** kan du se om events blev leveret (grøn) eller
  fejlede (rød), og se fejlbeskeden.
