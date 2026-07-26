// Returnerer listen af betalinger, som stripe-webhook.js har gemt i Netlify Blobs.
// Bruges af public/kunder.html

const { getStore, connectLambda } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Kun GET er tilladt' }) };
  }

  // Kundelisten er følsom data (navne + beløb), så den kræver en hemmelig
  // adgangskode sat som miljøvariablen ADMIN_PASSWORD i Netlify. Koden sendes
  // fra kunder.html som header x-admin-password.
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

  // Funktionen bruger den klassiske "Lambda-kompatible" handler-syntaks, hvor
  // Netlify Blobs ikke initialiseres automatisk. connectLambda() skal derfor
  // kaldes manuelt med event'et, før getStore() kan bruges.
  connectLambda(event);

  try {
    const store = getStore('betalinger');
    const data = (await store.get('log', { type: 'json' })) || [];
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
