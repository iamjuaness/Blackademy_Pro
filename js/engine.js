// engine.js - Motor de mesa multislot (reglas de casino, peek de blackjack, splits correctos)
import { Card, RANKS, SUITS, evaluateHand, getRecommendedAction } from './strategy.js';
import { sounds } from './audio.js';

export class Shoe {
  constructor(decks = 6, penetration = 0.75) {
    this.decks = decks;
    this.penetration = penetration;
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (let d = 0; d < this.decks; d++) {
      for (const s of SUITS) {
        for (const r of RANKS) this.cards.push(new Card(r, s));
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

  // Solo rebaraja si el zapato se agota; el corte se evalúa entre rondas (needsShuffle).
  draw() {
    if (this.cards.length === 0) this.reset();
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
    this.fromSplit = false;
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
    const { scheduler, ...ruleValues } = rules;
    this.rules = {
      decks: 6,
      dealerS17: true,
      blackjackPayout: 1.5,
      allowDAS: true,
      allowSurrender: true,
      maxSplits: 4,
      dealingSpeedMs: 800,
      ...ruleValues
    };

    this.scheduler = scheduler || ((fn, ms) => setTimeout(fn, ms));
    this.roundId = 0;
    this.destroyed = false;

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
    this.lastError = null;
    this.isDealing = false;

    this.autoDeal = false;
    this.dealQueue = [];
    this.dealQueueIndex = 0;
    this.lastDealtTarget = null;
  }

  get trueCount() {
    return Math.round((this.runningCount / this.shoe.remainingDecks) * 10) / 10;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Programa un callback ligado a la ronda actual: si la ronda cambia o el motor se destruye, se ignora.
  schedule(fn, ms) {
    const rid = this.roundId;
    return this.scheduler(() => {
      if (!this.destroyed && rid === this.roundId) fn();
    }, ms);
  }

  destroy() {
    this.destroyed = true;
    this.roundId++;
  }

  rebuy(slotId, amount = 1000) {
    const slot = this.slots.find(s => s.id === slotId);
    if (!slot) return false;
    slot.balance += amount;
    this.onUpdate();
    return true;
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

  toggleDealMode() {
    this.autoDeal = !this.autoDeal;
    return this.autoDeal;
  }

  getHandOptions(slot, hand) {
    const two = hand.cards.length === 2;
    const isSplit = hand.fromSplit === true;
    const splitAces = isSplit && hand.cards[0]?.rank === 'A';
    return {
      canDouble: two && !splitAces && slot.balance >= hand.bet && (!isSplit || this.rules.allowDAS),
      canSplit: two && !splitAces && hand.cards[0].value === hand.cards[1].value &&
                slot.balance >= hand.bet && slot.hands.length < this.rules.maxSplits,
      canSurrender: this.rules.allowSurrender && two && !isSplit
    };
  }

  startRound() {
    this.lastError = null;
    if (this.phase !== 'BETTING' && this.phase !== 'SETTLED') return false;
    if (this.isDealing) return false;

    this.roundId++;

    if (this.shoe.needsShuffle()) {
      this.shoe.reset();
      this.runningCount = 0;
    }

    for (const slot of this.slots) {
      slot.hands = [];
      if (slot.type === 'EMPTY') continue;

      if (slot.type === 'BOT_BASIC') {
        slot.baseBet = 25;
      } else if (slot.type === 'BOT_COUNTER') {
        const tc = this.trueCount;
        slot.baseBet = 25 * (tc >= 1 ? Math.min(6, Math.floor(tc)) : 1);
      }
      if (slot.balance < slot.baseBet) slot.baseBet = Math.floor(slot.balance);

      if (slot.baseBet > 0) {
        slot.balance -= slot.baseBet;
        slot.hands = [new Hand(slot.baseBet)];
        sounds.playChip();
      }
    }

    const activeSlots = this.slots.filter(s => s.hands.length > 0);
    if (activeSlots.length === 0) {
      this.lastError = 'NO_FUNDS';
      return false;
    }

    this.dealQueue = [];
    this.dealQueueIndex = 0;
    this.dealerCards = [];
    this.dealerHidden = true;
    this.lastFeedback = null;
    this.lastDealtTarget = null;

    for (const slot of activeSlots) this.dealQueue.push({ type: 'slot', slot, label: `Slot ${slot.id}` });
    this.dealQueue.push({ type: 'dealer-up', label: 'Dealer' });
    for (const slot of activeSlots) this.dealQueue.push({ type: 'slot', slot, label: `Slot ${slot.id}` });
    this.dealQueue.push({ type: 'dealer-hole', label: 'Dealer (Oculta)' });

    this.phase = 'DEALING';

    if (this.autoDeal) this.runAutoDeal();
    else this.onUpdate();

    return true;
  }

  dealNextStep() {
    if (this.phase !== 'DEALING' || this.dealQueueIndex >= this.dealQueue.length) return false;

    const step = this.dealQueue[this.dealQueueIndex];
    this.lastDealtTarget = step;

    if (step.type === 'slot') {
      step.slot.hands[0].cards.push(this.dealSingleCard());
    } else if (step.type === 'dealer-up') {
      this.dealerCards.push(this.dealSingleCard(true));
    } else if (step.type === 'dealer-hole') {
      this.dealerCards.push(this.shoe.draw());
      sounds.playCard();
    }

    this.dealQueueIndex++;

    if (this.dealQueueIndex >= this.dealQueue.length) this.finishInitialDeal();
    else this.onUpdate();

    return true;
  }

  async runAutoDeal() {
    this.isDealing = true;
    this.onUpdate();
    const rid = this.roundId;
    while (this.dealQueueIndex < this.dealQueue.length) {
      if (this.destroyed || rid !== this.roundId) break;
      this.dealNextStep();
      await this.sleep(this.rules.dealingSpeedMs);
    }
    this.isDealing = false;
  }

  finishInitialDeal() {
    this.phase = 'PLAYER_TURNS';
    const up = this.dealerCards[0];
    const mayHaveBJ = up.rank === 'A' || up.value === 10;

    if (mayHaveBJ && evaluateHand(this.dealerCards).isBlackjack) {
      this.phase = 'DEALER_TURN';
      this.revealDealerHoleCard();
      this.slots.forEach(s => s.hands.forEach(h => { h.isDone = true; }));
      this.onUpdate();
      this.schedule(() => this.settleRound(), 700);
      return;
    }
    this.onUpdate();
    this.schedule(() => this.advanceToNextTurn(), 400);
  }

  advanceToNextTurn() {
    for (let sIdx = 0; sIdx < this.slots.length; sIdx++) {
      const slot = this.slots[sIdx];
      if (slot.type === 'EMPTY' || slot.hands.length === 0) continue;

      for (let hIdx = 0; hIdx < slot.hands.length; hIdx++) {
        const hand = slot.hands[hIdx];
        if (hand.isDone) continue;

        const ev = evaluateHand(hand.cards);
        if (ev.isBlackjack || ev.isBusted || ev.total === 21) {
          hand.isDone = true;
          continue;
        }

        this.currentSlotIndex = sIdx;
        this.currentHandIndex = hIdx;

        if (slot.type.startsWith('BOT')) {
          this.schedule(() => this.playBotTurn(sIdx, hIdx), 900);
        }
        this.onUpdate();
        return;
      }
    }

    this.currentSlotIndex = -1;
    this.currentHandIndex = -1;
    this.phase = 'DEALER_TURN';
    this.onUpdate();
    this.schedule(() => this.runDealerTurn(), 800);
  }

  playBotTurn(slotIndex, handIndex) {
    if (this.phase !== 'PLAYER_TURNS') return;
    if (slotIndex !== this.currentSlotIndex || handIndex !== this.currentHandIndex) return;
    const slot = this.slots[slotIndex];
    const hand = slot?.hands[handIndex];
    if (!hand || hand.isDone) return;

    const rec = getRecommendedAction(hand, this.dealerCards[0], {
      ...this.getHandOptions(slot, hand),
      trueCount: slot.type === 'BOT_COUNTER' ? this.trueCount : null,
      dealerS17: this.rules.dealerS17
    });
    this.executeAction(rec.action, slotIndex, handIndex);
  }

  executeAction(action, slotIdx = this.currentSlotIndex, handIdx = this.currentHandIndex) {
    if (this.phase !== 'PLAYER_TURNS') return false;
    if (slotIdx !== this.currentSlotIndex || handIdx !== this.currentHandIndex) return false;
    const slot = this.slots[slotIdx];
    const hand = slot?.hands[handIdx];
    if (!hand || hand.isDone) return false;

    const opts = this.getHandOptions(slot, hand);
    const legal = { H: true, S: true, D: opts.canDouble, P: opts.canSplit, Rh: opts.canSurrender };
    if (!legal[action]) return false;

    if (slot.type === 'HUMAN') {
      const rec = getRecommendedAction(hand, this.dealerCards[0], {
        ...opts, trueCount: this.trueCount, dealerS17: this.rules.dealerS17
      });
      const isCorrect = action === rec.action;
      this.lastFeedback = {
        chosen: action,
        optimal: rec.action,
        isCorrect,
        tip: rec.tip,
        mathExplanation: rec.mathExplanation,
        deviation: rec.deviation
      };
      if (!isCorrect) sounds.playBuzzer();
    }

    switch (action) {
      case 'H': {
        hand.cards.push(this.dealSingleCard());
        const ev = evaluateHand(hand.cards);
        if (ev.isBusted || ev.total === 21) hand.isDone = true;
        break;
      }
      case 'S':
        hand.isDone = true;
        break;
      case 'D':
        slot.balance -= hand.bet;
        hand.bet *= 2;
        hand.isDoubled = true;
        hand.cards.push(this.dealSingleCard());
        hand.isDone = true;
        sounds.playChip();
        break;
      case 'P': {
        slot.balance -= hand.bet;
        sounds.playChip();
        const isAces = hand.cards[0].rank === 'A';
        const newHand = new Hand(hand.bet);
        hand.fromSplit = true;
        newHand.fromSplit = true;
        newHand.cards.push(hand.cards.pop());
        hand.cards.push(this.dealSingleCard());
        newHand.cards.push(this.dealSingleCard());
        if (isAces) {
          hand.isDone = true;
          newHand.isDone = true;
        }
        slot.hands.splice(handIdx + 1, 0, newHand);
        break;
      }
      case 'Rh':
        hand.isSurrendered = true;
        hand.isDone = true;
        slot.balance += hand.bet / 2;
        break;
    }

    this.advanceToNextTurn();
    return true;
  }

  runDealerTurn() {
    this.revealDealerHoleCard();

    const needsDealerPlay = this.slots.some(slot => slot.hands.some(hand => {
      if (hand.isSurrendered) return false;
      const ev = evaluateHand(hand.cards);
      if (ev.isBusted) return false;
      if (ev.isBlackjack && !hand.fromSplit) return false;
      return true;
    }));

    if (!needsDealerPlay) {
      this.settleRound();
      return;
    }

    const drawDealerLoop = () => {
      const dealerEval = evaluateHand(this.dealerCards);
      const isSoft17 = dealerEval.total === 17 && dealerEval.isSoft;
      const mustHit = dealerEval.total < 17 || (isSoft17 && !this.rules.dealerS17);

      if (mustHit) {
        this.dealerCards.push(this.dealSingleCard());
        this.onUpdate();
        this.schedule(drawDealerLoop, 850);
      } else {
        this.settleRound();
      }
    };

    this.schedule(drawDealerLoop, 750);
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
        const isHuman = slot.type === 'HUMAN';

        if (playerEval.isBusted) {
          hand.result = 'LOSS';
          if (isHuman) humanLostAny = true;
          continue;
        }

        if (playerEval.isBlackjack && !hand.fromSplit) {
          if (dealerBJ) {
            hand.result = 'PUSH';
            slot.balance += hand.bet;
          } else {
            hand.result = 'BLACKJACK';
            slot.balance += hand.bet + hand.bet * this.rules.blackjackPayout;
            if (isHuman) humanWonAny = true;
          }
          continue;
        }

        if (dealerBJ) {
          hand.result = 'LOSS';
          if (isHuman) humanLostAny = true;
          continue;
        }

        if (dealerBust || playerEval.total > dealerTotal) {
          hand.result = 'WIN';
          slot.balance += hand.bet * 2;
          if (isHuman) humanWonAny = true;
        } else if (playerEval.total === dealerTotal) {
          hand.result = 'PUSH';
          slot.balance += hand.bet;
        } else {
          hand.result = 'LOSS';
          if (isHuman) humanLostAny = true;
        }
      }
    }

    if (humanWonAny) sounds.playWin();
    else if (humanLostAny) sounds.playLoss();

    this.phase = 'SETTLED';
    this.onUpdate();
  }
}
