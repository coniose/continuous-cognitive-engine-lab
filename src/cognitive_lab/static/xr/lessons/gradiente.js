// Lição 1: descida do gradiente na paisagem do erro.
// Um neurônio com uma entrada tem só dois botões, o peso w e o viés b. Para
// cada par (w, b) existe um erro; desenhando esse erro como altura, surge um
// "vale". Aprender é rolar a bola até o fundo dele.
import * as THREE from 'three';
import { STUDY, neuronGradient, neuronLoss, sigmoid, studyInput } from '../nn.js';
import { COLORS, button, canvasPlane, label, roundRect, viridis, viridisCss } from '../ui.js';

const W_RANGE = [-3, 7];
const B_RANGE = [-5, 5];
const SIZE = 0.8;          // lado da superfície, em metros
const HEIGHT_PER_LOSS = 0.09;
const MAX_LOSS = 3.7;
const LEARNING_RATES = [0.1, 0.3, 1, 3, 10, 20, 30];
const SECONDS_PER_STEP = 0.12;
const GRID = 64;

const clamp = (v, [lo, hi]) => Math.min(Math.max(v, lo), hi);
// (w, b, erro) → coordenadas locais da superfície (b cresce para longe de você)
const toLocal = (w, b, loss, out = new THREE.Vector3()) => out.set(
  ((w - W_RANGE[0]) / (W_RANGE[1] - W_RANGE[0]) - 0.5) * SIZE,
  loss * HEIGHT_PER_LOSS,
  -((b - B_RANGE[0]) / (B_RANGE[1] - B_RANGE[0]) - 0.5) * SIZE,
);
const fromLocal = p => [
  clamp((p.x / SIZE + 0.5) * (W_RANGE[1] - W_RANGE[0]) + W_RANGE[0], W_RANGE),
  clamp((-p.z / SIZE + 0.5) * (B_RANGE[1] - B_RANGE[0]) + B_RANGE[0], B_RANGE),
];

function buildLandscape() {
  const positions = [], colors = [], index = [];
  const color = new THREE.Color();
  for (let j = 0; j <= GRID; j++) {
    for (let i = 0; i <= GRID; i++) {
      const w = W_RANGE[0] + (i / GRID) * (W_RANGE[1] - W_RANGE[0]);
      const b = B_RANGE[0] + (j / GRID) * (B_RANGE[1] - B_RANGE[0]);
      const loss = neuronLoss(w, b);
      positions.push(...toLocal(w, b, loss).toArray());
      viridis(loss / MAX_LOSS, color);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * (GRID + 1) + i, c = a + GRID + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
  }));
}

// Linhas de grade sobre a superfície (cada 1 unidade de w e de b).
function buildGridLines() {
  const points = [];
  const lift = 0.002;
  const segment = (fn, steps = 60) => {
    for (let k = 0; k < steps; k++) {
      const [w0, b0] = fn(k / steps), [w1, b1] = fn((k + 1) / steps);
      points.push(toLocal(w0, b0, neuronLoss(w0, b0) + lift / HEIGHT_PER_LOSS),
        toLocal(w1, b1, neuronLoss(w1, b1) + lift / HEIGHT_PER_LOSS));
    }
  };
  for (let w = W_RANGE[0]; w <= W_RANGE[1]; w++) segment(t => [w, B_RANGE[0] + t * (B_RANGE[1] - B_RANGE[0])]);
  for (let b = B_RANGE[0]; b <= B_RANGE[1]; b++) segment(t => [W_RANGE[0] + t * (W_RANGE[1] - W_RANGE[0]), b]);
  return new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
  );
}

function drawBoard(g, W, H, s) {
  roundRect(g, 0, 0, W, H, 28, COLORS.panel);
  g.fillStyle = COLORS.ink;
  g.font = '700 34px system-ui, sans-serif';
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillText('O neurônio: horas de estudo → passou?', 28, 52);
  g.font = '500 24px system-ui, sans-serif';
  g.fillStyle = COLORS.muted;
  g.fillText('previsão = σ(w · x + b)    (x = horas, centralizadas)', 28, 88);

  // área do gráfico
  const left = 70, right = W - 30, top = 112, bottom = H - 150;
  const px = h => left + (h / 9) * (right - left);
  const py = p => bottom - p * (bottom - top);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(left, top); g.lineTo(left, bottom); g.lineTo(right, bottom); g.stroke();
  g.setLineDash([8, 8]);
  g.beginPath(); g.moveTo(left, py(0.5)); g.lineTo(right, py(0.5)); g.stroke();
  g.setLineDash([]);
  g.fillStyle = COLORS.muted;
  g.font = '500 22px system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText('1', left - 10, py(1) + 7);
  g.fillText('0', left - 10, py(0) + 7);
  g.textAlign = 'center';
  for (let h = 0; h <= 9; h += 3) g.fillText(`${h}h`, px(h), bottom + 28);

  // curva do neurônio com os (w, b) atuais
  g.strokeStyle = '#ffffff';
  g.lineWidth = 5;
  g.beginPath();
  for (let k = 0; k <= 90; k++) {
    const h = (k / 90) * 9;
    const p = sigmoid(s.w * studyInput(h) + s.b);
    if (k === 0) g.moveTo(px(h), py(p)); else g.lineTo(px(h), py(p));
  }
  g.stroke();

  // dados: amarelo = passou, roxo = não passou
  STUDY.hours.forEach((h, i) => {
    const y = STUDY.passed[i];
    g.fillStyle = viridisCss(y);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath(); g.arc(px(h), py(y), 11, 0, Math.PI * 2); g.fill(); g.stroke();
  });

  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 30px ui-monospace, monospace';
  g.fillText(`w = ${s.w.toFixed(2)}   b = ${s.b.toFixed(2)}   erro = ${s.loss.toFixed(3)}`, 28, H - 92);
  g.font = '500 24px system-ui, sans-serif';
  g.fillStyle = COLORS.muted;
  g.fillText(`passos: ${s.steps}    taxa de aprendizado: ${s.lr}`, 28, H - 54);
  g.fillStyle = s.message.color;
  g.fillText(s.message.text, 28, H - 20);
}

