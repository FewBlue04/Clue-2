import {
  ALL_CARDS,
  CARD_TYPE,
  GameEngine,
  ROOM_GRID,
  ROOMS,
  SUSPECTS,
  WEAPONS,
} from "./clue-web.js";

const app = document.querySelector("#app");
const state = {
  game: null,
  marks: {},
  revealed: {},
  lastReveal: null,
  showBotCards: false,
  botTimer: null,
};

const cardLabels = { suspect: "SUSPECT", weapon: "WEAPON", room: "ROOM" };

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char];
  });
}

function options(items, selected) {
  return items
    .map((item) => `<option value="${escapeHtml(item)}"${item === selected ? " selected" : ""}>${escapeHtml(item)}</option>`)
    .join("");
}

function button(label, action, extraClass = "") {
  return `<button class="${extraClass}" type="button" data-action="${action}">${label}</button>`;
}

function startGame() {
  const name = document.querySelector("#player-name").value.trim() || "Detective";
  const bots = Number(document.querySelector("#bot-count").value);
  state.game = new GameEngine(name, bots);
  state.marks = {};
  state.revealed = {};
  state.lastReveal = null;
  state.showBotCards = false;
  render();
  startTurn();
}

function clearBotTimer() {
  if (state.botTimer) window.clearTimeout(state.botTimer);
  state.botTimer = null;
}

function startTurn() {
  clearBotTimer();
  const game = state.game;
  if (!game || game.gameOver) {
    render();
    return;
  }
  render();
  if (!game.isHumanTurn()) {
    state.botTimer = window.setTimeout(() => {
      game.runBotTurn();
      if (!game.gameOver && !game.awaitingHumanShow) startTurn();
      else render();
    }, 650);
  }
}

function render() {
  if (!state.game) {
    renderSetup();
    return;
  }
  app.innerHTML = `
    <section class="shell">
      ${renderTopbar()}
      <section class="workspace">
        <section class="left-column">
          ${renderBoard()}
          ${renderLedger()}
          ${renderActionPanel()}
        </section>
        <aside class="right-column">
          ${renderLog()}
          ${renderNotebook()}
        </aside>
      </section>
    </section>
  `;
}

function renderSetup() {
  app.innerHTML = `
    <section class="setup-screen">
      <div class="setup-panel">
        <p class="kicker">Luxury Noir Edition</p>
        <h1>CLUE</h1>
        <form id="setup-form" class="setup-form">
          <label>
            <span>Your Name</span>
            <input id="player-name" maxlength="24" value="Detective" autocomplete="off" />
          </label>
          <label>
            <span>Bot Count</span>
            <input id="bot-count" type="number" min="1" max="5" value="3" />
          </label>
          <button class="primary wide" type="submit">Begin Investigation</button>
        </form>
      </div>
    </section>
  `;
  document.querySelector("#setup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    startGame();
  });
}

function renderTopbar() {
  const game = state.game;
  return `
    <header class="topbar">
      <div class="brand">
        <strong>CLUE</strong>
        <span>Case File</span>
      </div>
      <p>Turn: ${escapeHtml(game.currentPlayerName)}</p>
      <div class="top-actions">
        <label class="toggle">
          <input type="checkbox" data-action="toggle-bots"${state.showBotCards ? " checked" : ""} />
          <span>Show Bot Hands</span>
        </label>
        ${button("New Game", "new-game", "secondary")}
      </div>
    </header>
  `;
}

