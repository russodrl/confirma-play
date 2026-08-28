const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

// Reveal on scroll
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
$$('.reveal').forEach((element) => revealObserver.observe(element));

const progressiveElements = $$('.hero-copy > *, .quick-facts > div, .section-heading > *, .event-detail-grid article, .details-card > *, .feature-list li, .address-card > *, .bot-intro > *, .final-cta > *, footer p');
progressiveElements.forEach((element, index) => {
  element.classList.add('scroll-reveal');
  element.style.setProperty('--reveal-delay', `${(index % 5) * 65}ms`);
});
const progressiveObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.dataset.revealed = 'true';
    entry.target.classList.add('is-revealed');
    progressiveObserver.unobserve(entry.target);
  });
}, { threshold: .14, rootMargin: '0px 0px -6% 0px' });
progressiveElements.forEach((element) => progressiveObserver.observe(element));
$$('.donald-theme-decor').forEach((element) => progressiveObserver.observe(element));

// Automatic chronological slideshow, one photo every 1.5 seconds
const albumPhotos = $$('.album-photo');
const albumGrid = $('#albumGrid');
albumGrid.classList.add('story-slideshow');
albumPhotos.forEach((photo, index) => {
  revealObserver.unobserve(photo);
  photo.classList.remove('reveal', 'visible');
  photo.hidden = false;
  photo.classList.add('story-slide');
  photo.classList.toggle('is-active', index === 0);
  photo.setAttribute('aria-hidden', String(index !== 0));
  photo.tabIndex = index === 0 ? 0 : -1;
  const image = $('img', photo);
  if (photo.dataset.mobileSrc && matchMedia('(max-width: 680px)').matches) image.src = photo.dataset.mobileSrc;
  image.loading = 'eager';
  image.decoding = 'async';
  if (photo.dataset.objectPosition) image.style.objectPosition = photo.dataset.objectPosition;
  const setSlideBackdrop = () => {
    const source = image.currentSrc || image.src;
    photo.style.setProperty('--slide-image', `url(${JSON.stringify(source)})`);
    photo.style.setProperty('--slide-position', photo.dataset.objectPosition || '50% 50%');
  };
  if (image.complete && image.naturalWidth) setSlideBackdrop(); else image.addEventListener('load', setSlideBackdrop, { once: true });
});
const slideshowMeta = document.createElement('div');
slideshowMeta.className = 'slideshow-meta reveal visible';
slideshowMeta.innerHTML = '<strong class="slideshow-month" id="slideshowMonth"></strong><p class="slideshow-caption" id="slideshowCaption" aria-live="polite"></p><span class="slideshow-counter" id="slideshowCounter"></span><button class="slideshow-toggle" id="slideshowToggle" type="button" aria-pressed="false">Pausar fotos</button><i class="slideshow-progress"><b id="slideshowProgressBar"></b></i>';
albumGrid.after(slideshowMeta);
const albumGameCue = $('#albumGameCue');
const seenAlbumSlides = new Set([0]);
let albumCycleComplete = localStorage.getItem('nickAlbumSeenComplete') === '1';
let activeSlide = 0;
let slideshowPaused = false;
let slideshowVisible = false;
let lastSlideAt = performance.now();
const SLIDE_DURATION = 1500;
function updateAlbumGameCue() {
  albumGameCue.hidden = !(albumCycleComplete && localStorage.getItem('nickRsvpConfirmed') === '1');
}
function showSlide(index) {
  activeSlide = (index + albumPhotos.length) % albumPhotos.length;
  seenAlbumSlides.add(activeSlide);
  if (!albumCycleComplete && seenAlbumSlides.size === albumPhotos.length) {
    albumCycleComplete = true;
    localStorage.setItem('nickAlbumSeenComplete', '1');
  }
  albumPhotos.forEach((photo, photoIndex) => {
    const active = photoIndex === activeSlide;
    photo.classList.toggle('is-active', active);
    photo.setAttribute('aria-hidden', String(!active));
    photo.tabIndex = active ? 0 : -1;
  });
  const current = albumPhotos[activeSlide];
  const month = current.dataset.month;
  $('#slideshowMonth').textContent = `${month} ${month === '1' ? 'mês' : 'meses'}`;
  $('#slideshowCaption').textContent = current.dataset.caption || $('img', current).alt;
  $('#slideshowCounter').textContent = `${activeSlide + 1} / ${albumPhotos.length}`;
  albumGrid.dataset.activeSlide = String(activeSlide);
  updateAlbumGameCue();
}
function slideshowLoop(now) {
  if (!slideshowPaused && slideshowVisible && document.visibilityState === 'visible' && !photoLightbox?.open) {
    const elapsed = now - lastSlideAt;
    if (elapsed >= SLIDE_DURATION) {
      showSlide(activeSlide + 1);
      lastSlideAt = now;
    }
    $('#slideshowProgressBar').style.transform = `scaleX(${Math.min(1, (now - lastSlideAt) / SLIDE_DURATION)})`;
  }
  requestAnimationFrame(slideshowLoop);
}
const albumVisibilityObserver = new IntersectionObserver(([entry]) => {
  slideshowVisible = entry.isIntersecting;
  if (slideshowVisible) lastSlideAt = performance.now();
}, { threshold: .18 });
albumVisibilityObserver.observe(albumGrid);
$('#slideshowToggle').addEventListener('click', () => {
  slideshowPaused = !slideshowPaused;
  lastSlideAt = performance.now();
  $('#slideshowToggle').setAttribute('aria-pressed', String(slideshowPaused));
  $('#slideshowToggle').textContent = slideshowPaused ? 'Continuar fotos' : 'Pausar fotos';
});
showSlide(0);
requestAnimationFrame(slideshowLoop);

const photoLightbox = $('#photoLightbox');
const photoLightboxImage = $('#photoLightboxImage');
const photoLightboxCaption = $('#photoLightboxCaption');
let slideshowWasPaused = false;
albumPhotos.forEach((photo) => {
  photo.addEventListener('click', () => {
    const source = $('img', photo);
    photoLightboxImage.src = source.src;
    photoLightboxImage.alt = source.alt;
    photoLightboxCaption.textContent = photo.dataset.caption || source.alt;
    slideshowWasPaused = slideshowPaused;
    slideshowPaused = true;
    photoLightbox.showModal();
  });
});
function closePhotoLightbox() {
  photoLightbox.close();
  slideshowPaused = slideshowWasPaused;
  lastSlideAt = performance.now();
}
$('.lightbox-close').addEventListener('click', closePhotoLightbox);
photoLightbox.addEventListener('click', (event) => {
  if (event.target === photoLightbox) closePhotoLightbox();
});
photoLightbox.addEventListener('close', () => {
  slideshowPaused = slideshowWasPaused;
  lastSlideAt = performance.now();
});
document.addEventListener('visibilitychange', () => { lastSlideAt = performance.now(); });
window.nickSlideshowDebug = {
  show(index) { slideshowPaused = true; showSlide(index); lastSlideAt = performance.now(); },
  resume() { slideshowPaused = false; lastSlideAt = performance.now(); },
  getState() { return { activeSlide, paused: slideshowPaused, visible: slideshowVisible, total: albumPhotos.length, seen: seenAlbumSlides.size, complete: albumCycleComplete, gameCueVisible: !albumGameCue.hidden }; }
};

// RSVP is the primary section immediately after the hero
const rsvpSection = $('#rsvpSection');
$('.hero').after(rsvpSection);
const rsvpCard = $('.rsvp-card', rsvpSection);
const rsvpHomeMarker = document.createComment('rsvp-card-home');
rsvpSection.insertBefore(rsvpHomeMarker, rsvpCard);
const gameIdentityModal = $('#gameIdentityModal');
const gameRsvpHost = $('#gameRsvpHost');

function storeRsvpIdentity(name, token) {
  localStorage.setItem('nickRsvpConfirmed', '1');
  localStorage.setItem('nickRsvpName', name);
  if (token) localStorage.setItem('nickRsvpToken', token);
  updateAlbumGameCue();
}

async function restoreRsvpIdentity() {
  const existingToken = localStorage.getItem('nickRsvpToken');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch('/nick-7meses/api/rsvp-identity', existingToken ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rsvpToken: existingToken }), signal: controller.signal
    } : { cache: 'no-store', signal: controller.signal });
    if (response.status === 401 && existingToken) return;
    if (!response.ok) return;
    const result = await response.json();
    if (result.confirmed && result.rsvpToken) storeRsvpIdentity(result.name, result.rsvpToken);
  } catch { /* local identity remains available offline */ }
  finally { clearTimeout(timeout); }
}
const identityRestorePromise = restoreRsvpIdentity();

function openGameIdentityModal() {
  if (!gameWon || localStorage.getItem('nickRsvpToken')) return;
  gameRsvpHost.append(rsvpCard);
  gameIdentityModal.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#confirmedNameForm').hidden = true;
  $('#confirmedNameStatus').hidden = true;
  setTimeout(() => $('#rsvpName')?.focus(), 80);
}

function closeGameIdentityModal() {
  gameIdentityModal.hidden = true;
  rsvpHomeMarker.after(rsvpCard);
  document.body.style.overflow = '';
}


$$('[data-close-game-identity]').forEach((button) => button.addEventListener('click', closeGameIdentityModal));
gameIdentityModal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeGameIdentityModal(); });

function remindRsvp() {
  rsvpSection.dataset.reminded = 'true';
  rsvpSection.classList.add('is-reminded');
  rsvpSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (!matchMedia('(max-width: 680px)').matches) setTimeout(() => $('#rsvpName').focus(), 250);
}
$('#rsvpHero').addEventListener('click', remindRsvp);
setTimeout(() => {
  if (!localStorage.getItem('nickRsvpConfirmed')) remindRsvp();
}, 10_000);

const rsvpForm = $('#rsvpForm');
const rsvpStepElements = Object.fromEntries($$('[data-step]', rsvpForm).map((step) => [step.dataset.step, step]));
let currentRsvpStep = 'name';
const selectedValue = (name) => $(`input[name="${name}"]:checked`, rsvpForm)?.value || '';

function getRsvpRoute() {
  const route = ['name', 'phone', 'companion'];
  if (selectedValue('hasCompanion') === 'sim') route.push('companion-name');
  route.push('children');
  if (selectedValue('hasChildren') === 'sim') {
    route.push('child-count');
    const count = selectedValue('childCount');
    if (count === '1' || count === '2') route.push('child-name-1', 'child-age-1');
    if (count === '2') route.push('child-name-2', 'child-age-2');
  }
  return route;
}

function canSubmitRsvp() {
  return (currentRsvpStep === 'children' && selectedValue('hasChildren') === 'não')
    || (currentRsvpStep === 'child-age-1' && selectedValue('childCount') === '1')
    || (currentRsvpStep === 'child-age-2' && selectedValue('childCount') === '2');
}

function renderRsvpStep({ focus = true } = {}) {
  const route = getRsvpRoute();
  if (!route.includes(currentRsvpStep)) currentRsvpStep = route.at(-1);
  Object.values(rsvpStepElements).forEach((step) => {
    const active = step.dataset.step === currentRsvpStep;
    step.hidden = !active;
    $$('input', step).forEach((input) => { input.disabled = !active; });
  });
  const currentIndex = route.indexOf(currentRsvpStep);
  $('.rsvp-progress').innerHTML = route.map((_, index) => `<i class="${index <= currentIndex ? 'is-active' : ''}"></i>`).join('');
  $('#rsvpBack').hidden = currentIndex === 0;
  const readyToSubmit = canSubmitRsvp();
  $('#rsvpNext').hidden = readyToSubmit;
  $('#rsvpSubmit').hidden = !readyToSubmit;
  $('#childName1Label').textContent = selectedValue('childCount') === '2' ? 'Qual é o nome do primeiro filho?' : 'Qual é o nome do filho?';
  $('#childAge1Label').textContent = selectedValue('childCount') === '2' ? 'Qual a idade do primeiro?' : 'Qual a idade?';
  const focusTarget = $('input', rsvpStepElements[currentRsvpStep]);
  if (focus && focusTarget) setTimeout(() => focusTarget.focus(), 40);
}

function validateRsvpStep() {
  const fields = $$('input', rsvpStepElements[currentRsvpStep]);
  for (const field of fields) {
    if (!field.checkValidity()) {
      field.reportValidity();
      return false;
    }
  }
  return true;
}

$('#rsvpNext').addEventListener('click', () => {
  if (!validateRsvpStep()) return;
  const route = getRsvpRoute();
  const currentIndex = route.indexOf(currentRsvpStep);
  if (route[currentIndex + 1]) currentRsvpStep = route[currentIndex + 1];
  renderRsvpStep();
});
$('#rsvpBack').addEventListener('click', () => {
  const route = getRsvpRoute();
  const currentIndex = route.indexOf(currentRsvpStep);
  if (route[currentIndex - 1]) currentRsvpStep = route[currentIndex - 1];
  renderRsvpStep();
});
$$('input[type="radio"]', rsvpForm).forEach((radio) => radio.addEventListener('change', () => renderRsvpStep({ focus: false })));

rsvpForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateRsvpStep() || !canSubmitRsvp()) return;
  const hasCompanion = selectedValue('hasCompanion');
  const hasChildren = selectedValue('hasChildren');
  const childCount = hasChildren === 'sim' ? Number(selectedValue('childCount')) : 0;
  const childNames = childCount > 0
    ? [$('#childName1').value.trim(), ...(childCount === 2 ? [$('#childName2').value.trim()] : [])]
    : [];
  const childAges = childCount > 0
    ? [$('#childAge1').value.trim(), ...(childCount === 2 ? [$('#childAge2').value.trim()] : [])]
    : [];
  const payload = {
    name: $('#rsvpName').value.trim(),
    phone: $('#rsvpPhone').value.trim(),
    hasCompanion,
    companionName: hasCompanion === 'sim' ? $('#rsvpCompanionName').value.trim() : '',
    hasChildren,
    childCount,
    childNames,
    childAges,
    partySize: 1 + (hasCompanion === 'sim' ? 1 : 0) + childCount
  };
  const submit = $('#rsvpSubmit');
  submit.disabled = true;
  submit.textContent = 'Confirmando...';
  try {
    const response = await fetch('/nick-7meses/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error('Falha no RSVP');
    const result = await response.json();
    storeRsvpIdentity(payload.name, result.rsvpToken);
    rsvpForm.hidden = true;
    $('.rsvp-progress').hidden = true;
    $('#rsvpSuccess').hidden = false;
    rsvpSection.classList.remove('is-reminded');
    if (gameWon && result.rsvpToken) await finalizeGameIdentity();
    else requestAnimationFrame(() => rsvpSection.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  } catch {
    submit.disabled = false;
    submit.textContent = 'Tentar novamente';
    alert('Não consegui confirmar agora. Tente novamente pelo próprio site.');
  }
});
renderRsvpStep({ focus: false });

$('#alreadyConfirmedButton').addEventListener('click', () => {
  $('#confirmedNameForm').hidden = false;
  $('#confirmedNameStatus').hidden = true;
  setTimeout(() => $('#confirmedName').focus(), 40);
});

