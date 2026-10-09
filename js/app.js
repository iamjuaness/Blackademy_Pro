// app.js - Orquestador principal con persistencia LocalStorage, Mnemotecnia y Explicaciones EV
import { BlackjackEngine } from './engine.js';
import { CountingTrainer, COUNTING_TIPS } from './counting.js';
import { StrategyQuiz } from './quiz.js';
import { BASIC_STRATEGY, ILLUSTRIOUS_18, evaluateHand, getRecommendedAction } from './strategy.js';

// Gestor de Persistencia LocalStorage
export class StorageManager {
  static KEY = 'blackjack_pro_save_v1';

  static load() {
    try {
      const data = localStorage.getItem(StorageManager.KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('Error leyendo localStorage:', e);
      return null;
    }
  }

  static save(state) {
    try {
      localStorage.setItem(StorageManager.KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Error guardando en localStorage:', e);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const savedState = StorageManager.load() || {};

  // 1. Instanciación y restauración de configuración
  const initialRules = {
    decks: savedState.rules?.decks || 6,
    dealerS17: savedState.rules?.dealerS17 !== undefined ? savedState.rules.dealerS17 : true,
    blackjackPayout: savedState.rules?.blackjackPayout || 1.5,
    allowSurrender: savedState.rules?.allowSurrender !== undefined ? savedState.rules.allowSurrender : true,
    showMathExplanation: savedState.rules?.showMathExplanation !== undefined ? savedState.rules.showMathExplanation : true
  };

  const table = new BlackjackEngine(initialRules, renderTable);
  const trainer = new CountingTrainer({
    onTick: renderTrainerCard,
    onFinished: handleTrainerFinished,
    onStateChange: updateTrainerUIState
  });
  const quiz = new StrategyQuiz({
    onNewQuestion: renderQuizQuestion,
    onFeedback: renderQuizFeedback
  });

  // Restaurar datos guardados
  if (savedState.slots) {
    savedState.slots.forEach((s, idx) => {
      if (table.slots[idx]) {
        table.slots[idx].type = s.type;
        table.slots[idx].balance = s.balance;
        table.slots[idx].baseBet = s.baseBet || 25;
      }
    });
  }
  if (savedState.counting) {
    trainer.level = savedState.counting.level || 1;
    trainer.stats = { ...trainer.stats, ...savedState.counting.stats };
  }
  if (savedState.quiz) {
    quiz.stats = { ...quiz.stats, ...savedState.quiz.stats };
  }

  function persistAll() {
    const state = {
      rules: {
        decks: table.rules.decks,
        dealerS17: table.rules.dealerS17,
        blackjackPayout: table.rules.blackjackPayout,
        allowSurrender: table.rules.allowSurrender,
        showMathExplanation: table.rules.showMathExplanation
      },
      slots: table.slots.map(s => ({
        type: s.type,
        balance: s.balance,
        baseBet: s.baseBet
      })),
      counting: {
        level: trainer.level,
        stats: trainer.stats
      },
      quiz: {
        stats: quiz.stats
      }
    };
    StorageManager.save(state);
  }

  // 2. Elementos del DOM
  const navTabs = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const slotsContainer = document.getElementById('slots-container');
  const dealerCardsContainer = document.getElementById('dealer-cards');
  const dealerTotalDisplay = document.getElementById('dealer-score');
  const liveTipBox = document.getElementById('tip-display');
  const runningCountEl = document.getElementById('running-count-display');
  const trueCountEl = document.getElementById('true-count-display');
  const penetrationEl = document.getElementById('penetration-display');

  const btnDeal = document.getElementById('btn-deal');
  const btnHit = document.getElementById('btn-hit');
  const btnStand = document.getElementById('btn-stand');
  const btnDouble = document.getElementById('btn-double');
  const btnSplit = document.getElementById('btn-split');
  const btnSurrender = document.getElementById('btn-surrender');

  // 3. Gestión de Pestañas
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');

      if (tab.dataset.target === 'tab-strategy') {
        renderStrategyTables();
      } else if (tab.dataset.target === 'tab-quiz' && !quiz.currentQuestion) {
        quiz.generateQuestion();
      } else if (tab.dataset.target === 'tab-mnemonics') {
        renderMnemonics();
      }
    });
  });

