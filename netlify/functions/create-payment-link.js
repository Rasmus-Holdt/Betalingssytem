// Opretter et Stripe Checkout-link ud fra kundenavn, pris og betalingstype.
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
  const pris = Number(payload.pris);
  const type = payload.type === 'maaned' ? 'maaned' : 'engang';

  if (!navn) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Kundenavn mangler.' }) };
  }
  if (!pris || pris <= 0 || Number.isNaN(pris)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Prisen skal være et positivt tal.' }) };
  }

  const stripe = Stripe(secretKey);

  // Netlify sætter altid URL til det aktive site (både prod og deploy-previews)
  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  const priceData = {
    currency: 'dkk',
    product_data: { name: `Betaling – ${navn}` },
    unit_amount: Math.round(pris * 100) // øre
  };

  if (type === 'maaned') {
    priceData.recurring = { interval: 'month' };
  }

  const sessionParams = {
    mode: type === 'maaned' ? 'subscription' : 'payment',
    line_items: [{ price_data: priceData, quantity: 1 }],
    success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: { kunde: navn, type },
        managed_payments: { enabled: false }
  };

  if (type === 'engang') {
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
