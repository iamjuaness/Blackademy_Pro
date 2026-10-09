// engine.js - Motor de mesa multislot con reparto secuencial fluido
import { Card, RANKS, SUITS, evaluateHand, getRecommendedAction } from './strategy.js';
import { sounds } from './audio.js';

export class Shoe {
  constructor(decks = 6, penetration = 0.75) {
    this.decks = decks;
    this.penetration = penetration;
    this.cards = [];
    this.discardPile = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    this.discardPile = [];
    for (let d = 0; d < this.decks; d++) {
      for (const s of SUITS) {
        for (const r of RANKS) {
          this.cards.push(new Card(r, s));
        }
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.needsShuffle()) {
      this.reset();
    }
    return this.cards.pop();
  }

  needsShuffle() {
    const total = this.decks * 52;
    return this.cards.length <= total * (1 - this.penetration);
  }

  get remainingDecks() {
    return Math.max(0.5, Math.round((this.cards.length / 52) * 2) / 2);
  }

  get penetrationPercent() {
    const total = this.decks * 52;
    return Math.round(((total - this.cards.length) / total) * 100);
  }
}

export class Hand {
  constructor(bet = 0) {
    this.cards = [];
    this.bet = bet;
    this.isDone = false;
    this.isSurrendered = false;
    this.isDoubled = false;
    this.result = null;
    this.payout = 0;
  }
}

export class Slot {
  constructor(id, type = 'EMPTY', balance = 1000) {
    this.id = id;
    this.type = type;
    this.balance = balance;
    this.baseBet = 25;
    this.hands = [];
  }

  resetRound() {
    this.hands = [];
  }
}

export class BlackjackEngine {
  constructor(rules = {}, onUpdate = null) {
    this.rules = {
      decks: 6,
      dealerS17: true,
      blackjackPayout: 1.5,
      allowDAS: true,
      allowSurrender: true,
      maxSplits: 4,
      dealingSpeedMs: 280, // Velocidad de reparto secuencial realista
      ...rules
    };

    this.onUpdate = onUpdate || (() => {});
    this.shoe = new Shoe(this.rules.decks);
    this.slots = [
      new Slot(1, 'EMPTY', 1000),
      new Slot(2, 'BOT_BASIC', 1000),
      new Slot(3, 'HUMAN', 1000),
      new Slot(4, 'BOT_COUNTER', 1000),
      new Slot(5, 'EMPTY', 1000)
    ];

    this.dealerCards = [];
    this.dealerHidden = true;
    this.runningCount = 0;
    this.phase = 'BETTING';
    this.currentSlotIndex = -1;
    this.currentHandIndex = -1;
    this.lastFeedback = null;
    this.isDealing = false;
  }

