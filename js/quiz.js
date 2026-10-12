// quiz.js - Flashcards de estrategia básica con repetición de fallos y reglas S17/H17
import { Card, RANKS, getRecommendedAction } from './strategy.js';
import { sounds } from './audio.js';

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export class StrategyQuiz {
  constructor(callbacks = {}, options = {}) {
    this.onNewQuestion = callbacks.onNewQuestion || (() => {});
    this.onFeedback = callbacks.onFeedback || (() => {});
    this.rules = { dealerS17: true, allowSurrender: true, ...options.rules };
    this.stats = { total: 0, correct: 0, streak: 0, bestStreak: 0 };
    this.missed = [];            // preguntas falladas pendientes de repaso
    this.cellStats = {};         // precisión por celda: { 'hard-16-10': {ok, total} }
    this.currentQuestion = null;
  }

  setRules(rules) {
    this.rules = { ...this.rules, ...rules };
  }

  buildQuestion(kind, r1, r2, dRank) {
    const suits = ['♠', '♥', '♦', '♣'];
    return {
      kind,
      p1: r1, p2: r2, dRank,
      playerHand: { cards: [new Card(r1, suits[0]), new Card(r2, suits[kind === 'pair' ? 1 : 2])] },
      dealerCard: new Card(dRank, '♥')
    };
  }

  randomSpec() {
    const kind = pick(['hard', 'soft', 'pair']);
    const dRank = pick(RANKS);
    if (kind === 'pair') {
      const r = pick(RANKS);
      return { kind, r1: r, r2: r, dRank };
    }
    if (kind === 'soft') {
      return { kind, r1: 'A', r2: pick(['2', '3', '4', '5', '6', '7', '8', '9']), dRank };
    }
    const noAces = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const r1 = pick(noAces);
    let r2 = pick(noAces);
    while (new Card(r1, '♠').value === new Card(r2, '♠').value) r2 = pick(noAces);
    return { kind, r1, r2, dRank };
  }

  cellKey(q) {
    const total = q.playerHand.cards.reduce((a, c) => a + c.value, 0);
    const d = q.dealerCard.value === 10 ? '10' : q.dealerCard.rank;
    return `${q.kind}-${q.kind === 'pair' ? q.p1 : total}-${d}`;
  }

  generateQuestion() {
    let spec;
    if (this.missed.length && Math.random() < 0.4) {
      spec = this.missed.shift();
    } else {
      spec = this.randomSpec();
    }
    const q = this.buildQuestion(spec.kind, spec.r1 ?? spec.p1, spec.r2 ?? spec.p2, spec.dRank);
    const optimal = getRecommendedAction(q.playerHand, q.dealerCard, {
      canDouble: true,
      canSplit: q.kind === 'pair',
      canSurrender: this.rules.allowSurrender,
      dealerS17: this.rules.dealerS17
    });
    this.currentQuestion = {
      playerHand: q.playerHand,
      dealerCard: q.dealerCard,
      spec: { kind: q.kind, r1: q.p1, r2: q.p2, dRank: q.dRank },
      cell: this.cellKey(q),
      optimalAction: optimal.action,
      explanation: optimal.tip,
      mathExplanation: optimal.mathExplanation
    };
    this.onNewQuestion(this.currentQuestion);
    return this.currentQuestion;
  }

  submitAnswer(chosenAction) {
    const q = this.currentQuestion;
    if (!q || q.answered) return null;
    q.answered = true;

    const isCorrect = chosenAction === q.optimalAction;
    this.stats.total++;
    const cell = this.cellStats[q.cell] || (this.cellStats[q.cell] = { ok: 0, total: 0 });
    cell.total++;

    if (isCorrect) {
      cell.ok++;
      this.stats.correct++;
      this.stats.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.stats.streak);
      sounds.playWin();
    } else {
      this.stats.streak = 0;
      if (this.missed.length < 20) this.missed.push(q.spec);
      sounds.playBuzzer();
    }

    const result = {
      isCorrect,
      chosenAction,
      optimalAction: q.optimalAction,
      explanation: q.explanation,
      mathExplanation: q.mathExplanation,
      stats: this.stats
    };
    this.onFeedback(result);
    return result;
  }

  weakestCells(n = 3) {
    return Object.entries(this.cellStats)
      .filter(([, v]) => v.total >= 2)
      .map(([k, v]) => ({ cell: k, accuracy: v.ok / v.total, total: v.total }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, n);
  }
}
