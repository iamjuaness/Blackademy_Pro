// strategy.js - Estrategia básica por reglas (S17/H17), desviaciones Illustrious 18 y evaluación de manos
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['♠', '♥', '♦', '♣'];

export const HI_LO_VALUES = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
};

export const DEALER_BUST_PROB = {
  '2': '35.3%', '3': '37.5%', '4': '40.2%', '5': '42.9%', '6': '42.1%',
  '7': '26.0%', '8': '23.8%', '9': '23.3%', '10': '21.4%', 'A': '11.6%'
};

export const PLAYER_BUST_RISK_ON_HIT = {
  12: '30.8% (4/13 cartas: 10, J, Q, K)',
  13: '38.5% (5/13 cartas: 9, 10, J, Q, K)',
  14: '46.2% (6/13 cartas: 8 a K)',
  15: '53.8% (7/13 cartas: 7 a K)',
  16: '61.5% (8/13 cartas: 6 a K)',
  17: '69.2% (9/13 cartas: 5 a K)',
  18: '76.9% (10/13 cartas: 4 a K)',
  19: '84.6% (11/13 cartas: 3 a K)',
  20: '92.3% (12/13 cartas: 2 a K)'
};

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }
  get value() {
    if (['J', 'Q', 'K'].includes(this.rank)) return 10;
    if (this.rank === 'A') return 11;
    return parseInt(this.rank, 10);
  }
  get hiLoValue() {
    return HI_LO_VALUES[this.rank];
  }
  get isRed() {
    return this.suit === '♥' || this.suit === '♦';
  }
}

export function evaluateHand(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const isSoft = aces > 0 && total <= 21;
  const isBlackjack = cards.length === 2 && total === 21;
  const isBusted = total > 21;
  return { total, isSoft, isBlackjack, isBusted };
}

