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
  drawSky(s.sky, 1);

  // Stars
  s.stars = s.add.container(0, 0).setDepth(1).setVisible(false);
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
    .text(GW / 2, 100, 'OBELISCO', TS(78, '#f0f4ff', '#1a1535', 6))
    .setOrigin(0.5)
    .setDepth(10);
  try { s.title.setLetterSpacing(10); } catch (_) {}

  s.prompt = s.add
    .text(GW / 2, 170, 'PRESS ↑ TO LAUNCH', TS(20, '#ffd85c'))
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
    .text(GW / 2, GH / 2, '3', TS(220, '#ffffff', '#ff2a4a', 12))
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
    const k = e.key.toLowerCase();
    if (k === 'm' && !e.repeat) toggleMute(s);
    const code = KEY_TO_CODE[k];
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

function anyInput(s, mode) {
  for (const k in CABINET_KEYS) {
    if (mode === 2 && /_[UDLR]$/.test(k)) continue;
    if (mode === 0 ? s.controls.held[k] : pressed(s, k)) return true;
  }
  return false;
}
function pressed(s, code) {
  if (s.controls.pressed[code]) {
    s.controls.pressed[code] = false;
    return true;
  }
  return false;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function TS(size, color, stroke, thk) {
  const o = { fontFamily: 'monospace', fontSize: size + 'px', color, fontStyle: 'bold' };
  if (stroke) { o.stroke = stroke; o.strokeThickness = thk; }
  return o;
}

function drawSky(g, prog) {
  g.clear();
  const BANDS = 28;
  const bandH = GH / BANDS;
  for (let i = 0; i < BANDS; i += 1) {
    const t = i / (BANDS - 1);
    const topR = lerp(8, 110, prog);
    const topG = lerp(12, 170, prog);
    const topB = lerp(30, 230, prog);
    const botR = lerp(1, 190, prog);
    const botG = lerp(2, 220, prog);
    const botB = lerp(10, 240, prog);
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
  const GROUND_Y = 520;

  // Buildings only flank the sides; center is a big green plaza around the obelisco
  const LEFT_END = 170;
  const RIGHT_START = 630;

  let seed = 2025;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // ---- Far layer: hazy silhouettes (flanks only) ----
  const drawFar = (x0, x1) => {
    let x = x0;
    while (x < x1) {
      const w = 12 + Math.floor(rnd() * 22);
      const h = 22 + Math.floor(rnd() * 34);
      g.fillStyle(0x9ab4ce, 1).fillRect(x, GROUND_Y - h, Math.min(w, x1 - x), h);
      g.fillStyle(0x8aa4be, 1).fillRect(x + w - 1, GROUND_Y - h, 1, h);
      g.fillStyle(0x7a94ae, 1).fillRect(x, GROUND_Y - h, Math.min(w, x1 - x), 1);
      x += w;
    }
  };
  drawFar(0, LEFT_END);
  drawFar(RIGHT_START, GW);

  // ---- Mid layer facades ----
  const BODY = [0xe6d4b0, 0xd9c4a0, 0xecd9b6, 0xc9b68e, 0xd4bfa2, 0xe9d0a8];
  const SHADE = [0xb59c78, 0xa88a62, 0xbfa580, 0x8f7a55, 0xa58c6a, 0xb3956a];
  const ROOF_DARK = [0x4a3d2c, 0x3f3324, 0x54442f, 0x3a2e20];
  const WINDOW = 0x2f3b52;
  const WINDOW_FRAME = 0x6d5a3e;

  const buildings = [];
  const pushRange = (x0, x1) => {
    let x = x0;
    while (x < x1) {
      const w = 28 + Math.floor(rnd() * 38);
      const ww = Math.min(w, x1 - x);
      if (ww < 20) break;
      const h = 60 + Math.floor(rnd() * 80);
      buildings.push({ x, w: ww, h });
      x += ww;
    }
  };
  pushRange(0, LEFT_END);
  pushRange(RIGHT_START, GW);

  for (const b of buildings) {
    const pi = Math.floor(rnd() * BODY.length);
    const top = GROUND_Y - b.h;
    // Body
    g.fillStyle(BODY[pi], 1).fillRect(b.x, top, b.w, b.h);
    // Right shadow band
    g.fillStyle(SHADE[pi], 1).fillRect(b.x + b.w - 2, top, 2, b.h);
    // Base plinth
    g.fillStyle(SHADE[pi], 1).fillRect(b.x, GROUND_Y - 6, b.w, 6);
    g.fillStyle(0x3a2e22, 1).fillRect(b.x, GROUND_Y - 1, b.w, 1);

    // Cornice band near top
    g.fillStyle(SHADE[pi], 1).fillRect(b.x, top + 4, b.w, 2);

    const roofCol = ROOF_DARK[Math.floor(rnd() * ROOF_DARK.length)];
    g.fillStyle(roofCol, 1).fillRect(b.x, top - 2, b.w, 2);
    if (rnd() < 0.4) {
      const tw = 4 + Math.floor(rnd() * 5);
      const tx = b.x + 3 + Math.floor(rnd() * Math.max(1, b.w - tw - 6));
      g.fillStyle(0x8a7a5a, 1).fillRect(tx, top - 8, tw, 6);
    }

    const cols = Math.max(1, Math.floor((b.w - 6) / 6));
    const rows = Math.max(1, Math.floor((b.h - 14) / 8));
    const marginX = Math.floor((b.w - cols * 6) / 2);
    for (let r = 0; r < rows; r += 1) {
      const wy = top + 10 + r * 8;
      for (let c = 0; c < cols; c += 1) {
        const wx = b.x + marginX + c * 6;
        g.fillStyle(WINDOW, 1).fillRect(wx, wy, 3, 4);
        g.fillStyle(WINDOW_FRAME, 1).fillRect(wx - 1, wy + 4, 5, 1);
      }
    }
  }

  // ---- Landmark: Casa Rosada-ish pink block (right) ----
  const prX = 690;
  const prW = 80;
  const prH = 46;
  const prTop = GROUND_Y - prH;
  g.fillStyle(0xe8a6b0, 1).fillRect(prX, prTop, prW, prH);
  g.fillStyle(0xc8848e, 1).fillRect(prX + prW - 2, prTop, 2, prH);
  g.fillStyle(0x8c4a56, 1).fillRect(prX, prTop, prW, 1);
  g.fillStyle(0x8c4a56, 1).fillRect(prX, prTop + 4, prW, 1);
  // corner towers
  g.fillStyle(0xeab3bc, 1).fillRect(prX - 4, prTop - 10, 10, prH + 10);
  g.fillStyle(0xeab3bc, 1).fillRect(prX + prW - 6, prTop - 10, 10, prH + 10);
  g.fillStyle(0x8c4a56, 1).fillRect(prX - 4, prTop - 10, 10, 1);
  g.fillStyle(0x8c4a56, 1).fillRect(prX + prW - 6, prTop - 10, 10, 1);
  // central arch
  g.fillStyle(0x5a2a32, 1).fillRect(prX + prW / 2 - 4, prTop + 10, 8, prH - 16);
  g.fillStyle(0x8c4a56, 1).fillRect(prX + prW / 2 - 5, prTop + 9, 10, 1);
  for (let row = 0; row < 2; row += 1) {
    const wy = prTop + 14 + row * 14;
    for (let col = 0; col < 5; col += 1) {
      const wx = prX + 6 + col * 14;
      if (Math.abs(wx - (prX + prW / 2)) < 10) continue;
      g.fillStyle(0x3a2838, 1).fillRect(wx, wy, 5, 6);
    }
  }

  // ---- Plaza grass behind/around the obelisco ----
  const PLAZA_X0 = LEFT_END - 10;
  const PLAZA_X1 = RIGHT_START + 10;
  // back lawn with gentle gradient
  g.fillStyle(0x5c9a3e, 1).fillRect(PLAZA_X0, GROUND_Y - 8, PLAZA_X1 - PLAZA_X0, 8);
  g.fillStyle(0x4a8432, 1).fillRect(PLAZA_X0, GROUND_Y - 2, PLAZA_X1 - PLAZA_X0, 2);

  // foreground ground: grass fills the full width except sidewalks on the flanks
  g.fillStyle(0x5c9a3e, 1).fillRect(0, GROUND_Y, GW, GH - GROUND_Y);
  for (let i = 0; i < 120; i += 1) {
    const c = [0x4a8432, 0x6db04a, 0x3d7028, 0x7cbe58][Math.floor(rnd() * 4)];
    g.fillStyle(c, 0.8).fillRect(Math.floor(rnd() * GW), GROUND_Y + 2 + Math.floor(rnd() * (GH - GROUND_Y - 4)), 1, 1);
  }

  // Curved sidewalk around the obelisco base
  g.fillStyle(0xd8cfbc, 1).fillEllipse(GW / 2, GROUND_Y + 6, 190, 34);
  g.fillStyle(0xb8ad95, 1).fillEllipse(GW / 2, GROUND_Y + 8, 190, 32);
  g.fillStyle(0xd8cfbc, 1).fillEllipse(GW / 2, GROUND_Y + 6, 170, 26);
  // Side sidewalks under flanking buildings
  g.fillStyle(0xc8bfaa, 1).fillRect(0, GROUND_Y, LEFT_END, 8);
  g.fillStyle(0xa89e88, 1).fillRect(0, GROUND_Y, LEFT_END, 1);
  g.fillStyle(0xc8bfaa, 1).fillRect(RIGHT_START, GROUND_Y, GW - RIGHT_START, 8);
  g.fillStyle(0xa89e88, 1).fillRect(RIGHT_START, GROUND_Y, GW - RIGHT_START, 1);

  // Streets flanking the plaza
  const drawStreet = (sx0, sx1) => {
    g.fillStyle(0x3a3a40, 1).fillRect(sx0, GROUND_Y + 8, sx1 - sx0, 10);
    g.fillStyle(0x2a2a30, 1).fillRect(sx0, GROUND_Y + 8, sx1 - sx0, 1);
    // lane dashes
    for (let dx = sx0 + 2; dx < sx1; dx += 10) {
      g.fillStyle(0xe8dc70, 1).fillRect(dx, GROUND_Y + 13, 5, 1);
    }
  };
  drawStreet(LEFT_END, LEFT_END + 40);
  drawStreet(RIGHT_START - 40, RIGHT_START);
  // Outer curbs (grass meets sidewalks/streets) -- already drawn above

  // ---- Lush tree cluster around the plaza (not a dense wall) ----
  const drawTree = (tx, ty, sz) => {
    // trunk
    g.fillStyle(0x4a2e18, 1).fillRect(tx - 1, ty, 2, sz + 2);
    g.fillStyle(0x2a1808, 1).fillRect(tx + 1, ty, 1, sz + 2);
    // foliage: layered circles
    const crown = sz + 4;
    g.fillStyle(0x2d5a22, 1).fillCircle(tx, ty - 2, crown);
    g.fillStyle(0x3e7a32, 1).fillCircle(tx - 1, ty - 3, crown - 1);
    g.fillStyle(0x5ba04a, 1).fillCircle(tx - 2, ty - 4, crown - 3);
    g.fillStyle(0x8cd470, 0.9).fillCircle(tx - 3, ty - 5, Math.max(1, crown - 6));
  };
  // Park trees behind plaza
  const parkTrees = [
    [210, GROUND_Y - 6, 8], [260, GROUND_Y - 4, 7], [305, GROUND_Y - 2, 9],
    [355, GROUND_Y - 1, 6], [450, GROUND_Y - 1, 7], [500, GROUND_Y - 3, 8],
    [545, GROUND_Y - 5, 9], [590, GROUND_Y - 7, 7],
    [230, GROUND_Y - 12, 6], [290, GROUND_Y - 14, 7], [520, GROUND_Y - 14, 7],
    [565, GROUND_Y - 11, 6],
  ];
  for (const [tx, ty, sz] of parkTrees) drawTree(tx, ty, sz);

  // Foreground trees scattered on grass
  for (let i = 0; i < 14; i += 1) {
    const tx = 20 + Math.floor(rnd() * (GW - 40));
    // avoid the sidewalk ring around the obelisco
    const dx = tx - GW / 2;
    if (Math.abs(dx) < 100) continue;
    const ty = GROUND_Y + 18 + Math.floor(rnd() * 40);
    const sz = 4 + Math.floor(rnd() * 4);
    drawTree(tx, ty, sz);
  }

  for (let a = 0; a < 14; a += 1) {
    const ang = Math.PI + (a / 14) * Math.PI;
    const rx = GW / 2 + Math.cos(ang) * 92;
    const ry = GROUND_Y + 8 + Math.sin(ang) * 16;
    g.fillStyle(0x2d5a22, 1).fillCircle(rx, ry - 2, 4);
    g.fillStyle(0x5ba04a, 1).fillCircle(rx - 1, ry - 3, 3);
  }

  for (let i = 0; i < 16; i += 1) {
    const c = [0xff5a6a, 0xffd45a, 0xffffff, 0xd870ff][Math.floor(rnd() * 4)];
    g.fillStyle(c, 1).fillRect(Math.floor(rnd() * GW), GROUND_Y + 18 + Math.floor(rnd() * 50), 1, 1);
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

// Pixel art for the obelisco's upper half (cap + shaft + windows). Reused as the
// falling cockpit so the player visually recognizes "the top of the rocket".
function drawObeliscoUpper(g, ob) {
  const { OB_H, TEAR, TOP_W, BASE_W, CAP_H } = ob;
  for (let i = 0; i < CAP_H; i += 1) {
    const t = i / (CAP_H - 1);
    const w = Math.max(2, Math.round(2 + t * (TOP_W - 2)));
    g.fillStyle(0xe6cf98, 1).fillRect(-w / 2, -OB_H + i, w, 1);
  }
  g.fillStyle(0xb99a5a, 1).fillRect(-1, -OB_H + CAP_H - 4, 2, 2);
  for (let y = -OB_H + CAP_H; y < -TEAR; y += 1) {
    const t = (y + OB_H - CAP_H) / (OB_H - CAP_H);
    const w = TOP_W + t * (BASE_W - TOP_W);
    drawShaftRow(g, y, w);
  }
  for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1)
    g.fillStyle(0x231b0a, 1).fillRect(-3 + j * 4, -OB_H + CAP_H + 22 + i * 8, 2, 3);
}

function drawEngine(nz) {
  nz.fillStyle(0x16161e, 1).fillRect(-14, 0, 28, 3);
  nz.fillStyle(0x6e6e7c, 1).fillRect(-13, 0, 26, 2);
  nz.fillStyle(0x0e0e14, 1).fillRect(-8, 3, 16, 14);
  nz.fillStyle(0x3c3c48, 1).fillRect(-7, 4, 14, 12);
  nz.fillStyle(0x7a7e8c, 1).fillRect(-7, 4, 2, 12);
  nz.fillStyle(0x1c1c24, 1).fillRect(-7, 8, 14, 2);
  nz.fillStyle(0xc48040, 1).fillRect(-10, 5, 1, 12);
  nz.fillStyle(0xc48040, 1).fillRect(9, 5, 1, 12);
  const bellTop = 17, bellH = 34;
  for (let dy = 0; dy < bellH; dy += 1) {
    const y = bellTop + dy;
    const t = dy / (bellH - 1);
    const curve = Math.pow(t, 0.62);
    const w = Math.max(4, Math.round(5 + curve * 22));
    const half = Math.floor(w / 2);
    nz.fillStyle(0x0b0b12, 1).fillRect(-half - 1, y, w + 2, 1);
    nz.fillStyle(0x50505e, 1).fillRect(-half, y, w, 1);
    nz.fillStyle(0x9ea2b2, 1).fillRect(-half, y, 1, 1);
    nz.fillStyle(0x262630, 1).fillRect(half - 1, y, 1, 1);
    if (w >= 6) { const iw = w - 4; nz.fillStyle(0x6a0e00, 1).fillRect(-Math.floor(iw / 2), y, iw, 1); }
    if (w >= 9) { const iw = w - 6; nz.fillStyle(0xc23a00, 1).fillRect(-Math.floor(iw / 2), y, iw, 1); }
    if (w >= 13 && t > 0.25) { const iw = w - 10; nz.fillStyle(0xff9820, 1).fillRect(-Math.floor(iw / 2), y, iw, 1); }
    if (w >= 17 && t > 0.45) { const iw = w - 14; nz.fillStyle(0xffe488, 1).fillRect(-Math.floor(iw / 2), y, iw, 1); }
  }
  nz.fillStyle(0x13131a, 0.85).fillRect(-9, 26, 18, 1);
  nz.fillStyle(0x13131a, 0.85).fillRect(-13, bellTop + bellH - 2, 26, 1);
}

function buildObelisco(s) {
  const { TEAR, TOP_W, BASE_W, OB_H } = s.ob;
  const upper = s.add.graphics();
  drawObeliscoUpper(upper, s.ob);
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
  drawEngine(nz);
  const bellTop = 17;
  const bellH = 34;
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
      if (s._cinematicDone) startFall(s); else startCountdown(s);
    }
    return;
  }

  // Hold any action / start button for ~0.7s during the cinematic to skip it.
  if (ph === 'countdown' || ph === 'liftoff' || ph === 'ascent' || ph === 'orbit') {
    const holding = anyInput(s, 0);
    const HOLD_MS = 700;
    s.state.skipHoldMs = holding ? (s.state.skipHoldMs || 0) + delta : 0;
    updateSkipMeter(s, Math.min(1, (s.state.skipHoldMs || 0) / HOLD_MS));
    if (s.state.skipHoldMs >= HOLD_MS) {
      s.tweens.killAll();
      s.time.removeAllEvents();
      startFall(s);
      return;
    }
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
  if (ph === 'fall') { updateFall(s, time, delta); return; }
}

// Letterbox bars + "CINEMATIC" tag so players don't think the intro is interactive.
function showCinematicChrome(s) {
  if (s.cineChrome) return;
  const BAR = 56;
  const top = s.add.rectangle(GW / 2, -BAR / 2, GW, BAR, 0x000000, 1).setDepth(40);
  const bot = s.add.rectangle(GW / 2, GH + BAR / 2, GW, BAR, 0x000000, 1).setDepth(40);
  const tag = s.add.text(GW - 14, GH - BAR / 2 + BAR + 6, '● CINEMATIC', TS(14, '#ff5050')).setOrigin(1, 0.5).setDepth(41).setAlpha(0);
  const skip = s.add.text(14, GH - BAR / 2 + BAR + 6, 'HOLD B TO SKIP INTRO', TS(12, '#c0c0c0')).setOrigin(0, 0.5).setDepth(41).setAlpha(0);
  // Hold-to-skip progress bar, sits to the right of the SKIP label
  const meter = s.add.graphics().setDepth(41).setAlpha(0);
  s.cineChrome = { top, bot, tag, skip, meter, meterFrac: 0 };
  s.tweens.add({ targets: top, y: BAR / 2, duration: 380, ease: 'Cubic.easeOut' });
  s.tweens.add({
    targets: bot, y: GH - BAR / 2, duration: 380, ease: 'Cubic.easeOut',
    onComplete: () => {
      tag.setY(GH - BAR / 2);
      skip.setY(GH - BAR / 2);
      meter.setAlpha(1);
      drawSkipMeter(s, 0);
      s.tweens.add({ targets: [tag, skip], alpha: 1, duration: 220 });
      s.tweens.add({
        targets: tag, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    },
  });
}

function hideCinematicChrome(s) {
  const c = s.cineChrome;
  if (!c) return;
  s.cineChrome = null;
  s.tweens.killTweensOf([c.tag, c.skip, c.top, c.bot, c.meter]);
  const BAR = 56;
  s.tweens.add({ targets: [c.tag, c.skip, c.meter], alpha: 0, duration: 180 });
  s.tweens.add({ targets: c.top, y: -BAR / 2, duration: 320, ease: 'Cubic.easeIn' });
  s.tweens.add({
    targets: c.bot, y: GH + BAR / 2, duration: 320, ease: 'Cubic.easeIn',
    onComplete: () => {
      c.top.destroy(); c.bot.destroy(); c.tag.destroy(); c.skip.destroy(); c.meter.destroy();
    },
  });
}

function drawSkipMeter(s, frac) {
  const c = s.cineChrome;
  if (!c) return;
  const W = 110, H = 8, x = 200, y = GH - 28 - H / 2;
  c.meter.clear();
  c.meter.fillStyle(0x202020, 1).fillRect(x, y, W, H);
  c.meter.fillStyle(frac >= 1 ? 0x40ff60 : 0xffd060, 1)
    .fillRect(x + 1, y + 1, Math.max(0, (W - 2) * frac), H - 2);
}
function updateSkipMeter(s, frac) {
  const c = s.cineChrome;
  if (!c || (Math.abs(frac - c.meterFrac) < 0.02 && frac !== 1)) return;
  c.meterFrac = frac;
  drawSkipMeter(s, frac);
}

function startCountdown(s) {
  s.state.phase = 'countdown';
  s.tweens.killTweensOf([s.title, s.prompt]);
  s.tweens.add({ targets: [s.title, s.prompt], alpha: 0, duration: 160, onComplete: () => { s.title.setVisible(false); s.prompt.setVisible(false); } });
  fadeHum(s, 0.15, 0.2);
  showCinematicChrome(s);

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

  // Rocket drifts from 520 up so its visual center sits in the middle of the screen.
  // Container y is the rocket's BASE; the obelisco extends OB_H=260 upward,
  // so y=430 places the rocket center at ~y=300 (mid-screen, also clear of letterbox bars).
  const targetY = 430;
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

  drawSky(s.sky, 1);

  // Cloud spawning
  if (time > s.state.cloudFarNext) {
    spawnCloud(s, 'far');
    if (Math.random() < 0.5) spawnCloud(s, 'far');
    s.state.cloudFarNext = time + 260 + Math.random() * 380;
  }
  if (time > s.state.cloudNearNext) {
    spawnCloud(s, 'near');
    if (Math.random() < 0.5) spawnCloud(s, 'near');
    s.state.cloudNearNext = time + 160 + Math.random() * 280;
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
  master.gain.value = 0.42;
  const mFilt = ac.createBiquadFilter();
  mFilt.type = 'lowpass';
  mFilt.frequency.value = 20000;
  mFilt.Q.value = 0.7;
  // Highpass cuts sub-bass that tiny speakers can't reproduce
  const mHp = ac.createBiquadFilter();
  mHp.type = 'highpass';
  mHp.frequency.value = 90;
  master.connect(mHp);
  mHp.connect(mFilt);
  mFilt.connect(ac.destination);
  s._master = master;
  s._mFilt = mFilt;
  s._baseVol = 0.42;
  s._muted = false;
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
    // Lean off the 110Hz saw (phones can't reproduce it) and give mids more weight
    og.gain.value = i === 0 ? 0.018 : (i === 3 ? 0.08 : 0.06);
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
  blip(s, 'sine', 220, 80, 0.9, 0.9, 0.02, 1.1);
  blip(s, 'triangle', 520, 180, 0.5, 0.55, 0.01, 0.7);
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

function sfxWhoosh(s, prox, combo) {
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime;
  const boost = Math.min(1, (combo || 1) / 6);
  // Bandpass noise, centered in the mid range — the "air" of the pass
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(s, 0.35);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(1200, t);
  bp.frequency.exponentialRampToValueAtTime(3200 + boost * 1000, t + 0.18);
  const g = ac.createGain();
  const amp = 0.28 + prox * prox * 0.55 + boost * 0.22;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(amp, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  src.connect(bp); bp.connect(g); g.connect(s._master);
  src.start(t); src.stop(t + 0.28);
  blip(s, 'triangle', 700 + boost * 120, 280, 0.26, 0.42 + prox * 0.3, 0.006, 0.3);
  if (prox > 0.55) {
    const pitch = 1800 + combo * 140;
    blip(s, 'triangle', pitch, pitch * 1.5, 0.18, 0.22 + boost * 0.12, 0.004, 0.22);
  }
}

function onObstaclePass(s, prox, time) {
  const f = s.fall;
  if (!f) return;
  if (time - f.lastPassAt < 1200) f.combo += 1; else f.combo = 1;
  f.lastPassAt = time;
  const chips = 10 + Math.round(prox * 20);
  const gain = chips * f.combo;
  f.score += gain;
  f.scorePop = Math.min(1.2, f.scorePop + 0.9);
  spawnScoreGain(s, gain, f.combo);
  sfxWhoosh(s, prox, f.combo);
  const shake = Math.min(0.035, 0.008 + prox * 0.018 + f.combo * 0.003);
  const dur = 90 + Math.min(180, f.combo * 20);
  s.cameras.main.shake(dur, shake);
}

function spawnScoreGain(s, gain, combo) {
  const hue = combo >= 6 ? '#ffe060' : combo >= 4 ? '#ff9040' : '#60e0ff';
  const label = combo > 1 ? '+' + gain + ' x' + combo : '+' + gain;
  const t = s.add.text(GW / 2 + 120, 44, label, TS(30, hue, '#000', 4)).setOrigin(0, 0.5).setDepth(50);
  if (s.fallView) s.fallView.add(t);
  s.tweens.add({ targets: t, x: t.x + 30, y: t.y - 26, duration: 520, ease: 'Cubic.easeOut' });
  s.tweens.add({
    targets: t, alpha: 0, duration: 380, delay: 200,
    onComplete: () => t.destroy(),
  });
}

function toggleMute(s) {
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime;
  s._muted = !s._muted;
  s._master.gain.cancelScheduledValues(t);
  s._master.gain.setValueAtTime(s._master.gain.value, t);
  s._master.gain.linearRampToValueAtTime(s._muted ? 0 : s._baseVol, t + 0.04);
}

function sfxFallTransition(s) {
  if (!s._ac) return;
  const ac = s._ac, t = ac.currentTime;
  if (s._mFilt) {
    s._mFilt.frequency.cancelScheduledValues(t);
    s._mFilt.frequency.setValueAtTime(s._mFilt.frequency.value, t);
    s._mFilt.frequency.exponentialRampToValueAtTime(800, t + 1.0);
    s._mFilt.frequency.exponentialRampToValueAtTime(20000, t + 3.2);
  }
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(400, t);
  o.frequency.exponentialRampToValueAtTime(1800, t + 1.0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.9);
  g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  o.connect(g); g.connect(s._master);
  o.start(t); o.stop(t + 1.25);
  const src = ac.createBufferSource();
  src.buffer = getNoiseBuffer(s, 1.0);
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 3;
  bp.frequency.setValueAtTime(400, t + 0.2);
  bp.frequency.exponentialRampToValueAtTime(4000, t + 1.0);
  const ng = ac.createGain();
  ng.gain.setValueAtTime(0.0001, t + 0.2);
  ng.gain.exponentialRampToValueAtTime(0.28, t + 1.0);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 1.15);
  src.connect(bp); bp.connect(ng); ng.connect(s._master);
  src.start(t + 0.2); src.stop(t + 1.2);
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
  // Mid hiss companion — makes the rumble audible on small speakers
  const bp = ac.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.8;
  const mg = ac.createGain();
  mg.gain.value = 0;
  src.connect(bp); bp.connect(mg); mg.connect(s._master);
  src.start();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.55, t + 0.4);
  mg.gain.setValueAtTime(0, t);
  mg.gain.linearRampToValueAtTime(0.6, t + 0.4);
  s._rumble = { src, g, lp, mg, bp };
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

// Earth backdrop — huge globe whose top arc curves across the lower part of the screen.
function buildEarthView(s) {
  if (s.earthView) { s.earthView.destroy(true); s.earthView = null; }
  const view = s.add.container(0, 0).setDepth(2);
  s.earthView = view;
  const cx = GW / 2;
  const cy = GH + 520;
  const r = 800;
  s.state.earthCY = cy;
  s.state.earthR = r;
  // Atmospheric glow band along the visible horizon
  for (let i = 9; i >= 0; i -= 1) {
    const a = 0.13 - i * 0.012;
    if (a > 0) view.add(s.add.circle(cx, cy, r + i * 12, 0x80c8ff, a));
  }
  const eg = s.add.graphics();
  eg.fillStyle(0x123f7a, 1).fillCircle(cx, cy, r);
  view.add(eg);
  // Pixel continents — chunky blocks, 3-tone shading (lit from upper-right).
  const PX = 12;
  const lg = s.add.graphics();
  const COL_DARK = 0x226a34, COL_MID = 0x3ea84a, COL_LIGHT = 0x6bd172;
  const block = (gx, gy, col) => lg.fillStyle(col, 1).fillRect(gx * PX, gy * PX, PX, PX);
  const inside = (gx, gy, m = 1) => {
    const x = gx * PX + PX / 2, y = gy * PX + PX / 2;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= (r - m * PX) * (r - m * PX);
  };
  const patches = [
    { a: -2.15, d: 8, R: 15, seed: 1.3 },
    { a: -1.55, d: 6, R: 15, seed: 2.7 },
    { a: -0.98, d: 7, R: 15, seed: 0.5 },
    { a: -2.48, d: 18, R: 11, seed: 3.9 },
    { a: -0.68, d: 18, R: 11, seed: 1.8 },
  ];
  patches.forEach((p) => {
    const depth = p.d * PX;
    const ax = cx + Math.cos(p.a) * (r - depth);
    const ay = cy + Math.sin(p.a) * (r - depth);
    const ox = Math.round(ax / PX), oy = Math.round(ay / PX);
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
        const ld = bx - by;
        let col = COL_MID;
        if (ld >= 2) col = COL_LIGHT;
        else if (ld <= -2) col = COL_DARK;
        block(ox + bx, oy + by, col);
      }
    }
  });
  view.add(lg);
  const rim = s.add.graphics();
  rim.lineStyle(2, 0x80e0ff, 0.9).strokeCircle(cx, cy, r + 1);
  view.add(rim);
}

// ---- ORBIT (zoom out from same rocket → fail at apex → fall → cut to gameplay) ----
function transitionToOrbit(s, time) {
  s.state.phase = 'orbit';
  s.state.orbitStart = time;
  s.state.orbitFailed = false;
  s.state.orbitHang = false;
  s.state.atmoEntered = false;
  s.state.zoomingIn = false;
  s.state.cloudFarNext = Infinity;
  s.state.cloudNearNext = Infinity;

  // Reuse the same obelisco/rocket so the player sees it's the same one going up.
  s.tinyRocket = s.ob.container;

  // Fade out ground-side scenery as we "zoom out" into space.
  s.tweens.add({ targets: [s.skyline, s.farClouds, s.nearClouds], alpha: 0, duration: 1400 });
  s.stars.setVisible(true).setAlpha(0);
  s.tweens.add({ targets: s.stars, alpha: 1, duration: 1600 });

  // Earth swells in below the rocket as we pull back into space.
  buildEarthView(s);
  s.earthView.setAlpha(0);
  s.tweens.add({ targets: s.earthView, alpha: 1, duration: 1800, ease: 'Sine.easeIn' });

  // Day → night sky (drives drawSky each frame via tweened state value).
  s.state.skyProg = 1;
  s.tweens.add({
    targets: s.state, skyProg: 0, duration: 2200, ease: 'Sine.easeInOut',
    onUpdate: () => drawSky(s.sky, s.state.skyProg),
  });

  // Two-stage tween so the player clearly sees the rocket as a small dot climbing upward:
  //  1) shrink in place around mid-screen (camera "pulls back")
  //  2) the now-tiny rocket climbs visibly to the apex near the top.
  s.tweens.add({
    targets: s.ob.container,
    x: GW / 2, y: GH * 0.55, scale: 0.1,
    duration: 1100, ease: 'Cubic.easeOut',
    onComplete: () => {
      s.tweens.add({
        targets: s.ob.container,
        y: 80,
        duration: 3400, ease: 'Sine.easeOut',
      });
    },
  });

  // Engine effects taper off with the zoom-out.
  s.tweens.add({ targets: s.flame, frequency: 60, duration: 1400 });
  s.smoke.stop();

  // Engine audio fade, start spacey ambient music
  fadeHum(s, 0.04, 1.4);
  startSpaceMusic(s);
  if (s._rumble) {
    const t = s._ac.currentTime;
    s._rumble.g.gain.cancelScheduledValues(t);
    s._rumble.g.gain.linearRampToValueAtTime(0, t + 1.4);
    if (s._rumble.mg) {
      s._rumble.mg.gain.cancelScheduledValues(t);
      s._rumble.mg.gain.linearRampToValueAtTime(0, t + 1.4);
    }
  }

  // Mid-climb: kick off the "CRITICAL FAILURE" warning so the player sees the rocket
  // is in trouble well before the apex/oh-no moment.
  s.time.delayedCall(1500, () => triggerAscentFailureWarning(s));

  // Once we've reached the apex, hand off to the comical hang.
  s.time.delayedCall(4600, () => {
    s.flame.stop();
    s.state.apexX = s.ob.container.x;
    s.state.apexY = s.ob.container.y;
    s.state.apexRot = s.ob.container.rotation;
    sfxOrbitChord(s);
    triggerOrbitHang(s, s.time.now);
  });
}

// Mid-climb warning sequence: red strobe, alarm tones, smoke puffs from the rocket
// and a flashing "CRITICAL FAILURE" banner. Sells "this thing is breaking" before
// the apex hang and the explosion.
function triggerAscentFailureWarning(s) {
  if (s.state.phase !== 'orbit') return;
  s.flash.fillColor = 0xff1020;
  s.flash.setAlpha(0);
  s.tweens.add({
    targets: s.flash, alpha: 0.32, duration: 180, yoyo: true, repeat: 11,
    onComplete: () => { s.flash.setAlpha(0); s.flash.fillColor = 0xffffff; },
  });
  for (let i = 0; i < 6; i += 1) s.time.delayedCall(i * 480, () => sfxAlarm(s));
  s.time.addEvent({
    delay: 150, repeat: 22, callback: () => {
      const x = s.ob.container.x + (Math.random() * 10 - 5);
      const y = s.ob.container.y + (Math.random() * 10 - 5);
      burstParticles(s, x, y, 0xff8030, 3, 0.3);
      if (Math.random() < 0.55) burstParticles(s, x, y, 0x404040, 2, 0.35);
    },
  });
  s.cameras.main.shake(2400, 0.006);
  const banner = s.add.text(GW / 2, 110, 'CRITICAL FAILURE', TS(28, '#ff4030', '#200000', 5)).setOrigin(0.5).setDepth(11).setAlpha(0);
  const sub = s.add.text(GW / 2, 138, 'ENGINE OVERLOAD', TS(14, '#ffd060', '#200000', 3)).setOrigin(0.5).setDepth(11).setAlpha(0);
  s.tweens.add({
    targets: [banner, sub], alpha: 1, duration: 160, yoyo: true, repeat: 13,
    ease: 'Sine.easeInOut',
  });
  s.time.delayedCall(1800, () => { if (sub.active) sub.setText('ABORT! ABORT!'); });
  s.time.delayedCall(3000, () => {
    s.tweens.add({
      targets: [banner, sub], alpha: 0, duration: 240,
      onComplete: () => { banner.destroy(); sub.destroy(); },
    });
  });
}

function updateOrbit(s, time, delta) {
  if (s.state.zoomingIn) return;

  if (s.state.orbitHang && !s.state.orbitFailed) {
    // Coyote-style hang: freeze at apex, wobble a bit, show "oh no" bubble.
    const ht = (time - s.state.hangStart) / 1000;
    const wobble = Math.sin(ht * 6) * 1.2;
    s.tinyRocket.x = s.state.apexX + wobble;
    s.tinyRocket.y = s.state.apexY + Math.sin(ht * 4) * 0.8;
    s.tinyRocket.rotation = s.state.apexRot + wobble * 0.05;
    if (ht >= 1.4) triggerOrbitFailure(s, time);
  } else if (s.state.orbitFailed) {
    // Slow tumbling plunge — gentle gravity so the player has time to read
    // the reentry beats: orbit → atmosphere glow → heat trail → cut.
    const dt = delta / 1000;
    const ftt = (time - s.state.failTime0) / 1000;
    s.state.failVy = (s.state.failVy || 8) + 110 * dt;
    s.tinyRocket.y += s.state.failVy * dt;
    s.tinyRocket.rotation += delta * 0.0015 * (1 + ftt * 0.4);

    // Atmospheric entry once the falling dot reaches the lower half.
    if (!s.state.atmoEntered && s.tinyRocket.y >= GH * 0.55) {
      s.state.atmoEntered = true;
      startAtmosphericEntry(s, time);
    }
    if (s.state.atmoEntered && !s.state.zoomingIn && s.tinyRocket.y >= GH * 0.85) {
      s.state.zoomingIn = true;
      doAtmosphereCut(s, time);
    }
  }
}

function triggerOrbitHang(s, time) {
  s.state.orbitHang = true;
  s.state.hangStart = time;
  // "oh no" speech bubble above the rocket
  const bx = s.state.apexX + 18;
  const by = s.state.apexY - 18;
  const bubble = s.add.container(bx, by).setDepth(5);
  const bg = s.add.graphics();
  bg.fillStyle(0xffffff, 1).fillRoundedRect(-22, -12, 44, 20, 4);
  bg.lineStyle(1.5, 0x000000, 1).strokeRoundedRect(-22, -12, 44, 20, 4);
  bg.fillStyle(0xffffff, 1).fillTriangle(-10, 6, -4, 6, -8, 12);
  bg.lineStyle(1.5, 0x000000, 1).strokeTriangle(-10, 6, -4, 6, -8, 12);
  bubble.add(bg);
  const tx = s.add.text(0, -2, 'oh no', TS(11, '#000000')).setOrigin(0.5);
  bubble.add(tx);
  bubble.setScale(0);
  s.tweens.add({ targets: bubble, scale: 1, duration: 180, ease: 'Back.easeOut' });
  s.ohNoBubble = bubble;
  // tiny sad "boing" sfx
  blip(s, 'sine', 520, 180, 0, 0.25, 0.01, 0.15);
}

function startAtmosphericEntry(s, time) {
  // Remove bubble if still there
  if (s.ohNoBubble) { s.ohNoBubble.destroy(); s.ohNoBubble = null; }
  stopMusic(s);
  // Heat trail flaring off the plunging rocket
  const heat = s.add.particles(0, 0, 'px3', {
    lifespan: { min: 260, max: 520 },
    speed: { min: 40, max: 140 },
    angle: { min: 250, max: 290 }, // shooting upward (opposite of fall direction)
    scale: { start: 1.6, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 14,
    tint: [0xffffff, 0xffe080, 0xff8030, 0xff3000],
    blendMode: 'ADD',
  }).setDepth(4);
  heat.startFollow(s.tinyRocket, 0, 4);
  s.tinyHeat = heat;
  // Atmosphere tint slowly reddens the whole scene
  s.flash.fillColor = 0xff5020;
  s.flash.setAlpha(0);
  s.tweens.add({ targets: s.flash, alpha: 0.35, duration: 800, ease: 'Sine.easeIn' });
  // "REENTRY" label flashing in
  const label = s.add.text(GW / 2, 48, 'REENTRY', TS(22, '#ffe080', '#401000', 4)).setOrigin(0.5).setAlpha(0).setDepth(6);
  s.tweens.add({ targets: label, alpha: 1, duration: 140, yoyo: true, repeat: 4 });
  s.reentryLabel = label;
  // Subtle shimmer via shake + rumble
  s.cameras.main.shake(1200, 0.004);
  sfxAlarm(s);
}

function doAtmosphereCut(s, time) {
  // Tight zoom on the rocket as it plunges into the glow, then white-out to fall scene
  const tx = s.tinyRocket.x;
  const ty = s.tinyRocket.y;
  s.cameras.main.pan(tx, ty, 420, 'Sine.easeIn');
  s.cameras.main.zoomTo(5.5, 460, 'Cubic.easeIn');
  sfxFailBoom(s);
  s.time.delayedCall(480, () => {
    s.flash.fillColor = 0xffffff;
    s.flash.setAlpha(1);
    s.cameras.main.setZoom(1);
    s.cameras.main.centerOn(GW / 2, GH / 2);
    // s.tinyRocket is the obelisco container — startFall hides it; just drop the alias.
    s.tinyRocket = null;
    if (s.tinyHeat) { s.tinyHeat.destroy(); s.tinyHeat = null; }
    if (s.reentryLabel) { s.reentryLabel.destroy(); s.reentryLabel = null; }
    startFall(s);
    s.tweens.add({ targets: s.flash, alpha: 0, duration: 500 });
  });
}

function triggerOrbitFailure(s, time) {
  s.state.orbitFailed = true;
  s.state.failTime0 = time;
  s.state.failVx = 0;
  s.state.failVy = 8;
  // Pop the bubble away as gravity kicks in
  if (s.ohNoBubble) {
    s.tweens.add({
      targets: s.ohNoBubble, scale: 0, duration: 140, ease: 'Back.easeIn',
      onComplete: () => { if (s.ohNoBubble) { s.ohNoBubble.destroy(); s.ohNoBubble = null; } },
    });
  }
  // Spark/explosion at the rocket
  burstParticles(s, s.tinyRocket.x, s.tinyRocket.y, 0xff6020, 14, 0.5);
  burstParticles(s, s.tinyRocket.x, s.tinyRocket.y, 0xffd060, 8, 0.4);
  // The engine explodes off — only the obelisco's UPPER half (the cockpit) keeps falling.
  // Reuse the same sprite as the rocket's nose so the player recognizes it.
  if (s.ob.engine) s.ob.engine.setVisible(false);
  if (s.ob.lower) s.ob.lower.setVisible(false);
  s.state.apexX = s.tinyRocket.x;
  s.state.apexY = s.tinyRocket.y;
  s.state.apexRot = s.tinyRocket.rotation;
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

// Spacey ambient loop: detuned triangle pad + pentatonic arp during orbit.
function startSpaceMusic(s) {
  if (!s._ac || s._music) return;
  const ac = s._ac, t = ac.currentTime;
  const bus = ac.createGain();
  bus.gain.value = 0;
  bus.connect(s._master);
  const oscs = [220, 262, 330, 392].map((f) => {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const og = ac.createGain();
    og.gain.value = 0.07;
    o.connect(og); og.connect(bus);
    o.start();
    return o;
  });
  bus.gain.linearRampToValueAtTime(0.55, t + 2);
  const arp = [440, 523, 659, 784, 880, 784, 659, 523];
  let step = 0;
  const evt = s.time.addEvent({
    delay: 360, loop: true, callback: () => {
      const f = arp[step++ % 8];
      blip(s, 'sine', f, f, 0, 0.11, 0.02, 0.55);
      blip(s, 'triangle', f * 2, f * 2, 0, 0.04, 0.02, 0.35);
    },
  });
  s._music = { bus, oscs, evt };
}

function stopMusic(s) {
  if (!s._music) return;
  const t = s._ac.currentTime, m = s._music;
  m.evt.remove();
  if (m.bus) {
    m.bus.gain.cancelScheduledValues(t);
    m.bus.gain.setValueAtTime(m.bus.gain.value, t);
    m.bus.gain.linearRampToValueAtTime(0, t + 1.2);
    s.time.delayedCall(1300, () => {
      m.oscs.forEach((o) => o.stop());
      m.bus.disconnect();
    });
  }
  s._music = null;
}

function startFallMusic(s) {
  if (!s._ac || s._music) return;
  const mel = [440, 523, 659, 880, 659, 523, 659, 784, 440, 587, 659, 784, 880, 1047, 880, 659];
  let i = 0;
  const evt = s.time.addEvent({
    delay: 150, loop: true, callback: () => {
      const k = i++ % 16;
      if (k % 4 === 0) blip(s, 'sine', 180, 60, 0.1, 0.5, 0.002, 0.18);
      if (k === 4 || k === 12) blip(s, 'square', 260, 160, 0.06, 0.18, 0.002, 0.1);
      if (k % 2 === 0) blip(s, 'triangle', mel[k], mel[k], 0, 0.14, 0.006, 0.25);
    },
  });
  s._music = { bus: null, oscs: [], evt };
}

// ============================================================
// STAGE 3 — TUNNEL FALL
// Pinhole camera projection: screenX = cx + worldX * (FOCAL/z)
// ============================================================

const FOCAL = 400;
const TUNNEL_R = 200;
const NEAR_P = 10;
const FAR_P = 5000;
const RING_STEP = 50;
const NUM_RINGS = 100;

// OBSTACLE TUNING — all spacings in SECONDS. Z-distance is derived at
// spawn via currentSpeed * 60 * seconds, keeping reaction windows fair at all speeds.
const OBS_CFG = {
  base: 2.0, tense: 1.2, relief: 3.5,
  rest: 2.7, restEveryMin: 12, restEveryMax: 18,
  tenseChance: 0.18,
  revGap: 0.7, triGap: 0.6, compoundExit: 0.8,
  trailLeadIn: 0.6, trailExit: 1.0, trailRingGap: 0.15,
  trailGapW: 35 * Math.PI / 180,
  trailLenMin: 6, trailLenMax: 10, trailLongMax: 14,
  trailP4Weight: 0.10, trailP5Weight: 0.15,
  straightSweep: Math.PI / 2, scurveSweep: Math.PI / 2,
  spiralSweep: Math.PI, wobbleSweep: Math.PI / 3, wobbleAmp: 0.25,
  trailSpiralGapMul: 1.5,
  wideMul: 1.15, narrowMul: 0.7, twoMul: 0.85, sliverMul: 0.8,
  threeMul: 0.72, rotMul: 1.0, counterMul: 0.95,
  shrinkFromMul: 1.25, shrinkToMul: 0.5,
  revGapMul: 0.9, triGapMul: 0.85,
  phase2: 5, phase3: 12, phase4: 22, phase5: 35,
};
// Phase variant weights. Phases 4/5 get trails on top via trailP*Weight.
const PHASE_WEIGHTS = {
  1: { A: 60, B: 25, C: 15 },
  2: { A: 28, B: 25, C: 20, D: 14, F: 13 },
  3: { A: 14, B: 18, C: 14, D: 14, E: 10, F: 14, H: 10, I: 6 },
  4: { B: 14, C: 12, D: 12, E: 8, F: 12, G: 8, H: 10, I: 12, J: 12 },
  5: { B: 10, C: 10, D: 10, E: 6, F: 10, G: 12, H: 10, I: 14, J: 18 },
};

function startFall(s) {
  s.state.phase = 'fall';
  s._cinematicDone = true;
  hideCinematicChrome(s);

  if (s.fall && s.fall.over) { s.fall.over.destroy(); s.fall.over = null; }

  startFallMusic(s);

  s.cameras.main.setZoom(1);
  s.cameras.main.centerOn(GW / 2, GH / 2);
  s.flash.fillColor = 0xffffff;
  s.flash.setAlpha(0);

  // Hide prior scenes
  s.sky.setVisible(false);
  s.stars.setVisible(false);
  s.farClouds.setVisible(false);
  s.nearClouds.setVisible(false);
  s.skyline.setVisible(false);
  s.ob.container.setVisible(false);
  if (s.earthView) { s.earthView.destroy(true); s.earthView = null; }

  if (s.fallView) { s.fallView.destroy(true); s.fallView = null; }
  s.tipFire = null;

  s.fallView = s.add.container(0, 0).setDepth(30);
  // Solid black backdrop (always opaque), plus a tunnel-ambience tint that fades in
  // so the first instant feels like "entering the dark tunnel" before it lights up.
  s.fallView.add(s.add.rectangle(GW / 2, GH / 2, GW, GH, 0x000000, 1));
  const tunnelTint = s.add.rectangle(GW / 2, GH / 2, GW, GH, 0x180403, 1).setAlpha(0);
  s.fallView.add(tunnelTint);
  s.tweens.add({ targets: tunnelTint, alpha: 1, duration: 1100, ease: 'Sine.easeIn' });
  // Background heat-shimmer pixels
  const shim = s.add.container(0, 0).setAlpha(0);
  s.tweens.add({ targets: shim, alpha: 1, duration: 1300, ease: 'Sine.easeIn' });
  for (let i = 0; i < 40; i += 1) {
    const px = s.add.rectangle(Math.random() * GW, Math.random() * GH, 2, 2, 0x502010, 0.35);
    shim.add(px);
    s.tweens.add({
      targets: px, alpha: 0.05, duration: 900 + Math.random() * 1400,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
  s.fallView.add(shim);
  const gfx = s.add.graphics().setAlpha(0);
  s.fallView.add(gfx);
  s.tweens.add({ targets: gfx, alpha: 1, duration: 1100, ease: 'Sine.easeIn' });
  // Glow layer for cockpit leading edge (below rocket)
  const glow = s.add.graphics();
  s.fallView.add(glow);

  // Reuse the obelisco's upper half as the cockpit. Container sits far below
  // the screen so only the very tip of the cap pokes up from the bottom-middle.
  const rocket = s.add.container(GW / 2, 980);
  const rg = s.add.graphics();
  drawObeliscoUpper(rg, s.ob);
  rocket.add(rg);
  rocket.setScale(2);
  s.fallView.add(rocket);

  // Reentry fire on the cockpit tip — flames lick downward over the cockpit body,
  // pushed back by the airflow as it plunges through the atmosphere.
  const tipFire = s.add.particles(0, 0, 'px3', {
    lifespan: { min: 220, max: 480 },
    speed: { min: 120, max: 280 },
    angle: { min: 70, max: 110 },
    scale: { start: 2.4, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 8,
    tint: [0xffffff, 0xfff1a8, 0xff9a32, 0xff3a00, 0xaa1400],
    blendMode: 'ADD',
  }).setDepth(31);
  s.fallView.add(tipFire);
  s.fall = s.fall || {};
  s.tipFire = tipFire;

  const hud = s.add.text(GW / 2, 44, '0.0', TS(56, '#ffffff', '#000000', 5)).setOrigin(0.5);
  s.fallView.add(hud);

  const mX = 768, mTop = 160, mBot = 440, earthR = 12;
  const mFrame = s.add.graphics();
  mFrame.fillStyle(0x604020, 0.7).fillRect(mX - 1, mTop, 2, mBot - mTop);
  mFrame.fillStyle(0x2a88c0, 1).fillCircle(mX, mBot + 14, earthR);
  mFrame.fillStyle(0x3aa050, 1).fillCircle(mX - 3, mBot + 12, 3);
  mFrame.fillStyle(0x3aa050, 1).fillCircle(mX + 4, mBot + 16, 2);
  s.fallView.add(mFrame);
  const mRocket = s.add.container(mX, mTop);
  const mrg = s.add.graphics();
  drawObeliscoUpper(mrg, s.ob);
  mRocket.add(mrg);
  const meg = s.add.graphics();
  meg.y = -s.ob.TEAR;
  drawEngine(meg);
  mRocket.add(meg);
  mRocket.setScale(0.4).setRotation(Math.PI);
  s.fallView.add(mRocket);
  const mFire = s.add.particles(0, 0, 'px3', {
    lifespan: { min: 120, max: 280 },
    speed: { min: 20, max: 60 },
    angle: { min: 260, max: 280 },
    scale: { start: 0.9, end: 0 },
    alpha: { start: 1, end: 0 },
    frequency: 35,
    tint: [0xfff1a8, 0xff9a32, 0xff3a00],
    blendMode: 'ADD',
  });
  s.fallView.add(mFire);
  s.fall = s.fall || {};
  s.fall.meter = { mRocket, mFire, mTop, mBot, earthR };

  // Pre-tunnel mission briefing flash
  const briefL1 = s.add.text(GW / 2, GH / 2 - 18, 'YOU ARE FALLING', TS(40, '#ffe060', '#3a0a00', 6)).setOrigin(0.5).setAlpha(0);
  const briefL2 = s.add.text(GW / 2, GH / 2 + 26, 'AVOID OBSTACLES', TS(32, '#ffffff', '#3a0a00', 5)).setOrigin(0.5).setAlpha(0);
  s.fallView.add(briefL1); s.fallView.add(briefL2);
  s.tweens.add({ targets: [briefL1, briefL2], alpha: 1, duration: 220, ease: 'Sine.easeOut' });
  s.tweens.add({ targets: [briefL1, briefL2], scale: 1.08, duration: 380, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
  s.time.delayedCall(2200, () => {
    s.tweens.add({
      targets: [briefL1, briefL2], alpha: 0, duration: 320,
      onComplete: () => { briefL1.destroy(); briefL2.destroy(); },
    });
  });

  const _meterRef = s.fall && s.fall.meter;
  s.fall = {
    gfx, rocket, hud, glow, shim, meter: _meterRef,
    rot: 0, speed: 3, elapsed: 0, bank: 0,
    rings: [], obs: [], shards: [], embers: [], streaks: [],
    nextSpawnAt: 0, nextStreakAt: 0, nextRestAt: 15, dead: false, over: null, showingOver: false,
    bestScore: s._bestScore || 0,
    combo: 0, lastPassAt: 0, score: 0, scorePop: 0,
  };
  for (let i = 0; i < NUM_RINGS; i += 1) {
    s.fall.rings.push({ z: NEAR_P + i * RING_STEP, i, ph: Math.random() * 6.28 });
  }
  // Embers — 80 floating pixels hugging the tunnel walls
  for (let i = 0; i < 80; i += 1) {
    s.fall.embers.push(makeEmber());
  }

  // Best from storage (once per session)
  if (!s._bestLoaded && window.platanusArcadeStorage) {
    s._bestLoaded = true;
    s._lb = s._lb || [];
    try {
      window.platanusArcadeStorage.get('obelisco.bestScore').then((r) => {
        if (r && r.found && typeof r.value === 'number') {
          s._bestScore = r.value;
          if (s.fall) s.fall.bestScore = r.value;
        }
      }).catch(() => {});
      window.platanusArcadeStorage.get('obelisco.lb').then((r) => {
        if (r && r.found && Array.isArray(r.value)) s._lb = r.value.slice(0, 5);
      }).catch(() => {});
    } catch (_) {}
  }

  fadeHum(s, 0.1, 0.3);
  if (s._rumble) {
    const t = s._ac.currentTime;
    s._rumble.g.gain.cancelScheduledValues(t);
    s._rumble.g.gain.linearRampToValueAtTime(1.1, t + 0.3);
    s._rumble.lp.frequency.value = 520;
    if (s._rumble.mg) {
      s._rumble.mg.gain.cancelScheduledValues(t);
      s._rumble.mg.gain.linearRampToValueAtTime(0.55, t + 0.3);
    }
    if (s._rumble.bp) s._rumble.bp.frequency.value = 2200;
  }
}

function makeEmber() {
  const theta = Math.random() * Math.PI * 2;
  const radial = 0.78 + Math.random() * 0.22;
  return {
    theta, radial, wz: NEAR_P + Math.random() * (FAR_P - NEAR_P),
    vTheta: (Math.random() - 0.5) * 0.4,
    vRadial: (Math.random() - 0.5) * 0.3,
  };
}

function heatColor(z) {
  const t = Math.min(1, Math.max(0, (z - NEAR_P) / (FAR_P - NEAR_P)));
  const stops = [[1, 0.96, 0.72], [1, 0.55, 0.12], [0.58, 0.08, 0.02], [0.14, 0.02, 0.01]];
  const tt = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(tt));
  const k = tt - i;
  const a = stops[i], b = stops[i + 1];
  const r = Math.round(lerp(a[0], b[0], k) * 255);
  const gg = Math.round(lerp(a[1], b[1], k) * 255);
  const bl = Math.round(lerp(a[2], b[2], k) * 255);
  return (r << 16) | (gg << 8) | bl;
}

// Brief lateral kick of the entire fall view on left/right input — replaces the bank tilt.
function nudgeFallView(s, dx) {
  if (!s.fallView) return;
  s.tweens.killTweensOf(s.fallView);
  s.fallView.x = dx;
  s.tweens.add({ targets: s.fallView, x: 0, duration: 140, ease: 'Cubic.easeOut' });
}

function updateFall(s, time, delta) {
  const f = s.fall;
  const dt = Math.min(0.05, delta / 1000);

  if (!f.dead) {
    f.elapsed += dt;
    f.speed = Math.min(22, 9 + f.elapsed * 1.4);

    const step = 0.45;
    if (pressed(s, 'P1_L') || pressed(s, 'P2_L')) { f.rot += step; nudgeFallView(s, -28); }
    if (pressed(s, 'P1_R') || pressed(s, 'P2_R')) { f.rot -= step; nudgeFallView(s, 28); }
    f.bank = 0;

    const dz = f.speed;
    for (const r of f.rings) {
      r.z -= dz;
      if (r.z < NEAR_P) r.z += NUM_RINGS * RING_STEP;
    }
    for (let i = f.obs.length - 1; i >= 0; i -= 1) {
      const ob = f.obs[i];
      ob.z -= dz;
      if (ob.drift) ob.gapTheta += ob.drift * dt;
      if (ob.shrinkTo !== undefined) {
        const span = Math.max(1, ob.shrinkZ0 - NEAR_P);
        const k = Math.max(0, Math.min(1, 1 - (ob.z - NEAR_P) / span));
        ob.gapW = ob.shrinkFrom + (ob.shrinkTo - ob.shrinkFrom) * k;
      }
      if (ob.z < NEAR_P - 40) {
        if (!ob.hit && ob.nearEdge !== undefined) {
          const prox = Math.max(0, Math.min(1, 1 - ob.nearEdge / (ob.gapW * 0.5)));
          onObstaclePass(s, prox, time);
        }
        f.obs.splice(i, 1);
      }
    }
    // Embers drift + flow toward camera
    for (const e of f.embers) {
      e.wz -= dz * 0.95;
      e.theta += e.vTheta * dt;
      e.radial += e.vRadial * dt * 0.04;
      if (e.radial < 0.6) e.radial = 0.6;
      if (e.radial > 1.02) e.radial = 1.02;
      if (e.wz < NEAR_P) {
        e.wz = FAR_P - Math.random() * 200;
        e.theta = Math.random() * Math.PI * 2;
        e.radial = 0.78 + Math.random() * 0.22;
      }
    }
    // Heat streaks — spawn by time
    if (time > f.nextStreakAt) {
      f.streaks.push({
        theta: Math.random() * Math.PI * 2,
        z0: FAR_P * 0.55,
        len: 350 + Math.random() * 250,
        age: 0, life: 0.45,
      });
      f.nextStreakAt = time + 180 + Math.random() * 220;
    }
    for (let i = f.streaks.length - 1; i >= 0; i -= 1) {
      const st = f.streaks[i];
      st.z0 -= dz * 3.5;
      st.age += dt;
      if (st.age > st.life || st.z0 - st.len < NEAR_P) f.streaks.splice(i, 1);
    }

    if (time > f.nextSpawnAt) {
      const res = spawnFallObstacle(s) || { delay: OBS_CFG.base };
      f.nextSpawnAt = time + res.delay * 1000;
    }

    checkFallCollision(s);

    f.scorePop = Math.max(0, f.scorePop - dt * 3.6);
    f.hud.setText(String(Math.floor(f.score)).padStart(5, '0'));
    f.hud.setScale(1 + f.scorePop * 0.45);

    // Aerodynamic jitter + bank
    const jx = (Math.random() - 0.5) * 1.2;
    const jy = (Math.random() - 0.5) * 1.2;
    f.rocket.x = GW / 2 + jx;
    f.rocket.y = 980 + Math.sin(time * 0.005) * 2 + jy;
    f.rocket.rotation = 0;

    // Anchor the reentry fire to the cockpit nose tip (520 above container origin)
    if (s.tipFire) {
      s.tipFire.x = f.rocket.x;
      s.tipFire.y = f.rocket.y - 520;
    }
    if (f.meter) {
      const m = f.meter, e = f.elapsed;
      const frac = (e * e) / (e * e + 900);
      const ry = m.mTop + frac * ((m.mBot - m.mTop) - m.earthR - 4) + Math.sin(time * 0.008) * 1.2;
      m.mRocket.y = ry;
      m.mFire.x = m.mRocket.x;
      m.mFire.y = ry + 54;
      if (s.tipFire) s.tipFire.frequency = Math.max(2, 8 - frac * 6);
      m.mFire.frequency = Math.max(8, 35 - frac * 26);
    }
    f.glow.clear();
  } else {
    for (let i = f.shards.length - 1; i >= 0; i -= 1) {
      const sh = f.shards[i];
      sh.wx += sh.vx * dt;
      sh.wy += sh.vy * dt;
      sh.wz += sh.vz * dt;
      sh.vy += 200 * dt;
      sh.life -= dt * 0.45;
      if (sh.life <= 0 || sh.wz < NEAR_P || sh.wz > FAR_P) f.shards.splice(i, 1);
    }
    if (f.showingOver) {
      if (f.enteringName) {
        updateNameEntry(s);
      } else if (anyInput(s, 1)) {
        startFall(s);
        return;
      }
    }
    if (f.glow) f.glow.clear();
  }

  drawTunnel(s, time);
}

function pickWeightedKey(weights) {
  const keys = Object.keys(weights);
  let total = 0;
  for (const k of keys) total += weights[k];
  let r = Math.random() * total;
  for (const k of keys) { r -= weights[k]; if (r < 0) return k; }
  return keys[0];
}

function currentPhase(t) {
  const c = OBS_CFG;
  if (t < c.phase2) return 1;
  if (t < c.phase3) return 2;
  if (t < c.phase4) return 3;
  if (t < c.phase5) return 4;
  return 5;
}

function spawnTrail(s) {
  const f = s.fall;
  const c = OBS_CFG;
  const phase = currentPhase(f.elapsed);
  const zPerSec = f.speed * 60;
  const shapes = phase >= 5 ? { straight: 35, scurve: 35, wobble: 25, spiral: 5 }
                            : { straight: 55, wobble: 45 };
  const shape = pickWeightedKey(shapes);
  const maxLen = phase >= 5 ? c.trailLongMax : c.trailLenMax;
  const len = c.trailLenMin + Math.floor(Math.random() * (maxLen - c.trailLenMin + 1));
  const zOff = zPerSec * c.trailRingGap;
  const leadZ = zPerSec * c.trailLeadIn;
  const entry = Math.random() * Math.PI * 2;
  const dir = Math.random() < 0.5 ? 1 : -1;
  for (let i = 0; i < len; i += 1) {
    const u = len > 1 ? i / (len - 1) : 0;
    let theta = entry;
    if (shape === 'straight') theta = entry + u * c.straightSweep * dir;
    else if (shape === 'scurve') theta = entry + Math.sin(u * Math.PI * 2) * c.scurveSweep * dir;
    else if (shape === 'spiral') theta = entry + u * c.spiralSweep * dir;
    else theta = entry + u * c.wobbleSweep * dir + (Math.random() - 0.5) * c.wobbleAmp;
    f.obs.push({
      type: 'wall', z: FAR_P + leadZ + i * zOff,
      gapTheta: theta,
      gapW: c.trailGapW * (shape === 'spiral' ? c.trailSpiralGapMul : 1),
      trail: true,
    });
  }
  return c.trailLeadIn + (len - 1) * c.trailRingGap + c.trailExit;
}

function spawnFallObstacle(s) {
  const f = s.fall;
  const c = OBS_CFG;
  const t = f.elapsed;
  const zPerSec = f.speed * 60;
  // Baseline gap width narrows slightly over time. Floor ensures one-tap reachability.
  const baseGap = Math.max(1.0, Math.PI / 2 - (Math.PI / 5) * Math.min(1, t / 60));
  const phase = currentPhase(t);

  // Inject rest gap periodically: empty tunnel for a breath.
  if (t > f.nextRestAt) {
    f.nextRestAt = t + c.restEveryMin + Math.random() * (c.restEveryMax - c.restEveryMin);
    return { delay: c.rest };
  }

  // Trails are rolled separately in phases 4/5.
  const trailWeight = phase === 4 ? c.trailP4Weight : phase >= 5 ? c.trailP5Weight : 0;
  let variant;
  let extra = 0;
  if (trailWeight > 0 && Math.random() < trailWeight) {
    extra = spawnTrail(s);
    return { delay: extra };
  }
  variant = pickWeightedKey(PHASE_WEIGHTS[phase]);

  const rand2pi = () => Math.random() * Math.PI * 2;
  const sign = () => (Math.random() < 0.5 ? -1 : 1);

  if (variant === 'A') {
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: baseGap * c.wideMul });
  } else if (variant === 'B') {
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: baseGap * c.narrowMul });
  } else if (variant === 'C') {
    const a = rand2pi();
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: a, gapW: baseGap * c.twoMul, gap2: a + Math.PI });
  } else if (variant === 'D') {
    const a = rand2pi();
    const w = baseGap * c.sliverMul;
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: a, gapW: w, gap2: a + w * 1.25 });
  } else if (variant === 'E') {
    const a = rand2pi();
    f.obs.push({
      type: 'wall', z: FAR_P, gapTheta: a, gapW: baseGap * c.threeMul,
      gap2: a + (Math.PI * 2) / 3, gap3: a + (Math.PI * 4) / 3,
    });
    extra = c.relief - c.base;
  } else if (variant === 'F') {
    f.obs.push({
      type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: baseGap * c.rotMul,
      drift: sign() * (0.6 + Math.random() * 0.6),
    });
  } else if (variant === 'G') {
    const zOff = zPerSec * c.revGap;
    const sg = sign();
    const w = baseGap * c.counterMul;
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: w,
      drift: sg * (0.9 + Math.random() * 0.5) });
    f.obs.push({ type: 'wall', z: FAR_P + zOff, gapTheta: rand2pi(), gapW: w,
      drift: -sg * (0.9 + Math.random() * 0.5) });
    extra = c.revGap + c.compoundExit;
  } else if (variant === 'H') {
    const from = baseGap * c.shrinkFromMul;
    const to = baseGap * c.shrinkToMul;
    f.obs.push({
      type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: from,
      shrinkFrom: from, shrinkTo: to, shrinkZ0: FAR_P,
    });
  } else if (variant === 'I') {
    const a = rand2pi();
    const w = baseGap * c.revGapMul;
    const sep = w * (1.1 + Math.random() * 0.2) * sign();
    const zOff = zPerSec * c.revGap;
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: a, gapW: w });
    f.obs.push({ type: 'wall', z: FAR_P + zOff, gapTheta: a + sep, gapW: w });
    extra = c.revGap + c.compoundExit;
  } else if (variant === 'J') {
    const a = rand2pi();
    const w = baseGap * c.triGapMul;
    const step = w * 1.05 * sign();
    const zOff = zPerSec * c.triGap;
    for (let i = 0; i < 3; i += 1) {
      f.obs.push({ type: 'wall', z: FAR_P + i * zOff, gapTheta: a + step * i, gapW: w });
    }
    extra = c.triGap * 2 + c.compoundExit;
  } else {
    f.obs.push({ type: 'wall', z: FAR_P, gapTheta: rand2pi(), gapW: baseGap });
  }

  // Decide spacing to NEXT obstacle: tense waves after phase 1, relief already baked in for E.
  let delay;
  if (variant === 'E') delay = c.relief;
  else if (phase >= 2 && Math.random() < c.tenseChance) delay = c.tense;
  else delay = c.base;
  return { delay: delay + extra };
}