function renderBoard() {
  const rooms = state.game.getPlayerRooms();
  const roomPlayers = {};
  for (const [player, room] of Object.entries(rooms)) {
    roomPlayers[room] ||= [];
    roomPlayers[room].push(player);
  }
  return `
    <section class="panel board-panel">
      <h2>Mansion Map</h2>
      <div class="board">
        ${ROOM_GRID.flatMap((row) => row)
          .map((room) => {
            const players = roomPlayers[room] || [];
            const humanHere = rooms[state.game.humanName] === room;
            return `
              <article class="room ${humanHere ? "current-room" : ""}">
                <span class="room-accent"></span>
                <h3>${escapeHtml(room)}</h3>
                <div class="tokens">
                  ${players
                    .map((player) => {
                      const isHuman = player === state.game.humanName;
                      const eliminated = state.game.players[player].eliminated;
                      return `<span class="token ${isHuman ? "human" : ""} ${eliminated ? "eliminated" : ""}">${escapeHtml(isHuman ? "YOU" : player.replace("Bot ", "B"))}</span>`;
                    })
                    .join("")}
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderCard(card) {
  const type = CARD_TYPE[card];
  return `
    <span class="card ${type}">
      <strong>${escapeHtml(card)}</strong>
      <small>${cardLabels[type]}</small>
    </span>
  `;
}

function renderLedger() {
  const game = state.game;
  const botCards = state.showBotCards
    ? game.playerNames
        .filter((name) => name !== game.humanName)
        .map((name) => `
          <div class="bot-hand">
            <strong>${escapeHtml(name)}</strong>
            <div>${game.players[name].cards.map(renderCard).join("")}</div>
          </div>
        `)
        .join("")
    : "";
  return `
    <section class="panel ledger">
      <h2>Case Ledger</h2>
      <h3>Your Cards</h3>
      <div class="card-row">${game.getHumanCards().map(renderCard).join("")}</div>
      ${
        state.lastReveal
          ? `<div class="reveal"><small>Latest Reveal</small><strong>${escapeHtml(state.lastReveal.shower)} showed you ${escapeHtml(state.lastReveal.card)}</strong></div>`
          : ""
      }
      ${botCards ? `<div class="bot-hands">${botCards}</div>` : ""}
    </section>
  `;
}

function renderActionPanel() {
  const game = state.game;
  if (game.gameOver) return renderGameOver();
  if (game.awaitingHumanShow) return renderShowCardPanel();
  if (!game.isHumanTurn()) {
    return `
      <section class="panel action-panel">
        <h2>Action</h2>
        <p>${escapeHtml(game.currentPlayerName)} is considering the case.</p>
      </section>
    `;
  }
  return `
    <section class="panel action-panel">
      <h2>Action</h2>
      <p>You are in the ${escapeHtml(game.getHumanRoom())}. Choose your next move.</p>
      <div class="controls">
        ${button("Make Suggestion", "suggestion", "primary")}
        ${button("Make Accusation", "accusation", "danger")}
        ${button("Move Room", "move", "secondary")}
      </div>
      <div id="inline-form"></div>
    </section>
  `;
}

function renderShowCardPanel() {
  const pending = state.game.pendingSuggestion;
  const cards = state.game.getHumanCards().filter((card) =>
    [pending.suspect, pending.weapon, pending.room].includes(card),
  );
  return `
    <section class="panel action-panel">
      <h2>Show a Card</h2>
      <p>${escapeHtml(pending.asker)} made a suggestion. Choose one card to show.</p>
      <form id="show-form" class="inline-grid">
        <select id="show-card">${options(cards, cards[0])}</select>
        <button class="primary" type="submit">Show Card</button>
      </form>
    </section>
  `;
}

function renderGameOver() {
  const game = state.game;
  const title = game.winner === game.humanName
    ? "Case Closed: You Win"
    : game.winner
      ? `Case Closed: ${game.winner} Wins`
      : "Case Unsolved";
  return `
    <section class="panel action-panel game-over">
      <h2>${escapeHtml(title)}</h2>
      <p>Solution: <strong>${escapeHtml(game.solution.suspect)} | ${escapeHtml(game.solution.weapon)} | ${escapeHtml(game.solution.room)}</strong></p>
      <div class="final-hands">
        ${game.playerNames
          .map((name) => `
            <div class="bot-hand">
              <strong>${escapeHtml(name)}</strong>
              <div>${game.players[name].cards.map(renderCard).join("")}</div>
            </div>
          `)
          .join("")}
      </div>
      ${button("Play Again", "new-game", "primary")}
    </section>
  `;
}

function renderLog() {
  return `
    <section class="panel log-panel">
      <h2>Detective Log</h2>
      <div class="log-list">
        ${state.game.log
          .slice(-80)
          .map((entry) => `<p class="${escapeHtml(entry.kind)}">${escapeHtml(entry.msg)}</p>`)
          .join("")}
      </div>
    </section>
  `;
}

function markFor(card) {
  if (state.game.getHumanCards().includes(card) || state.revealed[card]) return "known";
  return state.marks[card] || "unknown";
}

function renderNotebook() {
  const game = state.game;
  const botNames = game.playerNames.filter((name) => name !== game.humanName);
  const botHeaders = botNames.map((name) => `<span>${state.showBotCards ? escapeHtml(name.replace("Bot ", "B")) : ""}</span>`).join("");
  const rows = [
    ["Suspects", SUSPECTS],
    ["Weapons", WEAPONS],
    ["Rooms", ROOMS],
  ]
    .map(([title, cards]) => `
      <h3>${title}</h3>
      ${cards
        .map((card) => {
          const mark = markFor(card);
          const botCells = botNames
            .map((name) => {
              if (!state.showBotCards) return "<span></span>";
              const value = game.players[name].kb.get(name, card);
              return `<span class="${value === true ? "known" : value === false ? "ruled" : "unknown"}">${value === true ? "Y" : value === false ? "x" : "."}</span>`;
            })
            .join("");
          return `
            <button class="note-row" type="button" data-card="${escapeHtml(card)}"${mark === "known" ? " disabled" : ""}>
              <span>${escapeHtml(card)}</span>
              <span class="${mark}">${mark === "known" ? "Y" : mark === "ruled" ? "x" : "."}</span>
              ${botCells}
            </button>
          `;
        })
        .join("")}
    `)
    .join("");
  return `
    <section class="panel notebook">
      <h2>Detective Notebook</h2>
      <div class="note-head"><span></span><span>YOU</span>${botHeaders}</div>
      <div class="note-legend">Y known&nbsp;&nbsp; x ruled out&nbsp;&nbsp; . unknown</div>
      ${rows}
    </section>
  `;
}

function showInlineForm(kind) {
  const holder = document.querySelector("#inline-form");
  if (!holder) return;
  if (kind === "move") {
    holder.innerHTML = `
      <form id="move-form" class="inline-grid">
        <select id="move-room">${options(ROOMS, state.game.getHumanRoom())}</select>
        <button class="primary" type="submit">Move</button>
      </form>
    `;
  }
  if (kind === "suggestion") {
    holder.innerHTML = `
      <form id="suggestion-form" class="inline-grid three">
        <select id="suggest-suspect">${options(SUSPECTS, SUSPECTS[0])}</select>
        <select id="suggest-weapon">${options(WEAPONS, WEAPONS[0])}</select>
        <button class="primary" type="submit">Suggest in ${escapeHtml(state.game.getHumanRoom())}</button>
      </form>
    `;
  }
  if (kind === "accusation") {
    holder.innerHTML = `
      <form id="accusation-form" class="inline-grid four">
        <select id="accuse-suspect">${options(SUSPECTS, SUSPECTS[0])}</select>
        <select id="accuse-weapon">${options(WEAPONS, WEAPONS[0])}</select>
        <select id="accuse-room">${options(ROOMS, ROOMS[0])}</select>
        <button class="danger" type="submit">Accuse</button>
      </form>
    `;
  }
}

function handleSuggestionResult(result) {
  if (result.type === "shown" && result.card) {
    state.revealed[result.card] = true;
    state.lastReveal = { shower: result.shower, card: result.card };
  }
  if (!state.game.gameOver && !state.game.awaitingHumanShow) {
    state.game.advanceTurn();
    startTurn();
  } else {
    render();
  }
}

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  const noteEl = event.target.closest("[data-card]");
  if (noteEl && !noteEl.disabled) {
    const card = noteEl.dataset.card;
    state.marks[card] = state.marks[card] === "ruled" ? "known" : state.marks[card] === "known" ? "unknown" : "ruled";
    if (state.marks[card] === "unknown") delete state.marks[card];
    render();
    return;
  }
  if (!actionEl) return;
  const action = actionEl.dataset.action;
  if (action === "new-game") {
    clearBotTimer();
    state.game = null;
    render();
  }
  if (action === "toggle-bots") {
    state.showBotCards = actionEl.checked;
    render();
  }
  if (["move", "suggestion", "accusation"].includes(action)) showInlineForm(action);
});

document.addEventListener("submit", (event) => {
  if (!state.game) return;
  if (event.target.id === "move-form") {
    event.preventDefault();
    state.game.moveHuman(document.querySelector("#move-room").value);
    render();
  }
  if (event.target.id === "suggestion-form") {
    event.preventDefault();
    const result = state.game.makeSuggestion(
      state.game.humanName,
      document.querySelector("#suggest-suspect").value,
      document.querySelector("#suggest-weapon").value,
      state.game.getHumanRoom(),
    );
    handleSuggestionResult(result);
  }
  if (event.target.id === "accusation-form") {
    event.preventDefault();
    state.game.makeAccusation(
      state.game.humanName,
      document.querySelector("#accuse-suspect").value,
      document.querySelector("#accuse-weapon").value,
      document.querySelector("#accuse-room").value,
    );
    if (!state.game.gameOver) {
      state.game.advanceTurn();
      startTurn();
    } else {
      render();
    }
  }
  if (event.target.id === "show-form") {
    event.preventDefault();
    state.game.humanShowsCard(document.querySelector("#show-card").value);
    state.game.advanceTurn();
    startTurn();
  }
});

render();
