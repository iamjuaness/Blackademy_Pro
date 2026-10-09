// counting.js - Entrenador pedagógico de conteo Hi-Lo con análisis de jugadas óptimas
import { Card, RANKS, SUITS } from './strategy.js';
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
    text: 'A partir de TC >= +2, la ventaja matemática pasa del casino al jugador (+0.5% por cada punto de TC). Es el momento de incrementar el tamaño de la apuesta.'
  }
];

export class CountingTrainer {
  constructor(callbacks = {}) {
    this.onTick = callbacks.onTick || (() => {});
    this.onFinished = callbacks.onFinished || (() => {});
    this.onStateChange = callbacks.onStateChange || (() => {});

    this.timerId = null;
    this.mode = 'progressive'; // 'progressive', 'fixed', 'pairs'
    this.level = 1;
    this.speedMs = 1200;
    this.batchSize = 10;
    this.deck = [];
    this.runningCount = 0;
    this.currentIndex = 0;
    this.isRunning = false;

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
        for (const r of RANKS) {
          cards.push(new Card(r, s));
        }
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
    this.mode = options.mode || this.mode;

    if (this.mode === 'progressive') {
      this.speedMs = Math.max(250, 1500 - (this.level - 1) * 120);
      this.batchSize = 6 + (this.level * 2);
    } else {
      this.speedMs = options.speedMs || this.speedMs;
      this.batchSize = options.batchSize || this.batchSize;
    }

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
        this.runningCount += (c1.hiLoValue + c2.hiLoValue);
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
    this.onStateChange({ isRunning: false, waitingInput: true });
    this.onFinished(this.batchSize);
  }

  submitAnswer(userCount) {
    const guess = parseInt(userCount, 10);
    const correct = guess === this.runningCount;
    const diff = Math.abs(guess - this.runningCount);

    this.stats.drillsCompleted++;
    if (correct) {
      this.stats.correctCount++;
      this.stats.currentStreak++;
      if (this.stats.currentStreak > this.stats.bestStreak) {
        this.stats.bestStreak = this.stats.currentStreak;
      }
      sounds.playWin();

      if (this.mode === 'progressive') {
        this.level++;
      }
    } else {
      this.stats.currentStreak = 0;
      sounds.playLoss();
    }

    // Análisis de la jugada óptima bajo este conteo Hi-Lo
    const tcEstimate = Math.round((this.runningCount / 2) * 10) / 10;
    let bettingAdvice = '';
    let strategicDeviation = '';

    if (tcEstimate <= 1) {
      bettingAdvice = 'Mantener la apuesta mínima base ($25 / 1 unidad). Con TC <= +1 la ventaja estadística aún pertenece al casino.';
    } else if (tcEstimate >= 2 && tcEstimate < 4) {
      bettingAdvice = `Aumentar la apuesta a ${Math.round(tcEstimate)} unidades ($${Math.round(tcEstimate) * 25}). La ventaja se ha inclinado hacia el jugador en un ~+${((tcEstimate - 1) * 0.5).toFixed(1)}%.`;
    } else {
      bettingAdvice = `Apostar agresivamente el máximo spread (4 a 6 unidades: $100 - $150). Alta abundancia de naipes de 10 puntos y Ases.`;
    }

    if (tcEstimate >= 3) {
      strategicDeviation = 'Con este conteo (TC >= +3), la desviación #1 de Illustrious 18 se activa: Tomar el Seguro si el repartidor muestra un As pasa a ser una jugada matemáticamente ganadora (+EV).';
    } else if (tcEstimate >= 0) {
      strategicDeviation = 'Con TC >= 0, la desviación #2 se activa: si tienes 16 contra un 10 del repartidor, la mejor jugada es Plantarse en lugar de pedir carta.';
    } else {
      strategicDeviation = 'Con conteo negativo, la baraja tiene déficit de cartas altas. Se debe jugar la estrategia básica estricta sin doblajes arriesgados.';
    }

    const record = {
      timestamp: new Date().toLocaleTimeString(),
      mode: this.mode,
      level: this.level,
      speedMs: this.speedMs,
      batchSize: this.batchSize,
      actual: this.runningCount,
      guess: isNaN(guess) ? null : guess,
      correct
    };

    this.stats.history.unshift(record);
    if (this.stats.history.length > 20) this.stats.history.pop();

    this.onStateChange({ isRunning: false, waitingInput: false });
    return {
      correct,
      actualCount: this.runningCount,
      guess,
      diff,
      tcEstimate,
      bettingAdvice,
      strategicDeviation,
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
