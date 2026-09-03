const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav-links');
const quoteForm = document.querySelector('#quoteForm');
const quoteStatus = document.querySelector('#quoteStatus');

const setHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 18);
setHeader();
window.addEventListener('scroll', setHeader, { passive: true });

menuButton?.addEventListener('click', () => {
  const open = nav?.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(Boolean(open)));
});

document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    nav?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('[data-feature-link]').forEach((link) => {
  link.addEventListener('click', () => {
    const wanted = link.dataset.featureLink;
    const feature = [...(quoteForm?.elements.features || [])].find((input) => input.value === wanted);
    if (feature) feature.checked = true;
  });
});

const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
  document.documentElement.classList.add('reveal-ready');
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

document.querySelectorAll('.faq-item button').forEach((button) => {
  button.addEventListener('click', () => {
    const item = button.closest('.faq-item');
    const open = item.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(open));
  });
});

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

const eventDate = quoteForm?.elements.eventDate;
if (eventDate) eventDate.min = new Date().toISOString().slice(0, 10);

function clearErrors() {
  quoteForm?.querySelectorAll('[aria-invalid="true"]').forEach((field) => field.removeAttribute('aria-invalid'));
  quoteForm?.querySelector('.feature-options')?.classList.remove('is-invalid');
  quoteForm?.querySelectorAll('[data-error-for]').forEach((error) => { error.textContent = ''; });
}

function showErrors(errors = {}) {
  Object.entries(errors).forEach(([name, message]) => {
    const field = quoteForm?.elements[name];
    if (field && 'setAttribute' in field) field.setAttribute('aria-invalid', 'true');
    if (name === 'features') quoteForm?.querySelector('.feature-options')?.classList.add('is-invalid');
    const target = quoteForm?.querySelector(`[data-error-for="${name}"]`);
    if (target) target.textContent = message;
  });
  const first = quoteForm?.querySelector('[aria-invalid="true"], .feature-options.is-invalid input');
  first?.focus();
}

quoteForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors();
  quoteStatus.className = 'form-status';
  quoteStatus.textContent = 'Enviando sua cotação...';

  const formData = new FormData(quoteForm);
  const params = new URLSearchParams(window.location.search);
  const payload = {
    name: formData.get('name'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    eventType: formData.get('eventType'),
    eventDate: formData.get('eventDate'),
    guests: Number(formData.get('guests')),
    features: formData.getAll('features'),
    theme: formData.get('theme'),
    notes: formData.get('notes'),
    website: formData.get('website'),
    consent: formData.get('consent') === 'on',
    attribution: {
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmContent: params.get('utm_content') || '',
      referrer: document.referrer || 'direct',
      landingPage: window.location.href
    }
  };

  const submitButton = quoteForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  try {
    const response = await fetch('/api/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      showErrors(result.fields);
      throw new Error(result.error || 'Não foi possível enviar a cotação');
    }
    quoteForm.classList.add('is-success');
    quoteStatus.classList.add('is-success');
    quoteStatus.textContent = `Pedido ${result.id} recebido. Vamos entrar em contato para alinhar sua Confirma Play.`;
  } catch (error) {
    quoteStatus.classList.add('is-error');
    quoteStatus.textContent = error.message || 'Não foi possível enviar agora. Tente novamente em instantes.';
    submitButton.disabled = false;
  }
});