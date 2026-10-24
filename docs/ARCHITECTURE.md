# System Architecture - JustQuizMe Unified Platform

The **JustQuizMe** platform is an interactive, multi-subject revision and examination suite engineered for UK A-Level curricula (**OCR Computer Science H446**, **OCR Mathematics H240**, and **AQA Physics 7408**).

---

## 1. High-Level Architecture

The platform unifies three distinct assessment portals and an interactive master launchpad under a single Node.js/Express server on port `3000`.

```
                      +------------------------------------------+
                      |         Browser Client (HTTP / WS)       |
                      +------------------------------------------+
                                           |
                   +-----------------------+-----------------------+
                   |                       |                       |
            / (Launchpad)             /cs (OCR CS)           /maths (OCR Maths)
                                           |
                                  /physics (AQA Phys)
                                           |
                                           v
                   +-----------------------------------------------+
                   |         Unified Express Gateway (3000)        |
                   +-----------------------------------------------+
                     |          |                 |          |
                     v          v                 v          v
                 [API Route] [CS Router]     [Maths Router] [Physics Router]
                     |          |                 |          |
                     |          +--------+--------+          |
                     |                   |                   |
                     v                   v                   v
             [Metrics Service]   [Quiz Service]       [Save Service]
                                         |                   |
                                         v                   v
                                  [Question Banks]     [Local JSON Data]
```

---

## 2. Server Architecture (`main/server/`)

The backend is built with zero third-party framework dependencies outside standard Node.js and Express. It follows a clean service-oriented design:

### A. Core Modules
- **`index.js`**: Application entry point. Mounts CORS headers, static asset directories, subject API routers, and single-page application fallback routes.
- **`config.js`**: Central configuration registry containing subject specs, time multipliers (1.07 min/mark for CS & Physics; 1.20 min/mark for Maths), and absolute filesystem roots.

### B. Specialized Routers
- **`routes/api.js`**: Telemetry and fleet metrics endpoint (`/api/metrics`) computing live totals across all question databases.
- **`routes/cs.js`**: Handles quiz catalog requests, sandboxed C# code execution, OCR pseudocode interpretation, and Little Man Computer (LMC) assembly evaluation.
- **`routes/maths.js`**: Serves mathematical question groups and hosts the symbolic Computer Algebra System (CAS) equivalence endpoint (`/cas/eval`).
- **`routes/physics.js`**: Question bank loading, diagram retrieval, and tolerance checkpointing.

### C. Services & Runners
- **`services/quiz-service.js`**: Reads, indexes, and normalizes question JSON files across both `past-paper` and `normal` practice directories.
- **`services/save-service.js`**: Thread-safe persistence layer for user test scores (`scores.json`) and in-flight exam saves (`save.json`) isolated within `main/data/{subject}/`.
- **`services/cas-evaluator.js`**: Symbolic math normalizer that parses algebraic expressions into canonical forms and performs numerical perturbation testing to determine algebraic equivalence.
- **`services/runners/`**:
  - `ocr-pseudo.js`: Abstract Syntax Tree (AST) interpreter for OCR Exam Reference Language.
  - `csharp-runner.js`: Sandboxed C# compilation and execution harness using native `.NET` SDK when available, with AST fallback.
  - `lmc-runner.js`: 100-mailbox Von Neumann architecture emulator for Little Man Computer assembly code.

---

## 3. Frontend Architecture (`main/public/`)

The client side uses **native browser ES Modules (`<script type="module">`)**, eliminating the need for bundlers, Webpack, Vite, Babel, or transpilations. Code is loaded directly into the browser and can be hot-reloaded with zero build latency.

### Directory Structure
```text
main/public/
├── home/                    # Master Launchpad & Showcase Portal
│   ├── index.html           # Master landing page & universal synthesizer
│   ├── styles.css           # Modern dark glassmorphic stylesheet
│   └── js/
│       ├── home-main.js     # Topic grid, telemetry & synthesizer cross-launcher
│       └── demos/           # Interactive physics chamber, wave & math canvases
│
├── cs/                      # OCR Computer Science JustQuizMe
│   ├── index.html           # Terminal layout sheet
│   ├── styles.css           # Authentic 43 KB Terminal Jade theme
│   └── js/                  # Clean ES Modules (state, taxonomy, renderers, runner)
│
├── maths/                   # OCR Mathematics JustQuizMe
│   ├── index.html           # Oxford Blue examination sheet
│   ├── styles.css           # Authentic 31 KB Oxford Blue KaTeX theme
│   └── js/                  # ES Modules (CAS engine, keypad, proofs, runner)
│
└── physics/                 # AQA Physics JustQuizMe
    ├── index.html           # AQA Orange assessment layout
    ├── styles.css           # Authentic 29 KB Technical Paper theme
    └── js/                  # ES Modules (tolerance recovery, accordion, runner)
```

---

## 4. Subject State Management

Each subject application maintains a predictable, isolated global state store (`S`) inside its `state.js` module:

```javascript
export const S = {
  quizzes: { normal: [], 'past-paper': [] }, // Loaded question manifest
  scores: [],                                // Historical attempts from scores.json
  save: null,                                // Active in-flight session
  room: 'past',                              // Active view: 'past' | 'practice' | 'history' | 'runner'
  quiz: null,                                // Currently active assessment object
  idx: 0,                                    // Current question pointer
  answers: {},                               // User answer state mapped by question ID
  elapsed: 0,                                // Clock seconds
  timerId: null,                             // Active interval handle
  mixed: {                                   // Synthesizer selection buffer
    topics: new Set(),
    subs: new Set(),
    m: 30,
    mode: 'standard'
  }
};
```

---

## 5. Universal Synthesizer Cross-Launch

The Master Homepage includes an interactive synthesizer that generates customized practice papers from any combination of topics across any subject:

1. User selects target subject, marks budget (e.g. 50 marks), and desired canonical topics.
2. The homepage builds a deep link URL:
   ```text
   http://localhost:3000/physics/?mode=custom&marks=50&topics=Waves,Electricity
   ```
3. Upon navigation, the subject's `main.js` detects `?mode=custom`, queries the question database, applies a **Knapsack Subset-Sum Algorithm** to select an exact marks match, and boots directly into exam mode with countdown timers enabled.
