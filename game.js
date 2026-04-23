// Obelisco Liftoff — Stage 1 (attract + countdown + liftoff + endless ascent)

const GW = 800;
const GH = 600;

const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEY_TO_CODE = {};
for (const [code, keys] of Object.entries(CABINET_KEYS)) {
  for (const k of keys) KEY_TO_CODE[k.toLowerCase()] = code;
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: GW,
  height: GH,
  parent: 'game-root',
  backgroundColor: '#050612',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GW,
    height: GH,
  },
  scene: { preload, create, update },
});

function preload() {
  const mk = (name, size) => {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1).fillRect(0, 0, size, size);
    g.generateTexture(name, size, size);
    g.destroy();
  };
  mk('px2', 2);
  mk('px3', 3);
  mk('px4', 4);
}

function create() {
  const s = this;
  s.state = {
    phase: 'attract',
    ascentStart: 0,
    flickerNext: 0,
    cloudFarNext: 0,
    cloudNearNext: 0,
    ascentDur: 3200,
    orbitStart: 0,
    failStart: 0,
  };

  setupControls(s);

  s.sky = s.add.graphics().setDepth(0);
  drawSky(s.sky, 0);

  // Stars
  s.stars = s.add.container(0, 0).setDepth(1);
  for (let i = 0; i < 80; i += 1) {
    const sz = Math.random() < 0.18 ? 3 : 2;
    const st = s.add.rectangle(
      Math.random() * GW,
      Math.random() * 470,
      sz,
      sz,
      0xffffff,
      0.35 + Math.random() * 0.55,
    );
    s.tweens.add({
      targets: st,
      alpha: 0.1 + Math.random() * 0.35,
      duration: 700 + Math.random() * 1900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    s.stars.add(st);
  }

  // Parallax clouds
  s.farClouds = s.add.container(0, 0).setDepth(2);
  s.nearClouds = s.add.container(0, 0).setDepth(4);

  // Skyline silhouette
  s.skyline = s.add.graphics().setDepth(3);
  drawSkyline(s.skyline);

  // Obelisco
  s.ob = {
    container: s.add.container(GW / 2, 520).setDepth(5),
    baseY: 520,
    OB_H: 260,
    TEAR: 86,
    TOP_W: 14,
    BASE_W: 28,
    CAP_H: 22,
  };
  buildObelisco(s);

  // Debris
  s.debris = s.add.container(0, 0).setDepth(6);

  // Smoke emitter (big billowing plume)
  s.smoke = s.add.particles(0, 0, 'px4', {
    lifespan: { min: 600, max: 1100 },
    speed: { min: 160, max: 380 },
    angle: { min: 70, max: 110 },
    scale: { start: 1.9, end: 0.35 },
    alpha: { start: 0.95, end: 0 },
    rotate: { start: 0, end: 360 },
    gravityY: 30,
    frequency: 9,
    tint: [0xffffff, 0xd8d8d8, 0x9a9a9a, 0x5e5e5e, 0x333333],
    emitting: false,
  }).setDepth(4);

  // Flame emitter (tight hot cone, additive)
  s.flame = s.add.particles(0, 0, 'px3', {
    lifespan: { min: 110, max: 280 },
    speed: { min: 180, max: 360 },
    angle: { min: 82, max: 98 },
    scale: { start: 2.4, end: 0.2 },
    alpha: { start: 1, end: 0 },
    frequency: 6,
    tint: [0xffffff, 0xfff1a8, 0xff9a32, 0xff3a00, 0xaa1400],
    blendMode: 'ADD',
    emitting: false,
  }).setDepth(5);

  // Title UI
  s.title = s.add
    .text(GW / 2, 100, 'OBELISCO', {
      fontFamily: 'monospace',
      fontSize: '78px',
      color: '#f0f4ff',
      fontStyle: 'bold',
      stroke: '#1a1535',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(10);
  try { s.title.setLetterSpacing(10); } catch (_) {}

  s.prompt = s.add
    .text(GW / 2, 170, 'PRESS ↑ TO LAUNCH', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#ffd85c',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(10);

  s.tweens.add({
    targets: [s.title, s.prompt],
    scale: 1.05,
    duration: 560,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  s.countdownText = s.add
    .text(GW / 2, GH / 2, '3', {
      fontFamily: 'monospace',
      fontSize: '220px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#ff2a4a',
      strokeThickness: 12,
    })
    .setOrigin(0.5)
    .setDepth(11)
    .setVisible(false);

  s.flash = s.add
    .rectangle(GW / 2, GH / 2, GW, GH, 0xffffff, 0)
    .setDepth(20);
}

function setupControls(s) {
  s.controls = { held: Object.create(null), pressed: Object.create(null) };
  const kd = (e) => {
    bootAudio(s);
    const code = KEY_TO_CODE[e.key.toLowerCase()];
    if (!code) return;
    if (!s.controls.held[code]) s.controls.pressed[code] = true;
    s.controls.held[code] = true;
  };
  const ku = (e) => {
    const code = KEY_TO_CODE[e.key.toLowerCase()];
    if (!code) return;
    s.controls.held[code] = false;
  };
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  s.events.once('shutdown', () => {
    window.removeEventListener('keydown', kd);
    window.removeEventListener('keyup', ku);
  });
}

function pressed(s, code) {
  if (s.controls.pressed[code]) {
    s.controls.pressed[code] = false;
    return true;
  }
  return false;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function drawSky(g, prog) {
  g.clear();
  const BANDS = 28;
  const bandH = GH / BANDS;
  for (let i = 0; i < BANDS; i += 1) {
    const t = i / (BANDS - 1);
    const topR = lerp(8, 70, prog);
    const topG = lerp(12, 120, prog);
    const topB = lerp(30, 200, prog);
    const botR = lerp(1, 20, prog);
    const botG = lerp(2, 50, prog);
    const botB = lerp(10, 110, prog);
    const r = Math.round(lerp(topR, botR, t));
    const gg = Math.round(lerp(topG, botG, t));
    const b = Math.round(lerp(topB, botB, t));
    g.fillStyle((r << 16) | (gg << 8) | b, 1).fillRect(
      0,
      Math.floor(i * bandH),
      GW,
      Math.ceil(bandH) + 1,
    );
  }
}

function drawSkyline(g) {
  g.clear();
  g.fillStyle(0x000000, 1).fillRect(0, 520, GW, GH - 520);
  let x = 0;
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  while (x < GW) {
    const w = 10 + Math.floor(rnd() * 38);
    const h = 16 + Math.floor(rnd() * 66);
    g.fillStyle(0x000000, 1).fillRect(x, 520 - h, w, h);
    for (let wy = 520 - h + 4; wy < 520 - 4; wy += 5) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if (rnd() < 0.12) {
          g.fillStyle(0xffe28a, 0.55).fillRect(wx, wy, 1, 1);
        }
      }
    }
    x += w;
  }
  // Domed buildings (Congreso-ish silhouette cues)
  g.fillStyle(0x000000, 1);
  for (const [cx, r, bw, sy] of [[170, 20, 44, 492], [620, 24, 52, 490]]) {
    g.fillCircle(cx, 520, r);
    g.fillRect(cx - bw / 2, 520, bw, 10);
    g.fillRect(cx - 2, sy, 4, 10);
  }
}

function drawShaftRow(g, y, w) {
  const half = w / 2;
  const left = Math.max(1, Math.round(w * 0.22));
  const right = Math.max(1, Math.round(w * 0.22));
  const mid = Math.max(1, w - left - right);
  g.fillStyle(0xf3ecd4, 1).fillRect(-half, y, left, 1);
  g.fillStyle(0xcdc2a5, 1).fillRect(-half + left, y, mid, 1);
  g.fillStyle(0x8b826a, 1).fillRect(-half + left + mid, y, right, 1);
}

function buildObelisco(s) {
  const { OB_H, TEAR, TOP_W, BASE_W, CAP_H } = s.ob;

  const upper = s.add.graphics();
  // Cap — warmer tone, pyramidal
  for (let i = 0; i < CAP_H; i += 1) {
    const t = i / (CAP_H - 1);
    const w = Math.max(2, Math.round(2 + t * (TOP_W - 2)));
    upper.fillStyle(0xe6cf98, 1).fillRect(-w / 2, -OB_H + i, w, 1);
  }
  upper.fillStyle(0xb99a5a, 1).fillRect(-1, -OB_H + CAP_H - 4, 2, 2);
  // Upper shaft (top down to tear)
  for (let y = -OB_H + CAP_H; y < -TEAR; y += 1) {
    const t = (y + OB_H - CAP_H) / (OB_H - CAP_H);
    const w = TOP_W + t * (BASE_W - TOP_W);
    drawShaftRow(upper, y, w);
  }
  // Windows near top
  for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1)
    upper.fillStyle(0x231b0a, 1).fillRect(-3 + j * 4, -OB_H + CAP_H + 22 + i * 8, 2, 3);

  s.ob.upper = upper;
  s.ob.container.add(upper);

  // Lower piece
  const lower = s.add.graphics();
  for (let y = -TEAR; y < 0; y += 1) {
    const t = (y + OB_H) / OB_H;
    const w = TOP_W + t * (BASE_W - TOP_W);
    drawShaftRow(lower, y, w);
  }
  s.ob.lower = lower;
  s.ob.container.add(lower);

  // Engine (hidden until tear) — flush against upper bottom at y=-TEAR,
  // content grows downward. KSP-style: mount plate, body, bell nozzle.
  const engine = s.add.container(0, -TEAR);
  const nz = s.add.graphics();

  // Mount plate (wider than body, bolts it to the shaft)
  nz.fillStyle(0x16161e, 1).fillRect(-14, 0, 28, 3);
  nz.fillStyle(0x6e6e7c, 1).fillRect(-13, 0, 26, 2);
  nz.fillStyle(0x9ea2b0, 1).fillRect(-13, 0, 2, 2);
  nz.fillStyle(0x2a2a34, 1).fillRect(11, 0, 2, 2);
  // Bolt dots
  for (const x of [-10, -2, 6]) nz.fillStyle(0x040408, 1).fillRect(x, 1, 1, 1);

  // Engine body / housing
  nz.fillStyle(0x0e0e14, 1).fillRect(-8, 3, 16, 14);
  nz.fillStyle(0x3c3c48, 1).fillRect(-7, 4, 14, 12);
  nz.fillStyle(0x7a7e8c, 1).fillRect(-7, 4, 2, 12);
  nz.fillStyle(0x22222c, 1).fillRect(5, 4, 2, 12);
  // Turbopump band
  nz.fillStyle(0x1c1c24, 1).fillRect(-7, 8, 14, 2);
  nz.fillStyle(0x55586a, 1).fillRect(-7, 10, 14, 1);
  // Copper fuel/coolant lines hugging the body
  nz.fillStyle(0x6a3a18, 1).fillRect(-11, 5, 1, 12);
  nz.fillStyle(0xc48040, 1).fillRect(-10, 5, 1, 12);
  nz.fillStyle(0xc48040, 1).fillRect(9, 5, 1, 12);
  nz.fillStyle(0x6a3a18, 1).fillRect(10, 5, 1, 12);

  // Bell nozzle — flared, narrow at throat, wide at exit
  const bellTop = 17;
  const bellH = 34;
  for (let dy = 0; dy < bellH; dy += 1) {
    const y = bellTop + dy;
    const t = dy / (bellH - 1);
    const curve = Math.pow(t, 0.62);
    const w = Math.max(4, Math.round(5 + curve * 22));
    const half = Math.floor(w / 2);
    // outer dark silhouette (slightly wider for a crisp rim)
    nz.fillStyle(0x0b0b12, 1).fillRect(-half - 1, y, w + 2, 1);
    // metallic bell body
    nz.fillStyle(0x50505e, 1).fillRect(-half, y, w, 1);
    // left highlight
    nz.fillStyle(0x9ea2b2, 1).fillRect(-half, y, 1, 1);
    // second highlight
    if (w > 4) nz.fillStyle(0x7e8292, 1).fillRect(-half + 1, y, 1, 1);
    // right shadow
    nz.fillStyle(0x262630, 1).fillRect(half - 1, y, 1, 1);

    // Interior exhaust glow — concentric, deeper as the bell flares
    if (w >= 6) {
      const iw = w - 4;
      nz.fillStyle(0x6a0e00, 1).fillRect(-Math.floor(iw / 2), y, iw, 1);
    }
    if (w >= 9) {
      const iw = w - 6;
      nz.fillStyle(0xc23a00, 1).fillRect(-Math.floor(iw / 2), y, iw, 1);
    }
    if (w >= 13 && t > 0.25) {
      const iw = w - 10;
      nz.fillStyle(0xff9820, 1).fillRect(-Math.floor(iw / 2), y, iw, 1);
    }
    if (w >= 17 && t > 0.45) {
      const iw = w - 14;
      nz.fillStyle(0xffe488, 1).fillRect(-Math.floor(iw / 2), y, iw, 1);
    }
  }
  // Reinforcement bands
  nz.fillStyle(0x13131a, 0.85).fillRect(-9, 26, 18, 1);
  nz.fillStyle(0x13131a, 0.85).fillRect(-13, bellTop + bellH - 2, 26, 1);

  engine.add(nz);
  engine.setVisible(false);
  s.ob.engine = engine;
  s.ob.bellExitY = -TEAR + bellTop + bellH; // world-offset of bell exit in container
  s.ob.container.add(engine);
  s.ob.container.bringToTop(upper);
}

function update(time, delta) {
  const s = this;
  if (!s.state) return;
  const ph = s.state.phase;

  if (ph === 'attract') {
    if (pressed(s, 'P1_U') || pressed(s, 'P2_U') || pressed(s, 'START1') || pressed(s, 'START2')) {
      startCountdown(s);
    }
    return;
  }

  if (ph === 'countdown') {
    // subtle shake during countdown
    s.ob.container.x = GW / 2 + (Math.random() * 2 - 1);
    return;
  }

  if (ph === 'liftoff' || ph === 'ascent') {
    updateAscent(s, time, delta);
    return;
  }
  if (ph === 'orbit') { updateOrbit(s, time, delta); return; }
}

function startCountdown(s) {
  s.state.phase = 'countdown';
  s.tweens.killTweensOf([s.title, s.prompt]);
  s.tweens.add({ targets: [s.title, s.prompt], alpha: 0, duration: 160, onComplete: () => { s.title.setVisible(false); s.prompt.setVisible(false); } });
  fadeHum(s, 0.15, 0.2);

  const steps = ['3', '2', '1', 'LIFTOFF!'];
  let i = 0;
  const show = () => {
    if (i >= steps.length) { liftoff(s); return; }
    const isLast = steps[i] === 'LIFTOFF!';
    s.countdownText.setText(steps[i]);
    s.countdownText.setFontSize(isLast ? 96 : 220);
    const targetScale = 1;
    s.countdownText.setVisible(true).setScale(targetScale * 1.55).setAlpha(0);
    s.countdownText.setColor(isLast ? '#ffde50' : '#ffffff');
    if (isLast) sfxLiftoffTick(s); else sfxTick(s, 520 - i * 40);
    s.tweens.add({
      targets: s.countdownText,
      scale: targetScale,
      alpha: 1,
      duration: 130,
      ease: 'Back.out',
    });
    s.time.delayedCall(isLast ? 180 : 320, () => {
      s.tweens.add({
        targets: s.countdownText,
        alpha: 0,
        duration: 90,
        onComplete: () => { i += 1; show(); },
      });
    });
  };
  show();
}

function liftoff(s) {
  s.state.phase = 'liftoff';
  s.countdownText.setVisible(false);
  s.ob.container.x = GW / 2;

  // White flash
  s.flash.setAlpha(0);
  s.tweens.add({
    targets: s.flash,
    alpha: 0.95,
    duration: 50,
    yoyo: true,
    onComplete: () => s.flash.setAlpha(0),
  });

  // Screen shake
  s.cameras.main.shake(360, 0.018);

  // Audio: big boom, rising sweep, fade out hum, start engine rumble
  fadeHum(s, 0, 0.3);
  sfxBoom(s);
  sfxSweep(s);
  s.time.delayedCall(80, () => startRumble(s));

  // Shatter the lower chunk
  shatterLower(s);
  s.ob.lower.setVisible(false);
  s.ob.engine.setVisible(true);

  // Attach & start emitters at the bell exit
  const offsetY = s.ob.bellExitY;
  s.smoke.startFollow(s.ob.container, 0, offsetY + 2);
  s.flame.startFollow(s.ob.container, 0, offsetY - 6);
  s.smoke.start();
  s.flame.start();

  // Brief thrust build before ascent
  s.time.delayedCall(160, () => {
    s.state.phase = 'ascent';
    s.state.ascentStart = s.time.now;
  });
}

function shatterLower(s) {
  const { OB_H, TEAR, TOP_W, BASE_W } = s.ob;
  const cx = s.ob.container.x;
  const baseY = s.ob.container.y;
  const N = 36;
  const TINTS = [0xf3ecd4, 0xcdc2a5, 0x8b826a, 0x5a5240, 0x2f2a20];
  for (let i = 0; i < N; i += 1) {
    const dy = -Math.random() * TEAR;
    const t = (dy + OB_H) / OB_H;
    const rowW = TOP_W + t * (BASE_W - TOP_W);
    const dx = (Math.random() - 0.5) * rowW * 1.05;
    const wx = cx + dx;
    const wy = baseY + dy;
    const size = 2 + Math.floor(Math.random() * 5);
    const tint = TINTS[Math.floor(Math.random() * TINTS.length)];
    const r = s.add.rectangle(wx, wy, size, size, tint, 1);
    s.debris.add(r);

    const vx = (Math.random() - 0.5) * 760;
    const vy = -320 - Math.random() * 480;
    const rot = (Math.random() - 0.5) * 1400;
    const life = 900 + Math.random() * 700;
    const o = { tt: 0 };
    s.tweens.add({
      targets: o,
      tt: 1,
      duration: life,
      ease: 'Linear',
      onUpdate: () => {
        const ts = (o.tt * life) / 1000;
        r.x = wx + vx * ts;
        r.y = wy + vy * ts + 0.5 * 900 * ts * ts;
        r.rotation += rot * 0.00028;
        r.alpha = Math.max(0, 1 - o.tt * 0.85);
      },
      onComplete: () => r.destroy(),
    });
  }
}

function updateAscent(s, time, delta) {
  const dt = delta / 1000;
  const elapsed = (time - (s.state.ascentStart || time)) / 1000;
  // ease-in: ramps quickly then holds at max
  const k = Math.min(1, elapsed / 1.1);
  const speed = k * k * 440; // up to ~440 px/s background scroll

  s.stars.y += speed * dt * 0.75;
  s.skyline.y += speed * dt * 1.1;
  s.farClouds.y += speed * dt * 0.6;
  s.nearClouds.y += speed * dt * 1.4;

  // Rocket drifts from 520 up toward 320 (~60%→45% of screen)
  const targetY = 320;
  if (s.ob.baseY > targetY) {
    s.ob.baseY -= Math.min(s.ob.baseY - targetY, speed * dt * 0.7);
  }
  const bob = Math.sin(time * 0.025) * 1.2;

  // Engine rumble intensity tied to ascent speed
  if (s._rumble) {
    const target = 0.55 + k * 0.35;
    s._rumble.g.gain.value += (target - s._rumble.g.gain.value) * 0.06;
    if (s._rumble.lp) {
      const f = 380 + k * 420;
      s._rumble.lp.frequency.value += (f - s._rumble.lp.frequency.value) * 0.04;
    }
  }
  s.ob.container.x = GW / 2;
  s.ob.container.y = s.ob.baseY + bob;

  // Sky gradually lightens (stage 1 goes ~60% of the way to daylight blue)
  const prog = Math.min(1, elapsed / 3.2) * 0.6;
  drawSky(s.sky, prog);

  // Cloud spawning
  if (time > s.state.cloudFarNext) {
    spawnCloud(s, 'far');
    s.state.cloudFarNext = time + 700 + Math.random() * 900;
  }
  if (time > s.state.cloudNearNext) {
    spawnCloud(s, 'near');
    s.state.cloudNearNext = time + 420 + Math.random() * 700;
  }

  // Cull clouds scrolled off the bottom
  const cull = (container, margin) => {
    const list = container.list;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const c = list[i];
      if (c.y + container.y > GH + margin) c.destroy();
    }
  };
  cull(s.farClouds, 60);
  cull(s.nearClouds, 90);

  // Flame flicker bursts
  if (time > s.state.flickerNext) {
    s.state.flickerNext = time + 120 + Math.random() * 320;
    s.flame.frequency = 2;
    s.time.delayedCall(70, () => { s.flame.frequency = 6; });
  }

  // Transition to orbit after ~8s of ascent (skip on restart)
  if (s.state.phase === 'ascent' && elapsed * 1000 > s.state.ascentDur) {
    transitionToOrbit(s, time);
  }
}

// ============================================================
// Home-made Web Audio synth
// ============================================================

function bootAudio(s) {
  if (s._ac) {
    if (s._ac.state === 'suspended') s._ac.resume();
    return s._ac;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ac = (s.sound && s.sound.context) ? s.sound.context : new Ctx();
  s._ac = ac;
  const master = ac.createGain();
  master.gain.value = 0.38;
  master.connect(ac.destination);
  s._master = master;
  // Subtle saturation-ish shaper (soft curve) via a waveshaper would be nice but keep light.
  startHum(s);
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function startHum(s) {
  if (s._hum) return;
  const ac = s._ac;
  const t = ac.currentTime;
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.connect(s._master);
  // Am7 drone (A, C, E, G) — layered sines + detuned sub saw
  const freqs = [110, 164.81, 220, 329.63];
  const oscs = [];
  freqs.forEach((f, i) => {
    const o = ac.createOscillator();
    o.type = i === 0 ? 'sawtooth' : 'sine';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    const og = ac.createGain();
    og.gain.value = i === 0 ? 0.04 : 0.055;
    o.connect(og);
    og.connect(bus);
    o.start();
    oscs.push(o);
  });
  // Slow LFO wobble on bus gain for breathing
  const lfo = ac.createOscillator();
  const lg = ac.createGain();
  lfo.frequency.value = 0.18;
  lg.gain.value = 0.08;
  lfo.connect(lg);
  lg.connect(bus.gain);
  lfo.start();
  bus.gain.setValueAtTime(0, t);
  bus.gain.linearRampToValueAtTime(0.32, t + 1.2);
  s._hum = { bus, oscs };
}

function fadeHum(s, target, dur) {
  if (!s._hum) return;
  const ac = s._ac;
  const t = ac.currentTime;
  s._hum.bus.gain.cancelScheduledValues(t);
  s._hum.bus.gain.setValueAtTime(s._hum.bus.gain.value, t);
  s._hum.bus.gain.linearRampToValueAtTime(target, t + dur);
}

// type, f0, f1, fdur, peak, peakAt (0 = set immediately), end, off (start offset)
function blip(s, type, f0, f1, fdur, peak, pAt, end, off) {
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime + (off || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + fdur);
  if (pAt > 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + pAt);
  } else {
    g.gain.setValueAtTime(peak, t);
  }
  g.gain.exponentialRampToValueAtTime(0.001, t + end);
  o.connect(g); g.connect(s._master);
  o.start(t); o.stop(t + end + 0.02);
}

function sfxTick(s, freq) {
  blip(s, 'square', freq, freq * 0.5, 0.08, 0.32, 0.005, 0.14);
  blip(s, 'sine', 180, 60, 0.12, 0.45, 0, 0.14);
}

function sfxLiftoffTick(s) {
  [440, 554.37, 659.25].forEach((f, i) => blip(s, 'triangle', f, f, 0, 0.22, 0.01, 0.5 - i * 0.02, i * 0.02));
}

function sfxBoom(s) {
  blip(s, 'sine', 140, 28, 0.9, 1.0, 0.02, 1.1);
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(s, 1.3);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(4000, t);
  lp.frequency.exponentialRampToValueAtTime(180, t + 1.1);
  lp.Q.value = 0.7;
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.75, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  src.connect(lp); lp.connect(ng); ng.connect(s._master);
  src.start(t); src.stop(t + 1.25);
}

function sfxSweep(s) {
  if (!s._ac) return;
  const ac = s._ac;
  const t = ac.currentTime;
  // Rising saw sweep "WHOOOOSH"
  const o = ac.createOscillator();
  const g = ac.createGain();
  const bp = ac.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(1100, t + 0.9);
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(2400, t + 0.9);
  bp.Q.value = 2.2;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.28, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  o.connect(bp); bp.connect(g); g.connect(s._master);
  o.start(t); o.stop(t + 1.15);
}

function getNoiseBuffer(s, seconds) {
  const ac = s._ac;
  if (s._noiseBuf && s._noiseBuf.duration >= seconds) return s._noiseBuf;
  const sr = ac.sampleRate;
  const n = Math.ceil(seconds * sr);
  const buf = ac.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // Pink-ish noise (Paul Kellet approximation)
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i += 1) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.96900 * b2 + w * 0.1538520;
    b3 = 0.86650 * b3 + w * 0.3104856;
    b4 = 0.55000 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.0168980;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.22;
    b6 = w * 0.115926;
  }
  s._noiseBuf = buf;
  return buf;
}

function startRumble(s) {
  if (s._rumble || !s._ac) return;
  const ac = s._ac;
  const t = ac.currentTime;
  const sr = ac.sampleRate;
  const len = Math.floor(sr * 2);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i += 1) {
    const w = Math.random() * 2 - 1;
    b0 = 0.97 * b0 + w * 0.12;
    b1 = 0.91 * b1 + w * 0.28;
    b2 = 0.55 * b2 + w * 0.18;
    d[i] = (b0 + b1 + b2) * 0.55;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 0.9;
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 38;
  const g = ac.createGain();
  g.gain.value = 0;
  src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(s._master);
  src.start();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.75, t + 0.4);
  s._rumble = { src, g, lp };
}

// ============================================================

function spawnCloud(s, kind) {
  const parent = kind === 'far' ? s.farClouds : s.nearClouds;
  const alpha = kind === 'far' ? 0.32 : 0.6;
  const scale = kind === 'far' ? 0.75 : 1.2;
  const tint = kind === 'far' ? 0xe8eaf8 : 0xf6f6ff;
  const group = s.add.container(0, 0);
  const screenY = -40 - Math.random() * 60;
  const localY = screenY - parent.y;
  const localX = Math.random() * GW;
  const puffs = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < puffs; i += 1) {
    const w = (14 + Math.random() * 28) * scale;
    const h = (10 + Math.random() * 12) * scale;
    const dx = (Math.random() - 0.5) * 46 * scale;
    const dy = (Math.random() - 0.5) * 10 * scale;
    const r = s.add.rectangle(localX + dx, localY + dy, w, h, tint, alpha);
    group.add(r);
  }
  parent.add(group);
}

// ============================================================
// STAGE 2 — ORBIT + FAILURE (fall gameplay removed, TBD)
// ============================================================

function burstParticles(s, x, y, tint, n, scale) {
  scale = scale || 1;
  for (let i = 0; i < n; i += 1) {
    const sz = 2 + Math.floor(Math.random() * 3);
    const r = s.add.rectangle(x, y, sz, sz, tint, 1).setDepth(14);
    const ang = Math.random() * Math.PI * 2;
    const sp = (60 + Math.random() * 200) * scale;
    s.tweens.add({
      targets: r,
      x: x + Math.cos(ang) * sp,
      y: y + Math.sin(ang) * sp,
      alpha: 0,
      duration: 400 + Math.random() * 300,
      onComplete: () => r.destroy(),
    });
  }
}

// ---- ORBIT (zoom out → tiny dot on orbital arc → fail mid-arc → zoom in) ----
function transitionToOrbit(s, time) {
  s.state.phase = 'orbit';
  s.state.orbitStart = time;
  s.state.orbitFailed = false;
  s.state.zoomingIn = false;
  s.state.cloudFarNext = Infinity;
  s.state.cloudNearNext = Infinity;

  // Cut to space with a quick black flash
  s.flash.fillColor = 0x000000;
  s.flash.setAlpha(0);
  s.tweens.add({
    targets: s.flash, alpha: 1, duration: 280, ease: 'Sine.easeIn',
    onComplete: () => {
      // Hide the entire ascent scene
      s.flame.stop();
      s.smoke.stop();
      s.ob.container.setVisible(false);
      s.sky.setVisible(false);
      s.stars.setVisible(false);
      s.farClouds.setVisible(false);
      s.nearClouds.setVisible(false);
      s.skyline.setVisible(false);
      buildOrbitScene(s);
      s.tweens.add({
        targets: s.flash, alpha: 0, duration: 380,
        onComplete: () => { s.flash.fillColor = 0xffffff; },
      });
      s.state.orbitArcStart = s.time.now;
      sfxOrbitChord(s);
    },
  });
  // kill engine audio
  fadeHum(s, 0.04, 0.4);
  if (s._rumble) {
    const t = s._ac.currentTime;
    s._rumble.g.gain.cancelScheduledValues(t);
    s._rumble.g.gain.linearRampToValueAtTime(0, t + 0.5);
  }
}

function buildOrbitScene(s) {
  s.orbitView = s.add.container(0, 0).setDepth(0);
  // Black space background
  s.orbitView.add(s.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000010, 1));
  // Stars
  for (let i = 0; i < 200; i += 1) {
    const sz = Math.random() < 0.12 ? 2 : 1;
    s.orbitView.add(s.add.rectangle(
      Math.random() * GW, Math.random() * GH, sz, sz,
      0xffffff, 0.3 + Math.random() * 0.65
    ));
  }
  // Nebula blobs
  for (let i = 0; i < 5; i += 1) {
    const tint = [0x4a1a6a, 0x6a2080, 0x803060, 0x402080, 0x2050a0][i];
    s.orbitView.add(s.add.circle(
      Math.random() * GW, Math.random() * GH * 0.7,
      60 + Math.random() * 70, tint, 0.18
    ));
  }
  // Earth — huge globe, center far below screen so only the top arc is visible.
  // Gentle, wide planetary curve sweeping across the lower portion of the canvas.
  const cy = GH + 520;
  const r = 800;
  s.state.orbitEarthCY = cy;
  s.state.orbitEarthR = r;
  const cx = GW / 2;
  // Atmospheric glow band along the visible horizon
  for (let i = 9; i >= 0; i -= 1) {
    const a = 0.13 - i * 0.012;
    if (a > 0) s.orbitView.add(s.add.circle(cx, cy, r + i * 12, 0x80c8ff, a));
  }
  const eg = s.add.graphics();
  eg.fillStyle(0x123f7a, 1).fillCircle(cx, cy, r);
  s.orbitView.add(eg);
  // Pixel continents — chunky blocks, bigger grid, 3-tone shading (lit from upper-right).
  const PX = 12;
  const lg = s.add.graphics();
  const COL_DARK = 0x226a34;
  const COL_MID = 0x3ea84a;
  const COL_LIGHT = 0x6bd172;
  const block = (gx, gy, col) => {
    lg.fillStyle(col, 1).fillRect(gx * PX, gy * PX, PX, PX);
  };
  const inside = (gx, gy, margin = 1) => {
    const x = gx * PX + PX / 2;
    const y = gy * PX + PX / 2;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= (r - margin * PX) * (r - margin * PX);
  };
  // Procedural continents — each is a disc of radius R blocks, perturbed by sinusoidal noise
  // for organic coastlines. Scale landmass size by bumping R.
  const patches = [
    { a: -2.15, d: 7, R: 9, seed: 1.3 },  // sprawling continent, upper-left
    { a: -1.55, d: 5, R: 9, seed: 2.7 },  // big central continent
    { a: -0.98, d: 6, R: 9, seed: 0.5 },  // large continent, upper-right
    { a: -2.48, d: 16, R: 6, seed: 3.9 }, // chunky mid-left, deeper
    { a: -0.68, d: 16, R: 6, seed: 1.8 }, // chunky mid-right, deeper
  ];
  patches.forEach((p) => {
    const depth = p.d * PX;
    const ax = cx + Math.cos(p.a) * (r - depth);
    const ay = cy + Math.sin(p.a) * (r - depth);
    const ox = Math.round(ax / PX);
    const oy = Math.round(ay / PX);
    const Rm = Math.ceil(p.R * 1.45);
    for (let by = -Rm; by <= Rm; by += 1) {
      for (let bx = -Rm; bx <= Rm; bx += 1) {
        const dist = Math.sqrt(bx * bx + by * by);
        const theta = Math.atan2(by, bx);
        const rEff = p.R * (1
          + 0.32 * Math.sin(3 * theta + p.seed)
          + 0.18 * Math.cos(5 * theta - p.seed * 1.7));
        if (dist > rEff) continue;
        if (!inside(ox + bx, oy + by, 2)) continue;
        // Light from upper-right: right+top lit, left+bottom shaded
        const ld = bx - by;
        let col = COL_MID;
        if (ld >= 2) col = COL_LIGHT;
        else if (ld <= -2) col = COL_DARK;
        block(ox + bx, oy + by, col);
      }
    }
  });
  s.orbitView.add(lg);
  // Crisp rim — thin bright horizon line along the visible arc
  const rim = s.add.graphics();
  rim.lineStyle(2, 0x80e0ff, 0.9).strokeCircle(cx, cy, r + 1);
  s.orbitView.add(rim);

  // Tiny rocket — just a few pixels
  s.tinyRocket = s.add.container(GW / 2, cy - r - 4).setDepth(2);
  // Body: a tiny obelisk shape (3px wide, 6px tall, pointy)
  s.tinyRocket.add(s.add.rectangle(0, 0, 3, 6, 0xf3ecd4, 1));
  s.tinyRocket.add(s.add.rectangle(0, -3, 1, 2, 0xffffff, 1)); // tip
  // Tiny flame trail
  s.tinyTrail = s.add.particles(0, 0, 'px2', {
    lifespan: { min: 200, max: 400 },
    speed: { min: 8, max: 22 },
    angle: { min: 80, max: 100 },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 25,
    tint: [0xffffff, 0xffe080, 0xff8030],
    blendMode: 'ADD',
  }).setDepth(1);
  s.tinyTrail.startFollow(s.tinyRocket, 0, 3);
}

