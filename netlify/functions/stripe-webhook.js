// Modtager webhook-events fra Stripe. Når en betaling er gennemført,
// gemmes kunden i Netlify Blobs ("databasen"), så /kunder.html kan vise den.
// Beløbene læses fra session.metadata (engangsbeloeb / maanedligbeloeb), som
// create-payment-link.js sætter da linket blev oprettet.
// Stripe sender selv en e-mail til dig, hvis du har slået det til i
// Dashboard > Settings > Notifications (se instruktionerne).

const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Kun POST er tilladt' };
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return { statusCode: 500, body: 'Mangler STRIPE_SECRET_KEY eller STRIPE_WEBHOOK_SECRET' };
  }

  const stripe = Stripe(secretKey);
  const signature = event.headers['stripe-signature'];

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, signature, webhookSecret);
  } catch (err) {
    return { statusCode: 400, body: `Webhook-signatur fejlede: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const metadata = session.metadata || {};

    const record = {
      id: session.id,
      navn: metadata.kunde || session.customer_details?.name || 'Ukendt kunde',
      engangsbeloeb: Number(metadata.engangsbeloeb || 0),
      maanedligbeloeb: Number(metadata.maanedligbeloeb || 0),
      valuta: (session.currency || 'dkk').toUpperCase(),
      dato: new Date().toISOString(),
      status: 'betalt'
    };

    try {
      const store = getStore('betalinger');
      const existing = (await store.get('log', { type: 'json', consistency: 'strong' })) || [];
      existing.unshift(record);
      await store.setJSON('log', existing);
    } catch (err) {
      // Log fejlen, men svar stadig 200 til Stripe så den ikke bliver ved med at gensende
      console.error('Kunne ikke gemme betaling i Netlify Blobs:', err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
