import {config} from './catalog.js';
const el = id => document.getElementById(id);
const money = cents => new Intl.NumberFormat('en-US',{style:'currency',currency:config.currency}).format(cents / 100);
const products = new Map([...config.bundles,...config.addons].map(item=>[item.id,item]));
const bag = new Map();
try {
  for (const [id,qty] of JSON.parse(localStorage.getItem('lumina-bag') || '[]')) {
    if (products.has(id) && Number.isInteger(qty) && qty > 0 && qty <= 99) bag.set(id,qty);
  }
} catch {}
let selected = config.bundles[0], quantity = 1;
const extras = new Set();
const discount = item => Number(((1 - item.cents / item.compareCents) * 100).toFixed(1));
el('bundle-currency').textContent = config.currency;
function renderSelection() {
  const total = selected.cents * quantity + [...extras].reduce((sum,id)=>sum+products.get(id).cents,0);
  el('price').textContent = money(selected.cents);
  el('compare-price').textContent = money(selected.compareCents);
  el('savings').textContent = 'Save ' + money(selected.compareCents - selected.cents);
  el('discount').textContent = '−' + discount(selected) + '%';
  el('qty').textContent = quantity;
  el('minus').disabled = quantity === 1;
  el('plus').disabled = quantity === 99;
  el('kit-name').textContent = selected.title;
  el('kit-description').textContent = selected.description;
  el('kit-price').textContent = money(selected.cents);
  el('sticky-price').textContent = money(selected.cents);
  el('add').lastElementChild.textContent = money(total)+' →';
  document.querySelectorAll('[data-kit]').forEach(button=>{
    const active = button.dataset.kit === selected.id;
    button.classList.toggle('selected',active);
    button.setAttribute('aria-pressed',active);
  });
}
for (const item of config.bundles) {
  for (const target of ['options','kit-options']) {
    const button = document.createElement('button');
    button.dataset.kit = item.id;
    const rings = document.createElement('span');
    rings.className = 'bundle-rings';
    for (let tree = 0; tree < item.trees; tree++) {
      const image = document.createElement('img');
      image.src = 'A1.webp';
      image.alt = '';
      rings.append(image);
    }
    if (target === 'options') {
      const title = document.createElement('strong');
      title.textContent = item.title.toUpperCase();
      const badge = document.createElement('span');
      badge.className = 'bundle-badge';
      badge.textContent = item.badge;
      const price = document.createElement('b');
      price.textContent = money(item.cents);
      const compare = document.createElement('del');
      compare.textContent = money(item.compareCents);
      const savings = document.createElement('small');
      savings.textContent = 'Save ' + discount(item) + '%';
      const indicator = document.createElement('span');
      indicator.className = 'bundle-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      button.append(badge, rings, title, price, compare, savings);
      if (item.trees > 1) {
        const detail = document.createElement('small');
        detail.className = 'bundle-detail';
        const single = config.bundles.find(bundle => bundle.trees === 1);
        detail.textContent = item.trees === 2
          ? 'Save ' + money(single.cents * item.trees - item.cents) + ' vs. buying separately'
          : 'Only ' + money(item.cents / item.trees) + ' per tree';
        button.append(detail);
      }
      button.append(indicator);
    } else button.append(rings, item.title);
    button.onclick = ()=>{selected=item; renderSelection();};
    el(target).append(button);
  }
}
const arrivalFormat = new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric'});
function renderArrival(today = new Date()) {
  const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const last = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 12);
  el('arrival').textContent = arrivalFormat.formatRange(first, last);
}
renderArrival();
setInterval(renderArrival, 60_000);
addEventListener('focus', () => renderArrival());

