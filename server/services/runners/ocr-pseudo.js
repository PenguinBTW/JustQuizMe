// OCR A-Level Computer Science Pseudocode Transpiler & Sandboxed Evaluator
const vm = require('vm');
const { validateOcrPseudocodeSecurity } = require('./security');

/**
 * Transpiles OCR Reference Language (Pseudocode) into JavaScript.
 */
function transpileOcrPseudocode(sourceCode) {
  const lines = sourceCode.split(/\r?\n/);
  const jsLines = [];
  
  // Track loop counters for 'for' loops to handle 'next' or 'next i'
  const forStack = [];
  let currentClass = null;
  const classFields = {};

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    // Preserve comments
    if (line.startsWith('//') || line.startsWith('#')) {
      jsLines.push(line);
      continue;
    }
    if (!line) {
      jsLines.push('');
      continue;
    }

    // Strip inline comments for syntactic parsing but retain text inside strings
    let codePart = line;
    let commentPart = '';
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      codePart = line.substring(0, commentIdx).trim();
      commentPart = ' ' + line.substring(commentIdx);
    }

    let transformed = codePart;

    // OOP Class definitions
    if (/^class\s+([a-zA-Z0-9_]+)(?:\s+inherits\s+([a-zA-Z0-9_]+))?$/i.test(transformed)) {
      const match = transformed.match(/^class\s+([a-zA-Z0-9_]+)(?:\s+inherits\s+([a-zA-Z0-9_]+))?$/i);
      const className = match[1];
      const parentClass = match[2];
      currentClass = className;
      classFields[className] = new Set();
      transformed = parentClass ? `class ${className} extends ${parentClass} {` : `class ${className} {`;
    } else if (/^endclass$/i.test(transformed)) {
      currentClass = null;
      transformed = '}';
    }
    // Class field declarations: private name, public score, etc.
    else if (currentClass && /^(?:private|public|protected)\s+([a-zA-Z0-9_]+)$/i.test(transformed)) {
      const fieldName = transformed.match(/^(?:private|public|protected)\s+([a-zA-Z0-9_]+)$/i)[1];
      classFields[currentClass].add(fieldName);
      transformed = `${fieldName};`;
    }
    // Subroutine definitions (with optional public/private for OOP methods and constructors)
    else if (/^(?:(?:public|private|protected)\s+)?procedure\s+new\s*\((.*)\)/i.test(transformed)) {
      const args = transformed.match(/^(?:(?:public|private|protected)\s+)?procedure\s+new\s*\((.*)\)/i)[1];
      transformed = `constructor(${args}) {`;
    } else if (/^super\.new\s*\((.*)\)/i.test(transformed)) {
      const args = transformed.match(/^super\.new\s*\((.*)\)/i)[1];
      transformed = `super(${translateExpressions(args)});`;
    } else if (/^(?:(?:public|private|protected)\s+)?function\s+([a-zA-Z0-9_]+)\s*\((.*)\)/i.test(transformed)) {
      const match = transformed.match(/^(?:(?:public|private|protected)\s+)?function\s+([a-zA-Z0-9_]+)\s*\((.*)\)/i);
      transformed = currentClass ? `${match[1]}(${match[2]}) {` : `function ${match[1]}(${match[2]}) {`;
    } else if (/^(?:(?:public|private|protected)\s+)?procedure\s+([a-zA-Z0-9_]+)\s*\((.*)\)/i.test(transformed)) {
      const match = transformed.match(/^(?:(?:public|private|protected)\s+)?procedure\s+([a-zA-Z0-9_]+)\s*\((.*)\)/i);
      transformed = currentClass ? `${match[1]}(${match[2]}) {` : `function ${match[1]}(${match[2]}) {`;
    } else if (/^endfunction$/i.test(transformed) || /^endprocedure$/i.test(transformed)) {
      transformed = '}';
    }
    // Conditionals
    else if (/^if\s+(.*?)\s+then$/i.test(transformed)) {
      const cond = transformed.replace(/^if\s+(.*?)\s+then$/i, '$1');
      transformed = `if (${translateExpressions(cond)}) {`;
    } else if (/^elseif\s+(.*?)\s+then$/i.test(transformed)) {
      const cond = transformed.replace(/^elseif\s+(.*?)\s+then$/i, '$1');
      transformed = `} else if (${translateExpressions(cond)}) {`;
    } else if (/^else$/i.test(transformed)) {
      transformed = '} else {';
    } else if (/^endif$/i.test(transformed)) {
      transformed = '}';
    }
    // Loops: For loop
    else if (/^for\s+([a-zA-Z0-9_]+)\s*=\s*(.*?)\s+to\s+(.*?)(?:\s+step\s+(.*?))?$/i.test(transformed)) {
      const match = transformed.match(/^for\s+([a-zA-Z0-9_]+)\s*=\s*(.*?)\s+to\s+(.*?)(?:\s+step\s+(.*?))?$/i);
      const varName = match[1];
      const startVal = translateExpressions(match[2].trim());
      const endVal = translateExpressions(match[3].trim());
      const rawStep = match[4] ? match[4].trim() : '1';
      const stepVal = translateExpressions(rawStep);
      forStack.push(varName);

      const stepNum = Number(rawStep);
      const compOp = (!isNaN(stepNum) && stepNum < 0) ? '>=' : '<=';
      const incOp = rawStep === '1' ? `${varName}++` : `${varName} += ${stepVal}`;

      transformed = `for (let ${varName} = ${startVal}; ${varName} ${compOp} ${endVal}; ${incOp}) {`;
    } else if (/^next(?:\s+[a-zA-Z0-9_]+)?$/i.test(transformed)) {
      forStack.pop();
      transformed = '}';
    }
    // Loops: While loop
    else if (/^while\s+(.*)$/i.test(transformed)) {
      const cond = transformed.replace(/^while\s+(.*)$/i, '$1');
      transformed = `while (${translateExpressions(cond)}) {`;
    } else if (/^endwhile$/i.test(transformed)) {
      transformed = '}';
    }
    // Loops: Do Until loop
    else if (/^do$/i.test(transformed)) {
      transformed = 'do {';
    } else if (/^until\s+(.*)$/i.test(transformed)) {
      const cond = transformed.replace(/^until\s+(.*)$/i, '$1');
      transformed = `} while (!(${translateExpressions(cond)}));`;
    }
    // Switch-case
    else if (/^switch\s+(.*?):?$/i.test(transformed)) {
      const expr = transformed.replace(/^switch\s+(.*?):?$/i, '$1');
      transformed = `switch (${translateExpressions(expr)}) {`;
    } else if (/^case\s+(.*?):?$/i.test(transformed)) {
      const val = transformed.replace(/^case\s+(.*?):?$/i, '$1');
      transformed = `case ${val}:`;
    } else if (/^default:?$/i.test(transformed)) {
      transformed = 'default:';
    } else if (/^endswitch$/i.test(transformed)) {
      transformed = '}';
    }
    // Array declarations: array names[10] or array grid[3, 3]
    else if (/^array\s+([a-zA-Z0-9_]+)\s*\[(.*?)\]/i.test(transformed)) {
      const match = transformed.match(/^array\s+([a-zA-Z0-9_]+)\s*\[(.*?)\]/i);
      const arrName = match[1];
      const dims = match[2].split(',').map(s => s.trim());
      if (dims.length === 1) {
        transformed = `let ${arrName} = new Array(${dims[0]}).fill(null);`;
      } else {
        transformed = `let ${arrName} = Array.from({length: ${dims[0]}}, () => new Array(${dims[1]}).fill(null));`;
      }
    }
    // Constants
    else if (/^const\s+([a-zA-Z0-9_]+)\s*=\s*(.*)$/i.test(transformed)) {
      transformed = transformed.replace(/^const\s+/i, 'const ');
      if (!transformed.endsWith(';')) transformed += ';';
    }
    // General statements (assignment, function calls, return, print)
    else {
      transformed = translateGeneralStatement(transformed, currentClass, classFields);
    }

    jsLines.push(transformed + commentPart);
  }

  return jsLines.join('\n');
}