  // 4. Renderizado de la Mesa Principal
  function renderCardView(card, isSmall = false) {
    if (!card) return '';
    const colorClass = card.isRed ? 'red' : 'black';
    return `
      <div class="card-view ${colorClass}">
        <div class="top-left">${card.rank}<br>${card.suit}</div>
        <div class="center-suit">${card.suit}</div>
        <div class="bottom-right">${card.rank}<br>${card.suit}</div>
      </div>
    `;
  }

  function renderTable() {
    dealerCardsContainer.innerHTML = '';
    if (table.dealerCards.length > 0) {
      table.dealerCards.forEach((c, idx) => {
        if (idx === 1 && table.dealerHidden) {
          dealerCardsContainer.innerHTML += `<div class="card-view hidden-card"></div>`;
        } else {
          dealerCardsContainer.innerHTML += renderCardView(c);
        }
      });
      if (table.dealerHidden) {
        dealerTotalDisplay.innerText = `[${table.dealerCards[0].value}]`;
      } else {
        const dEval = evaluateHand(table.dealerCards);
        dealerTotalDisplay.innerText = `[${dEval.total}] ${dEval.isBusted ? 'Bust!' : (dEval.isBlackjack ? 'Blackjack!' : '')}`;
      }
    } else {
      dealerTotalDisplay.innerText = '';
    }

    runningCountEl.innerText = table.runningCount > 0 ? `+${table.runningCount}` : table.runningCount;
    trueCountEl.innerText = table.trueCount > 0 ? `+${table.trueCount}` : table.trueCount;
    penetrationEl.innerText = `${table.shoe.penetrationPercent}%`;

    slotsContainer.innerHTML = '';
    table.slots.forEach((slot, sIdx) => {
      const isCurrentSlot = sIdx === table.currentSlotIndex;
      const slotDiv = document.createElement('div');
      slotDiv.className = `slot-box ${slot.type === 'EMPTY' ? 'empty' : ''} ${isCurrentSlot ? 'active-turn' : ''}`;

      let badgeClass = 'badge-empty';
      let typeLabel = 'Vacío';
      if (slot.type === 'HUMAN') { badgeClass = 'badge-human'; typeLabel = 'Jugador'; }
      else if (slot.type === 'BOT_BASIC') { badgeClass = 'badge-bot'; typeLabel = 'Bot Básica'; }
      else if (slot.type === 'BOT_COUNTER') { badgeClass = 'badge-bot'; typeLabel = 'Bot Hi-Lo'; }

      let handsHtml = '';
      if (slot.hands.length > 0) {
        slot.hands.forEach((hand, hIdx) => {
          const isCurrentHand = isCurrentSlot && hIdx === table.currentHandIndex;
          const hEval = evaluateHand(hand.cards);
          let outcomeTag = '';
          if (hand.result) {
            outcomeTag = `<span style="color:#f1c40f;font-weight:bold;">${hand.result}</span>`;
          }

          handsHtml += `
            <div class="hand-subbox ${isCurrentHand ? 'current-hand' : ''}">
              <div class="hand-cards-list">
                ${hand.cards.map(c => renderCardView(c, true)).join('')}
              </div>
              <div class="hand-score">
                Total: ${hEval.total} ${hEval.isSoft ? '(Soft)' : ''} ${outcomeTag}
              </div>
            </div>
          `;
        });
      }

      slotDiv.innerHTML = `
        <div class="slot-header">
          <span>Slot ${slot.id}</span>
          <span class="slot-type-badge ${badgeClass}" id="slot-type-toggle-${sIdx}" style="cursor:pointer;" title="Click para alternar tipo de jugador">${typeLabel}</span>
        </div>
        <div class="slot-bankroll">Saldo: $${slot.balance}</div>
        <div class="slot-hands-area">${handsHtml}</div>
        <div class="slot-bet-area">
          ${slot.type !== 'EMPTY' ? `
            <span>Apuesta: <span class="bet-chip">$${slot.baseBet}</span></span>
            ${table.phase === 'BETTING' || table.phase === 'SETTLED' ? `
              <div style="margin-top:4px;">
                <button class="chip-add-btn" data-slot="${sIdx}" data-amt="25">+25</button>
                <button class="chip-add-btn" data-slot="${sIdx}" data-amt="100">+100</button>
                <button class="chip-add-btn" data-slot="${sIdx}" data-amt="-25">-25</button>
              </div>
            ` : ''}
          ` : '<span style="color:#7f8c8d;">Inactivo</span>'}
        </div>
      `;

      slotsContainer.appendChild(slotDiv);

      document.getElementById(`slot-type-toggle-${sIdx}`).onclick = () => {
        if (table.phase !== 'BETTING' && table.phase !== 'SETTLED') return;
        const types = ['HUMAN', 'BOT_BASIC', 'BOT_COUNTER', 'EMPTY'];
        const next = types[(types.indexOf(slot.type) + 1) % types.length];
        slot.type = next;
        persistAll();
        renderTable();
      };
    });

    const isHumanTurn = table.currentSlotIndex !== -1 && 
                        table.slots[table.currentSlotIndex].type === 'HUMAN' && 
                        table.phase === 'PLAYER_TURNS';

    btnHit.disabled = !isHumanTurn;
    btnStand.disabled = !isHumanTurn;

    if (isHumanTurn) {
      const curSlot = table.slots[table.currentSlotIndex];
      const curHand = curSlot.hands[table.currentHandIndex];
      const canDouble = curHand.cards.length === 2 && curSlot.balance >= curHand.bet;
      const canSplit = curHand.cards.length === 2 && 
                       curHand.cards[0].value === curHand.cards[1].value && 
                       curSlot.balance >= curHand.bet && 
                       curSlot.hands.length < table.rules.maxSplits;
      const canSurr = curHand.cards.length === 2 && table.rules.allowSurrender;

      btnDouble.disabled = !canDouble;
      btnSplit.disabled = !canSplit;
      btnSurrender.disabled = !canSurr;

      const tipData = getRecommendedAction(curHand, table.dealerCards[0], {
        canDouble,
        canSplit,
        canSurrender: canSurr,
        trueCount: table.trueCount
      });

      liveTipBox.style.display = 'block';
      let htmlTip = `
        <div class="tip-title">Entrenador en Vivo:</div>
        Jugada óptima recomendada: <strong>${tipData.action}</strong>.<br>
        <small>${tipData.tip}</small>
      `;

      if (table.rules.showMathExplanation && tipData.mathExplanation) {
        htmlTip += `
          <div class="tip-math-card">
            <strong>Explicación Matemática (+EV):</strong> ${tipData.mathExplanation}
          </div>
        `;
      }
      liveTipBox.innerHTML = htmlTip;
    } else {
      btnDouble.disabled = true;
      btnSplit.disabled = true;
      btnSurrender.disabled = true;
      if (table.phase !== 'PLAYER_TURNS') {
        liveTipBox.style.display = 'none';
      }
    }

    btnDeal.disabled = table.isDealing || table.phase === 'PLAYER_TURNS' || table.phase === 'DEALING' || table.phase === 'DEALER_TURN';

    document.querySelectorAll('.chip-add-btn').forEach(btn => {
      btn.onclick = (e) => {
        const s = parseInt(e.target.dataset.slot, 10);
        const amt = parseInt(e.target.dataset.amt, 10);
        const slot = table.slots[s];
        slot.baseBet = Math.max(5, Math.min(slot.balance, slot.baseBet + amt));
        persistAll();
        renderTable();
      };
    });

    persistAll();
  }

