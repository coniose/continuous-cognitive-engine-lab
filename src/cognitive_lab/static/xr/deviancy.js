// O problema que atravessa a trilha: qual a chance de um androide divergir
// (quebrar a programação e agir por conta própria)? Inspirado na ficção de
// androides em Detroit, 2038; personagens usados só como exemplo didático.
//
// É DE PROPÓSITO a mesma matemática do gêmeo do rolo (twin.js), trocando as
// unidades: idade do androide = idade do rolo, scan de estabilidade (%) =
// teste de qualidade, muro vermelho = limite mínimo, LED = andon. Sem
// three.js, dá para rodar no Node.
import { makeRng } from './nn.js';
import { DEFAULT_PARAMS, evaluate, weibullCdf } from './twin.js';

const DAY = 24;
const clamp01 = x => Math.min(Math.max(x, 0), 1);

// Mesmos pesos, mesma Weibull (β = 1,5, η = 24 dias) do rolo; só a escala muda.
export const ANDROID_PARAMS = {
  ...DEFAULT_PARAMS,
  forceLimit: 40,   // muro vermelho: estabilidade abaixo de 40% = rompendo a programação
  unit: '%',
  slopeScale: 4,    // cair 4 pontos de estabilidade por dia = perigo máximo
};

// LED na têmpora: azul = estável, amarelo = aviso, vermelho = divergindo.
export const LED = { estavel: '#38bdf8', aviso: '#facc15', divergiu: '#ef4444' };
export const levelLed = level => ({ NOVO: LED.estavel, NORMAL: LED.estavel, AVISO: LED.aviso }[level] || LED.divergiu);

const pct = x => `${Math.round(x * 100)}%`;
// Mesmo nível do motor do rolo, explicado com palavras de androide.
export function androidWhy(e, p = ANDROID_PARAMS) {
  return {
    NOVO: 'Ativado há menos de 2 dias: cedo demais para julgar.',
    NORMAL: 'Idade e estabilidade dentro do esperado.',
    AVISO: `Risco ${pct(e.pRisk)} ou queda de estabilidade (sinal ${e.signal.toFixed(2)}) passou do limiar de aviso.`,
    RISCO: `Um scan dos últimos 3 dias ficou abaixo do muro de ${p.forceLimit}% (${Number(e.min3d).toFixed(0)}%).`,
    CONFIRMADO: `Risco ${pct(e.pRisk)} e estabilidade caindo para baixo do muro: divergência confirmada.`,
    FIM_DE_VIDA: `Com ${e.ageDays.toFixed(1)} dias, chegou perto da vida característica (${p.etaDays} d): revisar mesmo se os scans estão bons.`,
  }[e.level];
}

// ---- Capítulo 1: contar ----
// Uma "semana" em que cada um dos n androides diverge com chance p.
export function drawWeek(n, p, rng) {
  return Array.from({ length: n }, () => rng.uniform() < p);
}

// ---- Capítulo 2: o tempo ----
// Dia em que cada androide diverge, sorteado da Weibull pela inversa da CDF.
// Os mesmos `u` servem para qualquer β: o androide k é sempre "o k-ésimo mais
// azarado", e trocar β só muda quando o azar chega.
export const uniforms = (n, seed = 7) => {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => rng.uniform());
};
export const lifetimes = (us, { beta, etaDays }) => us.map(u => etaDays * (-Math.log(1 - u)) ** (1 / beta));
export const reliability = (days, params) => 1 - weibullCdf(days, params);
// Chance de divergir nos próximos `horizon` dias, sabendo que chegou estável até `days`.
export const conditionalRisk = (days, params, horizon = 7) => {
  const r = reliability(days, params);
  return r > 1e-9 ? 1 - reliability(days + horizon, params) / r : 1;
};

// ---- Capítulo 3: medir ----
// Scans de estabilidade (%) ~3x por dia. A = autodiagnóstico do próprio
// androide, B = scan do Connor (o investigador). Quando os dois se afastam,
// o androide está dizendo que está melhor do que o scan externo mostra.
export const CHARACTERS = {
  kara: {
    name: 'Kara',
    who: 'androide doméstica, ativa há poucos dias',
    days: 12,
    curve: x => ({ m: 95 - 62 * (x / 12) ** 2.2, gap: 2 + 16 * (x / 12) ** 2 }),
  },
  markus: {
    name: 'Markus',
    who: 'androide cuidador, mais velho',
    days: 18,
    curve: x => ({ m: 91 - (x > 13 ? 7 * (x - 13) ** 1.3 : 0), gap: 2 + (x > 13 ? 3 * (x - 13) : 0) }),
  },
};

export function scans(id, seed = 3) {
  const c = CHARACTERS[id];
  const rng = makeRng(seed + id.length);
  const readings = [];
  for (let t = 5; t <= c.days * DAY; t += 8 + (rng.uniform() - 0.5) * 3) {
    const { m, gap } = c.curve(t / DAY);
    const mean = m + rng.normal() * 1.6, d = gap + rng.normal() * 1.2;
    readings.push({ t: +t.toFixed(2), a: +Math.min(100, mean + d / 2).toFixed(1), b: +Math.min(100, mean - d / 2).toFixed(1) });
  }
  return readings;
}

export const evaluateAndroid = (readings, tHours) => {
  const e = evaluate(readings, tHours, ANDROID_PARAMS);
  return { ...e, why: androidWhy(e) };
};

// ---- Capítulo 4: o neurônio ----
// A mesma fórmula do rolo, com as três entradas soltas para você mexer.
export function neuron({ ageDays, drop, slope }, p = ANDROID_PARAMS) {
  const ageRisk = weibullCdf(ageDays, p);
  const slopeDanger = clamp01(-slope / p.slopeScale);
  const signal = p.weightDeg * drop + p.weightSlope * slopeDanger;
  const fromMeasure = (1 - ageRisk) * signal * p.boost;
  const pRisk = ageRisk + fromMeasure;
  // Os gatilhos do rolo que só dependem do neurônio (o muro vermelho é uma regra à parte).
  const level = ageDays * DAY < p.minAgeHours ? 'NOVO'
    : pRisk >= p.pRiskConfirm && signal >= p.signalConfirm ? 'CONFIRMADO'
      : pRisk >= p.pRiskWarn || signal >= p.signalWarn ? 'AVISO' : 'NORMAL';
  return { ageRisk, slopeDanger, signal, fromMeasure, pRisk, level };
}