function checkFallCollision(s) {
  const f = s.fall;
  const rocketAng = Math.PI / 2;
  for (const o of f.obs) {
    if (o.hit) continue;
    if (o.z < NEAR_P + 40 || o.z > NEAR_P + 70) continue;
    const eff = (o.type === 'wall' ? o.gapTheta : o.theta) + f.rot;
    let d = rocketAng - eff;
    d = ((d % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    let minAbs = Math.abs(d);
    for (const gk of ['gap2', 'gap3', 'gap4']) {
      if (o[gk] === undefined) continue;
      let dx = rocketAng - (o[gk] + f.rot);
      dx = ((dx % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      if (Math.abs(dx) < minAbs) minAbs = Math.abs(dx);
    }
    const through = minAbs <= o.gapW / 2;
    if (through) {
      const margin = o.gapW / 2 - minAbs;
      if (o.nearEdge === undefined || margin < o.nearEdge) o.nearEdge = margin;
    }
    if (!through) { killFall(s); o.hit = true; break; }
  }
}

function drawTunnel(s, time) {
  const f = s.fall;
  const g = f.gfx;
  g.clear();
  const cx = GW / 2;
  const cy = GH / 2;

  const items = [];
  for (const r of f.rings) {
    if (r.z >= NEAR_P && r.z <= FAR_P) items.push({ kind: 0, z: r.z, i: r.i, ph: r.ph });
  }
  for (const o of f.obs) {
    if (o.z >= NEAR_P && o.z <= FAR_P) items.push({ kind: 1, z: o.z, o });
  }
  for (const e of f.embers) {
    if (e.wz >= NEAR_P && e.wz <= FAR_P) items.push({ kind: 2, z: e.wz, e });
  }
  items.sort((a, b) => b.z - a.z);

  for (const it of items) {
    const scale = FOCAL / it.z;
    if (it.kind === 0) {
      drawPlasmaRing(g, it, scale, cx, cy, time);
    } else if (it.kind === 1) {
      drawFallObstacle(s, g, it.o, scale, cx, cy);
    } else {
      drawEmber(g, it.e, scale, cx, cy);
    }
  }

  // Heat streaks — radial plasma tears
  for (const st of f.streaks) {
    const zF = st.z0;
    const zN = Math.max(NEAR_P, st.z0 - st.len);
    if (zN >= FAR_P) continue;
    const sF = FOCAL / zF;
    const sN = FOCAL / zN;
    const rW = TUNNEL_R * 0.96;
    const c = Math.cos(st.theta), sn = Math.sin(st.theta);
    const fade = Math.max(0, 1 - st.age / st.life);
    g.lineStyle(Math.max(1, 2.5 * sN), 0xffeeaa, fade * 0.85);
    g.beginPath();
    g.moveTo(cx + c * rW * sF, cy + sn * rW * sF);
    g.lineTo(cx + c * rW * sN, cy + sn * rW * sN);
    g.strokePath();
    g.lineStyle(Math.max(1, 1.2 * sN), 0xffffff, fade * 0.95);
    g.beginPath();
    g.moveTo(cx + c * rW * sF, cy + sn * rW * sF);
    g.lineTo(cx + c * rW * sN, cy + sn * rW * sN);
    g.strokePath();
  }

  // Shards (projected)
  for (const sh of f.shards) {
    if (sh.wz < NEAR_P) continue;
    const sc = FOCAL / sh.wz;
    const sx = cx + sh.wx * sc;
    const sy = cy + sh.wy * sc;
    const sz = Math.max(1, sh.size * sc);
    g.fillStyle(sh.color, Math.max(0, Math.min(1, sh.life)))
      .fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
  }
}

const FOG_COLOR = 0x0a0c18;
function fogFactor(z) {
  const t = Math.min(1, Math.max(0, (z - NEAR_P) / (FAR_P - NEAR_P)));
  return Math.pow(t, 0.85) * 0.88;
}
function fogMix(color, z) {
  const f = fogFactor(z);
  const r = (color >> 16) & 0xff, gr = (color >> 8) & 0xff, b = color & 0xff;
  const fr = (FOG_COLOR >> 16) & 0xff, fg = (FOG_COLOR >> 8) & 0xff, fb = FOG_COLOR & 0xff;
  const R = Math.round(r + (fr - r) * f);
  const G = Math.round(gr + (fg - gr) * f);
  const B = Math.round(b + (fb - b) * f);
  return (R << 16) | (G << 8) | B;
}

function drawPlasmaRing(g, it, scale, cx, cy, time) {
  const rr = TUNNEL_R * scale;
  const baseLW = Math.max(1, 2.4 * scale);
  const flick = 0.82 + 0.22 * Math.sin(time * 0.018 + it.ph * 6.28);
  const shock = it.i % 6 === 0;
  const z = it.z;
  if (shock) {
    g.lineStyle(baseLW * 4.5, fogMix(0xffdc70, z), Math.min(1, flick * 0.85));
    g.strokeCircle(cx, cy, rr + baseLW);
    g.lineStyle(baseLW * 2.2, fogMix(0xffffff, z), Math.min(1, flick));
    g.strokeCircle(cx, cy, rr);
    return;
  }
  const halo = heatColor(Math.min(FAR_P, z * 1.4));
  g.lineStyle(baseLW * 3, fogMix(halo, z), Math.min(1, flick * 0.5));
  g.strokeCircle(cx, cy, rr + baseLW * 0.7);
  const body = heatColor(z);
  g.lineStyle(baseLW * 1.5, fogMix(body, z), Math.min(1, flick * 0.9));
  g.strokeCircle(cx, cy, rr);
  if (scale > 0.12) {
    g.lineStyle(Math.max(1, baseLW * 0.5), fogMix(0xfff2b0, z), Math.min(1, flick));
    g.strokeCircle(cx, cy, Math.max(0, rr - baseLW * 0.35));
  }
}

function drawEmber(g, e, scale, cx, cy) {
  const r = TUNNEL_R * e.radial;
  const sx = cx + Math.cos(e.theta) * r * scale;
  const sy = cy + Math.sin(e.theta) * r * scale;
  // Brighter as it approaches (smaller z)
  const heat = Math.min(1, 1 - (e.wz - NEAR_P) / (FAR_P - NEAR_P));
  const col = heat > 0.75 ? 0xffffff : heat > 0.45 ? 0xffdc80 : 0xff8030;
  const sz = Math.max(1, 1 + heat * 2.5);
  g.fillStyle(fogMix(col, e.wz), Math.min(1, 0.5 + heat * 0.6)).fillRect(sx - sz / 2, sy - sz / 2, sz, sz);
}

const WALL_DEPTH = 180;
const WALL_INNER = 0.55;

function drawFallObstacle(s, g, o, scale, cx, cy) {
  const rot = s.fall.rot;
  {
    const sF = FOCAL / o.z;
    const Ro = TUNNEL_R;
    const Ri = TUNNEL_R * WALL_INNER;

    // Build gap list (sorted by start angle, normalized)
    const gaps = [{ s: o.gapTheta + rot - o.gapW / 2, e: o.gapTheta + rot + o.gapW / 2 }];
    for (const gk of ['gap2', 'gap3', 'gap4']) {
      if (o[gk] !== undefined) {
        gaps.push({ s: o[gk] + rot - o.gapW / 2, e: o[gk] + rot + o.gapW / 2 });
      }
    }
    const TAU = Math.PI * 2;
    const norm = a => ((a % TAU) + TAU) % TAU;
    const segs = gaps.map(g2 => ({ s: norm(g2.s), e: norm(g2.e) }))
      .sort((a, b) => a.s - b.s);
    // Compute solid arcs between gaps
    const solids = [];
    for (let i = 0; i < segs.length; i += 1) {
      const cur = segs[i];
      const nxt = segs[(i + 1) % segs.length];
      const start = cur.e;
      let end = nxt.s;
      if (end <= start) end += TAU;
      solids.push({ s: start, e: end });
    }

    const drawDonutSeg = (offX, offY, color, alpha, radOuter, radInner) => {
      g.fillStyle(color, alpha);
      for (const seg of solids) {
        g.beginPath();
        g.arc(cx + offX, cy + offY, radOuter, seg.s, seg.e, false);
        g.arc(cx + offX, cy + offY, radInner, seg.e, seg.s, true);
        g.closePath();
        g.fillPath();
      }
    };

    const shOff = Math.max(2, 6 * sF);
    const face = fogMix(o.trail ? 0xc8dcff : 0xfff0c8, o.z);
    const rim = fogMix(o.trail ? 0xc0f8ff : 0xffffff, o.z);
    drawDonutSeg(shOff, shOff, 0x000000, 0.55, Ro * sF, Ri * sF);
    drawDonutSeg(0, 0, face, 1, Ro * sF, Ri * sF);

    g.lineStyle(Math.max(1, 2.5 * sF), rim, 0.9);
    for (const seg of solids) {
      g.beginPath();
      g.arc(cx, cy, Ro * sF, seg.s, seg.e, false);
      g.strokePath();
    }

    const edgeLW = Math.max(1, (o.trail ? 3.4 : 2.5) * sF);
    g.lineStyle(edgeLW, rim, 1);
    for (const seg of segs) {
      for (const edge of [seg.s, seg.e]) {
        const cc = Math.cos(edge), sn = Math.sin(edge);
        g.beginPath();
        g.moveTo(cx + cc * Ri * sF, cy + sn * Ri * sF);
        g.lineTo(cx + cc * Ro * sF, cy + sn * Ro * sF);
        g.strokePath();
      }
    }
  }
}

function killFall(s) {
  const f = s.fall;
  if (f.dead) return;
  f.dead = true;
  s.cameras.main.shake(520, 0.04);
  s.flash.fillColor = 0xff2030;
  s.flash.setAlpha(0);
  s.tweens.add({
    targets: s.flash, alpha: 0.9, duration: 90, yoyo: true,
    onComplete: () => { s.flash.fillColor = 0xffffff; s.flash.setAlpha(0); },
  });
  for (let i = 0; i < 44; i += 1) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 180;
    f.shards.push({
      wx: (Math.random() - 0.5) * 30,
      wy: 170 + (Math.random() - 0.5) * 40,
      wz: NEAR_P + 6,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp * 0.7 - 40,
      vz: 30 + Math.random() * 90,
      size: 2 + Math.random() * 3,
      color: [0xf3ecd4, 0xcdc2a5, 0x8b826a, 0xe6cf98][Math.floor(Math.random() * 4)],
      life: 1,
    });
  }
  f.rocket.setVisible(false);
  stopMusic(s);
  sfxFallTransition(s);
  sfxFailBoom(s);
  if (s._rumble) {
    const t = s._ac.currentTime;
    s._rumble.g.gain.cancelScheduledValues(t);
    s._rumble.g.gain.linearRampToValueAtTime(0, t + 0.6);
    if (s._rumble.mg) {
      s._rumble.mg.gain.cancelScheduledValues(t);
      s._rumble.mg.gain.linearRampToValueAtTime(0, t + 0.6);
    }
  }
  s.time.delayedCall(1800, () => showFallOver(s));
}

const LB_A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function showFallOver(s) {
  const f = s.fall;
  const sc = Math.floor(f.score);
  const best = Math.max(f.bestScore, sc);
  f.bestScore = best;
  s._bestScore = best;
  if (sc > 0 && window.platanusArcadeStorage) {
    try { window.platanusArcadeStorage.set('obelisco.bestScore', best); } catch (_) {}
  }
  buildOverPanel(s, sc, best, true);
  f.showingOver = true;
}

function buildOverPanel(s, sc, best, entry, hi) {
  const f = s.fall;
  if (f.over) f.over.destroy();
  const over = s.add.container(GW / 2, GH / 2).setDepth(40);
  over.add(s.add.rectangle(0, 0, GW, GH, 0x000000, 0.72));
  over.add(s.add.text(0, -220, 'CRASHED', TS(44, '#ff4060', '#000', 6)).setOrigin(0.5));
  over.add(s.add.text(0, -160, String(sc).padStart(5, '0'), TS(60, '#ffffff', '#000', 5)).setOrigin(0.5));
  over.add(s.add.text(0, -110, `BEST ${String(best).padStart(5, '0')}`, TS(20, '#ffde50')).setOrigin(0.5));
  if (entry) {
    over.add(s.add.text(0, -60, 'ENTER INITIALS', TS(20, '#ffde50')).setOrigin(0.5));
    const texts = [];
    for (let i = 0; i < 3; i += 1) {
      const t = s.add.text(-56 + i * 56, 10, 'A', TS(56, '#ffffff', '#000', 5)).setOrigin(0.5);
      over.add(t); texts.push(t);
    }
    const cursor = s.add.rectangle(-56, 48, 42, 4, 0xffde50);
    over.add(cursor);
    s.tweens.add({ targets: cursor, alpha: 0.25, duration: 360, yoyo: true, repeat: -1 });
    over.add(s.add.text(0, 128, '↑↓ LETTER  ←→ POS  BTN/START OK', TS(14, '#cccccc')).setOrigin(0.5));
    f.entry = { idx: [0, 0, 0], pos: 0, sc, texts, cursor };
    f.enteringName = true;
  } else {
    drawLeaderboard(s, over, s._lb || [], hi);
    const pr = s.add.text(0, 220, 'PRESS ↑ TO FALL AGAIN', TS(22, '#ffffff')).setOrigin(0.5);
    over.add(pr);
    s.tweens.add({ targets: pr, alpha: 0.35, duration: 550, yoyo: true, repeat: -1 });
  }
  if (s.fallView) s.fallView.add(over);
  f.over = over;
}

function drawLeaderboard(s, over, lb, hi) {
  over.add(s.add.text(0, -60, 'LEADERBOARD', TS(22, '#ffde50')).setOrigin(0.5));
  if (!lb.length) {
    over.add(s.add.text(0, 40, 'NO ENTRIES YET', TS(18, '#888888')).setOrigin(0.5));
    return;
  }
  for (let i = 0; i < Math.min(5, lb.length); i += 1) {
    const e = lb[i];
    const c = i === hi ? '#50ff80' : '#ffffff';
    const y = -20 + i * 30;
    over.add(s.add.text(-140, y, (i + 1) + '.', TS(20, c)).setOrigin(0, 0.5));
    over.add(s.add.text(-100, y, e.name, TS(20, c)).setOrigin(0, 0.5));
    over.add(s.add.text(140, y, String(e.score).padStart(5, '0'), TS(20, c)).setOrigin(1, 0.5));
  }
}

function updateNameEntry(s) {
  const e = s.fall.entry;
  const bump = (d) => {
    e.idx[e.pos] = (e.idx[e.pos] + 26 + d) % 26;
    e.texts[e.pos].setText(LB_A[e.idx[e.pos]]);
  };
  if (pressed(s, 'P1_U') || pressed(s, 'P2_U')) bump(1);
  if (pressed(s, 'P1_D') || pressed(s, 'P2_D')) bump(-1);
  if (pressed(s, 'P1_L') || pressed(s, 'P2_L')) { e.pos = (e.pos + 2) % 3; e.cursor.x = -56 + e.pos * 56; }
  if (pressed(s, 'P1_R') || pressed(s, 'P2_R')) { e.pos = (e.pos + 1) % 3; e.cursor.x = -56 + e.pos * 56; }
  if (anyInput(s, 2)) submitName(s);
}

function submitName(s) {
  const f = s.fall; const e = f.entry;
  const name = e.idx.map((x) => LB_A[x]).join('');
  const lb = (s._lb || []).concat([{ name, score: e.sc }])
    .sort((a, b) => b.score - a.score).slice(0, 5);
  s._lb = lb;
  if (window.platanusArcadeStorage) {
    try { window.platanusArcadeStorage.set('obelisco.lb', lb); } catch (_) {}
  }
  const hi = lb.findIndex((x) => x.name === name && x.score === e.sc);
  f.enteringName = false;
  buildOverPanel(s, e.sc, f.bestScore, false, hi);
}
