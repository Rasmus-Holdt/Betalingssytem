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

  if (!navn) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kundenavn mangler.' }) };
  }
  if (Number.isNaN(engangsbeloeb) || engangsbeloeb < 0 || Number.isNaN(maanedligbeloeb) || maanedligbeloeb < 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Beløbene skal være positive tal.' }) };
  }
  if (engangsbeloeb <= 0 && maanedligbeloeb <= 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Udfyld mindst ét beløb (engangsbeløb eller månedligt beløb).' }) };
  }

  const stripe = Stripe(secretKey);

  // Netlify sætter altid URL til det aktive site (både prod og deploy-previews)
  const siteUrl = process.env.URL || `https://${event.headers.host}`;

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

  const harMaanedlig = maanedligbeloeb > 0;

  if (harMaanedlig) {
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
      maanedligbeloeb: String(maanedligbeloeb)
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
