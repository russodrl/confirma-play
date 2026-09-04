import { members, findMember, findMemberByName } from './members.js';
import { BNIGame } from './game.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const params = new URLSearchParams(location.search);
const DEMO = params.get('demo') === '1';
const PRESENTER = params.get('presenter') === '1';
const FINAL_URL = 'https://confirmaplay.com/bni-up-4-setembro/';
const phaseBySlide = ['lobby', 'presentation', 'presentation', 'presentation', 'personalized', 'presentation', 'game', 'game', 'podium'];

const entryGate = $('#entryGate');
const presenterGate = $('#presenterGate');
const experience = $('#experience');
const memberSelect = $('#memberSelect');
const companyInput = $('#companyInput');
const joinForm = $('#joinForm');
const joinError = $('#joinError');
const participantBadge = $('#participantBadge');
const syncStatus = $('#syncStatus');
const presenterControls = $('#presenterControls');
const questionDialog = $('#questionDialog');
const startGameButton = $('#startGameButton');
const jumpButton = $('#jumpButton');
const gameLocked = $('#gameLocked');
const gameResult = $('#gameResult');
const canvas = $('#bniGame');

let currentMember = null;
let participantToken = null;
let presenterPin = null;
let game = null;
let gameStarted = false;
let state = { slide: 0, phase: 'lobby', gameOpen: false, version: 0, updatedAt: null };
let ranking = [];
let pollTimer = null;
let pollInFlight = false;
let consecutivePollFailures = 0;
const POLL_INTERVAL_MS = 1_000;
const POLL_RETRY_MS = 500;
const SYNC_FAILURE_THRESHOLD = 3;

function setSync(mode, text) {
  syncStatus.dataset.state = mode;
  syncStatus.lastChild.textContent = ` ${text}`;
}

function memberBySlug(slug) {
  return members.find((member) => member.slug === slug) || null;
}

function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function appendLink(container, label, url) {
  if (!url) return;
  const link = createNode('a', '', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener';
  container.append(link);
}

function populateMembers() {
  const memberOptions = $('#memberOptions');
  const companyOptions = $('#companyOptions');
  members.forEach((member) => {
    const nameOption = document.createElement('option');
    nameOption.value = member.name;
    nameOption.label = member.company;
    memberOptions.append(nameOption);
    const companyOption = document.createElement('option');
    companyOption.value = member.company;
    companyOption.label = member.name;
    companyOptions.append(companyOption);
  });
}

memberSelect.addEventListener('input', () => {
  const member = findMemberByName(memberSelect.value);
  if (member) companyInput.value = member.company;
});

function playerId() {
  let value = localStorage.getItem('bniUpPlayerId');
  if (!value) {
    value = `p_${crypto.randomUUID().replaceAll('-', '')}`;
    localStorage.setItem('bniUpPlayerId', value);
  }
  return value;
}

async function api(body, headers = {}) {
  const response = await fetch('/api/bni-live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Não foi possível concluir a operação');
  return payload;
}

function showExperience(member) {
  currentMember = member;
  entryGate.hidden = true;
  presenterGate.hidden = true;
  experience.hidden = false;
  participantBadge.replaceChildren(
    createNode('strong', '', member.name),
    createNode('small', '', member.company)
  );
  renderPersonalized(member);
  initializeGame(member);
  applyState(state);
  if (!DEMO) startPolling();
  else setSync('online', 'Modo demonstração');
}

joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  joinError.hidden = true;
  let member = findMember(memberSelect.value, companyInput.value);
  if (!member) {
    joinError.textContent = 'Não encontramos essa combinação. Confira seu nome e sua empresa ou escolha uma das sugestões.';
    joinError.hidden = false;
    return;
  }
  $('#joinButton').disabled = true;
  try {
    if (DEMO) {
      participantToken = 'demo';
    } else {
      const payload = await api({ action: 'register', name: memberSelect.value, company: companyInput.value, playerId: playerId() });
      participantToken = payload.token;
      localStorage.setItem('bniUpParticipantToken', participantToken);
      localStorage.setItem('bniUpMemberSlug', member.slug);
      member = memberBySlug(payload.member.slug) || member;
    }
    showExperience(member);
  } catch (error) {
    joinError.textContent = error.message;
    joinError.hidden = false;
  } finally {
    $('#joinButton').disabled = false;
  }
});

