// app.js - Orquestador principal con persistencia LocalStorage, Mnemotecnia y Explicaciones EV
import { BlackjackEngine } from './engine.js';
import { CountingTrainer, COUNTING_TIPS } from './counting.js';
import { StrategyQuiz } from './quiz.js';
import { getStrategyTable, ILLUSTRIOUS_18, evaluateHand, getRecommendedAction } from './strategy.js';
import { GamificationManager, WORLDS_CONFIG, levelFromXp, HEART_REFILL_COST } from './gamification.js';
import { sounds } from './audio.js';
import { initializeProfessionalUI } from "./ui.js";

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
    allowDAS: true,
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
  }, { rules: { dealerS17: initialRules.dealerS17, allowSurrender: initialRules.allowSurrender } });

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
    quiz.cellStats = savedState.quiz.cellStats || {};
    quiz.missed = savedState.quiz.missed || [];
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
        stats: quiz.stats,
        cellStats: quiz.cellStats,
        missed: quiz.missed.slice(0, 20)
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
  let lastShownFeedback = null;
  let lessonSeqTimer = null;

  function showToast(message, ms = 2600) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  function updateRulesBanner() {
    const el = document.querySelector('.table-rules-banner');
    if (!el) return;
    const bj = table.rules.blackjackPayout === 1.5 ? '3 a 2' : '6 a 5';
    el.textContent = `Blackjack paga ${bj} • Dealer ${table.rules.dealerS17 ? 'se planta' : 'pide'} en 17 suave (${table.rules.dealerS17 ? 'S17' : 'H17'}) • ${table.rules.allowSurrender ? 'Rendición tardía' : 'Sin rendición'} • Sin seguro`;
  }

  // Sonido: botón de silencio persistente
  const btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    const paint = () => {
      btnSound.textContent = sounds.enabled ? '🔊' : '🔇';
      btnSound.setAttribute('aria-pressed', String(sounds.enabled));
    };
    btnSound.onclick = () => { sounds.setEnabled(!sounds.enabled); paint(); };
    paint();
  }

  // 3. Gestión de Pestañas
  document.querySelector('.nav-tabs')?.setAttribute('role', 'tablist');
  navTabs.forEach(t => {
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', String(t.classList.contains('active')));
  });
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      navTabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      const target = document.getElementById(tab.dataset.target);
      if (target) target.classList.add('active');

      if (tab.dataset.target === 'tab-strategy') {
        renderStrategyTables();
      } else if (tab.dataset.target === 'tab-quiz' && !quiz.currentQuestion) {
        quiz.generateQuestion();
      } else if (tab.dataset.target === 'tab-mnemonics') {
        renderMnemonics();
      } else if (tab.dataset.target === 'tab-gamification') { gamification.regenHearts(); renderGamificationTree(); updateGamificationStats(gamification.profile); }
    });
  });

  // 4. Renderizado de la Mesa Principal
  function renderCardView(card, isSmall = false, isNew = false) {
    if (!card) return '';
    const colorClass = card.isRed ? 'red' : 'black';
    const animClass = isNew ? 'card-deal-anim' : '';
    return `
      <div class="card-view ${colorClass} ${animClass}">
        <div class="top-left">${card.rank}<br>${card.suit}</div>
        <div class="center-suit">${card.suit}</div>
        <div class="bottom-right">${card.rank}<br>${card.suit}</div>
      </div>
    `;
  }