$('#confirmedNameForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#confirmedName').value.trim();
  const status = $('#confirmedNameStatus');
  const submit = $('button[type="submit"]', event.currentTarget);
  status.hidden = false;
  if (name.split(/\s+/).filter(Boolean).length < 2) {
    status.textContent = 'Tem certeza que já confirmou? não to achando.';
    return;
  }
  submit.disabled = true;
  submit.textContent = 'Procurando...';
  try {
    const response = await fetch('/nick-7meses/api/rsvp-identity', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    const result = await response.json();
    if (!response.ok || !result.confirmed || !result.rsvpToken) throw new Error(result.error || 'not-found');
    storeRsvpIdentity(result.name, result.rsvpToken);
    status.textContent = `Encontrei sua confirmação, ${result.name}! Salvando seu resultado...`;
    await finalizeGameIdentity();
  } catch (error) {
    status.textContent = error.message === 'Tente novamente em um minuto.'
      ? error.message
      : 'Tem certeza que já confirmou? não to achando.';
  } finally {
    submit.disabled = false;
    submit.textContent = 'Procurar confirmação';
  }
});

// Google Calendar and push reminders
const calendarModal = $('#calendarModal');
const notificationModal = $('#notificationModal');
const calendarUrl = new URL('https://calendar.google.com/calendar/render');
calendarUrl.search = new URLSearchParams({
  action: 'TEMPLATE',
  text: 'Festa do Nick, 7 meses',
  dates: '20260829T123000Z/20260829T173000Z',
  ctz: 'Europe/Lisbon',
  location: 'Rua Francisco Sá Carneiro, 749, Leça da Palmeira, Portugal',
  details: 'Oi! Eu sou o Nick e quero comemorar meus 7 meses com você. A festa começa às 13:30. Vai ter churrasco, música e muita alegria!'
}).toString();
const calendarLinks = [$('#googleCalendarLink'), $('#eventCalendarLink'), $('#topCalendarLink')].filter(Boolean);
const useSameTabForCalendar = matchMedia('(max-width: 980px)').matches || /iphone|ipad|ipod|android/i.test(navigator.userAgent);
calendarLinks.forEach((link) => {
  link.href = calendarUrl.toString();
  if (useSameTabForCalendar) link.removeAttribute('target'); else link.target = '_blank';
});

function openCalendarModal() {
  calendarModal.hidden = false;
  document.body.style.overflow = 'hidden';
  sessionStorage.setItem('nickCalendarAsked', '1');
  setTimeout(() => $('.modal-close', calendarModal)?.focus(), 50);
}
function closeCalendarModal() {
  calendarModal.hidden = true;
  document.body.style.overflow = '';
  sessionStorage.setItem('nickCalendarAsked', '1');
}
function openNotificationModal() {
  if (localStorage.getItem('nickPushSubscribed') === '1' || sessionStorage.getItem('nickNotificationAsked') === '1') return;
  notificationModal.hidden = false;
  document.body.style.overflow = 'hidden';
  sessionStorage.setItem('nickNotificationAsked', '1');
  setTimeout(() => $('#phoneReminderRequest')?.focus(), 50);
}
function closeNotificationModal() {
  notificationModal.hidden = true;
  document.body.style.overflow = '';
}
let calendarReturnPending = sessionStorage.getItem('nickCalendarReturnPending') === '1';
let calendarOpenedAt = 0;
function markCalendarOpened() {
  localStorage.setItem('nickCalendarClicked', '1');
  calendarReturnPending = true;
  calendarOpenedAt = Date.now();
  sessionStorage.setItem('nickCalendarReturnPending', '1');
}
calendarLinks.forEach((link) => link.addEventListener('click', () => {
  markCalendarOpened();
  if (useSameTabForCalendar) return;
  setTimeout(closeCalendarModal, 80);
}));
$$('[data-close-modal]').forEach((button) => button.addEventListener('click', closeCalendarModal));
$$('[data-close-notification]').forEach((button) => button.addEventListener('click', closeNotificationModal));
calendarModal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCalendarModal(); });
notificationModal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeNotificationModal(); });
function checkCalendarReturn(force = false) {
  if (!calendarReturnPending || (!force && Date.now() - calendarOpenedAt < 500)) return;
  calendarReturnPending = false;
  sessionStorage.removeItem('nickCalendarReturnPending');
  openNotificationModal();
}
window.addEventListener('focus', () => checkCalendarReturn());
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkCalendarReturn(); });
window.addEventListener('pageshow', () => { if (calendarReturnPending) setTimeout(() => checkCalendarReturn(true), 450); });
new IntersectionObserver((entries, observer) => {
  if (!entries.some((entry) => entry.isIntersecting)) return;
  observer.disconnect();
  if (!useSameTabForCalendar && !localStorage.getItem('nickCalendarClicked') && !sessionStorage.getItem('nickCalendarAsked')) openCalendarModal();
}, { threshold: .1 }).observe($('#calendarPassSentinel'));

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/nick-7meses/sw.js').catch(() => {});
async function requestPushReminder() {
  const button = $('#phoneReminderRequest');
  const note = $('#reminderSetupNote');
  const rsvpToken = localStorage.getItem('nickRsvpToken');
  if (!rsvpToken) {
    note.textContent = 'Primeiro confirme sua presença e informe seu telefone. Depois eu ativo os dois avisos neste aparelho.';
    note.hidden = false;
    setTimeout(() => { closeNotificationModal(); remindRsvp(); }, 1300);
    return;
  }
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isIos && !isStandalone) {
    note.textContent = 'No iPhone, primeiro toque em Compartilhar e escolha “Adicionar à Tela de Início”. Depois abra o convite pelo novo ícone e ative os avisos.';
    note.hidden = false;
    return;
  }
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    note.textContent = 'Este navegador não oferece notificações Push. Você ainda pode usar os lembretes da Google Agenda.';
    note.hidden = false;
    return;
  }
  button.disabled = true;
  button.textContent = 'Ativando...';
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('permission-denied');
    await navigator.serviceWorker.register('/nick-7meses/sw.js');
    const registration = await navigator.serviceWorker.ready;
    const keyResponse = await fetch('/nick-7meses/api/push-key', { cache: 'no-store' });
    if (!keyResponse.ok) throw new Error('key-unavailable');
    const { publicKey } = await keyResponse.json();
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    const response = await fetch('/nick-7meses/api/push-subscribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: subscription.toJSON(), rsvpToken })
    });
    if (!response.ok) throw new Error('subscribe-failed');
    localStorage.setItem('nickPushSubscribed', '1');
    note.textContent = 'Pronto! Você receberá um aviso 2 horas antes e outro 10 minutos antes da festinha.';
    note.hidden = false;
    button.textContent = 'Avisos ativados';
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Tentar novamente';
    note.textContent = error.message === 'permission-denied'
      ? 'As notificações foram bloqueadas no navegador. Você pode liberá-las nas configurações do site.'
      : 'Não consegui ativar agora. Tente novamente ou use a Google Agenda.';
    note.hidden = false;
  }
}
$('#phoneReminderRequest').addEventListener('click', requestPushReminder);

// Responsive top navigation
const menuToggle = $('#menuToggle');
const topNav = $('#topNav');
function closeTopMenu() { menuToggle.setAttribute('aria-expanded', 'false'); topNav.classList.remove('is-open'); }
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  topNav.classList.toggle('is-open', open);
});
$$('a', topNav).forEach((link) => link.addEventListener('click', closeTopMenu));
document.addEventListener('click', (event) => { if (!event.target.closest('.topbar')) closeTopMenu(); });
window.nickCalendarDebug = { simulateReturnFromGoogle: () => { calendarReturnPending = true; checkCalendarReturn(true); }, openCalendarModal, openNotificationModal, useSameTabForCalendar, calendarUrl: calendarUrl.toString() };

// Local HTML5 music, starts only after a user gesture
const nickMusic = $('#nickMusic');
const musicButton = $('#musicButton');
const musicButtonText = $('#musicButtonText');
const gameMusicToggle = $('#gameMusicToggle');
const MUSIC_PLAYLIST = [
  '/nick-7meses/assets/music/sete-meses-de-alegria-1.mp3',
  '/nick-7meses/assets/music/sete-meses-de-alegria-2.mp3'
];
let currentMusicTrackIndex = 0;
let musicEnabled = localStorage.getItem('nickMusicEnabled') === 'true';

function loadMusicTrack(index) {
  currentMusicTrackIndex = (index + MUSIC_PLAYLIST.length) % MUSIC_PLAYLIST.length;
  const path = MUSIC_PLAYLIST[currentMusicTrackIndex];
  if (!nickMusic.getAttribute('src')?.endsWith(path)) {
    nickMusic.src = path;
    nickMusic.load();
  }
  nickMusic.dataset.playlistIndex = String(currentMusicTrackIndex + 1);
  nickMusic.dataset.playlistLength = String(MUSIC_PLAYLIST.length);
  return path;
}

function persistMusicPreference(enabled) {
  musicEnabled = enabled;
  localStorage.setItem('nickMusicEnabled', String(enabled));
  gameMusicToggle.checked = enabled;
  gameMusicToggle.setAttribute('aria-label', enabled ? 'Desativar música' : 'Ativar música');
}

function updateMusicButton() {
  const playing = !nickMusic.paused && !nickMusic.ended;
  musicButton.classList.toggle('playing', playing);
  musicButton.setAttribute('aria-pressed', String(playing));
  musicButton.dataset.playerState = playing ? 'playing' : 'paused';
  musicButtonText.textContent = playing ? 'Pausar minhas músicas' : 'Ouça minhas músicas';
  gameMusicToggle.dataset.playerState = playing ? 'playing' : 'paused';
  musicButton.dataset.playlistIndex = String(currentMusicTrackIndex + 1);
}

async function setMusicEnabled(enabled, attemptPlayback = true) {
  persistMusicPreference(enabled);
  if (!enabled) {
    nickMusic.pause();
    updateMusicButton();
    return true;
  }
  if (!attemptPlayback) {
    updateMusicButton();
    return false;
  }
  try {
    await nickMusic.play();
    updateMusicButton();
    return true;
  } catch {
    musicButtonText.textContent = 'Toque novamente para ouvir';
    gameMusicToggle.dataset.playerState = 'blocked';
    return false;
  }
}

async function advanceMusicPlaylist() {
  loadMusicTrack(currentMusicTrackIndex + 1);
  if (!musicEnabled) {
    updateMusicButton();
    return false;
  }
  try {
    await nickMusic.play();
    updateMusicButton();
    return true;
  } catch {
    musicButtonText.textContent = 'Toque para continuar as músicas';
    gameMusicToggle.dataset.playerState = 'blocked';
    return false;
  }
}

nickMusic.addEventListener('play', () => { persistMusicPreference(true); updateMusicButton(); });
nickMusic.addEventListener('pause', updateMusicButton);
nickMusic.addEventListener('ended', advanceMusicPlaylist);
nickMusic.addEventListener('error', () => {
  persistMusicPreference(false);
  musicButton.dataset.playerError = 'audio-load-failed';
  musicButtonText.textContent = 'Não consegui tocar agora';
});

loadMusicTrack(0);
musicButton.addEventListener('click', () => setMusicEnabled(nickMusic.paused));
gameMusicToggle.addEventListener('change', () => setMusicEnabled(gameMusicToggle.checked));
document.addEventListener('pointerdown', () => {
  if (musicEnabled && nickMusic.paused) setMusicEnabled(true);
}, { once: true, capture: true });
persistMusicPreference(musicEnabled);
updateMusicButton();

// FAQ bot
const faqEntries = [
  {
    terms: ['comida', 'comer', 'churrasco', 'carne', 'almoço', 'almoco'],
    answer: 'Vai ter churrasco, com carne e comida gostosa para todo mundo. Venha com fome!'
  },
  {
    terms: ['acompanhante', 'marido', 'esposa', 'namorado', 'namorada', 'parceiro', 'parceira'],
    answer: 'Pode e deve trazer seu acompanhante. Quero comemorar cercado de gente querida!'
  },
  {
    terms: ['filho', 'filhos', 'criança', 'crianca', 'crianças', 'criancas', 'bebê', 'bebe'],
    answer: 'Claro! Seus filhos são muito bem-vindos. Vai ser uma tarde para toda a família.'
  },
  {
    terms: ['estacionar', 'estacionamento', 'carro', 'parar'],
    answer: 'Você pode estacionar na rua, em frente ao local ou bem pertinho.'
  },
  {
    terms: ['bebida', 'cerveja', 'álcool', 'alcool'],
    answer: 'Teremos bebidas e cerveja, sempre com moderação. Também vai ter opção para quem não bebe álcool.'
  },
  {
    terms: ['tema', 'decoração', 'decoracao', 'donald', 'pato'],
    answer: 'Minha decoração será do Pato Donald, com muito azul, amarelo, vermelho e alegria!'
  },
  {
    terms: ['quando', 'data', 'dia', 'horário', 'horario', 'hora'],
    answer: 'A minha festa será no dia 29 de agosto de 2026 e começa às 13:30. Não tem hora marcada para acabar.'
  },
  {
    terms: ['onde', 'local', 'endereço', 'endereco', 'rua', 'localização', 'localizacao'],
    answer: 'Vai ser na Rua Francisco Sá Carneiro, 749, em Leça da Palmeira. O mapa está logo acima nesta página.'
  },
  {
    terms: ['presença', 'presenca', 'confirmar', 'confirmação', 'confirmacao', 'rsvp'],
    answer: 'Você pode confirmar aqui no próprio site, na seção “Confirme sua presença”. Vamos adorar saber que você vem!'
  },
  {
    terms: ['traje', 'roupa', 'vestir'],
    answer: 'Venha com uma roupa confortável e com vontade de se divertir. Não há traje obrigatório.'
  }
];

function normalizeText(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ');
}
function appendMessage(text, type = 'bot') {
  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;
  $('#chatMessages').appendChild(message);
  $('#chatMessages').scrollTop = $('#chatMessages').scrollHeight;
  return message;
}
function findFaqAnswer(question) {
  const normalized = normalizeText(question);
  let best = null;
  let bestScore = 0;
  faqEntries.forEach((entry) => {
    const score = entry.terms.reduce((total, term) => total + (normalized.includes(normalizeText(term)) ? 1 : 0), 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  });
  return bestScore ? best.answer : null;
}
async function answerQuestion(question) {
  appendMessage(question, 'user');
  const knownAnswer = findFaqAnswer(question);
  if (knownAnswer) {
    setTimeout(() => appendMessage(knownAnswer), 320);
    return;
  }
  const pending = appendMessage('Essa eu ainda não sei. Vou perguntar para a família do Nick...', 'pending');
  try {
    const response = await fetch('/nick-7meses/api/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, page: location.href })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Falha ao enviar');
    pending.textContent = data.message || 'Pronto! A pergunta foi enviada para a família do Nick. Enquanto isso, você também pode chamar pelo WhatsApp.';
  } catch {
    pending.innerHTML = 'Ainda não consegui perguntar daqui. <a href="https://wa.me/351910350209?text=Ol%C3%A1%21%20Tenho%20uma%20pergunta%20sobre%20a%20festa%20do%20Nick" target="_blank" rel="noopener">Fale com a família no WhatsApp</a>.';
  }
}
$('#chatForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#chatInput');
  const question = input.value.trim();
  if (!question) return;
  input.value = '';
  answerQuestion(question);
});
$$('#suggestions button').forEach((button) => button.addEventListener('click', () => answerQuestion(button.textContent)));