function renderPersonalized(member) {
  const root = $('#personalizedContent');
  root.replaceChildren();
  const card = createNode('div', 'personal-card');
  const main = createNode('article', 'personal-main');
  main.append(
    createNode('div', 'member-kicker', member.profession),
    createNode('h2', '', member.name),
    createNode('p', 'company-line', member.company),
    createNode('p', 'personal-headline', member.personalized.headline),
    createNode('p', 'personal-summary', member.personalized.summary)
  );
  const opportunities = createNode('ul', 'opportunity-list');
  member.personalized.opportunities.forEach((text) => opportunities.append(createNode('li', '', text)));
  main.append(opportunities);

  const audit = createNode('aside', 'audit-panel');
  audit.append(createNode('p', 'audit-label', 'Palavra-chave testada'), createNode('div', 'keyword-chip', member.discoverability.keyword));
  const searchResult = createNode('div', 'search-result');
  searchResult.append(
    createNode('strong', '', member.discoverability.position ? `Apareceu na posição ${member.discoverability.position}` : 'Não apareceu entre os 10 resultados'),
    createNode('span', '', member.discoverability.note)
  );
  audit.append(searchResult, createNode('p', 'audit-label', 'Presença publicada no BNI'));
  const presence = createNode('div', 'presence-row');
  appendLink(presence, 'Website', member.presence.website);
  appendLink(presence, 'Instagram', member.presence.instagram);
  appendLink(presence, 'Facebook', member.presence.facebook);
  appendLink(presence, 'LinkedIn', member.presence.linkedin);
  appendLink(presence, 'YouTube', member.presence.youtube);
  appendLink(presence, 'Perfil BNI', member.presence.bni);
  if (!presence.children.length) presence.append(createNode('span', '', 'Nenhum canal ligado'));
  audit.append(presence);
  audit.append(createNode('p', 'audit-label', 'Leitura do website'));
  const website = createNode('div', 'search-result');
  const ownDomain = member.presence.website ? new URL(member.presence.website).hostname.replace(/^www\./, '') : null;
  website.append(createNode('strong', '', member.websiteAudit.status === 'acessivel' ? `Website lido: ${ownDomain}` : member.websiteAudit.status === 'sem-site-publicado' ? 'Sem website publicado' : `Leitura inconclusiva: ${ownDomain || 'website não identificado'}`), createNode('span', '', member.websiteAudit.note));
  audit.append(website);
  if (member.competitors.length) {
    audit.append(createNode('p', 'audit-label', 'Referências visíveis na mesma pesquisa'));
    const list = createNode('ul', 'competitor-list');
    member.competitors.forEach((item) => {
      const li = document.createElement('li');
      const domain = new URL(item.url).hostname.replace(/^www\./, '');
      appendLink(li, domain, item.url);
      li.title = item.name;
      list.append(li);
    });
    audit.append(list);
  }
  audit.append(createNode('p', 'source-note', 'Fonte de identidade: diretório oficial BNI NL UP. Pesquisa pontual de 10 resultados, sujeita a variação por motor, localização e momento.'));
  card.append(main, audit);
  root.append(card);
}

function initializeGame(member) {
  if (game) return;
  const face = new Image();
  face.src = '/bni-up-4-setembro/assets/russo-reference.webp';
  game = new BNIGame({
    canvas,
    member,
    members,
    faceImage: face,
    onQuestion: handleQuestion,
    onFinish: finishGame
  });
  canvas.addEventListener('bni-game-state', (event) => {
    $('#gameHudScore').textContent = `${event.detail.score} PTS`;
    $('#gameHudProgress').textContent = `${event.detail.referrals} REF · ${event.detail.correctAnswers}/6`;
  });
  canvas.addEventListener('pointerdown', () => game.jump());
}

