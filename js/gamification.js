// js/gamification.js - Gamificación pedagógica para conteo Hi-Lo
import { Card, RANKS, SUITS } from './strategy.js';
import { sounds } from './audio.js';

export const WORLDS_CONFIG = [
  {
    id: 1,
    title: 'Mundo 1: Valores Hi-Lo Básicos',
    description: 'Automatiza el valor de cada carta (+1, 0, -1) hasta que sea un reflejo visual.',
    lessons: [
      { id: '1-1', title: 'Cartas Bajas (+1)', type: 'single_recognition', ranks: ['2', '3', '4', '5', '6'], countTarget: 10, xp: 15 },
      { id: '1-2', title: 'Cartas Neutras (0)', type: 'single_recognition', ranks: ['7', '8', '9'], countTarget: 10, xp: 15 },
      { id: '1-3', title: 'Cartas Altas (-1)', type: 'single_recognition', ranks: ['10', 'J', 'Q', 'K', 'A'], countTarget: 10, xp: 15 },
      { id: '1-4', title: 'Evaluación Mixta', type: 'mixed_speed', totalCards: 20, speedMs: 900, xp: 30 }
    ]
  },
  {
    id: 2,
    title: 'Mundo 2: Cancelación Visual de Parejas',
    description: 'Anula al instante las combinaciones neutralizantes (+1 y -1) como cero neto.',
    lessons: [
      { id: '2-1', title: 'Pares Directos (+1 con -1)', type: 'pairs_cancellation', pairsTarget: 8, xp: 20 },
      { id: '2-2', title: 'Manos de Jugador (2 Cartas)', type: 'hand_total_count', handsTarget: 10, xp: 25 },
      { id: '2-3', title: 'Ráfaga de Mesa Rápida', type: 'pairs_speed', pairsTarget: 15, speedMs: 800, xp: 35 }
    ]
  },
  {
    id: 3,
    title: 'Mundo 3: Running Count en 1 Mazo (52 Cartas)',
    description: 'Cuenta la baraja completa de principio a fin. El conteo final debe dar exactamente 0.',
    lessons: [
      { id: '3-1', title: 'Medio Mazo (26 Cartas)', type: 'deck_run', decks: 0.5, speedMs: 1000, xp: 30 },
      { id: '3-2', title: 'Mazo Completo (Paso Controlado)', type: 'deck_run', decks: 1, speedMs: 850, xp: 50 },
      { id: '3-3', title: 'El Naipe Oculto (Test Maestro)', type: 'hidden_last_card', decks: 1, speedMs: 700, xp: 60 }
    ]
  },
  {
    id: 4,
    title: 'Mundo 4: Conversión al True Count (TC)',
    description: 'Ajusta el Running Count según los mazos restantes visibles en la bandeja de descarte.',
    lessons: [
      { id: '4-1', title: 'División Entera Directa', type: 'tc_drill', mode: 'exact_integers', questions: 8, xp: 30 },
      { id: '4-2', title: 'Medios Mazos y Fracciones', type: 'tc_drill', mode: 'fractions', questions: 10, xp: 40 },
      { id: '4-3', title: 'Estimación Visual de Descarte', type: 'tray_estimation', questions: 8, xp: 50 }
    ]
  },
  {
    id: 5,
    title: 'Mundo 5: Multibaraja en Casino Real (6 y 8 Mazos)',
    description: 'Soporta el ritmo real de un crupier profesional con 5 jugadores en mesa.',
    lessons: [
      { id: '5-1', title: 'Ronda de 5 Jugadores', type: 'table_round', players: 5, speedMs: 750, xp: 40 },
      { id: '5-2', title: 'Zapato Completo (6 Mazos)', type: 'shoe_run', decks: 6, maxRounds: 8, xp: 60 },
      { id: '5-3', title: 'Simulación de Ruido y Apuestas', type: 'casino_pressure', decks: 6, xp: 80 }
    ]
  },
  {
    id: 6,
    title: 'Mundo 6: Incursión en Caliente (Wonging & Salto de Mesa)',
    description: 'Ingresa a mesas ya iniciadas, calcula el momento justo de apuesta y retírate ante números fríos.',
    lessons: [
      { id: '6-1', title: 'Auditoría de Mesa en Curso', type: 'backcounting_entry', roundsObserve: 3, xp: 50 },
      { id: '6-2', title: 'Decisión de Entrada (+EV)', type: 'wonging_decision', scenarios: 10, xp: 70 },
      { id: '6-3', title: 'Graduación: Pit Boss Audit', type: 'master_exam', xp: 150 }
    ]
  }
];

