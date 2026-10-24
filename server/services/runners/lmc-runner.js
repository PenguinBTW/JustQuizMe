// Little Man Computer (LMC) Assembler & Simulator for OCR A-Level CS (H446)
const { validateLmcSecurity } = require('./security');

/**
 * Assembles and runs Little Man Computer (LMC) assembly code.
 */
function assembleLMC(sourceCode) {
  const lines = sourceCode.split(/\r?\n/);
  const memory = new Array(100).fill(0);
  const labels = {};
  const instructions = [];
  const errors = [];

  // Pass 1: Parse labels and instructions
  let address = 0;
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    let line = lines[lineNum].trim();
    // Strip comments
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) line = line.substring(0, commentIdx).trim();
    const hashIdx = line.indexOf('#');
    if (hashIdx !== -1) line = line.substring(0, hashIdx).trim();

    if (!line) continue;

    const tokens = line.split(/\s+/);
    let label = null;
    let mnemonic = tokens[0].toUpperCase();
    let operand = tokens[1] || null;

    // Known mnemonics
    const mnemonics = new Set(['INP', 'OUT', 'STA', 'LDA', 'ADD', 'SUB', 'BRP', 'BRZ', 'BRA', 'DAT', 'HLT', 'COB']);

    if (!mnemonics.has(mnemonic)) {
      // First token is a label
      label = tokens[0];
      mnemonic = (tokens[1] || 'DAT').toUpperCase();
      operand = tokens[2] || null;
    }

    if (label) {
      labels[label.toUpperCase()] = address;
    }

    instructions.push({ address, label, mnemonic, operand, lineNum: lineNum + 1 });
    address++;
    if (address >= 100) {
      errors.push('LMC memory limit exceeded (maximum 100 mailboxes).');
      break;
    }
  }

  // Pass 2: Resolve addresses and encode machine instructions
  for (const inst of instructions) {
    const { address, mnemonic, operand } = inst;
    let resolvedOperand = 0;

    if (operand) {
      const upperOp = operand.toUpperCase();
      if (labels[upperOp] !== undefined) {
        resolvedOperand = labels[upperOp];
      } else if (!isNaN(parseInt(operand, 10))) {
        resolvedOperand = parseInt(operand, 10);
      } else if (mnemonic !== 'DAT') {
        errors.push(`Unresolved label '${operand}' at address ${address}.`);
      }
    }

    switch (mnemonic) {
      case 'HLT':
      case 'COB':
        memory[address] = 0;
        break;
      case 'ADD':
        memory[address] = 100 + (resolvedOperand % 100);
        break;
      case 'SUB':
        memory[address] = 200 + (resolvedOperand % 100);
        break;
      case 'STA':
        memory[address] = 300 + (resolvedOperand % 100);
        break;
      case 'LDA':
        memory[address] = 500 + (resolvedOperand % 100);
        break;
      case 'BRA':
        memory[address] = 600 + (resolvedOperand % 100);
        break;
      case 'BRZ':
        memory[address] = 700 + (resolvedOperand % 100);
        break;
      case 'BRP':
        memory[address] = 800 + (resolvedOperand % 100);
        break;
      case 'INP':
        memory[address] = 901;
        break;
      case 'OUT':
        memory[address] = 902;
        break;
      case 'DAT':
        memory[address] = resolvedOperand || 0;
        break;
      default:
        errors.push(`Unknown mnemonic '${mnemonic}' at address ${address}.`);
    }
  }

  return { memory, labels, instructions, errors };
}

/**
 * Runs the assembled LMC memory image with inputs and assertions
 */
