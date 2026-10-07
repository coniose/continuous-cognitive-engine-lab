// Capítulo 1: probabilidade é contar. Cem androides, cada um com a mesma
// chance p de divergir na semana. Uma androide sozinha diverge ou não (0 ou
// 1); a chance só aparece quando você repete muitas vezes e conta.
import * as THREE from 'three';
import { makeCrowd } from '../android.js';
import { LED, drawWeek } from '../deviancy.js';
import { makeRng } from '../nn.js';
import { COLORS, button, canvasPlane, label, roundRect } from '../ui.js';

const CHANCES = [0.05, 0.1, 0.2, 0.5];
const KARA = 44;               // a Kara está no meio da multidão
const REVEAL_SECONDS = 0.45;   // LEDs piscam amarelo antes do resultado
const pct = p => `${Math.round(p * 100)}%`;

function drawPanel(g, W, H, s) {
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 32px system-ui, sans-serif';
  g.fillText(`Chance de cada um divergir na semana: ${pct(s.p)}`, 26, 50);
  const last = s.weeks[s.weeks.length - 1];
  g.font = '600 28px system-ui, sans-serif';
  g.fillStyle = last === undefined ? COLORS.muted : '#fca5a5';
  g.fillText(last === undefined ? 'Aperte 🎲 para sortear uma semana.' : `Última semana: ${last} de 100 divergiram`, 26, 96);
  g.fillStyle = COLORS.muted;
  g.font = '500 25px system-ui, sans-serif';
  g.fillText(`Esperado: 100 × ${pct(s.p)} = ${Math.round(100 * s.p)}`, 26, 134);
  if (s.weeks.length) {
    const avg = s.weeks.reduce((a, b) => a + b, 0) / s.weeks.length;
    g.fillText(`Média de ${s.weeks.length} semana(s): ${avg.toFixed(1).replace('.', ',')} · Kara divergiu em ${s.karaCount} de ${s.weeks.length}`, 26, 168);
  }

  // histograma: quantas semanas deram cada contagem
  const left = 40, right = W - 26, top = 200, bottom = H - 74;
  const maxCount = Math.min(100, Math.max(20, Math.round(100 * s.p * 2.2)));
  const px = c => left + (c / maxCount) * (right - left);
  const bins = new Map();
  s.weeks.forEach(c => bins.set(c, (bins.get(c) || 0) + 1));
  const tallest = Math.max(4, ...bins.values());
  const barW = Math.max(4, (right - left) / maxCount - 2);
  bins.forEach((n, c) => {
    const h = (n / tallest) * (bottom - top);
    g.fillStyle = c === s.weeks[s.weeks.length - 1] ? '#ef4444' : '#f87171';
    g.fillRect(px(Math.min(c, maxCount)) - barW / 2, bottom - h, barW, h);
  });
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(left, bottom); g.lineTo(right, bottom); g.stroke();
  g.setLineDash([8, 8]); g.strokeStyle = COLORS.accent;
  g.beginPath(); g.moveTo(px(100 * s.p), top - 6); g.lineTo(px(100 * s.p), bottom); g.stroke();
  g.setLineDash([]);
  g.fillStyle = COLORS.muted; g.font = '500 22px system-ui, sans-serif'; g.textAlign = 'center';
  for (let c = 0; c <= maxCount; c += maxCount > 40 ? 20 : 5) g.fillText(String(c), px(c), bottom + 28);
  g.textAlign = 'left';
  g.fillText('quantos divergiram na semana →', left, H - 12);
  g.fillStyle = COLORS.accent;
  g.fillText('esperado', px(100 * s.p) + 8, top + 10);
}

