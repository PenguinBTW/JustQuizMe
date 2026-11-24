# Question Bank Schema & Authoring Guide

All question banks in **JustQuizMe** are stored as clean, human-readable JSON files. This guide defines the schema format, allowing contributors to author custom practice sets and mock examinations.

---

## 1. Quiz File Metadata Structure

Each quiz file (e.g. `questions/normal/sample_quiz.json`) starts with a top-level metadata wrapper:

```json
{
  "uuid": "b2f6b3e8-5a21-4f12-9c3b-789a1c2d3e4f",
  "version": 1,
  "title": "Algebraic Methods & Polynomial Division",
  "subject": "maths",
  "specCode": "H240/01",
  "topics": [
    "Algebra, Polynomials & Proof"
  ],
  "imageFolder": "images/pure_algebra_polynomials",
  "timeLimitMinutes": 45,
  "questions": [
    ...
  ]
}
```

### Top-Level Fields
| Field | Type | Description |
| :--- | :--- | :--- |
| `uuid` | `string` | Unique identifier (v4 UUID recommended). |
| `version` | `number` | Schema revision version (usually `1`). |
| `title` | `string` | Human-readable title displayed in the quiz library. |
| `subject` | `string` | Subject identifier: `'cs'`, `'maths'`, or `'physics'`. |
| `specCode` | `string` | Specification code (e.g. `'H446/01'`, `'H240/01'`, `'7408/1'`). |
| `topics` | `string[]` | Array of canonical major topics this paper covers. |
| `imageFolder` | `string` *(optional)* | Subdirectory path for diagram assets relative to image root. |
| `timeLimitMinutes` | `number` *(optional)* | Hard time limit for timed runs. If null, computed from marks. |
| `questions` | `object[]` | Array of question specification objects. |

---

## 2. Universal Question Properties

Every question object inherits the following baseline schema:

```json
{
  "id": "q1",
  "marks": 4,
  "type": "written",
  "topic": "Algebra, Polynomials & Proof",
  "subtopic": "Factor Theorem",
  "prompt": "Use the factor theorem to show that $(x - 2)$ is a factor of $P(x) = x^3 - 4x^2 + x + 6$.",
  "guidance": "Substitute $x = 2$ and evaluate $P(2)$.",
  "dependsOn": [
    { "id": "q0", "showAnswer": false }
  ]
}
```

