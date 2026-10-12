import { BlackjackEngine } from '../js/engine.js';
import { Card } from '../js/strategy.js';

export const syncScheduler = fn => fn();

// Crea un motor con scheduler síncrono y slots configurables: types = ['EMPTY','HUMAN',...]
export function makeEngine(types = ['EMPTY', 'EMPTY', 'HUMAN', 'EMPTY', 'EMPTY'], rules = {}) {
  const e = new BlackjackEngine({ scheduler: syncScheduler, ...rules });
  e.slots.forEach((s, i) => { s.type = types[i]; s.balance = 1000; s.baseBet = 25; });
  return e;
}

// Fija el zapato: cartas en el orden en que se reparten (se extraen con pop()).
export function stack(engine, ranks) {
  engine.shoe.penetration = 1;
  engine.shoe.cards = ranks.map(r => new Card(r, '♠')).reverse();
}

export function dealAll(engine) {
  while (engine.phase === 'DEALING') engine.dealNextStep();
}