// Floating chat launcher, the chat lives only inside its modal
const chatLauncher = $('#chatLauncher');
const chatModal = $('#chatModal');
function openFloatingChat() {
  chatModal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('#chatInput').focus(), 80);
}
function closeFloatingChat() {
  chatModal.hidden = true;
  document.body.style.overflow = '';
}
setTimeout(() => {
  chatLauncher.hidden = false;
  setTimeout(() => chatLauncher.classList.add('prompt-hidden'), 7_000);
}, 15_000);
chatLauncher.addEventListener('click', openFloatingChat);
$$('[data-close-chat]').forEach((element) => element.addEventListener('click', closeFloatingChat));
chatModal.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeFloatingChat(); });

// Nick's side-scroller
const canvas = $('#nickGame');
const ctx = canvas.getContext('2d');
const stageLabel = $('#stageLabel');
const scoreLabel = $('#scoreLabel');
const timeLabel = $('#timeLabel');
const WORLD_WIDTH = 56000;
const GROUND_Y = 338;
const CRAWL_END_X = 26000;
const SPEED_PROFILE = { crawlStart: 205, crawlEnd: 230, walkStart: 255, walkEnd: 360 };
const DIFFICULTY_GAPS = { early: 650, middle: 450, final: 340 };
const STAR_GAPS = { early: 420, middle: 330, final: 260 };
const GRAVITY = 1040;
const JUMP_IMPULSE = -390;
const JUMP_HOLD_ACCEL = -720;
const MAX_JUMP_HOLD = .28;
const POWER_DURATION = { doubleJump: 14, flight: 9, speedBoost: 6 };
const SPEED_BOOST_MULTIPLIER = 1.55;
const HIT_SLOWDOWN_DURATION = 1;
const HIT_SLOWDOWN_MULTIPLIER = .75;
const POWER_ICON_RADIUS = 30;
const POWER_COLLECT_RADIUS = 46;
const CHARACTER_ANIMATION_FPS = 24;
const LANDING_ANIMATION_SECONDS = .07;
const keys = { jumpHeld: false, jumpPressed: false };
const powerTutorialToggle = $('#powerTutorialToggle');
let powerTutorialEnabled = localStorage.getItem('nickPowerTutorialEnabled') !== 'false';

function setPowerTutorialEnabled(enabled) {
  powerTutorialEnabled = enabled;
  localStorage.setItem('nickPowerTutorialEnabled', String(enabled));
  powerTutorialToggle.checked = enabled;
  powerTutorialToggle.setAttribute('aria-label', enabled ? 'Desativar tutorial dos superpoderes' : 'Ativar tutorial dos superpoderes');
  powerTutorialToggle.dataset.tutorial = enabled ? 'enabled' : 'disabled';
}

powerTutorialToggle.addEventListener('change', () => setPowerTutorialEnabled(powerTutorialToggle.checked));
setPowerTutorialEnabled(powerTutorialEnabled);
const nickSprites = {
  crawl: new Image(),
  walk: new Image(),
  run: new Image()
};
const crawlFrames = Array.from({ length: 24 }, () => new Image());
const walkFrames = Array.from({ length: 6 }, () => new Image());
const flightFrames = Array.from({ length: 24 }, () => new Image());
const jumpFrames = Array.from({ length: 24 }, () => new Image());
const WALK_ANIMATION_SOURCE = 'original-6-frames';
const GAME_FRAME_VERSION = 'walk6-motion-v2';
const versionedGameFrame = (path) => `${path}?v=${GAME_FRAME_VERSION}`;
nickSprites.crawl.src = '/nick-7meses/assets/game/nick-crawl.png';
nickSprites.walk.src = '/nick-7meses/assets/game/nick-walk.png';
nickSprites.run.src = '/nick-7meses/assets/game/nick-run.png';
crawlFrames.forEach((frame, index) => { frame.src = versionedGameFrame(`/nick-7meses/assets/game/crawl-frames/crawl-${index + 1}.png`); });
walkFrames.forEach((frame, index) => { frame.src = versionedGameFrame(`/nick-7meses/assets/game/walk-source-frames/walk-${index + 1}.png`); });
flightFrames.forEach((frame, index) => { frame.src = versionedGameFrame(`/nick-7meses/assets/game/flight-frames/flight-${index + 1}.png`); });
jumpFrames.forEach((frame, index) => { frame.src = versionedGameFrame(`/nick-7meses/assets/game/jump-frames/jump-${index + 1}.png`); });
const donaldImage = new Image();
donaldImage.src = '/nick-7meses/assets/donald-feliz.png';

const DIFFICULT_STAR_INDICES = new Set([13, 38, 67, 92, 118, 139]);
const baseStars = [];
for (let x = 520, index = 0; x < WORLD_WIDTH - 500; index += 1) {
  const progress = x / WORLD_WIDTH;
  const gap = progress < 1 / 3 ? STAR_GAPS.early : progress < 2 / 3 ? STAR_GAPS.middle : STAR_GAPS.final;
  baseStars.push({
    x,
    y: DIFFICULT_STAR_INDICES.has(index) ? GROUND_Y - 195 - (index % 2) * 18 : GROUND_Y - 105 - (index % 2) * 42,
    difficulty: DIFFICULT_STAR_INDICES.has(index) ? 'precision' : 'normal',
    phase: index * .91
  });
  x += gap + (index % 4) * 18;
}
const obstaclePositions = [];
for (let x = 1180, index = 0; x < WORLD_WIDTH - 700; index += 1) {
  obstaclePositions.push(x);
  const progress = x / WORLD_WIDTH;
  const baseGap = progress < .35 ? DIFFICULTY_GAPS.early : progress < .7 ? DIFFICULTY_GAPS.middle : DIFFICULTY_GAPS.final;
  x += baseGap + ((index % 5) - 2) * 22;
}
const baseObstacles = obstaclePositions.map((x, index) => ({
  x,
  type: index % 5,
  w: index === 2 ? 50 : 58 + (index % 3) * 9,
  h: index === 2 ? 52 : 52 + (index % 4) * 8,
  beginnerFriendly: index === 2
}));
const baseFlyingBirds = Array.from({ length: 19 }, (_, index) => ({
  x: 8500 + index * 2500,
  baseY: 118 + (index % 5) * 38,
  phase: index * 1.37,
  speed: 92 + (index % 4) * 18,
  travelSpan: 2600 + (index % 3) * 180,
  mode: index % 5 === 0 ? 'hover' : 'cross',
  w: 46,
  h: 30
}));
const platformHeights = [270, 242, 276, 232, 265, 220, 258, 235];
const platforms = Array.from({ length: 21 }, (_, index) => ({
  x: 2180 + index * 2600,
  y: platformHeights[index % platformHeights.length],
  w: 230 + (index % 3) * 20
}));
const BASE_PLATFORM_COUNT = platforms.length;
const doubleJumpPowerups = [1, 6, 11, 16].map((platformIndex, index) => {
    const platform = platforms[platformIndex];
    return { x: platform.x + platform.w * .72, y: platform.y - 120, type: 'doubleJump', challenge: 'platform-long-jump', platformIndex, phase: index * 1.17 };
  });
const flightPowerups = [3, 8, 13, 18].map((platformIndex, index) => {
    const platform = platforms[platformIndex];
    return { x: platform.x + platform.w + 105, y: platform.y - 110, type: 'flight', challenge: 'air-control', platformIndex, phase: index * 1.31 };
  });
const lifePowerups = flightPowerups.slice(0, 3).map((flight, index) => ({
  x: flight.x + 700,
  y: 250,
  type: 'life',
  challenge: 'ground-reachable',
  prerequisite: null,
  platformIndex: null,
  phase: index * 1.43
}));
const basePowerups = [
  ...doubleJumpPowerups,
  ...flightPowerups,
  ...lifePowerups,
  ...[14000, 30000, 46000].map((x, index) => ({
    x, y: 125, type: 'speedBoost', challenge: 'precision-moving', platformIndex: null, phase: index * 2.17
  }))
];
let obstacles = [];
let flyingBirds = [];
let birdCollisionsEnabled = true;
let initialStars = [];
let initialPowerups = [];
let currentLevelSeed = 0;
const STAR_CLEARANCE = 12;

function getStarMotionEnvelope(star) {
  return star.difficulty === 'precision' ? { x: 58, y: 40, radius: 20 } : { x: 0, y: 0, radius: 20 };
}

function starOverlapsPlatform(star, platform) {
  const envelope = getStarMotionEnvelope(star);
  const horizontal = star.x + envelope.x + envelope.radius > platform.x
    && star.x - envelope.x - envelope.radius < platform.x + platform.w;
  const vertical = star.y + envelope.y + envelope.radius > platform.y
    && star.y - envelope.y - envelope.radius < platform.y + 24;
  return horizontal && vertical;
}

function moveStarClearOfPlatforms(star) {
  const adjusted = { ...star };
  const envelope = getStarMotionEnvelope(adjusted);
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    platforms.forEach((platform) => {
      if (!starOverlapsPlatform(adjusted, platform)) return;
      adjusted.y = Math.round(platform.y - envelope.y - envelope.radius - STAR_CLEARANCE);
      moved = true;
    });
    if (!moved) break;
  }
  return adjusted;
}

function countStarsInsidePlatforms(items = stars || []) {
  return items.filter((star) => platforms.some((platform) => starOverlapsPlatform(star, platform))).length;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function randomLevelSeed() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] || Date.now() >>> 0;
}

function createProceduralLevel(seed) {
  const random = seededRandom(seed);
  const jitter = (amount) => (random() * 2 - 1) * amount;
  platforms.length = BASE_PLATFORM_COUNT;
  let obstacleCursor = 1180;
  obstacles = baseObstacles.map((obstacle, index) => {
    if (index > 0) {
      const progress = obstacleCursor / WORLD_WIDTH;
      const targetGap = progress < .35 ? DIFFICULTY_GAPS.early : progress < .7 ? DIFFICULTY_GAPS.middle : DIFFICULTY_GAPS.final;
      const clusterTightening = index > 8 && index % 7 === 0 ? 55 : 0;
      obstacleCursor += Math.max(285, Math.round(targetGap - clusterTightening + jitter(24)));
    }
    const isCrib = index >= 10 && index % 17 === 10;
    const type = isCrib ? 5 : index === 2 ? 2 : Math.floor(random() * 5);
    const isCabinet = type === 3;
    return {
      ...obstacle,
      x: obstacleCursor,
      type,
      w: isCrib ? Math.round(98 + random() * 9) : index === 2 ? 50 : isCabinet ? Math.round(84 + random() * 10) : Math.round(54 + random() * 23),
      h: isCrib ? Math.round(68 + random() * 7) : index === 2 ? 52 : isCabinet ? Math.round(98 + random() * 10) : Math.round(48 + random() * 27),
      requiresBridge: false,
      runId: `obstacle-${seed}-${index}`
    };
  });
  initialStars = baseStars.map((star, index) => moveStarClearOfPlatforms({
    ...star,
    x: Math.round(star.x + jitter(38)),
    y: star.difficulty === 'precision' ? Math.round(118 + random() * 70) : Math.round(135 + random() * 140),
    phase: random() * Math.PI * 2,
    runId: `star-${seed}-${index}`
  })).sort((a, b) => a.x - b.x);
  initialPowerups = basePowerups.map((item, index) => {
    const platform = Number.isInteger(item.platformIndex) ? platforms[item.platformIndex] : null;
    const randomizedY = item.type === 'life'
      ? Math.max(232, Math.min(258, item.y + jitter(12)))
      : Math.max(112, Math.min(245, item.y + jitter(28)));
    const platformSafeY = platform ? platform.y - 52 - POWER_COLLECT_RADIUS - 2 : randomizedY;
    return {
      ...item,
      x: Math.round(item.x + jitter(item.type === 'life' ? 70 : 115)),
      y: Math.round(Math.min(randomizedY, platformSafeY)),
      phase: random() * Math.PI * 2,
      runId: `power-${seed}-${index}`
    };
  }).sort((a, b) => a.x - b.x);
  flyingBirds = baseFlyingBirds.map((bird, index) => {
    const preferredX = Math.round(bird.x + jitter(150));
    const safeGap = bird.mode === 'hover'
      ? obstacles.slice(1).map((obstacle, obstacleIndex) => {
        const previous = obstacles[obstacleIndex];
        const left = previous.x + previous.w;
        const right = obstacle.x;
        return { gap: right - left, x: Math.round((left + right) / 2) };
      }).filter((candidate) => candidate.gap >= 320)
        .sort((a, b) => Math.abs(a.x - preferredX) - Math.abs(b.x - preferredX))[0]
      : null;
    const x = safeGap?.x ?? preferredX;
    return {
      ...bird,
      x,
      baseY: Math.round(bird.baseY + jitter(8)),
      speed: Math.round(88 + random() * 72),
      travelSpan: bird.mode === 'hover' ? 0 : Math.round(2600 + random() * 360),
      phase: random() * Math.PI * 2,
      flightX: x,
      flightStarted: false,
      flightFinished: false,
      runId: `bird-${seed}-${index}`
    };
  }).sort((a, b) => a.x - b.x);
  currentLevelSeed = seed >>> 0;
}

let player;
let stars;
let powerups;
let cameraX;
let gameWon;
let gameOver;
let gameActive = false;
let gameStarted = false;
let initialGameDialogueShown = false;
let dialogueTyping = false;
let dialogueTimer;
let dialogueOnContinue = null;
let dialogueFullText = '';
let seenPowerDialogues = new Set();
let lastTime = performance.now();
let currentGameFrameTime = performance.now();
const PLAYER_HITBOXES = {
  crawl: { left: 22, right: 36, top: 76, bottom: 5, footHalfWidth: 28 },
  walk: { left: 24, right: 28, top: 112, bottom: 5, footHalfWidth: 20 }
};

function getPlayerHitbox() {
  const shape = getStage().index === 0 ? PLAYER_HITBOXES.crawl : PLAYER_HITBOXES.walk;
  return {
    left: player.x - shape.left,
    right: player.x + shape.right,
    top: player.y - shape.top,
    bottom: player.y - shape.bottom,
    footHalfWidth: shape.footHalfWidth
  };
}

function getObstacleHitbox(obstacle) {
  const top = GROUND_Y - obstacle.h + 16;
  const inset = obstacle.type === 4
    ? { left: obstacle.w * .25, right: obstacle.w * .25, top: 6 }
    : obstacle.type === 2
      ? { left: 4, right: obstacle.w * .08, top: 4 }
      : obstacle.type === 3
        ? { left: 8, right: 8, top: 16 }
        : obstacle.type === 5
          ? { left: 26, right: 26, top: 42 }
          : { left: 4, right: 4, top: 3 };
  return {
    left: obstacle.x + inset.left,
    right: obstacle.x + obstacle.w - inset.right,
    top: top + inset.top,
    bottom: GROUND_Y + 8,
    type: obstacle.type
  };
}

function getBirdHitbox(bird, position) {
  return {
    left: position.x - bird.w * .46,
    right: position.x + bird.w * .46,
    top: position.y - bird.h * .42,
    bottom: position.y + bird.h * .42,
    type: 'bird'
  };
}