/**
 * Translates operators and expressions in conditions or values
 */
function translateExpressions(expr, currentClass = null, classFields = {}) {
  if (!expr) return '';

  let out = expr;

  // Replace comparison operators
  // Word boundary AND, OR, NOT
  out = out.replace(/\bAND\b/gi, '&&');
  out = out.replace(/\bOR\b/gi, '||');
  out = out.replace(/\bNOT\b/gi, '!');

  // Replace <> with !==
  out = out.replace(/<>/g, '!==');
  out = out.replace(/!=/g, '!==');

  // Replace single = with === when in condition comparison
  out = out.replace(/([^=!<>]|^)=([^=]|$)/g, '$1===$2');

  // Replace DIV and MOD
  // e.g. a DIV b -> Math.floor((a) / (b))
  out = out.replace(/([a-zA-Z0-9_\[\].\(\)]+)\s+DIV\s+([a-zA-Z0-9_\[\].\(\)]+)/gi, 'Math.floor(($1) / ($2))');
  out = out.replace(/\bMOD\b/gi, '%');

  // Exponentiation ^ -> **
  out = out.replace(/\^/g, '**');

  // 2D Array access [r, c] -> [r][c]
  out = out.replace(/\[\s*([^,\]]+)\s*,\s*([^,\]]+)\s*\]/g, '[$1][$2]');

  // Builtins in expressions
  out = out.replace(/\blen\((.*?)\)/gi, '__len($1)');
  out = out.replace(/\bsubstring\((.*?)\)/gi, '__substring($1)');
  out = out.replace(/\bleft\((.*?)\)/gi, '__left($1)');
  out = out.replace(/\bright\((.*?)\)/gi, '__right($1)');
  out = out.replace(/\bupper\((.*?)\)/gi, '__upper($1)');
  out = out.replace(/\blower\((.*?)\)/gi, '__lower($1)');
  out = out.replace(/\basc\((.*?)\)/gi, '__asc($1)');
  out = out.replace(/\bchr\((.*?)\)/gi, '__chr($1)');
  out = out.replace(/\bopenRead\((.*?)\)/gi, '__openRead($1)');
  out = out.replace(/\bopenWrite\((.*?)\)/gi, '__openWrite($1)');
  out = out.replace(/\bopen\((.*?)\)/gi, '__open($1)');
  out = out.replace(/\bclose\((.*?)\)/gi, '__close($1)');
  out = out.replace(/\bendOfFile\((.*?)\)/gi, '__endOfFile($1)');
  out = out.replace(/\breadLine\((.*?)\)/gi, '__readLine($1)');
  out = out.replace(/\bwriteLine\((.*?)\)/gi, '__writeLine($1)');

  // Prefix class fields with this. if inside class and not already dotted
  if (currentClass && classFields[currentClass]) {
    for (const field of classFields[currentClass]) {
      const reg = new RegExp(`(?<![a-zA-Z0-9_.])\\b${field}\\b(?![a-zA-Z0-9_])`, 'g');
      out = out.replace(reg, `this.${field}`);
    }
  }

  return out;
}

