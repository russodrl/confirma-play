import test from 'node:test';
import assert from 'node:assert/strict';
import { members, findMember } from '../lib/bni-members.js';

test('base BNI UP contém exatamente 27 membros únicos', () => {
  assert.equal(members.length, 27);
  assert.equal(new Set(members.map((member) => member.slug)).size, 27);
  assert.equal(new Set(members.map((member) => member.name.toLocaleLowerCase('pt-PT'))).size, 27);
});

test('cada membro tem identidade empresarial e conteúdo personalizado', () => {
  for (const member of members) {
    assert.match(member.slug, /^[a-z0-9-]+$/);
    assert.ok(member.name.length >= 3);
    assert.ok(member.company.length >= 2);
    assert.ok(member.profession.length >= 3);
    assert.ok(member.personalized.headline.length >= 8);
    assert.ok(member.personalized.summary.length >= 20);
    assert.ok(Array.isArray(member.personalized.opportunities));
    assert.ok(member.personalized.opportunities.length >= 2);
    assert.ok(Array.isArray(member.keywords));
    assert.ok(member.keywords.length >= 2);
    assert.ok(Array.isArray(member.sources));
  }
});

test('cada perfil contém auditoria de palavra-chave e website com estado verificável', () => {
  const allowedWebsiteStates = new Set(['acessivel', 'sem-site-publicado', 'leitura-inconclusiva']);
  for (const member of members) {
    assert.ok(member.discoverability.keyword.length >= 3);
    assert.ok(member.discoverability.position === null || Number.isInteger(member.discoverability.position));
    assert.ok(allowedWebsiteStates.has(member.websiteAudit.status));
    assert.ok(Array.isArray(member.competitors));
    for (const competitor of member.competitors) {
      assert.ok(competitor.name.length >= 2);
      assert.match(competitor.url, /^https?:\/\//);
      assert.doesNotMatch(competitor.url, /bninl\.com|starofservice|habitissimo|wikipedia/i);
    }
  }
});

test('base pública não contém telefone nem e-mail da folha', () => {
  const serialized = JSON.stringify(members);
  assert.doesNotMatch(serialized, /\b\+?351\s?\d{3}\s?\d{3}\s?\d{3}\b/);
  assert.doesNotMatch(serialized, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
});

test('login encontra membros da base oficial por nome e empresa sem depender de acentos', () => {
  assert.equal(findMember('Aleksander Palamarczuk', 'Digital Roots Lab')?.slug, 'aleksander-palamarczuk');
  assert.equal(findMember('vitor rocha', 'Vitor e Rui Construção civil, lda')?.slug, 'vitor-rocha');
  assert.equal(findMember('  FÁTIMA   OLIVEIRA ', '  FATYBRINDE ')?.slug, 'fatima-oliveira');
  assert.equal(findMember('Pessoa inexistente', 'Empresa inexistente'), null);
});