function hitboxesOverlap(a, b) {
  return a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
}
const GAME_DIALOGUE_TEXT = 'Me ajude a chegar na minha festinha!\n\nEu vou te agradecer muito se eu conseguir chegar!';
const CELEBRATION_TITLE = 'Parabens Nicolas! ❤️';
function shuffledProgressMessages(messages) {
  const random = seededRandom(randomLevelSeed());
  const result = [...messages];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
const shuffledGamePhrases = shuffledProgressMessages([
  'Quem não chora, não mama. Literalmente.',
  'Ô louco bicho, já estou chegando!',
  'Devagar se vai ao longe. Engatinhando também.',
  'Bora, Bill... quer dizer, bora, Nick!',
  'Já estou pronto!',
  'É de pequenino que se torce o pepino.',
  'Você está mandando muito bem!',
  'Chego em 10 minutos!',
  'Quem tem pressa come cru. O Nick trouxe papinha.',
  'Calma, calabreso! Tem obstáculo na pista.',
  'Essa é a melhor comida que eu já comi.',
  'Grão a grão enche a galinha o papo.',
  'Receba essa estrelinha!',
  'Estou de dieta.',
  'Já foi quase metade. Continua!',
  'O pai tá on. O bebê também.',
  'Não gosto de doce.',
  'Quem corre por gosto não cansa. Quem engatinha também não.',
  'Isso está um espetáculo, pá!',
  'Só pra soltar a musculatura.',
  'É sobre isso... e está tudo bem.',
  'Mais vale tarde do que nunca.',
  'Você tá lendo isso aqui? Se tiver, me avisa. Ass: Russo',
  'Vai com calma, que a festa não foge!',
  'A festinha está cada vez mais perto!',
  'Filho de peixe, peixinho é. Filho do Russo, jogador é.',
  'Só mais um bocadinho!',
  'Você está quase lá!',
  'Segura meu mordedor que eu tô indo!',
  'Atleta olímpico do engatinhamento.',
  'Essa pista está mais longa que a hora da soneca.',
  'Cadê minha mamadeira no pit stop?',
  'Hoje o bebê tá impossível!',
  'Se eu soubesse andar, já tinha chegado.',
  'Licença que o piloto mirim está passando!',
  'Quase perdi a chupeta nessa curva!'
]);
const gamePhraseMiddle = Math.ceil(shuffledGamePhrases.length / 2);
const GAME_PROGRESS_MESSAGES = [
  'Valendo! Ajude o Nick a chegar à festinha!',
  ...shuffledGamePhrases.slice(0, gamePhraseMiddle),
  'Já passamos da metade!',
  ...shuffledGamePhrases.slice(gamePhraseMiddle),
  'Última arrancada!',
  'Parabéns! A festinha está logo ali!'
];
const MARQUEE_INFO_MESSAGES = [
  'Vem comemorar comigo',
  'Vai ter churrasco',
  'Pode trazer a família',
  'Vai ser muito divertido'
];

function setupStoryMarquee() {
  const marquee = $('#storyMarquee');
  if (!marquee) return;
  const createSequence = (hidden = false) => {
    const sequence = document.createElement('div');
    sequence.className = 'marquee-sequence';
    if (hidden) sequence.setAttribute('aria-hidden', 'true');
    GAME_PROGRESS_MESSAGES.forEach((gameMessage, index) => {
      const info = document.createElement('span');
      info.textContent = MARQUEE_INFO_MESSAGES[index % MARQUEE_INFO_MESSAGES.length];
      const firstSeparator = document.createElement('b');
      firstSeparator.textContent = index % 2 ? '♥' : '★';
      firstSeparator.setAttribute('aria-hidden', 'true');
      const game = document.createElement('span');
      game.textContent = gameMessage;
      const secondSeparator = document.createElement('b');
      secondSeparator.textContent = index % 2 ? '★' : '♥';
      secondSeparator.setAttribute('aria-hidden', 'true');
      sequence.append(info, firstSeparator, game, secondSeparator);
    });
    return sequence;
  };
  const sequence = createSequence();
  marquee.replaceChildren(sequence, createSequence(true));
  const syncMarqueePace = () => {
    const duration = Math.max(60, sequence.scrollWidth / 130);
    marquee.style.setProperty('--marquee-duration', `${duration.toFixed(2)}s`);
  };
  requestAnimationFrame(syncMarqueePace);
  document.fonts?.ready?.then(syncMarqueePace);
}
setupStoryMarquee();
const GROUND_SURFACE_OFFSET = 0;
const CRAWL_VISUAL_BOTTOM_OFFSET = 10 - 128 * (30 / 600);

function getGameMessageAt(progress) {
  const normalized = Math.max(0, Math.min(.999999, progress));
  return GAME_PROGRESS_MESSAGES[Math.floor(normalized * GAME_PROGRESS_MESSAGES.length)];
}

function resetGame(seed = randomLevelSeed()) {
  createProceduralLevel(seed);
  player = {
    x: 90, y: GROUND_Y, vx: 0, vy: 0, grounded: true, score: 0, hitTimer: 0, obstacleLockRight: null,
    slowdownRemaining: 0, baseSpeed: 0, targetSpeed: 0, pickupReaction: null, pickupReactionStartedAt: 0,
    jumpAnimationElapsed: 0, landingAnimationRemaining: 0,
    jumpsUsed: 0, jumpHold: 0, power: null, powerRemaining: 0, speedBoostRemaining: 0, speedBoostExitGrace: false, flightTargetY: 220, minimumY: GROUND_Y,
    lives: 3, notice: '', noticeRemaining: 0, winStatus: '', scoreStatus: '', elapsedTime: 0, lastCollisionType: null
  };
  stars = initialStars.map((star, index) => ({ ...star, taken: false, pulse: index }));
  platforms.forEach((platform, index) => stars.push(moveStarClearOfPlatforms({ x: platform.x + platform.w / 2, y: platform.y - 58, taken: false, pulse: index + initialStars.length, platformStar: true })));
  powerups = initialPowerups.map((item) => ({ ...item, taken: false }));
  seenPowerDialogues = new Set();
  cameraX = 0;
  gameWon = false;
  gameOver = false;
  stageLabel.textContent = 'Engatinhando';
  scoreLabel.textContent = '0';
  timeLabel.textContent = '0:00.00';
  canvas.dataset.stage = 'Engatinhando';
  canvas.dataset.score = '0';
  canvas.dataset.won = 'false';
  canvas.dataset.distance = '0';
  canvas.dataset.airborne = 'false';
  canvas.dataset.sprite = 'crawl';
  canvas.dataset.crawlFrame = '0';
  canvas.dataset.walkFrame = '-1';
  canvas.dataset.jumpFrame = '-1';
  canvas.dataset.flightFrame = '-1';
  canvas.dataset.animationMode = 'crawl';
  canvas.dataset.power = 'none';
  canvas.dataset.jumpsUsed = '0';
  canvas.dataset.lives = '3';
  canvas.dataset.gameOver = 'false';
  canvas.dataset.elapsedMs = '0';
  $('#powerLabel').textContent = 'Nenhum';
  $('#livesLabel').textContent = '❤️❤️❤️';
  $('#livesStatus').dataset.empty = 'false';
  $('#powerMeter').style.setProperty('--power-progress', '0%');
  canvas.setAttribute('aria-label', 'Jogo do Nick. Fase: Engatinhando. Estrelinhas: 0.');
}
resetGame();

function getSpeedAt(x) {
  if (x < CRAWL_END_X) {
    const progress = Math.max(0, Math.min(1, x / CRAWL_END_X));
    return SPEED_PROFILE.crawlStart + (SPEED_PROFILE.crawlEnd - SPEED_PROFILE.crawlStart) * progress;
  }
  const progress = Math.max(0, Math.min(1, (x - CRAWL_END_X) / (WORLD_WIDTH - CRAWL_END_X)));
  return SPEED_PROFILE.walkStart + (SPEED_PROFILE.walkEnd - SPEED_PROFILE.walkStart) * progress;
}

function getStage() {
  if (player.x < CRAWL_END_X) return { name: 'Engatinhando', speed: getSpeedAt(player.x), index: 0 };
  return { name: 'Andando', speed: getSpeedAt(player.x), index: 1 };
}

function showGameDialogue(text, { hint = '', buttonLabel = 'Continuar', onContinue = null, reactionType = 'talk' } = {}) {
  clearInterval(dialogueTimer);
  gameStarted = false;
  dialogueTyping = true;
  dialogueFullText = text;
  const textElement = $('#gameDialogueText');
  const hintElement = $('#gameDialogueHint');
  const startButton = $('#startGame');
  const dialogueImage = $('#gameDialogue > img');
  const reactionImages = {
    talk: versionedGameFrame('/nick-7meses/assets/game/walk-frames/walk-21.png'),
    doubleJump: versionedGameFrame('/nick-7meses/assets/game/jump-frames/jump-11.png'),
    flight: versionedGameFrame('/nick-7meses/assets/game/flight-frames/flight-1.png'),
    life: versionedGameFrame('/nick-7meses/assets/game/crawl-frames/crawl-1.png'),
    speedBoost: versionedGameFrame('/nick-7meses/assets/game/walk-frames/walk-13.png')
  };
  $('#gameDialogue').hidden = false;
  $('#gameDialogue').dataset.reaction = reactionType;
  dialogueImage.src = reactionImages[reactionType] || reactionImages.talk;
  textElement.textContent = '';
  hintElement.textContent = hint;
  hintElement.hidden = !hint;
  startButton.textContent = buttonLabel;
  startButton.hidden = true;
  dialogueOnContinue = onContinue;
  let index = 0;
  dialogueTimer = setInterval(() => {
    index += 1;
    textElement.textContent = text.slice(0, index);
    if (index >= text.length) {
      finishDialogueTyping();
    }
  }, 34);
}

function finishDialogueTyping() {
  if (!dialogueTyping) return;
  clearInterval(dialogueTimer);
  $('#gameDialogueText').textContent = dialogueFullText;
  $('#startGame').hidden = false;
  dialogueTyping = false;
}

$('#gameDialogue').addEventListener('pointerdown', (event) => {
  if (!dialogueTyping) return;
  event.preventDefault();
  event.stopPropagation();
  finishDialogueTyping();
});

function beginGameDialogue() {
  if (dialogueTyping || gameStarted || initialGameDialogueShown) return;
  initialGameDialogueShown = true;
  showGameDialogue(GAME_DIALOGUE_TEXT, { buttonLabel: 'Vamos lá! Vou te ajudar a chegar na festinha!' });
}

function resizeCanvasForDpr() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.round(width * 420 / 960);
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 420, 0, 0);
}

function starPath(context, x, y, radius, points = 5) {
  context.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / points;
    const r = i % 2 ? radius * .45 : radius;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
  }
  context.closePath();
}