export default {
  id: 'contar',
  title: 'Contar',
  steps: [
    { text: 'Capítulo 1, contar. Aqui estão cem androides iguais à Kara. Cada um tem a mesma chance de divergir nesta semana: dez por cento.', control: ['zerar'] },
    { text: 'Aperte o botão sortear uma semana. Cada androide joga a sua própria moeda viciada. Conte quantos ficaram vermelhos.' },
    { text: 'Repare na Kara, marcada com o anel amarelo. Para ela não existe dez por cento: ou divergiu, ou não. A chance só aparece quando olhamos muitos.' },
    { text: 'Agora aperte vinte semanas. Cada barra do gráfico conta quantas semanas deram aquele número. As barras se juntam em volta do esperado, a linha amarela.' },
    { text: 'Essa é a ideia inteira de probabilidade: dez por cento quer dizer que, repetindo muitas vezes, uns dez em cada cem divergem. Troque a chance e veja o monte andar.' },
    { text: 'Mas a chance não é sempre a mesma. Um androide recém-ativado é diferente de um que já viveu muito. Próximo capítulo: o tempo.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const rng = makeRng(11);
    const s = { p: 0.1, weeks: [], karaCount: 0, queue: 0, reveal: 0, pending: null };

    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.66), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
    floor.position.set(-0.12, -0.36, 0.0);
    group.add(floor);
    const crowd = makeCrowd();
    crowd.position.set(-0.12, -0.354, 0.0);
    group.add(crowd);
    const karaRing = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.003, 8, 32), new THREE.MeshBasicMaterial({ color: COLORS.accent }));
    karaRing.rotation.x = Math.PI / 2;
    karaRing.position.copy(crowd.positions[KARA]).add(new THREE.Vector3(0, 0.003, 0));
    crowd.add(karaRing);
    const karaTag = label('Kara', { width: 0.08, height: 0.03, color: COLORS.accent });
    karaTag.position.copy(crowd.positions[KARA]).add(new THREE.Vector3(0, 0.13, 0));
    crowd.add(karaTag);

    const panel = canvasPlane(0.5, 0.42, (g, W, H) => drawPanel(g, W, H, s));
    panel.position.set(0.5, -0.02, -0.02);
    panel.rotation.y = -0.4;
    group.add(panel);

    const paint = result => {
      for (let i = 0; i < crowd.n; i++) crowd.setLed(i, result ? (result[i] ? LED.divergiu : LED.estavel) : LED.aviso);
      crowd.commit();
    };
    const startWeek = () => { s.pending = drawWeek(crowd.n, s.p, rng); s.reveal = REVEAL_SECONDS; paint(null); };
    const finishWeek = () => {
      const result = s.pending;
      s.pending = null;
      paint(result);
      const count = result.filter(Boolean).length;
      s.weeks.push(count);
      if (result[KARA]) s.karaCount++;
      panel.redraw();
      ctx.emit('semana_sorteada', { chance: s.p, divergiram: count, kara: result[KARA] });
    };
    const reset = () => { s.weeks = []; s.karaCount = 0; s.queue = 0; s.pending = null; paint([]); panel.redraw(); };
    const setChance = p => { s.p = p; chanceButton.set({ text: `chance ${pct(p)}` }); reset(); };

    const one = button('🎲 Sortear 1 semana', () => { s.queue = 0; startWeek(); }, { width: 0.22 });
    const many = button('🎲 ×20 semanas', () => { s.queue = 19; startWeek(); }, { width: 0.18, color: '#7c3aed' });
    const chanceButton = button('chance 10%', () => setChance(CHANCES[(CHANCES.indexOf(s.p) + 1) % CHANCES.length]), { width: 0.16, color: '#475569' });
    const zero = button('↺ Zerar', reset, { width: 0.12, color: '#475569' });
    [[one, -0.36], [many, -0.15], [chanceButton, 0.03], [zero, 0.18]].forEach(([b, x]) => {
      b.position.set(x, -0.43, 0.36);
      b.rotation.x = -0.5;
      group.add(b);
    });

    return {
      group,
      update(dt) {
        if (!s.pending) return;
        s.reveal -= dt * (s.queue ? 3 : 1);
        if (s.reveal > 0) return;
        finishWeek();
        if (s.queue > 0) { s.queue--; startWeek(); }
      },
      control(name, value) {
        if (name === 'sortear') { s.queue = Math.max(0, (Number(value) || 1) - 1); startWeek(); }
        else if (name === 'chance' && CHANCES.includes(Number(value))) setChance(Number(value));
        else if (name === 'zerar') reset();
        else return false;
        return true;
      },
      snapshot: () => ({ chance: s.p, semanas: s.weeks.length, ultima: s.weeks[s.weeks.length - 1] ?? null, kara_divergiu: s.karaCount }),
    };
  },
};
