// Capítulo 4: o neurônio. As três evidências viram alavancas que você arrasta:
// idade (vira risco pela Weibull do cap. 2), queda e inclinação da
// estabilidade (os scans do cap. 3). Pesos × entradas, soma, e o LED do
// androide responde. É exatamente o neurônio que fica ao lado do rolo.
import * as THREE from 'three';
import { makeAndroid } from '../android.js';
import { ANDROID_PARAMS, evaluateAndroid, levelLed, neuron, scans } from '../deviancy.js';
import { COLORS, button, canvasPlane, label, placeCylinder, roundRect, slider, viridis } from '../ui.js';

const P = ANDROID_PARAMS;
const MAX_AGE = 30, MAX_DROP = 0.6, MAX_SLOPE = 8;
const SLIDER_LEN = 0.15;
const comma = (x, d = 2) => x.toFixed(d).replace('.', ',');
const pct = x => `${Math.round(x * 100)}%`;

function presetFrom(who, day) {
  const e = evaluateAndroid(scans(who), day * 24);
  return { ageDays: day, drop: Math.min(e.degSignal, MAX_DROP), slope: Math.max(e.slopeMin, -MAX_SLOPE) };
}
const PRESETS = [
  ['Kara · dia 9', () => presetFrom('kara', 9)],
  ['Kara · dia 12', () => presetFrom('kara', 12)],
  ['Markus · dia 12', () => presetFrom('markus', 12)],
  ['Markus · dia 17', () => presetFrom('markus', 17)],
];

function drawPanel(g, W, H, s) {
  const x = s.inputs, r = s.out;
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 28px system-ui, sans-serif';
  g.fillText(`sinal = ${comma(P.weightDeg, 1)} × queda + ${comma(P.weightSlope, 1)} × perigo da inclinação`, 26, 50);
  g.font = '600 28px ui-monospace, monospace';
  g.fillStyle = COLORS.accent;
  g.fillText(`      = ${comma(P.weightDeg, 1)} × ${comma(x.drop)} + ${comma(P.weightSlope, 1)} × ${comma(r.slopeDanger)} = ${comma(r.signal)}`, 26, 90);
  g.fillStyle = COLORS.ink;
  g.font = '700 28px system-ui, sans-serif';
  g.fillText(`risco = idade + (1 − idade) × sinal × ${comma(P.boost)}`, 26, 146);
  g.font = '600 28px ui-monospace, monospace';
  g.fillStyle = COLORS.accent;
  g.fillText(`      = ${comma(r.ageRisk)} + ${comma(1 - r.ageRisk)} × ${comma(r.signal)} × ${comma(P.boost)} = ${comma(r.pRisk)}`, 26, 186);

  // barra empilhada: parte da idade + parte dos scans, com os limiares
  const left = 26, right = W - 26, top = 230, h = 56;
  const px = v => left + Math.min(v, 1) * (right - left);
  roundRect(g, left, top, right - left, h, 10, 'rgba(255,255,255,0.08)');
  g.fillStyle = '#94a3b8'; g.fillRect(left, top, px(r.ageRisk) - left, h);
  g.fillStyle = COLORS.accent; g.fillRect(px(r.ageRisk), top, px(r.pRisk) - px(r.ageRisk), h);
  [[P.pRiskWarn, 'aviso', top - 14], [P.pRiskConfirm, 'confirma', top + h + 32]].forEach(([v, name, y]) => {
    g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.setLineDash([6, 5]);
    g.beginPath(); g.moveTo(px(v), top - 8); g.lineTo(px(v), top + h + 8); g.stroke();
    g.setLineDash([]);
    g.fillStyle = COLORS.muted; g.font = '500 21px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText(`${name} ${pct(v)}`, px(v), y);
    g.textAlign = 'left';
  });
  g.font = '600 25px system-ui, sans-serif';
  g.fillStyle = '#cbd5e1';
  g.fillText(`Só pela idade: ${pct(r.ageRisk)}`, 26, 360);
  g.fillStyle = COLORS.accent;
  g.fillText(`Os scans somaram: +${Math.round(r.fromMeasure * 100)} pontos`, 26, 396);
  roundRect(g, W - 236, 336, 210, 54, 12, levelLed(r.level));
  g.fillStyle = '#0b0f19'; g.font = '800 28px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(r.level, W - 131, 373);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted; g.font = '500 22px system-ui, sans-serif';
  g.fillText(`O muro vermelho (cap. 3) é regra à parte: scan < ${P.forceLimit}% já acende vermelho.`, 26, H - 22);
}

