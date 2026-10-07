// Capítulo 2: o tempo. Os mesmos cem androides, todos ativados no mesmo dia.
// Cada um tem um "dia do azar" sorteado de uma Weibull; arrastando a linha do
// tempo, eles vão ficando vermelhos e a contagem acompanha a curva R(t).
// É a parte INFERIDA do modelo: só depende da idade. No rolo, é a borracha.
import * as THREE from 'three';
import { makeCrowd } from '../android.js';
import { ANDROID_PARAMS, LED, conditionalRisk, lifetimes, reliability, uniforms } from '../deviancy.js';
import { COLORS, button, canvasPlane, roundRect, slider } from '../ui.js';

const MAX_DAYS = 48;
const DAYS_PER_SECOND = 3;
const BETAS = [0.7, 1, 1.5, 3];
const BETA_NOTE = { 0.7: 'falhas de fábrica: o risco é maior no começo', 1: 'puro acaso: o risco é igual todo dia', 1.5: 'desgaste: o risco acelera com a idade (é o do rolo)', 3: 'desgaste forte: quase todos divergem perto de η' };
const pct = x => `${Math.round(x * 100)}%`;
const comma = x => String(x).replace('.', ',');

function drawPanel(g, W, H, s) {
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  const params = { ...ANDROID_PARAMS, beta: s.beta };
  const alive = s.life.filter(d => d > s.t).length;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 32px system-ui, sans-serif';
  g.fillText(`Dia ${comma(s.t.toFixed(1))} desde a ativação`, 26, 50);
  g.font = '600 27px system-ui, sans-serif';
  g.fillStyle = LED.estavel;
  g.fillText(`${alive} de 100 ainda estáveis (contagem)`, 26, 92);
  g.fillStyle = '#ffffff';
  g.fillText(`R(t) = ${pct(reliability(s.t, params))} (curva Weibull)`, 26, 128);
  g.fillStyle = COLORS.accent;
  g.fillText(`Quem está azul hoje: ${pct(conditionalRisk(s.t, params))} de chance`, 26, 170);
  g.fillText('de divergir nos próximos 7 dias', 26, 204);
  g.fillStyle = COLORS.muted;
  g.font = '500 23px system-ui, sans-serif';
  g.fillText(`β = ${comma(s.beta)}: ${BETA_NOTE[s.beta]}`, 26, 242);

  const left = 60, right = W - 44, top = 270, bottom = H - 52;
  const px = d => left + (d / MAX_DAYS) * (right - left), py = r => bottom - r * (bottom - top);
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(left, top); g.lineTo(left, bottom); g.lineTo(right, bottom); g.stroke();
  // η: 63,2% já divergiram
  g.setLineDash([6, 6]); g.strokeStyle = COLORS.muted;
  g.beginPath(); g.moveTo(px(params.etaDays), top); g.lineTo(px(params.etaDays), bottom); g.stroke();
  g.setLineDash([]);
  // curva teórica
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath();
  for (let k = 0; k <= 96; k++) {
    const d = (k / 96) * MAX_DAYS;
    if (k) g.lineTo(px(d), py(reliability(d, params))); else g.moveTo(px(d), py(1));
  }
  g.stroke();
  // contagem real até hoje (escada)
  g.strokeStyle = LED.estavel; g.lineWidth = 5; g.beginPath();
  for (let k = 0; k <= 200; k++) {
    const d = (k / 200) * MAX_DAYS;
    if (d > s.t) break;
    const r = s.life.filter(x => x > d).length / 100;
    if (k) g.lineTo(px(d), py(r)); else g.moveTo(px(d), py(r));
  }
  g.stroke();
  g.fillStyle = LED.estavel;
  g.beginPath(); g.arc(px(s.t), py(alive / 100), 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = COLORS.muted; g.font = '500 21px system-ui, sans-serif';
  g.fillText('100%', 4, top + 8);
  g.fillText(`η = ${params.etaDays} d (63% já divergiram)`, px(params.etaDays) + 8, top + 22);
  g.textAlign = 'center';
  for (let d = 0; d <= MAX_DAYS; d += 12) g.fillText(`${d} d`, px(d), bottom + 28);
}

export default {
  id: 'tempo',
  title: 'O tempo',
  steps: [
    { text: 'Capítulo 2, o tempo. Os mesmos cem androides, agora todos ativados no mesmo dia. Aperte rodar e veja os dias passarem.', control: ['tempo', 0] },
    { text: 'A curva branca é a confiabilidade, R de t: a fração que ainda está estável em cada dia. A linha azul é a contagem de verdade dos cem. As duas andam juntas.' },
    { text: 'A linha tracejada é eta, a vida característica: vinte e quatro dias. Nesse dia, sessenta e três por cento já divergiram.' },
    { text: 'Beta é o formato do risco. Menor que um: falhas de fábrica, logo no começo. Igual a um: puro acaso. Maior que um: desgaste, o risco acelera com a idade. Experimente os botões de beta.' },
    { text: 'Com beta um e meio e a Kara com nove dias, o painel mostra a chance de ela divergir na próxima semana, sabendo só a idade. Isso se chama INFERIDO: ninguém mediu nada nela.', control: [['beta', 1.5], ['tempo', 9]] },
    { text: 'No rolo, essa curva é a espessura da borracha. Mas idade não é tudo: dois androides com a mesma idade podem estar bem diferentes. Próximo capítulo: medir.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const us = uniforms(100);
    const s = { beta: 1.5, life: [], t: 0, playing: false };

    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.012, 0.66), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
    floor.position.set(-0.12, -0.36, 0.0);
    group.add(floor);
    const crowd = makeCrowd();
    crowd.position.set(-0.12, -0.354, 0.0);
    group.add(crowd);

    const panel = canvasPlane(0.5, 0.46, (g, W, H) => drawPanel(g, W, H, s));
    panel.position.set(0.5, -0.02, -0.02);
    panel.rotation.y = -0.4;
    group.add(panel);

    let dirty = true;
    const setTime = t => { s.t = Math.min(Math.max(t, 0), MAX_DAYS); timeline.set(s.t / MAX_DAYS); dirty = true; };
    const setPlaying = on => { s.playing = on; play.set({ text: on ? '⏸ Pausar' : '▶ Rodar' }); };
    const setBeta = b => {
      s.beta = b;
      s.life = lifetimes(us, { ...ANDROID_PARAMS, beta: b });
      betaButtons.forEach(([bb, v]) => bb.set({ active: v === b }));
      dirty = true;
    };

    const timeline = slider({
      length: 0.62,
      onGrab: () => setPlaying(false),
      onChange: f => { s.t = f * MAX_DAYS; dirty = true; },
      onRelease: () => ctx.emit('tempo_escolhido', { dia: +s.t.toFixed(1), beta: s.beta }),
    });
    timeline.position.set(-0.12, -0.42, 0.36);
    timeline.rotation.x = -0.5;
    group.add(timeline);
    const play = button('▶ Rodar', () => { if (s.t >= MAX_DAYS) setTime(0); setPlaying(!s.playing); }, { width: 0.14 });
    const betaButtons = BETAS.map(b => [button(`β ${comma(b)}`, () => setBeta(b), { width: 0.11, color: '#475569' }), b]);
    [[play, -0.38], ...betaButtons.map(([bb], k) => [bb, -0.22 + k * 0.125])].forEach(([b, x]) => {
      b.position.set(x, -0.5, 0.41);
      b.rotation.x = -0.5;
      group.add(b);
    });
    setBeta(1.5);

    return {
      group,
      update(dt) {
        if (s.playing) {
          const next = s.t + dt * DAYS_PER_SECOND;
          if (next >= MAX_DAYS) { setTime(MAX_DAYS); setPlaying(false); } else setTime(next);
        }
        if (!dirty) return;
        dirty = false;
        s.life.forEach((d, i) => crowd.setLed(i, d <= s.t ? LED.divergiu : LED.estavel));
        crowd.commit();
        panel.redraw();
      },
      control(name, value) {
        if (name === 'tempo') { setPlaying(false); setTime(Number(value) || 0); }
        else if (name === 'beta' && BETAS.includes(Number(value))) setBeta(Number(value));
        else if (name === 'play') setPlaying(true);
        else if (name === 'pause') setPlaying(false);
        else return false;
        return true;
      },
      snapshot: () => ({
        dia: +s.t.toFixed(2), beta: s.beta, estaveis: s.life.filter(d => d > s.t).length,
        confiabilidade: +reliability(s.t, { ...ANDROID_PARAMS, beta: s.beta }).toFixed(3),
      }),
    };
  },
};
