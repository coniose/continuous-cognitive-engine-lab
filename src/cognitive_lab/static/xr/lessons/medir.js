// Capítulo 3: medir. Um androide só, escaneado ~3x por dia. Cada bolinha é um
// scan de estabilidade: fileira A = autodiagnóstico do próprio androide,
// fileira B = scan do Connor (o investigador). A placa vermelha é o muro:
// abaixo dela, o androide está rompendo a programação.
// É a parte MEDIDA do modelo. No rolo: as bolinhas no produto e o teto de vidro.
import * as THREE from 'three';
import { makeAndroid } from '../android.js';
import { ANDROID_PARAMS, CHARACTERS, evaluateAndroid, levelLed, scans } from '../deviancy.js';
import { COLORS, button, canvasPlane, label, roundRect, slider, viridis, wrapLines } from '../ui.js';

const DAY = 24;
const X0 = -0.3, X1 = 0.28;          // eixo dos dias
const BASE_Y = -0.36, CHART_H = 0.3; // 0% a 100% de estabilidade
const ROW_Z = { a: -0.045, b: 0.045 };
const DAYS_PER_SECOND = 1.5;
const yOf = v => BASE_Y + (v / 100) * CHART_H;
const pct = x => `${Math.round(x * 100)}%`;
const comma = (x, d = 1) => x.toFixed(d).replace('.', ',');

function drawPanel(g, W, H, s) {
  const e = s.eval;
  const c = CHARACTERS[s.who];
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 34px system-ui, sans-serif';
  g.fillText(`${c.name} · dia ${comma(s.t / DAY)}`, 26, 52);
  roundRect(g, W - 236, 18, 210, 46, 12, levelLed(e.level));
  g.fillStyle = '#0b0f19'; g.font = '800 26px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText(e.level.replace('_', ' '), W - 131, 50);
  g.textAlign = 'left';
  g.fillStyle = COLORS.muted; g.font = '500 23px system-ui, sans-serif';
  g.fillText(c.who, 26, 86);

  const row = (y, tag, tagColor, text, value) => {
    roundRect(g, 26, y - 30, 124, 40, 10, tagColor);
    g.fillStyle = '#0b0f19'; g.font = '700 21px system-ui, sans-serif';
    g.fillText(tag, 36, y - 3);
    g.fillStyle = COLORS.ink; g.font = '500 24px system-ui, sans-serif';
    g.fillText(text, 162, y - 3);
    g.textAlign = 'right'; g.font = '700 28px ui-monospace, monospace';
    g.fillText(value, W - 26, y - 3);
    g.textAlign = 'left';
  };
  const n = x => (Number.isFinite(x) ? x.toFixed(0) : '–');
  row(146, 'INFERIDO', '#94a3b8', 'pela idade (curva do cap. 2)', pct(e.ageRisk));
  row(198, 'MEDIDO', '#d7ef4b', `média 3 dias ${n(e.mean3d)}% · mínimo ${n(e.min3d)}%`, '');
  row(250, 'MEDIDO', '#d7ef4b', `queda 3d/14d ${n(e.degSignal * 100)}% · ${comma(e.slopeMin)}/dia`, comma(e.signal, 2));
  row(302, 'MODELO', '#ffffff', 'risco juntando os dois (cap. 4)', pct(e.pRisk));
  g.fillStyle = COLORS.muted; g.font = '500 24px system-ui, sans-serif';
  const why = wrapLines(g, e.why, W - 52).slice(0, 3);
  why.forEach((line, k) => g.fillText(line, 26, 356 + k * 32));
  if (Number.isFinite(e.deltaAB) && e.deltaAB > 8) {
    g.fillStyle = '#fca5a5';
    g.fillText(`A e B discordam em ${e.deltaAB.toFixed(0)} pontos: o autodiagnóstico esconde algo.`, 26, 356 + why.length * 32 + 14);
  }
}

