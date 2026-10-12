import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamificationManager, WORLDS_CONFIG, isLessonPlayable, localDate, levelFromXp, HEART_REGEN_MS, HEART_REFILL_COST
} from '../js/gamification.js';

const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const mgr = (opts = {}) => new GamificationManager({}, { storage: mem(), ...opts });

function answerCorrect(g) {
  const s = g.lessonState;
  const d = s.stepData;
  switch (s.kind) {
    case 'single_recognition': return d.expectedValue;
    case 'pairs_cancellation': return d.netValue;
    case 'tc_drill': return d.trueCount;
    case 'backcounting_entry': return d.shouldEnter;
    case 'hidden_last_card': return d.expectedValue;
    case 'tray_estimation': return d.expectedDecks;
    default: return d.expectedCount;
  }
}

function clear(g, id) {
  const r = g.startLesson(id);
  assert.ok(r && !r.error, `no arrancó ${id}: ${r?.error}`);
  let res;
  for (let i = 0; i < 100; i++) {
    res = g.submitLessonAnswer(answerCorrect(g));
    if (res.finished) break;
  }
  assert.equal(res.finished, true, `no terminó ${id}`);
  return res;
}

test('localDate usa fecha local, no UTC', () => {
  assert.equal(localDate(new Date(2026, 9, 10, 23, 30)), '2026-10-10');
});

test('Progresión básica: 1-1..1-4 y se desbloquea el Mundo 2', () => {
  const g = mgr();
  ['1-1', '1-2', '1-3', '1-4'].forEach(id => clear(g, id));
  assert.ok(g.isLessonUnlocked('2-1'));
});

test('Sin tipos avanzados, la progresión salta lecciones no jugables y no se bloquea', () => {
  const g = mgr();
  ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3'].forEach(id => clear(g, id));
  assert.ok(g.isLessonUnlocked('3-1'), 'se muestra desbloqueada (Próximamente)');
  assert.ok(g.isLessonUnlocked('4-1'), 'y la siguiente jugable queda desbloqueada');
  assert.deepEqual(g.startLesson('3-1'), { error: 'NOT_IMPLEMENTED' });
});

test('Tipos avanzados: todas las lecciones del plan son completables', () => {
  const g = mgr({ advancedKinds: true });
  for (const w of WORLDS_CONFIG) {
    for (const l of w.lessons) {
      assert.ok(g.isPlayable(l), `${l.id} no jugable`);
      clear(g, l.id);
    }
  }
  assert.equal(Object.keys(g.profile.completedLessons).length, 18);
});

test('Medio mazo y mazo completo: el conteo final es coherente', () => {
  const g = mgr({ advancedKinds: true });
  g.startLesson('3-2');
  assert.equal(g.lessonState.stepData.displayCards.length, 52);
  assert.equal(g.lessonState.stepData.expectedCount, 0);
  g.startLesson('3-1');
  assert.equal(g.lessonState.stepData.displayCards.length, 26);
});

test('Naipe oculto: la respuesta es el valor Hi-Lo de la carta oculta', () => {
  const g = mgr({ advancedKinds: true });
  g.startLesson('3-3');
  const d = g.lessonState.stepData;
  const sum = d.displayCards.reduce((a, c) => a + c.hiLoValue, 0);
  assert.equal(d.expectedValue, -sum);
});

test('Errores consumen corazones y a 0 la lección termina', () => {
  const g = mgr();
  g.startLesson('1-1');
  let res;
  for (let i = 0; i < 5; i++) res = g.submitLessonAnswer(99);
  assert.equal(g.profile.hearts, 0);
  assert.equal(res.failed, true);
  assert.deepEqual(g.startLesson('1-1'), { error: 'NO_HEARTS' });
});

test('Los corazones se regeneran con el tiempo', () => {
  let now = new Date(2026, 9, 10, 10, 0, 0);
  const g = mgr({ now: () => now });
  g.startLesson('1-1');
  g.submitLessonAnswer(99);
  g.submitLessonAnswer(99);
  assert.equal(g.profile.hearts, 3);
  now = new Date(now.getTime() + HEART_REGEN_MS * 2 + 1000);
  g.regenHearts();
  assert.equal(g.profile.hearts, 5);
});

test('Rellenar corazones cuesta gemas', () => {
  const g = mgr();
  g.profile.hearts = 1;
  const gems = g.profile.gems;
  assert.equal(g.refillHearts(), true);
  assert.equal(g.profile.gems, gems - HEART_REFILL_COST);
  assert.equal(g.refillHearts(), false, 'ya está lleno');
  g.profile.hearts = 0; g.profile.gems = 0;
  assert.equal(g.refillHearts(), false, 'sin gemas');
});

test('XP: la primera vez completa; repetir da el 25%', () => {
  const g = mgr();
  clear(g, '1-1');
  assert.equal(g.profile.xp, 15);
  clear(g, '1-1');
  assert.equal(g.profile.xp, 15 + Math.round(15 * 0.25));
});

test('Racha: se rompe tras 2 días y suma al completar lección', () => {
  const day = d => () => new Date(2026, 9, d, 12, 0, 0);
  const storage = mem();
  let g = new GamificationManager({}, { storage, now: day(1) });
  clear(g, '1-1');
  assert.equal(g.profile.streakDays, 1);
  g = new GamificationManager({}, { storage, now: day(2) });
  clear(g, '1-2');
  assert.equal(g.profile.streakDays, 2);
  g = new GamificationManager({}, { storage, now: day(5) });
  assert.equal(g.profile.streakDays, 0);
});

test('Perfiles guardados con campos faltantes se completan con valores por defecto', () => {
  const storage = mem();
  storage.setItem('blackademy_gamification_v1', JSON.stringify({ xp: 40 }));
  const g = new GamificationManager({}, { storage });
  assert.equal(g.profile.xp, 40);
  assert.deepEqual(g.profile.unlockedLessons, ['1-1']);
});

test('Nivel por XP crece de forma monótona', () => {
  assert.equal(levelFromXp(0), 1);
  assert.ok(levelFromXp(500) > levelFromXp(100));
});

test('isLessonPlayable respeta el flag avanzado', () => {
  const l = WORLDS_CONFIG[2].lessons[0];
  assert.equal(isLessonPlayable(l), false);
  assert.equal(isLessonPlayable(l, true), true);
});