// Tabla base (multi-mazo, DAS, rendición tardía). Se deriva por reglas con getStrategyTable().
export const BASIC_STRATEGY = {
  hard: {
    5:  { 2:'H', 3:'H', 4:'H', 5:'H', 6:'H', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    6:  { 2:'H', 3:'H', 4:'H', 5:'H', 6:'H', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    7:  { 2:'H', 3:'H', 4:'H', 5:'H', 6:'H', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    8:  { 2:'H', 3:'H', 4:'H', 5:'H', 6:'H', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    9:  { 2:'H', 3:'D', 4:'D', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    10: { 2:'D', 3:'D', 4:'D', 5:'D', 6:'D', 7:'D', 8:'D', 9:'D', 10:'H', A:'H' },
    11: { 2:'D', 3:'D', 4:'D', 5:'D', 6:'D', 7:'D', 8:'D', 9:'D', 10:'D', A:'D' },
    12: { 2:'H', 3:'H', 4:'S', 5:'S', 6:'S', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    13: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    14: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    15: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'H', 8:'H', 9:'H', 10:'Rh', A:'H' },
    16: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'H', 8:'H', 9:'Rh', 10:'Rh', A:'Rh' },
    17: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' },
    18: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' },
    19: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' },
    20: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' }
  },
  soft: {
    13: { 2:'H', 3:'H', 4:'H', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    14: { 2:'H', 3:'H', 4:'H', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    15: { 2:'H', 3:'H', 4:'D', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    16: { 2:'H', 3:'H', 4:'D', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    17: { 2:'H', 3:'D', 4:'D', 5:'D', 6:'D', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    18: { 2:'Ds', 3:'Ds', 4:'Ds', 5:'Ds', 6:'Ds', 7:'S', 8:'S', 9:'H', 10:'H', A:'H' },
    19: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'Ds', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' },
    20: { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' }
  },
  pairs: {
    '2':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'P', 8:'H', 9:'H', 10:'H', A:'H' },
    '3':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'P', 8:'H', 9:'H', 10:'H', A:'H' },
    '4':  { 2:'H', 3:'H', 4:'H', 5:'P', 6:'P', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    '5':  { 2:'D', 3:'D', 4:'D', 5:'D', 6:'D', 7:'D', 8:'D', 9:'D', 10:'H', A:'H' },
    '6':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'H', 8:'H', 9:'H', 10:'H', A:'H' },
    '7':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'P', 8:'H', 9:'H', 10:'H', A:'H' },
    '8':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'P', 8:'P', 9:'P', 10:'P', A:'P' },
    '9':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'S', 8:'P', 9:'P', 10:'S', A:'S' },
    '10': { 2:'S', 3:'S', 4:'S', 5:'S', 6:'S', 7:'S', 8:'S', 9:'S', 10:'S', A:'S' },
    'A':  { 2:'P', 3:'P', 4:'P', 5:'P', 6:'P', 7:'P', 8:'P', 9:'P', 10:'P', A:'P' }
  }
};

const TABLE_CACHE = {};

// S17: 11 vs A = pedir; A,7 vs 2 = plantarse; A,8 vs 6 = plantarse.
// H17: igual que la base, más rendición con 15 y 17 duros vs A.
export function getStrategyTable(dealerS17 = true) {
  const key = dealerS17 ? 'S17' : 'H17';
  if (!TABLE_CACHE[key]) {
    const t = JSON.parse(JSON.stringify(BASIC_STRATEGY));
    if (dealerS17) {
      t.hard[11].A = 'H';
      t.soft[18][2] = 'S';
      t.soft[19][6] = 'S';
    } else {
      t.hard[15].A = 'Rh';
      t.hard[17].A = 'Rh';
    }
    TABLE_CACHE[key] = t;
  }
  return TABLE_CACHE[key];
}

export const INSURANCE_INDEX = 3;
export function shouldTakeInsurance(trueCount) {
  return trueCount !== null && trueCount !== undefined && trueCount >= INSURANCE_INDEX;
}

// Lista de visualización (compatible con la tabla de la UI)
export const ILLUSTRIOUS_18 = [
  { index: 1, hand: 'Seguro / Even Money', dealer: 'A', triggerTC: 3, action: 'Tomar Seguro si TC >= +3' },
  { index: 2, playerTotal: 16, isPair: false, dealer: '10', triggerTC: 0, action: 'Plantarse (S) si TC >= 0 (en vez de Hit)' },
  { index: 3, playerTotal: 15, isPair: false, dealer: '10', triggerTC: 4, action: 'Plantarse (S) si TC >= +4 (en vez de Hit)' },
  { index: 4, isPair: true, pairRank: '10', dealer: '5', triggerTC: 5, action: 'Dividir (P) si TC >= +5 (en vez de Stand)' },
  { index: 5, isPair: true, pairRank: '10', dealer: '6', triggerTC: 4, action: 'Dividir (P) si TC >= +4 (en vez de Stand)' },
  { index: 6, playerTotal: 10, isPair: false, dealer: '10', triggerTC: 4, action: 'Doblar (D) si TC >= +4 (en vez de Hit)' },
  { index: 7, playerTotal: 12, isPair: false, dealer: '3', triggerTC: 2, action: 'Plantarse (S) si TC >= +2 (en vez de Hit)' },
  { index: 8, playerTotal: 12, isPair: false, dealer: '2', triggerTC: 3, action: 'Plantarse (S) si TC >= +3 (en vez de Hit)' },
  { index: 9, playerTotal: 11, isPair: false, dealer: 'A', triggerTC: 1, action: 'Doblar (D) si TC >= +1 (en S17)' },
  { index: 10, playerTotal: 9, isPair: false, dealer: '2', triggerTC: 1, action: 'Doblar (D) si TC >= +1 (en vez de Hit)' },
  { index: 11, playerTotal: 10, isPair: false, dealer: 'A', triggerTC: 4, action: 'Doblar (D) si TC >= +4 (en vez de Hit)' },
  { index: 12, playerTotal: 9, isPair: false, dealer: '7', triggerTC: 3, action: 'Doblar (D) si TC >= +3 (en vez de Hit)' },
  { index: 13, playerTotal: 16, isPair: false, dealer: '9', triggerTC: 5, action: 'Plantarse (S) si TC >= +5 (en vez de Hit)' },
  { index: 14, playerTotal: 13, isPair: false, dealer: '2', triggerTC: -1, action: 'Pedir (H) si TC < -1 (en vez de Stand)' },
  { index: 15, playerTotal: 12, isPair: false, dealer: '4', triggerTC: 0, action: 'Pedir (H) si TC < 0 (en vez de Stand)' },
  { index: 16, playerTotal: 12, isPair: false, dealer: '5', triggerTC: -2, action: 'Pedir (H) si TC < -2 (en vez de Stand)' },
  { index: 17, playerTotal: 12, isPair: false, dealer: '6', triggerTC: -1, action: 'Pedir (H) si TC < -1 (en vez de Stand)' },
  { index: 18, playerTotal: 13, isPair: false, dealer: '3', triggerTC: -2, action: 'Pedir (H) si TC < -2 (en vez de Stand)' }
];

// Motor de desviaciones (dir 'gte': aplica si TC >= tc; 'lt': aplica si TC < tc).
// needsNoSurrender: con rendición disponible, la jugada base (rendirse) se mantiene.
export const DEVIATIONS = [
  { index: 2,  total: 16, dealer: '10', tc: 0,  dir: 'gte', action: 'S', needsNoSurrender: true },
  { index: 3,  total: 15, dealer: '10', tc: 4,  dir: 'gte', action: 'S', needsNoSurrender: true },
  { index: 6,  total: 10, dealer: '10', tc: 4,  dir: 'gte', action: 'D' },
  { index: 7,  total: 12, dealer: '3',  tc: 2,  dir: 'gte', action: 'S' },
  { index: 8,  total: 12, dealer: '2',  tc: 3,  dir: 'gte', action: 'S' },
  { index: 9,  total: 11, dealer: 'A',  tc: 1,  dir: 'gte', action: 'D', s17Only: true },
  { index: 10, total: 9,  dealer: '2',  tc: 1,  dir: 'gte', action: 'D' },
  { index: 11, total: 10, dealer: 'A',  tc: 4,  dir: 'gte', action: 'D' },
  { index: 12, total: 9,  dealer: '7',  tc: 3,  dir: 'gte', action: 'D' },
  { index: 13, total: 16, dealer: '9',  tc: 5,  dir: 'gte', action: 'S', needsNoSurrender: true },
  { index: 14, total: 13, dealer: '2',  tc: -1, dir: 'lt',  action: 'H' },
  { index: 15, total: 12, dealer: '4',  tc: 0,  dir: 'lt',  action: 'H' },
  { index: 16, total: 12, dealer: '5',  tc: -2, dir: 'lt',  action: 'H' },
  { index: 17, total: 12, dealer: '6',  tc: -1, dir: 'lt',  action: 'H' },
  { index: 18, total: 13, dealer: '3',  tc: -2, dir: 'lt',  action: 'H' }
];

export const PAIR_DEVIATIONS = [
  { index: 4, pair: '10', dealer: '5', tc: 5, action: 'P' },
  { index: 5, pair: '10', dealer: '6', tc: 4, action: 'P' }
];

function findDeviation(total, dRank, trueCount, { canDouble, canSurrender, dealerS17 }) {
  for (const d of DEVIATIONS) {
    if (d.total !== total || d.dealer !== dRank) continue;
    if (d.needsNoSurrender && canSurrender) continue;
    if (d.s17Only && !dealerS17) continue;
    if (d.action === 'D' && !canDouble) continue;
    const hit = d.dir === 'gte' ? trueCount >= d.tc : trueCount < d.tc;
    if (hit) return d;
  }
  return null;
}

const ACTION_NAMES = { H: 'Pedir', S: 'Plantarse', D: 'Doblar', P: 'Dividir', Rh: 'Rendirse' };

export function getRecommendedAction(hand, dealerUpCard, options = {}) {
  const {
    canDouble = true, canSplit = false, canSurrender = true,
    trueCount = null, dealerS17 = true
  } = options;
  const dRank = dealerUpCard.value === 10 ? '10' : (dealerUpCard.rank === 'A' ? 'A' : dealerUpCard.rank);
  const cards = hand.cards;
  const ev = evaluateHand(cards);
  const dealerBust = DEALER_BUST_PROB[dRank] || '28%';
  const table = getStrategyTable(dealerS17);
  const isPairHand = cards.length === 2 && cards[0].value === cards[1].value;

  // 1. Desviaciones por True Count
  if (trueCount !== null && trueCount !== undefined) {
    if (isPairHand && canSplit && cards[0].value === 10) {
      const pd = PAIR_DEVIATIONS.find(p => p.dealer === dRank && trueCount >= p.tc);
      if (pd) {
        return {
          action: 'P', deviation: true, index: pd.index,
          tip: `Desviación Ill-18 #${pd.index}: dividir 10s vs ${dRank} con TC >= +${pd.tc}.`,
          mathExplanation: `Con TC >= +${pd.tc} el zapato está rico en cartas de valor 10. Dos manos que parten de un 10 tienen más valor esperado que conservar el 20, aunque la ganancia es pequeña y la varianza alta.`
        };
      }
    }
    if (!ev.isSoft) {
      const d = findDeviation(ev.total, dRank, trueCount, { canDouble, canSurrender, dealerS17 });
      if (d) {
        return {
          action: d.action, deviation: true, index: d.index,
          tip: `Desviación Ill-18 #${d.index}: ${ACTION_NAMES[d.action]} ${ev.total} vs ${dRank} con TC ${d.dir === 'gte' ? '>=' : '<'} ${d.tc > 0 ? '+' : ''}${d.tc}.`,
          mathExplanation: `Cuando el True Count cruza ${d.tc > 0 ? '+' : ''}${d.tc}, la composición del zapato cambia lo suficiente para que ${ACTION_NAMES[d.action].toLowerCase()} supere la jugada de estrategia básica.`
        };
      }
    }
  }

  // 2. Parejas
  if (isPairHand && canSplit) {
    const pairRank = cards[0].rank === 'A' ? 'A' : (cards[0].value === 10 ? '10' : cards[0].rank);
    if (table.pairs[pairRank]?.[dRank] === 'P') {
      let mathExplanation;
      if (pairRank === '8') {
        mathExplanation = 'Un par de 8s es un 16 duro, la peor mano inicial. Al dividir conviertes una mano muy perdedora en dos manos que parten de 8 y pierden menos en conjunto.';
      } else if (pairRank === 'A') {
        mathExplanation = 'Dos Ases dividen un 12 débil en dos manos que parten de 11 puntos. Un 10 (30.8% de las cartas) les da 21 directo.';
      } else {
        mathExplanation = `El dealer muestra ${dRank} y se pasa aproximadamente ${dealerBust} de las veces. Dividir aprovecha esa debilidad con dos manos.`;
      }
      return { action: 'P', deviation: false, tip: `Estrategia Básica: dividir par de ${pairRank}s vs ${dRank}.`, mathExplanation };
    }
  }

  // 3. Manos suaves
  if (ev.isSoft && ev.total <= 20) {
    const sAction = table.soft[ev.total]?.[dRank] || 'H';
    let optimal, reasoning, mathExplanation;
    if (sAction === 'Ds') {
      optimal = canDouble ? 'D' : 'S';
      reasoning = canDouble ? 'Doblar mano suave (si no puedes, plantarse).' : 'Plantarse con mano suave fuerte.';
      mathExplanation = `Un ${ev.total} suave no se puede pasar con una carta. Contra ${dRank} (bust del dealer ${dealerBust}) conviene doblar.`;
    } else if (sAction === 'D') {
      optimal = canDouble ? 'D' : 'H';
      reasoning = canDouble ? 'Doblar mano suave favorable.' : 'Pedir carta (doblar no disponible).';
      mathExplanation = `Con ${ev.total} suave no hay riesgo de pasarse en la primera carta; contra ${dRank} el doble tiene valor esperado positivo frente a pedir.`;
    } else {
      optimal = sAction;
      reasoning = optimal === 'S' ? 'Plantarse con mano suave alta.' : 'Pedir carta con mano suave.';
      mathExplanation = optimal === 'S'
        ? `Un ${ev.total} suave ya es competitivo contra ${dRank}; pedir arriesga empeorarlo.`
        : `Un ${ev.total} suave contra ${dRank} es demasiado débil para plantarse y no se pasa al pedir.`;
    }
    return { action: optimal, deviation: false, tip: `Estrategia Básica: ${reasoning}`, mathExplanation };
  }

  // 4. Manos duras
  const hTotal = Math.min(Math.max(ev.total, 5), 20);
  const hAction = table.hard[hTotal]?.[dRank] || (ev.total >= 17 ? 'S' : 'H');
  let optimal, reasoning, mathExplanation;

  if (hAction === 'D') {
    optimal = canDouble ? 'D' : 'H';
    reasoning = canDouble ? `Doblar ${hTotal} vs ${dRank}.` : 'Pedir carta (doblar no disponible).';
    mathExplanation = `Con ${hTotal}, la próxima carta suele dejarte en un total fuerte (un 10 aparece en 30.8% de los casos). Contra ${dRank} (bust ${dealerBust}) doblar rinde más que pedir.`;
  } else if (hAction === 'Rh') {
    optimal = canSurrender ? 'Rh' : (ev.total >= 17 ? 'S' : 'H');
    reasoning = canSurrender ? `Rendirse con ${hTotal} vs ${dRank}.` : (optimal === 'S' ? 'Plantarse.' : 'Pedir carta (rendición no disponible).');
    mathExplanation = 'Con 15-16 contra una carta fuerte, jugar la mano pierde en promedio más de la mitad de la apuesta; rendirse pierde exactamente la mitad.';
  } else if (hAction === 'S') {
    optimal = 'S';
    reasoning = `Plantarse con ${hTotal} vs ${dRank}.`;
    const bustRisk = PLAYER_BUST_RISK_ON_HIT[ev.total] || 'alto';
    mathExplanation = ev.total >= 17
      ? `Con ${hTotal} ya tienes una mano sólida; pedir te pasaría con probabilidad ${bustRisk}.`
      : `Con ${hTotal} pedir te pasa ${bustRisk}. El dealer muestra ${dRank} y se pasa ${dealerBust}: deja que sea él quien arriesgue.`;
  } else {
    optimal = 'H';
    reasoning = `Pedir carta con ${hTotal} vs ${dRank}.`;
    mathExplanation = ev.total <= 11
      ? `Con ${hTotal} no puedes pasarte con una carta, así que pedir solo puede mejorar la mano.`
      : `Contra ${dRank} el dealer se pasa solo ${dealerBust}; con ${hTotal} plantarse pierde más veces de las que se compensa con el riesgo de pasarte (${PLAYER_BUST_RISK_ON_HIT[ev.total] || 'alto'}).`;
  }

  return { action: optimal, deviation: false, tip: `Estrategia Básica: ${reasoning}`, mathExplanation };
}
