// Modtager webhook-events fra Stripe. Når en betaling er gennemført,
// gemmes kunden i Netlify Blobs ("databasen"), så /kunder.html kan vise den.
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

    const record = {
      id: session.id,
      navn: (session.metadata && session.metadata.kunde) || session.customer_details?.name || 'Ukendt kunde',
      beloeb: ((session.amount_total ?? 0) / 100).toFixed(2),
      valuta: (session.currency || 'dkk').toUpperCase(),
      type: (session.metadata && session.metadata.type) || (session.mode === 'subscription' ? 'maaned' : 'engang'),
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
