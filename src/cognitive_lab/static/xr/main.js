// Motor do XR Lab: cena, entrada (controles, mãos, mouse), troca de lições e
// a ponte com o servidor, por onde um agente (Claude) abre lições, narra e lê o
// que você está fazendo.
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS, button, label } from './ui.js';
import gradiente from './lessons/gradiente.js';
import camadas from './lessons/camadas.js';

const LESSONS = [gradiente, camadas];
const log = window.log || console.log;
log('xr-lab: three', THREE.REVISION);

// ---------- cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const BACKGROUND = new THREE.Color(0x0b0f19);
scene.background = BACKGROUND;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 50);
camera.position.set(0, 1.6, 0.45);
scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(1, 3, 2);
scene.add(sun);

// "Palco": tudo das lições fica aqui dentro, ~1 m na sua frente.
const stage = new THREE.Group();
stage.position.set(0, 1.2, -1.0);
scene.add(stage);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(stage.position).add(new THREE.Vector3(0, -0.05, 0));
controls.enableDamping = true;
controls.update();

// ---------- entrada: ponteiros (controles/mãos no XR, mouse no PC) ----------
const pointers = [];
let interactive = [];
function refreshInteractive() {
  interactive = [];
  stage.traverse(o => { if (o.userData.interactive) interactive.push(o); });
}
const isShown = o => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
function firstHit(pointer) {
  const hits = pointer.raycaster.intersectObjects(interactive, false);
  return hits.find(h => isShown(h.object)) || null;
}

function press(pointer) {
  const hit = firstHit(pointer);
  if (!hit) return false;
  const handlers = hit.object.userData.interactive;
  handlers.onPress?.(hit, pointer);
  if (handlers.onGrab) { pointer.held = handlers; handlers.onGrab(hit, pointer); }
  return true;
}
function release(pointer) {
  if (pointer.held) { pointer.held.onRelease?.(pointer); pointer.held = null; }
}

const rotation = new THREE.Matrix4();
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i);
  const ray = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
  );
  ray.scale.z = 2;
  const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.006), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  cursor.visible = false;
  controller.add(ray);
  scene.add(controller, cursor);
  const pointer = {
    name: `controle${i}`, raycaster: new THREE.Raycaster(), held: null, active: false, ray, cursor,
    aim() {
      rotation.identity().extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
    },
  };
  controller.addEventListener('connected', e => {
    pointer.active = true;
    log('entrada conectada:', e.data.handedness, e.data.hand ? 'mão' : 'controle');
  });
  controller.addEventListener('disconnected', () => { pointer.active = false; release(pointer); });
  controller.addEventListener('selectstart', () => { pointer.aim(); press(pointer); });
  controller.addEventListener('selectend', () => release(pointer));
  pointers.push(pointer);
}

const mouse = {
  name: 'mouse', raycaster: new THREE.Raycaster(), held: null, active: true, ndc: new THREE.Vector2(9, 9),
  aim() { this.raycaster.setFromCamera(this.ndc, camera); },
};
pointers.push(mouse);
const setNdc = e => mouse.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
// Captura antes do OrbitControls: se o clique acertou algo interativo, a
// câmera não gira.
addEventListener('pointerdown', e => {
  if (e.target !== renderer.domElement || renderer.xr.isPresenting) return;
  setNdc(e);
  mouse.aim();
  controls.enabled = !press(mouse);
}, { capture: true });
addEventListener('pointermove', e => setNdc(e));
addEventListener('pointerup', () => { release(mouse); controls.enabled = true; });

let hovered = new Set();
function updatePointers() {
  const now = new Set();
  for (const p of pointers) {
    const usable = p === mouse ? !renderer.xr.isPresenting : p.active;
    if (!usable) continue;
    p.aim();
    if (p.held) p.held.onDrag?.(p);
    const hit = firstHit(p);
    if (hit) now.add(hit.object);
    if (p.cursor) {
      p.cursor.visible = !!hit;
      if (hit) p.cursor.position.copy(hit.point);
      p.ray.scale.z = hit ? hit.distance : 2;
    }
  }
  for (const o of hovered) if (!now.has(o)) o.userData.interactive.onHover?.(false);
  for (const o of now) if (!hovered.has(o)) o.userData.interactive.onHover?.(true);
  hovered = now;
  renderer.domElement.style.cursor = mouse.held ? 'grabbing' : [...now].length ? 'pointer' : '';
}

// ---------- eventos e estado para o agente ----------
let pendingEvents = [];
function emit(type, data = {}) {
  const event = { tipo: type, licao: current?.id, quando: new Date().toISOString(), ...data };
  pendingEvents.push(event);
  log('evento', JSON.stringify(event));
}

// ---------- menu e legenda ----------
const menu = new THREE.Group();
menu.position.set(0, 0.42, -0.05);
stage.add(menu);
const menuButtons = {};
LESSONS.forEach((lesson, k) => {
  const b = button(`${k + 1} · ${lesson.title}`, () => openLesson(lesson.id, 'menu'), { width: 0.3, height: 0.055, color: '#334155' });
  b.position.set((k - LESSONS.length / 2) * 0.32 + 0.0, 0, 0);
  menuButtons[lesson.id] = b;
  menu.add(b);
});
const recenter = button('📍 Trazer para frente', () => { placeStageNextFrame = 1; }, { width: 0.26, height: 0.055, color: '#334155' });
recenter.position.set(LESSONS.length / 2 * 0.32 + 0.0, 0, 0);
menu.add(recenter);