export default {
  id: 'neuronio',
  title: 'O neurônio',
  steps: [
    { text: 'Capítulo 4, o neurônio. Um neurônio é só isto: pegar alguns números, multiplicar cada um por um peso e somar. À esquerda estão as três evidências sobre um androide.', control: ['preset', 0] },
    { text: 'Arraste as alavancas. A de cima é a idade, que vira risco pela curva do capítulo dois. As outras duas vêm dos scans: quanto a estabilidade caiu, e com que velocidade.' },
    { text: 'Queda e inclinação viram o sinal: zero vírgula seis vezes a queda, mais zero vírgula quatro vezes o perigo da inclinação. A grossura de cada cabo é o tamanho do peso.' },
    { text: 'O risco começa no que a idade diz e soma uma parte do sinal. Repare na barra: a cinza é a idade, a amarela é o que os scans somaram. A medição só ocupa o espaço que a idade deixou livre.' },
    { text: 'Aperte os botões dos personagens. A Kara no dia doze passa do limiar mesmo jovem. O Markus no dia doze está tranquilo; no dia dezessete, acende. O LED segue os limiares.', control: ['preset', 1] },
    { text: 'Esses pesos foram escolhidos à mão. No capítulo seis, uma máquina aprende os pesos sozinha. Antes, no capítulo cinco, este mesmo neurônio aparece ao lado de um rolo de verdade.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const s = { inputs: { ageDays: 9, drop: 0.2, slope: -2 }, out: null, level: null };

    const brain = new THREE.Group();
    brain.position.set(-0.05, -0.05, 0);
    group.add(brain);
    const nodeAt = (x, y, text) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 16), new THREE.MeshStandardMaterial({ roughness: 0.4 }));
      m.position.set(x, y, 0);
      const t = label(text, { width: 0.22, height: 0.06, size: 0.5 });
      t.position.set(x, y - 0.06, 0.01);
      brain.add(m, t);
      return { m, t, base: text };
    };
    const nodes = {
      age: nodeAt(-0.3, 0.17, 'risco pela idade'),
      drop: nodeAt(-0.3, -0.02, 'queda'),
      slope: nodeAt(-0.3, -0.21, 'perigo inclinação'),
      signal: nodeAt(-0.02, -0.11, 'sinal'),
      risk: nodeAt(0.2, 0.03, 'risco'),
    };
    const links = [[nodes.drop, nodes.signal, P.weightDeg, `× ${comma(P.weightDeg, 1)}`], [nodes.slope, nodes.signal, P.weightSlope, `× ${comma(P.weightSlope, 1)}`],
      [nodes.signal, nodes.risk, P.boost, `× ${comma(P.boost)}`], [nodes.age, nodes.risk, 1, '+ idade']];
    links.forEach(([from, to, w, text]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshStandardMaterial({ color: COLORS.positive }));
      placeCylinder(c, from.m.position, to.m.position, 0.002 + 0.007 * w);
      brain.add(c);
      const wl = label(text, { width: 0.09, height: 0.03, color: COLORS.ink });
      wl.position.copy(from.m.position).lerp(to.m.position, 0.5).add(new THREE.Vector3(0, 0.025, 0.012));
      brain.add(wl);
    });

    // alavancas das entradas
    const readouts = {};
    const lever = (key, node, toValue, fromValue) => {
      const sl = slider({
        length: SLIDER_LEN, vertical: true,
        onChange: f => { s.inputs[key] = toValue(f); dirty = true; },
        onRelease: () => ctx.emit('entrada_alterada', { entrada: key, valor: +s.inputs[key].toFixed(3), risco: +s.out.pRisk.toFixed(3) }),
      });
      sl.position.copy(node.m.position).add(new THREE.Vector3(-0.17, 0, 0));
      sl.fromValue = fromValue;
      brain.add(sl);
      const r = label('', { width: 0.14, height: 0.032, color: COLORS.accent, align: 'right' });
      r.position.copy(sl.position).add(new THREE.Vector3(-0.09, 0, 0));
      brain.add(r);
      readouts[key] = r;
      return sl;
    };
    const levers = {
      ageDays: lever('ageDays', nodes.age, f => f * MAX_AGE, v => v / MAX_AGE),
      drop: lever('drop', nodes.drop, f => f * MAX_DROP, v => v / MAX_DROP),
      slope: lever('slope', nodes.slope, f => -f * MAX_SLOPE, v => -v / MAX_SLOPE),
    };

    const android = makeAndroid({ height: 0.36, suit: 0x64748b });
    android.position.set(0.3, -0.44, 0.0);
    group.add(android);

    const panel = canvasPlane(0.52, 0.34, (g, W, H) => s.out && drawPanel(g, W, H, s));
    panel.position.set(0.68, 0.0, -0.08);
    panel.rotation.y = -0.5;
    group.add(panel);

    let dirty = true;
    const setInputs = inputs => {
      s.inputs = { ...inputs };
      Object.entries(levers).forEach(([k, sl]) => sl.set(sl.fromValue(s.inputs[k])));
      dirty = true;
    };
    const presetButtons = PRESETS.map(([text, make], k) => {
      const b = button(text, () => { applyPreset(k); ctx.emit('personagem_escolhido', { preset: text }); }, { width: 0.17, color: '#475569' });
      b.position.set(-0.4 + k * 0.185, -0.48, 0.3);
      b.rotation.x = -0.5;
      group.add(b);
      return b;
    });
    const applyPreset = k => {
      setInputs(PRESETS[k][1]());
      presetButtons.forEach((b, j) => b.set({ active: j === k }));
    };
    setInputs(s.inputs);

    const color = new THREE.Color();
    const render = () => {
      const r = s.out = neuron(s.inputs);
      if (r.level !== s.level) {
        if (s.level) ctx.emit('nivel_mudou', { de: s.level, para: r.level, risco: +r.pRisk.toFixed(3) });
        s.level = r.level;
      }
      [['age', r.ageRisk], ['drop', s.inputs.drop], ['slope', r.slopeDanger], ['signal', r.signal], ['risk', r.pRisk]].forEach(([k, v]) => {
        nodes[k].m.material.color.copy(viridis(v, color));
        nodes[k].m.material.emissive.copy(color).multiplyScalar(0.35);
        nodes[k].t.setText([nodes[k].base, comma(v)]);
      });
      readouts.ageDays.setText(`${s.inputs.ageDays.toFixed(0)} dias`);
      readouts.drop.setText(`caiu ${pct(s.inputs.drop)}`);
      readouts.slope.setText(`${comma(s.inputs.slope, 1)}/dia`);
      android.setLed(levelLed(r.level), { fast: r.level === 'CONFIRMADO' });
      panel.redraw();
    };

    return {
      group,
      update(dt) {
        android.update(dt);
        if (dirty) { dirty = false; render(); }
      },
      control(name, value) {
        if (name === 'preset' && PRESETS[Number(value)]) applyPreset(Number(value));
        else if (name === 'entradas' && value && typeof value === 'object') setInputs({ ...s.inputs, ...value });
        else return false;
        return true;
      },
      snapshot: () => s.out && {
        idade_dias: +s.inputs.ageDays.toFixed(1), queda: +s.inputs.drop.toFixed(3), inclinacao: +s.inputs.slope.toFixed(2),
        risco_idade: +s.out.ageRisk.toFixed(3), sinal: +s.out.signal.toFixed(3), risco: +s.out.pRisk.toFixed(3), nivel: s.out.level,
      },
    };
  },
};
