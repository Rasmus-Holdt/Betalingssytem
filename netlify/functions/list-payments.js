// Returnerer listen af betalinger, som stripe-webhook.js har gemt i Netlify Blobs.
// Bruges af public/kunder.html

const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Kun GET er tilladt' }) };
  }

  // Funktionen bruger den klassiske "Lambda-kompatible" handler-syntaks, hvor
  // Netlify Blobs ikke initialiseres automatisk. connectLambda() skal derfor
  // kaldes manuelt med event'et, før getStore() kan bruges.
  connectLambda(event);

  try {
    const store = getStore('betalinger');
    const data = (await store.get('log', { type: 'json', consistency: 'strong' })) || [];
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Kunne ikke hente betalinger' })
    };
  }
};
