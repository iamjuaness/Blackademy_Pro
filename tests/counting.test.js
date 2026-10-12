import test from 'node:test';
import assert from 'node:assert/strict';
import { CountingTrainer } from '../js/counting.js';

function ready(rc = 3) {
  const t = new CountingTrainer();
  t.runningCount = rc;
  t.deck = new Array(52).fill(null);
  t.awaitingAnswer = true;
  return t;
}

test('Entrada inválida no cuenta como intento', () => {
  const t = ready();
  assert.deepEqual(t.submitAnswer('abc'), { invalid: true });
  assert.equal(t.stats.drillsCompleted, 0);
  assert.equal(t.awaitingAnswer, true);
});

test('No se puede enviar dos veces la misma respuesta', () => {
  const t = ready();
  assert.ok(t.submitAnswer('3'));
  assert.equal(t.submitAnswer('3'), null);
  assert.equal(t.stats.drillsCompleted, 1);
});

test('Racha y nivel progresivo', () => {
  const t = ready(2);
  const r = t.submitAnswer('2');
  assert.equal(r.correct, true);
  assert.equal(t.stats.currentStreak, 1);
  assert.equal(t.level, 2);
  t.awaitingAnswer = true;
  t.submitAnswer('99');
  assert.equal(t.stats.currentStreak, 0);
});

test('Consejo de apuesta: TC entre 1 y 2 no es "agresivo"', () => {
  const t = new CountingTrainer();
  assert.match(t.getBetAdvice(0.5), /mínima/);
  assert.match(t.getBetAdvice(1.5), /1 unidad/);
  assert.match(t.getBetAdvice(3.2), /3 unidades/);
  assert.match(t.getBetAdvice(9), /6 unidades/);
});

test('TC estimado usa los mazos restantes reales', () => {
  const t = ready(6);
  t.deck = new Array(104).fill(null);   // 2 mazos restantes
  assert.equal(t.submitAnswer('6').tcEstimate, 3);
});

test('Modo parejas fuerza lote par', () => {
  const t = new CountingTrainer();
  t.start({ mode: 'pairs', batchSize: 7, speedMs: 100000 });
  assert.equal(t.batchSize, 8);
  t.stop();
});
