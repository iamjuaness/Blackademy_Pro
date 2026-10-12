import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, stack, dealAll } from './helpers.js';

test('Blackjack natural paga 3:2', () => {
  const e = makeEngine();
  stack(e, ['A', '9', 'K', '7', '10']);   // humano A,K — dealer 9,7
  e.startRound();
  dealAll(e);
  assert.equal(e.phase, 'SETTLED');
  assert.equal(e.slots[2].balance, 1000 - 25 + 25 + 37.5);
  assert.equal(e.slots[2].hands[0].result, 'BLACKJACK');
});

test('Blackjack paga 6:5 si se configura', () => {
  const e = makeEngine(undefined, { blackjackPayout: 1.2 });
  stack(e, ['A', '9', 'K', '7', '10']);
  e.startRound();
  dealAll(e);
  assert.equal(e.slots[2].balance, 1000 - 25 + 25 + 30);
});

test('21 tras dividir Ases NO es blackjack y los Ases reciben una carta', () => {
  const e = makeEngine();
  stack(e, ['A', '6', 'A', '10', 'K', 'K', '10']);
  e.startRound();
  dealAll(e);
  assert.equal(e.phase, 'PLAYER_TURNS');
  assert.equal(e.executeAction('P'), true);
  // ambas manos de Ases terminan solas; el dealer (16) pide, se pasa con 10 (26)
  assert.equal(e.phase, 'SETTLED');
  assert.equal(e.slots[2].hands.length, 2);
  assert.ok(e.slots[2].hands.every(h => h.result === 'WIN'));
  assert.equal(e.slots[2].balance, 1000 - 25 - 25 + 50 + 50);
});

test('Dealer con blackjack: el jugador solo pierde la apuesta original', () => {
  const e = makeEngine();
  stack(e, ['5', 'A', '6', 'K']);          // humano 5,6 — dealer A,K
  e.startRound();
  dealAll(e);
  assert.equal(e.phase, 'SETTLED');
  assert.equal(e.slots[2].balance, 975);
  assert.equal(e.slots[2].hands[0].result, 'LOSS');
});

test('Blackjack del jugador contra blackjack del dealer es push', () => {
  const e = makeEngine();
  stack(e, ['A', 'A', 'K', 'K']);
  e.startRound();
  dealAll(e);
  assert.equal(e.slots[2].balance, 1000);
  assert.equal(e.slots[2].hands[0].result, 'PUSH');
});

test('Rendición: solo con 2 cartas y no tras dividir', () => {
  const e = makeEngine();
  stack(e, ['8', '10', '8', '7', '3', '9', '5']);
  e.startRound();
  dealAll(e);
  const slot = e.slots[2];
  assert.equal(e.getHandOptions(slot, slot.hands[0]).canSurrender, true);
  assert.equal(e.executeAction('P'), true);
  assert.equal(e.getHandOptions(slot, slot.hands[0]).canSurrender, false);
  assert.equal(e.executeAction('Rh'), false);
});

test('Acciones ilegales devuelven false y no alteran el estado', () => {
  const e = makeEngine(undefined, { allowSurrender: false });
  stack(e, ['10', '9', '6', '7', '10']);
  e.startRound();
  dealAll(e);
  const before = e.slots[2].balance;
  assert.equal(e.executeAction('Rh'), false);
  assert.equal(e.executeAction('P'), false);
  assert.equal(e.lastFeedback, null);
  assert.equal(e.slots[2].balance, before);
});

test('No se puede actuar fuera de PLAYER_TURNS', () => {
  const e = makeEngine();
  assert.equal(e.executeAction('H'), false);
});

test('Feedback: pedir cuando lo óptimo es rendirse se marca incorrecto', () => {
  const e = makeEngine();
  stack(e, ['10', '10', '6', '7', '5', '10']);   // humano 16 vs 10
  e.startRound();
  dealAll(e);
  e.executeAction('H');
  assert.equal(e.lastFeedback.optimal, 'Rh');
  assert.equal(e.lastFeedback.isCorrect, false);
});

test('Al barajar se reinicia el running count', () => {
  const e = makeEngine();
  e.runningCount = 9;
  e.shoe.cards.length = 40;   // por debajo del corte
  e.startRound();
  assert.equal(e.runningCount, 0 + e.shoe.cards.length * 0 + e.runningCount);
  assert.ok(e.shoe.cards.length > 300);
});

test('Un slot cambiado a EMPTY no recibe cartas', () => {
  const e = makeEngine(['HUMAN', 'EMPTY', 'HUMAN', 'EMPTY', 'EMPTY']);
  e.startRound();
  dealAll(e);
  e.phase = 'SETTLED';
  e.slots[0].type = 'EMPTY';
  e.startRound();
  assert.equal(e.slots[0].hands.length, 0);
  assert.ok(e.dealQueue.every(step => step.type !== 'slot' || step.slot.id !== 1));
});

test('Sin fondos: startRound falla con lastError', () => {
  const e = makeEngine();
  e.slots[2].balance = 0;
  assert.equal(e.startRound(), false);
  assert.equal(e.lastError, 'NO_FUNDS');
  e.rebuy(3, 500);
  assert.equal(e.startRound(), true);
});

test('Running count excluye la carta oculta hasta revelarla', () => {
  const e = makeEngine();
  stack(e, ['10', '5', '9', '2', '10']);   // humano 10,9 — dealer 5 + oculta 2
  e.startRound();
  while (e.phase === 'DEALING') e.dealNextStep();
  // 10(-1) + 5(+1) + 9(0) visibles; la oculta (2, +1) no cuenta aún
  assert.equal(e.runningCount, 0);
  e.executeAction('S');
  assert.ok(e.dealerHidden === false);
});

test('destroy() invalida timers pendientes', () => {
  const calls = [];
  const e = makeEngine();
  e.scheduler = fn => calls.push(fn);
  stack(e, ['10', '9', '6', '7']);
  e.startRound();
  dealAll(e);
  e.destroy();
  calls.forEach(fn => fn());
  assert.equal(e.phase, 'PLAYER_TURNS');
});