function runLMC(sourceCode, requirements = [], options = {}) {
  // 1. Static Security Check
  const sec = validateLmcSecurity(sourceCode);
  if (!sec.safe) {
    return {
      success: false,
      compileError: sec.reason,
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

  const { memory: initialMemory, labels, errors } = assembleLMC(sourceCode);
  const cleanCode = sourceCode.replace(/\/\/.*$/gm, '').toUpperCase();

  // Run Structural Checks
  const results = [];
  for (const req of requirements) {
    if (req.type === 'structural' && req.check) {
      let passed = false;
      let msg = '';
      if (req.check.rule === 'pattern_match') {
        const regex = new RegExp(req.check.regex, req.check.flags || 'i');
        passed = regex.test(cleanCode);
        msg = passed ? (req.check.passMessage || 'Structural check passed.') : (req.check.failMessage || 'Required instruction missing.');
      } else if (req.check.rule === 'uses_instruction') {
        passed = cleanCode.includes(req.check.instruction.toUpperCase());
        msg = passed ? `Instruction ${req.check.instruction} utilized.` : `Expected instruction ${req.check.instruction} not found.`;
      }
      results.push({
        id: req.id,
        passed,
        marksEarned: passed ? req.marks : 0,
        maxMarks: req.marks,
        message: msg
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false,
      compileError: errors.join('\n'),
      totalScore: results.reduce((s, r) => s + r.marksEarned, 0),
      maxScore: requirements.reduce((s, r) => s + r.marks, 0),
      results,
      stdout: ''
    };
  }

  // Functional test cases
  for (const req of requirements) {
    if (req.type === 'test-case' && Array.isArray(req.cases)) {
      let allPassed = true;
      let failureDetail = '';

      for (const tc of req.cases) {
        const memory = [...initialMemory];
        const inputQueue = Array.isArray(tc.inputs) ? [...tc.inputs] : (tc.input !== undefined ? [tc.input] : []);
        const outputQueue = [];
        let acc = 0;
        let pc = 0;
        let cycles = 0;
        let flagNegative = false;
        let halted = false;

        while (!halted && cycles < 5000) {
          cycles++;
          if (pc < 0 || pc >= 100) {
            failureDetail = `PC out of bounds (${pc}).`;
            allPassed = false;
            break;
          }

          const instruction = memory[pc];
          pc++;

          const opCode = Math.floor(instruction / 100);
          const address = instruction % 100;

          if (instruction === 0) {
            halted = true;
            break;
          } else if (instruction === 901) {
            if (inputQueue.length === 0) {
              failureDetail = 'Attempted INP with empty input queue.';
              allPassed = false;
              break;
            }
            acc = Number(inputQueue.shift());
            if (acc > 999) acc = 999;
            if (acc < -999) acc = -999;
            flagNegative = acc < 0;
          } else if (instruction === 902) {
            outputQueue.push(acc);
          } else if (opCode === 1) { // ADD
            acc += memory[address];
            if (acc > 999) acc = acc % 1000;
            flagNegative = acc < 0;
          } else if (opCode === 2) { // SUB
            acc -= memory[address];
            if (acc < -999) acc = -((-acc) % 1000);
            flagNegative = acc < 0;
          } else if (opCode === 3) { // STA
            memory[address] = acc;
          } else if (opCode === 5) { // LDA
            acc = memory[address];
            flagNegative = acc < 0;
          } else if (opCode === 6) { // BRA
            pc = address;
          } else if (opCode === 7) { // BRZ
            if (acc === 0 && !flagNegative) pc = address;
          } else if (opCode === 8) { // BRP
            if (!flagNegative && acc >= 0) pc = address;
          }
        }

        if (cycles >= 5000) {
          allPassed = false;
          failureDetail = 'Execution timeout (5000 cycle limit exceeded - possible infinite loop).';
          break;
        }

        // Validate outputs
        const expectedOutputs = Array.isArray(tc.expected) ? tc.expected : [tc.expected];
        if (outputQueue.length !== expectedOutputs.length || !outputQueue.every((val, i) => val === expectedOutputs[i])) {
          allPassed = false;
          failureDetail = `Inputs [${(Array.isArray(tc.inputs) ? tc.inputs : [tc.input]).join(', ')}] produced [${outputQueue.join(', ')}], expected [${expectedOutputs.join(', ')}].`;
          break;
        }
      }

      results.push({
        id: req.id,
        passed: allPassed,
        marksEarned: allPassed ? req.marks : 0,
        maxMarks: req.marks,
        message: allPassed ? `Passed all ${req.cases.length} test cases.` : failureDetail
      });
    }
  }

  const totalScore = results.reduce((s, r) => s + (r.marksEarned || 0), 0);
  const maxScore = requirements.reduce((s, r) => s + (r.marks || 0), 0);

  return {
    success: true,
    compileError: null,
    totalScore,
    maxScore,
    results,
    stdout: `Program executed successfully.`
  };
}

module.exports = {
  assembleLMC,
  runLMC
};
