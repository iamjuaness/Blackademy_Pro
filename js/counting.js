// counting.js - Entrenador de conteo Hi-Lo con TC real y validación de respuestas
import { Card, RANKS, SUITS, ILLUSTRIOUS_18 } from './strategy.js';
import { sounds } from './audio.js';

export const COUNTING_TIPS = [
  {
    title: 'Cancelación Visual de Parejas',
    text: 'Cuando salgan dos cartas juntas (ej: un Rey [-1] y un 5 [+1]), no hagas la suma secuencial. Anúlalas visualmente de inmediato como un cero neto.'
  },
  {
    title: 'Filtro de Ruido Neutro (7, 8, 9)',
    text: 'Los 7s, 8s y 9s valen exactamente cero. Entrena tu visión periférica para ignorarlos por completo sin alterar tu cuenta mental.'
  },
  {
    title: 'Cálculo del True Count (TC)',
    text: 'Fórmula: TC = Running Count / Mazos Restantes. Si el conteo acumulado es +6 y quedan 2 mazos en el zapato, el TC real es +3.'
  },
  {
    title: 'Ventaja y Bet Spread',
    text: 'Cada punto de True Count aporta aproximadamente +0.5% de ventaja al jugador. El punto de equilibrio depende de las reglas y suele estar cerca de TC +1; por encima de ahí es donde se sube la apuesta.'
  }
];

export class CountingTrainer {
  constructor(callbacks = {}) {
    this.onTick = callbacks.onTick || (() => {});
    this.onFinished = callbacks.onFinished || (() => {});
    this.onStateChange = callbacks.onStateChange || (() => {});

    this.timerId = null;
    this.mode = 'progressive';
    this.level = 1;
    this.speedMs = 1200;
    this.batchSize = 10;
    this.deck = [];
    this.runningCount = 0;
    this.currentIndex = 0;
    this.isRunning = false;
    this.awaitingAnswer = false;

    this.stats = {
      drillsCompleted: 0,
      correctCount: 0,
      bestStreak: 0,
      currentStreak: 0,
      history: []
    };
  }

  buildDeck(decksCount = 2) {
    const cards = [];
    for (let d = 0; d < decksCount; d++) {
      for (const s of SUITS) {
        for (const r of RANKS) cards.push(new Card(r, s));
      }
    }
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    return cards;
  }

  start(options = {}) {
    this.stop();
    this.awaitingAnswer = false;
    this.mode = options.mode || this.mode;

    if (this.mode === 'progressive') {
      this.speedMs = Math.max(250, 1500 - (this.level - 1) * 120);
      this.batchSize = 6 + this.level * 2;
    } else {
      this.speedMs = options.speedMs || this.speedMs;
      this.batchSize = options.batchSize || this.batchSize;
    }
    if (this.mode === 'pairs' && this.batchSize % 2 !== 0) this.batchSize += 1;

    this.deck = this.buildDeck(Math.ceil(this.batchSize / 52) + 1);
    this.runningCount = 0;
    this.currentIndex = 0;
    this.isRunning = true;
    this.onStateChange({ isRunning: true, waitingInput: false });

    this.timerId = setInterval(() => {
      if (this.currentIndex >= this.batchSize || this.deck.length === 0) {
        this.finishBatch();
        return;
      }
      if (this.mode === 'pairs') {
        const c1 = this.deck.pop();
        const c2 = this.deck.pop();
        this.runningCount += c1.hiLoValue + c2.hiLoValue;
        this.currentIndex += 2;
        sounds.playCard();
        this.onTick([c1, c2], this.currentIndex, this.batchSize);
      } else {
        const c1 = this.deck.pop();
        this.runningCount += c1.hiLoValue;
        this.currentIndex += 1;
        sounds.playCard();
        this.onTick([c1], this.currentIndex, this.batchSize);
      }
    }, this.speedMs);
  }

  finishBatch() {
    this.stop();
    this.isRunning = false;
    this.awaitingAnswer = true;
    this.onStateChange({ isRunning: false, waitingInput: true });
    this.onFinished(this.batchSize);
  }

  getBetAdvice(tc) {
    if (tc < 1) return 'Apuesta mínima (1 unidad, $25): con TC < +1 la ventaja sigue siendo de la casa.';
    const units = Math.min(6, Math.floor(tc));
    return `Sube a ${units} unidad${units > 1 ? 'es' : ''} ($${units * 25}). Cada punto de TC aporta aprox. +0.5% de ventaja.`;
  }

  getDeviationHint(tc) {
    const active = ILLUSTRIOUS_18
      .filter(i => i.triggerTC >= 0 && tc >= i.triggerTC)
      .map(i => i.action);
    return active.length
      ? `Desviaciones positivas activas con TC ${tc}: ${active.join(' · ')}`
      : 'Sin desviaciones positivas activas: juega estrategia básica.';
  }

  // Devuelve null si no se esperaba respuesta, { invalid: true } si no es un entero válido.
  submitAnswer(userCount) {
    if (!this.awaitingAnswer) return null;
    const guess = Number.parseInt(userCount, 10);
    if (Number.isNaN(guess)) return { invalid: true };
    this.awaitingAnswer = false;

    const correct = guess === this.runningCount;
    const diff = Math.abs(guess - this.runningCount);

    this.stats.drillsCompleted++;
    if (correct) {
      this.stats.correctCount++;
      this.stats.currentStreak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.currentStreak);
      sounds.playWin();
      if (this.mode === 'progressive') this.level++;
    } else {
      this.stats.currentStreak = 0;
      sounds.playLoss();
    }

    const decksLeft = Math.max(0.5, Math.round((this.deck.length / 52) * 2) / 2);
    const tcEstimate = Math.round((this.runningCount / decksLeft) * 10) / 10;

    this.stats.history.unshift({
      timestamp: new Date().toLocaleTimeString(),
      mode: this.mode,
      level: this.level,
      speedMs: this.speedMs,
      batchSize: this.batchSize,
      actual: this.runningCount,
      guess,
      correct
    });
    if (this.stats.history.length > 20) this.stats.history.pop();

    this.onStateChange({ isRunning: false, waitingInput: false });
    return {
      correct,
      actualCount: this.runningCount,
      guess,
      diff,
      tcEstimate,
      bettingAdvice: this.getBetAdvice(tcEstimate),
      strategicDeviation: this.getDeviationHint(tcEstimate),
      nextLevel: this.level,
      nextSpeed: Math.max(250, 1500 - (this.level - 1) * 120)
    };
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isRunning = false;
  }
}