function renderTable() {
    updateRulesBanner();
    dealerCardsContainer.innerHTML = '';
    if (table.dealerCards.length > 0) {
      table.dealerCards.forEach((c, idx) => {
        const isLatestCard = (table.phase === 'DEALING' || table.phase === 'DEALER_TURN') && idx === table.dealerCards.length - 1;
        if (idx === 1 && table.dealerHidden) {
          dealerCardsContainer.innerHTML += `<div class="card-view hidden-card ${isLatestCard ? 'card-deal-anim' : ''}"></div>`;
        } else {
          dealerCardsContainer.innerHTML += renderCardView(c, false, isLatestCard);
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
                ${hand.cards.map((c, cIdx) => {
                  const isNew = (table.phase === 'DEALING' || isCurrentHand) && cIdx === hand.cards.length - 1;
                  return renderCardView(c, true, isNew);
                }).join('')}
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
            ` : ''}\n          ` : '<span style="color:#7f8c8d;">Inactivo</span>'}\n        </div>
      `;

      slotsContainer.appendChild(slotDiv);

      document.getElementById(`slot-type-toggle-${sIdx}`).onclick = () => {
        if (table.phase !== 'BETTING' && table.phase !== 'SETTLED') return;
        const types = ['HUMAN', 'BOT_BASIC', 'BOT_COUNTER', 'EMPTY'];
        const next = types[(types.indexOf(slot.type) + 1) % types.length];
        slot.type = next;
        slot.hands = [];
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
      const opts = table.getHandOptions(curSlot, curHand);
      btnDouble.disabled = !opts.canDouble;
      btnSplit.disabled = !opts.canSplit;
      btnSurrender.disabled = !opts.canSurrender;

      const tipData = getRecommendedAction(curHand, table.dealerCards[0], {
        ...opts,
        trueCount: table.trueCount,
        dealerS17: table.rules.dealerS17
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

    if (table.lastFeedback && table.lastFeedback !== lastShownFeedback) {
      lastShownFeedback = table.lastFeedback;
      const f = table.lastFeedback;
      showToast(f.isCorrect ? '✔ Jugada óptima' : `✘ Lo óptimo era ${f.optimal}${f.deviation ? ' (desviación por conteo)' : ''}`);
    }

    // Actualización dinámica del botón Repartir según el modo manual o automático
    const btnDealMode = document.getElementById('btn-deal-mode');
    if (btnDealMode) {
      btnDealMode.innerText = table.autoDeal ? 'Modo: Auto ⚡' : 'Modo: Manual 🖐️';
    }

    if (table.phase === 'DEALING') {
      if (table.autoDeal) {
        btnDeal.innerText = 'Repartiendo...';
        btnDeal.disabled = true;
      } else {
        const nextStep = table.dealQueue[table.dealQueueIndex];
        const stepNum = table.dealQueueIndex + 1;
        const totalSteps = table.dealQueue.length;
        btnDeal.innerText = `Repartir Naipe (${stepNum}/${totalSteps}) → ${nextStep ? nextStep.label : ''}`;
        btnDeal.disabled = false;
      }
    } else if (table.phase === 'BETTING' || table.phase === 'SETTLED') {
      btnDeal.innerText = 'Iniciar Reparto (Deal)';
      btnDeal.disabled = false;
    } else {
      btnDeal.innerText = 'Ronda en Juego';
      btnDeal.disabled = true;
    }

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
  btnDeal.onclick = () => {
    if (table.phase === 'DEALING') {
      table.dealNextStep();
    } else if (!table.startRound() && table.lastError === 'NO_FUNDS') {
      const human = table.slots.find(s => s.type === 'HUMAN') || table.slots[0];
      if (confirm('No hay fondos para apostar. ¿Recomprar $1000 virtuales?')) {
        table.rebuy(human.id, 1000);
      }
    }
  };
  const btnDealMode = document.getElementById('btn-deal-mode');
  if (btnDealMode) {
    btnDealMode.onclick = () => {
      table.toggleDealMode();
      renderTable();
    };
  }
  
  btnHit.onclick = () => table.executeAction('H');
  btnStand.onclick = () => table.executeAction('S');
  btnDouble.onclick = () => table.executeAction('D');
  btnSplit.onclick = () => table.executeAction('P');
  btnSurrender.onclick = () => table.executeAction('Rh');

  const gamification = new GamificationManager({
    onStateChange: updateGamificationStats,
    onLessonComplete: () => {
      renderGamificationTree();
      updateGamificationStats(gamification.profile);
    }
  }, { advancedKinds: true });

  function updateGamificationStats(prof) {
    const heartsEl = document.getElementById('duo-hearts');
    const streakEl = document.getElementById('duo-streak');
    const xpEl = document.getElementById('duo-xp');
    if (heartsEl) heartsEl.innerText = `${prof.hearts}/${prof.maxHearts}`;
    if (streakEl) streakEl.innerText = `${prof.streakDays} Días`;
    if (xpEl) xpEl.innerText = `${prof.xp} XP`;
    const gemsEl = document.getElementById('duo-gems');
    const levelEl = document.getElementById('duo-level');
    if (gemsEl) gemsEl.innerText = `${prof.gems}`;
    if (levelEl) levelEl.innerText = `Nv. ${levelFromXp(prof.xp)}`;
  }

  function renderGamificationTree() {
    const container = document.getElementById('gamification-tree-container');
    if (!container) return;
    container.innerHTML = '';

    WORLDS_CONFIG.forEach(w => {
      const worldDiv = document.createElement('div');
      worldDiv.className = 'world-block';
      worldDiv.innerHTML = `
        <h3 class="world-title">${w.title}</h3>
        <p class="world-desc">${w.description}</p>
        <div class="lesson-nodes-row" id="world-nodes-${w.id}"></div>
      `;
      container.appendChild(worldDiv);

      const row = worldDiv.querySelector(`#world-nodes-${w.id}`);
      w.lessons.forEach(l => {
        const isUnlocked = gamification.isLessonUnlocked(l.id);
        const isDone = (gamification.profile.completedLessons[l.id] || 0) > 0;
        const btn = document.createElement('button');
        btn.className = `lesson-node-btn ${isDone ? 'completed' : (isUnlocked ? 'unlocked' : '')}`;
        const playable = gamification.isPlayable(l);
        btn.disabled = !isUnlocked || !playable;
        btn.innerHTML = `<span>${isDone ? '★' : l.id}</span><small style="font-size:0.65rem;">${l.xp} XP</small>`;
        btn.title = playable ? l.title : `${l.title} (próximamente)`;
        btn.setAttribute('aria-label', `${l.title}${isDone ? ', completada' : (isUnlocked ? '' : ', bloqueada')}`);

        btn.onclick = () => openLessonModal(l.id);
        row.appendChild(btn);
      });
    });
  }

  function stopLessonSequence() {
    if (lessonSeqTimer) { clearTimeout(lessonSeqTimer); lessonSeqTimer = null; }
  }

  function closeLessonModal() {
    stopLessonSequence();
    document.getElementById('duo-lesson-modal').style.display = 'none';
    gamification.activeLesson = null;
    gamification.lessonState = null;
    renderGamificationTree();
    updateGamificationStats(gamification.profile);
  }

  const SEQUENCE_KINDS = ['deck_run', 'hidden_last_card', 'table_round', 'shoe_run'];

  function openLessonModal(lessonId) {
    const modal = document.getElementById('duo-lesson-modal');
    const title = document.getElementById('duo-modal-title');
    const stage = document.getElementById('duo-stage-area');
    const controls = document.getElementById('duo-interaction-controls');
    const progressBar = document.getElementById('duo-progress-fill');
    const banner = document.getElementById('duo-feedback-banner');

    function showBanner(ok, text) {
      banner.style.display = 'block';
      banner.className = `duo-feedback-banner ${ok ? 'ok' : 'bad'}`;
      banner.textContent = text;
    }

    function addChoices(values, label = v => v) {
      values.forEach(val => {
        const b = document.createElement('button');
        b.className = 'btn-action';
        b.innerText = label(val);
        b.onclick = () => answer(val);
        controls.appendChild(b);
      });
    }

    function addNumberAnswer(placeholder, step = '1') {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = step;
      input.placeholder = placeholder;
      input.className = 'lesson-number-input';
      input.setAttribute('aria-label', placeholder);
      const btn = document.createElement('button');
      btn.className = 'btn-action btn-deal';
      btn.innerText = 'Responder';
      const submit = () => {
        if (input.value === '') { showToast('Escribe un número'); return; }
        answer(input.value);
      };
      btn.onclick = submit;
      input.onkeydown = e => { if (e.key === 'Enter') submit(); };
      controls.append(input, btn);
      input.focus();
    }

    function runSequence(cards, speedMs, onDone) {
      stopLessonSequence();
      let idx = 0;
      const tick = () => {
        if (idx >= cards.length) { lessonSeqTimer = null; onDone(); return; }
        stage.innerHTML = `<div class="seq-counter">Naipe ${idx + 1} / ${cards.length}</div>${renderCardView(cards[idx])}`;
        sounds.playCard();
        idx++;
        lessonSeqTimer = setTimeout(tick, speedMs);
      };
      tick();
    }

    function renderStep(stepData, kind) {
      stopLessonSequence();
      stage.innerHTML = '';
      controls.innerHTML = '';
      banner.style.display = 'none';
      const sign = n => (n > 0 ? `+${n}` : `${n}`);

      if (kind === 'single_recognition') {
        stage.innerHTML = `
          <div style="font-size:1rem;margin-bottom:10px;">¿Cuál es el valor Hi-Lo de esta carta?</div>
          ${renderCardView(stepData.card)}
        `;
        addChoices(['-1', '0', '+1']);
      } else if (kind === 'pairs_cancellation') {
        stage.innerHTML = `
          <div style="font-size:1rem;margin-bottom:10px;">Cancelación Visual: ¿Suma neta del par?</div>
          <div style="display:flex;gap:8px;">${renderCardView(stepData.cards[0])}${renderCardView(stepData.cards[1])}</div>
        `;
        addChoices(['-2', '-1', '0', '+1', '+2']);
      } else if (kind === 'tc_drill') {
        stage.innerHTML = `
          <div style="font-size:1rem;margin-bottom:8px;">Convierte a True Count (TC = RC ÷ mazos restantes)</div>
          <div class="lesson-info-box">RC: <strong>${sign(stepData.rc)}</strong> · Mazos restantes: <strong>${stepData.remainingDecks}</strong></div>
        `;
        addNumberAnswer('TC', '0.1');
      } else if (kind === 'backcounting_entry') {
        stage.innerHTML = `
          <div style="font-size:1rem;margin-bottom:8px;">Observas la mesa desde afuera (Backcounting):</div>
          <div class="lesson-info-box">
            Running Count (RC): <strong>${sign(stepData.rc)}</strong><br>
            Mazos restantes en zapato: <strong>${stepData.remainingDecks}</strong><br>
            TC Real Calculado: <strong>${sign(stepData.tc)}</strong>
          </div>
          <div style="font-size:0.95rem;margin-top:10px;">¿Debes sentarte a jugar (+EV) o pasar de largo?</div>
        `;
        const bEnter = document.createElement('button');
        bEnter.className = 'btn-action btn-deal';
        bEnter.innerText = 'Sentarse a Apostar';
        bEnter.onclick = () => answer(true);
        const bPass = document.createElement('button');
        bPass.className = 'btn-action btn-stand';
        bPass.innerText = 'Esperar / Salir';
        bPass.onclick = () => answer(false);
        controls.append(bEnter, bPass);
      } else if (kind === 'tray_estimation') {
        const pct = Math.round((stepData.discardedCards / (stepData.totalDecks * 52)) * 100);
        stage.innerHTML = `
          <div style="font-size:1rem;margin-bottom:8px;">Bandeja de descarte: ${stepData.discardedCards} cartas jugadas de ${stepData.totalDecks} mazos</div>
          <div class="tray-bar" aria-label="${pct}% descartado"><div class="tray-fill" style="width:${pct}%"></div></div>
          <div style="font-size:0.95rem;margin-top:10px;">¿Cuántos mazos quedan en el zapato? (±0.5)</div>
        `;
        addNumberAnswer('Mazos restantes', '0.5');
      } else if (SEQUENCE_KINDS.includes(kind)) {
        const speed = stepData.speedMs || (kind === 'shoe_run' ? 600 : 750);
        const cumulative = stepData.cumulative ? ' (acumulado desde el inicio del zapato)' : '';
        runSequence(stepData.displayCards, speed, () => {
          if (kind === 'hidden_last_card') {
            stage.innerHTML = '<div style="font-size:1rem;">Falta 1 carta del mazo. ¿Cuál es su valor Hi-Lo?</div>';
            addChoices(['-1', '0', '+1']);
          } else {
            stage.innerHTML = `<div style="font-size:1rem;">¿Cuál es el Running Count${cumulative}?</div>`;
            addNumberAnswer('Running Count');
          }
        });
      }
    }

    function answer(value) {
      handleStepResult(gamification.submitLessonAnswer(value));
    }

    function handleStepResult(res) {
      if (!res) return;
      updateGamificationStats(gamification.profile);
      if (res.isCorrect) {
        if (res.finished) {
          progressBar.style.width = '100%';
        } else {
          progressBar.style.width = `${(res.progress / res.target) * 100}%`;
          showBanner(true, '¡Correcto!');
        }
        return;
      }
      if (res.finished) {
        stopLessonSequence();
        stage.innerHTML = '<h3>Lección fallida</h3><p style="font-size:0.95rem;">Te quedaste sin vidas o superaste los errores permitidos. Las vidas se regeneran con el tiempo o puedes recargarlas con gemas.</p>';
        controls.innerHTML = '<button class="btn-action btn-deal" id="btn-lesson-exit">Salir</button>';
        document.getElementById('btn-lesson-exit').onclick = closeLessonModal;
        banner.style.display = 'none';
        return;
      }
      // Fallo con vidas restantes: se repite la misma pregunta (las secuencias se reproducen de nuevo)
      const st = gamification.lessonState;
      if (st && SEQUENCE_KINDS.includes(st.kind)) renderStep(st.stepData, st.kind);
      showBanner(false, `Incorrecto. Te quedan ${res.heartsLeft} ❤️`);
    }

    progressBar.style.width = '0%';
    banner.style.display = 'none';

    const session = gamification.startLesson(lessonId, {
      onStep: stepData => renderStep(stepData, gamification.lessonState.kind),
      onComplete: res => {
        stopLessonSequence();
        stage.innerHTML = `<h3>¡Lección Superada!</h3><p>Ganaste +${res.xp} XP${res.firstTime ? ' y gemas por primera vez 💎' : ' (repetición: 25% del XP)'}.</p>`;
        controls.innerHTML = '<button class="btn-action btn-deal" id="btn-lesson-continue">Continuar</button>';
        banner.style.display = 'none';
        document.getElementById('btn-lesson-continue').onclick = closeLessonModal;
      }
    });

    if (!session) return;
    if (session.error === 'NO_HEARTS') {
      showToast('¡Sin vidas! Espera a que se regeneren (1 cada 30 min) o recárgalas con gemas.', 4000);
      return;
    }
    if (session.error === 'NOT_IMPLEMENTED') {
      showToast('Esta lección llegará pronto.');
      return;
    }

    title.innerText = gamification.activeLesson.title;
    modal.style.display = 'flex';
  }

  document.getElementById('btn-close-lesson').onclick = closeLessonModal;

  document.getElementById('btn-refill-hearts').onclick = () => {
    const prof = gamification.profile;
    if (prof.hearts >= prof.maxHearts) { showToast('Ya tienes todas las vidas'); return; }
    if (gamification.refillHearts()) showToast(`Vidas recargadas (-${HEART_REFILL_COST} 💎)`);
    else showToast(`Necesitas ${HEART_REFILL_COST} 💎. Completa lecciones para ganar gemas.`);
    updateGamificationStats(gamification.profile);
  };


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

  userCountInput.addEventListener('keydown', e => { if (e.key === 'Enter') btnSubmitCount.click(); });

  btnSubmitCount.onclick = () => {
    const res = trainer.submitAnswer(userCountInput.value);
    if (!res) return;
    if (res.invalid) { showToast('Escribe un número entero'); return; }
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

    if (table.rules.showMathExplanation && f.mathExplanation) {
      htmlFeedback += `
        <div class="tip-math-card" style="margin-top:8px;">
          <strong>Demostración de Probabilidad:</strong> ${f.mathExplanation}
        </div>
      `;
    }

    const weak = quiz.weakestCells(3);
    if (weak.length) {
      htmlFeedback += `
        <div class="tip-math-card" style="margin-top:8px;">
          <strong>Celdas a reforzar:</strong> ${weak.map(w => `${w.cell} (${Math.round(w.accuracy * 100)}%)`).join(' · ')}
        </div>
      `;
    }

    htmlFeedback += `<button id="btn-next-quiz" style="margin-top:12px;padding:8px 16px;background:#f39c12;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Siguiente Mano →</button>`;
    quizFeedbackDiv.innerHTML = htmlFeedback;
    quizFeedbackDiv.setAttribute("aria-live", "polite");

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

    const strategy = getStrategyTable(table.rules.dealerS17);

    function buildHtmlTable(matrix, labelPrefix, kind) {
      let html = '<table class="strategy-table"><thead><tr><th>Mano</th>';
      dealerHeaders.forEach(dh => html += `<th>${dh}</th>`);
      html += '</tr></thead><tbody>';

      for (const [rowKey, rowData] of Object.entries(matrix)) {
        html += `<tr><td><strong>${labelPrefix} ${rowKey}</strong></td>`;
        dealerHeaders.forEach(dh => {
          const act = rowData[dh] || '-';
          const cell = quiz.cellStats[`${kind}-${rowKey}-${dh}`];
          const acc = cell && cell.total >= 2 ? Math.round((cell.ok / cell.total) * 100) : null;
          const heat = acc === null ? '' : ` data-accuracy="${acc}" style="--acc:${acc}" title="Tu precisión: ${acc}% (${cell.total} intentos)"`;
          html += `<td class="cell-${act}"${heat}>${act}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody></table>';
      return html;
    }

    hardContainer.innerHTML = buildHtmlTable(strategy.hard, 'Duro', 'hard');
    softContainer.innerHTML = buildHtmlTable(strategy.soft, 'Suave', 'soft');
    pairsContainer.innerHTML = buildHtmlTable(strategy.pairs, 'Par', 'pair');

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
    table.shoe.penetration = 0.75;
    table.runningCount = 0;
    persistAll();
    renderTable();
  };

  ruleS17.onchange = (e) => {
    table.rules.dealerS17 = e.target.value === 'S17';
    quiz.setRules({ dealerS17: table.rules.dealerS17 });
    renderStrategyTables();
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
    quiz.setRules({ allowSurrender: table.rules.allowSurrender });
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

  // 10. Atajos de teclado: H, S, D, P, R (acción) y Espacio (repartir)
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    const key = e.key.toLowerCase();
    const activeTab = document.querySelector('.tab-content.active')?.id;

    if (activeTab === 'tab-table') {
      const map = { h: btnHit, s: btnStand, d: btnDouble, p: btnSplit, r: btnSurrender };
      if (map[key] && !map[key].disabled) { e.preventDefault(); map[key].click(); }
      else if ((key === ' ' || key === 'enter') && tag !== 'button' && !btnDeal.disabled) { e.preventDefault(); btnDeal.click(); }
    } else if (activeTab === 'tab-quiz' && quiz.currentQuestion && !quiz.currentQuestion.answered) {
      const actions = { h: 'H', s: 'S', d: 'D', p: 'P', r: 'Rh' };
      if (actions[key]) { e.preventDefault(); quiz.submitAnswer(actions[key]); }
    } else if (activeTab === 'tab-quiz' && key === 'enter' && document.getElementById('btn-next-quiz')) {
      e.preventDefault();
      quiz.generateQuestion();
    }
  });

  // Inicialización
  renderTable();
  updateGamificationStats(gamification.profile);
  initializeProfessionalUI();
});
