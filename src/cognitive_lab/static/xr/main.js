// Motor do XR Lab: cena, entrada (controles, mãos, mouse), troca de lições e
// a ponte com o servidor, por onde um agente (Claude) abre lições, narra e lê o
// que você está fazendo.
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { COLORS, button, canvasPlane, label, roundRect, wrapLines } from './ui.js';
import intro from './lessons/intro.js';
import contar from './lessons/contar.js';
import tempo from './lessons/tempo.js';
import medir from './lessons/medir.js';
import neuronio from './lessons/neuronio.js';
import rolo from './lessons/rolo.js';
import gradiente from './lessons/gradiente.js';
import camadas from './lessons/camadas.js';

// A trilha, em ordem: um problema só (a chance de um androide divergir) até
// chegar no gêmeo do rolo, e depois como uma máquina aprende os pesos.
const LESSONS = [intro, contar, tempo, medir, neuronio, rolo, gradiente, camadas];
const chapterName = (k, short = false) => (k === 0 ? 'Introdução' : `Cap. ${k}${short ? '' : ` de ${LESSONS.length - 1}`} · ${LESSONS[k].title}`);
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

let interacted = false; // o navegador só deixa falar depois de um gesto seu
function press(pointer) {
  interacted = true;
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

// ---------- navegação: ◀ capítulo ▶, lista de capítulos, voz ----------
let current = null; // lição aberta: { id, instance }
const menu = new THREE.Group();
menu.position.set(0, 0.42, -0.05);
stage.add(menu);
const indexOfCurrent = () => LESSONS.findIndex(l => l.id === current?.id);
const goChapter = delta => {
  const k = indexOfCurrent() + delta;
  if (k >= 0 && k < LESSONS.length) openLesson(LESSONS[k].id, 'navegação');
};
const voiceButton = button('🔊 Voz: sim', () => setVoice(!voiceOn), { width: 0.15, height: 0.055, color: '#334155' });
const prevButton = button('◀', () => goChapter(-1), { width: 0.08, height: 0.055, color: '#334155' });
const chapterLabel = label('', { width: 0.44, height: 0.055, size: 0.62, background: 'rgba(15, 20, 32, 0.88)' });
const nextButton = button('▶', () => goChapter(+1), { width: 0.08, height: 0.055, color: '#334155' });
const listButton = button('☰ Capítulos', () => { chapterList.visible = !chapterList.visible; }, { width: 0.17, height: 0.055, color: '#334155' });
const recenter = button('📍 Trazer para frente', () => { placeStageNextFrame = 1; }, { width: 0.26, height: 0.055, color: '#334155' });
[[voiceButton, -0.6], [prevButton, -0.465], [chapterLabel, -0.19], [nextButton, 0.085], [listButton, 0.22], [recenter, 0.45]]
  .forEach(([b, x]) => { b.position.set(x, 0, 0); menu.add(b); });

// lista de capítulos (☰): aparece na frente de tudo
const chapterList = new THREE.Group();
chapterList.position.set(0, 0.1, 0.35);
chapterList.visible = false;
stage.add(chapterList);
const rows = Math.ceil(LESSONS.length / 2);
const listBackground = canvasPlane(0.74, 0.1 + rows * 0.07, (g, W, H) => roundRect(g, 0, 0, W, H, 30, 'rgba(15, 20, 32, 0.95)'));
listBackground.position.z = -0.005;
chapterList.add(listBackground);
const chapterButtons = {};
LESSONS.forEach((lesson, k) => {
  const b = button(chapterName(k, true), () => { chapterList.visible = false; openLesson(lesson.id, 'menu'); }, { width: 0.34, height: 0.055, color: '#334155' });
  b.position.set(k < rows ? -0.18 : 0.18, (rows - 1) * 0.035 - (k % rows) * 0.07, 0);
  chapterButtons[lesson.id] = b;
  chapterList.add(b);
});
// desenhada por cima de tudo: o produto do rolo, por exemplo, avança até perto de você
chapterList.traverse(o => { if (o.material) { o.material.depthTest = false; o.renderOrder = o === listBackground ? 10 : 11; } });

// ---------- guia narrado: cada capítulo é um roteiro de passos curtos ----------
const guide = { step: 0 };
const guideGroup = new THREE.Group();
guideGroup.position.set(-0.95, 0.02, 0.15);
guideGroup.rotation.y = 0.6;
stage.add(guideGroup);
const guidePanel = canvasPlane(0.46, 0.36, (g, W, H) => {
  const lesson = current && LESSONS.find(l => l.id === current.id);
  const steps = lesson?.steps || [];
  roundRect(g, 0, 0, W, H, 28, 'rgba(15, 20, 32, 0.92)');
  if (!lesson) return;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  g.fillStyle = COLORS.accent;
  g.font = '700 30px system-ui, sans-serif';
  g.fillText(chapterName(indexOfCurrent(), true), 28, 50);
  g.textAlign = 'right';
  g.fillStyle = COLORS.muted;
  g.font = '600 24px system-ui, sans-serif';
  if (steps.length) g.fillText(`passo ${guide.step + 1} de ${steps.length}`, W - 28, 50);
  g.textAlign = 'left';
  // pontinhos de progresso
  steps.forEach((_, k) => {
    g.fillStyle = k <= guide.step ? COLORS.accent : 'rgba(255,255,255,0.2)';
    g.beginPath(); g.arc(34 + k * 26, 76, 8, 0, Math.PI * 2); g.fill();
  });
  g.fillStyle = COLORS.ink;
  g.font = '500 31px system-ui, sans-serif';
  wrapLines(g, steps[guide.step]?.text || '', W - 56).slice(0, 10).forEach((line, k) => g.fillText(line, 28, 128 + k * 41));
});
guideGroup.add(guidePanel);
const backStep = button('◀ Voltar', () => showStep(guide.step - 1), { width: 0.13, height: 0.055, color: '#475569' });
const repeatStep = button('🔊 Repetir', () => sayStep(), { width: 0.14, height: 0.055, color: '#475569' });
const nextStep = button('Próximo ▶', () => advance(), { width: 0.17, height: 0.055, color: '#7c3aed' });
[[backStep, -0.16], [repeatStep, -0.015], [nextStep, 0.145]].forEach(([b, x]) => { b.position.set(x, -0.215, 0); guideGroup.add(b); });

let voiceOn = true;
let ptVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices();
  ptVoice = voices.find(v => v.lang === 'pt-BR') || voices.find(v => v.lang?.startsWith('pt')) || null;
  log('vozes:', voices.length, 'pt:', ptVoice ? `${ptVoice.name} (${ptVoice.lang})` : 'nenhuma');
}
if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
} else log('sem speechSynthesis neste navegador');
// O navegador do Quest não tem speechSynthesis: a narração dos guias é um MP3
// pré-gerado (python -m cognitive_lab.narration), com o hash do texto no nome.
// Sem o arquivo (ex.: legenda nova de um agente), tenta a voz do navegador.
const fnv1a = text => {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) { h ^= byte; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
};
let narration = null;
function stopSpeech() {
  narration?.pause();
  narration = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    if (ptVoice) utterance.voice = ptVoice;
    speechSynthesis.speak(utterance);
  } catch (e) { log('fala indisponível:', String(e)); }
}
function speak(text) {
  text = String(text);
  if (!voiceOn || !interacted || !text) return;
  stopSpeech();
  const audio = narration = new Audio(`narracao/${fnv1a(text)}.mp3`);
  audio.play().catch(e => {
    if (narration !== audio) return; // já trocou de passo
    log('sem áudio para o passo:', String(e));
    speakWithBrowser(text);
  });
}
function setVoice(on) {
  voiceOn = on;
  voiceButton.set({ text: on ? '🔊 Voz: sim' : '🔇 Voz: não' });
  if (!on) stopSpeech();
}

