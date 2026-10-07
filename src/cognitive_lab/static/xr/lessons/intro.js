// Introdução da trilha: apresenta o problema (qual a chance de um androide
// divergir?), a Kara em 3D para escanear e o mapa dos capítulos até o rolo.
import * as THREE from 'three';
import { makeAndroid } from '../android.js';
import { LED, evaluateAndroid, scans } from '../deviancy.js';
import { COLORS, canvasPlane, roundRect, wrapLines } from '../ui.js';

const MAP = [
  ['1', 'Contar', 'probabilidade é contar em muitos androides'],
  ['2', 'O tempo', 'quanto mais dias ativo, mais chance (Weibull)'],
  ['3', 'Medir', 'o scan de estabilidade vê o que a idade não vê'],
  ['4', 'O neurônio', 'juntar idade + scans num número só'],
  ['5', 'O rolo', 'a mesma conta numa máquina de verdade'],
  ['6', 'Aprender', 'a máquina descobre os pesos sozinha'],
  ['7', 'Camadas', 'quando uma conta simples não basta'],
];
const SCAN_SECONDS = 1.6;
const KARA_DAY = 9;

function drawMap(g, W, H) {
  roundRect(g, 0, 0, W, H, 28, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.accent;
  g.font = '700 40px system-ui, sans-serif';
  g.fillText('A pergunta da trilha', 30, 60);
  g.fillStyle = COLORS.ink;
  g.font = '600 32px system-ui, sans-serif';
  g.fillText('Qual a chance de um androide divergir?', 30, 106);
  MAP.forEach(([n, title, what], k) => {
    const y = 168 + k * 72;
    roundRect(g, 30, y - 40, 56, 56, 14, n === '5' ? '#d7ef4b' : '#334155');
    g.fillStyle = n === '5' ? '#17211b' : '#ffffff';
    g.font = '800 32px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(n, 58, y);
    g.textAlign = 'left';
    g.fillStyle = COLORS.ink;
    g.font = '700 30px system-ui, sans-serif';
    g.fillText(title, 104, y - 8);
    g.fillStyle = COLORS.muted;
    g.font = '500 25px system-ui, sans-serif';
    g.fillText(what, 104, y + 22);
  });
}

function drawScan(g, W, H, s) {
  roundRect(g, 0, 0, W, H, 24, COLORS.panel);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  if (!s.scanned) {
    g.fillStyle = COLORS.muted;
    g.font = '600 30px system-ui, sans-serif';
    wrapLines(g, s.scanning ? 'Escaneando…' : 'Aponte para a Kara e aperte para escanear.', W - 50)
      .forEach((line, k) => g.fillText(line, 26, 54 + k * 40));
    return;
  }
  const e = s.eval;
  g.fillStyle = COLORS.accent;
  g.font = '700 32px system-ui, sans-serif';
  g.fillText('SCAN · Kara', 26, 50);
  const rows = [
    ['Ativa há', `${KARA_DAY} dias`],
    ['Estabilidade (autodiagnóstico)', `${e.lastA.toFixed(0)}%`],
    ['Estabilidade (scan externo)', `${e.lastB.toFixed(0)}%`],
    ['Chance de divergir', '???'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 100 + i * 46;
    g.fillStyle = i === 3 ? COLORS.ink : COLORS.muted;
    g.font = `${i === 3 ? 700 : 500} 27px system-ui, sans-serif`;
    g.fillText(k, 26, y);
    g.textAlign = 'right';
    g.font = '700 30px ui-monospace, monospace';
    g.fillStyle = i === 3 ? COLORS.accent : COLORS.ink;
    g.fillText(v, W - 26, y);
    g.textAlign = 'left';
  });
  g.fillStyle = COLORS.muted;
  g.font = '500 23px system-ui, sans-serif';
  g.fillText('Você calcula esse número no capítulo 4.', 26, H - 22);
}

export default {
  id: 'intro',
  title: 'Introdução',
  steps: [
    { text: 'Bem-vindo. Esta trilha tem sete capítulos e um problema só: androides que podem divergir, ou seja, quebrar a programação e agir por conta própria.' },
    { text: 'Esta é a Kara. O anel na têmpora é o LED: azul é estável, amarelo é aviso, vermelho é divergindo. Aponte para ela e aperte o gatilho, ou faça pinça, para escanear.' },
    { text: 'O scan mostra o que dá para saber: há quantos dias ela está ativa e a estabilidade do software. Mas a pergunta que importa é outra: qual a chance de ela divergir?', control: ['scan'] },
    { text: 'Ninguém sabe a resposta certa para uma androide só. O que dá para fazer é medir chances. Os próximos capítulos constroem essa conta, uma peça por vez. O mapa à direita mostra o caminho.' },
    { text: 'No capítulo cinco, a mesma conta vira o gêmeo digital do rolo de selagem: a idade da borracha, os testes de qualidade e o alarme. Lá você vai reconhecer cada peça. Toque em próximo capítulo para começar.' },
  ],

  create(ctx) {
    const group = new THREE.Group();
    const s = { scanned: false, scanning: false, scanT: 0, eval: evaluateAndroid(scans('kara'), KARA_DAY * 24) };

    const kara = makeAndroid({ height: 0.5, name: 'Kara', suit: 0x64748b });
    kara.position.set(-0.22, -0.44, 0.0);
    group.add(kara);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.02, 40), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 }));
    base.position.set(-0.22, -0.45, 0);
    group.add(base);

    // anel do scanner: sobe dos pés à cabeça
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.004, 8, 48), new THREE.MeshBasicMaterial({ color: COLORS.accent }));
    ring.rotation.x = Math.PI / 2;
    ring.visible = false;
    kara.add(ring);

    // alvo invisível (mas "mostrado", para o raio acertar) em volta da Kara
    const target = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.56, 0.18), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    target.position.set(0, 0.28, 0);
    kara.add(target);
    const scan = () => {
      if (s.scanning) return;
      s.scanning = true;
      s.scanT = 0;
      ring.visible = true;
      kara.setLed(LED.aviso, { fast: true });
      scanPanel.redraw(s);
    };
    target.userData.interactive = {
      onPress: scan,
      onHover: on => kara.scale.setScalar(on ? 1.03 : 1),
    };

    const scanPanel = canvasPlane(0.4, 0.27, (g, W, H) => drawScan(g, W, H, s));
    scanPanel.position.set(0.08, -0.08, 0.02);
    group.add(scanPanel);

    const map = canvasPlane(0.5, 0.42, drawMap);
    map.position.set(0.52, 0.0, -0.02);
    map.rotation.y = -0.4;
    group.add(map);

    return {
      group,
      update(dt) {
        kara.update(dt);
        if (!s.scanning) return;
        s.scanT += dt;
        const f = Math.min(s.scanT / SCAN_SECONDS, 1);
        ring.position.y = 0.5 * (f < 0.5 ? f * 2 : 2 - f * 2) + 0.02;
        if (f >= 1) {
          s.scanning = false;
          s.scanned = true;
          ring.visible = false;
          kara.setLed(LED.estavel);
          scanPanel.redraw(s);
          ctx.emit('kara_escaneada', { dia: KARA_DAY, estabilidade_a: s.eval.lastA, estabilidade_b: s.eval.lastB });
        }
      },
      control(name) {
        if (name === 'scan') scan();
        else return false;
        return true;
      },
      snapshot: () => ({ escaneada: s.scanned }),
    };
  },
};