/**
 * Translates a single general statement
 */
function translateGeneralStatement(stmt, currentClass = null, classFields = {}) {
  let s = stmt.trim();
  if (!s) return '';

  // Return statement
  if (/^return\b/i.test(s)) {
    const val = s.substring(6).trim();
    return `return ${translateExpressions(val, currentClass, classFields)};`;
  }

  // Print statement
  if (/^print\s*\((.*)\)$/i.test(s)) {
    const args = s.match(/^print\s*\((.*)\)$/i)[1];
    return `__print(${translateExpressions(args, currentClass, classFields)});`;
  }

  // Assignment: x = 5 or names[i] = "text"
  if (/^([a-zA-Z0-9_]+)\s*=\s*(.*)$/.test(s)) {
    const match = s.match(/^([a-zA-Z0-9_]+)\s*=\s*(.*)$/);
    const varName = match[1];
    const val = translateExpressions(match[2].trim(), currentClass, classFields);
    if (currentClass && classFields[currentClass] && classFields[currentClass].has(varName)) {
      return `this.${varName} = ${val};`;
    }
    return `${varName} = ${val};`;
  }

  if (/^([a-zA-Z0-9_]+\[.*?\])\s*=\s*(.*)$/.test(s)) {
    const match = s.match(/^([a-zA-Z0-9_]+\[.*?\])\s*=\s*(.*)$/);
    let target = match[1];
    target = target.replace(/\[\s*([^,\]]+)\s*,\s*([^,\]]+)\s*\]/g, '[$1][$2]');
    const val = translateExpressions(match[2].trim(), currentClass, classFields);
    return `${target} = ${val};`;
  }

  // Fallback statement
  return translateExpressions(s, currentClass, classFields) + (s.endsWith(';') ? '' : ';');
}