### Common Fields
- **`id`** (`string`, required): Unique ID within the quiz.
- **`marks`** (`number`, required): Total marks allocated.
- **`type`** (`string`, required): The interactive question engine type (see below).
- **`topic`** (`string`, required): Major canonical syllabus topic.
- **`subtopic`** (`string`, optional): Granular subtopic unit.
- **`prompt`** (`string`, required): Question text. Supports standard Markdown, LaTeX math (`$...$`), and code blocks (```` ``` ````).
- **`guidance`** (`string`, optional): Contextual tip or examiner guidance note.
- **`image`** / **`images`** (`string` or `object[]`, optional): Relative image filename(s) of associated diagrams.
- **`dependsOn`** (`object[]`, optional): Links earlier questions in structured multi-part problems.

---

## 3. Specialized Question Type Schemas

### A. Multiple Choice (`multiple-choice`)
Used for single-select questions with immediate feedback.

```json
{
  "id": "mcq1",
  "type": "multiple-choice",
  "marks": 1,
  "prompt": "Which of the following describes a Von Neumann architecture feature?",
  "options": [
    "Separate memory buses for instructions and data",
    "Shared memory space for both program instructions and data",
    "Hardware-level Harvard instruction cache only",
    "Inability to store variables in RAM"
  ],
  "correctIndex": 1,
  "feedbackCorrect": "Correct! Von Neumann uses a single unified memory bus.",
  "feedbackWrong": "Incorrect. Option B is correct because instructions and data share the same memory."
}
```

---

### B. Written Response & Self-Marked Mark Scheme (`written`)
Used for short and long-form written explanations.

```json
{
  "id": "w1",
  "type": "written",
  "marks": 3,
  "prompt": "Explain the difference between a compiler and an interpreter.",
  "markScheme": [
    {
      "marks": 1,
      "text": "Compiler translates the entire high-level source code into machine code in one go before execution.",
      "highlights": ["entire high-level source code", "machine code in one go"]
    },
    {
      "marks": 1,
      "text": "Interpreter translates and executes source code line-by-line.",
      "highlights": ["line-by-line", "translates and executes"]
    },
    {
      "marks": 1,
      "text": "Compiled programs run faster at runtime / interpreted code allows easier debugging and cross-platform portability.",
      "highlights": ["run faster", "debugging"]
    }
  ]
}
```

---

### C. Numerical Calculation with Tolerance (`calculation`)
Used for discrete calculations in CS and tolerance-bounded calculations in Physics.

```json
{
  "id": "calc1",
  "type": "calculation",
  "marks": 3,
  "prompt": "A wave has a frequency of $5.0\\times 10^{14}\\text{ Hz}$ and travels at $3.0\\times 10^8\\text{ m/s}$. Calculate its wavelength in nanometres.",
  "answer": 600,
  "unit": "nm",
  "tolerance": {
    "min": 595,
    "max": 605
  },
  "stepChecks": [
    { "label": "Step 1: Formula $\\lambda = c / f$", "marks": 1 },
    { "label": "Step 2: Substitution $\\lambda = 3.0\\times 10^8 / 5.0\\times 10^{14} = 6.0\\times 10^{-7}\\text{ m}$", "marks": 1 },
    { "label": "Step 3: Conversion to nanometres ($600\\text{ nm}$)", "marks": 1 }
  ]
}
```

---

### D. Trace Table Dry Run (`trace-table`)
Used in Computer Science for algorithmic simulation.

```json
{
  "id": "tr1",
  "type": "trace-table",
  "marks": 4,
  "prompt": "Complete the trace table for the algorithm when `arr = [3, 1, 4]`.",
  "codeSnippet": "for i = 0 to 2\n  sum = sum + arr[i]\nnext i",
  "columns": ["i", "arr[i]", "sum", "output"],
  "initialRows": [
    ["-", "-", "0", "-"]
  ],
  "expectedRows": [
    ["0", "3", "3", "-"],
    ["1", "1", "4", "-"],
    ["2", "4", "8", "8"]
  ]
}
```

---

### E. Boolean Logic Truth Table (`truth-table`)
Used in Computer Science for logic circuit verification.

```json
{
  "id": "tt1",
  "type": "truth-table",
  "marks": 3,
  "prompt": "Complete the truth table for the boolean function $Q = \\overline{A \\land B}$.",
  "inputs": ["A", "B"],
  "outputs": ["A AND B", "Q"],
  "rows": [
    { "inputs": [0, 0], "expected": [0, 1] },
    { "inputs": [0, 1], "expected": [0, 1] },
    { "inputs": [1, 0], "expected": [0, 1] },
    { "inputs": [1, 1], "expected": [1, 0] }
  ]
}
```

---

### F. Little Man Computer Assembly (`lmc`)
Used in Computer Science for assembly language coding.

```json
{
  "id": "lmc1",
  "type": "lmc",
  "marks": 5,
  "prompt": "Write an LMC program that reads two numbers, calculates their difference (First - Second), and outputs the result.",
  "starterCode": "// Enter your LMC assembly code here:\nINP\nSTA FIRST\nINP\n",
  "requirements": [
    {
      "description": "Outputs 3 when inputs are 7 and 4",
      "inputs": [7, 4],
      "expectedOutputs": [3],
      "marks": 2
    },
    {
      "description": "Outputs 0 when inputs are 5 and 5",
      "inputs": [5, 5],
      "expectedOutputs": [0],
      "marks": 1
    },
    {
      "description": "Halts execution cleanly",
      "inputs": [10, 2],
      "expectedOutputs": [8],
      "marks": 2
    }
  ]
}
```

---

### G. Code Requirement & IDE Runner (`code-requirement`)
Used for programming problems in C# and OCR Pseudocode.

```json
{
  "id": "code1",
  "type": "code-requirement",
  "marks": 6,
  "prompt": "Write a function `isPalindrome(s)` that returns `true` if a string reads the same forwards and backwards, and `false` otherwise.",
  "allowedLanguages": ["ocr", "csharp"],
  "entryFunction": "isPalindrome",
  "starterCode": {
    "ocr": "function isPalindrome(s: String) -> Boolean\n  // Your code here\nendfunction",
    "csharp": "public static bool IsPalindrome(string s) {\n    // Your code here\n    return false;\n}"
  },
  "requirements": [
    { "description": "Returns true for 'radar'", "args": ["radar"], "expected": true, "marks": 2 },
    { "description": "Returns true for single letter 'a'", "args": ["a"], "expected": true, "marks": 2 },
    { "description": "Returns false for 'hello'", "args": ["hello"], "expected": false, "marks": 2 }
  ]
}
```

---

## 4. Examiner Feedback Annotations (`mistakes[]`, schema v1, optional)

Any question may carry a `mistakes` array describing common wrong answers and the misconception behind them. Banks without `mistakes` render exactly as before — the field is purely additive.

```json
{
  "mistakes": [
    {
      "optionIndex": 0,
      "misconception": "Confuses Von Neumann with Harvard architecture — separate buses is the Harvard design.",
      "correction": "Von Neumann stores instructions and data in one shared memory with a single bus."
    },
    {
      "pattern": "line by line",
      "misconception": "Attributes the interpreter's behaviour to compilers.",
      "correction": "Compilers translate the whole program before execution; line-by-line translation describes interpreters."
    }
  ]
}
```

- **MCQ**: `optionIndex` (integer) matches the selected distractor.
- **written / calculation / extended-response / self-marked**: `pattern` is matched case-insensitively as a substring of the student's answer text.
- `misconception` (required): what the student is probably thinking. `correction` (optional): the examiner-style fix.