function updateOrbit(s, time, delta) {
  if (!s.state.orbitArcStart) return;
  if (s.state.zoomingIn) return;
  const t = (time - s.state.orbitArcStart) / 1000;
  const cy = s.state.orbitEarthCY;
  const r = s.state.orbitEarthR;
  const dur = 3.6; // cinematic but punchy — 3.6s along the orbital arc
  const tt = Math.min(1, t / dur);

  if (!s.state.orbitFailed) {
    // Sweep from the right side of Earth UP to the top-center (apex over north pole).
    // Ease-out: fast departure off the surface, slowing as it coasts to the apex.
    const eased = 1 - Math.pow(1 - tt, 1.8);
    const ang = (-Math.PI / 2 + 0.95) - eased * 0.95;
    const radius = r + 18 + eased * 130; // climbs ~130px above surface — high orbit, long fall
    s.tinyRocket.x = GW / 2 + Math.cos(ang) * radius;
    s.tinyRocket.y = cy + Math.sin(ang) * radius;
    s.tinyRocket.rotation = ang + Math.PI / 2;
    if (tt >= 1) triggerOrbitFailure(s, time);
  } else {
    // After failure — slow gentle drift then accelerating fall back to Earth.
    // Lighter gravity + tighter zoom threshold = visibly longer fall before transition.
    const dt = delta / 1000;
    const ftt = (time - s.state.failTime0) / 1000;
    s.state.failVx = (s.state.failVx || -8); // tiny leftward drift (kept orbital momentum)
    s.state.failVy = (s.state.failVy || 6);
    const dx = GW / 2 - s.tinyRocket.x;
    const dy = cy - s.tinyRocket.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const grav = 45 + ftt * 55; // softer ramp
    s.state.failVx += (dx / d) * grav * dt;
    s.state.failVy += (dy / d) * grav * dt;
    s.tinyRocket.x += s.state.failVx * dt;
    s.tinyRocket.y += s.state.failVy * dt;
    s.tinyRocket.rotation += delta * 0.006 * (1 + ftt * 1.2);

    // Trigger zoom only once rocket is right at the atmosphere (smaller margin)
    const dist = Math.sqrt((s.tinyRocket.x - GW / 2) ** 2 + (s.tinyRocket.y - cy) ** 2);
    if (dist < r + 6) {
      s.state.zoomingIn = true;
      doZoomInToFall(s, time);
    }
  }
}