// ---------- Tipos de lección ----------
const TYPE_ALIAS = {
  mixed_speed: 'single_recognition',
  hand_total_count: 'pairs_cancellation',
  pairs_speed: 'pairs_cancellation',
  wonging_decision: 'backcounting_entry',
  casino_pressure: 'shoe_run'
};
// Tipos con renderer sencillo (carta/par/número/sí-no).
const BASE_KINDS = new Set(['single_recognition', 'pairs_cancellation', 'tc_drill', 'backcounting_entry']);
// Tipos con secuencias de cartas: requieren que la UI muestre stepData.displayCards.
const ADVANCED_KINDS = new Set(['deck_run', 'hidden_last_card', 'tray_estimation', 'table_round', 'shoe_run', 'master_exam']);

export const kindOf = l => TYPE_ALIAS[l.type] || l.type;
export const isLessonPlayable = (l, advanced = false) =>
  BASE_KINDS.has(kindOf(l)) || (advanced && ADVANCED_KINDS.has(kindOf(l)));

export function targetOf(l) {
  const kind = kindOf(l);
  if (kind === 'deck_run' || kind === 'hidden_last_card') return 1;
  if (kind === 'table_round') return 3;
  if (kind === 'shoe_run') return l.maxRounds || 6;
  if (kind === 'master_exam') return 15;
  return l.countTarget || l.pairsTarget || l.handsTarget || l.totalCards || l.questions || l.scenarios || 5;
}

export const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const levelFromXp = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;

export const HEART_REGEN_MS = 30 * 60 * 1000;
export const HEART_REFILL_COST = 30;
const STORAGE_KEY = 'blackademy_gamification_v1';

function memoryStorage() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

function shuffledDeck(decks = 1) {
  const cards = [];
  for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push(new Card(r, s));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}
const sumHiLo = cards => cards.reduce((a, c) => a + c.hiLoValue, 0);

export class GamificationManager {
  constructor(callbacks = {}, options = {}) {
    this.onStateChange = callbacks.onStateChange || (() => {});
    this.onLessonComplete = callbacks.onLessonComplete || (() => {});
    this.storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : memoryStorage());
    this.now = options.now || (() => new Date());
    this.advancedKinds = options.advancedKinds ?? false;

