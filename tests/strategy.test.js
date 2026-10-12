import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Card, RANKS, evaluateHand, getStrategyTable, getRecommendedAction, shouldTakeInsurance
} from '../js/strategy.js';

const hand = (...ranks) => ({ cards: ranks.map(r => new Card(r, '♠')) });
const up = r => new Card(r, '♥');
const D_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

test('evaluateHand: ases, blackjack y bust', () => {
  assert.deepEqual(evaluateHand([new Card('A', '♠'), new Card('K', '♠')]),
    { total: 21, isSoft: true, isBlackjack: true, isBusted: false });
  assert.equal(evaluateHand([new Card('A', '♠'), new Card('A', '♥'), new Card('9', '♦')]).total, 21);
  assert.equal(evaluateHand([new Card('K', '♠'), new Card('Q', '♥'), new Card('5', '♦')]).isBusted, true);
  assert.equal(evaluateHand([new Card('A', '♠'), new Card('6', '♥')]).isSoft, true);
});

test('Hi-Lo: una baraja completa suma 0', () => {
  const total = RANKS.reduce((a, r) => a + new Card(r, '♠').hiLoValue, 0);
  assert.equal(total, 0);
});

test('S17 vs H17: celdas que cambian', () => {
  const s17 = getStrategyTable(true);
  const h17 = getStrategyTable(false);
  assert.equal(s17.hard[11].A, 'H');
  assert.equal(h17.hard[11].A, 'D');
  assert.equal(s17.soft[18][2], 'S');
  assert.equal(h17.soft[18][2], 'Ds');
  assert.equal(s17.soft[19][6], 'S');
  assert.equal(h17.soft[19][6], 'Ds');
  assert.equal(h17.hard[17].A, 'Rh');
  assert.equal(s17.hard[17].A, 'S');
});

test('getStrategyTable no muta la tabla base', () => {
  getStrategyTable(true);
  getStrategyTable(false);
  const s17 = getStrategyTable(true);
  s17.hard[11].A = 'H';
  assert.equal(getStrategyTable(false).hard[11].A, 'D');
});

test('11 vs A depende de S17/H17', () => {
  assert.equal(getRecommendedAction(hand('6', '5'), up('A'), { dealerS17: true }).action, 'H');
  assert.equal(getRecommendedAction(hand('6', '5'), up('A'), { dealerS17: false }).action, 'D');
});

test('Cada celda hard/soft/pares coincide con la tabla (sin conteo)', () => {
  for (const s17 of [true, false]) {
    const table = getStrategyTable(s17);
    const opts = { canDouble: true, canSurrender: true, dealerS17: s17 };

    for (let total = 5; total <= 20; total++) {
      const cards = total <= 11 ? ['2', String(total - 2)]
        : total === 20 ? ['10', 'Q'] : ['10', String(total - 10)];
      if (total === 5) cards[1] = '3';
      for (const d of D_RANKS) {
        const raw = table.hard[total][d];
        const expected = raw === 'D' ? 'D' : raw;
        const got = getRecommendedAction(hand(...cards), up(d), opts).action;
        assert.equal(got, expected, `hard ${total} vs ${d} (S17=${s17})`);
      }
    }

    for (let total = 13; total <= 20; total++) {
      const other = String(total - 11);
      for (const d of D_RANKS) {
        const raw = table.soft[total][d];
        const expected = raw === 'Ds' ? 'D' : raw;
        const got = getRecommendedAction(hand('A', other), up(d), opts).action;
        assert.equal(got, expected, `soft ${total} vs ${d} (S17=${s17})`);
      }
    }

    for (const [pair, row] of Object.entries(table.pairs)) {
      const rank = pair === '10' ? 'K' : pair;
      for (const d of D_RANKS) {
        const got = getRecommendedAction(hand(rank, rank), up(d), { ...opts, canSplit: true }).action;
        if (row[d] === 'P') assert.equal(got, 'P', `pair ${pair} vs ${d}`);
        else assert.notEqual(got, 'P', `pair ${pair} vs ${d} no debe dividirse`);
      }
    }
  }
});

test('Sin rendición: 16 vs 10 se pide, 17 vs A (H17) se planta', () => {
  assert.equal(getRecommendedAction(hand('10', '6'), up('10'), { canSurrender: false }).action, 'H');
  assert.equal(getRecommendedAction(hand('10', '7'), up('A'), { canSurrender: false, dealerS17: false }).action, 'S');
  assert.equal(getRecommendedAction(hand('10', '6'), up('10'), { canSurrender: true }).action, 'Rh');
});

test('Desviaciones Illustrious 18', () => {
  const noSur = { canSurrender: false };
  assert.equal(getRecommendedAction(hand('10', '6'), up('10'), { ...noSur, trueCount: 0 }).action, 'S');
  assert.equal(getRecommendedAction(hand('10', '6'), up('10'), { ...noSur, trueCount: -1 }).action, 'H');
  assert.equal(getRecommendedAction(hand('10', '6'), up('10'), { trueCount: 0 }).action, 'Rh', 'con rendición se mantiene');
  assert.equal(getRecommendedAction(hand('10', '2'), up('4'), { trueCount: -1 }).action, 'H');
  assert.equal(getRecommendedAction(hand('10', '2'), up('4'), { trueCount: 0 }).action, 'S');
  assert.equal(getRecommendedAction(hand('10', '2'), up('3'), { trueCount: 2 }).action, 'S');
  assert.equal(getRecommendedAction(hand('10', '2'), up('2'), { trueCount: 3 }).action, 'S');
  assert.equal(getRecommendedAction(hand('5', '5'), up('10'), { trueCount: 4 }).action, 'D');
  assert.equal(getRecommendedAction(hand('6', '5'), up('A'), { trueCount: 1, dealerS17: true }).deviation, true);
  assert.equal(getRecommendedAction(hand('K', 'Q'), up('6'), { canSplit: true, trueCount: 4 }).action, 'P');
  assert.equal(getRecommendedAction(hand('K', 'Q'), up('5'), { canSplit: true, trueCount: 4 }).action, 'S');
  assert.equal(getRecommendedAction(hand('K', 'Q'), up('5'), { canSplit: true, trueCount: 5 }).action, 'P');
});

test('Desviaciones de doble requieren poder doblar', () => {
  const r = getRecommendedAction(hand('5', '5'), up('10'), { canDouble: false, trueCount: 6 });
  assert.notEqual(r.action, 'D');
});

test('Seguro: solo con TC >= +3', () => {
  assert.equal(shouldTakeInsurance(3), true);
  assert.equal(shouldTakeInsurance(2.9), false);
  assert.equal(shouldTakeInsurance(null), false);
});

test('Las explicaciones no contienen cifras sin fuente conocidas', () => {
  const r = getRecommendedAction(hand('A', 'A'), up('6'), { canSplit: true });
  assert.ok(!/52%/.test(r.mathExplanation));
});
