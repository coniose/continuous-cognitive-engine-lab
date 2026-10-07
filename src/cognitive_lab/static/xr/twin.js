// Matemática do gêmeo digital do rolo de selagem, sem three.js (testável no Node).
//
// Reimplementação SIMPLIFICADA e didática de um motor de risco de manutenção
// preditiva: vida útil Weibull (inferida pela idade) + sinal de degradação
// (medido no teste de qualidade de força de selagem), combinados como um único
// neurônio feito à mão. Parâmetros abaixo são de EXEMPLO; troque pelos seus.
import { makeRng } from './nn.js';

export const DEFAULT_PARAMS = {
  beta: 1.5,             // forma da Weibull (>1 = desgaste que acelera com a idade)
  etaDays: 24,           // vida característica: 63,2% dos rolos já falharam nessa idade
  forceLimit: 800,       // força mínima aceitável no teste de qualidade
  unit: 'gf',
  weightDeg: 0.6,        // peso da queda relativa (média 3d vs 14d)
  weightSlope: 0.4,      // peso da inclinação mais negativa do ciclo
  slopeScale: 50,        // queda de 50 unidades/dia = perigo máximo
  boost: 0.65,           // quanto a evidência medida pode somar ao risco da idade
  pRiskCritical: 0.30,   // CONFIRMADO pelo caminho força crítica
  pRiskConfirm: 0.48,    // CONFIRMADO pelo caminho degradação
  signalConfirm: 0.22,
  pRiskWarn: 0.35,       // AVISO
  signalWarn: 0.15,
  endOfLifeMarginDays: 5,
  minAgeHours: 48,       // rolo recém-trocado: nada dispara
};

const DAY = 24;
const mean = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const clamp01 = x => Math.min(Math.max(x, 0), 1);
export const media = r => (r.a + r.b) / 2;

// ---- Weibull: a parte INFERIDA (só depende da idade) ----
export const weibullCdf = (days, { beta, etaDays }) => (days <= 0 ? 0 : 1 - Math.exp(-((days / etaDays) ** beta)));
export const weibullInverse = (p, { beta, etaDays }) => etaDays * (-Math.log(1 - p)) ** (1 / beta);
// Vida restante mediana DADO que o rolo chegou vivo até `days` (Weibull condicional).
export function remainingLifeP50(days, params) {
  const now = weibullCdf(days, params);
  const target = Math.min(now + (1 - now) * 0.5, 0.9999);
  return Math.max(0, weibullInverse(target, params) - days);
}

// ---- Sinal medido: janelas sobre as leituras do teste de qualidade ----
const inWindow = (readings, tHours, days) => readings.filter(r => r.t <= tHours && r.t > tHours - days * DAY);

// Inclinação (unidades por dia) da regressão linear das leituras dos últimos 7 dias.
export function slope7d(readings, tHours) {
  const w = inWindow(readings, tHours, 7);
  if (w.length < 3) return 0;
  const xs = w.map(r => r.t / DAY), ys = w.map(media);
  const xm = mean(xs), ym = mean(ys);
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - xm) * (ys[i] - ym); den += (x - xm) ** 2; });
  return den ? num / den : 0;
}

// Pior inclinação de 7 dias vista desde a troca (um sinal com "memória").
export function minSlopeCycle(readings, tHours) {
  if (tHours < 7 * DAY) return slope7d(readings, tHours);
  let worst = Infinity;
  for (let t = 7 * DAY; t <= tHours; t += DAY) worst = Math.min(worst, slope7d(readings, t));
  return worst;
}

