export const SUSPECTS = [
  "Miss Scarlett",
  "Col. Mustard",
  "Mrs. White",
  "Mr. Green",
  "Mrs. Peacock",
  "Prof. Plum",
];

export const WEAPONS = ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"];

export const ROOMS = [
  "Kitchen",
  "Ballroom",
  "Conservatory",
  "Billiard Room",
  "Library",
  "Study",
  "Hall",
  "Lounge",
  "Dining Room",
];

export const ROOM_GRID = [
  ["Kitchen", "Ballroom", "Conservatory"],
  ["Dining Room", "Study", "Billiard Room"],
  ["Lounge", "Hall", "Library"],
];

export const ROOM_ADJACENCY = {
  Kitchen: ["Ballroom", "Dining Room"],
  Ballroom: ["Kitchen", "Conservatory", "Billiard Room"],
  Conservatory: ["Ballroom", "Billiard Room"],
  "Billiard Room": ["Ballroom", "Conservatory", "Library"],
  Library: ["Billiard Room", "Study"],
  Study: ["Library", "Hall"],
  Hall: ["Study", "Lounge"],
  Lounge: ["Hall", "Dining Room"],
  "Dining Room": ["Lounge", "Kitchen"],
};

export const SECRET_PASSAGES = {
  Kitchen: "Study",
  Study: "Kitchen",
  Conservatory: "Lounge",
  Lounge: "Conservatory",
};

export const ALL_CARDS = [...SUSPECTS, ...WEAPONS, ...ROOMS];
export const ENVELOPE = "__ENVELOPE__";
export const CATEGORIES = { suspect: SUSPECTS, weapon: WEAPONS, room: ROOMS };
export const CARD_TYPE = Object.fromEntries([
  ...SUSPECTS.map((card) => [card, "suspect"]),
  ...WEAPONS.map((card) => [card, "weapon"]),
  ...ROOMS.map((card) => [card, "room"]),
]);

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function key(entity, card) {
  return `${entity}\u0000${card}`;
}

function cloneMap(map) {
  return new Map(map.entries());
}

export class KnowledgeBase {
  constructor(playerNames, myName, myCards, numCardsPerPlayer, skipInit = false) {
    this.playerNames = [...playerNames];
    this.myName = myName;
    this.numCardsPerPlayer = { ...numCardsPerPlayer };
    this.entities = [...this.playerNames, ENVELOPE];
    this.hasCard = new Map();
    this.clauses = [];

    for (const entity of this.entities) {
      for (const card of ALL_CARDS) {
        this.hasCard.set(key(entity, card), null);
      }
    }

    if (!skipInit) {
      this.initialize(myCards);
    }
  }

  initialize(myCards) {
    const mine = new Set(myCards);
    for (const card of ALL_CARDS) {
      this.assign(this.myName, card, mine.has(card));
    }
    for (const cards of Object.values(CATEGORIES)) {
      this.clauses.push({ entity: ENVELOPE, cards: new Set(cards) });
    }
    this.propagate();
  }

  clone() {
    const copy = new KnowledgeBase(this.playerNames, this.myName, [], this.numCardsPerPlayer, true);
    copy.entities = [...this.entities];
    copy.hasCard = cloneMap(this.hasCard);
    copy.clauses = this.clauses.map((clause) => ({
      entity: clause.entity,
      cards: new Set(clause.cards),
    }));
    return copy;
  }

  get(entity, card) {
    return this.hasCard.get(key(entity, card));
  }

  assign(entity, card, value) {
    const mapKey = key(entity, card);
    const current = this.hasCard.get(mapKey);
    if (current === value) return false;
    if (current !== null && current !== value) {
      throw new Error(`Conflicting assignment for ${entity} and ${card}`);
    }
    this.hasCard.set(mapKey, value);
    return true;
  }

  observeHand(player, card) {
    this.assign(player, card, true);
    this.propagate();
  }

  observeNoShow(player, suspect, weapon, room) {
    for (const card of [suspect, weapon, room]) {
      this.assign(player, card, false);
    }
    this.propagate();
  }

