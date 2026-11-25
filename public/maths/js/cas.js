// Maths Symbolic CAS Equivalence Engine (Client-Side)
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

export function evalMathExprClient(expr, vars = {}) {
  try {
    let jsExpr = cleanMathStr(expr)
      .replace(/\^/g, '**')
      .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
      .replace(/\)([a-zA-Z0-9(])/g, ')*$1')
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/ln\(/g, 'Math.log(')
      .replace(/log\(/g, 'Math.log10(')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(')
      .replace(/\bpi\b/g, 'Math.PI');

    const varNames = Object.keys(vars);
    const varValues = Object.values(vars);
    const fn = new Function(...varNames, `return (${jsExpr});`);
    return fn(...varValues);
  } catch {
    return NaN;
  }
}

export function areMathEqual(actual, expected) {
  if (actual == null || expected == null) return false;
  const a = cleanMathStr(actual);
  const e = cleanMathStr(expected);
  if (!a || !e) return false;
  if (a === e) return true;

  // Exact Fractions check
  const fracRegex = /^\(?(-?\d+)\)?\/\(?(\d+)\)?$/;
  const matchA = a.match(fracRegex);
  const matchE = e.match(fracRegex);
  if (matchA && matchE) {
    if ((+matchA[1] * +matchE[2]) === (+matchE[1] * +matchA[2])) return true;
  }

  // Pure Float tolerance
  const numA = Number(a);
  const numE = Number(e);
  if (!Number.isNaN(numA) && !Number.isNaN(numE)) {
    if (Math.abs(numA - numE) < 1e-5) return true;
  }

  // Multi-point transcendental substitution check
  const vars1 = { x: 2.371, u: 3.149, t: 1.823, theta: 0.732, y: 4.195, a: 2.1, b: 3.4 };
  const v1a = evalMathExprClient(a, vars1);
  const v1e = evalMathExprClient(e, vars1);
  if (typeof v1a === 'number' && typeof v1e === 'number' && !isNaN(v1a) && !isNaN(v1e) && Math.abs(v1a - v1e) < 1e-5) {
    const vars2 = { x: 5.814, u: 1.932, t: 0.441, theta: 1.256, y: 2.718, a: 1.7, b: 5.2 };
    const v2a = evalMathExprClient(a, vars2);
    const v2e = evalMathExprClient(e, vars2);
    if (!isNaN(v2a) && !isNaN(v2e) && Math.abs(v2a - v2e) < 1e-5) return true;
  }

  return false;
}