export function evaluate(readings, tHours, params = DEFAULT_PARAMS) {
  const p = { ...DEFAULT_PARAMS, ...params };
  const ageDays = tHours / DAY;
  const seen = readings.filter(r => r.t <= tHours);
  const last3 = inWindow(readings, tHours, 3).map(media);
  const mean3d = mean(last3);
  const mean14d = mean(inWindow(readings, tHours, 14).map(media));
  const min3d = last3.length ? Math.min(...last3) : NaN;
  const slope = slope7d(readings, tHours);
  const slopeMin = minSlopeCycle(readings, tHours);

  // O "neurônio": duas entradas medidas → sinal; sinal + idade → risco.
  const degSignal = Number.isFinite(mean3d / mean14d) ? Math.max(0, 1 - mean3d / mean14d) : 0;
  const slopeDanger = clamp01(-slopeMin / p.slopeScale);
  const signal = p.weightDeg * degSignal + p.weightSlope * slopeDanger;
  const ageRisk = weibullCdf(ageDays, p);
  const pRisk = ageRisk + (1 - ageRisk) * signal * p.boost;
  const proj48h = mean3d + slope * 2;

  const gateDays = Math.max(5, 0.25 * p.etaDays);
  const last = seen[seen.length - 1];
  const features = {
    ageDays, ageRisk, reliability: 1 - ageRisk, remainingDaysP50: remainingLifeP50(ageDays, p),
    mean3d, mean14d, min3d, slope, slopeMin, degSignal, slopeDanger, signal, pRisk, proj48h, gateDays,
    lastA: last?.a ?? NaN, lastB: last?.b ?? NaN, deltaAB: last ? Math.abs(last.a - last.b) : NaN,
    readings: seen.length,
  };
  return { ...features, ...classify(features, p) };
}

// Gatilhos (versão didática: sem cooldown, snooze, filtro de outlier ou janela 2-de-5).
export function classify(f, p = DEFAULT_PARAMS) {
  const L = p.forceLimit;
  if (f.ageDays * DAY < p.minAgeHours) {
    return { level: 'NOVO', why: `Rolo recém-trocado (< ${p.minAgeHours} h): nenhum alerta dispara.` };
  }
  if (f.ageDays >= p.etaDays - p.endOfLifeMarginDays) {
    return { level: 'FIM_DE_VIDA', why: `Idade ${f.ageDays.toFixed(1)} d chegou a ${p.endOfLifeMarginDays} d da vida característica (${p.etaDays} d).` };
  }
  const old = f.ageDays >= f.gateDays;
  if (old && f.min3d < L && f.pRisk >= p.pRiskCritical) {
    return { level: 'CONFIRMADO', why: `Força mínima 3d ${f.min3d.toFixed(0)} < ${L} e risco ${pct(f.pRisk)} ≥ ${pct(p.pRiskCritical)}.` };
  }
  if (old && f.pRisk >= p.pRiskConfirm && f.signal >= p.signalConfirm && f.proj48h < L) {
    return { level: 'CONFIRMADO', why: `Risco ${pct(f.pRisk)}, sinal ${f.signal.toFixed(2)} e força projetada em 48 h ${f.proj48h.toFixed(1)} < ${L}.` };
  }
  if (f.min3d < L) {
    return { level: 'RISCO', why: `Uma leitura dos últimos 3 dias ficou abaixo de ${L} (${f.min3d.toFixed(0)}).` };
  }
  if (old && (f.pRisk >= p.pRiskWarn || f.signal >= p.signalWarn)) {
    return { level: 'AVISO', why: `Risco ${pct(f.pRisk)} ou sinal de degradação ${f.signal.toFixed(2)} passou do limiar de aviso.` };
  }
  return { level: 'NORMAL', why: 'Idade e força dentro do esperado.' };
}
const pct = x => `${Math.round(x * 100)}%`;

export const LEVEL_COLORS = {
  NOVO: '#38bdf8', NORMAL: '#22c55e', AVISO: '#facc15', RISCO: '#f97316', CONFIRMADO: '#ef4444', FIM_DE_VIDA: '#d946ef',
};

// Ciclo sintético: teste destrutivo ~3x/dia, força cai acelerando e os lados A/B
// se afastam com o desgaste. Inclui um buraco de ~2 dias sem teste (parada).
export function syntheticCycle(seed = 14, days = 19) {
  const rng = makeRng(seed);
  const readings = [];
  for (let t = 4; t <= days * DAY; t += 8 + (rng.uniform() - 0.5) * 3) {
    if (t > 6.5 * DAY && t < 8.5 * DAY) continue;
    const x = t / DAY;
    const m = 1300 - 650 * (x / 19) ** 2.4 + rng.normal() * 22;
    const d = 20 + 140 * (x / 19) ** 2 + rng.normal() * 10;
    readings.push({ t: +t.toFixed(2), a: +(m + d / 2).toFixed(1), b: +(m - d / 2).toFixed(1) });
  }
  return readings;
}
