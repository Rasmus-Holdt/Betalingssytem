// Opretter et Stripe Checkout-link. Kan indeholde et engangsbeløb og/eller
// et månedligt beløb i samme link – de bliver samlet i ÉN regning/session:
// engangsbeløbet opkræves med det samme, det månedlige beløb starter en
// tilbagevendende betaling. Det matcher fx "Hjemmeside 500 kr. engang +
// 200 kr. om måneden" på én samlet regning.
// Kaldes af public/index.html via POST /.netlify/functions/create-payment-link

const Stripe = require('stripe');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Kun POST er tilladt' }) };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'STRIPE_SECRET_KEY mangler i Netlify-miljøvariablerne.' })
    };
  }

  // Linkgeneratoren er kun til dig selv, så den kræver samme adgangskode som
  // kundelisten (ADMIN_PASSWORD i Netlify), sendt fra index.html som header
  // x-admin-password. Det forhindrer at andre end dig kan oprette
  // betalingslinks under din Stripe-konto.
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ADMIN_PASSWORD mangler i Netlify-miljøvariablerne.' })
    };
  }
  const givenPassword = event.headers['x-admin-password'] || '';
  if (givenPassword !== adminPassword) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Forkert adgangskode.' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig data fra formularen.' }) };
  }

  const navn = (payload.navn || '').toString().trim();

  const toAmount = (val) => {
    if (val === '' || val === undefined || val === null) return 0;
    return Number(val);
  };

  const engangsbeloeb = toAmount(payload.engangsbeloeb);
  const maanedligbeloeb = toAmount(payload.maanedligbeloeb);
  const proeveperiodeDage = Math.round(toAmount(payload.proeveperiodeDage));

  if (!navn) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kundenavn mangler.' }) };
  }
  if (Number.isNaN(engangsbeloeb) || engangsbeloeb < 0 || Number.isNaN(maanedligbeloeb) || maanedligbeloeb < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Beløbene skal være positive tal.' }) };
  }
  if (Number.isNaN(proeveperiodeDage) || proeveperiodeDage < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prøveperiode skal være et positivt antal dage.' }) };
  }

  // Ekstra poster: fritvalgte, navngivne beløb du selv opretter i formularen
  // ("+ Tilføj felt"). Hver post er enten et engangsbeløb eller en månedlig
  // tilbagevendende betaling, ligesom de faste felter ovenfor.
  const ekstraPosterRaw = Array.isArray(payload.ekstraPoster) ? payload.ekstraPoster : [];
  const ekstraPoster = [];
  for (const raw of ekstraPosterRaw) {
    const itemNavn = ((raw && raw.navn) || '').toString().trim();
    if (!itemNavn) continue; // spring tomme rækker over
    const itemBeloeb = toAmount(raw && raw.beloeb);
    if (Number.isNaN(itemBeloeb) || itemBeloeb <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: `Beløbet for "${itemNavn}" skal være et positivt tal.` }) };
    }
    const itemType = (raw && raw.type === 'maanedlig') ? 'maanedlig' : 'engang';
    ekstraPoster.push({ navn: itemNavn, beloeb: itemBeloeb, type: itemType });
  }

  if (engangsbeloeb <= 0 && maanedligbeloeb <= 0 && ekstraPoster.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Udfyld mindst ét beløb (engangsbeløb, månedligt beløb, eller en ekstra post).' }) };
  }

  const stripe = Stripe(secretKey);

  // Netlify sætter altid URL til det aktive site (både prod og deploy-previews)
  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  // "harMaanedlig" tæller også ekstra poster af typen "maanedlig", fordi
  // Stripe kræver mode "subscription" så snart ÉT eneste linje-item i
  // sessionen er tilbagevendende – uanset om det er det faste månedlige
  // felt eller en af de brugerdefinerede ekstra poster.
  const harMaanedlig = maanedligbeloeb > 0 || ekstraPoster.some((item) => item.type === 'maanedlig');

  const lineItems = [];

  if (engangsbeloeb > 0) {
    lineItems.push({
      price_data: {
        currency: 'dkk',
        product_data: { name: `Engangsbeløb – ${navn}` },
        unit_amount: Math.round(engangsbeloeb * 100) // øre
      },
      quantity: 1
    });
  }

  if (maanedligbeloeb > 0) {
    lineItems.push({
      price_data: {
        currency: 'dkk',
        product_data: { name: `Månedlig betaling – ${navn}` },
        unit_amount: Math.round(maanedligbeloeb * 100), // øre
        recurring: { interval: 'month' }
      },
      quantity: 1
    });
  }

  ekstraPoster.forEach((item) => {
    const priceData = {
      currency: 'dkk',
      product_data: { name: `${item.navn} – ${navn}` },
      unit_amount: Math.round(item.beloeb * 100) // øre
    };
    if (item.type === 'maanedlig') {
      priceData.recurring = { interval: 'month' };
    }
    lineItems.push({ price_data: priceData, quantity: 1 });
  });

  // Stripe kræver mode "subscription" så snart der er et tilbagevendende
  // beløb med i kurven – et evt. engangsbeløb bliver så lagt på samme
  // (første) faktura som opstart/setup-gebyr. Er der kun et engangsbeløb,
  // bruger vi almindelig "payment"-mode.
  const sessionParams = {
    mode: harMaanedlig ? 'subscription' : 'payment',
    line_items: lineItems,
    success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: {
      kunde: navn,
      engangsbeloeb: String(engangsbeloeb),
      maanedligbeloeb: String(maanedligbeloeb),
      ekstraPoster: ekstraPoster.length ? JSON.stringify(ekstraPoster) : ''
    },
    // Nogle Stripe-konti har "Managed Payments" slået til som standard.
    // Det gør Stripe/Link til "merchant of record" (kvitteringer, kundesupport
    // og kontoudtog vises som "LINK.COM*"), hvilket ikke passer til direkte
    // fakturering af egne kunder. Vi slår det derfor fra her.
    managed_payments: { enabled: false }
  };

  if (!harMaanedlig) {
    // customer_creation er kun tilladt i "payment"-mode, ikke "subscription"
    // (Stripe opretter altid en kunde selv når der er et abonnement med).
    sessionParams.customer_creation = 'always';
  } else if (proeveperiodeDage > 0) {
    // Gratis prøveperiode gælder kun det månedlige/tilbagevendende beløb.
    // Et evt. engangsbeløb i samme kurv bliver stadig opkrævet med det samme
    // ved checkout – prøveperioden udskyder kun den første abonnementsfaktura.
    sessionParams.subscription_data = { trial_period_days: proeveperiodeDage };
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams);
    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Stripe-fejl' })
    };
  }
};