/**
 * Executes OCR Pseudocode against test cases and requirement checks
 */
function runOcrPseudocode(sourceCode, requirements = [], options = {}) {
  const stdoutLog = [];
  const testResults = [];

  // 1. Static Security Sandbox Pre-Check
  const sec = validateOcrPseudocodeSecurity(sourceCode);
  if (!sec.safe) {
    return {
      success: false,
      compileError: sec.reason,
      transpiledJs: '',
      totalScore: 0,
      maxScore: requirements.reduce((s, r) => s + (r.marks || 0), 0),
      results: requirements.map(r => ({
        id: r.id,
        passed: false,
        marksEarned: 0,
        maxMarks: r.marks,
        message: sec.reason
      })),
      stdout: ''
    };
  }

  // 2. Structural Checks on Raw Code (AST / Regex / Token checks)
  const structuralCheckResults = runStructuralChecks(sourceCode, requirements);

  // 3. Transpile to JS
  let transpiledJs = '';
  try {
    transpiledJs = transpileOcrPseudocode(sourceCode);
  } catch (err) {
    return {
      success: false,
      compileError: `Syntax error in OCR Pseudocode: ${err.message}`,
      transpiledJs: '',
      results: structuralCheckResults,
      stdout: stdoutLog.join('\n')
    };
  }

  // Virtual Filesystem (VFS) for OCR file handling questions
  const vfs = Object.create(null);
  if (options.mockFiles && typeof options.mockFiles === 'object') {
    for (const [k, v] of Object.entries(options.mockFiles)) {
      vfs[k] = String(v);
    }
  }

  class VirtualFileHandle {
    constructor(filename, mode) {
      this.filename = String(filename);
      this.mode = mode; // 'r' or 'w'
      this.lines = (mode === 'r' && vfs[this.filename] != null)
        ? String(vfs[this.filename]).split(/\r?\n/)
        : [];
      this.ptr = 0;
      this.closed = false;
    }
    readLine() {
      if (this.closed) throw new Error(`Cannot read from closed file '${this.filename}'`);
      if (this.ptr >= this.lines.length) return '';
      return this.lines[this.ptr++];
    }
    __readLine() { return this.readLine(); }
    writeLine(text) {
      if (this.closed) throw new Error(`Cannot write to closed file '${this.filename}'`);
      this.lines.push(String(text));
      vfs[this.filename] = this.lines.join('\n');
    }
    __writeLine(text) { return this.writeLine(text); }
    endOfFile() {
      return this.ptr >= this.lines.length;
    }
    __endOfFile() { return this.endOfFile(); }
    close() {
      this.closed = true;
    }
    __close() { return this.close(); }
  }

  // Sandboxed Builtins with null prototype and frozen primitives
  const sandbox = Object.assign(Object.create(null), {
    Math: Object.freeze(Math),
    Array,
    String,
    Number,
    Boolean,
    console: Object.freeze({
      log: (...args) => stdoutLog.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
    }),
    __print: (...args) => {
      stdoutLog.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
    },
    __len: (x) => {
      if (x == null) return 0;
      if (typeof x === 'string' || Array.isArray(x)) return x.length;
      return String(x).length;
    },
    __substring: (start, length, str) => {
      if (typeof str !== 'string') str = String(str);
      return str.substr(Number(start), Number(length));
    },
    __left: (str, n) => {
      if (typeof str !== 'string') str = String(str);
      return str.slice(0, Number(n));
    },
    __right: (str, n) => {
      if (typeof str !== 'string') str = String(str);
      return str.slice(-Number(n));
    },
    __upper: (str) => String(str).toUpperCase(),
    __lower: (str) => String(str).toLowerCase(),
    __asc: (ch) => String(ch).charCodeAt(0),
    __chr: (code) => String.fromCharCode(Number(code)),
    __openRead: (fn) => new VirtualFileHandle(fn, 'r'),
    __openWrite: (fn) => new VirtualFileHandle(fn, 'w'),
    __open: (fn) => new VirtualFileHandle(fn, 'r'),
    __readLine: (handle) => (handle && typeof handle.readLine === 'function' ? handle.readLine() : ''),
    __writeLine: (handle, text) => { if (handle && typeof handle.writeLine === 'function') handle.writeLine(text); },
    __endOfFile: (handle) => (handle && typeof handle.endOfFile === 'function' ? handle.endOfFile() : true),
    __close: (handle) => { if (handle && typeof handle.close === 'function') handle.close(); },
    __input: (promptText) => {
      if (promptText) stdoutLog.push(String(promptText));
      return (options.mockInputs && options.mockInputs.shift()) || '';
    }
  });

  // V8 Context hardened: codeGeneration strings disallowed (prevents dynamic eval / Function execution)
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false }
  });

  // Execute base code
  try {
    const script = new vm.Script(transpiledJs);
    script.runInContext(context, { timeout: 3000, microtaskMode: 'afterEvaluate' });
  } catch (err) {
    return {
      success: false,
      compileError: `Runtime/Evaluation error: ${err.message}`,
      transpiledJs,
      results: structuralCheckResults,
      stdout: stdoutLog.join('\n')
    };
  }

  // Excluded built-in names
  const builtInNames = new Set([
    'Math', 'Array', 'String', 'Number', 'Boolean', 'console',
    'len', 'substring', 'left', 'right', 'upper', 'lower', 'asc', 'chr', 'print', 'input',
    'openRead', 'openWrite', 'open', 'close', 'readLine', 'writeLine', 'endOfFile',
    '__print', '__len', '__substring', '__left', '__right', '__upper', '__lower', '__asc', '__chr', '__input',
    '__openRead', '__openWrite', '__open', '__close', '__readLine', '__writeLine', '__endOfFile'
  ]);

  // If an entry function is specified and there are file-output requirements, invoke it
  const entryFn = options.entryFunction;
  const hasOnlyFileOutputOrStructural = requirements.length > 0 && requirements.every(r => r.type === 'file-output' || r.type === 'structural');
  if (entryFn && typeof context[entryFn] === 'function' && hasOnlyFileOutputOrStructural) {
    try {
      const callScript = new vm.Script(`${entryFn}();`);
      callScript.runInContext(context, { timeout: 2000, microtaskMode: 'afterEvaluate' });
    } catch (err) {
      console.error(`Error executing entry function '${entryFn}':`, err);
    }
  }

  // 4. Evaluate Functional Test Cases on Subroutines / Output inside VM with timeouts
  for (const req of requirements) {
    if (req.type === 'structural') {
      const existing = structuralCheckResults.find(r => r.id === req.id);
      testResults.push(existing || { id: req.id, passed: false, marksEarned: 0, maxMarks: req.marks, message: 'Structural check failed' });
      continue;
    }

    if (req.type === 'test-case' && Array.isArray(req.cases)) {
      let casesPassed = 0;
      let failureDetail = null;

      for (const tc of req.cases) {
        try {
          const fnName = req.functionName || options.entryFunction || Object.keys(context).find(k => typeof context[k] === 'function' && !builtInNames.has(k));
          if (!fnName || typeof context[fnName] !== 'function') {
            failureDetail = `Function '${fnName || 'solution'}' is not defined.`;
            break;
          }

          // Deep clone input args to prevent inter-test mutation
          const clonedInputs = JSON.parse(JSON.stringify(tc.input));
          const args = Array.isArray(clonedInputs) ? clonedInputs : Object.values(clonedInputs);
          
          // Execute function inside VM with strict timeout to block infinite loops
          context.__test_args = args;
          const callScript = new vm.Script(`__test_result = ${fnName}(...__test_args);`);
          callScript.runInContext(context, { timeout: 2000, microtaskMode: 'afterEvaluate' });
          const result = context.__test_result;
          delete context.__test_result;
          delete context.__test_args;
          
          // Verify result
          if (deepEquals(result, tc.expected)) {
            casesPassed++;
          } else {
            failureDetail = `For input (${args.map(a => JSON.stringify(a)).join(', ')}), expected ${JSON.stringify(tc.expected)} but got ${JSON.stringify(result)}`;
            break;
          }
        } catch (err) {
          failureDetail = `Exception during test: ${err.message}`;
          break;
        }
      }

      const allPassed = casesPassed === req.cases.length;
      testResults.push({
        id: req.id,
        passed: allPassed,
        marksEarned: allPassed ? req.marks : 0,
        maxMarks: req.marks,
        message: allPassed 
          ? `Passed all ${req.cases.length} test cases.` 
          : (failureDetail || `Passed ${casesPassed}/${req.cases.length} test cases.`)
      });
    } else if (req.type === 'io-test' && Array.isArray(req.cases)) {
      // Input / Output stream tests
      let allIoPassed = true;
      let failureDetail = '';

      for (const tc of req.cases) {
        stdoutLog.length = 0; // clear log
        sandbox.__mockInputs = Array.isArray(tc.inputs) ? [...tc.inputs] : [];
        sandbox.__input = () => sandbox.__mockInputs.shift() || '';

        try {
          const fnName = req.functionName || options.entryFunction;
          if (fnName && typeof sandbox[fnName] === 'function') {
            const callScript = new vm.Script(`${fnName}();`);
            callScript.runInContext(context, { timeout: 2000, microtaskMode: 'afterEvaluate' });
          } else {
            // Re-run script with new inputs
            const script = new vm.Script(transpiledJs);
            script.runInContext(context, { timeout: 2000, microtaskMode: 'afterEvaluate' });
          }

          const actualOutput = stdoutLog.join('\n').trim();
          const expectedOutput = String(tc.expected).trim();
          if (actualOutput !== expectedOutput) {
            allIoPassed = false;
            failureDetail = `Expected output "${expectedOutput}", but received "${actualOutput}"`;
            break;
          }
        } catch (err) {
          allIoPassed = false;
          failureDetail = `Runtime error in I/O test: ${err.message}`;
          break;
        }
      }

      testResults.push({
        id: req.id,
        passed: allIoPassed,
        marksEarned: allIoPassed ? req.marks : 0,
        maxMarks: req.marks,
        message: allIoPassed ? 'Passed I/O stream requirements' : failureDetail
      });
    } else if (req.type === 'file-output' && req.filename) {
      const actual = (vfs[req.filename] != null ? vfs[req.filename] : '').trim().replace(/\r\n/g, '\n');
      const expected = String(req.expectedContent || '').trim().replace(/\r\n/g, '\n');
      const passed = vfs[req.filename] != null && actual === expected;
      testResults.push({
        id: req.id,
        passed,
        marksEarned: passed ? req.marks : 0,
        maxMarks: req.marks,
        message: passed 
          ? `File '${req.filename}' generated with expected contents.` 
          : (vfs[req.filename] == null ? `Expected output file '${req.filename}' was not created.` : `File '${req.filename}' contents did not match expected output.`)
      });
    }
  }

  const totalScore = testResults.reduce((sum, r) => sum + (r.marksEarned || 0), 0);
  const maxScore = requirements.reduce((sum, r) => sum + (r.marks || 0), 0);

  return {
    success: true,
    compileError: null,
    transpiledJs,
    totalScore,
    maxScore,
    results: testResults,
    stdout: stdoutLog.join('\n')
  };
}