for (const item of config.addons) {
  const row = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type='checkbox';
  checkbox.onchange=()=>{if (checkbox.checked) extras.add(item.id); else extras.delete(item.id); renderSelection();};
  row.className = 'shipping-addon';
  const copy = document.createElement('span');
  const title = document.createElement('strong');
  const icon = document.createElement(item.thumbnail ? 'img' : 'span');
  icon.setAttribute('aria-hidden', 'true');
  if (item.thumbnail) {
    icon.className = 'addon-thumbnail';
    icon.src = item.thumbnail;
    icon.alt = '';
  } else {
    icon.textContent = item.icon + ' ';
  }
  title.append(icon, item.title);
  const description = document.createElement('small');
  description.textContent = item.description;
  copy.append(title, description);
  const price = document.createElement('strong');
  price.textContent = '+' + money(item.cents);
  row.append(checkbox, copy, price);
  el('addons').append(row);
}
el('minus').onclick=()=>{quantity=Math.max(1,quantity-1);renderSelection();};
el('plus').onclick=()=>{quantity=Math.min(99,quantity+1);renderSelection();};
el('market-note').textContent=config.preview?'Preview pricing · USD.':'Prices shown in '+config.currency+'.';
function renderBag() {
  try { localStorage.setItem('lumina-bag',JSON.stringify([...bag])); } catch {}
  const lines=el('lines');
  lines.replaceChildren();
  let subtotal=0, count=0;
  for (const [id,qty] of bag) {
    const item=products.get(id);
    subtotal+=item.cents*qty;
    count+=qty;
    const row=document.createElement('div');
    row.className='line';
    const label=document.createElement('div');
    label.textContent=item.title;
    const price=document.createElement('small');
    price.textContent=money(item.cents*qty);
    label.append(price);
    const controls=document.createElement('div');
    for (const [text,description,value] of [['−','Decrease',qty-1],['+','Increase',qty+1],['×','Remove',0]]) {
      const button=document.createElement('button');
      button.textContent=text;
      button.setAttribute('aria-label',description+' '+item.title);
      button.disabled=value>99;
      button.onclick=()=>{if(value)bag.set(id,value);else bag.delete(id);renderBag();};
      controls.append(button);
      if(text==='−') controls.append(' '+qty+' ');
    }
    row.append(label,controls);
    lines.append(row);
  }
  if (!count) lines.textContent='Your bag is empty.';
  el('count').textContent=count;
  el('subtotal').textContent=money(subtotal);
  el('checkout').disabled=!count;
}
function addItem(id,qty) {bag.set(id,Math.min(99,(bag.get(id)||0)+qty));}
function openBag() {
  renderBag();
  el('checkout-status').textContent='';
  if (!el('bag').open) el('bag').showModal();
}
const currentItems=()=>[[selected.id,quantity],...[...extras].map(id=>[id,1])];
el('add').onclick=()=>{currentItems().forEach(([id,qty])=>addItem(id,qty));openBag();};
const solarPanel = products.get('solar');
el('solar-price').textContent = money(solarPanel.cents);
el('solar-add').onclick = () => {addItem(solarPanel.id, 1); openBag();};
el('kit-add').onclick=()=>{addItem(selected.id,1);openBag();};
el('open-bag').onclick=openBag;
el('checkout').onclick = () => {
  location.assign('./checkout/?source=bag');
};
el('buy').onclick = () => {
  const items = new URLSearchParams();
  for (const [id, qty] of currentItems()) items.append(id, qty);
  location.assign('./checkout/?' + items);
};
addEventListener('pageshow', event => {
  if (event.persisted) location.reload();
});
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>el(button.dataset.close).close());
el('menu').onclick=()=>el('menu').setAttribute('aria-expanded',el('nav').classList.toggle('open'));
el('nav').querySelectorAll('a').forEach(link=>link.onclick=()=>{el('nav').classList.remove('open');el('menu').setAttribute('aria-expanded','false');});
const pictures=[
  ['A1.webp','Modular LED lighting ring'],
  ['A2.webp','LED lighting ring with ground stakes'],
  ['A3.webp','Palm tree illuminated from below'],
  ['A4.webp','Lighting modules around a palm trunk'],
  ['A5.webp','Illuminated red maple tree'],
  ['A6.webp','Lighting ring around a maple tree'],
  ['A7.webp','Illuminated olive tree'],
  ['A8.webp','Lighting modules around an olive trunk'],
  ['A9.webp','Warm tree lighting with a phone colour selector']
];
let imageIndex=0;
function selectImage(index) {
  imageIndex=(index+pictures.length)%pictures.length;
  const [src,alt]=pictures[imageIndex];
  el('gallery-image').src=src;
  el('gallery-image').alt=alt;
  el('caption').textContent=alt;
  Array.from(el('thumbs').children).forEach((button,i)=>{
    button.classList.toggle('selected',i===imageIndex);
    button.setAttribute('aria-pressed',i===imageIndex);
  });
}
pictures.forEach(([src,alt],i)=>{
  const button=document.createElement('button');
  const img=document.createElement('img');
  img.src=src;img.alt='';img.loading='lazy';
  button.setAttribute('aria-label',alt);
  button.append(img);
  button.onclick=()=>selectImage(i);
  el('thumbs').append(button);
});
el('prev').onclick=()=>selectImage(imageIndex-1);
el('next').onclick=()=>selectImage(imageIndex+1);
let touchStart;
el('zoom').addEventListener('touchstart',event=>{touchStart=event.changedTouches[0].clientX;},{passive:true});
el('zoom').addEventListener('touchend',event=>{
  const delta=event.changedTouches[0].clientX-touchStart;
  if(Math.abs(delta)>50)selectImage(imageIndex+Math.sign(-delta));
},{passive:true});
el('zoom').onclick=()=>{
  const [src,alt]=pictures[imageIndex];
  el('large-image').src=src;el('large-image').alt=alt;
  el('lightbox').showModal();
};
const looks=[
  ['Maple','Let the light catch the branches.'],
  ['Olive','Bring the texture of the trunk into view.'],
  ['Palm','Give a tall silhouette a place in the night garden.']
];
looks.forEach(([name,copy],i)=>{
  const button=document.createElement('button');
  button.textContent=name.toUpperCase();
  button.onclick=()=>{
    el('look-image').src='look-'+name.toLowerCase()+'.jpg';
    el('look-image').alt=name+' tree in a garden';
    el('look-copy').textContent=copy;
    [...el('looks').children].forEach(choice=>{
      choice.classList.toggle('selected',choice===button);
      choice.setAttribute('aria-pressed',choice===button);
    });
  };
  el('looks').append(button);
  if(i===0)button.click();
});
if (config.campaign) {
  const end=Date.parse(config.campaign.endsAt);
  const tick=()=>{
    const seconds=Math.max(0,Math.floor((end-Date.now())/1000));
    el('timer').hidden=!seconds;
    if (!seconds) {
      el('campaign-title').textContent='A NEW LIGHT FOR YOUR GARDEN.';
      el('campaign-copy').textContent='Start with one tree or plan the whole garden.';
      return;
    }
    el('campaign-title').textContent=config.campaign.title;
    el('campaign-copy').textContent=config.campaign.copy;
    el('timer').textContent=[Math.floor(seconds/86400)+'d',Math.floor(seconds/3600)%24+'h',Math.floor(seconds/60)%60+'m',seconds%60+'s'].join('  ');
  };
  tick();setInterval(tick,1000);
}
function sticky() {
  el('sticky').hidden=el('shop').getBoundingClientRect().bottom>0;
}
addEventListener('scroll',sticky,{passive:true});
addEventListener('resize',sticky);
sticky();selectImage(0);renderSelection();renderBag();
