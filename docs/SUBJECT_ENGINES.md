# Subject Assessment Engines & Specialized Mechanics

Each subject in **JustQuizMe** has a dedicated evaluation engine engineered specifically for its exam board syllabus and interactive examination style.

---

## 1. Computer Science Engine (OCR H446)

The Computer Science engine simulates an authentic terminal workstation with a high-contrast dark green aesthetic ("Terminal Jade") and specialized technical evaluation harnesses.

```
+--------------------------------------------------------------------------+
|  custom-paper-synthesizer.sh                             [OCR H446 SPEC] |
+--------------------------------------------------------------------------+
|  Question 3 of 12 · 6 Marks                          ALGORITHM DRY RUN   |
|                                                                          |
|  Complete the trace table for the algorithm with inputs x=4, y=6.        |
|  +---------+---------+---------+---------+----------------------------+  |
|  |    x    |    y    |    m    |  output |                            |  |
|  +---------+---------+---------+---------+                            |  |
|  | [  4  ] | [  6  ] | [ 24  ] | [ 24  ] | [Interactive Cell Matrix]  |  |
|  +---------+---------+---------+---------+----------------------------+  |
|                                                                          |
|  [ Assembly / C# Editor / Trace Tables / Boolean Logic / Mark Schemes ]  |
+--------------------------------------------------------------------------+
```

### Specialized Question Types

1. **Trace Table Dry Runs (`trace-table`)**:
   - Renders interactive row-by-row matrix inputs.
   - Evaluates step-by-step algorithm variables (`x`, `y`, `flag`, loop counter, array index).
   - Grades against expected dry-run sequences with discrete cell normalization.

2. **Boolean Logic & Truth Tables (`truth-table`)**:
   - Generates dynamic boolean truth tables with interactive toggle buttons (`0` / `1`).
   - Evaluates boolean expressions (e.g. $A \land \overline{B \lor C}$) and checks completeness.

3. **Little Man Computer Assembly (`lmc`)**:
   - In-browser assembly editor with syntax highlighting and integrated CPU instruction cheat sheet (`INP`, `OUT`, `LDA`, `STA`, `ADD`, `SUB`, `BRP`, `BRZ`, `BRA`, `DAT`, `HLT`).
   - Server-side 100-mailbox Von Neumann CPU simulator runs user code against multiple input/output test vectors to verify accumulator, program counter, and flag registers.

4. **Programming & Software Requirements (`code-requirement`)**:
   - Supports both **C# (.NET)** and **OCR Exam Reference Language (Pseudocode)**.
   - **OCR Pseudocode Runtime**:
     - 100% self-contained in Node.js with zero external dependencies (no Python or external interpreter required).
     - Custom lexical parser converts OCR constructs (`function ... endfunction`, `procedure ... endprocedure`, `while ... endwhile`, `for i = 0 to n`, string indexing, 1D/2D arrays) into JavaScript AST executed in an isolated Node `vm` context.
     - Includes a mock Virtual File System (VFS) to evaluate file-handling questions (`openRead()`, `readLine()`, `writeLine()`, `closeFile()`).
   - **C# Execution Engine**:
     - Generates an auto-instrumented test harness with cryptographic execution tokens (`__RESULT_{nonce}_START__`).
     - Pre-injects OCR exam data structures (`Node`, `LinkedList`, `Board`, `Building`, `Character`, `Treasure`, `Video`) and default class attributes so snippet-based exam questions compile seamlessly without `CS0246` missing type errors.
     - Evaluates requirement test assertions (return values, console stdout, file mocks, method signatures).
     - Backed by native `.NET SDK` with automated container isolation (WSL2 + Bubblewrap) or sandboxed process host.

5. **Discrete Value Calculations (`calculation`)**:
   - Normalizes numeric representations across hex (`0x...`), binary (`0b...`), two's complement, and floating point mantissa/exponent formats.

6. **Extended Response Rubric (`extended-response`)**:
   - Levels of response (Level 1, Level 2, Level 3) mark breakdown for 9-mark and 12-mark essay questions.
   - Includes indicative content checklists and AO1/AO2/AO3 assessment objective rubrics.

---

## 2. Mathematics Engine (OCR H240)

The Mathematics portal is designed with an "Oxford Blue" examination aesthetic, powered by LaTeX rendering via KaTeX and real-time Computer Algebra System (CAS) equivalence.

