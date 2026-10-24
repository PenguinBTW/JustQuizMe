# JustQuizMe Documentation Index

Welcome to the technical documentation for the **JustQuizMe** unified revision and examination platform.

---

## Documentation Directory

| Document | Description |
| :--- | :--- |
| **[System Architecture](ARCHITECTURE.md)** | Unified server architecture, route registration, service layer, frontend module system, and state management. |
| **[Subject Engines](SUBJECT_ENGINES.md)** | Deep dive into specialized mechanics: CS Terminal IDE/LMC/Trace tables, Maths KaTeX & CAS symbolic engine, and Physics calculation tolerance recovery. |
| **[Question Bank Schema](QUESTION_SCHEMA.md)** | Complete JSON specification and authoring guide for creating questions across all interactive formats. |
| **[Custom Paper Synthesizer](CUSTOM_PAPER_SYNTHESIZER.md)** | Specification of the Knapsack dynamic programming subset-sum solver and pedagogical question sequencing. |
| **[Setup & Development](SETUP_AND_DEVELOPMENT.md)** | Quickstart installation, local configuration, mounting question banks, and containerized deployment. |

---

## Core Technologies
- **Backend:** Node.js, Express (zero heavy framework overhead).
- **Frontend:** Vanilla JavaScript (Native ES Modules, zero build step), Modern Semantic HTML5, CSS Variables.
- **Math Rendering:** KaTeX for hardware-accelerated LaTeX math display.
- **Simulation Engines:** In-browser Von Neumann 100-mailbox CPU (LMC), Abstract Syntax Tree (AST) OCR pseudocode interpreter, Client/Server Computer Algebra System (CAS).
