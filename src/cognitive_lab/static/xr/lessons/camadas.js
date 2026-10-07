// Lição 2: camadas trabalhando juntas (XOR).
// À esquerda, a rede: bolinhas são neurônios (cor = ativação), cilindros são
// pesos (azul = positivo, laranja = negativo, espessura = força). À direita,
// o gráfico 3D da resposta da rede para cada entrada (x1, x2): treinar é ver
// esse "lençol" se dobrar até tocar os alvos.
import * as THREE from 'three';
import { MLP, XOR } from '../nn.js';
import { COLORS, button, canvasPlane, label, placeCylinder, roundRect, viridis, viridisCss } from '../ui.js';

const MODES = {
  rede: { sizes: [2, 4, 1], name: 'rede 2-4-1' },
  neuronio: { sizes: [2, 1], name: '1 neurônio' },
};
const EPOCHS_PER_SECOND = 120; // devagar o bastante para ver a superfície dobrar
const LR = 1;
const WAVE_SECONDS = 0.35;    // atraso entre camadas na animação da passagem
const SURF = 0.42, SURF_H = 0.25, GRID = 24;
const NEURON_R = 0.028;

function buildOutputSurface() {
  const n = (GRID + 1) * (GRID + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const index = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const a = j * (GRID + 1) + i, c = a + GRID + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  geometry.setIndex(index);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.8,
  }));
}
// entrada (x1, x2) ∈ [0,1]² e saída ŷ → ponto local do gráfico
const surfPoint = (x1, x2, y, out = new THREE.Vector3()) =>
  out.set((x1 - 0.5) * SURF, y * SURF_H, -(x2 - 0.5) * SURF);

function drawPanel(g, W, H, s) {
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 40px system-ui, sans-serif';
  g.fillText(`${s.modeName} · época ${s.epoch} · erro ${s.loss.toFixed(3)}`, 28, 46);
  g.font = '500 28px system-ui, sans-serif';
  g.fillStyle = s.message.color;
  g.fillText(s.message.text, 28, 94);

  const colW = (W - 52) / 4;
  s.predictions.forEach((p, k) => {
    const x = 26 + k * colW, y = 128;
    const target = XOR.targets[k];
    const ok = Math.abs(p - target) < 0.5;
    roundRect(g, x, y, colW - 14, H - y - 16, 16, 'rgba(255,255,255,0.06)');
    g.fillStyle = COLORS.muted;
    g.font = '500 28px ui-monospace, monospace';
    g.fillText(`(${XOR.inputs[k].join(',')}) alvo ${target}`, x + 16, y + 38);
    roundRect(g, x + 16, y + 74, 48, 48, 10, viridisCss(p));
    g.fillStyle = ok ? '#4ade80' : '#f87171';
    g.font = '700 40px ui-monospace, monospace';
    g.fillText(`${p.toFixed(2)} ${ok ? '✓' : '✗'}`, x + 78, y + 100);
  });
}

