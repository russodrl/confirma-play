import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeQuote, validateQuote } from '../lib/quote.js';

const valid = {
  name: 'Maria Silva',
  phone: '+351 912 345 678',
  email: 'MARIA@EXEMPLO.COM',
  eventType: 'Aniversário infantil',
  eventDate: '2026-12-20',
  guests: 60,
  features: ['Convite digital personalizado', 'Jogo personalizado'],
  theme: 'Espaço',
  notes: '',
  consent: true,
  website: '',
  attribution: { utmSource: 'instagram' }
};

test('sanitizes and validates a complete quote', () => {
  const quote = sanitizeQuote(valid);
  assert.equal(quote.email, 'maria@exemplo.com');
  assert.deepEqual(validateQuote(quote, new Date('2026-08-28T00:00:00Z')), {});
});

test('rejects honeypot, past event and missing consent', () => {
  const quote = sanitizeQuote({ ...valid, website: 'spam.example', eventDate: '2026-01-01', consent: false });
  const errors = validateQuote(quote, new Date('2026-08-28T00:00:00Z'));
  assert.equal(errors.website, 'Envio inválido');
  assert.equal(errors.eventDate, 'A data não pode estar no passado');
  assert.equal(errors.consent, 'Confirme que podemos entrar em contato');
});

test('drops unknown features and rejects an empty selection', () => {
  const quote = sanitizeQuote({ ...valid, features: ['<script>alert(1)</script>'] });
  assert.deepEqual(quote.features, []);
  assert.equal(validateQuote(quote, new Date('2026-08-28T00:00:00Z')).features, 'Escolha pelo menos um recurso');
});
