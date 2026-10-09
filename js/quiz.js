// quiz.js - Modo Flashcard de Entrenamiento de Estrategia Básica
import { Card, RANKS, SUITS, getRecommendedAction } from './strategy.js';
import { sounds } from './audio.js';

export class StrategyQuiz {
  constructor(callbacks = {}) {
    this.onNewQuestion = callbacks.onNewQuestion || (() => {});
    this.onFeedback = callbacks.onFeedback || (() => {});
    this.stats = {
      total: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0
    };
    this.currentQuestion = null;
  }

  generateQuestion() {
    const types = ['hard', 'soft', 'pair'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    let pCard1, pCard2;
    if (chosenType === 'pair') {
      const r = RANKS[Math.floor(Math.random() * RANKS.length)];
      pCard1 = new Card(r, '♠');
      pCard2 = new Card(r, '♥');
    } else if (chosenType === 'soft') {
      pCard1 = new Card('A', '♠');
      const otherRanks = ['2', '3', '4', '5', '6', '7', '8', '9'];
      const r = otherRanks[Math.floor(Math.random() * otherRanks.length)];
      pCard2 = new Card(r, '♦');
    } else {
      const ranksNoAces = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const r1 = ranksNoAces[Math.floor(Math.random() * ranksNoAces.length)];
      let r2 = ranksNoAces[Math.floor(Math.random() * ranksNoAces.length)];
      while (new Card(r1, '♠').value === new Card(r2, '♠').value) {
        r2 = ranksNoAces[Math.floor(Math.random() * ranksNoAces.length)];
      }
      pCard1 = new Card(r1, '♣');
      pCard2 = new Card(r2, '♦');
    }

    const dRank = RANKS[Math.floor(Math.random() * RANKS.length)];
    const dealerUp = new Card(dRank, '♥');

    const fakeHand = { cards: [pCard1, pCard2] };
    const optimal = getRecommendedAction(fakeHand, dealerUp, {
      canDouble: true,
      canSplit: chosenType === 'pair',
      canSurrender: true
    });

    this.currentQuestion = {
      playerHand: fakeHand,
      dealerCard: dealerUp,
      optimalAction: optimal.action,
      explanation: optimal.tip
    };

    this.onNewQuestion(this.currentQuestion);
    return this.currentQuestion;
  }

  submitAnswer(chosenAction) {
    if (!this.currentQuestion) return null;

    const isCorrect = (chosenAction === this.currentQuestion.optimalAction) ||
                      (chosenAction === 'H' && this.currentQuestion.optimalAction === 'Rh');

    this.stats.total++;
    if (isCorrect) {
      this.stats.correct++;
      this.stats.streak++;
      if (this.stats.streak > this.stats.bestStreak) {
        this.stats.bestStreak = this.stats.streak;
      }
      sounds.playWin();
    } else {
      this.stats.streak = 0;
      sounds.playBuzzer();
    }

    const result = {
      isCorrect,
      chosenAction,
      optimalAction: this.currentQuestion.optimalAction,
      explanation: this.currentQuestion.explanation,
      stats: this.stats
    };

    this.onFeedback(result);
    return result;
  }
}