export default {
  id: 'gradiente',
  title: 'Descida do gradiente',

  create(ctx) {
    const group = new THREE.Group();
    const s = {
      w: -2.5, b: 4, loss: 0, steps: 0, lr: 1, playing: true, held: false,
      message: { text: '', color: COLORS.muted },
    };
    let timer = 0, boardDirty = true, boardTimer = 0;

    const land = new THREE.Group();
    land.position.set(-0.27, -0.24, 0);
    group.add(land);
    const surface = buildLandscape();
    land.add(surface, buildGridLines());

    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 24, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x666666, roughness: 0.3 }),
    );
    land.add(ball);

    const MAX_TRAIL = 3000;
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 3), 3));
    trailGeometry.setDrawRange(0, 0);
    const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }));
    land.add(trail);
    let trailCount = 0;
    const resetTrail = () => { trailCount = 0; trailGeometry.setDrawRange(0, 0); };
    const pushTrail = p => {
      if (trailCount >= MAX_TRAIL) return;
      trailGeometry.attributes.position.setXYZ(trailCount++, p.x, p.y + 0.004, p.z);
      trailGeometry.attributes.position.needsUpdate = true;
      trailGeometry.setDrawRange(0, trailCount);
    };

    const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), 0.1, 0xd7ef4b, 0.025, 0.016);
    land.add(arrow);

    // rótulos dos eixos
    const axisW = label('peso w →', { width: 0.2, height: 0.04 });
    axisW.position.set(0.25, 0.01, SIZE / 2 + 0.03);
    axisW.rotation.x = -0.6;
    const axisB = label('viés b →', { width: 0.2, height: 0.04 });
    axisB.position.set(-SIZE / 2 - 0.05, 0.02, 0);
    axisB.rotation.set(-1.0, Math.PI / 2, 0, 'YXZ'); // deitado ao longo de b, inclinado para cima
    const axisL = label('erro ↑', { width: 0.14, height: 0.04 });
    axisL.position.set(-SIZE / 2 - 0.08, 0.36, -SIZE / 2);
    land.add(axisW, axisB, axisL);

    const hint = label([
      'Aponte para a paisagem e aperte (gatilho, pinça ou clique): a bola vai até lá.',
      'Arraste, solte e veja ela descer o vale do erro. A seta amarela é o gradiente.',
    ], { width: 1.25, height: 0.075, size: 0.62, background: COLORS.panel });
    hint.position.set(0, 0.3, -0.05);
    group.add(hint);

    const board = canvasPlane(0.5, 0.42, (g, W, H) => drawBoard(g, W, H, s));
    board.position.set(0.42, 0.0, 0.02);
    board.rotation.y = -0.3;
    group.add(board);

    const setMessage = (text, color = COLORS.muted) => { s.message = { text, color }; boardDirty = true; };
    const place = (w, b) => {
      s.w = clamp(w, W_RANGE);
      s.b = clamp(b, B_RANGE);
      s.loss = neuronLoss(s.w, s.b);
      const p = toLocal(s.w, s.b, s.loss);
      ball.position.copy(p).y += 0.018;
      pushTrail(p);
      const [gw, gb] = neuronGradient(s.w, s.b);
      const size = Math.hypot(gw, gb);
      arrow.visible = size > 1e-3;
      if (arrow.visible) {
        const step = Math.min(0.9, 0.25 + size);
        const nw = clamp(s.w - (gw / size) * step, W_RANGE), nb = clamp(s.b - (gb / size) * step, B_RANGE);
        const end = toLocal(nw, nb, neuronLoss(nw, nb)).add(new THREE.Vector3(0, 0.02, 0));
        const start = ball.position.clone();
        const dir = end.sub(start);
        arrow.position.copy(start);
        arrow.setDirection(dir.clone().normalize());
        arrow.setLength(Math.max(dir.length(), 0.04), 0.025, 0.016);
      }
      boardDirty = true;
      return size;
    };

    const step = () => {
      const [gw, gb] = neuronGradient(s.w, s.b);
      s.steps++;
      const size = place(s.w - s.lr * gw, s.b - s.lr * gb);
      if (size < 2e-3 && s.playing) {
        s.playing = false;
        playButton.set({ text: '▶ Descer' });
        setMessage('Chegou ao fundo do vale: o gradiente quase zerou.', COLORS.accent);
        ctx.emit('convergiu', { w: +s.w.toFixed(3), b: +s.b.toFixed(3), erro: +s.loss.toFixed(4), passos: s.steps });
      }
    };

    const setPlaying = playing => {
      s.playing = playing;
      playButton.set({ text: playing ? '⏸ Pausar' : '▶ Descer' });
      if (playing) setMessage('Descendo: cada passo anda contra o gradiente.');
    };
    const restart = (w, b) => {
      resetTrail();
      s.steps = 0;
      place(w, b);
    };

    const hitToParams = pointer => {
      const hit = pointer.raycaster.intersectObject(surface, false)[0];
      return hit ? fromLocal(land.worldToLocal(hit.point.clone())) : null;
    };
    surface.userData.interactive = {
      onGrab: (hit, pointer) => {
        s.held = true;
        s.playing = false;
        playButton.set({ text: '▶ Descer' });
        resetTrail();
        s.steps = 0;
        const params = hitToParams(pointer);
        if (params) place(...params);
        setMessage('Segurando a bola: arraste e solte onde quiser.');
      },
      onDrag: pointer => {
        const params = hitToParams(pointer);
        if (params) { resetTrail(); place(...params); }
      },
      onRelease: () => {
        s.held = false;
        ctx.emit('bola_solta', { w: +s.w.toFixed(3), b: +s.b.toFixed(3), erro: +s.loss.toFixed(4) });
        setPlaying(true);
      },
    };

    const playButton = button('⏸ Pausar', () => setPlaying(!s.playing), { width: 0.15 });
    const stepButton = button('1 passo', () => { setPlaying(false); step(); }, { width: 0.15, color: '#475569' });
    const randomButton = button('🎲 Novo ponto', () => {
      restart(W_RANGE[0] + Math.random() * 10, B_RANGE[0] + Math.random() * 10);
      setPlaying(true);
    }, { width: 0.15, color: '#475569' });
    const changeLr = delta => {
      const i = clamp(LEARNING_RATES.indexOf(s.lr) + delta, [0, LEARNING_RATES.length - 1]);
      s.lr = LEARNING_RATES[i];
      setMessage(s.lr >= 20
        ? `Taxa ${s.lr}: passos grandes demais, a bola pula de um lado do vale para o outro.`
        : `Taxa de aprendizado agora é ${s.lr}.`, s.lr >= 20 ? COLORS.negative : COLORS.muted);
      ctx.emit('taxa_alterada', { taxa: s.lr });
    };
    const lrDown = button('taxa −', () => changeLr(-1), { width: 0.15, color: '#475569' });
    const lrUp = button('taxa +', () => changeLr(+1), { width: 0.15, color: '#475569' });
    [[playButton, -0.16, -0.27], [stepButton, 0, -0.27], [randomButton, 0.16, -0.27],
      [lrDown, -0.08, -0.33], [lrUp, 0.08, -0.33]].forEach(([b, x, y]) => {
      b.position.set(x, y, 0);
      board.add(b);
    });

    restart(s.w, s.b);
    setMessage('Descendo: cada passo anda contra o gradiente.');

    return {
      group,
      update(dt) {
        if (s.playing && !s.held) {
          timer += dt;
          while (timer > SECONDS_PER_STEP && s.playing) { timer -= SECONDS_PER_STEP; step(); }
        }
        boardTimer += dt;
        if (boardDirty && boardTimer > 1 / 15) { board.redraw(); boardDirty = false; boardTimer = 0; }
      },
      control(name, value) {
        if (name === 'play') setPlaying(true);
        else if (name === 'pause') setPlaying(false);
        else if (name === 'step') { setPlaying(false); step(); }
        else if (name === 'reset') { restart(-2.5, 4); setPlaying(true); }
        else if (name === 'lr' && LEARNING_RATES.includes(Number(value))) { s.lr = Number(value); boardDirty = true; }
        else if (name === 'place' && Array.isArray(value)) { restart(Number(value[0]), Number(value[1])); setPlaying(true); }
        else return false;
        return true;
      },
      snapshot() {
        return {
          w: +s.w.toFixed(3), b: +s.b.toFixed(3), erro: +s.loss.toFixed(4), passos: s.steps,
          taxa_aprendizado: s.lr, descendo: s.playing, segurando: s.held, mensagem: s.message.text,
        };
      },
    };
  },
};