function handleQuestion(event) {
  if (!event.open) {
    $('#questionFeedback').textContent = event.correct ? `Resposta certa. Poder ativado: ${event.power}.` : 'Resposta incorreta. A corrida continua.';
    $('#questionFeedback').hidden = false;
    setTimeout(() => { if (questionDialog.open) questionDialog.close(); }, 700);
    return;
  }
  $('#questionProgress').textContent = `Checkpoint ${event.index + 1} de 6${event.question.personalized ? ' · pergunta personalizada' : ''}`;
  $('#questionText').textContent = event.question.prompt;
  $('#questionFeedback').hidden = true;
  const options = $('#questionOptions');
  options.replaceChildren();
  event.question.options.forEach((option, index) => {
    const button = createNode('button', '', option);
    button.type = 'button';
    button.addEventListener('click', () => game.answer(index));
    options.append(button);
  });
  questionDialog.showModal();
}

async function finishGame(finalState) {
  jumpButton.hidden = true;
  startGameButton.hidden = false;
  startGameButton.textContent = 'Jogar novamente';
  gameResult.textContent = `Você chegou ao pódio com ${finalState.score} pontos e ${finalState.correctAnswers} respostas certas.`;
  gameResult.hidden = false;
  const durationMs = Math.max(1_000, Math.round(finalState.finishedAt - finalState.startedAt));
  if (!DEMO && participantToken) {
    try {
      await api({ action: 'score', name: currentMember.name, company: currentMember.company, score: finalState.score, durationMs, correctAnswers: finalState.correctAnswers }, { Authorization: `Bearer ${participantToken}` });
      await pollOnce();
    } catch (error) {
      gameResult.textContent += ` ${error.message}`;
    }
  } else {
    const current = { playerId: playerId(), name: currentMember.name, company: currentMember.company, score: finalState.score, durationMs, correctAnswers: finalState.correctAnswers };
    ranking = [current, ...ranking.filter((entry) => entry.playerId !== current.playerId)].sort((a, b) => b.score - a.score).map((entry, index) => ({ ...entry, position: index + 1 }));
    renderRanking();
  }
}

startGameButton.addEventListener('click', () => {
  if (!state.gameOpen) return;
  gameStarted = true;
  startGameButton.hidden = true;
  jumpButton.hidden = false;
  gameResult.hidden = true;
  game.start();
});
jumpButton.addEventListener('click', (event) => { event.stopPropagation(); game.jump(); });
window.addEventListener('keydown', (event) => { if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); game?.jump(); } });

function renderRanking() {
  const list = $('#rankingList');
  list.replaceChildren();
  if (!ranking.length) list.append(createNode('li', 'ranking-empty', 'O pódio ainda está aberto.'));
  ranking.slice(0, 12).forEach((entry) => {
    const li = document.createElement('li');
    const identity = document.createElement('div');
    identity.append(createNode('strong', '', entry.name), createNode('small', '', entry.company));
    li.append(identity, createNode('b', '', `${entry.score} pts`));
    list.append(li);
  });
  const podium = $('#podium');
  const order = [ranking[1], ranking[0], ranking[2]];
  [...podium.children].forEach((place, index) => {
    const entry = order[index];
    place.querySelector('strong').textContent = entry?.name || 'Em disputa';
    place.querySelector('small').textContent = entry ? `${entry.score} pontos` : '0 pontos';
  });
}

function applyState(next) {
  if (!next) return;
  state = { ...state, ...next };
  $$('.slide').forEach((slide) => { slide.hidden = Number(slide.dataset.slide) !== state.slide; });
  $$('[data-slide-button]').forEach((button) => button.setAttribute('aria-current', String(Number(button.dataset.slideButton) === state.slide)));
  gameLocked.hidden = state.gameOpen;
  if (!gameStarted) startGameButton.hidden = !state.gameOpen;
  if (!state.gameOpen) jumpButton.hidden = true;
}