function triggerOrbitFailure(s, time) {
  s.state.orbitFailed = true;
  s.state.failTime0 = time;
  s.state.failVx = 25;
  s.state.failVy = 10;
  // Spark/explosion at the rocket
  burstParticles(s, s.tinyRocket.x, s.tinyRocket.y, 0xff6020, 14, 0.5);
  burstParticles(s, s.tinyRocket.x, s.tinyRocket.y, 0xffd060, 8, 0.4);
  // Stop the trail flame; small smoke puff
  if (s.tinyTrail) s.tinyTrail.stop();
  // Red flash
  s.flash.fillColor = 0xff1020;
  s.flash.setAlpha(0);
  s.tweens.add({
    targets: s.flash, alpha: 0.5, duration: 70, yoyo: true,
    onComplete: () => { s.flash.setAlpha(0); s.flash.fillColor = 0xffffff; },
  });
  s.cameras.main.shake(380, 0.012);
  sfxAlarm(s);
  sfxFailBoom(s);
}

function doZoomInToFall(s, time) {
  // Camera zooms onto the rocket, then white-flash cut to fall scene
  const tx = s.tinyRocket.x;
  const ty = s.tinyRocket.y;
  s.cameras.main.pan(tx, ty, 480, 'Sine.easeIn');
  s.cameras.main.zoomTo(7, 520, 'Cubic.easeIn');
  // Heat trail as we punch through atmosphere
  const heat = s.add.particles(0, 0, 'px3', {
    lifespan: { min: 200, max: 400 },
    speed: { min: 30, max: 90 },
    angle: { min: 70, max: 110 },
    scale: { start: 1.2, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 18,
    tint: [0xffffff, 0xffe080, 0xff8030, 0xff3000],
    blendMode: 'ADD',
  }).setDepth(3);
  heat.startFollow(s.tinyRocket, 0, -2);
  s.tinyHeat = heat;
  sfxFailBoom(s);
  s.time.delayedCall(540, () => {
    // White flash, then stop — fall gameplay not yet implemented.
    s.flash.fillColor = 0xffffff;
    s.flash.setAlpha(1);
    s.cameras.main.setZoom(1);
    s.cameras.main.centerOn(GW / 2, GH / 2);
    if (s.orbitView) { s.orbitView.destroy(true); s.orbitView = null; }
    if (s.tinyRocket) { s.tinyRocket.destroy(); s.tinyRocket = null; }
    if (s.tinyTrail) { s.tinyTrail.destroy(); s.tinyTrail = null; }
    if (s.tinyHeat) { s.tinyHeat.destroy(); s.tinyHeat = null; }
    s.state.phase = 'post';
    s.tweens.add({ targets: s.flash, alpha: 0, duration: 900 });
  });
}


// ---- New SFX ----
function sfxAlarm(s) {
  for (let i = 0; i < 3; i += 1) blip(s, 'square', 880, 880, 0, 0.18, 0.005, 0.12, i * 0.15);
}

function sfxFailBoom(s) {
  blip(s, 'sawtooth', 220, 40, 0.5, 0.7, 0.05, 0.7);
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(s, 0.8);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  src.connect(ng); ng.connect(s._master);
  src.start(t); src.stop(t + 0.75);
}

function sfxOrbitChord(s) {
  [261.63, 392, 523.25, 783.99].forEach((f, i) => blip(s, 'sine', f, f, 0, 0.16, 0.4, 2.5 - i * 0.1, i * 0.1));
}

