// Gêmeo digital do rolo de selagem: o próprio rolo vira o gráfico.
//
//   borracha do rolo  = confiabilidade Weibull R(t)   (INFERIDA pela idade)
//   faixa de contato  = força medida nos lados A e B  (MEDIDA no teste de qualidade)
//   produto saindo    = histórico das leituras, com o limite mínimo como um "teto de vidro"
//   neurônio ao lado  = a fórmula de risco, com as mesmas cores das outras lições
import * as THREE from 'three';
import { DEFAULT_PARAMS, LEVEL_COLORS, evaluate, media, syntheticCycle, weibullCdf } from '../twin.js';
import { COLORS, button, canvasPlane, label, placeCylinder, roundRect, viridis } from '../ui.js';

const DAY = 24;
const ROLL_LEN = 0.46;
const CORE_R = 0.055, COAT_MIN = 0.012, COAT_MAX = 0.05;
const ANVIL_R = 0.07;
const NIP = new THREE.Vector3(-0.22, -0.06, -0.12);   // linha de contato entre os rolos
const WEB_OUT = 0.42;                                  // comprimento do produto saindo (m)
const HISTORY_DAYS = 12;                               // quantos dias cabem no produto
const F_MIN = 500, F_MAX = 1400, TRACE_H = 0.22;
const SPEEDS = [0.5, 1, 2, 4];                         // dias de processo por segundo
const forceT = f => (f - 600) / (1300 - 600);          // força → cor (roxo = baixa, amarelo = alta)
const traceY = f => ((f - F_MIN) / (F_MAX - F_MIN)) * TRACE_H;

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = 'rgba(0,0,0,0.28)';
  for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 6, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function drawPanel(g, W, H, s) {
  const e = s.eval, p = s.params;
  roundRect(g, 0, 0, W, H, 26, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.ink;
  g.font = '700 34px system-ui, sans-serif';
  g.fillText('risco = idade + (1 − idade) × sinal × ' + p.boost, 26, 50);
  const row = (y, tag, tagColor, text, value) => {
    roundRect(g, 26, y - 30, 130, 40, 10, tagColor);
    g.fillStyle = '#0b0f19'; g.font = '700 22px system-ui, sans-serif';
    g.fillText(tag, 38, y - 3);
    g.fillStyle = COLORS.ink; g.font = '500 26px system-ui, sans-serif';
    g.fillText(text, 172, y - 3);
    g.textAlign = 'right'; g.font = '700 30px ui-monospace, monospace';
    g.fillText(value, W - 26, y - 3);
    g.textAlign = 'left';
  };
  row(110, 'INFERIDO', '#94a3b8', `idade ${e.ageDays.toFixed(1)} d → falha pela Weibull`, `${Math.round(e.ageRisk * 100)}%`);
  row(160, 'MEDIDO', '#d7ef4b', `força: queda ${(e.degSignal * 100).toFixed(0)}% · inclinação ${e.slopeMin.toFixed(0)}/d → sinal`, e.signal.toFixed(2));
  row(210, 'MODELO', '#ffffff', 'probabilidade de o rolo precisar de troca', `${Math.round(e.pRisk * 100)}%`);

  // curva de confiabilidade R(t) com "você está aqui"
  const left = 60, right = W - 30, top = 250, bottom = H - 46;
  const maxD = p.etaDays * 1.6;
  const px = d => left + (d / maxD) * (right - left), py = r => bottom - r * (bottom - top);
  g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(left, top); g.lineTo(left, bottom); g.lineTo(right, bottom); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.beginPath();
  for (let k = 0; k <= 80; k++) {
    const d = (k / 80) * maxD, r = 1 - weibullCdf(d, p);
    if (k) g.lineTo(px(d), py(r)); else g.moveTo(px(d), py(r));
  }
  g.stroke();
  g.setLineDash([6, 6]); g.strokeStyle = COLORS.muted;
  g.beginPath(); g.moveTo(px(p.etaDays), top); g.lineTo(px(p.etaDays), bottom); g.stroke();
  g.setLineDash([]);
  g.fillStyle = viridis(e.reliability).getStyle(THREE.SRGBColorSpace);
  g.beginPath(); g.arc(px(Math.min(e.ageDays, maxD)), py(e.reliability), 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = COLORS.muted; g.font = '500 22px system-ui, sans-serif';
  g.fillText('confiabilidade R(t) = espessura da borracha', left + 10, top + 24);
  g.fillText(`η = ${p.etaDays} d`, px(p.etaDays) + 8, bottom - 10);
  g.fillText(`vida restante mediana ≈ ${e.remainingDaysP50.toFixed(1)} d`, left + 10, bottom + 34);
}

export default {
  id: 'rolo',
  title: 'Gêmeo do rolo',

  create(ctx) {
    const group = new THREE.Group();
    const s = {
      params: { ...DEFAULT_PARAMS }, readings: syntheticCycle(), t: 2 * DAY, playing: true,
      speedIndex: 1, live: false, liveInfo: '', eval: null, level: null,
    };
    let dirty = true, panelTimer = 0, poll = 0;
    const endT = () => (s.readings.length ? s.readings[s.readings.length - 1].t : 0);

    // ---------- máquina: rolo de selagem + contra-rolo ----------
    const machine = new THREE.Group();
    machine.rotation.y = -0.6; // o produto sai na diagonal, para o histórico ficar à vista
    machine.position.set(0.05, 0, -0.05);
    group.add(machine);
    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.7, roughness: 0.35 });
    const anvil = new THREE.Mesh(new THREE.CylinderGeometry(ANVIL_R, ANVIL_R, ROLL_LEN, 48), steel);
    anvil.rotation.z = Math.PI / 2;
    anvil.position.copy(NIP).add(new THREE.Vector3(0, -ANVIL_R, 0));
    machine.add(anvil);

    const roll = new THREE.Group();      // sobe/desce mantendo contato no nip
    machine.add(roll);
    const spinner = new THREE.Group();
    spinner.rotation.z = Math.PI / 2;
    roll.add(spinner);
    spinner.add(new THREE.Mesh(new THREE.CylinderGeometry(CORE_R, CORE_R, ROLL_LEN + 0.08, 32), steel));
    const coatMaterial = new THREE.MeshStandardMaterial({ map: stripeTexture(), roughness: 0.9 });
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, ROLL_LEN, 64), coatMaterial);
    spinner.add(coat);
    // mancais (lado A à esquerda, lado B à direita)
    [-1, 1].forEach(side => {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.34, 0.12), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
      block.position.set(NIP.x + side * (ROLL_LEN / 2 + 0.06), NIP.y + 0.02, NIP.z);
      machine.add(block);
      const t = label(side < 0 ? 'lado A' : 'lado B', { width: 0.1, height: 0.035 });
      t.position.set(NIP.x + side * (ROLL_LEN / 2 + 0.06), NIP.y + 0.12, NIP.z + 0.065);
      machine.add(t);
    });
    // faixa de contato: metade A e metade B, cor = última força medida de cada lado
    const contact = [-1, 1].map(side => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(ROLL_LEN / 2 - 0.004, 0.008, 0.03),
        new THREE.MeshStandardMaterial({ emissiveIntensity: 0.9, roughness: 0.5 }));
      m.position.set(NIP.x + side * ROLL_LEN / 4, NIP.y, NIP.z);
      machine.add(m);
      return m;
    });

    // ---------- produto (manta) passando pelo nip e saindo com o histórico ----------
    const webTexture = stripeTexture();
    webTexture.rotation = Math.PI / 2;
    webTexture.repeat.set(1, 8);
    const web = new THREE.Mesh(new THREE.PlaneGeometry(ROLL_LEN - 0.04, WEB_OUT + 0.4),
      new THREE.MeshStandardMaterial({ map: webTexture, color: 0xe2e8f0, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    web.rotation.x = -Math.PI / 2;
    web.position.set(NIP.x, NIP.y - 0.002, NIP.z + (WEB_OUT - 0.4) / 2);
    machine.add(web);

    const limitY = traceY(s.params.forceLimit);
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROLL_LEN - 0.04, WEB_OUT),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
    ceiling.rotation.x = -Math.PI / 2;
    ceiling.position.set(NIP.x, NIP.y + limitY, NIP.z + WEB_OUT / 2 + 0.02);
    machine.add(ceiling);
    const ceilingLabel = label(`limite ${s.params.forceLimit} ${s.params.unit}`, { width: 0.16, height: 0.032, color: '#fca5a5' });
    ceilingLabel.position.set(NIP.x + ROLL_LEN / 2 + 0.02, NIP.y + limitY + 0.02, NIP.z + WEB_OUT);
    machine.add(ceilingLabel);
    const historyLabel = label(`← agora · ${HISTORY_DAYS} dias de testes de qualidade · mais antigo →`, { width: 0.44, height: 0.03, color: COLORS.muted });
    historyLabel.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    historyLabel.position.set(NIP.x - ROLL_LEN / 2 - 0.0, NIP.y + 0.004, NIP.z + WEB_OUT / 2 + 0.03);
    machine.add(historyLabel);

    const dotGeometry = new THREE.SphereGeometry(0.0065, 12, 8);
    const dots = { a: [], b: [] };
    const meanLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff }));
    machine.add(meanLine);
    const stems = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    machine.add(stems);
    const ensureDots = n => {
      ['a', 'b'].forEach(side => {
        while (dots[side].length < n) {
          const m = new THREE.Mesh(dotGeometry, new THREE.MeshStandardMaterial({ roughness: 0.4 }));
          machine.add(m);
          dots[side].push(m);
        }
      });
    };

    // ---------- andon + motivo ----------
    const andon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), new THREE.MeshStandardMaterial({ emissiveIntensity: 1.2 }));
    andon.position.set(NIP.x + ROLL_LEN / 2 + 0.06, NIP.y + 0.22, NIP.z);
    machine.add(andon);
    const banner = canvasPlane(0.62, 0.1, (g, W, H) => {
      if (!s.eval) return;
      const color = LEVEL_COLORS[s.eval.level];
      roundRect(g, 0, 0, W, H, 24, COLORS.panel);
      roundRect(g, 14, 14, 330, H - 28, 18, color);
      g.fillStyle = '#0b0f19'; g.font = '800 44px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.eval.level.replace('_', ' '), 179, H / 2 + 2);
      g.textAlign = 'left'; g.fillStyle = COLORS.ink; g.font = '600 28px system-ui, sans-serif';
      g.fillText(`Dia ${s.eval.ageDays.toFixed(1)} do rolo${s.live ? ' · AO VIVO' : ' · replay'}`, 366, 50);
      g.font = '500 23px system-ui, sans-serif'; g.fillStyle = COLORS.muted;
      const lines = [''];
      for (const word of s.eval.why.split(' ')) {
        const next = `${lines[lines.length - 1]} ${word}`.trim();
        if (g.measureText(next).width > W - 390 && lines[lines.length - 1]) lines.push(word);
        else lines[lines.length - 1] = next;
      }
      lines.slice(0, 2).forEach((line, k) => g.fillText(line, 366, 96 + k * 30));
    });
    banner.position.set(NIP.x, 0.235, NIP.z + 0.02);
    group.add(banner);

    // ---------- o neurônio da fórmula ----------
    const brain = new THREE.Group();
    brain.position.set(0.45, 0.19, -0.05);
    brain.rotation.y = -0.3;
    group.add(brain);
    const node = (x, y, text) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 16), new THREE.MeshStandardMaterial({ roughness: 0.4 }));
      m.position.set(x, y, 0);
      const t = label(text, { width: 0.2, height: 0.06, size: 0.5 });
      t.position.set(x, y - 0.055, 0.01);
      brain.add(m, t);
      return { m, t, base: text };
    };
    const nodes = {
      deg: node(-0.2, 0.1, 'queda 3d/14d'),
      slope: node(-0.2, -0.01, 'inclinação'),
      age: node(-0.2, -0.12, 'idade (Weibull)'),
      signal: node(0.0, 0.05, 'sinal'),
      risk: node(0.2, -0.04, 'risco'),
    };
    const p0 = s.params;
    [[nodes.deg, nodes.signal, p0.weightDeg], [nodes.slope, nodes.signal, p0.weightSlope],
      [nodes.signal, nodes.risk, p0.boost], [nodes.age, nodes.risk, 1]].forEach(([from, to, w]) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), new THREE.MeshStandardMaterial({ color: COLORS.positive }));
      placeCylinder(c, from.m.position, to.m.position, 0.002 + 0.006 * w);
      brain.add(c);
      const wl = label(`× ${w}`, { width: 0.07, height: 0.028, color: COLORS.muted });
      wl.position.copy(from.m.position).lerp(to.m.position, 0.5).add(new THREE.Vector3(0, 0.02, 0.01));
      brain.add(wl);
    });

    const panel = canvasPlane(0.56, 0.4, (g, W, H) => s.eval && drawPanel(g, W, H, s));
    panel.position.set(0.47, -0.2, 0.0);
    panel.rotation.y = -0.3;
    group.add(panel);

    const hint = label([
      'Arraste a linha do tempo e veja o rolo envelhecer: a borracha é a vida inferida (Weibull),',
      'as bolinhas no produto são os testes de qualidade (A e B). A fórmula ao lado é um neurônio.',
    ], { width: 1.3, height: 0.075, size: 0.62, background: COLORS.panel });
    hint.position.set(0, 0.345, -0.2);
    group.add(hint);

    // ---------- linha do tempo (pegável) ----------
    const timeline = new THREE.Group();
    timeline.position.set(-0.2, -0.38, 0.12);
    group.add(timeline);
    const TRACK = 0.8;
    const track = new THREE.Mesh(new THREE.BoxGeometry(TRACK, 0.012, 0.02), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 }));
    timeline.add(track, knob);
    const knobLabel = label('', { width: 0.12, height: 0.032 });
    timeline.add(knobLabel);
    const plane = new THREE.Plane(), hitPoint = new THREE.Vector3();
    const scrub = pointer => {
      timeline.updateMatrixWorld();
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(timeline.matrixWorld);
      plane.setFromNormalAndCoplanarPoint(normal, timeline.getWorldPosition(new THREE.Vector3()));
      if (!pointer.raycaster.ray.intersectPlane(plane, hitPoint)) return;
      const x = timeline.worldToLocal(hitPoint).x;
      setTime(Math.min(Math.max(x / TRACK + 0.5, 0), 1) * endT());
    };
    const grab = {
      onGrab: (hit, pointer) => { s.held = true; setPlaying(false); setLive(false); scrub(pointer); },
      onDrag: scrub,
      onRelease: () => { s.held = false; ctx.emit('tempo_escolhido', snapshot()); },
      onHover: on => knob.scale.setScalar(on ? 1.3 : 1),
    };
    track.userData.interactive = grab;
    knob.userData.interactive = grab;

    const playButton = button('⏸ Pausar', () => setPlaying(!s.playing), { width: 0.16 });
    const speedButton = button('1 dia/s', () => {
      s.speedIndex = (s.speedIndex + 1) % SPEEDS.length;
      speedButton.set({ text: `${SPEEDS[s.speedIndex]} dia/s` });
    }, { width: 0.16, color: '#475569' });
    const swapButton = button('↺ Rolo novo', () => { setLive(false); setTime(0); setPlaying(true); ctx.emit('troca_simulada', {}); }, { width: 0.16, color: '#475569' });
    const liveButton = button('📡 Ao vivo', () => setLive(!s.live), { width: 0.16, color: '#7c3aed' });
    [playButton, speedButton, swapButton, liveButton].forEach((b, k) => {
      b.position.set(-0.27 + k * 0.18, -0.055, 0);
      timeline.add(b);
    });

    // ---------- estado ----------
    const setTime = t => { s.t = Math.min(Math.max(t, 0), endT()); dirty = true; };
    const setPlaying = on => { s.playing = on; playButton.set({ text: on ? '⏸ Pausar' : '▶ Rodar' }); };
    const setLive = on => {
      if (on === s.live) return;
      s.live = on;
      liveButton.set({ active: on });
      if (!on) { s.readings = syntheticCycle(); s.liveInfo = ''; }
      poll = 99;
      dirty = true;
    };
    async function fetchLive() {
      try {
        const r = await fetch('/api/twin/readings', { cache: 'no-store' });
        const data = await r.json();
        if (!s.live) return;
        if (!data.readings?.length) { s.liveInfo = 'sem leituras: envie POST /api/twin/readings'; return; }
        const start = Date.parse(data.troca || data.readings[0].ts);
        s.readings = data.readings
          .map(x => ({ t: (Date.parse(x.ts) - start) / 3.6e6, a: x.forca_a, b: x.forca_b }))
          .filter(x => x.t >= 0)
          .sort((x, y) => x.t - y.t);
        s.t = endT();
        dirty = true;
      } catch (e) { s.liveInfo = 'servidor indisponível'; }
    }

    const snapshot = () => {
      const e = s.eval;
      return e && {
        modo: s.live ? 'ao_vivo' : 'replay_sintetico', idade_dias: +e.ageDays.toFixed(2), nivel: e.level, motivo: e.why,
        confiabilidade_weibull: +e.reliability.toFixed(3), risco: +e.pRisk.toFixed(3), sinal: +e.signal.toFixed(3),
        forca_media_3d: +(e.mean3d || 0).toFixed(1), forca_min_3d: +(e.min3d || 0).toFixed(1),
        inclinacao_7d: +e.slope.toFixed(2), projecao_48h: +(e.proj48h || 0).toFixed(1),
        vida_restante_p50_dias: +e.remainingDaysP50.toFixed(1), leituras: e.readings,
        forca_a: e.lastA, forca_b: e.lastB, unidade: s.params.unit,
      };
    };

    const color = new THREE.Color();
    const render = () => {
      const e = s.eval = evaluate(s.readings, s.t, s.params);
      if (e.level !== s.level) {
        if (s.level) ctx.emit('nivel_mudou', { de: s.level, para: e.level, idade_dias: +e.ageDays.toFixed(2), motivo: e.why });
        s.level = e.level;
      }
      // borracha = confiabilidade inferida
      const outer = CORE_R + COAT_MIN + (COAT_MAX - COAT_MIN) * e.reliability;
      coat.scale.set(outer, 1, outer);
      coatMaterial.color.copy(viridis(e.reliability, color));
      roll.position.copy(NIP).add(new THREE.Vector3(0, outer, 0));
      // contato = última força medida em A e B
      [e.lastA, e.lastB].forEach((f, k) => {
        const c = Number.isFinite(f) ? viridis(forceT(f), color) : color.set(0x333844);
        contact[k].material.color.copy(c);
        contact[k].material.emissive.copy(c).multiplyScalar(0.6);
      });
      // histórico no produto: mais novo junto ao nip, mais antigo perto de você
      const visible = s.readings.filter(r => r.t <= s.t && s.t - r.t <= HISTORY_DAYS * DAY);
      ensureDots(visible.length);
      const meanPts = [], stemPts = [];
      ['a', 'b'].forEach(side => dots[side].forEach(d => { d.visible = false; }));
      visible.forEach((r, i) => {
        const z = NIP.z + 0.03 + ((s.t - r.t) / (HISTORY_DAYS * DAY)) * WEB_OUT;
        [['a', -1], ['b', 1]].forEach(([side, sx]) => {
          const d = dots[side][i];
          const f = r[side];
          d.visible = true;
          d.position.set(NIP.x + sx * 0.1, NIP.y + traceY(f), z);
          d.material.color.copy(viridis(forceT(f), color));
          d.material.emissive.copy(color).multiplyScalar(f < s.params.forceLimit ? 0.8 : 0.15);
          stemPts.push(new THREE.Vector3(d.position.x, NIP.y, z), d.position.clone());
        });
        meanPts.push(new THREE.Vector3(NIP.x, NIP.y + traceY(media(r)), z));
      });
      meanLine.geometry.dispose();
      meanLine.geometry = new THREE.BufferGeometry().setFromPoints(meanPts);
      stems.geometry.dispose();
      stems.geometry = new THREE.BufferGeometry().setFromPoints(stemPts);
      // andon
      andon.material.color.set(LEVEL_COLORS[e.level]);
      andon.material.emissive.set(LEVEL_COLORS[e.level]);
      // neurônio
      [['deg', e.degSignal], ['slope', e.slopeDanger], ['age', e.ageRisk], ['signal', e.signal], ['risk', e.pRisk]].forEach(([k, v]) => {
        nodes[k].m.material.color.copy(viridis(v, color));
        nodes[k].m.material.emissive.copy(color).multiplyScalar(0.35);
        nodes[k].t.setText([nodes[k].base, v.toFixed(2)]);
      });
      // linha do tempo
      const f = endT() ? s.t / endT() : 0;
      knob.position.set((f - 0.5) * TRACK, 0, 0);
      knobLabel.position.set(knob.position.x, 0.04, 0);
      knobLabel.setText(`dia ${(s.t / DAY).toFixed(1)}`);
      banner.redraw();
    };

    setTime(s.t);
    return {
      group,
      update(dt) {
        if (s.playing && !s.held && !s.live) {
          const next = s.t + dt * SPEEDS[s.speedIndex] * DAY;
          if (next >= endT()) { setTime(endT()); setPlaying(false); } else setTime(next);
        }
        if (s.live && (poll += dt) > 3) { poll = 0; fetchLive(); }
        if (s.playing || s.live) {
          spinner.rotation.y -= dt * 2.5;
          webTexture.offset.y -= dt * 0.4;
        }
        panelTimer += dt;
        if (dirty && panelTimer > 1 / 10) {
          render();
          panel.redraw();
          dirty = false;
          panelTimer = 0;
        }
      },
      control(name, value) {
        if (name === 'play') setPlaying(true);
        else if (name === 'pause') setPlaying(false);
        else if (name === 'time') { setLive(false); setPlaying(false); setTime(Number(value) * DAY); }
        else if (name === 'speed' && SPEEDS.includes(Number(value))) { s.speedIndex = SPEEDS.indexOf(Number(value)); speedButton.set({ text: `${value} dia/s` }); }
        else if (name === 'live') setLive(value !== false && value !== 'false');
        else if (name === 'swap') { setLive(false); setTime(0); setPlaying(true); }
        else return false;
        return true;
      },
      snapshot,
    };
  },
};
