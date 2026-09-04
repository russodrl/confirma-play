const WORLD_END = 12_000;
const GROUND_Y = 356;
const CHECKPOINTS = [1_700, 3_500, 5_300, 7_100, 8_900, 10_700];

export function createGameState() {
  return {
    running: false,
    won: false,
    stage: 'aguardando',
    x: 120,
    y: GROUND_Y,
    vy: 0,
    grounded: true,
    score: 0,
    referrals: 0,
    correctAnswers: 0,
    checkpoint: 0,
    power: null,
    powerUntil: 0,
    shield: 0,
    startedAt: null,
    finishedAt: null
  };
}

function memberOption(member) {
  return `${member.name}, ${member.company}`;
}

export function buildGameQuestions(member, allMembers) {
  const bySlug = (slug) => allMembers.find((item) => item.slug === slug);
  const visible = member.discoverability.position !== null;
  const sitePublished = Boolean(member.presence.website);
  const scenarios = [
    {
      prompt: 'Um restaurante quer um catering saudável para um evento empresarial. Quem deve receber a referência?',
      options: [bySlug('rui-andrade'), bySlug('daniel-cardoso'), bySlug('fatima-oliveira')],
      correct: 0,
      explanation: 'Rui Andrade representa a Fresca Inspiração na categoria de catering.'
    },
    {
      prompt: 'Uma PME procura implementar um ERP PHC. Quem pode ajudar?',
      options: [bySlug('joao-alves'), bySlug('francisco-baptista'), bySlug('miguel-beirao')],
      correct: 0,
      explanation: 'João Alves representa a Discurso Virtual na categoria de software ERP.'
    },
    {
      prompt: 'Uma empresa precisa de brindes e merchandising personalizados. Quem é a referência do grupo?',
      options: [bySlug('fatima-oliveira'), bySlug('luis-silva'), bySlug('luis-maciel')],
      correct: 0,
      explanation: 'Fátima Oliveira representa a Fatybrinde em merchandising personalizado.'
    }
  ];
  const selected = scenarios.map((question) => ({
    ...question,
    options: question.options.map(memberOption)
  }));
  return [
    {
      personalized: true,
      prompt: `Na pesquisa por “${member.discoverability.keyword}”, a ${member.company} apareceu entre os 10 resultados analisados?`,
      options: ['Sim', 'Não', 'A auditoria não pesquisou esse termo'],
      correct: visible ? 0 : 1,
      power: 'boost',
      explanation: member.discoverability.note
    },
    selected[0] && { ...selected[0], personalized: false, power: 'shield' },
    {
      personalized: true,
      prompt: `O perfil oficial da ${member.company} publica um website empresarial próprio?`,
      options: ['Sim', 'Não', 'Apenas um telefone'],
      correct: sitePublished ? 0 : 1,
      power: 'double',
      explanation: member.websiteAudit.note
    },
    selected[1] && { ...selected[1], personalized: false, power: 'boost' },
    {
      personalized: false,
      prompt: 'Qual pedido gera uma referência BNI mais fácil de reconhecer?',
      options: ['Qualquer pessoa que precise de mim', 'Responsáveis de compras de hotéis no Grande Porto', 'Alguém que queira crescer'],
      correct: 1,
      power: 'shield',
      explanation: 'Quanto mais específico for o pedido, mais fácil será lembrar da pessoa certa.'
    },
    selected[2] && { ...selected[2], personalized: false, power: 'double' }
  ].filter(Boolean);
}

export function answerCheckpoint(state, question, selectedIndex) {
  if (selectedIndex !== question.correct) return { ...state };
  return {
    ...state,
    score: state.score + 300,
    correctAnswers: state.correctAnswers + 1,
    power: question.power || state.power,
    shield: question.power === 'shield' ? state.shield + 1 : state.shield
  };
}