function canvasTextLines(text, maxWidth, maxLines = 2) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = word; }
  });
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:!?]?$/, '')}…`;
    return kept;
  }
  return lines;
}

function fitCanvasText(text, { maxWidth, maxLines = 2, startSize = 16, minSize = 11, weight = 800, family = 'DM Sans, sans-serif' }) {
  for (let size = startSize; size >= minSize; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    const lines = canvasTextLines(text, maxWidth, maxLines);
    if (lines.every((line) => ctx.measureText(line).width <= maxWidth)) return { lines, size };
  }
  ctx.font = `${weight} ${minSize}px ${family}`;
  return { lines: canvasTextLines(text, maxWidth, maxLines), size: minSize };
}

function drawCelebrationTicker() {
  const message = getGameMessageAt((player?.x || 0) / WORLD_WIDTH);
  canvas.dataset.gameMessage = message;
  ctx.save();
  ctx.shadowColor = 'rgba(12,50,109,.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(255,253,247,.92)'; ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(20, 18, 920, 78, 22); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#f6c84c'; starPath(ctx, 48, 56, 14); ctx.fill();
  ctx.fillStyle = '#0c326d'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const titleFit = fitCanvasText(CELEBRATION_TITLE, { maxWidth: 270, maxLines: 1, startSize: 20, minSize: 15, weight: 900, family: 'Fraunces, serif' });
  ctx.save(); ctx.beginPath(); ctx.rect(70, 30, 276, 52); ctx.clip(); ctx.font = `900 ${titleFit.size}px Fraunces, serif`; ctx.fillText(titleFit.lines[0], 72, 56); ctx.restore();
  ctx.fillStyle = 'rgba(223,242,255,.92)'; ctx.strokeStyle = 'rgba(21,81,161,.2)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(352, 29, 568, 54, 16); ctx.fill(); ctx.stroke();
  const fitted = fitCanvasText(message, { maxWidth: 526, maxLines: 2, startSize: 16, minSize: 11 });
  ctx.fillStyle = '#1551a1'; ctx.font = `800 ${fitted.size}px DM Sans, sans-serif`;
  ctx.save(); ctx.beginPath(); ctx.roundRect(362, 33, 548, 46, 12); ctx.clip();
  const lineHeight = fitted.size + 5;
  fitted.lines.forEach((line, index) => ctx.fillText(line, 372, fitted.lines.length === 1 ? 57 : 47 + index * lineHeight));
  ctx.restore();
  canvas.dataset.tickerFont = String(fitted.size);
  canvas.dataset.tickerLines = String(fitted.lines.length);
  canvas.dataset.tickerContained = String(fitted.lines.every((line) => ctx.measureText(line).width <= 526));
  ctx.restore();
}

function drawBackground(time) {
  ctx.clearRect(0, 0, 960, 420);
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#8fd4ff');
  sky.addColorStop(1, '#e8f7ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 420);

  // clouds
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = -1; i < 8; i += 1) {
    const drift = time * (.012 + (i % 3) * .0025);
    const x = ((((i * 310 - cameraX * .18 - drift) % 2500) + 2500) % 2500) - 130;
    const y = 55 + (i % 3) * 38;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.arc(x + 33, y - 12, 35, 0, Math.PI * 2);
    ctx.arc(x + 72, y, 27, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCelebrationTicker();

  // rolling hills
  ctx.fillStyle = '#b8df78';
  ctx.beginPath(); ctx.moveTo(0, 310);
  for (let x = 0; x <= 960; x += 80) ctx.quadraticCurveTo(x + 40, 260 + Math.sin((x + cameraX * .12) / 150) * 25, x + 80, 310);
  ctx.lineTo(960, 420); ctx.lineTo(0, 420); ctx.fill();
  ctx.fillStyle = '#82bf55';
  ctx.fillRect(0, GROUND_Y + GROUND_SURFACE_OFFSET, 960, 96);
  ctx.fillStyle = '#6a9c42';
  ctx.fillRect(0, GROUND_Y + GROUND_SURFACE_OFFSET, 960, 8);
}

function drawGift(obstacle) {
  const x = obstacle.x - cameraX;
  if (x < -200 || x > 1120) return;
  const y = GROUND_Y - obstacle.h + 16;
  if (obstacle.type === 5) {
    ctx.save();
    const cribTop = y + 5;
    const cribBottom = y + obstacle.h - 4;
    ctx.fillStyle = 'rgba(23,49,79,.16)';
    ctx.beginPath(); ctx.ellipse(x + obstacle.w / 2, y + obstacle.h + 7, obstacle.w * .46, 9, 0, 0, Math.PI * 2); ctx.fill();
    const wood = ctx.createLinearGradient(x, cribTop, x + obstacle.w, cribBottom);
    wood.addColorStop(0, '#fff8dc'); wood.addColorStop(.55, '#f7d982'); wood.addColorStop(1, '#e9b840');
    ctx.fillStyle = wood; ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x + 4, cribTop, obstacle.w - 8, obstacle.h - 16, 13); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dff4ff';
    ctx.beginPath(); ctx.roundRect(x + 13, y + obstacle.h * .53, obstacle.w - 26, obstacle.h * .25, 8); ctx.fill();
    ctx.strokeStyle = '#4f83d1'; ctx.lineWidth = 4;
    const railStart = x + 21;
    const railGap = Math.max(15, (obstacle.w - 42) / 7);
    for (let railX = railStart; railX <= x + obstacle.w - 20; railX += railGap) {
      ctx.beginPath(); ctx.moveTo(railX, cribTop + 13); ctx.lineTo(railX, y + obstacle.h * .56); ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(x + 10, y + obstacle.h * .48, obstacle.w - 20, 13, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ef7f31';
    ctx.beginPath(); ctx.roundRect(x + obstacle.w * .57, y + obstacle.h * .5, obstacle.w * .27, obstacle.h * .24, 7); ctx.fill();
    ctx.fillStyle = '#fff4d6'; ctx.beginPath(); ctx.arc(x + obstacle.w * .7, y + obstacle.h * .59, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f6c84c'; ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x, cribTop - 4, obstacle.w, 18, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1551a1';
    ctx.beginPath(); ctx.arc(x + 21, y + obstacle.h + 1, 8, 0, Math.PI * 2); ctx.arc(x + obstacle.w - 21, y + obstacle.h + 1, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + 21, y + obstacle.h + 1, 3, 0, Math.PI * 2); ctx.arc(x + obstacle.w - 21, y + obstacle.h + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (obstacle.type === 1) {
    ctx.fillStyle = '#4f83d1';
    ctx.beginPath(); ctx.ellipse(x + obstacle.w / 2, y + obstacle.h / 2, obstacle.w / 2, obstacle.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x + obstacle.w * .35, y + obstacle.h * .38, 8, 0, Math.PI * 2); ctx.arc(x + obstacle.w * .65, y + obstacle.h * .38, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#17314f';
    ctx.beginPath(); ctx.arc(x + obstacle.w * .35, y + obstacle.h * .38, 3, 0, Math.PI * 2); ctx.arc(x + obstacle.w * .65, y + obstacle.h * .38, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#17314f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + obstacle.w / 2, y + obstacle.h * .55, 12, .1, Math.PI - .1); ctx.stroke();
    return;
  }
  if (obstacle.type === 2) {
    ctx.fillStyle = '#f6c84c';
    ctx.beginPath(); ctx.ellipse(x + obstacle.w * .48, y + obstacle.h * .55, obstacle.w * .4, obstacle.h * .4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + obstacle.w * .72, y + obstacle.h * .28, obstacle.h * .24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef7f31'; ctx.beginPath(); ctx.moveTo(x + obstacle.w * .9, y + obstacle.h * .29); ctx.lineTo(x + obstacle.w * 1.08, y + obstacle.h * .38); ctx.lineTo(x + obstacle.w * .88, y + obstacle.h * .43); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#17314f'; ctx.beginPath(); ctx.arc(x + obstacle.w * .77, y + obstacle.h * .23, 3, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (obstacle.type === 3) {
    ctx.save();
    ctx.fillStyle = 'rgba(23,49,79,.14)';
    ctx.beginPath(); ctx.ellipse(x + obstacle.w / 2, y + obstacle.h + 5, obstacle.w * .45, 6, 0, 0, Math.PI * 2); ctx.fill();
    const cabinet = ctx.createLinearGradient(x, y, x + obstacle.w, y + obstacle.h);
    cabinet.addColorStop(0, '#fff0b8'); cabinet.addColorStop(.55, '#f6c84c'); cabinet.addColorStop(1, '#e8a62d');
    ctx.fillStyle = cabinet; ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x + 3, y + 2, obstacle.w - 6, obstacle.h - 8, 9); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8473f';
    ctx.beginPath(); ctx.roundRect(x, y, obstacle.w, 10, 5); ctx.fill(); ctx.stroke();
    const doorTop = y + 13;
    const doorHeight = Math.max(18, obstacle.h * .48);
    ctx.fillStyle = '#fff8dc';
    ctx.beginPath(); ctx.roundRect(x + 8, doorTop, obstacle.w / 2 - 10, doorHeight, 5); ctx.roundRect(x + obstacle.w / 2 + 2, doorTop, obstacle.w / 2 - 10, doorHeight, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4f83d1';
    ctx.beginPath(); ctx.arc(x + obstacle.w / 2 - 5, doorTop + doorHeight * .58, 2.8, 0, Math.PI * 2); ctx.arc(x + obstacle.w / 2 + 5, doorTop + doorHeight * .58, 2.8, 0, Math.PI * 2); ctx.fill();
    const drawerY = doorTop + doorHeight + 4;
    ctx.fillStyle = '#ef7f31';
    ctx.beginPath(); ctx.roundRect(x + 8, drawerY, obstacle.w - 16, Math.max(10, obstacle.h - (drawerY - y) - 11), 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + obstacle.w * .41, drawerY + 6); ctx.lineTo(x + obstacle.w * .59, drawerY + 6); ctx.stroke();
    ctx.fillStyle = '#1551a1'; ctx.fillRect(x + 8, y + obstacle.h - 7, 7, 8); ctx.fillRect(x + obstacle.w - 15, y + obstacle.h - 7, 7, 8);
    ctx.restore();
    return;
  }
  if (obstacle.type === 4) {
    ctx.save();
    const bottleLeft = x + obstacle.w * .22;
    const bottleWidth = obstacle.w * .56;
    const bottleTop = y + 11;
    const bottleHeight = obstacle.h - 11;
    ctx.fillStyle = 'rgba(23,49,79,.14)';
    ctx.beginPath(); ctx.ellipse(x + obstacle.w / 2, y + obstacle.h + 4, obstacle.w * .34, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef7f31'; ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + obstacle.w * .42, bottleTop); ctx.quadraticCurveTo(x + obstacle.w * .5, y - 9, x + obstacle.w * .58, bottleTop); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f6c84c';
    ctx.beginPath(); ctx.roundRect(x + obstacle.w * .31, y + 7, obstacle.w * .38, 12, 5); ctx.fill(); ctx.stroke();
    const glass = ctx.createLinearGradient(bottleLeft, bottleTop, bottleLeft + bottleWidth, bottleTop);
    glass.addColorStop(0, '#d5f3ff'); glass.addColorStop(.48, '#ffffff'); glass.addColorStop(1, '#9fdcf5');
    ctx.fillStyle = glass;
    ctx.beginPath(); ctx.roundRect(bottleLeft, bottleTop + 8, bottleWidth, bottleHeight - 8, 11); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(bottleLeft + 3, bottleTop + 11, bottleWidth - 6, bottleHeight - 14, 8); ctx.clip();
    ctx.fillStyle = '#fff1b2'; ctx.fillRect(bottleLeft + 3, y + obstacle.h * .55, bottleWidth - 6, obstacle.h);
    ctx.restore();
    ctx.strokeStyle = '#4f83d1'; ctx.lineWidth = 2;
    for (let mark = 0; mark < 3; mark += 1) {
      const markY = y + obstacle.h * (.45 + mark * .13);
      ctx.beginPath(); ctx.moveTo(bottleLeft + bottleWidth * .58, markY); ctx.lineTo(bottleLeft + bottleWidth * .82, markY); ctx.stroke();
    }
    ctx.strokeStyle = '#e8473f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(bottleLeft - 1, y + obstacle.h * .58, obstacle.w * .17, Math.PI * .55, Math.PI * 1.45);
    ctx.arc(bottleLeft + bottleWidth + 1, y + obstacle.h * .58, obstacle.w * .17, -Math.PI * .45, Math.PI * .45);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const cube = obstacle.w / 2;
  ['#e8473f', '#f6c84c', '#4f83d1'].forEach((color, index) => {
    const bx = x + (index === 2 ? cube * .5 : index * cube);
    const by = y + (index === 2 ? 0 : cube);
    ctx.fillStyle = color; ctx.strokeStyle = '#17314f'; ctx.lineWidth = 3;
    ctx.fillRect(bx, by, cube, cube); ctx.strokeRect(bx, by, cube, cube);
    ctx.fillStyle = '#fff'; ctx.font = '900 17px DM Sans'; ctx.textAlign = 'center'; ctx.fillText(['N','I','K'][index], bx + cube / 2, by + cube * .68);
  });
  ctx.textAlign = 'start';
}

function drawPlatform(platform) {
  const x = platform.x - cameraX;
  if (x < -platform.w - 30 || x > 990) return;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, platform.y, platform.w, 24, 12); ctx.clip();
  ctx.fillStyle = '#fff7d7'; ctx.fillRect(x, platform.y, platform.w, 24);
  const colors = ['#f6c84c', '#e8473f', '#4f83d1', '#82bf55'];
  for (let px = 8, i = 0; px < platform.w - 8; px += 34, i += 1) {
    ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(x + px, platform.y + 7, 22, 10);
  }
  ctx.restore();
  ctx.strokeStyle = '#1551a1'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(x, platform.y, platform.w, 24, 12); ctx.stroke();
}

function getPowerPosition(item, time) {
  if (item.type !== 'speedBoost') {
    const phase = item.phase || 0;
    const amplitude = item.type === 'doubleJump' ? { x: 16, y: 8 } : item.type === 'flight' ? { x: 14, y: 11 } : { x: 12, y: 8 };
    return {
      x: item.x + Math.sin(time * .0015 + phase) * amplitude.x,
      y: item.y + Math.cos(time * .0018 + phase * 1.2) * amplitude.y
    };
  }
  return {
    x: item.x + Math.sin(time * .009 + item.phase) * 105,
    y: item.y + Math.cos(time * .012 + item.phase * 1.3) * 62
  };
}

function getStarPosition(star, time) {
  if (star.difficulty !== 'precision') return { x: star.x, y: star.y };
  return {
    x: star.x + Math.sin(time * .0048 + star.phase) * 58,
    y: star.y + Math.cos(time * .0065 + star.phase) * 40
  };
}

function drawPowerup(item, time) {
  if (item.taken) return;
  const position = getPowerPosition(item, time);
  const x = position.x - cameraX;
  if (x < -60 || x > 1020) return;
  const pulse = 1 + Math.sin(time * .008 + item.x) * .05;
  ctx.save();
  ctx.translate(x, position.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = 'rgba(255,255,255,.88)';
  ctx.beginPath(); ctx.arc(0, 0, POWER_ICON_RADIUS, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(21,81,161,.28)'; ctx.lineWidth = 2; ctx.stroke();
  if (item.type === 'doubleJump') {
    const banana = ctx.createLinearGradient(-22, -18, 20, 15);
    banana.addColorStop(0, '#fff36a'); banana.addColorStop(.48, '#ffd632'); banana.addColorStop(1, '#e6a817');
    ctx.fillStyle = banana; ctx.strokeStyle = '#7a541b'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -15);
    ctx.bezierCurveTo(-17, 7, -2, 20, 14, 14);
    ctx.bezierCurveTo(23, 10, 27, 1, 22, -6);
    ctx.bezierCurveTo(12, 6, 1, 8, -7, 2);
    ctx.bezierCurveTo(-13, -3, -15, -10, -16, -16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.78)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.bezierCurveTo(-13, -8, -8, 7, 7, 11); ctx.stroke();
    ctx.strokeStyle = '#8d6425'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-18, -15); ctx.lineTo(-21, -20); ctx.moveTo(21, -5); ctx.lineTo(25, -9); ctx.stroke();
    ctx.fillStyle = '#a56a24';
    ctx.beginPath(); ctx.arc(-21, -20, 2.6, 0, Math.PI * 2); ctx.arc(25, -9, 2.4, 0, Math.PI * 2); ctx.fill();
  } else if (item.type === 'flight') {
    ctx.fillStyle = '#447f32'; ctx.strokeStyle = '#245221'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -23); ctx.bezierCurveTo(18, -15, 22, 9, 13, 20); ctx.bezierCurveTo(6, 28, -6, 28, -13, 20); ctx.bezierCurveTo(-22, 9, -18, -15, 0, -23); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b9db6a'; ctx.beginPath(); ctx.ellipse(0, 7, 13, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8d6425'; ctx.beginPath(); ctx.arc(0, 10, 8, 0, Math.PI * 2); ctx.fill();
  } else if (item.type === 'life') {
    ctx.strokeStyle = '#2f6fbe'; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(0, 7, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f6c84c'; ctx.beginPath(); ctx.roundRect(-16, -19, 32, 11, 6); ctx.fill();
    ctx.fillStyle = '#e8473f'; ctx.beginPath(); ctx.roundRect(-5, -10, 10, 10, 4); ctx.fill();
    ctx.fillStyle = '#72b84f'; ctx.beginPath(); ctx.arc(-13, 5, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#a96d3d'; ctx.strokeStyle = '#6f3f22'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 15, 14, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-16, 14, 7, 4, -.5, 0, Math.PI * 2); ctx.ellipse(16, 14, 7, 4, .5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-13, -14, 8, 0, Math.PI * 2); ctx.arc(13, -14, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -4, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9a06c'; ctx.beginPath(); ctx.ellipse(0, 4, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d1b12'; ctx.beginPath(); ctx.arc(-6, -7, 2.4, 0, Math.PI * 2); ctx.arc(6, -7, 2.4, 0, Math.PI * 2); ctx.arc(0, 2, 3.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPhotoHead(x, y, radius, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();
  if (nickPhoto.complete && nickPhoto.naturalWidth) {
    const sw = nickPhoto.naturalWidth * .55;
    const sh = nickPhoto.naturalHeight * .55;
    const sx = nickPhoto.naturalWidth * .28;
    const sy = nickPhoto.naturalHeight * .02;
    ctx.drawImage(nickPhoto, sx, sy, sw, sh, -radius, -radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = '#f2b68e';
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
  }
  ctx.restore();
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

function drawPickupReaction(type, progress, spriteHeight) {
  if (!type || progress < 0 || progress > 1) return;
  const colors = { doubleJump: '#f6c84c', flight: '#72b84f', life: '#e8473f', speedBoost: '#ef7f31' };
  ctx.save();
  ctx.fillStyle = colors[type] || '#f6c84c';
  for (let index = 0; index < 7; index += 1) {
    const angle = index / 7 * Math.PI * 2 + progress * 2.4;
    const radius = spriteHeight * (.34 + progress * .42);
    const size = Math.max(2, 7 * (1 - progress));
    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * radius, -spriteHeight * .5 + Math.sin(angle) * radius * .65, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function getAuraWarningProfile(remaining, time) {
  if (remaining > 2) return { warning: false, flashesPerSecond: 0, alpha: 1 };
  const urgency = Math.max(0, Math.min(1, (2 - remaining) / 2));
  const flashesPerSecond = 1.2 + urgency * 6.8;
  const pulse = Math.sin(time / 1000 * Math.PI * 2 * flashesPerSecond) > 0 ? 1 : .18;
  return { warning: true, flashesPerSecond, alpha: pulse * Math.min(1, remaining / .18) };
}

function drawNick(time) {
  const stage = getStage();
  const sampledTime = Math.floor(time / (1000 / CHARACTER_ANIMATION_FPS)) * (1000 / CHARACTER_ANIMATION_FPS);
  let mode = stage.index === 0 ? 'crawl' : 'walk';
  let frames = mode === 'crawl' ? crawlFrames : walkFrames;
  let poseProgress;
  let loops = true;
  if (player.power === 'flight') {
    mode = 'flight'; frames = flightFrames; poseProgress = sampledTime / (1000 / CHARACTER_ANIMATION_FPS);
  } else if (!player.grounded || player.landingAnimationRemaining > 0) {
    mode = 'jump'; frames = jumpFrames; loops = false;
    if (player.landingAnimationRemaining > 0) poseProgress = frames.length - 1;
    else if (player.jumpAnimationElapsed < .09) poseProgress = 0;
    else {
      const rawJumpPhase = Math.max(0, Math.min(.999, (player.vy - JUMP_IMPULSE) / (Math.abs(JUMP_IMPULSE) * 2)));
      const quantizedJumpPhase = Math.floor(rawJumpPhase * CHARACTER_ANIMATION_FPS) / CHARACTER_ANIMATION_FPS;
      poseProgress = 1 + quantizedJumpPhase * (frames.length - 2);
    }
  } else {
    const speedProgress = Math.max(0, Math.min(1, (stage.speed - SPEED_PROFILE.crawlStart) / (SPEED_PROFILE.walkEnd - SPEED_PROFILE.crawlStart)));
    const sourceRate = (mode === 'crawl' ? .78 : .88) + speedProgress * .34;
    const animationRate = sourceRate * (mode === 'walk' ? .5 : 1);
    poseProgress = sampledTime / (1000 / CHARACTER_ANIMATION_FPS) * animationRate;
  }
  const baseIndex = Math.floor(poseProgress);
  const frameIndex = loops ? baseIndex % frames.length : Math.min(frames.length - 1, baseIndex);
  const cyclePhase = poseProgress / frames.length;
  const bob = 0;
  const currentFrame = frames[frameIndex];

  const fallback = mode === 'crawl' ? nickSprites.crawl : nickSprites.walk;
  const sprite = currentFrame.complete && currentFrame.naturalWidth ? currentFrame : fallback;
  const spriteHeight = mode === 'crawl' ? 128 : mode === 'flight' ? 142 : 150;
  const spriteWidth = sprite.naturalWidth && sprite.naturalHeight ? spriteHeight * sprite.naturalWidth / sprite.naturalHeight : 110;
  canvas.dataset.sprite = mode;
  canvas.dataset.animationMode = mode;
  canvas.dataset.crawlFrame = mode === 'crawl' ? String(frameIndex) : '-1';
  canvas.dataset.walkFrame = mode === 'walk' ? String(frameIndex) : '-1';
  canvas.dataset.jumpFrame = mode === 'jump' ? String(frameIndex) : '-1';
  canvas.dataset.flightFrame = mode === 'flight' ? String(frameIndex) : '-1';
  canvas.dataset.animationTick = mode === 'jump' ? String(Math.floor(poseProgress * CHARACTER_ANIMATION_FPS)) : String(Math.floor(sampledTime / (1000 / CHARACTER_ANIMATION_FPS)));
  canvas.dataset.animationBlend = '0.000';
  canvas.dataset.spriteRenderHeight = String(spriteHeight);
  canvas.dataset.spritePivot = 'bottom-center';

  ctx.save();
  const damageAlpha = player.hitTimer > 0 && player.hitTimer < 2 && Math.floor(player.hitTimer * 12) % 2 ? .35 : 1;
  ctx.globalAlpha = damageAlpha;
  ctx.translate(player.x - cameraX, player.y + bob);
  const reactionProgress = (time - player.pickupReactionStartedAt) / 1100;
  if (reactionProgress >= 0 && reactionProgress <= 1) {
    if (player.pickupReaction === 'doubleJump') ctx.translate(0, -Math.sin(reactionProgress * Math.PI) * 15);
    if (player.pickupReaction === 'flight') ctx.rotate(-Math.sin(reactionProgress * Math.PI) * .13);
    if (player.pickupReaction === 'life') ctx.rotate(Math.sin(reactionProgress * Math.PI * 5) * .055);
    if (player.pickupReaction === 'speedBoost') ctx.translate(Math.sin(reactionProgress * Math.PI * 12) * 6, 0);
    drawPickupReaction(player.pickupReaction, reactionProgress, spriteHeight);
  }
  const wobble = 0;
  const auraCenterX = 0;
  const auraCenterY = mode === 'crawl' ? -43 : mode === 'flight' ? -59 : -55;
  if (player.power) {
    const powerColor = player.power === 'doubleJump' ? '#f6c84c' : player.power === 'flight' ? '#72b84f' : '#ef7f31';
    ctx.globalAlpha = damageAlpha * getAuraWarningProfile(player.powerRemaining, time).alpha;
    ctx.strokeStyle = `${powerColor}dd`; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(auraCenterX, auraCenterY, (mode === 'crawl' ? 58 : 64) + Math.sin(time * .01) * 4, 0, Math.PI * 2); ctx.stroke();
  }
  if (player.speedBoostRemaining > 0) {
    ctx.globalAlpha = damageAlpha * getAuraWarningProfile(player.speedBoostRemaining, time).alpha;
    ctx.strokeStyle = '#ef7f31dd'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(auraCenterX, auraCenterY, (mode === 'crawl' ? 67 : 73) + Math.sin(time * .013) * 5, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = damageAlpha;
  canvas.dataset.auraWarning = String((player.power && player.powerRemaining <= 2) || (player.speedBoostRemaining > 0 && player.speedBoostRemaining <= 2));
  canvas.dataset.auraCenter = `${auraCenterX.toFixed(1)},${auraCenterY.toFixed(1)}`;
  ctx.rotate(wobble);
  if (sprite.complete && sprite.naturalWidth) {
    ctx.globalAlpha = damageAlpha;
    ctx.drawImage(sprite, -spriteWidth * .5, -spriteHeight + 10, spriteWidth, spriteHeight);
  }
  ctx.restore();
}

function drawFinish() {
  const x = WORLD_WIDTH - 310 - cameraX;
  if (x < -300 || x > 1200) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 145, 105, 14, 248);
  ctx.fillStyle = '#e8473f';
  ctx.beginPath(); ctx.moveTo(x + 159, 112); ctx.lineTo(x + 265, 146); ctx.lineTo(x + 159, 180); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1551a1';
  ctx.font = '800 18px DM Sans';
  ctx.fillText('FESTA!', x + 177, 151);
  if (donaldImage.complete && donaldImage.naturalWidth) ctx.drawImage(donaldImage, x, 175, 185, 178);
}

function getBirdPosition(bird, time, { preview = false } = {}) {
  if (bird.mode === 'hover') {
    return {
      x: bird.x + Math.sin(time * .0012 + bird.phase) * 18,
      y: bird.baseY + Math.sin(time * .003 + bird.phase * 1.4) * 13
    };
  }
  return {
    x: preview ? bird.x - time / 1000 * bird.speed : bird.flightX,
    y: bird.baseY + Math.sin(time * .0023 + bird.phase * 1.4) * 16
  };
}

function updateFlyingBirds(dt) {
  flyingBirds.forEach((bird) => {
    if (bird.mode !== 'cross' || bird.flightFinished) return;
    if (!bird.flightStarted && bird.x - cameraX <= 1040 && bird.x - cameraX >= -80) bird.flightStarted = true;
    if (!bird.flightStarted) return;
    bird.flightX -= bird.speed * dt;
    if (bird.flightX - cameraX < -80) bird.flightFinished = true;
  });
}

function drawBird(bird, time) {
  if (bird.mode === 'cross' && (!bird.flightStarted || bird.flightFinished)) return;
  const position = getBirdPosition(bird, time);
  const x = position.x - cameraX;
  if (x < -80 || x > 1040) return;
  const tick = Math.floor(time / (1000 / CHARACTER_ANIMATION_FPS));
  const flap = Math.sin(tick * .82 + bird.phase);
  ctx.save(); ctx.translate(x, position.y);
  ctx.fillStyle = '#3f79bd'; ctx.strokeStyle = '#17314f'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5fa4dc';
  ctx.beginPath(); ctx.ellipse(3, -9 - flap * 8, 16, 7, -.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(7, 8 + flap * 5, 15, 6, .25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f6c84c'; ctx.beginPath(); ctx.moveTo(-21, -3); ctx.lineTo(-34, 2); ctx.lineTo(-20, 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-11, -5, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#17314f'; ctx.beginPath(); ctx.arc(-12, -5, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  canvas.dataset.birdFlap = flap.toFixed(3);
}

function drawWorld(time) {
  resizeCanvasForDpr();
  drawBackground(time);
  platforms.forEach(drawPlatform);
  stars.forEach((star) => {
    if (star.taken) return;
    const position = getStarPosition(star, time);
    const x = position.x - cameraX;
    if (x < -40 || x > 1000) return;
    const pulse = 1 + Math.sin(time * .006 + star.pulse) * .12;
    ctx.fillStyle = star.difficulty === 'precision' ? '#fff09a' : '#f6c84c';
    ctx.strokeStyle = star.difficulty === 'precision' ? '#e8473f' : '#c48b13';
    ctx.lineWidth = star.difficulty === 'precision' ? 3 : 2;
    starPath(ctx, x, position.y, (star.difficulty === 'precision' ? 14 : 17) * pulse);
    ctx.fill(); ctx.stroke();
  });
  powerups.forEach((item) => drawPowerup(item, time));
  flyingBirds.forEach((bird) => drawBird(bird, time));
  obstacles.forEach(drawGift);
  drawFinish();
  drawNick(time);

  if (gameWon) {
    ctx.fillStyle = 'rgba(12,50,109,.83)'; ctx.fillRect(190, 120, 580, 175);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '900 42px Fraunces'; ctx.fillText('Cheguei na minha festa!', 480, 188);
    ctx.font = '700 18px DM Sans'; ctx.fillText(`Tempo: ${formatGameTime(player.elapsedTime * 1000)} • Estrelinhas: ${player.score}`, 480, 220);
    ctx.font = '700 14px DM Sans'; ctx.fillText(player.winStatus || player.scoreStatus || 'Preparando seu resultado...', 480, 247);
    ctx.fillStyle = '#f6c84c'; ctx.beginPath(); ctx.roundRect(360, 260, 240, 34, 17); ctx.fill();
    ctx.fillStyle = '#0c326d'; ctx.font = '800 14px DM Sans'; ctx.fillText('Clique em Recomeçar', 480, 283);
    ctx.textAlign = 'start';
  }
}

function updatePowerUI() {
  const labels = { doubleJump: 'Pulo duplo', flight: 'Voo com o dedo' };
  const activePowers = [];
  if (player.power) activePowers.push(`${labels[player.power]} ${Math.ceil(player.powerRemaining)}s`);
  if (player.speedBoostRemaining > 0) activePowers.push(`Supervelocidade ${Math.ceil(player.speedBoostRemaining)}s`);
  $('#powerLabel').textContent = activePowers.length ? activePowers.join(' + ') : player.noticeRemaining > 0 ? player.notice : 'Nenhum';
  const primaryProgress = player.power ? player.powerRemaining / POWER_DURATION[player.power] * 100 : 0;
  const speedProgress = player.speedBoostRemaining > 0 ? player.speedBoostRemaining / POWER_DURATION.speedBoost * 100 : 0;
  const progress = Math.max(0, primaryProgress, speedProgress);
  $('#powerMeter').style.setProperty('--power-progress', `${progress}%`);
  canvas.dataset.power = [player.power, player.speedBoostRemaining > 0 ? 'speedBoost' : null].filter(Boolean).join('+') || 'none';
  const jumpButton = $('[data-control="jump"]');
  jumpButton.textContent = player.power === 'flight' ? 'ARRASTE O NICK ↕' : 'PULAR ↑';
  jumpButton.setAttribute('aria-label', player.power === 'flight' ? 'Arraste o Nick para controlar o voo' : 'Pular');
}

function updateLivesUI() {
  const empty = player.lives <= 0 && gameOver;
  $('#livesLabel').textContent = player.lives > 0 ? '❤️'.repeat(player.lives) : '';
  $('#livesStatus').dataset.empty = String(empty);
  canvas.dataset.lives = String(player.lives);
  canvas.dataset.gameOver = String(gameOver);
}

function releaseObstacleLockIfPassed() {
  if (player.obstacleLockRight !== null && getPlayerHitbox().left > player.obstacleLockRight + 4) player.obstacleLockRight = null;
}

function registerObstacleHit(obstacle, hitbox = null) {
  if (player.obstacleLockRight !== null || player.hitTimer > 0 || gameOver || player.power === 'flight' || player.speedBoostExitGrace) return;
  player.lives = Math.max(0, player.lives - 1);
  player.lastCollisionType = hitbox?.type ?? obstacle?.type ?? 'unknown';
  player.obstacleLockRight = hitbox?.right ?? (obstacle ? obstacle.x + obstacle.w : player.x + 30);
  player.hitTimer = 1.15;
  player.slowdownRemaining = HIT_SLOWDOWN_DURATION;
  player.x = Math.max(35, player.x - 55);
  player.vx *= .65;
  player.score = Math.max(0, player.score - 1);
  scoreLabel.textContent = String(player.score);
  if (player.lives === 0) {
    gameOver = true;
    showGameDialogue('Não consegui chegar na minha festinha. Vamos tentar de novo? Tenho certeza que você vai conseguir!', {
      buttonLabel: 'Tentar de novo',
      onContinue: () => { resetGame(); gameStarted = true; }
    });
  }
  updateLivesUI();
}

function collectLifePower() {
  player.lives = Math.min(5, player.lives + 1);
  player.notice = 'Mordedor: +1 vida!';
  player.noticeRemaining = 3;
  updateLivesUI();
  updatePowerUI();
}

const PICKUP_DIALOGUES = {
  doubleJump: {
    text: 'Eu adoro bananinha! Agora eu vou pular fácil por todos esses obstáculos!',
    hint: 'Toque para pular e toque novamente no ar para usar o pulo duplo.'
  },
  flight: {
    text: 'Abacate é DELICIOSO! Parece que eu estou na nuvens. Pera. O que é isso?',
    hint: 'Pressione o dedo sobre o jogo e arraste para cima e para baixo para ajustar o voo.'
  },
  life: {
    text: 'Esse mordedor era tudo que eu precisava! Meu dentinho tá nascendo e não consigo ficar sem ele!',
    hint: 'Você ganhou +1 ❤️.'
  },
  speedBoost: {
    text: 'Meu ursinho veio comigo! Agora eu vou chegar muito mais rápido na festinha!',
    hint: 'Supervelocidade ativada por 6 segundos.'
  }
};

function collectPickup(type) {
  if (type === 'life') collectLifePower(); else activatePower(type);
  player.pickupReaction = type;
  player.pickupReactionStartedAt = performance.now();
  if (!powerTutorialEnabled || seenPowerDialogues.has(type)) return;
  seenPowerDialogues.add(type);
  const dialogue = PICKUP_DIALOGUES[type];
  showGameDialogue(dialogue.text, { hint: dialogue.hint, buttonLabel: 'Continuar', reactionType: type });
}

function activatePower(type) {
  if (type === 'speedBoost') {
    player.speedBoostRemaining = POWER_DURATION.speedBoost;
    player.speedBoostExitGrace = false;
    updatePowerUI();
    return;
  }
  player.power = type;
  player.powerRemaining = POWER_DURATION[type];
  if (type === 'flight') {
    player.flightTargetY = Math.min(player.y, 220);
    player.vy = 0;
    player.grounded = false;
  }
  updatePowerUI();
}

function jumpPress() {
  if (player.power === 'flight') return;
  const allowedJumps = player.power === 'doubleJump' ? 2 : 1;
  if (player.grounded || player.jumpsUsed < allowedJumps) {
    player.vy = JUMP_IMPULSE * (player.jumpsUsed > 0 ? .94 : 1);
    player.grounded = false;
    player.jumpsUsed += 1;
    player.jumpHold = 0;
    player.jumpAnimationElapsed = 0;
    player.landingAnimationRemaining = 0;
    keys.jumpHeld = true;
  }
}
function jumpRelease() { keys.jumpHeld = false; }

async function handleGameWin() {
  player.winStatus = 'Você ganhou um brinde muito especial!';
}

function formatGameTime(durationMs) {
  const totalSeconds = Math.max(0, durationMs) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds % 1) * 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function renderLeaderboard(entries = []) {
  const body = $('#leaderboardBody');
  body.textContent = '';
  entries.forEach((entry) => {
    const row = document.createElement('tr');
    const values = [`${entry.position}º`, entry.name, formatGameTime(entry.durationMs), String(entry.stars)];
    values.forEach((value) => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    body.append(row);
  });
  $('#leaderboardEmpty').hidden = entries.length > 0;
  $('#leaderboardTable').hidden = entries.length === 0;
}

async function loadLeaderboard() {
  try {
    const response = await fetch('/nick-7meses/api/score', { cache: 'no-store' });
    if (!response.ok) throw new Error('leaderboard-unavailable');
    const result = await response.json();
    renderLeaderboard(result.leaderboard || []);
  } catch {
    $('#leaderboardEmpty').textContent = 'Não consegui carregar o ranking agora.';
  }
}

async function submitLeaderboardScore({ scrollToLeaderboard = true } = {}) {
  const rsvpToken = localStorage.getItem('nickRsvpToken');
  const name = localStorage.getItem('nickRsvpName');
  if (!rsvpToken || !name) {
    player.scoreStatus = 'Confirme sua presença para entrar no ranking.';
    return;
  }
  const durationMs = Math.round(player.elapsedTime * 1000);
  player.scoreStatus = 'Salvando seu tempo no ranking...';
  try {
    const response = await fetch('/nick-7meses/api/score', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvpToken, name, durationMs, stars: player.score })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'score-failed');
    player.scoreStatus = result.position ? `Você ficou em ${result.position}º lugar!` : 'Seu tempo foi registrado!';
    const personal = $('#leaderboardPersonal');
    personal.textContent = `${result.best.name}: ${formatGameTime(result.best.durationMs)} e ${result.best.stars} estrelinhas. Posição: ${result.position || 'calculando'}.`;
    personal.hidden = false;
    renderLeaderboard(result.leaderboard || []);
    if (scrollToLeaderboard) $('#placar').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return result;
  } catch {
    player.scoreStatus = 'Não consegui salvar o ranking agora.';
    return null;
  }
}
loadLeaderboard();

async function finalizeGameIdentity() {
  if (!gameWon || !localStorage.getItem('nickRsvpToken')) return false;
  player.scoreStatus = 'Salvando seu resultado no ranking...';
  await submitLeaderboardScore({ scrollToLeaderboard: false });
  await handleGameWin();
  if (!gameIdentityModal.hidden) setTimeout(closeGameIdentityModal, 900);
  return true;
}

async function handleGameCompletion() {
  await identityRestorePromise;
  if (localStorage.getItem('nickRsvpToken')) return finalizeGameIdentity();
  player.scoreStatus = 'Confirme sua presença para entrar no ranking.';
  player.winStatus = '';
  openGameIdentityModal();
  return false;
}

function updatePlayerSpeed(dt, stage) {
  const baseDesired = stage.speed * (player.speedBoostRemaining > 0 ? SPEED_BOOST_MULTIPLIER : 1);
  const desired = baseDesired * (player.slowdownRemaining > 0 ? HIT_SLOWDOWN_MULTIPLIER : 1);
  player.baseSpeed = baseDesired;
  player.targetSpeed = desired;
  canvas.dataset.speed = desired.toFixed(1);
  canvas.dataset.slowdown = player.slowdownRemaining > 0 ? player.slowdownRemaining.toFixed(2) : '0';
  player.vx += Math.max(-850 * dt, Math.min(850 * dt, desired - player.vx));
  if (player.slowdownRemaining > 0) player.slowdownRemaining = Math.max(0, player.slowdownRemaining - dt);
}

function updateGame(dt) {
  if (!gameActive || !gameStarted || gameWon || gameOver) return;
  player.elapsedTime += dt;
  timeLabel.textContent = formatGameTime(player.elapsedTime * 1000);
  const stage = getStage();
  stageLabel.textContent = stage.name;
  canvas.dataset.stage = stage.name;
  updatePlayerSpeed(dt, stage);

  if (player.power) {
    player.powerRemaining = Math.max(0, player.powerRemaining - dt);
    if (player.powerRemaining === 0) {
      player.power = null;
    }
  }
  if (player.speedBoostRemaining > 0) {
    player.speedBoostRemaining = Math.max(0, player.speedBoostRemaining - dt);
    if (player.speedBoostRemaining === 0) player.speedBoostExitGrace = true;
  }
  if (player.noticeRemaining > 0) player.noticeRemaining = Math.max(0, player.noticeRemaining - dt);

  const previousY = player.y;
  const wasGrounded = player.grounded;
  if (player.power === 'flight') {
    const nextY = player.y + (player.flightTargetY - player.y) * Math.min(1, dt * 6.5);
    player.vy = (nextY - player.y) / Math.max(dt, .001);
    player.y = nextY;
    player.grounded = false;
  } else {
    if (keys.jumpHeld && player.vy < 0 && player.jumpHold < MAX_JUMP_HOLD) {
      player.vy += JUMP_HOLD_ACCEL * dt;
      player.jumpHold += dt;
    }
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
  }

  player.x += player.vx * dt;
  player.x = Math.max(35, Math.min(WORLD_WIDTH - 145, player.x));

  if (player.power !== 'flight') {
    let landingY = GROUND_Y;
    const playerHitbox = getPlayerHitbox();
    platforms.forEach((platform) => {
      const overPlatform = player.x + playerHitbox.footHalfWidth > platform.x && player.x - playerHitbox.footHalfWidth < platform.x + platform.w;
      const crossedTop = previousY <= platform.y + 3 && player.y >= platform.y && player.vy >= 0;
      if (overPlatform && crossedTop) landingY = Math.min(landingY, platform.y);
    });
    if (player.y >= landingY) {
      player.y = landingY;
      player.vy = 0;
      player.grounded = true;
      if (!wasGrounded) player.landingAnimationRemaining = LANDING_ANIMATION_SECONDS;
      player.jumpsUsed = 0;
      keys.jumpHeld = false;
    } else {
      player.grounded = false;
    }
  }
  if (!player.grounded && player.power !== 'flight') player.jumpAnimationElapsed += dt;
  if (player.landingAnimationRemaining > 0) player.landingAnimationRemaining = Math.max(0, player.landingAnimationRemaining - dt);
  player.minimumY = Math.min(player.minimumY, player.y);

  if (player.hitTimer > 0) player.hitTimer -= dt;
  releaseObstacleLockIfPassed();
  updateFlyingBirds(dt);
  let overlapsObstacle = false;
  const playerHitbox = getPlayerHitbox();
  obstacles.forEach((obstacle) => {
    const obstacleHitbox = getObstacleHitbox(obstacle);
    const collides = hitboxesOverlap(playerHitbox, obstacleHitbox);
    if (collides) overlapsObstacle = true;
    if (collides && player.hitTimer <= 0 && player.power !== 'flight' && !player.speedBoostExitGrace) {
      registerObstacleHit(obstacle, obstacleHitbox);
    }
  });
  if (player.speedBoostExitGrace && !overlapsObstacle) player.speedBoostExitGrace = false;
  if (birdCollisionsEnabled) flyingBirds.forEach((bird) => {
    if (bird.mode === 'cross' && (!bird.flightStarted || bird.flightFinished)) return;
    const position = getBirdPosition(bird, currentGameFrameTime);
    const birdHitbox = getBirdHitbox(bird, position);
    if (hitboxesOverlap(getPlayerHitbox(), birdHitbox) && player.hitTimer <= 0 && player.power !== 'flight') {
      registerObstacleHit({ x: birdHitbox.left, w: birdHitbox.right - birdHitbox.left }, birdHitbox);
    }
  });

  stars.forEach((star) => {
    const position = getStarPosition(star, currentGameFrameTime);
    const collectRadius = star.difficulty === 'precision' ? 28 : 58;
    if (!star.taken && Math.hypot(player.x - position.x, (player.y - 52) - position.y) < collectRadius) {
      star.taken = true;
      player.score += 1;
      scoreLabel.textContent = String(player.score);
    }
  });
  powerups.forEach((item) => {
    const position = getPowerPosition(item, currentGameFrameTime);
    const collectRadius = item.type === 'speedBoost' ? 30 : item.type === 'life' ? 60 : POWER_COLLECT_RADIUS;
    const prerequisiteMet = !item.prerequisite || player.power === item.prerequisite;
    if (!item.taken && prerequisiteMet && Math.hypot(player.x - position.x, (player.y - 52) - position.y) < collectRadius) {
      item.taken = true;
      collectPickup(item.type);
    }
  });

  cameraX += ((player.x - 260) - cameraX) * Math.min(1, dt * 4.5);
  cameraX = Math.max(0, Math.min(WORLD_WIDTH - 960, cameraX));
  if (player.x > WORLD_WIDTH - 220 && !gameWon) {
    gameWon = true;
    handleGameCompletion();
  }
  canvas.dataset.distance = String(Math.round(player.x));
  canvas.dataset.airborne = String(!player.grounded);
  canvas.dataset.jumpsUsed = String(player.jumpsUsed);
  canvas.dataset.score = String(player.score);
  canvas.dataset.won = String(gameWon);
  canvas.dataset.playerY = String(Math.round(player.y));
  canvas.dataset.elapsedMs = String(Math.round(player.elapsedTime * 1000));
  updateLivesUI();
  updatePowerUI();
  canvas.setAttribute('aria-label', gameWon
    ? `Jogo concluído. Nick chegou à festa com ${player.score} estrelinhas.`
    : `Jogo do Nick. Fase: ${stage.name}. Estrelinhas: ${player.score}. Poder: ${$('#powerLabel').textContent}.`);
}

function gameLoop(time) {
  const dt = Math.min((time - lastTime) / 1000, .04);
  lastTime = time;
  currentGameFrameTime = time;
  updateGame(dt);
  drawWorld(time);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);

function setFlightTargetFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const target = (event.clientY - rect.top) * 420 / rect.height;
  player.flightTargetY = Math.max(90, Math.min(GROUND_Y - 28, target));
}

window.addEventListener('keydown', (event) => {
  if (!['ArrowUp', ' '].includes(event.key) || document.activeElement?.tagName === 'INPUT') return;
  event.preventDefault();
  if (!event.repeat) jumpPress();
});
window.addEventListener('keyup', (event) => {
  if (!['ArrowUp', ' '].includes(event.key)) return;
  event.preventDefault();
  jumpRelease();
});
$$('[data-control="jump"]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture?.(event.pointerId); jumpPress(); });
  button.addEventListener('pointerup', (event) => { event.preventDefault(); jumpRelease(); });
  button.addEventListener('pointercancel', jumpRelease);
  button.addEventListener('pointerleave', (event) => { if (!event.buttons) jumpRelease(); });
});
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  requestGameFullscreenFromGesture();
  canvas.setPointerCapture?.(event.pointerId);
  if (player.power === 'flight') setFlightTargetFromPointer(event); else jumpPress();
});
canvas.addEventListener('pointermove', (event) => {
  if (player.power === 'flight' && event.buttons) {
    event.preventDefault();
    setFlightTargetFromPointer(event);
  }
});
canvas.addEventListener('pointerup', (event) => {
  event.preventDefault();
  jumpRelease();
});
canvas.addEventListener('pointercancel', jumpRelease);

function simulateJump(holdMs) {
  const step = 1 / 240;
  const holdSeconds = Math.min(MAX_JUMP_HOLD, holdMs / 1000);
  let y = GROUND_Y;
  let vy = JUMP_IMPULSE;
  let elapsed = 0;
  let minimumY = y;
  while (elapsed < 3) {
    if (elapsed < holdSeconds && vy < 0) vy += JUMP_HOLD_ACCEL * step;
    vy += GRAVITY * step;
    y += vy * step;
    elapsed += step;
    minimumY = Math.min(minimumY, y);
    if (y >= GROUND_Y && elapsed > .08) break;
  }
  return { height: Math.round((GROUND_Y - minimumY) * 10) / 10, airtime: Math.round(elapsed * 1000) / 1000 };
}

function densityByThird(items) {
  const counts = [0, 0, 0];
  items.forEach((item) => { counts[Math.min(2, Math.floor(item.x / (WORLD_WIDTH / 3)))] += 1; });
  return { early: counts[0], middle: counts[1], final: counts[2] };
}

window.__nickGameDebug = {
  getConfig: () => ({
    worldWidth: WORLD_WIDTH,
    crawlEndX: CRAWL_END_X,
    estimatedSeconds: Math.round((
      CRAWL_END_X / (SPEED_PROFILE.crawlEnd - SPEED_PROFILE.crawlStart) * Math.log(SPEED_PROFILE.crawlEnd / SPEED_PROFILE.crawlStart)
      + (WORLD_WIDTH - CRAWL_END_X) / (SPEED_PROFILE.walkEnd - SPEED_PROFILE.walkStart) * Math.log(SPEED_PROFILE.walkEnd / SPEED_PROFILE.walkStart)
    ) * 10) / 10,
    stages: ['Engatinhando', 'Andando'],
    obstacleCount: obstacles.length,
    platformCount: platforms.length,
    powerTypes: [...new Set(initialPowerups.map((item) => item.type))],
    powerObjects: { doubleJump: 'banana', flight: 'avocado', life: 'teether', speedBoost: 'teddy' },
    powerCounts: Object.fromEntries([...new Set(initialPowerups.map((item) => item.type))].map((type) => [type, initialPowerups.filter((item) => item.type === type).length])),
    speedBoostMultiplier: SPEED_BOOST_MULTIPLIER,
    difficultStarCount: DIFFICULT_STAR_INDICES.size,
    difficulty: { earlyGap: DIFFICULTY_GAPS.early, middleGap: DIFFICULTY_GAPS.middle, finalGap: DIFFICULTY_GAPS.final },
    speedProfile: { start: SPEED_PROFILE.crawlStart, early: Math.round(getSpeedAt(1000)), middle: Math.round(getSpeedAt(28000)), final: Math.round(getSpeedAt(55000)) },
    obstacleDensity: densityByThird(obstacles),
    starDensity: densityByThird(initialStars),
    showsObstacleWarning: false,
    powerItemLabels: false,
    powerIconRadius: POWER_ICON_RADIUS,
    powerCollectRadius: POWER_COLLECT_RADIUS,
    crawlFrameCount: crawlFrames.length,
    walkFrameCount: walkFrames.length,
    flightFrameCount: flightFrames.length,
    jumpFrameCount: jumpFrames.length,
    frameAssetsReady: [...crawlFrames, ...walkFrames, ...flightFrames, ...jumpFrames].every((frame) => frame.complete && frame.naturalWidth > 0),
    powerTextOnNick: false,
    crawlEyesFixed: true,
    powerDialoguesOnce: true,
    powerTutorialEnabled,
    musicEnabled,
    partyFlags: false,
    celebrationTitle: CELEBRATION_TITLE,
    groundGap: Math.max(0, Math.round(((GROUND_Y + GROUND_SURFACE_OFFSET) - (GROUND_Y + CRAWL_VISUAL_BOTTOM_OFFSET)) * 10) / 10),
    platformDecorClipped: true,
    hitSlowdown: { duration: HIT_SLOWDOWN_DURATION, multiplier: HIT_SLOWDOWN_MULTIPLIER },
    firstDuck: (() => {
      const duck = obstacles.find((obstacle) => obstacle.beginnerFriendly);
      return { x: duck.x, width: duck.w, height: duck.h, clearance: Math.round((simulateJump(60).height - (duck.h - 16)) * 10) / 10 };
    })(),
    animationFps: CHARACTER_ANIMATION_FPS,
    frameInterpolation: false,
    distinctFramesByAnimation: { crawl: 24, walk: 6, flight: 24, jump: 24 },
    frameGeneration: { crawl: 'motion-compensated-no-crossfade', walk: WALK_ANIMATION_SOURCE, flight: 'motion-compensated-no-crossfade', jump: 'motion-compensated-no-crossfade' },
    walkSourceFrames: true,
    walkPlaybackScale: .5,
    sharedWalkJumpCanvas: true,
    sharedWalkJumpRenderHeight: 150,
    spritePivot: 'bottom-center',
    opaqueFramesOnly: true,
    walkWhiteArtifactsFixed: true,
    walkHeadStabilized: false,
    headStabilizedActions: 3,
    crawlBobAmplitude: 0,
    walkBobAmplitude: 0,
    flightBobAmplitude: 0,
    walkWobbleRadians: 0,
    flightWobbleRadians: 0,
    auraCentered: true,
    pickupReactions: ['doubleJump','flight','life','speedBoost'],
    cloudDrift: true,
    birdObstacleCount: flyingBirds.length,
    hazardousBirdCount: flyingBirds.length,
    birdCollisionMode: 'all-active',
    crossBirdsDecorative: false,
    birdDirection: 'right-to-left',
    birdModes: Object.fromEntries(['cross','hover'].map((mode) => [mode, flyingBirds.filter((bird) => bird.mode === mode).length])),
    birdHeightRange: { min: Math.min(...flyingBirds.map((bird) => bird.baseY)), max: Math.max(...flyingBirds.map((bird) => bird.baseY)) },
    cribObstacleCount: obstacles.filter((obstacle) => obstacle.type === 5).length,
    bridgePlatformCount: platforms.filter((platform) => platform.bridgeFor).length,
    speedBoostInvincible: false,
    auraWarningSeconds: 2,
    jumpAnticipationMs: 90,
    jumpLandingMs: Math.round(LANDING_ANIMATION_SECONDS * 1000),
    hitboxModel: 'aabb-visual-insets',
    starsInsidePlatforms: countStarsInsidePlatforms(),
    obstacleArtVersion: 2,
    procedural: { enabled: true, seeded: true, seed: currentLevelSeed, types: ['obstacles','stars','powers','birds'] }
  }),
  getSpeedAt,
  getGameMessages: () => [...GAME_PROGRESS_MESSAGES],
  getGameMessageAt,
  getPowerLayout: () => initialPowerups.map(({ x, y, type, challenge, prerequisite, platformIndex }) => {
    const platform = Number.isInteger(platformIndex) ? platforms[platformIndex] : null;
    return { x, y, type, challenge, prerequisite: prerequisite || null, platformIndex, platformY: platform?.y ?? null, requiredLift: platform ? (platform.y - 52) - y : null };
  }),
  getPowerPosition: (type, index = 0, time = 0) => {
    const item = initialPowerups.filter((entry) => entry.type === type)[index];
    return item ? getPowerPosition(item, time) : null;
  },
  getBirdPosition: (index = 0, time = null) => flyingBirds[index]
    ? getBirdPosition(flyingBirds[index], time ?? currentGameFrameTime, { preview: time !== null })
    : null,
  getLevelSnapshot: () => ({
    seed: currentLevelSeed,
    obstacles: obstacles.map(({ x, type, w, h, requiresBridge, runId }) => ({ x, type, w, h, requiresBridge: Boolean(requiresBridge), runId })),
    platforms: platforms.map(({ x, y, w, bridgeFor }) => ({ x, y, w, bridgeFor: bridgeFor || null })),
    stars: stars.map(({ x, y, difficulty, platformStar }) => ({ x, y, difficulty: difficulty || 'platform', platformStar: Boolean(platformStar) })),
    powers: initialPowerups.map(({ x, y, type, prerequisite }) => ({ x, y, type, prerequisite: prerequisite || null })),
    birds: flyingBirds.map(({ x, baseY, speed, travelSpan, mode, phase, flightX, flightStarted, flightFinished }) => ({
      x, baseY, speed, travelSpan, mode, phase, flightX, flightStarted, flightFinished
    }))
  }),
  getAuraWarningProfile,
  getHitboxes: () => ({
    player: getPlayerHitbox(),
    obstacles: obstacles.map((obstacle) => ({ ...getObstacleHitbox(obstacle), x: obstacle.x, w: obstacle.w, h: obstacle.h })),
    birds: flyingBirds
      .filter((bird) => bird.mode === 'hover' || (bird.flightStarted && !bird.flightFinished))
      .map((bird) => getBirdHitbox(bird, getBirdPosition(bird, currentGameFrameTime)))
  }),
  getStarPlatformConflicts: () => stars.filter((star) => platforms.some((platform) => starOverlapsPlatform(star, platform))).map(({ x, y, difficulty, platformStar }) => ({ x, y, difficulty: difficulty || 'platform', platformStar: Boolean(platformStar) })),
  getDifficultStars: () => initialStars.filter((star) => star.difficulty === 'precision').map(({ x, y, difficulty, phase }) => ({ x, y, difficulty, phase })),
  formatGameTime,
  simulateJump,
  analyzeLevel: () => {
    const shortJump = simulateJump(60);
    const longJump = simulateJump(MAX_JUMP_HOLD * 1000);
    const maximumJump = longJump.height;
    const maximumObstacleHeight = Math.max(...obstacles.map((obstacle) => obstacle.h - 16));
    const maximumCommonObstacleHeight = Math.max(...obstacles.filter((obstacle) => !obstacle.requiresBridge).map((obstacle) => obstacle.h - 16));
    const highestPlatformRise = Math.max(...platforms.map((platform) => GROUND_Y - platform.y));
    const obstacleGaps = obstacles.slice(1).map((obstacle, index) => ({
      gap: obstacle.x - (obstacles[index].x + obstacles[index].w),
      bridged: Boolean(obstacle.requiresBridge || obstacles[index].requiresBridge)
    }));
    const minimumReactionSeconds = Math.min(...obstacleGaps.filter((entry) => !entry.bridged).map((entry) => entry.gap)) / SPEED_PROFILE.walkEnd;
    const unreachablePlatforms = platforms.filter((platform) => GROUND_Y - platform.y > maximumJump - 12).map((platform) => platform.x);
    const impossibleObstacleGroups = obstacles.filter((obstacle, index) => index > 0 && obstacle.x - obstacles[index - 1].x < 175).map((obstacle) => obstacle.x);
    return {
      maximumJump,
      maximumObstacleHeight,
      maximumCommonObstacleHeight,
      highestPlatformRise,
      shortJumpObstacleClearance: Math.round((shortJump.height - maximumCommonObstacleHeight) * 10) / 10,
      bridgedLargeObstacles: obstacles.filter((obstacle) => obstacle.requiresBridge && platforms.some((platform) => platform.bridgeFor === obstacle.runId)).length,
      longJumpPlatformClearance: Math.round((longJump.height - highestPlatformRise) * 10) / 10,
      minimumReactionSeconds: Math.round(minimumReactionSeconds * 100) / 100,
      horizontalTravel: {
        shortCrawl: Math.round(shortJump.airtime * SPEED_PROFILE.crawlStart),
        longCrawl: Math.round(longJump.airtime * SPEED_PROFILE.crawlEnd),
        shortWalk: Math.round(shortJump.airtime * SPEED_PROFILE.walkStart),
        longWalk: Math.round(longJump.airtime * SPEED_PROFILE.walkEnd)
      },
      unreachablePlatforms,
      impossibleObstacleGroups
    };
  },
  resetAt: (x = 90) => { resetGame(currentLevelSeed || randomLevelSeed()); player.x = x; cameraX = Math.max(0, x - 260); gameActive = true; gameStarted = true; $('#gameDialogue').hidden = true; },
  resetWithSeed: (seed) => { resetGame(seed); gameActive = true; gameStarted = true; $('#gameDialogue').hidden = true; },
  completeGame: (durationMs = 274200, score = 0) => {
    resetGame(); gameActive = true; gameStarted = true; $('#gameDialogue').hidden = true;
    player.x = WORLD_WIDTH - 219; player.elapsedTime = durationMs / 1000; player.score = score; scoreLabel.textContent = String(score); timeLabel.textContent = formatGameTime(durationMs); gameWon = true; canvas.dataset.won = 'true'; canvas.dataset.elapsedMs = String(durationMs); handleGameCompletion();
  },
  activatePower,
  collectPickup,
  setMusicEnabled,
  advanceMusicTrack: advanceMusicPlaylist,
  setPowerTutorialEnabled,
  setBirdCollisionsEnabled: (enabled) => { birdCollisionsEnabled = Boolean(enabled); },
  getPreferences: () => ({
    musicEnabled,
    powerTutorialEnabled,
    musicPlaying: !nickMusic.paused,
    playlistIndex: currentMusicTrackIndex,
    playlistLength: MUSIC_PLAYLIST.length,
    currentTrack: MUSIC_PLAYLIST[currentMusicTrackIndex],
    playlist: [...MUSIC_PLAYLIST]
  }),
  hitObstacle: () => { player.hitTimer = 0; player.obstacleLockRight = null; registerObstacleHit({ x: player.x, w: 0 }); },
  contactObstacle: (obstacle) => registerObstacleHit(obstacle),
  expireHitTimer: () => { player.hitTimer = 0; },
  passLockedObstacle: () => {
    if (player.obstacleLockRight !== null) {
      const leftInset = player.x - getPlayerHitbox().left;
      player.x = player.obstacleLockRight + leftInset + 5;
    }
    releaseObstacleLockIfPassed();
  },
  advancePhysics: (seconds) => {
    let remaining = Math.max(0, seconds);
    while (remaining > 0) {
      const dt = Math.min(.04, remaining);
      player.elapsedTime += dt;
      updatePlayerSpeed(dt, getStage());
      remaining -= dt;
    }
  },
  stepGame: (seconds) => {
    let remaining = Math.max(0, seconds);
    gameActive = true; gameStarted = true; $('#gameDialogue').hidden = true;
    while (remaining > 0) {
      const dt = Math.min(.04, remaining);
      updateGame(dt);
      remaining -= dt;
    }
  },
  setPlayerState: (state = {}) => { Object.assign(player, state); },
  previewAnimationAt: (x) => { resetGame(); player.x = x; cameraX = Math.max(0, x - 260); player.hitTimer = 999; gameActive = true; gameStarted = true; $('#gameDialogue').hidden = true; },
  collectLife: collectLifePower,
  jumpPress,
  jumpRelease,
  setFlightTarget: (y) => { player.flightTargetY = Math.max(90, Math.min(GROUND_Y - 28, y)); },
  getState: () => ({ x: player.x, y: player.y, minimumY: player.minimumY, vy: player.vy, speed: player.targetSpeed, baseSpeed: player.baseSpeed, slowdownRemaining: player.slowdownRemaining, grounded: player.grounded, landingAnimationRemaining: player.landingAnimationRemaining, jumpsUsed: player.jumpsUsed, power: player.power, powerRemaining: player.powerRemaining, speedBoostRemaining: player.speedBoostRemaining, speedBoostExitGrace: player.speedBoostExitGrace, activePowers: [player.power, player.speedBoostRemaining > 0 ? 'speedBoost' : null].filter(Boolean), lives: player.lives, obstacleLocked: player.obstacleLockRight !== null, lastCollisionType: player.lastCollisionType, elapsedTime: player.elapsedTime, score: player.score, gameOver, gameWon, winStatus: player.winStatus, scoreStatus: player.scoreStatus })
};

$('#startGame').addEventListener('click', () => {
  requestGameFullscreenFromGesture();
  $('#gameDialogue').hidden = true;
  const continuation = dialogueOnContinue;
  dialogueOnContinue = null;
  if (continuation) continuation();
  if (!gameOver) gameStarted = true;
  lastTime = performance.now();
});
$('#restartGame').addEventListener('click', () => {
  resetGame();
  $('#gameDialogue').hidden = true;
  gameStarted = true;
  lastTime = performance.now();
});
function requestGameFullscreenFromGesture() {
  if (!matchMedia('(max-width: 980px) and (orientation: landscape)').matches || document.fullscreenElement) return;
  const shell = $('.game-shell');
  const request = shell.requestFullscreen || shell.webkitRequestFullscreen;
  if (!request) return;
  try {
    const result = request.call(shell, { navigationUI: 'hide' });
    Promise.resolve(result).then(() => setTimeout(stabilizeGameAfterViewportChange, 60)).catch(() => {});
  } catch {}
}

function syncGameViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--game-viewport-width', `${Math.round(viewport?.width || innerWidth)}px`);
  document.documentElement.style.setProperty('--game-viewport-height', `${Math.round(viewport?.height || innerHeight)}px`);
}
function fitGameCanvasToStage() {
  const root = document.documentElement;
  if (!matchMedia('(max-width: 980px) and (orientation: landscape)').matches) {
    root.style.removeProperty('--game-canvas-width');
    root.style.removeProperty('--game-canvas-height');
    return;
  }
  const stage = $('.game-stage').getBoundingClientRect();
  if (!stage.width || !stage.height) return;
  const aspect = 960 / 420;
  const width = Math.min(stage.width, stage.height * aspect);
  const height = width / aspect;
  root.style.setProperty('--game-canvas-width', `${Math.round(width)}px`);
  root.style.setProperty('--game-canvas-height', `${Math.round(height)}px`);
  canvas.dataset.displayAspect = (width / height).toFixed(4);
}
function stabilizeGameAfterViewportChange() {
  syncGameViewport();
  if (!gameActive || !matchMedia('(max-width: 980px)').matches) return;
  requestAnimationFrame(() => {
    document.body.classList.add('game-in-view');
    if (matchMedia('(orientation: portrait)').matches) {
      document.body.style.removeProperty('overflow');
      const shell = $('.game-shell');
      const shellRect = shell.getBoundingClientRect();
      if (shellRect.top > 130 || shellRect.bottom > window.innerHeight - 20) {
        const previous = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, window.scrollY + shellRect.top - 110);
        requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = previous; });
      }
    }
    fitGameCanvasToStage();
    resizeCanvasForDpr();
  });
}
syncGameViewport();
window.addEventListener('resize', stabilizeGameAfterViewportChange);
window.addEventListener('orientationchange', () => setTimeout(stabilizeGameAfterViewportChange, 120));
window.visualViewport?.addEventListener('resize', stabilizeGameAfterViewportChange);
document.addEventListener('fullscreenchange', stabilizeGameAfterViewportChange);
new IntersectionObserver((entries) => {
  const mobile = matchMedia('(max-width: 980px)').matches;
  const activationRatio = mobile ? .58 : .18;
  const intersectsGame = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= activationRatio);
  const landscape = matchMedia('(orientation: landscape)').matches;
  const keepLandscapeGame = mobile && landscape && document.body.classList.contains('game-in-view');
  gameActive = intersectsGame || keepLandscapeGame;
  document.body.classList.toggle('game-in-view', gameActive && mobile);
  if (intersectsGame && !gameStarted) beginGameDialogue();
  if (gameActive && mobile) requestAnimationFrame(stabilizeGameAfterViewportChange);
}, { threshold: [0, .18, .58] }).observe($('.game-shell'));