    this.profile = this.loadProfile();
    this.activeLesson = null;
    this.lessonState = null;
  }

  defaultProfile() {
    return {
      xp: 0,
      gems: 100,
      hearts: 5,
      maxHearts: 5,
      heartsUpdatedAt: null,
      streakDays: 0,
      lastActiveDate: localDate(this.now()),
      unlockedLessons: ['1-1'],
      completedLessons: {},
      worldProgress: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    };
  }

  loadProfile() {
    const base = this.defaultProfile();
    try {
      const saved = this.storage.getItem(STORAGE_KEY);
      if (saved) {
        const profile = { ...base, ...JSON.parse(saved) };
        this.checkStreak(profile);
        this.regenHearts(profile);
        return profile;
      }
    } catch (e) {
      console.error('Error parseando perfil de gamificación:', e);
    }
    return base;
  }

  saveProfile() {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch (e) {
      console.warn('No se pudo guardar el perfil:', e);
    }
    this.onStateChange(this.profile);
  }

  checkStreak(profile) {
    const today = localDate(this.now());
    if (profile.lastActiveDate === today) return;
    const toDay = s => {
      const [y, m, d] = s.split('-').map(Number);
      return Date.UTC(y, m - 1, d) / 86400000;
    };
    if (toDay(today) - toDay(profile.lastActiveDate) > 1) profile.streakDays = 0;
  }

  registerActivity() {
    const today = localDate(this.now());
    if (this.profile.lastActiveDate !== today || this.profile.streakDays === 0) {
      this.profile.streakDays += 1;
      this.profile.lastActiveDate = today;
    }
  }

  regenHearts(profile = this.profile) {
    if (profile.hearts >= profile.maxHearts) {
      profile.heartsUpdatedAt = null;
      return false;
    }
    const nowMs = this.now().getTime();
    if (!profile.heartsUpdatedAt) {
      profile.heartsUpdatedAt = nowMs;
      return false;
    }
    const gained = Math.floor((nowMs - profile.heartsUpdatedAt) / HEART_REGEN_MS);
    if (gained <= 0) return false;
    profile.hearts = Math.min(profile.maxHearts, profile.hearts + gained);
    profile.heartsUpdatedAt = profile.hearts >= profile.maxHearts ? null : profile.heartsUpdatedAt + gained * HEART_REGEN_MS;
    return true;
  }

  consumeHeart() {
    if (this.profile.hearts > 0) {
      if (this.profile.hearts === this.profile.maxHearts) this.profile.heartsUpdatedAt = this.now().getTime();
      this.profile.hearts--;
      this.saveProfile();
    }
  }

  // Cuesta gemas. Devuelve true si se pudo rellenar.
  refillHearts() {
    if (this.profile.hearts >= this.profile.maxHearts) return false;
    if (this.profile.gems < HEART_REFILL_COST) return false;
    this.profile.gems -= HEART_REFILL_COST;
    this.profile.hearts = this.profile.maxHearts;
    this.profile.heartsUpdatedAt = null;
    this.saveProfile();
    return true;
  }

  isLessonUnlocked(lessonId) {
    return this.profile.unlockedLessons.includes(lessonId);
  }

  isPlayable(lesson) {
    return isLessonPlayable(lesson, this.advancedKinds);
  }

  // Desbloquea la siguiente lección jugable (las no jugables en medio se marcan desbloqueadas para mostrarse como "Próximamente").
  unlockNextLesson(currentLessonId) {
    const all = WORLDS_CONFIG.flatMap(w => w.lessons);
    const idx = all.findIndex(l => l.id === currentLessonId);
    for (let j = idx + 1; idx !== -1 && j < all.length; j++) {
      if (!this.profile.unlockedLessons.includes(all[j].id)) this.profile.unlockedLessons.push(all[j].id);
      if (this.isPlayable(all[j])) break;
    }
    this.saveProfile();
  }

  startLesson(lessonId, callbacks = {}) {
    let foundLesson = null;
    let foundWorld = null;
    for (const w of WORLDS_CONFIG) {
      const match = w.lessons.find(l => l.id === lessonId);
      if (match) { foundLesson = match; foundWorld = w; break; }
    }
    if (!foundLesson) return null;
    if (!this.isPlayable(foundLesson)) return { error: 'NOT_IMPLEMENTED' };

    this.regenHearts();
    if (this.profile.hearts <= 0) return { error: 'NO_HEARTS' };

    this.activeLesson = foundLesson;
    this.lessonState = {
      worldId: foundWorld.id,
      lessonId: foundLesson.id,
      progress: 0,
      mistakes: 0,
      kind: kindOf(foundLesson),
      shoe: null,
      shoeCount: 0,
      stepData: null,
      onStep: callbacks.onStep || (() => {}),
      onComplete: callbacks.onComplete || (() => {}),
      onError: callbacks.onError || (() => {})
    };
    this.prepareLessonStep();
    return this.lessonState;
  }

  prepareLessonStep() {
    const l = this.activeLesson;
    const s = this.lessonState;
    let kind = kindOf(l);

    if (kind === 'master_exam') kind = pick([...BASE_KINDS]);
    s.kind = kind;

    if (kind === 'single_recognition') {
      const card = new Card(pick(l.ranks || RANKS), pick(SUITS));
      s.stepData = { card, expectedValue: card.hiLoValue, inputType: 'number' };
    } else if (kind === 'pairs_cancellation') {
      const c1 = new Card(pick(RANKS), '♠');
      const c2 = new Card(pick(RANKS), '♥');
      s.stepData = { cards: [c1, c2], netValue: c1.hiLoValue + c2.hiLoValue, inputType: 'number' };
    } else if (kind === 'tc_drill') {
      const exact = l.mode === 'exact_integers';
      const remainingDecks = exact ? pick([1, 2, 3, 4, 5]) : pick([0.5, 1, 1.5, 2, 2.5, 3.5]);
      const rc = exact ? remainingDecks * (Math.floor(Math.random() * 7) - 3) : Math.floor(Math.random() * 19) - 9;
      s.stepData = { rc, remainingDecks, trueCount: Math.round((rc / remainingDecks) * 10) / 10, inputType: 'number' };
    } else if (kind === 'backcounting_entry') {
      const remainingDecks = Math.round((Math.random() * 3 + 1.5) * 2) / 2;
      const rc = Math.floor(Math.random() * 21) - 6;
      const tc = Math.round((rc / remainingDecks) * 10) / 10;
      s.stepData = { rc, remainingDecks, tc, shouldEnter: tc >= 2, inputType: 'boolean' };
    } else if (kind === 'deck_run') {
      const cards = shuffledDeck(1).slice(0, Math.round((l.decks || 1) * 52));
      s.stepData = { displayCards: cards, speedMs: l.speedMs, expectedCount: sumHiLo(cards), inputType: 'number' };
    } else if (kind === 'hidden_last_card') {
      const deck = shuffledDeck(1);
      const hidden = deck.pop();
      s.stepData = { displayCards: deck, hiddenCard: hidden, speedMs: l.speedMs, expectedValue: hidden.hiLoValue, inputType: 'number' };
    } else if (kind === 'tray_estimation') {
      const discarded = pick([52, 78, 104, 130, 156, 182, 208, 234]);
      s.stepData = { totalDecks: 6, discardedCards: discarded, expectedDecks: (312 - discarded) / 52, inputType: 'number' };
    } else if (kind === 'table_round') {
      const cards = shuffledDeck(1).slice(0, (l.players || 5) * 2 + 4);
      s.stepData = { displayCards: cards, speedMs: l.speedMs, expectedCount: sumHiLo(cards), inputType: 'number' };
    } else if (kind === 'shoe_run') {
      if (!s.shoe) s.shoe = shuffledDeck(l.decks || 6);
      const cards = s.shoe.splice(0, 12 + Math.floor(Math.random() * 8));
      s.shoeCount += sumHiLo(cards);
      s.stepData = { displayCards: cards, expectedCount: s.shoeCount, round: s.progress + 1, cumulative: true, inputType: 'number' };
    }
    s.onStep(s.stepData);
  }

  checkAnswer(kind, s, l, userAnswer) {
    const d = s.stepData;
    const int = Number.parseInt(userAnswer, 10);
    switch (kind) {
      case 'single_recognition': return int === d.expectedValue;
      case 'pairs_cancellation': return int === d.netValue;
      case 'tc_drill': {
        const tol = l.mode === 'exact_integers' ? 0 : 0.5;
        return Math.abs(Number.parseFloat(userAnswer) - d.trueCount) <= tol;
      }
      case 'backcounting_entry': return userAnswer === d.shouldEnter;
      case 'deck_run':
      case 'table_round':
      case 'shoe_run': return int === d.expectedCount;
      case 'hidden_last_card': return int === d.expectedValue;
      case 'tray_estimation': return Math.abs(Number.parseFloat(userAnswer) - d.expectedDecks) <= 0.5;
      default: return false;
    }
  }

  submitLessonAnswer(userAnswer) {
    const s = this.lessonState;
    const l = this.activeLesson;
    if (!s || !l) return null;

    const isCorrect = this.checkAnswer(s.kind, s, l, userAnswer);

    if (isCorrect) {
      sounds.playWin();
      s.progress++;
      const target = targetOf(l);
      if (s.progress >= target) {
        const xpEarned = this.finishActiveLesson(true);
        return { isCorrect: true, finished: true, xpEarned };
      }
      this.prepareLessonStep();
      return { isCorrect: true, finished: false, progress: s.progress, target };
    }

    sounds.playLoss();
    s.mistakes++;
    this.consumeHeart();
    const examFailed = kindOf(l) === 'master_exam' && s.mistakes > 2;
    const dead = this.profile.hearts <= 0 || examFailed;
    if (dead) {
      this.activeLesson = null;
      this.lessonState = null;
    }
    return { isCorrect: false, heartsLeft: this.profile.hearts, finished: dead, failed: dead };
  }

  finishActiveLesson(success) {
    const l = this.activeLesson;
    const s = this.lessonState;
    let xp = 0;
    if (success && l) {
      const firstTime = !this.profile.completedLessons[l.id];
      xp = firstTime ? l.xp : Math.max(1, Math.round(l.xp * 0.25));
      this.profile.xp += xp;
      if (firstTime) this.profile.gems += 5 + Math.floor(l.xp / 10);
      this.profile.completedLessons[l.id] = (this.profile.completedLessons[l.id] || 0) + 1;
      const world = WORLDS_CONFIG.find(w => w.id === s.worldId);
      if (world) {
        this.profile.worldProgress[world.id] = world.lessons.filter(x => this.profile.completedLessons[x.id]).length;
      }
      this.registerActivity();
      this.unlockNextLesson(l.id);
      s.onComplete({ lessonId: l.id, xp, firstTime, mistakes: s.mistakes });
      this.onLessonComplete({ lessonId: l.id, xp, firstTime });
    }
    this.activeLesson = null;
    this.lessonState = null;
    return xp;
  }
}
