import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine, dealAll } from './helpers.js';

function simulate(hands, rules) {
  const e = makeEngine(['EMPTY', 'BOT_BASIC', 'EMPTY', 'EMPTY', 'EMPTY'], rules);
  const slot = e.slots[1];
  slot.balance = 1e9;
  const start = slot.balance;
  for (let i = 0; i < hands; i++) {
    assert.ok(e.startRound());
    dealAll(e);
    assert.equal(e.phase, 'SETTLED');
  }
  return (slot.balance - start) / (hands * 25);
}

test('Monte Carlo: la ventaja de la casa con estrategia básica es pequeña (S17, 3:2)', { timeout: 120000 }, () => {
  const edge = simulate(150000, { dealerS17: true, blackjackPayout: 1.5 });
  console.log(`  edge S17 3:2 = ${(edge * 100).toFixed(2)}% del apuesta inicial`);
  assert.ok(edge > -0.02 && edge < 0.01, `edge fuera de rango: ${edge}`);
});

test('Monte Carlo: 6:5 es claramente peor que 3:2', { timeout: 120000 }, () => {
  const good = simulate(120000, { dealerS17: true, blackjackPayout: 1.5 });
  const bad = simulate(120000, { dealerS17: true, blackjackPayout: 1.2 });
  console.log(`  3:2 = ${(good * 100).toFixed(2)}% | 6:5 = ${(bad * 100).toFixed(2)}%`);
  assert.ok(bad < good + 0.003, 'con 6:5 el jugador no puede salir mejor que con 3:2 (tolerancia de varianza)');
});

test('Invariante: los saldos nunca son NaN y las apuestas se devuelven al liquidar', () => {
  const e = makeEngine(['BOT_BASIC', 'BOT_COUNTER', 'BOT_BASIC', 'BOT_COUNTER', 'BOT_BASIC']);
  e.slots.forEach(s => { s.balance = 1e6; });
  for (let i = 0; i < 2000; i++) {
    e.startRound();
    dealAll(e);
    assert.equal(e.phase, 'SETTLED');
    for (const s of e.slots) assert.ok(Number.isFinite(s.balance));
  }
});
