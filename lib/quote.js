const EVENT_TYPES = new Set([
  'Aniversário infantil',
  'Aniversário adulto',
  'Casamento ou noivado',
  'Chá de bebê ou revelação',
  'Evento familiar',
  'Outro'
]);

const FEATURES = new Set([
  'Convite digital personalizado',
  'Confirmação de presença',
  'Lista de convidados e acompanhantes',
  'Fotos e história',
  'Música original personalizada',
  'Jogo personalizado',
  'Calendário, mapa e lembretes',
  'Outra ideia'
]);

export function clean(value, max = 200) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function sanitizeQuote(body = {}) {
  const features = Array.isArray(body.features)
    ? [...new Set(body.features.map((value) => clean(value, 80)).filter((value) => FEATURES.has(value)))]
    : [];

  return {
    name: clean(body.name, 80),
    phone: clean(body.phone, 30),
    email: clean(body.email, 120).toLowerCase(),
    eventType: clean(body.eventType, 60),
    eventDate: clean(body.eventDate, 10),
    guests: Number(body.guests),
    features,
    theme: clean(body.theme, 500),
    notes: clean(body.notes, 1000),
    consent: body.consent === true,
    website: clean(body.website, 120),
    attribution: {
      utmSource: clean(body.attribution?.utmSource, 100),
      utmMedium: clean(body.attribution?.utmMedium, 100),
      utmCampaign: clean(body.attribution?.utmCampaign, 150),
      utmContent: clean(body.attribution?.utmContent, 150),
      referrer: clean(body.attribution?.referrer, 500),
      landingPage: clean(body.attribution?.landingPage, 500)
    }
  };
}

export function validateQuote(quote, now = new Date()) {
  const errors = {};
  if (quote.website) errors.website = 'Envio inválido';
  if (quote.name.length < 2) errors.name = 'Informe seu nome';
  if (quote.phone.replace(/\D/g, '').length < 8) errors.phone = 'Informe um WhatsApp válido';
  if (quote.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quote.email)) errors.email = 'Informe um e-mail válido';
  if (!EVENT_TYPES.has(quote.eventType)) errors.eventType = 'Escolha o tipo de evento';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(quote.eventDate)) {
    errors.eventDate = 'Escolha a data do evento';
  } else {
    const selected = new Date(`${quote.eventDate}T23:59:59Z`);
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (Number.isNaN(selected.getTime()) || selected < today) errors.eventDate = 'A data não pode estar no passado';
  }
  if (!Number.isInteger(quote.guests) || quote.guests < 1 || quote.guests > 5000) errors.guests = 'Informe uma quantidade entre 1 e 5000';
  if (quote.features.length < 1) errors.features = 'Escolha pelo menos um recurso';
  if (!quote.consent) errors.consent = 'Confirme que podemos entrar em contato';
  return errors;
}