  observeShowedUnknown(player, suspect, weapon, room) {
    this.clauses.push({ entity: player, cards: new Set([suspect, weapon, room]) });
    this.propagate();
  }

  possibleOwners(card) {
    return this.entities.filter((entity) => this.get(entity, card) !== false);
  }

  envelopeCandidates(category) {
    return CATEGORIES[category].filter((card) => this.get(ENVELOPE, card) !== false);
  }

  confirmedOwner(card) {
    let owner = null;
    for (const entity of this.entities) {
      if (this.get(entity, card) === true) {
        if (owner && owner !== entity) throw new Error(`Multiple owners for ${card}`);
        owner = entity;
      }
    }
    return owner;
  }

  getSolution() {
    const solution = {};
    for (const [category, cards] of Object.entries(CATEGORIES)) {
      solution[category] = cards.find((card) => this.get(ENVELOPE, card) === true) || null;
    }
    return solution;
  }

  isSolved() {
    const solution = this.getSolution();
    return Boolean(solution.suspect && solution.weapon && solution.room);
  }

  metrics() {
    return {
      possibleOwners: ALL_CARDS.reduce((sum, card) => sum + this.possibleOwners(card).length, 0),
      confirmed: ALL_CARDS.filter((card) => this.confirmedOwner(card)).length,
      envelope: Object.keys(CATEGORIES).reduce(
        (sum, category) => sum + this.envelopeCandidates(category).length,
        0,
      ),
      clauses: this.clauses.length,
    };
  }

  scoreDelta(before) {
    const after = this.metrics();
    return (
      before.possibleOwners -
      after.possibleOwners +
      after.confirmed -
      before.confirmed +
      before.envelope -
      after.envelope +
      before.clauses -
      after.clauses
    );
  }

  propagate() {
    let changed = true;
    while (changed) {
      changed = false;

      for (const card of ALL_CARDS) {
        const owner = this.confirmedOwner(card);
        if (owner) {
          for (const entity of this.entities) {
            if (entity !== owner) changed = this.assign(entity, card, false) || changed;
          }
        } else {
          const possible = this.possibleOwners(card);
          if (possible.length === 1) changed = this.assign(possible[0], card, true) || changed;
        }
      }

      for (const player of this.playerNames) {
        const confirmed = ALL_CARDS.filter((card) => this.get(player, card) === true);
        const unknown = ALL_CARDS.filter((card) => this.get(player, card) === null);
        const remaining = this.numCardsPerPlayer[player] - confirmed.length;
        if (remaining < 0 || remaining > unknown.length) throw new Error(`${player} hand mismatch`);
        if (remaining === 0) {
          for (const card of unknown) changed = this.assign(player, card, false) || changed;
        }
        if (remaining === unknown.length) {
          for (const card of unknown) changed = this.assign(player, card, true) || changed;
        }
      }

      const reduced = [];
      for (const clause of this.clauses) {
        const remaining = [...clause.cards].filter((card) => this.get(clause.entity, card) !== false);
        if (remaining.length === 0) throw new Error(`Unsatisfied clause for ${clause.entity}`);
        if (remaining.some((card) => this.get(clause.entity, card) === true)) continue;
        if (remaining.length === 1) {
          changed = this.assign(clause.entity, remaining[0], true) || changed;
        } else {
          reduced.push({ entity: clause.entity, cards: new Set(remaining) });
        }
      }
      this.clauses = reduced;

      for (const [category, cards] of Object.entries(CATEGORIES)) {
        const trueCards = cards.filter((card) => this.get(ENVELOPE, card) === true);
        if (trueCards.length > 1) throw new Error(`Envelope has multiple ${category} cards`);
        if (trueCards.length === 1) {
          for (const card of cards) {
            if (card !== trueCards[0]) changed = this.assign(ENVELOPE, card, false) || changed;
          }
        } else {
          const candidates = this.envelopeCandidates(category);
          if (candidates.length === 0) throw new Error(`Envelope has no ${category} candidate`);
          if (candidates.length === 1) changed = this.assign(ENVELOPE, candidates[0], true) || changed;
        }
      }
    }
  }
}

