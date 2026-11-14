import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../catalog.js';

const compatDate = '2026-09-01';
const products = new Map([...config.bundles, ...config.addons].map(product => [product.id, product]));
const sessionId = /^cooud_cs_[0-9A-HJKMNP-TV-Z]{26}$/;

function sign(id, key) {
  return createHmac('sha256', key).update('lumina-payment:' + id).digest('hex');
}

async function cooud(path, headers, body) {
  const response = await fetch('https://api.cooud.com/v2' + path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('Cooud request failed');
  return response.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.COOUD_API_KEY;
  const origin = process.env.CHECKOUT_ORIGIN;
  if (!key || !origin) return res.status(503).json({ error: 'Payments unavailable' });
  if (req.headers.origin !== origin) return res.status(403).json({ error: 'Origin not allowed' });
  const headers = {
    Authorization: 'Bearer ' + key,
    'Cooud-Compat-Date': compatDate,
    'Content-Type': 'application/json'
  };
  if (process.env.COOUD_ACCOUNT) headers['Cooud-Account'] = process.env.COOUD_ACCOUNT;

  const { receipt, fields, items, attemptId, elementsVersion } = req.body || {};
  try {
    if (typeof receipt === 'string') {
      const [id, signature, extra] = receipt.split('.');
      if (!sessionId.test(id) || !/^[a-f0-9]{64}$/.test(signature) || extra !== undefined ||
          !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(id, key)))) {
        return res.status(400).json({ error: 'Invalid receipt' });
      }
      const session = await cooud('/checkout-sessions/' + id, headers);
      return res.json({ paid: session.payment_status === 'paid' ||
        (session.payment?.state ?? session.payment?.status) === 'succeeded' });
    }

    const invalid = () => res.status(400).json({ error: 'Invalid checkout details' });
    if (!/^[0-9a-f-]{36}$/.test(attemptId) || !/^\d+\.\d+\.\d+$/.test(elementsVersion) ||
        !fields || !Array.isArray(items) || !items.length || items.length > products.size) return invalid();
    const { email, firstName, lastName, line1, line2 = '', city, state, postalCode, company = '', phone = '' } = fields;
    if (![email, firstName, lastName, line1, city, state, postalCode].every(
      value => typeof value === 'string' && value.trim() && value.length <= 255
    ) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        !/^[A-Z]{2}$/.test(state) || !/^\d{5}(-\d{4})?$/.test(postalCode) ||
        ![line2, company, phone].every(value => typeof value === 'string' && value.length <= 255)) return invalid();

    const lineItems = [];
    const seen = new Set();
    for (const { id, quantity } of items.filter(Boolean)) {
      const product = products.get(id);
      if (!product || seen.has(id) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return invalid();
      seen.add(id);
      lineItems.push({
        name: product.title, amount: product.cents, quantity,
        currency: config.currency.toLowerCase(), delivery: { mode: 'external' }
      });
    }
    if (lineItems.length !== items.length) return invalid();

    const checkout = new URL('/checkout/', origin).href;
    const session = await cooud('/checkout-sessions', { ...headers, 'Idempotency-Key': attemptId }, {
      ui_mode: 'custom',
      success_url: checkout,
      cancel_url: checkout,
      customer_email: email,
      line_items: lineItems,
      metadata: {
        shipping_first_name: firstName, shipping_last_name: lastName, shipping_company: company,
        shipping_address_line1: line1, shipping_address_line2: line2, shipping_city: city,
        shipping_state: state, shipping_zip: postalCode, shipping_country: 'US', shipping_phone: phone
      }
    });
    const amount = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
    if (!sessionId.test(session.id) || session.amount !== amount || session.currency?.toUpperCase() !== config.currency) {
      throw new Error('Unexpected session details');
    }

    const element = await cooud('/checkout-sessions/' + session.id + '/element-config',
      { ...headers, 'Cooud-Elements-Version': elementsVersion }, {});
    if (!element.cooud_element_token || !element.cooud_session_secret) throw new Error('Missing element configuration');
    return res.json({
      id: session.id,
      receipt: session.id + '.' + sign(session.id, key),
      elementToken: element.cooud_element_token,
      sessionSecret: element.cooud_session_secret,
      appearance: element.element?.appearance
    });
  } catch {
    return res.status(502).json({ error: 'Payment service unavailable' });
  }
}