```
+--------------------------------------------------------------------------+
|  OCR Mathematics H240                                [OXFORD BLUE SHEET] |
+--------------------------------------------------------------------------+
|  Question 4 of 14 · 5 Marks                      DIFFERENTIATION & ROOTS |
|                                                                          |
|  Find the exact stationary point of the curve  y = x^2 * e^(-3x).        |
|                                                                          |
|  Your Answer:  [ 2/3 * e^(-2)                              ] [Saved v]   |
|                                                                          |
|  [ π ] [ √x ] [ x² ] [ xⁿ ] [ ∫ ] [ dx ] [ ln ] [ eˣ ] [ sin ] [ cos ]   |
|  [ θ ] [ ≤  ] [ ≥  ] [ ≠  ] [ ± ] [ (  ] [  ) ] [ ·  ] [  /  ] [  ^  ]   |
|                                                                          |
|  CAS Check: ✓ Expression is algebraically equivalent                     |
+--------------------------------------------------------------------------+
```

### Specialized Question Types

1. **Symbolic CAS Exact Match (`cas-symbolic`)**:
   - Client and server-side symbolic equivalence engines normalize user mathematical inputs (e.g., recognizing that `2*(x + 3)`, `2x + 6`, and `6 + 2*x` are identical).
   - Numerical perturbation analysis verifies non-linear transcendental expressions ($e^x$, $\ln x$, $\sin x$, $\arctan x$).

2. **Virtual KaTeX Symbol Keypad**:
   - Inline virtual keypad for symbol insertion (`π`, `√x`, `x²`, `xⁿ`, `∫`, `dx`, `ln`, `eˣ`, `sin`, `cos`, `tan`, `θ`, `≤`, `≥`, `≠`, `±`).
   - Real-time LaTeX preview rendering math equations directly as the student types.

3. **Milestone Proof Verification (`proof`)**:
   - Step-by-step mathematical reasoning evaluator for Proof by Induction, Proof by Contradiction, and Exhaustion.
   - Grades standard OCR proof milestones ($M1$ method mark, $A1$ accuracy mark, conclusion statement).

4. **Show-That Self-Verifying Steps (`show-that`)**:
   - Presents progressive mathematical intermediate steps where students verify their algebraic derivations before advancing.

5. **Vectors & Mechanics Kinematics (`mechanics-vector`)**:
   - Handles vector notations ($\mathbf{i}$, $\mathbf{j}$, $\begin{pmatrix} x \\ y \end{pmatrix}$), resolve forces in 2D/3D, and moments about a pivot.

6. **Hypothesis Testing (`stats-hypothesis`)**:
   - Structured templates for null hypothesis $H_0$, alternative hypothesis $H_1$, critical values, test statistics, and contextual conclusions.

---

## 3. Physics Engine (AQA 7408)

The Physics portal features an "AQA Technical Orange" paper layout, engineered around high-precision experimental tolerances, diagram-based questions, and multi-step calculation checkpointing.

```
+--------------------------------------------------------------------------+
|  AQA Physics 7408                                        [TECHNICAL PAP] |
+--------------------------------------------------------------------------+
|  Question 7 of 16 · 4 Marks                            NUCLEAR & BINDING |
|                                                                          |
|  Calculate the binding energy per nucleon of Fe-56 in MeV.               |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  | [DIAGRAM: Nuclear Binding Energy Curve Crop - 25p2-q31_binding.png] |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
|  Value: [ 8.79            ]  Unit: [ MeV/nucleon ]                       |
|                                                                          |
|  Tolerance: [8.75 - 8.85] · Step 1: Mass defect · Step 2: E=mc²          |
|  [ ✓ Recovery Guidance: Error carried forward enabled ]                  |
+--------------------------------------------------------------------------+
```

### Specialized Question Types

1. **Numerical Calculations with Error Carry-Forward (`calc`)**:
   - Supports range tolerances (e.g., $8.75 \le x \le 8.85$).
   - Multi-step checkpoints: If a student makes an arithmetic slip in Step 1, the engine can award subsequent method marks based on their carried-forward value.
   - Significant figures detection and scientific notation parsing (`1.6e-19`).

2. **Diagram Crops & Technical Figures**:
   - Integrated image viewer displaying high-resolution vector and raster diagram crops (circuit diagrams, particle decay tracks, diffraction fringes, gravitational equipotentials).
   - Fallback image routing handles multiple resolution scales and dark-mode figure inversion.

3. **Multi-Choice Statement Grids (`multiple-choice`)**:
   - AQA-format 1-mark discrete multiple-choice questions with answer shuffling and immediate diagnostic reasoning explanations.

4. **Written Mark Scheme Checklists (`written`)**:
   - Official AQA mark point highlighting: Key technical terminology is underlined and automatically tagged as required marking phrases.
   - Self-marking checklists allow students to compare their written answer against official examiners' notes.

5. **Practical Skills & Measurement (`practical`)**:
   - Evaluates percentage uncertainties, absolute uncertainties, anomalous result identification, and gradient calculations from experimental lines of best fit.