export class BotPlayer {
  constructor(name, cards, allPlayers, numCardsPerPlayer) {
    this.name = name;
    this.cards = [...cards];
    this.currentRoom = pick(ROOMS);
    this.eliminated = false;
    this.isHuman = false;
    this.kb = new KnowledgeBase(allPlayers, name, cards, numCardsPerPlayer);
    this.recentSuggestions = [];
    this.recentRooms = [];
    this.noProgressStreak = 0;
    this.lastMetrics = null;
  }

  reachableRooms() {
    const rooms = new Set([this.currentRoom, ...(ROOM_ADJACENCY[this.currentRoom] || [])]);
    if (SECRET_PASSAGES[this.currentRoom]) rooms.add(SECRET_PASSAGES[this.currentRoom]);
    return [...rooms].sort();
  }

  finalizePreviousTurn() {
    if (!this.lastMetrics) return;
    const progress = this.kb.scoreDelta(this.lastMetrics) > 0;
    this.noProgressStreak = progress ? 0 : this.noProgressStreak + 1;
    this.lastMetrics = null;
  }

  shouldAccuse() {
    this.finalizePreviousTurn();
    return this.kb.isSolved();
  }

  chooseAccusation() {
    const solution = this.kb.getSolution();
    return [solution.suspect, solution.weapon, solution.room];
  }