  get trueCount() {
    return Math.round((this.runningCount / this.shoe.remainingDecks) * 10) / 10;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  dealSingleCard(toDealer = false) {
    const card = this.shoe.draw();
    if (!toDealer || this.dealerCards.length === 0 || !this.dealerHidden) {
      this.runningCount += card.hiLoValue;
    }
    sounds.playCard();
    return card;
  }

  revealDealerHoleCard() {
    if (this.dealerCards.length > 1 && this.dealerHidden) {
      this.dealerHidden = false;
      this.runningCount += this.dealerCards[1].hiLoValue;
      sounds.playCard();
    }
  }

  async startRound() {
    if (this.phase !== 'BETTING' && this.phase !== 'SETTLED') return false;
    if (this.isDealing) return false;

    // Configurar apuestas para bots y validar fondos
    for (const slot of this.slots) {
      if (slot.type === 'EMPTY') continue;

      if (slot.type === 'BOT_BASIC') {
        slot.baseBet = 25;
      } else if (slot.type === 'BOT_COUNTER') {
        const units = Math.max(1, Math.min(6, Math.floor(this.trueCount)));
        slot.baseBet = 25 * (this.trueCount >= 1 ? units : 1);
      }

      if (slot.balance < slot.baseBet) {
        slot.baseBet = slot.balance;
      }

      if (slot.baseBet > 0 && slot.balance >= slot.baseBet) {
        slot.balance -= slot.baseBet;
        const initialHand = new Hand(slot.baseBet);
        slot.hands = [initialHand];
        sounds.playChip();
      } else {
        slot.hands = [];
      }
    }

    const activeSlots = this.slots.filter(s => s.hands.length > 0);
    if (activeSlots.length === 0) return false;

    this.isDealing = true;
    this.phase = 'DEALING';
    this.dealerCards = [];
    this.dealerHidden = true;
    this.lastFeedback = null;
    this.onUpdate();

    const delay = this.rules.dealingSpeedMs;

    // Ronda 1: Carta 1 a cada jugador activo
    for (const slot of activeSlots) {
      await this.sleep(delay);
      slot.hands[0].cards.push(this.dealSingleCard());
      this.onUpdate();
    }

    // Carta 1 al repartidor (visible)
    await this.sleep(delay);
    this.dealerCards.push(this.dealSingleCard(true));
    this.onUpdate();

    // Ronda 2: Carta 2 a cada jugador activo
    for (const slot of activeSlots) {
      await this.sleep(delay);
      slot.hands[0].cards.push(this.dealSingleCard());
      this.onUpdate();
    }

    // Carta 2 al repartidor (boca abajo)
    await this.sleep(delay);
    const holeCard = this.shoe.draw();
    this.dealerCards.push(holeCard);
    sounds.playCard();
    this.onUpdate();

    this.isDealing = false;
    this.phase = 'PLAYER_TURNS';
    this.advanceToNextTurn();
    this.onUpdate();

    return true;
  }

  advanceToNextTurn() {
    for (let sIdx = 0; sIdx < this.slots.length; sIdx++) {
      const slot = this.slots[sIdx];
      if (slot.type === 'EMPTY' || slot.hands.length === 0) continue;

      for (let hIdx = 0; hIdx < slot.hands.length; hIdx++) {
        const hand = slot.hands[hIdx];
        if (!hand.isDone) {
          const evalResult = evaluateHand(hand.cards);
          if (evalResult.isBlackjack || evalResult.isBusted || evalResult.total === 21) {
            hand.isDone = true;
            continue;
          }

          this.currentSlotIndex = sIdx;
          this.currentHandIndex = hIdx;

          if (slot.type.startsWith('BOT')) {
            setTimeout(() => this.playBotTurn(sIdx, hIdx), 500);
          }
          this.onUpdate();
          return;
        }
      }
    }

    this.currentSlotIndex = -1;
    this.currentHandIndex = -1;
    this.phase = 'DEALER_TURN';
    this.onUpdate();
    setTimeout(() => this.runDealerTurn(), 600);
  }

  playBotTurn(slotIndex, handIndex) {
    const slot = this.slots[slotIndex];
    const hand = slot.hands[handIndex];
    if (!hand || hand.isDone) {
      this.advanceToNextTurn();
      return;
    }

    const canSplit = hand.cards.length === 2 && 
                     hand.cards[0].value === hand.cards[1].value && 
                     slot.balance >= hand.bet && 
                     slot.hands.length < this.rules.maxSplits;
    const canDouble = hand.cards.length === 2 && slot.balance >= hand.bet;
    const tc = slot.type === 'BOT_COUNTER' ? this.trueCount : null;

    const rec = getRecommendedAction(hand, this.dealerCards[0], {
      canDouble,
      canSplit,
      canSurrender: this.rules.allowSurrender && hand.cards.length === 2,
      trueCount: tc
    });

    this.executeAction(rec.action, slotIndex, handIndex);
  }

  executeAction(action, slotIdx = this.currentSlotIndex, handIdx = this.currentHandIndex) {
    const slot = this.slots[slotIdx];
    if (!slot) return;
    const hand = slot.hands[handIdx];
    if (!hand || hand.isDone) return;

    const canSplit = hand.cards.length === 2 && 
                     hand.cards[0].value === hand.cards[1].value && 
                     slot.balance >= hand.bet && 
                     slot.hands.length < this.rules.maxSplits;
    const canDouble = hand.cards.length === 2 && slot.balance >= hand.bet;

    const rec = getRecommendedAction(hand, this.dealerCards[0], {
      canDouble,
      canSplit,
      canSurrender: this.rules.allowSurrender && hand.cards.length === 2,
      trueCount: this.trueCount
    });

    if (slot.type === 'HUMAN') {
      const isOptimal = (action === rec.action) || (action === 'H' && rec.action === 'Rh');
      this.lastFeedback = {
        chosen: action,
        optimal: rec.action,
        isCorrect: isOptimal,
        tip: rec.tip,
        mathExplanation: rec.mathExplanation,
        deviation: rec.deviation
      };
      if (!isOptimal) {
        sounds.playBuzzer();
      }
    }

    switch (action) {
      case 'H': {
        hand.cards.push(this.dealSingleCard());
        const ev = evaluateHand(hand.cards);
        if (ev.isBusted || ev.total === 21) {
          hand.isDone = true;
        }
        break;
      }
      case 'S': {
        hand.isDone = true;
        break;
      }
      case 'D': {
        if (canDouble) {
          slot.balance -= hand.bet;
          hand.bet *= 2;
          hand.isDoubled = true;
          hand.cards.push(this.dealSingleCard());
          hand.isDone = true;
          sounds.playChip();
        }
        break;
      }
      case 'P': {
        if (canSplit) {
          slot.balance -= hand.bet;
          sounds.playChip();
          const secondCard = hand.cards.pop();
          const newHand = new Hand(hand.bet);
          newHand.cards.push(secondCard);

          hand.cards.push(this.dealSingleCard());
          newHand.cards.push(this.dealSingleCard());

          slot.hands.splice(handIdx + 1, 0, newHand);
        }
        break;
      }
      case 'Rh': {
        if (this.rules.allowSurrender && hand.cards.length === 2) {
          hand.isSurrendered = true;
          hand.isDone = true;
          slot.balance += hand.bet / 2;
        }
        break;
      }
    }

    this.advanceToNextTurn();
  }

  runDealerTurn() {
    this.revealDealerHoleCard();

    let anyHandActive = false;
    for (const slot of this.slots) {
      for (const hand of slot.hands) {
        const ev = evaluateHand(hand.cards);
        if (!hand.isSurrendered && !ev.isBusted) {
          anyHandActive = true;
          break;
        }
      }
    }

    if (!anyHandActive) {
      this.settleRound();
      return;
    }

    const drawDealerLoop = () => {
      const evalDealer = evaluateHand(this.dealerCards);
      const isSoft17 = evalDealer.total === 17 && evalDealer.isSoft;
      const mustHit = evalDealer.total < 17 || (isSoft17 && !this.rules.dealerS17);

      if (mustHit) {
        this.dealerCards.push(this.dealSingleCard());
        this.onUpdate();
        setTimeout(drawDealerLoop, 600);
      } else {
        this.settleRound();
      }
    };

    setTimeout(drawDealerLoop, 500);
  }

  settleRound() {
    const dealerEval = evaluateHand(this.dealerCards);
    const dealerBust = dealerEval.isBusted;
    const dealerBJ = dealerEval.isBlackjack;
    const dealerTotal = dealerEval.total;

    let humanWonAny = false;
    let humanLostAny = false;

    for (const slot of this.slots) {
      if (slot.type === 'EMPTY' || slot.hands.length === 0) continue;

      for (const hand of slot.hands) {
        if (hand.isSurrendered) {
          hand.result = 'SURRENDER';
          continue;
        }

        const playerEval = evaluateHand(hand.cards);

        if (playerEval.isBusted) {
          hand.result = 'LOSS';
          if (slot.type === 'HUMAN') humanLostAny = true;
          continue;
        }

        if (playerEval.isBlackjack) {
          if (dealerBJ) {
            hand.result = 'PUSH';
            slot.balance += hand.bet;
          } else {
            hand.result = 'BLACKJACK';
            const winAmount = hand.bet + (hand.bet * this.rules.blackjackPayout);
            slot.balance += winAmount;
            if (slot.type === 'HUMAN') humanWonAny = true;
          }
          continue;
        }

        if (dealerBJ) {
          hand.result = 'LOSS';
          if (slot.type === 'HUMAN') humanLostAny = true;
          continue;
        }

        if (dealerBust || playerEval.total > dealerTotal) {
          hand.result = 'WIN';
          slot.balance += hand.bet * 2;
          if (slot.type === 'HUMAN') humanWonAny = true;
        } else if (playerEval.total === dealerTotal) {
          hand.result = 'PUSH';
          slot.balance += hand.bet;
        } else {
          hand.result = 'LOSS';
          if (slot.type === 'HUMAN') humanLostAny = true;
        }
      }
    }

    if (humanWonAny) sounds.playWin();
    else if (humanLostAny) sounds.playLoss();

    this.phase = 'SETTLED';
    this.onUpdate();
  }
}