  // Acciones del jugador
  btnDeal.onclick = () => table.startRound();
  btnHit.onclick = () => table.executeAction('H');
  btnStand.onclick = () => table.executeAction('S');
  btnDouble.onclick = () => table.executeAction('D');
  btnSplit.onclick = () => table.executeAction('P');
  btnSurrender.onclick = () => table.executeAction('Rh');

  // 5. Módulo de Conteo Hi-Lo
  const trainerCardStage = document.getElementById('trainer-card-stage');
  const trainerModeSelect = document.getElementById('trainer-mode');
  const trainerSpeedInput = document.getElementById('trainer-speed');
  const trainerBatchInput = document.getElementById('trainer-batch');
  const btnStartTrainer = document.getElementById('btn-start-trainer');
  const trainerInputBox = document.getElementById('trainer-input-box');
  const userCountInput = document.getElementById('user-count-input');
  const btnSubmitCount = document.getElementById('btn-submit-count');
  const trainerFeedback = document.getElementById('trainer-feedback');

  function renderTrainerCard(cards, current, total) {
    trainerCardStage.innerHTML = cards.map(c => renderCardView(c)).join('') + 
      `<div style="position:absolute;bottom:8px;right:12px;font-size:0.85rem;color:#bdc3c7;">Naipe ${current} / ${total}</div>`;
  }