  chooseSuggestion(responderOrder) {
    const candidates = [];
    for (const room of this.reachableRooms()) {
      for (const suspect of [...SUSPECTS].sort()) {
        for (const weapon of [...WEAPONS].sort()) {
          const move = [suspect, weapon, room];
          candidates.push({ move, score: this.scoreMove(move, responderOrder) });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.move.join("|").localeCompare(b.move.join("|")));
    const fresh = this.noProgressStreak >= 3
      ? candidates.filter((item) => !this.recentSuggestions.includes(item.move.join("|")))
      : candidates;
    const chosen = (fresh[0] || candidates[0]).move;
    this.recentSuggestions.push(chosen.join("|"));
    this.recentRooms.push(chosen[2]);
    this.recentSuggestions = this.recentSuggestions.slice(-6);
    this.recentRooms = this.recentRooms.slice(-6);
    this.lastMetrics = this.kb.metrics();
    return chosen;
  }

  scoreMove(move, responderOrder) {
    const [suspect, weapon, room] = move;
    const before = this.kb.metrics();
    let worst = Number.POSITIVE_INFINITY;
    let branches = 0;

    for (let i = 0; i < responderOrder.length; i += 1) {
      const responder = responderOrder[i];
      for (const card of [suspect, weapon, room]) {
        const branch = this.kb.clone();
        try {
          for (const prior of responderOrder.slice(0, i)) {
            branch.observeNoShow(prior, suspect, weapon, room);
          }
          if (branch.get(responder, card) !== false) {
            branch.observeHand(responder, card);
            worst = Math.min(worst, branch.scoreDelta(before));
            branches += 1;
          }
        } catch {
          // Ignore impossible hypothetical branches.
        }
      }
    }

    try {
      const branch = this.kb.clone();
      for (const responder of responderOrder) branch.observeNoShow(responder, suspect, weapon, room);
      worst = Math.min(worst, branch.scoreDelta(before));
      branches += 1;
    } catch {
      // Ignore impossible no-refute branch.
    }

    const pressure = [suspect, weapon, room].reduce((sum, card) => {
      const type = CARD_TYPE[card];
      return sum + this.kb.possibleOwners(card).length + (this.kb.envelopeCandidates(type).includes(card) ? 2 : 0);
    }, 0);
    const repeatPenalty = this.recentSuggestions.includes(move.join("|")) ? 8 : 0;
    return (branches ? worst : -1000) + pressure - repeatPenalty;
  }

  pickCardToShow(suspect, weapon, room) {
    return [suspect, weapon, room].filter((card) => this.cards.includes(card)).sort()[0];
  }
}

export class GameEngine {
  constructor(humanName = "Detective", numBots = 3) {
    this.humanName = humanName || "Detective";
    this.numBots = Math.max(1, Math.min(Number(numBots) || 3, 5));
    this.log = [];
    this.gameOver = false;
    this.winner = null;
    this.pendingSuggestion = null;
    this.awaitingHumanShow = false;
    this.setupGame();
  }

  setupGame() {
    this.solution = {
      suspect: pick(SUSPECTS),
      weapon: pick(WEAPONS),
      room: pick(ROOMS),
    };
    const remaining = shuffle(
      ALL_CARDS.filter(
        (card) =>
          card !== this.solution.suspect &&
          card !== this.solution.weapon &&
          card !== this.solution.room,
      ),
    );
    const botNames = Array.from({ length: this.numBots }, (_, index) => `Bot ${String.fromCharCode(65 + index)}`);
    this.playerNames = [this.humanName, ...botNames];
    const hands = Object.fromEntries(this.playerNames.map((name) => [name, []]));
    remaining.forEach((card, index) => hands[this.playerNames[index % this.playerNames.length]].push(card));
    const counts = Object.fromEntries(this.playerNames.map((name) => [name, hands[name].length]));

    this.players = {
      [this.humanName]: {
        name: this.humanName,
        cards: hands[this.humanName],
        currentRoom: pick(ROOMS),
        eliminated: false,
        isHuman: true,
      },
    };
    for (const botName of botNames) {
      this.players[botName] = new BotPlayer(botName, hands[botName], this.playerNames, counts);
    }

    this.turnOrder = [...this.playerNames];
    this.currentTurnIndex = 0;
    this.currentPlayerName = this.turnOrder[0];
    this.logEvent(`Game started. The solution is hidden. ${this.playerNames.length} players.`);
    this.logEvent(`Your cards: ${hands[this.humanName].join(", ")}`);
  }

  logEvent(msg, kind = "info") {
    this.log.push({ msg, kind });
  }

  isHumanTurn() {
    return this.currentPlayerName === this.humanName;
  }

  currentPlayer() {
    return this.players[this.currentPlayerName];
  }

  advanceTurn() {
    if (this.gameOver) return;
    const active = this.playerNames.filter((name) => !this.players[name].eliminated);
    if (active.length === 0) {
      this.gameOver = true;
      this.winner = null;
      return;
    }
    do {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
      this.currentPlayerName = this.turnOrder[this.currentTurnIndex];
    } while (this.players[this.currentPlayerName].eliminated);
  }

  responderOrder(askerName) {
    const start = (this.turnOrder.indexOf(askerName) + 1) % this.turnOrder.length;
    return Array.from({ length: this.turnOrder.length - 1 }, (_, offset) => this.turnOrder[(start + offset) % this.turnOrder.length]);
  }

  moveHuman(room) {
    this.players[this.humanName].currentRoom = room;
    this.logEvent(`${this.humanName} moves to the ${room}.`);
  }

  makeSuggestion(askerName, suspect, weapon, room) {
    const asker = this.players[askerName];
    if (this.players[suspect]) this.players[suspect].currentRoom = room;
    asker.currentRoom = room;
    this.logEvent(`${askerName} suggests: ${suspect}, ${weapon}, in ${room}`, "suggestion");
    this.pendingSuggestion = { asker: askerName, suspect, weapon, room };
    return this.resolveSuggestion(askerName, suspect, weapon, room);
  }

  resolveSuggestion(askerName, suspect, weapon, room) {
    for (const responderName of this.responderOrder(askerName)) {
      const responder = this.players[responderName];
      if (responder.eliminated) continue;
      const canShow = [suspect, weapon, room].filter((card) => responder.cards.includes(card));
      if (canShow.length === 0) {
        this.notifyNoShow(responderName, askerName, suspect, weapon, room);
        this.logEvent(`${responderName} cannot show any card.`, "nope");
        continue;
      }
      if (responder.isHuman) {
        this.awaitingHumanShow = true;
        return { type: "await_human_show", asker: askerName, cardsCanShow: canShow };
      }

      const card = responder.pickCardToShow(suspect, weapon, room, askerName);
      this.notifyShow(responderName, askerName, card, suspect, weapon, room);
      return {
        type: "shown",
        shower: responderName,
        asker: askerName,
        card: askerName === this.humanName ? card : null,
      };
    }
    this.logEvent("Nobody could refute the suggestion.", "alert");
    return { type: "no_refute" };
  }

  notifyNoShow(passer, asker, suspect, weapon, room) {
    for (const [name, player] of Object.entries(this.players)) {
      if (!player.isHuman && name !== passer) {
        try {
          player.kb.observeNoShow(passer, suspect, weapon, room);
        } catch {
          // Keep play moving if a public observation is inconsistent with a bot hypothesis.
        }
      }
    }
  }

  notifyShow(shower, asker, card, suspect, weapon, room) {
    if (asker === this.humanName) {
      this.logEvent(`${shower} shows you: ${card}`, "reveal");
    } else {
      this.logEvent(`${shower} shows ${asker} a card.`, "reveal");
    }
    for (const [name, player] of Object.entries(this.players)) {
      if (player.isHuman || name === shower) continue;
      try {
        if (name === asker) player.kb.observeHand(shower, card);
        else player.kb.observeShowedUnknown(shower, suspect, weapon, room);
      } catch {
        // A failed deduction should not break the browser session.
      }
    }
  }

  humanShowsCard(card) {
    const { asker, suspect, weapon, room } = this.pendingSuggestion;
    this.notifyShow(this.humanName, asker, card, suspect, weapon, room);
    this.awaitingHumanShow = false;
    return { type: "shown", shower: this.humanName, asker, card: null };
  }

  makeAccusation(accuserName, suspect, weapon, room) {
    const correct =
      suspect === this.solution.suspect &&
      weapon === this.solution.weapon &&
      room === this.solution.room;
    this.logEvent(`${accuserName} accuses: ${suspect}, ${weapon}, ${room}`, "accusation");
    if (correct) {
      this.logEvent(`${accuserName} is correct. Case closed.`, "win");
      this.gameOver = true;
      this.winner = accuserName;
      return { type: "correct", accuser: accuserName };
    }
    this.logEvent(`${accuserName} is wrong and eliminated.`, "wrong");
    this.players[accuserName].eliminated = true;
    if (this.playerNames.every((name) => this.players[name].eliminated)) {
      this.gameOver = true;
      this.winner = null;
    }
    return { type: "wrong", accuser: accuserName };
  }

  runBotTurn() {
    const botName = this.currentPlayerName;
    const bot = this.players[botName];
    if (bot.eliminated) {
      this.advanceTurn();
      return [{ type: "skip", player: botName }];
    }
    if (bot.shouldAccuse()) {
      const [suspect, weapon, room] = bot.chooseAccusation();
      const result = this.makeAccusation(botName, suspect, weapon, room);
      if (!this.gameOver) this.advanceTurn();
      return [result];
    }
    const [suspect, weapon, room] = bot.chooseSuggestion(this.responderOrder(botName));
    const result = this.makeSuggestion(botName, suspect, weapon, room);
    if (result.type !== "await_human_show" && !this.gameOver) this.advanceTurn();
    return [result];
  }

  getHumanCards() {
    return this.players[this.humanName].cards;
  }

  getHumanRoom() {
    return this.players[this.humanName].currentRoom;
  }

  getPlayerRooms() {
    return Object.fromEntries(this.playerNames.map((name) => [name, this.players[name].currentRoom]));
  }

  getPlayerCards() {
    return Object.fromEntries(this.playerNames.map((name) => [name, [...this.players[name].cards]]));
  }
}
