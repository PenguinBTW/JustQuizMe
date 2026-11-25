# JustQuizMe - Unified A-Level Revision Platform

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![ES Modules](https://img.shields.io/badge/Architecture-Native%20ES%20Modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
[![LaTeX](https://img.shields.io/badge/KaTeX-LaTeX%20Math-007ACC?logo=latex&logoColor=white)](https://katex.org/)

**This project is licensed under the PolyForm Small Business License 1.0.0 [`LICENSE.md`](./LICENSE.MD). This grants non-commercial parties full use of the software and allows small businesses under the defined revenue and employee thresholds to use it under the same terms.**

**For commercial Licensing beyond these thresholds email *vio@penguinbtw.com***

A unified, modular revision and examination platform engineered for UK A-Level curricula: **OCR Computer Science (H446)**, **OCR Mathematics (H240)**, and **AQA Physics (7408)**.

---

## 🌟 Overview

**JustQuizMe** unifies three specialized subject assessment applications and an interactive master launchpad into a cohesive single-port gateway on port `3000`.

Each subject features a tailored, authentic testing environment built specifically for its examination format:

| Subject | Exam Board & Spec | Portal Theme & Aesthetic | Specialized Interactive Engines |
| :--- | :--- | :--- | :--- |
| **Computer Science** | **OCR H446** | Terminal Jade (`custom-paper-synthesizer.sh`) | C# & OCR Pseudocode IDE Runner, Little Man Computer (LMC) Assembly Emulator, Algorithm Trace Tables, Boolean Truth Tables |
| **Mathematics** | **OCR H240** | Oxford Blue Examination Sheet | Real-Time Symbolic Computer Algebra System (CAS) Equivalence, KaTeX Virtual Math Keypad, Milestone Proof Steps ($M1/A1$), Vectors |
| **Physics** | **AQA 7408** | Technical Orange Assessment Sheet | Error Carry-Forward Calculation Tolerances, Technical Figure/Diagram Crops, Interactive Self-Marking Mark Scheme Checklists |

---

## 📊 Live Curriculum Metrics

The platform aggregates question banks across all supported curricula:

- **71 Total Assessment Papers**
- **1,704 Curated Questions**
- **4,282 Total Marks**
- **37 Canonical Specification Topics**

---

## ⚖️ Copyright, Exam Board Licensing & `.gitignore` Policy

> **Why are past-paper files excluded from this repository?**
>
> Official examination questions, past papers, mark schemes, and technical diagram crops produced by UK examination boards (**AQA** and **OCR**) are protected by copyright. To comply with copyright law, fair dealing, educational licensing, and GitHub policies:
>
> 1. **`.gitignore` Exclusion**: All directories matching `**/questions/past-paper/**`, `**/images/past-paper/**`, and `**/past-paper/**` are intentionally excluded from version control and will not be pushed to GitHub.
> 2. **Standard & Custom Practice Sets Included**: Non-past-paper question files, synthetic practice quizzes, and community-authored questions located in `**/questions/normal/**` **are fully included and tracked** in this repository.
> 3. **Mounting Past Papers Locally**: Users with legitimate personal access to past papers can mount them locally by placing the JSON files into `{Subject}/questions/past-paper/` and diagram crops into `{Subject}/questions/past-paper/images/`. The platform will automatically index and serve them on launch without modifying source code.

---

## 🚀 Quick Start

### 1. Requirements & Execution Tooling
- **Node.js**: `v18.0.0` or higher (`v20+` LTS recommended).
- **OCR Pseudocode & LMC**: **Zero external dependencies** (built-in JavaScript VM interpreter & emulator).
- **C# Execution Engine**: Requires [.NET SDK](https://dotnet.microsoft.com/download) (`v8.0`, `v9.0`, or `v10.0`) on `PATH` for running compiled unit test suites. (Structural syntax checks for snippet exam questions evaluate automatically via AST even without `.NET`).
- 🛡️ **Recommended for C# Security (Windows)**: **WSL2 + Bubblewrap Container Sandbox**. Provides true Linux kernel namespace isolation (`--unshare-all`), read-only system bindings, disabled network access, and ephemeral `/tmp` scratch workspaces. The server auto-detects this configuration when present. See the [WSL2 + Bubblewrap Setup Guide](docs/SETUP_AND_DEVELOPMENT.md#setting-up-the-recommended-wsl2--bubblewrap-c-sandbox).

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/justquizme.git
cd justquizme/main

# Install dependencies (Express only)
npm install
```

### 3. Launch the Platform
- **Windows Shortcut:** Double-click `Start-JustQuizMe.bat` (or execute `Start-JustQuizMe.ps1`).
- **Terminal:**
  ```bash
  npm start
  ```

### 4. Portal Access
Open your browser to:
- **Master Launchpad:** [http://localhost:3000/](http://localhost:3000/)
- **Computer Science JustQuizMe:** [http://localhost:3000/cs](http://localhost:3000/cs)
- **Mathematics JustQuizMe:** [http://localhost:3000/maths](http://localhost:3000/maths)
- **Physics JustQuizMe:** [http://localhost:3000/physics](http://localhost:3000/physics)

---

## 🏗️ Architecture & Highlights

```text
main/
├── server/
│   ├── index.js               # Unified Express gateway (Port 3000)
│   ├── config.js              # Subject registry, paths & time multipliers
│   ├── routes/                # Modular API routers (cs, maths, physics, api)
│   └── services/              # Quiz indexing, save persistence, CAS, runners
│
├── public/                    # Native ES Modules (Zero Build / No Webpack)
│   ├── home/                  # Master Launchpad & Showcase Portal
│   ├── cs/                    # OCR Computer Science terminal portal
│   ├── maths/                 # OCR Mathematics Oxford Blue portal
│   ├── physics/               # AQA Physics technical assessment portal
│   └── shared/                # Common styles, theme & knapsack algorithm
│
├── data/                      # Local user attempt history and saved progress
└── docs/                      # Comprehensive technical documentation
```

### Key Technical Achievements
1. **Single Unified Server**: Eliminates running multiple independent servers or batch files across different ports; all subjects and API endpoints run harmoniously on port `3000`.
2. **Zero-Build Simplicity**: Built using native browser ES Modules (`<script type="module">`). No Webpack, Vite, Babel, or transpilations required. Instant hot-reloading in the browser.
3. **Dynamic Knapsack Paper Synthesizer**: Implements a 1D dynamic programming subset-sum solver to generate custom exam papers matching exact marks budgets (e.g. 20m, 45m, 60m) across any combination of topics.
4. **Sandboxed Code Execution**: Real-time evaluation of C#, OCR Exam Reference Language, and Little Man Computer assembly language.
5. **Symbolic CAS Engine**: Normalizes algebraic expressions and verifies equivalence through canonical reduction and numerical perturbation.

---

## 📚 Technical Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

- 📐 **[System Architecture](docs/ARCHITECTURE.md)**: Server design, module patterns, routing strategy, and state management.
- ⚡ **[Subject Assessment Engines](docs/SUBJECT_ENGINES.md)**: In-depth mechanics for CS, Maths, and Physics runners.
- 📝 **[Question Bank Schema & Authoring Guide](docs/QUESTION_SCHEMA.md)**: JSON specifications for creating new questions and practice sets.
- 🎯 **[Custom Paper Synthesizer](docs/CUSTOM_PAPER_SYNTHESIZER.md)**: The Knapsack algorithm and pedagogical question sequencing.
- 🛠️ **[Setup & Deployment Guide](docs/SETUP_AND_DEVELOPMENT.md)**: Environment setup, question mounting, and Docker deployment.

---

## 📄 License

This software platform and its custom question engines are released under the [Polyform Non-Commercial](LICENSE). Standard practice sets authored for this platform are freely available for non-commercial educational use. Past examination materials remain the intellectual property of their respective examination boards (OCR and AQA).

## Authoring studio security

The question-authoring studio writes bank files to disk, so its save endpoint is loopback-only **and** validates the request `Host` header against a strict allowlist (`localhost`, `127.0.0.1`, `::1`) — a defense against DNS-rebinding drive-by writes. If you serve the portal over a custom local hostname alias, opt in explicitly:

```bash
JQM_AUTHOR_HOSTS="myalias.local,otherhost" node server/index.js
```

This is deliberately never enabled implicitly.
