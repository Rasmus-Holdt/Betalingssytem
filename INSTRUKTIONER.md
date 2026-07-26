# Betalingssystem – sådan får du det til at køre

Dette er hele systemet: en formular hvor du taster kundenavn + pris, den laver et
Stripe-betalingslink, kunden betaler, du får en e-mail, og alle betalinger vises
automatisk på en liste (`/kunder.html`) — det er din "database", ingen ekstra
opsætning nødvendig.

Alt koden er lavet. Du skal bare gøre 4 ting, alle i browseren, ingen terminal.

## Hvad er hvad

- `public/index.html` – formularen hvor du opretter et betalingslink (kræver adgangskode)
- `public/kunder.html` – oversigt over alle der har betalt (kræver adgangskode)
- `public/success.html` – siden kunden ser efter betaling, med link til at administrere abonnement
- `netlify/functions/create-payment-link.js` – laver Stripe-linket
- `netlify/functions/stripe-webhook.js` – modtager besked fra Stripe når nogen betaler, gemmer det
- `netlify/functions/list-payments.js` – henter listen til kunder.html
- `netlify/functions/create-portal-session.js` – laver et link til Stripes kundeportal (opsig/se fakturaer)

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

## 4. Beskyt siderne med en adgangskode (2 min)

`index.html` (linkgeneratoren) og `kunder.html` (kundelisten) er kun til dig
selv. Uden en adgangskode kan alle med linket se dine kunder og deres
beløb, så dette trin er vigtigt:

1. På dit site i Netlify: **Site configuration → Environment variables → Add a variable**.
2. Navn: `ADMIN_PASSWORD`, værdi: en adgangskode du selv finder på. Gem.
3. Redeploy (se trin D ovenfor).
4. Gå til `/index.html` eller `/kunder.html` — du bliver nu bedt om
   adgangskoden, før siden viser noget.

## 5. Aktivér Stripes kundeportal (5 min)

Så dine kunder selv kan opsige deres abonnement, skifte betalingskort og se
deres fakturaer — uden at du skal bygge det selv:

1. I Stripe: søg efter **"Customer portal"** i søgefeltet, eller gå til
   **Settings → Billing → Customer portal**.
2. Klik **Activate test link** (eller **Activate link**, hvis du er i live-mode).
3. Vælg hvad kunder må gøre — typisk: opsige abonnement, skifte betalingskort,
   se fakturaer. Gem indstillingerne.
4. Det er alt. Stripe tilføjer nu automatisk et "administrer abonnement"-link
   i de e-mails kunden får (kvitteringer/fakturaer), og din `success.html`
   viser også en knap med det samme efter betaling.

## 6. Slå e-mail-notifikationer til (2 min)

Stripe sender selv e-mails til dig — du skal ikke bygge noget til det:
1. I Stripe: **Settings (tandhjulet) → Profile → Communication preferences** (eller søg "notifications" i søgefeltet).
2. Slå notifikationer til for betalinger.

Du får desuden altid overblikket i **Stripe Dashboard → Payments**.

## Sådan bruger du systemet

1. Gå til `https://dit-site.netlify.app` og log ind med din adgangskode.
2. Skriv kundenavn, og udfyld ét eller begge beløbsfelter:
   - **Engangsbeløb** – opkræves med det samme.
   - **Månedligt beløb** – starter et abonnement.
   - Udfylder du begge, samles de i ét link/én regning (fx "Hjemmeside 500 kr.
     engang + 200 kr. om måneden").
   - **Gratis prøveperiode** (valgfri, kun ved månedligt beløb) – antal dage
     kunden ikke bliver opkrævet det månedlige beløb. Et evt. engangsbeløb i
     samme link bliver stadig opkrævet med det samme, uanset prøveperiode.
3. Klik **Lav betalingslink** → kopiér linket → send det til kunden (SMS, mail, hvad du vil).
4. Kunden betaler via Stripes betalingsside.
5. Du får en e-mail, og betalingen dukker automatisk op på `/kunder.html`.
6. Har betalingen et abonnement, kan kunden med det samme klikke "Administrer
   mit abonnement" på tak-siden, og senere via linket i deres kvittering/faktura
   fra Stripe (se trin 5 ovenfor).

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
- **"ADMIN_PASSWORD mangler"** → du har ikke sat environment variablen, eller
  har ikke redeployet efter du satte den (se trin 4).
- **"Forkert adgangskode"** selvom du er sikker på den er rigtig → tjek for
  mellemrum før/efter i Netlify-værdien, og redeploy igen efter en rettelse.
- **"Administrer mit abonnement"-knappen fejler** → betalingen har muligvis
  kun et engangsbeløb (intet abonnement at administrere), eller Customer
  Portal er ikke aktiveret endnu i Stripe (se trin 5).
