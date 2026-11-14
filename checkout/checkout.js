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
const pay = byId('pay');
const status = byId('payment-status');
const configured = Boolean(config.checkoutEndpoint && !config.preview);
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

if (!configured) {
  pay.disabled = true;
  status.textContent = 'Payment is currently unavailable.';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!configured || !items.size || pay.disabled) return;
  pay.disabled = true;
  status.textContent = 'Opening Stripe Checkout…';
  const { email, firstName, lastName, company, phone, ...address } = Object.fromEntries(new FormData(form));
  try {
    const response = await fetch(config.checkoutEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [...items].map(([id, quantity]) => ({ id, quantity })),
        email,
        shipping: { firstName, lastName, company, phone, address: { ...address, country: 'US' } }
      })
    });
    if (!response.ok) throw new Error('Checkout unavailable');
    const { url } = await response.json();
    const stripe = new URL(url);
    if (stripe.origin !== 'https://checkout.stripe.com') throw new Error('Invalid checkout URL');
    location.assign(stripe.href);
  } catch {
    status.textContent = 'Payment could not start. Please try again.';
    pay.disabled = false;
  }
});

addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
