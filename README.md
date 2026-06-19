# Clue - Luxury Noir

Single-player Clue-style game against AI bots: a **constraint-based knowledge engine**,
deterministic bot policy, a local **Tkinter** desktop UI, and a static
**GitHub Pages edition** for instant browser play.

## Play Online

Open the GitHub Pages edition:

**https://fewblue04.github.io/Clue-2/**

The browser version runs entirely as static HTML, CSS, and JavaScript. There is
no server, install step, or download required.

## Requirements

- **Play online**: any modern browser.
- **Run locally**: Python **3.10+**.
- **Running the desktop game** uses only the Python standard library (no `pip install` required).
- **Running tests** requires [pytest](https://pytest.org/) (see Development).

## Run Locally

From this directory:

```bash
python main.py
```

`main.py` adds the project root to `sys.path` and starts the desktop UI via
`clue_game.app`.

## Tests

```bash
python -m pytest tests -q
```

Run this after changes to the engine, bot, or knowledge base. If you add
continuous integration, use the same command there so local checks match CI.

## Imports

All application code lives in the **`clue_game`** package. Examples:

- `from clue_game.game import GameEngine`
- `from clue_game.bot import BotPlayer`
- `from clue_game.cards import ROOMS, SUSPECTS`

Scripts at the project root (`main.py`, `simulate.py`) add the root to
`sys.path` so `clue_game` resolves when you run them from this folder.

## Layout

| Area | Role |
|------|------|
| `index.html` | GitHub Pages entrypoint for the browser-playable edition |
| `web/` | Static browser edition: JavaScript game logic, DOM UI, and CSS |
| `clue_game/` | Python package: rules, cards/constants, bot, knowledge base, state tracker, Tk UI |
| `clue_game/app.py` | Tkinter desktop UI (`ClueApp`) |
| `clue_game/game.py` | Python rules engine (`GameEngine`), event log |
| `clue_game/bot.py` / `clue_game/knowledge_base.py` | Bot policy and CSP-style deductions |
| `clue_game/cards.py` | Suspects, weapons, rooms, map adjacency |
| `main.py` | Desktop entrypoint |
| `simulate.py` | Headless trials for bot evaluation |
| `docs/` | Architecture, feature, and logic documentation |

## Development (optional)

Install dev tools once per environment:

```bash
pip install -e ".[dev]"
```

Or minimal installs:

```bash
pip install pytest ruff
```

- **Format / lint**:

  ```bash
  python -m ruff format .
  python -m ruff check .
  ```

  `python -m` avoids PATH issues on Windows if `ruff` is not on your shell path.
  Settings live in `pyproject.toml`.

- **Tests**: same as [Tests](#tests) above.

# Clue2 Documentation

This repository contains documentation for the Clue2 project, a browser-playable
and desktop implementation of the classic Clue board game featuring
constraint-based AI and a themed user interface.

## Documentation Structure

### Core Documentation

- **[architecture-spec.md](./docs/architecture-spec.md)** - Complete system architecture overview
- **[features-spec.md](./docs/features-spec.md)** - Detailed feature specifications
- **[propositional-logic-spec.md](./docs/propositional-logic-spec.md)** - AI logic and reasoning concepts

### Quick Reference

#### Architecture Overview

- **GitHub Pages Edition**: Static HTML/CSS/JavaScript browser build for online play
- **Desktop App**: Python/Tkinter local application
- **Game Engine**: Central rules enforcement and turn management
- **Knowledge Base**: Constraint satisfaction problem solver
- **Bot AI**: Deterministic one-step lookahead evaluation
- **State Tracking**: Append-only event history system

#### Key Concepts

- **Propositional Logic**: Boolean constraint matrix for card knowledge
- **Logical Propagation**: Iterative inference to logical closure
- **Minimax Reasoning**: Worst-case opponent response evaluation
- **Information Pressure**: Targeting high-uncertainty cards
- **Constraint Satisfaction**: CSP solver with multiple rule types

#### AI Features

- **Constraint-Based Deduction**: Automatic logical inference
- **One-Step Lookahead**: Simulate all possible response outcomes
- **Strategic Planning**: Balance exploration vs exploitation
- **Escape Mechanisms**: Avoid local optima and suggestion loops
- **Safe Accusations**: Only accuse when solution is certain

#### User Interface

- **Browser Edition**: Playable directly from GitHub Pages without installing anything
- **Luxury Noir Theme**: Sophisticated dark color scheme
- **Interactive Board**: Room visualization with player positions
- **Detective Notebook**: Knowledge tracking with user marks
- **Event Logging**: Color-coded game history
- **Responsive Controls**: Suggestion, movement, accusation, and reveal flows

## Getting Started

### For Players

1. Open **https://fewblue04.github.io/Clue-2/** to play in the browser.
2. Use `python main.py` only if you want the local desktop version.

### For Developers

1. Read the [architecture specification](./docs/architecture-spec.md) to understand the system design.
2. Review the [propositional logic documentation](./docs/propositional-logic-spec.md) for AI concepts.
3. Examine the [features specification](./docs/features-spec.md) for implementation details.

## Implementation Notes

### Code Organization

```text
.
|-- index.html          # GitHub Pages entrypoint
|-- web/                # Static browser edition
|-- clue_game/          # Python desktop app and core modules
|-- docs/               # Project documentation
|-- tests/              # Python test suite
```

### Extending the System

- Update `web/` when changing the GitHub Pages edition.
- Update `clue_game/` when changing the Python desktop version.
- Keep shared behavior documented when a gameplay rule changes in both editions.
- Run the Python tests after engine, bot, or knowledge-base changes.