async function pollOnce() {
  if (pollInFlight) return;
  pollInFlight = true;
  try {
    const response = await fetch('/api/bni-live', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'offline');
    applyState(payload.state);
    ranking = payload.ranking || [];
    renderRanking();
    consecutivePollFailures = 0;
    setSync(payload.live ? 'online' : 'offline', payload.live ? 'Ao vivo' : 'Modo local');
  } catch {
    consecutivePollFailures += 1;
    if (consecutivePollFailures >= SYNC_FAILURE_THRESHOLD) setSync('offline', 'Reconectando');
  } finally {
    pollInFlight = false;
  }
}

async function schedulePoll() {
  await pollOnce();
  const delay = consecutivePollFailures ? POLL_RETRY_MS : POLL_INTERVAL_MS;
  pollTimer = setTimeout(schedulePoll, delay);
}

function startPolling() {
  clearTimeout(pollTimer);
  schedulePoll();
}

async function submitState(next) {
  if (DEMO) {
    applyState({ ...state, ...next, version: state.version + 1, updatedAt: new Date().toISOString() });
    return;
  }
  const payload = await api({ action: 'state', ...next }, { 'X-Presenter-Pin': presenterPin });
  applyState(payload.state);
}

function openPresenter(member) {
  document.body.classList.add('presenter-active');
  showExperience(member);
  presenterControls.hidden = false;
}

$('#presenterLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#presenterError').hidden = true;
  const pin = $('#presenterPin').value;
  try {
    if (DEMO) {
      if (pin !== '482731') throw new Error('PIN inválido');
    } else {
      const payload = await api({ action: 'state', ...state }, { 'X-Presenter-Pin': pin });
      state = payload.state;
    }
    presenterPin = pin;
    sessionStorage.setItem('bniPresenterPin', pin);
    openPresenter(memberBySlug('aleksander-palamarczuk'));
  } catch (error) {
    $('#presenterError').textContent = error.message;
    $('#presenterError').hidden = false;
  }
});

$$('[data-slide-button]').forEach((button) => button.addEventListener('click', () => {
  const slide = Number(button.dataset.slideButton);
  submitState({ slide, phase: phaseBySlide[slide], gameOpen: state.gameOpen });
}));
$('#previousSlideButton').addEventListener('click', () => {
  const slide = Math.max(0, state.slide - 1);
  submitState({ slide, phase: phaseBySlide[slide], gameOpen: state.gameOpen });
});
$('#nextSlideButton').addEventListener('click', () => {
  const slide = Math.min(8, state.slide + 1);
  submitState({ slide, phase: phaseBySlide[slide], gameOpen: state.gameOpen });
});
$('#releaseGameButton').addEventListener('click', () => submitState({ slide: 6, phase: 'game', gameOpen: true }));
$('#resetLiveButton').addEventListener('click', async () => {
  if (!confirm('Reiniciar apresentação e apagar o ranking desta edição?')) return;
  if (DEMO) {
    ranking = [];
    renderRanking();
    applyState({ slide: 0, phase: 'lobby', gameOpen: false, version: 0 });
    return;
  }
  const payload = await api({ action: 'reset' }, { 'X-Presenter-Pin': presenterPin });
  ranking = [];
  renderRanking();
  applyState(payload.state);
});

function restoreParticipant() {
  const slug = localStorage.getItem('bniUpMemberSlug');
  const token = localStorage.getItem('bniUpParticipantToken');
  const member = memberBySlug(slug);
  if (member && token && !PRESENTER) {
    participantToken = token;
    showExperience(member);
    return true;
  }
  return false;
}

function initialize() {
  populateMembers();
  $('#entryQr').src = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&margin=12&data=${encodeURIComponent(FINAL_URL)}`;
  $('#visibleBrandCount').textContent = String(members.filter((member) => member.discoverability.position !== null).length);
  if (PRESENTER) {
    entryGate.hidden = true;
    presenterGate.hidden = false;
    const savedPin = sessionStorage.getItem('bniPresenterPin');
    if (savedPin) $('#presenterPin').value = savedPin;
  } else if (!restoreParticipant()) {
    entryGate.hidden = false;
  }
  renderRanking();
  if (DEMO) {
    window.__bniDebug = {
      setState(next) { applyState(next); },
      setRanking(next) { ranking = next; renderRanking(); },
      getState() { return { state, member: currentMember, ranking }; }
    };
  }
}

initialize();
