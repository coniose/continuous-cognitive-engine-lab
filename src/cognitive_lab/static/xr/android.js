// O androide da trilha, em 3D: uma figura só (Kara, Markus, Connor) e uma
// multidão de 100 desenhada com InstancedMesh (3 chamadas de desenho, leve
// para o Quest). O LED na têmpora usa as cores de `deviancy.js`.
import * as THREE from 'three';
import { LED } from './deviancy.js';
import { label } from './ui.js';

// Modelado em escala humana (1,8 m) e encolhido para caber na mesa.
export function makeAndroid({ height = 0.45, name = '', suit = 0xe2e8f0, ledColor = LED.estavel } = {}) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(height / 1.8);
  group.add(body);
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9dee7, roughness: 0.45 });
  const cloth = new THREE.MeshStandardMaterial({ color: suit, roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  const add = (geometry, material, x, y, z = 0, rz = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    body.add(m);
    return m;
  };
  const leg = new THREE.CapsuleGeometry(0.075, 0.72, 4, 12);
  add(leg, dark, -0.1, 0.45);
  add(leg, dark, 0.1, 0.45);
  add(new THREE.CapsuleGeometry(0.17, 0.4, 6, 16), cloth, 0, 1.13);
  const arm = new THREE.CapsuleGeometry(0.055, 0.55, 4, 12);
  add(arm, cloth, -0.24, 1.08, 0, 0.12);
  add(arm, cloth, 0.24, 1.08, 0, -0.12);
  add(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 12), skin, 0, 1.44);
  add(new THREE.SphereGeometry(0.12, 24, 16), skin, 0, 1.6);
  // braçadeira e triângulo azuis: "isto é um androide"
  add(new THREE.CylinderGeometry(0.062, 0.062, 0.05, 16), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), 0.27, 1.17, 0, -0.12);
  const tri = add(new THREE.CircleGeometry(0.045, 3), new THREE.MeshBasicMaterial({ color: 0x38bdf8 }), -0.08, 1.3, 0.172);
  tri.rotation.z = Math.PI / 2;
  // LED: anel na têmpora direita, virado para você
  const ledMaterial = new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 1.4 });
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.013, 8, 24), ledMaterial);
  led.position.set(0.1, 1.63, 0.065);
  led.rotation.y = 0.9;
  body.add(led);
  // halo grande do LED: no óculos, o anel real fica pequeno demais para ler a cor
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 40), new THREE.MeshBasicMaterial({ color: ledColor, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
  halo.position.set(0, 1.6, 0);
  halo.rotation.x = -Math.PI / 2;
  body.add(halo);

  if (name) {
    const tag = label(name, { width: 0.14, height: 0.04 });
    tag.position.set(0, height + 0.04, 0);
    group.add(tag);
    group.tag = tag;
  }

  let pulse = 0, speed = 1.5;
  group.setLed = (color, { fast = false } = {}) => {
    ledMaterial.color.set(color);
    ledMaterial.emissive.set(color);
    halo.material.color.set(color);
    speed = fast ? 6 : 1.5;
  };
  group.update = dt => {
    pulse += dt * speed;
    const k = 0.5 + 0.5 * Math.sin(pulse * Math.PI);
    ledMaterial.emissiveIntensity = 0.8 + 0.9 * k;
    halo.material.opacity = 0.3 + 0.4 * k;
  };
  return group;
}

// Multidão em grade: `setLed(i, cor)` pinta o LED e o corpo do androide i.
export function makeCrowd({ cols = 10, rows = 10, spacing = 0.06, height = 0.085 } = {}) {
  const n = cols * rows;
  const group = new THREE.Group();
  const s = height / 1.8;
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17 * s, 1.05 * s, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.6 }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13 * s, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd9dee7, roughness: 0.45 }), n);
  // "LED" da multidão: um disco flutuando acima da cabeça, para dar para ver de longe
  const leds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial(), n);
  const m = new THREE.Matrix4(), color = new THREE.Color();
  const positions = [];
  for (let i = 0; i < n; i++) {
    const x = ((i % cols) - (cols - 1) / 2) * spacing;
    const z = (Math.floor(i / cols) - (rows - 1) / 2) * spacing;
    positions.push(new THREE.Vector3(x, 0, z));
    bodies.setMatrixAt(i, m.makeTranslation(x, 0.72 * s, z));
    heads.setMatrixAt(i, m.makeTranslation(x, 1.6 * s, z));
    leds.setMatrixAt(i, m.makeTranslation(x, 1.6 * s + 0.018, z));
  }
  group.add(bodies, heads, leds);
  const setLed = (i, css) => {
    leds.setColorAt(i, color.set(css));
    // corpo levemente tingido: vermelho fica visível mesmo de cima
    bodies.setColorAt(i, color.set(css).lerp(new THREE.Color(0xe2e8f0), css === LED.estavel ? 0.85 : 0.35));
  };
  for (let i = 0; i < n; i++) setLed(i, LED.estavel);
  group.n = n;
  group.positions = positions;
  group.setLed = (i, css) => { setLed(i, css); };
  group.commit = () => { leds.instanceColor.needsUpdate = true; bodies.instanceColor.needsUpdate = true; };
  group.commit();
  return group;
}