const caption = label('', { width: 1.25, height: 0.1, size: 0.6, minLines: 3, background: 'rgba(124, 58, 237, 0.92)' });
caption.position.set(0, 0.55, -0.05);
caption.visible = false;
stage.add(caption);
let captionTimer = null;
function showCaption(text, speak = true) {
  const lines = [''];
  for (const word of String(text).split(/\s+/)) {
    const candidate = `${lines[lines.length - 1]} ${word}`.trim();
    if (candidate.length > 80 && lines[lines.length - 1]) lines.push(word);
    else lines[lines.length - 1] = candidate;
  }
  if (lines.length > 3) lines.splice(2, lines.length, `${lines[2]}…`);
  lines[0] = `🗨 ${lines[0]}`;
  caption.setText(lines);
  caption.visible = true;
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => { caption.visible = false; }, 20000);
  if (speak && 'speechSynthesis' in window) {
    try {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(text));
      utterance.lang = 'pt-BR';
      speechSynthesis.speak(utterance);
    } catch (e) { log('fala indisponível:', String(e)); }
  }
}

// ---------- lições ----------
let current = null;
const ctx = { emit, log, refreshInteractive };
function openLesson(id, source = 'código') {
  const lesson = LESSONS.find(l => l.id === id);
  if (!lesson) { log('lição desconhecida:', id); return false; }
  if (current) {
    stage.remove(current.instance.group);
    current.instance.group.traverse(o => { o.geometry?.dispose?.(); });
  }
  for (const p of pointers) p.held = null;
  current = { id, instance: lesson.create(ctx) };
  stage.add(current.instance.group);
  refreshInteractive();
  hovered = new Set();
  Object.entries(menuButtons).forEach(([key, b]) => b.set({ active: key === id }));
  const url = new URL(location.href);
  url.searchParams.set('licao', id);
  history.replaceState(null, '', url);
  emit('licao_aberta', { origem: source });
  return true;
}

// ---------- ponte com o servidor (Claude manda comandos por aqui) ----------
let lastCommandId = null;
function handleCommand(command) {
  log('comando', JSON.stringify(command));
  if (command.action === 'open_lesson') openLesson(command.lesson, 'agente');
  if (command.action === 'caption') showCaption(command.text, command.speak !== false);
  if (command.action === 'control' && current) {
    if (command.lesson && command.lesson !== current.id) openLesson(command.lesson, 'agente');
    const ok = current.instance.control(command.name, command.value);
    if (!ok) log('controle desconhecido:', command.name);
  }
}
async function pollCommands() {
  try {
    const query = lastCommandId === null ? '' : `?after=${lastCommandId}`;
    const response = await fetch(`/api/xr/commands${query}`, { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (lastCommandId === null) lastCommandId = data.latest_id;
      for (const command of data.commands || []) {
        lastCommandId = Math.max(lastCommandId, command.id);
        handleCommand(command);
      }
    }
  } catch (e) { /* sem servidor (arquivo aberto direto): segue offline */ }
  setTimeout(pollCommands, 1000);
}
async function pushState() {
  const events = pendingEvents;
  pendingEvents = [];
  try {
    await fetch('/api/xr/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licao: current?.id,
        imersivo: renderer.xr.isPresenting,
        estado: current?.instance.snapshot(),
        eventos: events,
      }),
    });
  } catch (e) { /* offline */ }
  setTimeout(pushState, 1500);
}

// ---------- WebXR ----------
let placeStageNextFrame = 0;
renderer.xr.addEventListener('sessionstart', () => {
  const session = renderer.xr.getSession();
  log('sessão XR iniciou', session.environmentBlendMode || '-', [...(session.enabledFeatures || [])].join(','));
  if (session.environmentBlendMode && session.environmentBlendMode !== 'opaque') scene.background = null;
  placeStageNextFrame = 1;
  document.getElementById('info')?.classList.add('hidden');
  emit('xr_iniciou', { modo: session.environmentBlendMode || 'opaque' });
});
renderer.xr.addEventListener('sessionend', () => {
  scene.background = BACKGROUND;
  document.getElementById('info')?.classList.remove('hidden');
  log('sessão XR terminou');
});

// Põe o palco ~1 m à frente da cabeça, um pouco abaixo dos olhos. Espera
// alguns quadros porque a pose da cabeça chega zerada no começo da sessão.
const head = new THREE.Vector3(), headQ = new THREE.Quaternion();
function placeStage() {
  const xrCamera = renderer.xr.getCamera();
  xrCamera.getWorldPosition(head);
  xrCamera.getWorldQuaternion(headQ);
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(headQ).setY(0);
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
  forward.normalize();
  stage.position.copy(head).addScaledVector(forward, 1.0);
  stage.position.y = head.y - 0.25;
  stage.rotation.set(0, Math.atan2(-forward.x, -forward.z), 0);
  log('palco em', stage.position.toArray().map(n => +n.toFixed(2)));
}

async function addXrButton() {
  if (!navigator.xr) { log('sem navigator.xr: modo PC (mouse)'); return; }
  const ar = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  const options = { optionalFeatures: ['local-floor', 'hand-tracking'] };
  document.body.appendChild(ar ? ARButton.createButton(renderer, options) : VRButton.createButton(renderer, options));
  log('botão XR:', ar ? 'AR (passthrough)' : 'VR');
}

// ---------- loop ----------
const clock = new THREE.Clock();
let framesSincePlace = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (placeStageNextFrame && renderer.xr.isPresenting && ++framesSincePlace > 20) {
    placeStage();
    placeStageNextFrame = 0;
    framesSincePlace = 0;
  }
  updatePointers();
  current?.instance.update(dt);
  if (!renderer.xr.isPresenting) controls.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const requested = new URLSearchParams(location.search).get('licao');
openLesson(LESSONS.some(l => l.id === requested) ? requested : LESSONS[0].id, 'url');
addXrButton();
pollCommands();
pushState();
window.xrLab = { openLesson, showCaption, handleCommand, get current() { return current; } };
