import { config } from '../catalog.js';

const byId = id => document.getElementById(id);
const products = new Map([...config.bundles, ...config.addons].map(item => [item.id, item]));
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: config.currency });
const params = new URLSearchParams(location.search);
const states = 'AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming';

function readItems() {
  let entries = [];
  try {
    entries = params.has('source') || !params.size
      ? JSON.parse(localStorage.getItem('lumina-bag') || '[]')
      : [...params].map(([id, qty]) => [id, Number(qty)]);
  } catch {
    return new Map();
  }
  const items = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!Array.isArray(entry)) continue;
    const [id, qty] = entry;
    if (products.has(id) && Number.isInteger(qty) && qty > 0 && qty <= 99) items.set(id, qty);
  }
  return items;
}

const items = readItems();
const form = byId('checkout-form');
const status = byId('payment-status');
const endpoint = new URL('../api/cooud', location.href);
let subtotal = 0;

for (const [id, quantity] of items) {
  const product = products.get(id);
  const amount = product.cents * quantity;
  subtotal += amount;

  const row = document.createElement('li');
  const thumbnail = document.createElement('div');
  thumbnail.className = 'thumbnail';
  if (product.icon) {
    thumbnail.append(product.icon);
  } else {
    const image = document.createElement('img');
    image.src = '../' + (product.thumbnail || 'A1.webp');
    image.alt = '';
    thumbnail.append(image);
  }
  const count = document.createElement('span');
  count.textContent = quantity;
  count.setAttribute('aria-label', 'Quantity: ' + quantity);
  thumbnail.append(count);
  const title = document.createElement('span');
  title.textContent = product.title;
  const price = document.createElement('strong');
  price.textContent = money.format(amount / 100);
  row.append(thumbnail, title, price);
  byId('items').append(row);
}

byId('subtotal').textContent = money.format(subtotal / 100);
byId('total').textContent = money.format(subtotal / 100);
form.hidden = items.size === 0;
byId('empty').hidden = items.size > 0;

for (const state of states.split('|')) {
  const [code, name] = state.split(':');
  byId('state').add(new Option(name, code));
}

let sdkPromise;
let lastBody;
let attemptId;

function loadElements() {
  sdkPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.cooud.com/cdn/elements/v1.js';
    script.onload = () => window.__CooudElements__?.mount
      ? resolve(window.__CooudElements__)
      : reject(new Error('Elements unavailable'));
    script.onerror = reject;
    document.head.append(script);
  }).catch(error => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

async function request(payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Payment service unavailable');
  return response.json();
}

let mountTimer;
let loading = false;
let mounted = false;

function schedulePayment() {
  clearTimeout(mountTimer);
  if (!items.size || mounted || loading || !form.matches(':valid')) return;
  mountTimer = setTimeout(preparePayment, 700);
}

async function preparePayment() {
  if (loading || mounted || !form.matches(':valid')) return;
  loading = true;
  status.textContent = 'Loading the secure card form…';
  const fields = Object.fromEntries(new FormData(form));
  const cardStatus = byId('card-status');
  const container = byId('card-form');
  try {
    const sdk = await loadElements();
    const data = {
      fields,
      items: [...items].map(([id, quantity]) => ({ id, quantity })),
      elementsVersion: sdk.version
    };
    const body = JSON.stringify(data);
    if (body !== lastBody) {
      attemptId = crypto.randomUUID();
      lastBody = body;
    }
    const payment = await request({ ...data, attemptId });
    const currentFields = Object.fromEntries(new FormData(form));
    if (JSON.stringify(currentFields) !== JSON.stringify(fields)) {
      loading = false;
      status.textContent = '';
      schedulePayment();
      return;
    }
    for (const input of form.elements) input.disabled = true;
    status.textContent = '';
    await sdk.mount({
      container,
      sessionId: payment.id,
      elementToken: payment.elementToken,
      sessionSecret: payment.sessionSecret,
      appearance: { ...payment.appearance, theme: 'light' },
      apiBaseUrl: 'https://api.cooud.com',
      compatDate: '2026-09-01',
      onSuccess: async () => {
        cardStatus.textContent = 'Checking payment status…';
        try {
          const result = await request({ receipt: payment.receipt });
          cardStatus.textContent = result.paid ? 'Payment confirmed.' : 'Payment confirmation is pending.';
        } catch {
          cardStatus.textContent = 'Payment confirmation is pending.';
        }
      },
      onError: () => {
        cardStatus.textContent = 'Payment could not be confirmed. Check the card form for details.';
      }
    });
    mounted = true;
  } catch {
    container.replaceChildren();
    for (const input of form.elements) input.disabled = false;
    status.textContent = 'The card form is temporarily unavailable. Please try again.';
  }
  loading = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  schedulePayment();
});
form.addEventListener('input', schedulePayment);
form.addEventListener('change', schedulePayment);
addEventListener('pageshow', schedulePayment);
schedulePayment();