  function handleTrainerFinished(total) {
    trainerCardStage.innerHTML = `<span style="font-size:1.3rem;font-weight:bold;color:#f1c40f;">¡Lote finalizado! Ingresa el conteo acumulado:</span>`;
    trainerInputBox.style.display = 'flex';
    userCountInput.value = '';
    userCountInput.focus();
  }

  function updateTrainerUIState(state) {
    btnStartTrainer.disabled = state.isRunning;
    trainerModeSelect.disabled = state.isRunning;
    trainerSpeedInput.disabled = state.isRunning;
    trainerBatchInput.disabled = state.isRunning;
    if (state.isRunning) {
      trainerFeedback.innerHTML = '';
      trainerInputBox.style.display = 'none';
    }
  }

  btnStartTrainer.onclick = () => {
    const mode = trainerModeSelect.value;
    const speed = parseInt(trainerSpeedInput.value, 10) || 1000;
    const batch = parseInt(trainerBatchInput.value, 10) || 12;
    trainer.start({ mode, speedMs: speed, batchSize: batch });
  };

  btnSubmitCount.onclick = () => {
    const res = trainer.submitAnswer(userCountInput.value);
    trainerInputBox.style.display = 'none';

    document.getElementById('stat-trainer-level').innerText = trainer.level;
    document.getElementById('stat-trainer-streak').innerText = trainer.stats.currentStreak;
    document.getElementById('stat-trainer-accuracy').innerText = 
      `${Math.round((trainer.stats.correctCount / Math.max(1, trainer.stats.drillsCompleted)) * 100)}%`;
    document.getElementById('stat-trainer-speed').innerText = `${trainer.speedMs}ms`;

    trainerFeedback.innerHTML = `
      <div style="padding:12px; border-radius:6px; background:${res.correct ? '#27ae60' : '#c0392b'}; font-weight:bold; margin-bottom:12px;">
        ${res.correct ? '¡Conteo Exacto!' : 'Conteo incorrecto.'} Conteo real acumulado: <strong>${res.actualCount > 0 ? '+'+res.actualCount : res.actualCount}</strong>.
        ${res.diff > 0 ? `(Diferencia: ${res.diff})` : ''}
        ${trainer.mode === 'progressive' && res.correct ? `<br>¡Avanzas al Nivel ${res.nextLevel}! (Próxima velocidad: ${res.nextSpeed}ms).` : ''}
      </div>

      <div class="hilo-analysis-card">
        <h4 style="color:var(--accent-gold);margin-bottom:6px;">Análisis Estratégico Hi-Lo (+EV):</h4>
        <p><strong>True Count estimado:</strong> ${res.tcEstimate > 0 ? '+'+res.tcEstimate : res.tcEstimate}</p>
        <p><strong>Apuesta óptima recomendada:</strong> ${res.bettingAdvice}</p>
        <p><strong>Desviación de juego:</strong> ${res.strategicDeviation}</p>
      </div>
    `;

    persistAll();
  };

  // Renderizar tips fijos de conteo
  const countingTipsContainer = document.getElementById('counting-didactic-tips');
  if (countingTipsContainer) {
    countingTipsContainer.innerHTML = COUNTING_TIPS.map(tip => `
      <div class="didactic-tip-card">
        <strong>${tip.title}</strong>
        <p>${tip.text}</p>
      </div>
    `).join('');
  }

  // 6. Modo Quiz Flashcard
  const quizPlayerHandDiv = document.getElementById('quiz-player-cards');
  const quizDealerCardDiv = document.getElementById('quiz-dealer-card');
  const quizFeedbackDiv = document.getElementById('quiz-feedback');
  const quizScoreDisplay = document.getElementById('quiz-score-display');

  function renderQuizQuestion(q) {
    quizPlayerHandDiv.innerHTML = q.playerHand.cards.map(c => renderCardView(c)).join('');
    quizDealerCardDiv.innerHTML = renderCardView(q.dealerCard);
    quizFeedbackDiv.innerHTML = '';
  }

