# Custom Paper Synthesizer & Knapsack Algorithm

The **Custom Paper Synthesizer** allows students to generate bespoke examination papers with customizable mark targets (e.g. 20, 45, 60, or 100 marks) drawn from any combination of canonical syllabus units.

---

## 1. Algorithmic Overview

Selecting questions to hit an exact mark budget is an instance of the classical **Subset-Sum Problem** (a variation of the 0/1 Knapsack Problem).

Given a set of candidate questions $Q = \{q_1, q_2, \dots, q_n\}$, where each question has an integer mark value $m_i = \text{marks}(q_i)$, and a target mark budget $T$:

$$\text{maximize} \quad \sum_{i \in S} m_i \le T \quad \text{subject to} \quad S \subseteq \{1, 2, \dots, n\}$$

Ideally, the algorithm seeks an exact match $\sum_{i \in S} m_i = T$. If an exact match is mathematically impossible due to the discrete question mark distributions, the algorithm selects the maximal subset $S$ that satisfies $\sum_{i \in S} m_i \le T$.

---

## 2. Dynamic Programming Implementation

The question picker is implemented in JavaScript via 1D array Dynamic Programming:

```javascript
export function pickExact(pool, target) {
  target = Math.max(1, Math.round(target));
  const dp = Array(target + 1).fill(null);
  dp[0] = [];

  for (const q of pool) {
    const m = +q.marks || 0;
    if (m <= 0 || m > target) continue;
    for (let s = target - m; s >= 0; s--) {
      if (dp[s] && !dp[s + m]) {
        dp[s + m] = [...dp[s], q];
      }
    }
  }

  // Find exact match or closest downward subset
  for (let s = target; s >= 0; s--) {
    if (dp[s] && dp[s].length) {
      return { set: dp[s], tot: s };
    }
  }

  return { set: pool.length ? [pool[0]] : [], tot: pool.length ? (+pool[0].marks || 0) : 0 };
}
```

### Time & Space Complexity
- **Time Complexity:** $O(N \cdot T)$, where $N$ is the number of filtered candidate questions and $T$ is the mark target (typically $10 \le T \le 100$). Runs in $< 2\text{ms}$ in the browser.
- **Space Complexity:** $O(T)$ auxiliary storage.

---

## 3. Pedagogical Question Ordering

After subset selection, the questions are organized into a pedagogically sound sequence:

```javascript
export function orderTypeShuffled(qs) {
  const groups = [[], [], [], [], [], [], []];
  const order = {
    'multiple-choice': 0, // Quick warm-up recall
    'truth-table': 1,     // Boolean logic
    'calculation': 2,     // Formula calculations
    'trace-table': 3,     // Dry-run simulation
    'written': 4,         // Short explanations
    'extended-response': 4,
    'lmc': 5,             // Low-level assembly
    'code-requirement': 6 // High-level programming
  };

  for (const q of qs) {
    (groups[order[q.type] ?? 4] || groups[4]).push(q);
  }

  return groups.flatMap(shuffle);
}
```

1. **Multiple Choice & Recall**: Warm-up low-cognitive-load retrieval questions.
2. **Boolean / Discrete Logic**: Intermediate structured tasks.
3. **Calculations**: Structured mathematical derivations.
4. **Trace Tables & Proofs**: Deep step-by-step reasoning.
5. **Written & Long-Form Essays**: Synthetic multi-paragraph questions.
6. **Programming / Assembly**: Complex terminal development challenges.

---

## 4. Cross-Subject Synthesizer Launch Protocol

The Master Homepage initiates cross-subject custom exams via standard URL query parameters:

```text
/?mode=custom&marks={marks}&topics={commaSeparatedTopicList}
```

### Example URLs
- **Physics**:
  `http://localhost:3000/physics/?mode=custom&marks=30&topics=Waves,Electricity`
- **Mathematics**:
  `http://localhost:3000/maths/?mode=custom&marks=40&topics=Differentiation,Integration`
- **Computer Science**:
  `http://localhost:3000/cs/?mode=custom&marks=50&topics=Systems%20Architecture,Algorithms%20%26%20Complexity`

When mounted, each subject app's `main.js` automatically filters the bank to the requested topic set, applies the Knapsack selector, sets the official countdown timer, and boots directly into exam mode.
