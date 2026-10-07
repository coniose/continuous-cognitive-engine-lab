// Matemática das lições, sem three.js: dá para rodar e testar no Node.
// É a mesma conta do exemplo em Python (sigmoid + entropia cruzada +
// gradiente descendente em lote), só que escrita à mão em arrays.

export const sigmoid = z => 1 / (1 + Math.exp(-z));

// Gerador determinístico (mulberry32) + normal via Box-Muller, para que
// "reiniciar com a semente 7" sempre gere a mesma rede.
export function makeRng(seed) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(uniform(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * uniform());
  };
  return { uniform, normal };
}

const EPS = 1e-9;
export function crossEntropy(p, y) {
  const q = Math.min(Math.max(p, EPS), 1 - EPS);
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

// ---- Capítulo 6: um neurônio com uma entrada (ordens contraditórias por dia -> divergiu?) ----
// Os rótulos se sobrepõem de propósito (um androide com 3 ordens/dia divergiu,
// outro com 5,5 não). Assim o vale do erro tem um fundo de verdade.
export const STUDY = {
  hours: [1, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8],
  passed: [0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 1],
};
export const studyInput = h => (h - 4.5) / 2; // centraliza e reduz a escala

export function neuronLoss(w, b, data = STUDY) {
  let total = 0;
  for (let i = 0; i < data.hours.length; i++) {
    total += crossEntropy(sigmoid(w * studyInput(data.hours[i]) + b), data.passed[i]);
  }
  return total / data.hours.length;
}

// Derivada da perda em relação a w e b: média de (previsão - alvo) * entrada.
export function neuronGradient(w, b, data = STUDY) {
  let gw = 0, gb = 0;
  const n = data.hours.length;
  for (let i = 0; i < n; i++) {
    const x = studyInput(data.hours[i]);
    const error = sigmoid(w * x + b) - data.passed[i];
    gw += error * x;
    gb += error;
  }
  return [gw / n, gb / n];
}

// ---- Lição 2: rede em camadas (perceptron multicamadas) ----
export const XOR = {
  inputs: [[0, 0], [0, 1], [1, 0], [1, 1]],
  targets: [0, 1, 1, 0],
};

export class MLP {
  // sizes = [2, 4, 1] → 2 entradas, 4 neurônios ocultos, 1 saída
  constructor(sizes, seed = 1) {
    this.sizes = sizes;
    this.seed = seed;
    const rng = makeRng(seed);
    this.weights = []; // weights[l][i][j]: do neurônio i (camada l) para j (camada l+1)
    this.biases = [];
    for (let l = 0; l < sizes.length - 1; l++) {
      this.weights.push(Array.from({ length: sizes[l] }, () =>
        Array.from({ length: sizes[l + 1] }, () => rng.normal())));
      this.biases.push(new Array(sizes[l + 1]).fill(0));
    }
    this.epoch = 0;
  }

  // Devolve as ativações de todas as camadas (a primeira é a própria entrada).
  forward(input) {
    const activations = [input.slice()];
    for (let l = 0; l < this.weights.length; l++) {
      const prev = activations[l];
      const next = this.biases[l].map((bias, j) => {
        let z = bias;
        for (let i = 0; i < prev.length; i++) z += prev[i] * this.weights[l][i][j];
        return sigmoid(z);
      });
      activations.push(next);
    }
    return activations;
  }

  predict(input) {
    const acts = this.forward(input);
    return acts[acts.length - 1][0];
  }

  loss(data = XOR) {
    let total = 0;
    data.inputs.forEach((x, k) => { total += crossEntropy(this.predict(x), data.targets[k]); });
    return total / data.inputs.length;
  }

  // Uma época = olhar todos os exemplos, somar a "culpa" de cada peso
  // (backpropagation) e dar um passo contra o gradiente.
  trainEpoch(data = XOR, lr = 1) {
    const n = data.inputs.length;
    const gW = this.weights.map(m => m.map(row => row.map(() => 0)));
    const gB = this.biases.map(v => v.map(() => 0));
    data.inputs.forEach((x, k) => {
      const acts = this.forward(x);
      const last = acts.length - 1;
      // Na saída, sigmoid + entropia cruzada dão um delta simples: previsão - alvo.
      let delta = [(acts[last][0] - data.targets[k]) / n];
      for (let l = this.weights.length - 1; l >= 0; l--) {
        const prev = acts[l];
        for (let i = 0; i < prev.length; i++) {
          for (let j = 0; j < delta.length; j++) gW[l][i][j] += prev[i] * delta[j];
        }
        delta.forEach((d, j) => { gB[l][j] += d; });
        if (l > 0) {
          // Regra da cadeia: devolve o erro para a camada anterior.
          delta = prev.map((a, i) => {
            let s = 0;
            for (let j = 0; j < delta.length; j++) s += this.weights[l][i][j] * delta[j];
            return s * a * (1 - a);
          });
        }
      }
    });
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        for (let j = 0; j < this.weights[l][i].length; j++) this.weights[l][i][j] -= lr * gW[l][i][j];
      }
      for (let j = 0; j < this.biases[l].length; j++) this.biases[l][j] -= lr * gB[l][j];
    }
    this.epoch++;
    return this.loss(data);
  }
}