export function advanceGame(state, nextX, deltaMs) {
  const x = Math.max(state.x, Number(nextX) || state.x);
  const won = x >= WORLD_END;
  return {
    ...state,
    x,
    won,
    running: won ? false : state.running,
    stage: won ? 'podio' : x > WORLD_END * .72 ? 'reta-final' : x > WORLD_END * .35 ? 'conexoes' : 'referencias',
    finishedAt: won ? (state.finishedAt || (state.startedAt || 0) + Math.max(1, deltaMs || 1)) : state.finishedAt
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export class BNIGame {
  constructor({ canvas, member, members, faceImage, onQuestion, onFinish }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.member = member;
    this.questions = buildGameQuestions(member, members);
    this.faceImage = faceImage;
    this.onQuestion = onQuestion;
    this.onFinish = onFinish;
    this.state = createGameState();
    this.lastFrame = 0;
    this.questionOpen = false;
    this.finishSent = false;
    this.damageLock = 0;
    this.obstacles = [1_050, 2_500, 4_150, 5_950, 7_650, 9_400, 11_050].map((x, index) => ({ x, width: 88 + index % 2 * 18, height: 48 + index % 3 * 8, hit: false, label: ['INDICAÇÃO VAGA', 'SEM FOLLOW-UP', 'CONTATO FRIO'][index % 3] }));
    this.collectibles = Array.from({ length: 25 }, (_, index) => ({ x: 650 + index * 430, y: 250 - (index % 3) * 34, taken: false }));
    this.resize();
    this.draw(0);
  }

  resize() {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = 960 * ratio;
    this.canvas.height = 480 * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  start() {
    if (this.state.won) this.reset();
    this.state = { ...this.state, running: true, stage: 'referencias', startedAt: performance.now() };
    this.lastFrame = performance.now();
    requestAnimationFrame((time) => this.loop(time));
  }

  reset() {
    this.state = createGameState();
    this.obstacles.forEach((item) => { item.hit = false; });
    this.collectibles.forEach((item) => { item.taken = false; });
    this.questionOpen = false;
    this.finishSent = false;
    this.damageLock = 0;
    this.draw(performance.now());
  }

  jump() {
    if (!this.state.running || this.questionOpen) return;
    if (this.state.grounded) {
      this.state = { ...this.state, grounded: false, vy: -690 };
      return;
    }
    if (this.state.power === 'double' && performance.now() < this.state.powerUntil) this.state = { ...this.state, vy: -620, power: null };
  }

  answer(index) {
    if (!this.questionOpen) return;
    const question = this.questions[this.state.checkpoint];
    const correct = index === question.correct;
    this.state = answerCheckpoint(this.state, question, index);
    if (correct) {
      if (question.power === 'boost' || question.power === 'double') this.state.powerUntil = performance.now() + 7_000;
    }
    this.state.checkpoint += 1;
    this.questionOpen = false;
    this.onQuestion?.({ open: false, correct, explanation: question.explanation, power: correct ? question.power : null });
    setTimeout(() => {
      if (!this.state.won) {
        this.state.running = true;
        this.lastFrame = performance.now();
        requestAnimationFrame((time) => this.loop(time));
      }
    }, 850);
  }

  loop(time) {
    if (!this.state.running || this.questionOpen || this.state.won) return;
    const delta = Math.min(32, Math.max(0, time - this.lastFrame));
    this.lastFrame = time;
    this.update(delta, time);
    this.draw(time);
    if (this.state.running) requestAnimationFrame((next) => this.loop(next));
  }

  update(delta, time) {
    const boost = this.state.power === 'boost' && time < this.state.powerUntil;
    if (this.state.power && time >= this.state.powerUntil && this.state.power !== 'shield') this.state.power = null;
    const speed = boost ? 330 : 220;
    const nextX = this.state.x + speed * delta / 1000;
    let y = this.state.y;
    let vy = this.state.vy;
    let grounded = this.state.grounded;
    if (!grounded) {
      vy += 1_720 * delta / 1000;
      y += vy * delta / 1000;
      if (y >= GROUND_Y) { y = GROUND_Y; vy = 0; grounded = true; }
    }
    let next = advanceGame({ ...this.state, y, vy, grounded }, nextX, time - (this.state.startedAt || time));
    for (const item of this.collectibles) {
      if (!item.taken && Math.abs(item.x - next.x) < 55 && Math.abs(item.y - (next.y - 76)) < 95) {
        item.taken = true;
        next = { ...next, referrals: next.referrals + 1, score: next.score + 80 };
      }
    }
    if (time > this.damageLock) {
      const obstacle = this.obstacles.find((item) => !item.hit && next.x + 32 > item.x && next.x - 26 < item.x + item.width && next.y > GROUND_Y - item.height - 48);
      if (obstacle) {
        obstacle.hit = true;
        this.damageLock = time + 1_100;
        if (next.shield > 0) next = { ...next, shield: next.shield - 1, score: next.score + 40 };
        else next = { ...next, score: Math.max(0, next.score - 120) };
      }
    }
    const cp = CHECKPOINTS[next.checkpoint];
    if (cp && next.x >= cp) {
      next = { ...next, running: false };
      this.questionOpen = true;
      this.onQuestion?.({ open: true, question: this.questions[next.checkpoint], index: next.checkpoint });
    }
    if (next.won && !this.finishSent) {
      next.score += 600 + next.correctAnswers * 100;
      next.finishedAt = time;
      this.finishSent = true;
      this.onFinish?.(next);
    }
    this.state = next;
    this.syncDataset();
  }

  syncDataset() {
    const data = this.canvas.dataset;
    data.stage = this.state.stage;
    data.score = String(this.state.score);
    data.won = String(this.state.won);
    data.distance = String(Math.round(this.state.x));
    data.question = String(this.questionOpen);
    data.correctAnswers = String(this.state.correctAnswers);
    this.canvas.dispatchEvent(new CustomEvent('bni-game-state', { detail: {
      score: this.state.score,
      referrals: this.state.referrals,
      correctAnswers: this.state.correctAnswers,
      stage: this.state.stage,
      won: this.state.won
    } }));
    this.canvas.setAttribute('aria-label', this.state.won
      ? `Corrida concluída com ${this.state.score} pontos.`
      : `Corrida das referências. ${this.state.score} pontos e ${this.state.referrals} referências.`);
  }

  draw(time) {
    const ctx = this.ctx;
    const camera = Math.max(0, Math.min(WORLD_END - 760, this.state.x - 210));
    const sky = ctx.createLinearGradient(0, 0, 0, 480);
    sky.addColorStop(0, '#fff8f3');
    sky.addColorStop(1, '#f2e8e7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 960, 480);
    this.drawBackdrop(ctx, camera);
    this.collectibles.forEach((item) => this.drawReferral(ctx, item, camera, time));
    this.obstacles.forEach((item) => this.drawObstacle(ctx, item, camera));
    this.drawFinish(ctx, camera);
    this.drawRunner(ctx, 210, this.state.y, time);
    this.drawHud(ctx);
  }

  drawBackdrop(ctx, camera) {
    ctx.fillStyle = '#13223d';
    ctx.fillRect(0, GROUND_Y + 8, 960, 124);
    const track = ctx.createLinearGradient(0, GROUND_Y + 8, 0, 480);
    track.addColorStop(0, '#263957');
    track.addColorStop(1, '#101b31');
    ctx.fillStyle = track;
    ctx.fillRect(0, GROUND_Y + 8, 960, 124);
    ctx.strokeStyle = 'rgba(244,199,92,.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([34, 24]);
    ctx.beginPath(); ctx.moveTo(0, 430); ctx.lineTo(960, 430); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#a71930';
    ctx.fillRect(0, GROUND_Y + 8, 960, 12);
    for (let index = -1; index < 8; index += 1) {
      const x = index * 260 - (camera * .16 % 260);
      ctx.fillStyle = index % 2 ? 'rgba(167,25,48,.08)' : 'rgba(19,34,61,.07)';
      roundedRect(ctx, x, 132, 190, 162, 18); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 20, 158, 44, 74); ctx.fillRect(x + 78, 158, 44, 74); ctx.fillRect(x + 136, 158, 34, 74);
      ctx.fillStyle = '#d9c5a5';
      ctx.fillRect(x + 14, 286, 166, 12);
    }
    ctx.fillStyle = '#a71930';
    ctx.font = '800 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('SEA PORTO HOTEL  •  BNI UP', 480, 330);
  }

  drawReferral(ctx, item, camera, time) {
    if (item.taken) return;
    const x = item.x - camera;
    if (x < -40 || x > 1_000) return;
    const y = item.y + Math.sin(time / 280 + item.x) * 6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time / 500 + item.x) * .08);
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#a71930'; ctx.lineWidth = 3;
    roundedRect(ctx, -25, -18, 50, 36, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#a71930'; ctx.font = '900 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('REF', 0, 5);
    ctx.restore();
  }

  drawObstacle(ctx, item, camera) {
    const x = item.x - camera;
    if (x < -160 || x > 1_050) return;
    const y = GROUND_Y - item.height + 8;
    ctx.fillStyle = item.hit ? '#9b8e8e' : '#2e3e59';
    ctx.strokeStyle = '#a71930'; ctx.lineWidth = 4;
    roundedRect(ctx, x, y, item.width, item.height, 12); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(x + item.width / 2, y + item.height / 2); ctx.rotate(-.06);
    ctx.fillStyle = '#fff'; ctx.font = '900 10px system-ui'; ctx.textAlign = 'center';
    const words = item.label.split(' ');
    words.forEach((word, index) => ctx.fillText(word, 0, -4 + index * 12));
    ctx.restore();
  }

  drawFinish(ctx, camera) {
    const x = WORLD_END - camera;
    if (x < -250 || x > 1_250) return;
    ctx.fillStyle = '#d2a33a';
    for (let step = 0; step < 3; step += 1) ctx.fillRect(x + step * 55, GROUND_Y - step * 30 - 12, 70, 42 + step * 30);
    ctx.fillStyle = '#a71930'; ctx.font = '900 14px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('PÓDIO BNI UP', x + 98, GROUND_Y - 118);
  }

  drawRunner(ctx, x, y, time) {
    const phase = time / 105;
    const swing = Math.sin(phase) * 25;
    const bounce = Math.abs(Math.sin(phase)) * 4;
    ctx.save(); ctx.translate(x, y - bounce); ctx.scale(1.15, 1.15);
    if (this.state.power === 'boost' && performance.now() < this.state.powerUntil) {
      ctx.strokeStyle = 'rgba(210,163,58,.55)'; ctx.lineWidth = 6;
      for (let line = 0; line < 4; line += 1) { ctx.beginPath(); ctx.moveTo(-80 - line * 20, -55 + line * 18); ctx.lineTo(-25, -55 + line * 18); ctx.stroke(); }
    }
    ctx.strokeStyle = '#111827'; ctx.lineWidth = 18; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -58); ctx.lineTo(-12 + swing * .35, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -58); ctx.lineTo(20 - swing * .35, -8); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(-12 + swing * .35, -8); ctx.lineTo(-24 + swing * .5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20 - swing * .35, -8); ctx.lineTo(31 - swing * .5, 0); ctx.stroke();
    ctx.fillStyle = '#111111';
    roundedRect(ctx, -27, -137, 58, 82, 18); ctx.fill();
    ctx.strokeStyle = '#d7a97d'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(-18, -117); ctx.lineTo(-43 - swing * .35, -78); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, -116); ctx.lineTo(48 + swing * .35, -85); ctx.stroke();
    ctx.fillStyle = '#c38b61'; ctx.beginPath(); ctx.arc(-44 - swing * .35, -77, 8, 0, Math.PI * 2); ctx.arc(49 + swing * .35, -84, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -157, 32, 0, Math.PI * 2); ctx.clip();
    if (this.faceImage?.complete && this.faceImage.naturalWidth) {
      const sw = this.faceImage.naturalWidth * .58;
      const sh = this.faceImage.naturalHeight * .66;
      ctx.drawImage(this.faceImage, this.faceImage.naturalWidth * .2, 0, sw, sh, -34, -191, 72, 78);
    } else { ctx.fillStyle = '#d7a97d'; ctx.fillRect(-34, -191, 72, 78); }
    ctx.restore();
    ctx.save(); ctx.translate(x, y - bounce); ctx.scale(1.15, 1.15);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(2, -157, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  drawHud(ctx) {
    ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.strokeStyle = '#a71930'; ctx.lineWidth = 3;
    roundedRect(ctx, 22, 20, 916, 74, 20); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = '#13223d'; ctx.font = '900 25px system-ui'; ctx.fillText('CORRIDA DAS REFERÊNCIAS', 48, 52);
    ctx.font = '800 18px system-ui'; ctx.fillStyle = '#4e5b70'; ctx.fillText(this.member.company, 48, 78);
    ctx.textAlign = 'right'; ctx.fillStyle = '#a71930'; ctx.font = '900 27px system-ui'; ctx.fillText(`${this.state.score} PTS`, 910, 52);
    ctx.fillStyle = '#13223d'; ctx.font = '800 18px system-ui'; ctx.fillText(`${this.state.referrals} REF  •  ${this.state.correctAnswers}/6`, 910, 79);
  }
}