/**
 * Evaluates structural / AST checks (e.g. function existence, loop usage, parameters)
 */
function runStructuralChecks(code, requirements = []) {
  const results = [];
  const cleanCode = code.replace(/\/\/.*$/gm, '').replace(/#.*$/gm, '');

  for (const req of requirements) {
    if (req.type !== 'structural' || !req.check) continue;

    const check = req.check;
    let passed = false;
    let msg = '';

    switch (check.rule) {
      case 'function_exists': {
        const regex = new RegExp(`(function|procedure)\\s+${check.name}\\s*\\((.*?)\\)`, 'i');
        const match = cleanCode.match(regex);
        if (match) {
          const params = match[2].trim() ? match[2].split(',').map(p => p.trim()) : [];
          if (check.paramCount == null || params.length === check.paramCount) {
            passed = true;
            msg = `Subroutine '${check.name}' declared with ${params.length} parameter(s).`;
          } else {
            msg = `Subroutine '${check.name}' found but expected ${check.paramCount} parameters, got ${params.length}.`;
          }
        } else {
          msg = `Subroutine '${check.name}' was not defined.`;
        }
        break;
      }

      case 'contains_loop': {
        const hasFor = /\bfor\b/i.test(cleanCode);
        const hasWhile = /\bwhile\b/i.test(cleanCode);
        const hasDo = /\bdo\b[\s\S]*?\buntil\b/i.test(cleanCode);
        if ((check.loopTypes?.includes('for') && hasFor) ||
            (check.loopTypes?.includes('while') && hasWhile) ||
            (!check.loopTypes && (hasFor || hasWhile || hasDo))) {
          passed = true;
          msg = 'Loop structure correctly implemented.';
        } else {
          msg = 'Expected iteration construct (for/while loop) not detected.';
        }
        break;
      }

      case 'class_exists': {
        const regex = new RegExp(`class\\s+(${check.name})\\b`, 'i');
        passed = regex.test(cleanCode);
        msg = passed ? `Class '${check.name}' declared.` : `Class '${check.name}' missing.`;
        break;
      }

      case 'pattern_match': {
        const reg = new RegExp(check.regex, check.flags || 'i');
        passed = reg.test(cleanCode);
        msg = passed ? (check.passMessage || 'Structural pattern verified.') : (check.failMessage || 'Required syntax pattern missing.');
        break;
      }

      default:
        passed = true;
        msg = 'Structural check passed.';
    }

    results.push({
      id: req.id,
      passed,
      marksEarned: passed ? req.marks : 0,
      maxMarks: req.marks,
      message: msg
    });
  }

  return results;
}

function deepEquals(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const k of keysA) {
      if (!deepEquals(a[k], b[k])) return false;
    }
    return true;
  }

  return false;
}

module.exports = {
  transpileOcrPseudocode,
  runOcrPseudocode,
  runStructuralChecks
};
