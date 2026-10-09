// strategy.js - Motor matemático de Estrategia Básica, EV y Desviaciones Illustrious 18

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

// Estrategia básica estándar (Multi-deck, S17 / H17, DAS)
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
  { index: 15, playerTotal: 12, isPair: false, dealer: '4', triggerTC: 0, action: 'Plantarse (S) si TC >= 0 (Pedir si negativo)' },
  { index: 16, playerTotal: 12, isPair: false, dealer: '5', triggerTC: -2, action: 'Plantarse (S) si TC >= -2' },
  { index: 17, playerTotal: 12, isPair: false, dealer: '6', triggerTC: -1, action: 'Plantarse (S) si TC >= -1' },
  { index: 18, playerTotal: 13, isPair: false, dealer: '3', triggerTC: -2, action: 'Plantarse (S) si TC >= -2' }
];

export function getRecommendedAction(hand, dealerUpCard, options = {}) {
  const { canDouble = true, canSplit = false, canSurrender = true, trueCount = null } = options;
  const dRank = dealerUpCard.value === 10 ? '10' : (dealerUpCard.rank === 'A' ? 'A' : dealerUpCard.rank);
  const cards = hand.cards;
  const evalResult = evaluateHand(cards);
  const dealerBust = DEALER_BUST_PROB[dRank] || '28%';

  let optimal = 'H';
  let reasoning = '';
  let mathExplanation = '';

  // 1. Desviaciones Illustrious 18 basadas en True Count
  if (trueCount !== null) {
    if (cards.length === 2 && cards[0].value === 10 && cards[1].value === 10 && canSplit) {
      if (dRank === '5' && trueCount >= 5) {
        return {
          action: 'P', deviation: true,
          tip: 'Desviación Ill-18: Dividir 10s vs 5 con TC >= +5.',
          mathExplanation: `Con TC >= +5 la baraja está sobrecargada de cartas altas (10s/Ases). La expectativa de formar dos manos de 20 o 21 supera matemáticamente el EV de conservar el 20 inicial (+0.71 vs +0.64).`
        };
      }
      if (dRank === '6' && trueCount >= 4) {
        return {
          action: 'P', deviation: true,
          tip: 'Desviación Ill-18: Dividir 10s vs 6 con TC >= +4.',
          mathExplanation: `El dealer con 6 tiene ~42.1% de bust. Con TC >= +4, el jugador tiene alta probabilidad de recibir otro 10 en cada mano, maximizando el valor esperado total.`
        };
      }
    }

    if (!evalResult.isSoft) {
      if (evalResult.total === 16 && dRank === '10' && trueCount >= 0) {
        return {
          action: 'S', deviation: true,
          tip: 'Desviación Ill-18: Plantarse 16 vs 10 con TC >= 0.',
          mathExplanation: `En baraja neutra o positiva (TC >= 0), la probabilidad de quiebra al pedir carta supera el 62%. El EV de pedir pasa a ser más negativo que el EV de plantarse (-0.540 vs -0.535).`
        };
      }
      if (evalResult.total === 15 && dRank === '10' && trueCount >= 4) {
        return {
          action: 'S', deviation: true,
          tip: 'Desviación Ill-18: Plantarse 15 vs 10 con TC >= +4.',
          mathExplanation: `Con abundancia extrema de cartas de valor 10 (TC >= +4), pedir con 15 causa quiebra en más del 65% de los casos. Plantarse tiene un EV ligeramente superior.`
        };
      }
      if (evalResult.total === 10 && dRank === '10' && canDouble && trueCount >= 4) {
        return {
          action: 'D', deviation: true,
          tip: 'Desviación Ill-18: Doblar 10 vs 10 con TC >= +4.',
          mathExplanation: `Normalmente no se dobla 10 vs 10. Sin embargo, con TC >= +4 la concentración de cartas altas hace que obtener 20 sea muy probable (~40%), convirtiendo el doblaje en una jugada +EV.`
        };
      }
      if (evalResult.total === 12 && dRank === '3' && trueCount >= 2) {
        return {
          action: 'S', deviation: true,
          tip: 'Desviación Ill-18: Plantarse 12 vs 3 con TC >= +2.',
          mathExplanation: `Con 12 vs 3, pedir es la jugada estándar. Pero con TC >= +2, la frecuencia de cartas de valor 10 eleva el riesgo de quiebra del jugador por encima del umbral óptimo de pedir.`
        };
      }
    }
  }

  // 2. Revisión de Parejas
  if (cards.length === 2 && cards[0].value === cards[1].value && canSplit) {
    const pairRank = cards[0].rank === 'A' ? 'A' : (cards[0].value === 10 ? '10' : cards[0].rank);
    const pAction = BASIC_STRATEGY.pairs[pairRank]?.[dRank];
    if (pAction === 'P') {
      if (pairRank === '8') {
        mathExplanation = `Un par de 8s suma 16 duro (la peor mano del juego con un EV de -0.54). Al dividir, transformas una mano perdedora en dos manos iniciales de 8 con expectativa de alcanzar 18.`;
      } else if (pairRank === 'A') {
        mathExplanation = `Un par de Ases suma 2 o 12 suave. Al dividirlos, creas dos manos independientes con 52% de probabilidad de recibir una carta de valor 10 para completar 21.`;
      } else {
        mathExplanation = `La carta visible del repartidor (${dRank}) le otorga una tasa de quiebra estimada de ${dealerBust}. Dividir optimiza las probabilidades combinadas de ambas manos frente a la debilidad del dealer.`;
      }
      return {
        action: 'P',
        deviation: false,
        tip: `Estrategia Básica: Dividir par de ${pairRank}s frente al ${dRank} del dealer.`,
        mathExplanation
      };
    }
  }

  // 3. Revisión de Manos Suaves (Soft totals)
  if (evalResult.isSoft && evalResult.total <= 20) {
    let sAction = BASIC_STRATEGY.soft[evalResult.total]?.[dRank] || 'H';
    if (sAction === 'Ds') {
      optimal = canDouble ? 'D' : 'S';
      reasoning = canDouble ? 'Doblar mano suave con ventaja estadística (o Plantarse).' : 'Plantarse con mano suave lograda.';
      mathExplanation = `Con ${evalResult.total} suave frente al ${dRank} (probabilidad de quiebra del dealer: ${dealerBust}), el jugador tiene 'red de seguridad' (el As puede valer 1) y un EV positivo al duplicar el monto apostado.`;
    } else if (sAction === 'D') {
      optimal = canDouble ? 'D' : 'H';
      reasoning = canDouble ? 'Doblar mano suave favorable frente al dealer.' : 'Pedir carta adicional.';
      mathExplanation = `El valor suave ${evalResult.total} permite doblar sin riesgo de pasarse en el primer naipe. Si el doblaje no está permitido, pedir mantiene expectativa positiva.`;
    } else {
      optimal = sAction;
      reasoning = optimal === 'S' ? 'Plantarse para proteger valor alto suave.' : 'Pedir carta sin riesgo de quiebra.';
      mathExplanation = optimal === 'S'
        ? `Un total de ${evalResult.total} suave es suficientemente fuerte frente al ${dRank} del dealer. Pedir arriesgaría degradar la mano.`
        : `Pedir con mano suave inferior a 18 tiene 0% de probabilidad de quiebra inmediata y permite buscar un total competitivo de 18 a 21.`;
    }
    return {
      action: optimal,
      deviation: false,
      tip: `Estrategia Básica: ${reasoning}`,
      mathExplanation
    };
  }

  // 4. Manos Duras (Hard totals)
  const hTotal = Math.min(Math.max(evalResult.total, 5), 20);
  let hAction = BASIC_STRATEGY.hard[hTotal]?.[dRank] || (evalResult.total >= 17 ? 'S' : 'H');

  if (hAction === 'D') {
    optimal = canDouble ? 'D' : 'H';
    reasoning = canDouble ? `Doblar ${hTotal} frente al ${dRank} del dealer por expectativa positiva (+EV).` : 'Pedir carta (doblar no disponible).';
    mathExplanation = `Con total de ${hTotal}, hay un 30.8% de probabilidad de ligar un 10 para llegar a 19-21. Contra un dealer mostrando ${dRank} (quiebra: ${dealerBust}), duplicar la apuesta maximiza el beneficio a largo plazo.`;
  } else if (hAction === 'Rh') {
    optimal = canSurrender ? 'Rh' : 'H';
    reasoning = canSurrender ? `Rendirse con ${hTotal} vs ${dRank} minimiza la pérdida esperada a la mitad.` : 'Pedir carta con mano débil.';
    mathExplanation = `Con 15 o 16 frente a cartas fuertes (9, 10, A), el EV de jugar la mano es de -0.53 a -0.54. Rendirse asegura un EV de exactamente -0.50, ahorrando 3 a 4 centavos por dólar apostado.`;
  } else {
    optimal = hAction;
    const playerBust = PLAYER_BUST_RISK_ON_HIT[evalResult.total] || 'Riesgo alto';
    if (optimal === 'S') {
      reasoning = `Plantarse con ${hTotal} ante la debilidad del dealer (${dRank}).`;
      mathExplanation = `Pedir con ${hTotal} tiene un riesgo de quiebra propio de ${playerBust}. Como el dealer muestra ${dRank} con probabilidad de quiebra de ${dealerBust}, es más rentable dejar que el dealer asuma el riesgo de superar 21.`;
    } else {
      reasoning = `Pedir carta para mejorar total de ${hTotal}.`;
      mathExplanation = `El dealer muestra una carta fuerte (${dRank}, solo ${dealerBust} de quiebra). Plantarse con ${hTotal} pierde en más del 70% de las ocasiones. Pedir es obligatorio a pesar del riesgo de quiebra.`;
    }
  }

  return {
    action: optimal,
    deviation: false,
    tip: `Estrategia Básica: ${reasoning}`,
    mathExplanation
  };
}