export default {
  id: 'camadas',
  title: 'Camadas',
  steps: [
    { text: 'Capítulo 7, camadas. Um conflito: x1 é o que a ordem manda, agir ou não. x2 é o que a consciência do androide manda. Ele diverge quando as duas discordam.', control: ['mode', 'rede'] },
    { text: 'Toque nas bolinhas x1 e x2 para escolher o caso e veja o sinal atravessar a rede. Cada bolinha é um neurônio, cada cabo é um peso: azul positivo, laranja negativo.' },
    { text: 'Agora estou trocando para um neurônio só. Treine: ele empaca em meio a meio. Um neurônio só inclina um plano, e discordar não se separa com uma reta.', control: ['mode', 'neuronio'] },
    { text: 'Voltei para a rede com uma camada escondida. Treine de novo: o lençol de saída se dobra até encostar nos quatro cubos. Camadas permitem regras como diverge quando discordam.', control: ['mode', 'rede'] },
    { text: 'Fim da trilha. Você viu probabilidade como contagem, o risco crescendo com o tempo, medição contra inferência, um neurônio que junta tudo, o rolo de verdade e como máquinas aprendem os pesos.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const s = {
      mode: 'rede', modeName: MODES.rede.name, seed: 1, input: [0, 1], training: false,
      epoch: 0, loss: 0, predictions: [0, 0, 0, 0], message: { text: '', color: COLORS.muted },
    };
    let net, waveStart = 0, time = 0, epochDebt = 0, panelDirty = true, panelTimer = 0, surfaceDirty = true;

    const graph = new THREE.Group();
    graph.position.set(-0.42, -0.02, 0);
    group.add(graph);
    let neurons = [], links = [], graphLabels = [];
    const linkGeometry = new THREE.CylinderGeometry(1, 1, 1, 10);
    const neuronGeometry = new THREE.SphereGeometry(NEURON_R, 24, 16);

    const neuronPosition = (layer, i, sizes) => {
      const step = sizes.length > 2 ? 0.2 : 0.3;
      const x = (layer - (sizes.length - 1) / 2) * step;
      const y = ((sizes[layer] - 1) / 2 - i) * 0.11;
      return new THREE.Vector3(x, y, 0);
    };

    const buildGraph = () => {
      graph.clear();
      neurons = []; links = []; graphLabels = [];
      const sizes = net.sizes;
      sizes.forEach((count, l) => {
        neurons.push(Array.from({ length: count }, (_, i) => {
          const mesh = new THREE.Mesh(neuronGeometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }));
          mesh.position.copy(neuronPosition(l, i, sizes));
          graph.add(mesh);
          if (l === 0) {
            mesh.userData.interactive = {
              onPress: () => {
                s.input[i] = 1 - s.input[i];
                waveStart = time;
                surfaceDirty = true;
                ctx.emit('entrada_alterada', { entrada: s.input.slice(), saida: +net.predict(s.input).toFixed(3) });
              },
              onHover: on => mesh.scale.setScalar(on ? 1.35 : 1),
            };
          }
          return mesh;
        }));
      });
      for (let l = 0; l < sizes.length - 1; l++) {
        for (let i = 0; i < sizes[l]; i++) {
          for (let j = 0; j < sizes[l + 1]; j++) {
            const mesh = new THREE.Mesh(linkGeometry, new THREE.MeshStandardMaterial({ roughness: 0.6, transparent: true, opacity: 0.9 }));
            graph.add(mesh);
            links.push({ mesh, l, i, j });
          }
        }
      }
      const last = sizes.length - 1;
      const tag = (text, pos, width = 0.06) => {
        const t = label(text, { width, height: 0.035 });
        t.position.copy(pos);
        graph.add(t);
      };
      tag('x1', neurons[0][0].position.clone().add(new THREE.Vector3(-0.07, 0, 0)));
      tag('x2', neurons[0][1].position.clone().add(new THREE.Vector3(-0.07, 0, 0)));
      tag('ŷ', neurons[last][0].position.clone().add(new THREE.Vector3(0.07, 0, 0)));
      const bottom = -0.26;
      tag('entrada', new THREE.Vector3(neurons[0][0].position.x, bottom, 0), 0.14);
      if (sizes.length > 2) tag('oculta', new THREE.Vector3(neurons[1][0].position.x, bottom, 0), 0.14);
      tag('saída', new THREE.Vector3(neurons[last][0].position.x, bottom, 0), 0.14);
      ctx.refreshInteractive();
    };

    // gráfico 3D da saída
    const plot = new THREE.Group();
    plot.position.set(0.36, -0.2, 0);
    plot.rotation.x = 0.25; // inclina um pouco para você ver o "lençol" de cima
    group.add(plot);
    const surface = buildOutputSurface();
    plot.add(surface);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(SURF, SURF_H, SURF)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }),
    );
    frame.position.y = SURF_H / 2;
    plot.add(frame);
    const markers = XOR.inputs.map((x, k) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.022),
        new THREE.MeshStandardMaterial({ color: viridis(XOR.targets[k]), emissive: viridis(XOR.targets[k]), emissiveIntensity: 0.4 }));
      m.position.copy(surfPoint(x[0], x[1], XOR.targets[k]));
      plot.add(m);
      const t = label(`(${x.join(',')})`, { width: 0.08, height: 0.03, color: COLORS.muted });
      t.position.copy(surfPoint(x[0], x[1], 0)).add(new THREE.Vector3((x[0] - 0.5) * 0.12, -0.02, 0));
      plot.add(t);
      return m;
    });
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 8), new THREE.MeshBasicMaterial({ color: COLORS.accent }));
    plot.add(probe);
    const axis1 = label('x1 ordem →', { width: 0.16, height: 0.035 });
    axis1.position.set(0, -0.03, SURF / 2 + 0.03);
    const axis2 = label('x2 consciência →', { width: 0.22, height: 0.035 });
    axis2.position.set(SURF / 2 + 0.06, -0.01, 0);
    axis2.rotation.y = -Math.PI / 2;
    const axisY = label('ŷ ↑', { width: 0.08, height: 0.035 });
    axisY.position.set(-SURF / 2 - 0.04, SURF_H, -SURF / 2);
    plot.add(axis1, axis2, axisY);

    const hint = label([
      'x1 = a ordem manda agir · x2 = a consciência manda agir · diverge (1) quando discordam.',
      'Toque em x1 e x2, treine e veja o gráfico 3D se dobrar até encostar nos cubos.',
    ], { width: 1.25, height: 0.075, size: 0.62, background: COLORS.panel });
    hint.position.set(0, 0.3, -0.05);
    group.add(hint);

    const panel = canvasPlane(0.82, 0.18, (g, W, H) => drawPanel(g, W, H, s));
    panel.position.set(0, -0.47, 0.06);
    panel.rotation.x = -0.2;
    group.add(panel);

    const setMessage = (text, color = COLORS.muted) => { s.message = { text, color }; panelDirty = true; };
    const reset = (seed = s.seed) => {
      s.seed = seed;
      net = new MLP(MODES[s.mode].sizes, seed);
      s.modeName = MODES[s.mode].name;
      s.epoch = 0;
      s.loss = net.loss();
      buildGraph();
      surfaceDirty = true;
      panelDirty = true;
    };
    const setTraining = on => {
      s.training = on;
      trainButton.set({ text: on ? '⏸ Pausar' : '▶ Treinar' });
      if (on) setMessage('Treinando: a cada época o erro volta pelas camadas e ajusta os pesos.');
    };

    const trainButton = button('▶ Treinar', () => setTraining(!s.training), { width: 0.16 });
    const epochButton = button('+1 época', () => { setTraining(false); net.trainEpoch(XOR, LR); surfaceDirty = panelDirty = true; }, { width: 0.16, color: '#475569' });
    const seedButton = button('🎲 Pesos novos', () => {
      setTraining(false);
      reset(Math.floor(Math.random() * 1e6));
      setMessage('Pesos sorteados de novo: a rede esqueceu tudo.');
    }, { width: 0.16, color: '#475569' });
    const modeButton = button('Modo: 1 neurônio', () => {
      s.mode = s.mode === 'rede' ? 'neuronio' : 'rede';
      modeButton.set({ text: s.mode === 'rede' ? 'Modo: 1 neurônio' : 'Modo: rede 2-4-1' });
      setTraining(false);
      reset();
      setMessage(s.mode === 'neuronio'
        ? 'Um neurônio só consegue inclinar um plano (uma reta). Treine e veja ele empacar em 0,5.'
        : 'Com a camada oculta, cada neurônio traça uma reta e a saída combina todas.');
      ctx.emit('modo_alterado', { modo: s.modeName });
    }, { width: 0.2, color: '#7c3aed' });
    [[trainButton, -0.28], [epochButton, -0.1], [seedButton, 0.08], [modeButton, 0.28]].forEach(([b, x]) => {
      b.position.set(x * 1.1, -0.125, 0.003);
      panel.add(b);
    });

    const color = new THREE.Color();
    const updateSurface = () => {
      const pos = surface.geometry.attributes.position, col = surface.geometry.attributes.color;
      const p = new THREE.Vector3();
      for (let j = 0; j <= GRID; j++) {
        for (let i = 0; i <= GRID; i++) {
          const k = j * (GRID + 1) + i;
          const x1 = i / GRID, x2 = j / GRID;
          const y = net.predict([x1, x2]);
          surfPoint(x1, x2, y, p);
          pos.setXYZ(k, p.x, p.y, p.z);
          viridis(y, color);
          col.setXYZ(k, color.r, color.g, color.b);
        }
      }
      pos.needsUpdate = col.needsUpdate = true;
      surface.geometry.computeVertexNormals();
      surface.geometry.computeBoundingSphere();
      const out = net.predict(s.input);
      probe.scale.y = Math.max(out * SURF_H, 0.001);
      probe.position.copy(surfPoint(s.input[0], s.input[1], out / 2));
      s.predictions = XOR.inputs.map(x => net.predict(x));
      s.loss = net.loss();
    };

    const updateGraph = () => {
      const acts = net.forward(s.input);
      const since = time - waveStart;
      neurons.forEach((layer, l) => layer.forEach((mesh, i) => {
        const lit = since >= l * WAVE_SECONDS;
        const flash = lit && since < l * WAVE_SECONDS + 0.25 ? 1.6 : 0.55;
        if (lit) viridis(acts[l][i], mesh.material.color); else mesh.material.color.set(0x333844);
        mesh.material.emissive.copy(mesh.material.color).multiplyScalar(lit ? flash * 0.5 : 0);
      }));
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      links.forEach(({ mesh, l, i, j }) => {
        const w = net.weights[l][i][j];
        a.copy(neurons[l][i].position); b.copy(neurons[l + 1][j].position);
        placeCylinder(mesh, a, b, 0.0015 + 0.006 * Math.min(Math.abs(w) / 5, 1));
        mesh.material.color.set(w >= 0 ? COLORS.positive : COLORS.negative);
        const lit = since >= (l + 0.5) * WAVE_SECONDS;
        mesh.material.opacity = lit ? 0.9 : 0.25;
      });
    };

    reset(1);
    setMessage('A rede começa com pesos aleatórios: por isso ela erra quase tudo.');

    return {
      group,
      update(dt) {
        time += dt;
        if (s.training) {
          epochDebt += dt * EPOCHS_PER_SECOND;
          const n = Math.min(Math.floor(epochDebt), 50);
          epochDebt -= n;
          for (let e = 0; e < n; e++) net.trainEpoch(XOR, LR);
          if (n) { surfaceDirty = true; panelDirty = true; }
          if (s.mode === 'rede' && net.loss() < 0.02) {
            setTraining(false);
            setMessage(`Resolvido em ${net.epoch} épocas: as camadas dobraram o plano.`, COLORS.accent);
            ctx.emit('convergiu', { modo: s.modeName, epocas: net.epoch, erro: +net.loss().toFixed(4) });
          } else if (s.mode === 'neuronio' && net.epoch > 1500) {
            setTraining(false);
            setMessage('Empacou: nenhuma reta separa o XOR. Por isso precisamos de camadas.', COLORS.negative);
            ctx.emit('empacou', { modo: s.modeName, epocas: net.epoch, erro: +net.loss().toFixed(4) });
          }
        }
        s.epoch = net.epoch;
        if (surfaceDirty) { updateSurface(); surfaceDirty = false; }
        updateGraph();
        panelTimer += dt;
        if (panelDirty && panelTimer > 1 / 12) { panel.redraw(); panelDirty = false; panelTimer = 0; }
      },
      control(name, value) {
        if (name === 'play' || name === 'train') setTraining(true);
        else if (name === 'pause') setTraining(false);
        else if (name === 'step') { setTraining(false); net.trainEpoch(XOR, LR); surfaceDirty = panelDirty = true; }
        else if (name === 'reset') { setTraining(false); reset(value ? Number(value) : s.seed); }
        else if (name === 'mode' && MODES[value] && value !== s.mode) modeButton.userData.interactive.onPress();
        else if (name === 'input' && Array.isArray(value)) {
          s.input = value.slice(0, 2).map(v => (Number(v) ? 1 : 0));
          waveStart = time;
          surfaceDirty = true;
        } else return false;
        return true;
      },
      snapshot() {
        return {
          modo: s.modeName, epoca: net.epoch, erro: +net.loss().toFixed(4), treinando: s.training,
          entrada: s.input.slice(), saida: +net.predict(s.input).toFixed(3),
          previsoes: XOR.inputs.map((x, k) => ({ entrada: x, alvo: XOR.targets[k], previsao: +s.predictions[k].toFixed(3) })),
          mensagem: s.message.text,
        };
      },
    };
  },
};