  function renderQuizFeedback(f) {
    quizScoreDisplay.innerText = `Aciertos: ${f.stats.correct} / ${f.stats.total} | Racha: ${f.stats.streak} (Récord: ${f.stats.bestStreak})`;

    let htmlFeedback = `
      <div style="padding:12px; border-radius:6px; background:${f.isCorrect ? '#27ae60' : '#c0392b'}; margin-top:14px;">
        <strong>${f.isCorrect ? '¡Correcto!' : 'Jugada subóptima.'}</strong><br>
        Tu elección: ${f.chosenAction} | Óptima: <strong>${f.optimalAction}</strong><br>
        <small>${f.explanation}</small>
      </div>
    `;

    if (table.rules.showMathExplanation) {
      const fullAction = getRecommendedAction(quiz.currentQuestion.playerHand, quiz.currentQuestion.dealerCard);
      if (fullAction.mathExplanation) {
        htmlFeedback += `
          <div class="tip-math-card" style="margin-top:8px;">
            <strong>Demostración de Probabilidad:</strong> ${fullAction.mathExplanation}
          </div>
        `;
      }
    }

    htmlFeedback += `<button id="btn-next-quiz" style="margin-top:12px;padding:8px 16px;background:#f39c12;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Siguiente Mano →</button>`;
    quizFeedbackDiv.innerHTML = htmlFeedback;

    document.getElementById('btn-next-quiz').onclick = () => quiz.generateQuestion();
    persistAll();
  }

  document.querySelectorAll('.btn-quiz-action').forEach(btn => {
    btn.onclick = () => quiz.submitAnswer(btn.dataset.action);
  });

  // 7. Módulo de Mnemotecnia y Palacios de Memoria
  function renderMnemonics() {
    const container = document.getElementById('mnemonics-container');
    if (!container) return;

    container.innerHTML = `
      <div class="mnemonic-grid">
        <div class="mnemonic-card">
          <div class="mnemonic-badge">Bloque 1</div>
          <h3>La Sala de los Bustos (Dealer 2 al 6)</h3>
          <p><strong>La Regla de Oro:</strong> <em>"No te quemes tú si el repartidor tiene alta probabilidad de quemarse solo".</em></p>
          <ul>
            <li>El repartidor con 2 a 6 quiebra entre el <strong>35% y 42%</strong> de las veces.</li>
            <li>Con <strong>13 a 16 duro:</strong> ¡Plantarse siempre! No regales tu mano.</li>
            <li><strong>La excepción del 12:</strong> Solo pide carta contra 2 y 3 (el dealer se pasa menos y solo 4 cartas te queman a ti).</li>
          </ul>
        </div>

        <div class="mnemonic-card">
          <div class="mnemonic-badge">Bloque 2</div>
          <h3>El Pasillo del Doble Ataque (9, 10, 11)</h3>
          <p><strong>La Regla de Oro:</strong> <em>"El 11 es el rey del doblaje; el 10 es el príncipe; el 9 es el emboscador".</em></p>
          <ul>
            <li><strong>11:</strong> Dobla contra TODO (incluso contra As en la mayoría de reglas).</li>
            <li><strong>10:</strong> Dobla contra 2 al 9 (contra 10 o As, solo pide por paridad).</li>
            <li><strong>9:</strong> Dobla exclusivamente contra la zona más vulnerable del dealer (3, 4, 5 y 6).</li>
          </ul>
        </div>

        <div class="mnemonic-card">
          <div class="mnemonic-badge">Bloque 3</div>
          <h3>El Jardín de los Ases Suaves (A,2 a A,7)</h3>
          <p><strong>La Regla de la Suma:</strong> <em>"A,2 y A,3 buscan al 5 y al 6 (2+5=7 / 3+6=9)".</em></p>
          <ul>
            <li><strong>A,2 y A,3:</strong> Doblan solo vs 5 y 6.</li>
            <li><strong>A,4 y A,5:</strong> Doblan vs 4, 5 y 6.</li>
            <li><strong>A,6 y A,7:</strong> Doblan vs 3, 4, 5 y 6.</li>
            <li><strong>A,7:</strong> Se planta contra 2, 7 y 8; dobla vs 3-6; pide contra 9, 10 y As.</li>
          </ul>
        </div>

        <div class="mnemonic-card">
          <div class="mnemonic-badge">Bloque 4</div>
          <h3>La Bóveda de las Parejas</h3>
          <p><strong>El Mandamiento:</strong> <em>"Siempre Ases y 8s; Jamás 5s ni 10s".</em></p>
          <ul>
            <li><strong>Ases y 8s:</strong> Siempre dividir. Los 8s rescatan la peor mano (16 duro) y los Ases crean dos manos con potencial de 21.</li>
            <li><strong>5s y 10s:</strong> NUNCA dividir. Dos 5s son un 10 duro para doblar. Dos 10s son un 20 casi invencible.</li>
            <li><strong>2s, 3s, 6s, 7s:</strong> Se dividen contra las cartas débiles (hasta el 7).</li>
          </ul>
        </div>
      </div>
    `;
  }

