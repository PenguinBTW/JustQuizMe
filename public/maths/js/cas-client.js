// Client-Side CAS Symbolic Equivalence Checker for Mathematics

export function cleanMathStr(s) {
  if (s == null) return '';
  return String(s)
    .trim()
    .replace(/\s+/g, '')
    .replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')
    .replace(/\\ln/g, 'ln')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\pi/g, 'pi')
    .toLowerCase();
}

export function areMathEqual(actual, expected) {
  const a = cleanMathStr(actual);
  const e = cleanMathStr(expected);
  if (!a || !e) return false;
  if (a === e) return true;

  // Fraction equivalence (e.g. 16/3 vs 32/6)
  const fracRegex = /^\(?(-?\d+)\)?\/\(?(\d+)\)?$/;
  const matchA = a.match(fracRegex);
  const matchE = e.match(fracRegex);
  if (matchA && matchE) {
    return (+matchA[1] * +matchE[2]) === (+matchE[1] * +matchA[2]);
  }

  // Float equivalence
  const numA = Number(a);
  const numE = Number(e);
  if (!Number.isNaN(numA) && !Number.isNaN(numE)) {
    return Math.abs(numA - numE) < 1e-5;
  }

  return false;
}
