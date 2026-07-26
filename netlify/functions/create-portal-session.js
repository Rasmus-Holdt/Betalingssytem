// Laver et link til Stripes Customer Portal, hvor en kunde selv kan opsige
// sit abonnement, skifte betalingskort og se sine fakturaer.
// Kaldes af public/success.html lige efter en betaling med abonnement.
//
// Vi tager IKKE imod et Stripe customer-ID direkte fra klienten – det ville
// gøre det muligt for en ondsindet bruger at gætte/indsætte en andens
// customer-ID og få adgang til deres abonnement. I stedet sender klienten
// kun den checkout session_id de selv lige har gennemført, og vi slår
// server-side op i Stripe hvilken kunde den session faktisk tilhører.

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
    return { statusCode: 400, body: JSON.stringify({ error: 'Ugyldig data.' }) };
  }

  const sessionId = (payload.session_id || '').toString().trim();
  if (!sessionId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'session_id mangler.' }) };
  }

  const stripe = Stripe(secretKey);
  const siteUrl = process.env.URL || `https://${event.headers.host}`;

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId);
    const customerId = checkoutSession.customer;

    if (!customerId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Denne betaling har intet abonnement at administrere.' })
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl}/success.html?session_id=${sessionId}`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: portalSession.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Kunne ikke åbne kundeportalen.' })
    };
  }
};
