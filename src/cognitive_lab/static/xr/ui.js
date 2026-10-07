// Peças de interface que vivem dentro da cena 3D: painéis de texto e botões
// desenhados num <canvas> e usados como textura. Funcionam iguais no
// navegador do PC e dentro do óculos.
import * as THREE from 'three';

const PX_PER_M = 1600; // resolução do canvas por metro de painel

// Paleta compartilhada pelas lições: roxo = 0, amarelo = 1 (viridis).
const VIRIDIS = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
export function viridis(t, target = new THREE.Color()) {
  const x = Math.min(Math.max(t, 0), 1) * (VIRIDIS.length - 1);
  const i = Math.min(Math.floor(x), VIRIDIS.length - 2);
  const f = x - i;
  const [a, b] = [VIRIDIS[i], VIRIDIS[i + 1]];
  return target.setRGB(
    (a[0] + (b[0] - a[0]) * f) / 255,
    (a[1] + (b[1] - a[1]) * f) / 255,
    (a[2] + (b[2] - a[2]) * f) / 255,
    THREE.SRGBColorSpace,
  );
}
export const viridisCss = t => '#' + viridis(t).getHexString(THREE.SRGBColorSpace);

export const COLORS = {
  positive: '#3b82f6', // peso positivo
  negative: '#f97316', // peso negativo
  ink: '#e8ecf4',
  muted: '#94a3b8',
  panel: 'rgba(15, 20, 32, 0.88)',
  accent: '#d7ef4b',
};

// Plano com um canvas como textura. `draw(g, W, H)` desenha; `redraw()` refaz.
export function canvasPlane(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * PX_PER_M);
  canvas.height = Math.round(height * PX_PER_M);
  const g = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.renderOrder = 2;
  mesh.redraw = (...args) => {
    g.clearRect(0, 0, canvas.width, canvas.height);
    draw(g, canvas.width, canvas.height, ...args);
    texture.needsUpdate = true;
  };
  mesh.redraw();
  return mesh;
}

export function roundRect(g, x, y, w, h, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
}

// Texto simples (rótulos de eixo, títulos). Uma linha por item de `lines`.
export function label(lines, { width = 0.3, height = 0.05, size = 0.6, color = COLORS.ink, align = 'center', background = null, minLines = 1 } = {}) {
  let current = [].concat(lines);
  const mesh = canvasPlane(width, height, (g, W, H) => {
    if (background) roundRect(g, 0, 0, W, H, H * 0.18, background);
    const rows = Math.max(current.length, minLines);
    const px = (H / rows) * size;
    g.font = `600 ${px}px system-ui, sans-serif`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const x = align === 'center' ? W / 2 : align === 'left' ? H * 0.12 : W - H * 0.12;
    const top = (H - (H / rows) * current.length) / 2;
    current.forEach((line, i) => g.fillText(line, x, top + (H / rows) * (i + 0.5)));
  });
  mesh.setText = text => { current = [].concat(text); mesh.redraw(); };
  return mesh;
}

// Botão apontável: gatilho do controle, pinça da mão ou clique do mouse.
export function button(text, onPress, { width = 0.15, height = 0.05, color = '#2563eb' } = {}) {
  let state = { text, color, hover: false, active: false };
  const mesh = canvasPlane(width, height, (g, W, H) => {
    const fill = state.active ? COLORS.accent : state.color;
    roundRect(g, 0, 0, W, H, H * 0.3, fill);
    if (state.hover) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = H * 0.08;
      g.beginPath(); g.roundRect(H * 0.04, H * 0.04, W - H * 0.08, H - H * 0.08, H * 0.26); g.stroke();
    }
    g.fillStyle = state.active ? '#17211b' : '#ffffff';
    g.font = `700 ${H * 0.42}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(state.text, W / 2, H * 0.53);
  });
  mesh.userData.interactive = {
    onPress,
    onHover: hover => { state.hover = hover; mesh.redraw(); },
  };
  mesh.set = patch => { state = { ...state, ...patch }; mesh.redraw(); };
  return mesh;
}

// Cilindro entre dois pontos (conexões da rede, setas).
const UP = new THREE.Vector3(0, 1, 0);
export function placeCylinder(mesh, from, to, radius) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const length = dir.length();
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.scale.set(radius, length, radius);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
}

// Quebra `text` em linhas que cabem em `maxWidth` com a fonte atual de `g`.
export function wrapLines(g, text, maxWidth) {
  const lines = [''];
  for (const word of String(text).split(/\s+/)) {
    const next = `${lines[lines.length - 1]} ${word}`.trim();
    if (g.measureText(next).width > maxWidth && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = next;
  }
  return lines;
}

// Trilho com um botão pegável (linha do tempo, alavanca). `onChange(f)` recebe
// a fração 0..1 enquanto você arrasta; `set(f)` move o botão sem avisar.
export function slider({ length = 0.6, vertical = false, onChange, onGrab, onRelease, color = 0x475569 } = {}) {
  const group = new THREE.Group();
  const track = new THREE.Mesh(
    new THREE.BoxGeometry(vertical ? 0.024 : length, vertical ? length : 0.014, 0.024),
    new THREE.MeshStandardMaterial({ color }),
  );
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.022, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x444444 }));
  group.add(track, knob);
  const plane = new THREE.Plane(), hit = new THREE.Vector3(), normal = new THREE.Vector3(), origin = new THREE.Vector3();
  let value = 0;
  const place = f => {
    value = Math.min(Math.max(f, 0), 1);
    const c = (value - 0.5) * length;
    knob.position.set(vertical ? 0 : c, vertical ? c : 0, 0);
  };
  const scrub = pointer => {
    group.updateMatrixWorld();
    normal.set(0, 0, 1).transformDirection(group.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(normal, group.getWorldPosition(origin));
    if (!pointer.raycaster.ray.intersectPlane(plane, hit)) return;
    const local = group.worldToLocal(hit);
    place((vertical ? local.y : local.x) / length + 0.5);
    onChange?.(value);
  };
  const handlers = {
    onGrab: (h, pointer) => { onGrab?.(); scrub(pointer); },
    onDrag: scrub,
    onRelease: () => onRelease?.(value),
    onHover: on => knob.scale.setScalar(on ? 1.3 : 1),
  };
  track.userData.interactive = handlers;
  knob.userData.interactive = handlers;
  group.set = place;
  group.knob = knob;
  group.value = () => value;
  place(0);
  return group;
}