function showStep(k, { talk = true } = {}) {
  const steps = LESSONS.find(l => l.id === current?.id)?.steps || [];
  if (!steps.length) return;
  guide.step = Math.min(Math.max(k, 0), steps.length - 1);
  const step = steps[guide.step];
  const controls = !step.control ? [] : Array.isArray(step.control[0]) ? step.control : [step.control];
  controls.forEach(([name, value]) => current.instance.control(name, value));
  const last = guide.step === steps.length - 1;
  const lastChapter = indexOfCurrent() === LESSONS.length - 1;
  nextStep.set({ text: last ? (lastChapter ? 'Fim ✓' : 'Cap. seguinte ▶') : 'Próximo ▶' });
  backStep.visible = guide.step > 0;
  guidePanel.redraw();
  if (talk) speak(step.text);
  emit('passo_guia', { passo: guide.step + 1, de: steps.length });
}
const currentSteps = () => LESSONS.find(l => l.id === current?.id)?.steps || [];
const sayStep = () => speak(currentSteps()[guide.step]?.text || '');
function advance() {
  const steps = LESSONS.find(l => l.id === current?.id)?.steps || [];
  if (guide.step < steps.length - 1) showStep(guide.step + 1);
  else goChapter(+1);
}

const caption = label('', { width: 1.25, height: 0.1, size: 0.6, minLines: 3, background: 'rgba(124, 58, 237, 0.92)' });
caption.position.set(0, 0.55, -0.05);
caption.visible = false;
stage.add(caption);
let captionTimer = null;
function showCaption(text, talk = true) {
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
  if (talk) speak(text);
}

// ---------- lições ----------
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
  Object.entries(chapterButtons).forEach(([key, b]) => b.set({ active: key === id }));
  const k = indexOfCurrent();
  chapterLabel.setText(chapterName(k));
  prevButton.visible = k > 0;
  nextButton.visible = k < LESSONS.length - 1;
  showStep(0, { talk: source !== 'url' });
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
  if (command.action === 'guide') {
    const step = command.step;
    if (step === 'next') advance();
    else if (step === 'prev') showStep(guide.step - 1);
    else if (step === 'repeat') sayStep();
    else if (Number.isInteger(step)) showStep(step - 1);
  }
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
        guia: { passo: guide.step + 1, total: LESSONS.find(l => l.id === current?.id)?.steps?.length || 0 },
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
  interacted = true; // START AR foi um toque seu: já dá para narrar
  setTimeout(sayStep, 1200);
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
window.xrLab = { openLesson, showCaption, handleCommand, showStep, speak, get current() { return current; } };