  // 8. Renderizado Dinámico de Tablas de Estrategia
  function renderStrategyTables() {
    const hardContainer = document.getElementById('table-hard-totals');
    const softContainer = document.getElementById('table-soft-totals');
    const pairsContainer = document.getElementById('table-pairs-totals');
    const ill18Container = document.getElementById('table-ill18-body');

    const dealerHeaders = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

    function buildHtmlTable(matrix, labelPrefix) {
      let html = '<table class="strategy-table"><thead><tr><th>Mano</th>';
      dealerHeaders.forEach(dh => html += `<th>${dh}</th>`);
      html += '</tr></thead><tbody>';

      for (const [rowKey, rowData] of Object.entries(matrix)) {
        html += `<tr><td><strong>${labelPrefix} ${rowKey}</strong></td>`;
        dealerHeaders.forEach(dh => {
          const act = rowData[dh] || '-';
          html += `<td class="cell-${act}">${act}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }

    hardContainer.innerHTML = buildHtmlTable(BASIC_STRATEGY.hard, 'Duro');
    softContainer.innerHTML = buildHtmlTable(BASIC_STRATEGY.soft, 'Suave');
    pairsContainer.innerHTML = buildHtmlTable(BASIC_STRATEGY.pairs, 'Par');

    ill18Container.innerHTML = '';
    ILLUSTRIOUS_18.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${item.index}</td>
        <td><strong>${item.hand || (item.isPair ? 'Par de ' + item.pairRank + 's' : item.playerTotal)}</strong></td>
        <td>${item.dealer}</td>
        <td><strong>${item.triggerTC > 0 ? '+'+item.triggerTC : item.triggerTC}</strong></td>
        <td>${item.action}</td>
      `;
      ill18Container.appendChild(tr);
    });
  }

  // 9. Configuración de Reglas
  const ruleDecks = document.getElementById('rule-decks');
  const ruleS17 = document.getElementById('rule-s17');
  const ruleBjPayout = document.getElementById('rule-bj-payout');
  const ruleSurrender = document.getElementById('rule-surrender');
  const ruleShowMath = document.getElementById('rule-show-math');

  if (ruleDecks) ruleDecks.value = table.rules.decks;
  if (ruleS17) ruleS17.value = table.rules.dealerS17 ? 'S17' : 'H17';
  if (ruleBjPayout) ruleBjPayout.value = table.rules.blackjackPayout;
  if (ruleSurrender) ruleSurrender.checked = table.rules.allowSurrender;
  if (ruleShowMath) ruleShowMath.checked = table.rules.showMathExplanation;

  ruleDecks.onchange = (e) => {
    table.rules.decks = parseInt(e.target.value, 10);
    table.shoe = new table.shoe.constructor(table.rules.decks);
    table.runningCount = 0;
    persistAll();
    renderTable();
  };

  ruleS17.onchange = (e) => {
    table.rules.dealerS17 = e.target.value === 'S17';
    persistAll();
    renderTable();
  };

  ruleBjPayout.onchange = (e) => {
    table.rules.blackjackPayout = parseFloat(e.target.value);
    persistAll();
    renderTable();
  };

  ruleSurrender.onchange = (e) => {
    table.rules.allowSurrender = e.target.checked;
    persistAll();
    renderTable();
  };

  if (ruleShowMath) {
    ruleShowMath.onchange = (e) => {
      table.rules.showMathExplanation = e.target.checked;
      persistAll();
      renderTable();
    };
  }

  // Inicialización
  renderTable();
});