export default {
  id: 'medir',
  title: 'Medir',
  steps: [
    { text: 'Capítulo 3, medir. O Connor é um androide investigador: ele escaneia outros androides e mede a estabilidade do software, de zero a cem por cento.', control: [['personagem', 'kara'], ['tempo', 0]] },
    { text: 'Cada bolinha é um scan. A fileira A é o autodiagnóstico da própria Kara; a fileira B é o scan do Connor. A placa vermelha é o muro: abaixo de quarenta por cento, ela está rompendo a programação.' },
    { text: 'Aperte rodar. A Kara tem poucos dias de vida: pela idade, o capítulo dois diria risco baixo. Mas as bolinhas descem até o muro. O MEDIDO pega o que o INFERIDO não vê.', control: ['play'] },
    { text: 'Repare que o autodiagnóstico da Kara fica acima do scan do Connor. Quando as duas fileiras se afastam, ela está dizendo que está melhor do que realmente está.' },
    { text: 'Agora troque para o Markus. Ele é mais velho, então a idade sozinha já acende o amarelo. Mas os scans ficam firmes por quase duas semanas, até despencar de uma vez.', control: [['personagem', 'markus'], ['play']] },
    { text: 'A lição: a idade dá a chance de base, os scans contam o que está acontecendo agora. Precisamos dos dois. No próximo capítulo, um neurônio junta tudo num número só.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const s = { who: 'kara', readings: [], t: 0, playing: false, eval: null, level: null };
    const endT = () => CHARACTERS[s.who].days * DAY;

    const android = makeAndroid({ height: 0.42, suit: 0x64748b });
    android.position.set(-0.52, -0.44, 0.02);
    group.add(android);
    const nameTag = label('', { width: 0.16, height: 0.04 });
    nameTag.position.set(-0.52, 0.03, 0.02);
    group.add(nameTag);

    // gráfico 3D: chão, muro, eixos
    const floor = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 0.06, 0.008, 0.16), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
    floor.position.set((X0 + X1) / 2, BASE_Y - 0.004, 0);
    group.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 + 0.06, 0.16),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    wall.rotation.x = -Math.PI / 2;
    wall.position.set((X0 + X1) / 2, yOf(ANDROID_PARAMS.forceLimit), 0);
    group.add(wall);
    const wallTag = label(`muro vermelho: ${ANDROID_PARAMS.forceLimit}%`, { width: 0.2, height: 0.032, color: '#fca5a5' });
    wallTag.position.set(X1 + 0.07, yOf(ANDROID_PARAMS.forceLimit) + 0.02, 0.06);
    group.add(wallTag);
    [['a', 'A · autodiagnóstico'], ['b', 'B · scan do Connor']].forEach(([side, text]) => {
      const t = label(text, { width: 0.2, height: 0.03, color: COLORS.muted, align: 'right' });
      t.position.set(X0 - 0.11, BASE_Y + 0.02, ROW_Z[side]);
      group.add(t);
    });
    const yTag = label('estabilidade ↑', { width: 0.16, height: 0.03, color: COLORS.muted });
    yTag.position.set(X0 + 0.02, BASE_Y + CHART_H + 0.03, -0.08);
    group.add(yTag);
    const cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.003, CHART_H), new THREE.MeshBasicMaterial({ color: COLORS.accent, side: THREE.DoubleSide }));
    group.add(cursor);
    const dayTags = [];

    const dotGeometry = new THREE.SphereGeometry(0.0075, 12, 8);
    let dots = [];
    const meanLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
    const stems = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    group.add(meanLine, stems);

    const panel = canvasPlane(0.5, 0.32, (g, W, H) => s.eval && drawPanel(g, W, H, s));
    panel.position.set(0.6, -0.04, -0.04);
    panel.rotation.y = -0.45;
    group.add(panel);

    let dirty = true;
    const xOf = t => X0 + (t / endT()) * (X1 - X0);
    const setTime = t => { s.t = Math.min(Math.max(t, 0), endT()); timeline.set(s.t / endT()); dirty = true; };
    const setPlaying = on => { s.playing = on; play.set({ text: on ? '⏸ Pausar' : '▶ Rodar' }); };
    const setWho = who => {
      s.who = who;
      s.readings = scans(who);
      s.level = null;
      dots.forEach(d => group.remove(d.mesh));
      dots = s.readings.flatMap(r => ['a', 'b'].map(side => {
        const mesh = new THREE.Mesh(dotGeometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }));
        mesh.position.set(xOf(r.t), yOf(r[side]), ROW_Z[side]);
        const c = viridis(r[side] / 100);
        mesh.material.color.copy(c);
        mesh.material.emissive.copy(c).multiplyScalar(r[side] < ANDROID_PARAMS.forceLimit ? 0.9 : 0.15);
        group.add(mesh);
        return { mesh, t: r.t };
      }));
      dayTags.forEach(t => group.remove(t));
      dayTags.length = 0;
      for (let d = 0; d <= CHARACTERS[who].days; d += who === 'kara' ? 3 : 6) {
        const t = label(`${d} d`, { width: 0.06, height: 0.026, color: COLORS.muted });
        t.position.set(xOf(d * DAY), BASE_Y - 0.025, 0.1);
        group.add(t);
        dayTags.push(t);
      }
      nameTag.setText(CHARACTERS[who].name);
      whoButtons.forEach(([b, id]) => b.set({ active: id === who }));
      setTime(0);
      ctx.refreshInteractive();
    };

    const timeline = slider({
      length: X1 - X0,
      onGrab: () => setPlaying(false),
      onChange: f => { s.t = f * endT(); dirty = true; },
      onRelease: () => ctx.emit('tempo_escolhido', { personagem: s.who, dia: +(s.t / DAY).toFixed(1) }),
    });
    timeline.position.set((X0 + X1) / 2, -0.44, 0.3);
    timeline.rotation.x = -0.5;
    group.add(timeline);
    const play = button('▶ Rodar', () => { if (s.t >= endT()) setTime(0); setPlaying(!s.playing); }, { width: 0.14 });
    const whoButtons = [['kara', 'Kara'], ['markus', 'Markus']].map(([id, text]) => [button(text, () => { setPlaying(false); setWho(id); }, { width: 0.13, color: '#475569' }), id]);
    [[play, -0.3], [whoButtons[0][0], -0.14], [whoButtons[1][0], 0.0]].forEach(([b, x]) => {
      b.position.set(x, -0.52, 0.36);
      b.rotation.x = -0.5;
      group.add(b);
    });
    setWho('kara');

    const render = () => {
      const e = s.eval = evaluateAndroid(s.readings, Math.max(s.t, 1));
      if (e.level !== s.level) {
        if (s.level) ctx.emit('nivel_mudou', { personagem: s.who, de: s.level, para: e.level, dia: +(s.t / DAY).toFixed(1), motivo: e.why });
        s.level = e.level;
      }
      android.setLed(levelLed(e.level), { fast: e.level === 'RISCO' || e.level === 'CONFIRMADO' });
      dots.forEach(d => { d.mesh.visible = d.t <= s.t; });
      const seen = s.readings.filter(r => r.t <= s.t);
      meanLine.geometry.dispose();
      meanLine.geometry = new THREE.BufferGeometry().setFromPoints(seen.map(r => new THREE.Vector3(xOf(r.t), yOf((r.a + r.b) / 2), 0)));
      stems.geometry.dispose();
      stems.geometry = new THREE.BufferGeometry().setFromPoints(seen.flatMap(r => ['a', 'b'].flatMap(side => [
        new THREE.Vector3(xOf(r.t), BASE_Y, ROW_Z[side]), new THREE.Vector3(xOf(r.t), yOf(r[side]), ROW_Z[side]),
      ])));
      cursor.position.set(xOf(s.t), BASE_Y + CHART_H / 2, -0.09);
      panel.redraw();
    };

    return {
      group,
      update(dt) {
        android.update(dt);
        if (s.playing) {
          const next = s.t + dt * DAYS_PER_SECOND * DAY;
          if (next >= endT()) { setTime(endT()); setPlaying(false); } else setTime(next);
        }
        if (dirty) { dirty = false; render(); }
      },
      control(name, value) {
        if (name === 'personagem' && CHARACTERS[value]) { setPlaying(false); setWho(value); }
        else if (name === 'tempo') { setPlaying(false); setTime((Number(value) || 0) * DAY); }
        else if (name === 'play') { if (s.t >= endT()) setTime(0); setPlaying(true); }
        else if (name === 'pause') setPlaying(false);
        else return false;
        return true;
      },
      snapshot: () => {
        const e = s.eval;
        return e && {
          personagem: s.who, dia: +(s.t / DAY).toFixed(2), nivel: e.level, motivo: e.why,
          risco_idade: +e.ageRisk.toFixed(3), sinal: +e.signal.toFixed(3), risco: +e.pRisk.toFixed(3),
          media_3d: +(e.mean3d || 0).toFixed(1), minimo_3d: +(e.min3d || 0).toFixed(1),
        };
      },
    };
  },
};
