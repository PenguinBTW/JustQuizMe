// C# Execution Runner for OCR Computer Science JustQuizMe
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const { validateCsharpSecurity } = require('./security');

const CSHARP_DIR = path.join(__dirname, 'csharp');
const PROGRAM_FILE = path.join(CSHARP_DIR, 'Program.cs');

// Detect if WSL2 and Bubblewrap container sandbox is available
let wslUserCache = null;
function getWslUser() {
  if (wslUserCache !== null) return wslUserCache;
  try {
    wslUserCache = execSync('wsl whoami', { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    wslUserCache = 'brosf';
  }
  return wslUserCache;
}

let wslBwrapCache = null;
function isWslBwrapSupported() {
  if (wslBwrapCache !== null) return wslBwrapCache;
  try {
    const user = getWslUser();
    const hasBase = fs.existsSync(`\\\\wsl.localhost\\Ubuntu\\home\\${user}\\.csharp_sandbox_base`) ||
                    fs.existsSync(`\\\\wsl.localhost\\Debian\\home\\${user}\\.csharp_sandbox_base`);
    if (!hasBase) {
      wslBwrapCache = false;
      return false;
    }
    execSync('wsl bwrap --version', { stdio: 'ignore', timeout: 3000 });
    wslBwrapCache = true;
  } catch (e) {
    wslBwrapCache = false;
  }
  return wslBwrapCache;
}

// Concurrency queue to serialize C# execution and prevent file race conditions
let executionQueue = Promise.resolve();
function enqueueCsharpExecution(task) {
  const result = executionQueue.then(task, task);
  executionQueue = result.catch(() => {});
  return result;
}

// Kill entire process tree cleanly on Windows/Unix
function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (e) {}
}

/**
 * Runs static / structural checks on C# code
 */
function runCsharpStructuralChecks(code, requirements = []) {
  const results = [];
  const cleanCode = code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  for (const req of requirements) {
    if (req.type !== 'structural' || !req.check) continue;

    const check = req.check;
    let passed = false;
    let msg = '';

    switch (check.rule) {
      case 'function_exists': {
        // e.g. public static int LinearSearch(int[] data, int target)
        const regex = new RegExp(`(?:public|private|protected|static|internal|\\s)*\\s+([a-zA-Z0-9_<>\\[\\]]+)\\s+(${check.name})\\s*\\((.*?)\\)`, 'i');
        const match = cleanCode.match(regex);
        if (match) {
          const paramsStr = match[3].trim();
          const params = paramsStr ? paramsStr.split(',').map(p => p.trim()) : [];
          if (check.paramCount == null || params.length === check.paramCount) {
            passed = true;
            msg = `Method '${check.name}' declared with ${params.length} parameter(s).`;
          } else {
            msg = `Method '${check.name}' found but expected ${check.paramCount} parameters, got ${params.length}.`;
          }
        } else {
          msg = `Method '${check.name}' was not found in code.`;
        }
        break;
      }

      case 'contains_loop': {
        const hasFor = /\bfor\s*\(/i.test(cleanCode);
        const hasWhile = /\bwhile\s*\(/i.test(cleanCode);
        const hasForeach = /\bforeach\s*\(/i.test(cleanCode);
        const hasDo = /\bdo\s*\{/i.test(cleanCode);

        if ((check.loopTypes?.includes('for') && (hasFor || hasForeach)) ||
            (check.loopTypes?.includes('while') && hasWhile) ||
            (!check.loopTypes && (hasFor || hasWhile || hasForeach || hasDo))) {
          passed = true;
          msg = 'Loop structure correctly implemented.';
        } else {
          msg = 'Expected iteration construct (for/while/foreach) not detected.';
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

/**
 * Builds the C# source file with embedded test harness
 */
function generateHarnessSource(userCode, requirements, options = {}) {
  // Extract test-case requirements
  const testReqs = requirements.filter(r => r.type === 'test-case' && Array.isArray(r.cases));
  const testReqsJson = JSON.stringify(testReqs).replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  const methodName = options.entryMethod || 'LinearSearch';
  const className = options.className || '';
  const cleanCode = userCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hasCustomClass = /\bclass\s+[A-Za-z0-9_]+/i.test(cleanCode);

  const submissionCode = hasCustomClass
    ? `${userCode}\npublic class UserSubmission { }`
    : `public class UserSubmission\n{\n    public Node nextNode;\n    public int value;\n    public string name;\n${userCode}\n}`;

  return `// Auto-generated by CS JustQuizMe Runner
#pragma warning disable CS8618, CS8600, CS8601, CS8604, CS8602, CS8603, CS0169, CS0649, CS0414
using System;
using System.IO;
using System.Collections.Generic;
using System.Text.Json;
using System.Linq;

// Standard OCR CS Exam Data Structure Stubs for incomplete snippet questions
public class Node
{
    public int value;
    public Node nextNode;
    public Node left;
    public Node right;
    public Node(int v = 0) { value = v; }
    public Node() {}
    public int getValue() => value;
    public Node getNextNode() => nextNode;
    public void setValue(int v) { value = v; }
    public void setNextNode(Node n) { nextNode = n; }
}

public class LinkedList
{
    public Node headNode;
    public LinkedList() {}
    public void insertNode() {}
    public string outputList() => "";
}

public class Board
{
    public int size;
    public Board() {}
}

public class Building
{
    public string address;
    public Building() {}
}

public class House : Building
{
    public int bedrooms;
    public House() {}
}

public class Character
{
    public string name;
    public int health;
    public Character(string pName = "") { name = pName; }
    public Character() {}
}

public class Treasure
{
    public int value;
    public Treasure() {}
}

public class Video
{
    public int views;
    public Video() {}
}

${submissionCode}

public class RunnerResultItem
{
    public string id { get; set; }
    public bool passed { get; set; }
    public int marksEarned { get; set; }
    public int maxMarks { get; set; }
    public string message { get; set; }
}

public class Program
{
    public static void Main(string[] args)
    {
        var testResults = new List<RunnerResultItem>();
        
        try
        {
            // If entry method or class method specified, invoke it
            InvokeEntryMethod();
            // Execute test suites
            ExecuteTests(testResults);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("FATAL_TEST_ERROR: " + ex.Message);
        }

        Console.WriteLine($"__RESULT_{"${options.nonce}"}_START__");
        Console.WriteLine(JsonSerializer.Serialize(testResults));
        Console.WriteLine($"__RESULT_{"${options.nonce}"}_END__");
    }

    private static void InvokeEntryMethod()
    {
        var targetClassName = "${className}";
        Type userType = null;

        if (!string.IsNullOrEmpty(targetClassName))
        {
            userType = typeof(Program).Assembly.GetTypes()
                .FirstOrDefault(t => !t.Name.StartsWith("<") && t.Name.Equals(targetClassName, StringComparison.OrdinalIgnoreCase));
        }

        if (userType == null && ${hasCustomClass ? 'true' : 'false'})
        {
            userType = typeof(Program).Assembly.GetTypes()
                .FirstOrDefault(t => t.Name != "Program" && t.Name != "RunnerResultItem" && t.DeclaringType == null && t.IsClass && !t.Name.StartsWith("<") && t.Name != "UserSubmission");
        }

        if (userType == null)
        {
            userType = typeof(UserSubmission);
        }

        var targetMethod = userType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Instance)
            .FirstOrDefault(m => m.Name.Equals("${methodName}", StringComparison.OrdinalIgnoreCase));

        if (targetMethod != null && targetMethod.GetParameters().Length == 0)
        {
            try
            {
                object instance = targetMethod.IsStatic ? null : Activator.CreateInstance(userType);
                targetMethod.Invoke(instance, null);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("INVOKE_ERROR: " + (ex.InnerException != null ? ex.InnerException.Message : ex.Message));
            }
        }
    }

    private static void ExecuteTests(List<RunnerResultItem> results)
    {
        var rawReqs = "${testReqsJson}";
        using var doc = JsonDocument.Parse(rawReqs);
        var root = doc.RootElement;

        var targetClassName = "${className}";
        Type userType = null;

        if (!string.IsNullOrEmpty(targetClassName))
        {
            userType = typeof(Program).Assembly.GetTypes()
                .FirstOrDefault(t => !t.Name.StartsWith("<") && t.Name.Equals(targetClassName, StringComparison.OrdinalIgnoreCase));
        }

        if (userType == null && ${hasCustomClass ? 'true' : 'false'})
        {
            userType = typeof(Program).Assembly.GetTypes()
                .FirstOrDefault(t => t.Name != "Program" && t.Name != "RunnerResultItem" && t.DeclaringType == null && t.IsClass && !t.Name.StartsWith("<") && t.Name != "UserSubmission");
        }

        if (userType == null)
        {
            userType = typeof(UserSubmission);
        }

        foreach (var req in root.EnumerateArray())
        {
            var reqId = req.GetProperty("id").GetString();
            var maxMarks = req.GetProperty("marks").GetInt32();
            var cases = req.GetProperty("cases");

            int passedCount = 0;
            int totalCount = cases.GetArrayLength();
            string failureMsg = null;

            foreach (var testCase in cases.EnumerateArray())
            {
                try
                {
                    var inputEl = testCase.GetProperty("input");
                    var expectedEl = testCase.GetProperty("expected");

                    // Find method by candidate name or reflection
                    var targetMethod = userType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Instance)
                        .FirstOrDefault(m => m.Name.Equals("${methodName}", StringComparison.OrdinalIgnoreCase));

                    if (targetMethod == null)
                    {
                        // Fallback: pick user-defined method
                        targetMethod = userType.GetMethods(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static | System.Reflection.BindingFlags.Instance)
                            .FirstOrDefault(m => m.DeclaringType == userType && !m.Name.StartsWith("get_") && !m.Name.StartsWith("set_"));
                    }

                    if (targetMethod == null)
                    {
                        failureMsg = $"Could not locate method '${methodName}'.";
                        break;
                    }

                    var paramInfos = targetMethod.GetParameters();
                    object[] invocationArgs = new object[paramInfos.Length];

                    if (inputEl.ValueKind == JsonValueKind.Array)
                    {
                        int idx = 0;
                        foreach (var item in inputEl.EnumerateArray())
                        {
                            if (idx < paramInfos.Length)
                            {
                                invocationArgs[idx] = JsonSerializer.Deserialize(item.GetRawText(), paramInfos[idx].ParameterType);
                            }
                            idx++;
                        }
                    }
                    else if (inputEl.ValueKind == JsonValueKind.Object)
                    {
                        for (int i = 0; i < paramInfos.Length; i++)
                        {
                            var pName = paramInfos[i].Name;
                            if (inputEl.TryGetProperty(pName, out var pVal))
                            {
                                invocationArgs[i] = JsonSerializer.Deserialize(pVal.GetRawText(), paramInfos[i].ParameterType);
                            }
                            else
                            {
                                // Match by position
                                var prop = inputEl.EnumerateObject().ElementAtOrDefault(i);
                                invocationArgs[i] = JsonSerializer.Deserialize(prop.Value.GetRawText(), paramInfos[i].ParameterType);
                            }
                        }
                    }

                    object instance = targetMethod.IsStatic ? null : Activator.CreateInstance(userType);
                    var actualResult = targetMethod.Invoke(instance, invocationArgs);

                    bool matches = false;
                    if (targetMethod.ReturnType == typeof(void))
                    {
                        matches = true;
                    }
                    else
                    {
                        var expectedVal = JsonSerializer.Deserialize(expectedEl.GetRawText(), targetMethod.ReturnType);
                        matches = ObjectsMatch(actualResult, expectedVal);
                    }

                    if (matches)
                    {
                        passedCount++;
                    }
                    else
                    {
                        var exp = expectedEl.ValueKind == JsonValueKind.Undefined ? "void" : expectedEl.GetRawText();
                        failureMsg = $"Expected {exp}, but got {JsonSerializer.Serialize(actualResult)}.";
                        break;
                    }
                }
                catch (Exception ex)
                {
                    failureMsg = "Exception: " + (ex.InnerException != null ? ex.InnerException.Message : ex.Message);
                    break;
                }
            }

            bool allPassed = passedCount == totalCount;
            results.Add(new RunnerResultItem
            {
                id = reqId,
                passed = allPassed,
                marksEarned = allPassed ? maxMarks : 0,
                maxMarks = maxMarks,
                message = allPassed ? $"Passed all {totalCount} test case(s)." : (failureMsg ?? $"Passed {passedCount}/{totalCount} test cases.")
            });
        }
    }

    private static bool ObjectsMatch(object a, object b)
    {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;

        if (a is System.Collections.IEnumerable enumA && b is System.Collections.IEnumerable enumB && !(a is string))
        {
            var listA = new List<object>();
            var listB = new List<object>();
            foreach (var item in enumA) listA.Add(item);
            foreach (var item in enumB) listB.Add(item);
            if (listA.Count != listB.Count) return false;
            for (int i = 0; i < listA.Count; i++)
            {
                if (!ObjectsMatch(listA[i], listB[i])) return false;
            }
            return true;
        }

        return a.Equals(b) || JsonSerializer.Serialize(a) == JsonSerializer.Serialize(b);
    }
}
`;
}

/**
 * Executes C# code with sandbox validation, concurrency queue, timeout, and requirement assertions
 */
function runCsharpCode(sourceCode, requirements = [], options = {}) {
  // 1. Sandbox Static Validation Check
  const sec = validateCsharpSecurity(sourceCode);
  if (!sec.safe) {
    return Promise.resolve({
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
    });
  }

  // 2. Structural Checks on raw C# code
  const structuralResults = runCsharpStructuralChecks(sourceCode, requirements);

  // 3. Queue execution to serialize compilation and prevent file collision
  return enqueueCsharpExecution(() => {
    return new Promise((resolve) => {
      const nonce = crypto.randomBytes(8).toString('hex');
      const mergedOpts = { ...options, nonce };
      const harnessCode = generateHarnessSource(sourceCode, requirements, mergedOpts);
      const isVmSandbox = isWslBwrapSupported();

      let runId = 'run_' + crypto.randomBytes(6).toString('hex');
      let wslRunDir = null;
      let winDir = null;
      let child = null;

      if (isVmSandbox) {
        // True Container VM Sandbox via WSL2 + Bubblewrap (Linux namespaces)
        wslRunDir = `/tmp/cs_runs/${runId}`;
        winDir = `\\\\wsl.localhost\\Ubuntu\\tmp\\cs_runs\\${runId}`;
        try {
          execSync(`wsl bash -c "mkdir -p ${wslRunDir} && cp -r ~/.csharp_sandbox_base/. ${wslRunDir}/"`);
          fs.writeFileSync(path.join(winDir, 'Program.cs'), harnessCode, 'utf8');

          // Pre-populate mock input files for file-handling questions
          if (options.mockFiles && typeof options.mockFiles === 'object') {
            for (const [fn, content] of Object.entries(options.mockFiles)) {
              fs.writeFileSync(path.join(winDir, path.basename(fn)), String(content), 'utf8');
            }
          }
        } catch (setupErr) {
          return resolve({
            success: false,
            compileError: `Sandbox initialization failed: ${setupErr.message}`,
            results: structuralResults,
            stdout: ''
          });
        }

        const user = getWslUser();
        const dotnetBin = fs.existsSync(`\\\\wsl.localhost\\Ubuntu\\home\\${user}\\.dotnet\\dotnet`)
          ? `/home/${user}/.dotnet/dotnet`
          : 'dotnet';

        const bwrapArgs = [
          'bwrap',
          '--unshare-all',
          '--setenv', 'DOTNET_SYSTEM_GLOBALIZATION_INVARIANT', '1',
          '--ro-bind', '/usr', '/usr',
          '--ro-bind', '/lib', '/lib',
          '--ro-bind-try', '/lib64', '/lib64',
          '--ro-bind-try', '/etc', '/etc',
          '--ro-bind-try', '/bin', '/bin',
          '--ro-bind-try', `/home/${user}/.dotnet`, `/home/${user}/.dotnet`,
          '--proc', '/proc',
          '--dev', '/dev',
          '--tmpfs', '/tmp',
          '--bind', wslRunDir, '/workspace',
          '--chdir', '/workspace',
          dotnetBin, 'run', '--no-restore'
        ];

        child = spawn('wsl', bwrapArgs, { windowsHide: true });
      } else {
        // Host Process Sandbox Fallback
        winDir = CSHARP_DIR;
        fs.writeFileSync(PROGRAM_FILE, harnessCode, 'utf8');
        if (options.mockFiles && typeof options.mockFiles === 'object') {
          for (const [fn, content] of Object.entries(options.mockFiles)) {
            fs.writeFileSync(path.join(CSHARP_DIR, path.basename(fn)), String(content), 'utf8');
          }
        }

        const safeEnv = {
          PATH: process.env.PATH,
          SYSTEMROOT: process.env.SYSTEMROOT || 'C:\\Windows',
          DOTNET_CLI_TELEMETRY_OPTOUT: '1',
          DOTNET_NOLOGO: '1',
          TEMP: process.env.TEMP || 'C:\\Windows\\Temp',
          TMP: process.env.TMP || 'C:\\Windows\\Temp'
        };

        child = spawn('dotnet', ['run', '--no-restore'], {
          cwd: CSHARP_DIR,
          shell: true,
          windowsHide: true,
          env: safeEnv
        });
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        killProcessTree(child.pid);
      }, 5000);

      child.stdout.on('data', data => { stdout += data.toString(); });
      child.stderr.on('data', data => { stderr += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timer);

        // Parse JSON results between cryptographic markers
        let runtimeResults = [];
        const startMarker = `__RESULT_${nonce}_START__`;
        const endMarker = `__RESULT_${nonce}_END__`;
        const sIdx = stdout.indexOf(startMarker);
        const eIdx = stdout.indexOf(endMarker);

        if (sIdx !== -1 && eIdx !== -1) {
          const jsonStr = stdout.substring(sIdx + startMarker.length, eIdx).trim();
          try {
            runtimeResults = JSON.parse(jsonStr);
          } catch (e) {
            console.error('Failed to parse C# test json output:', e);
          }
        } else {
          console.log(`[C# RUNNER DEBUG] exitCode=${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
        }

        // Check file-output requirements in the virtualized workspace
        if (winDir) {
          for (const req of requirements) {
            if (req.type === 'file-output' && req.filename) {
              const outPath = path.join(winDir, path.basename(req.filename));
              if (fs.existsSync(outPath)) {
                const actual = fs.readFileSync(outPath, 'utf8').trim().replace(/\r\n/g, '\n');
                const expected = String(req.expectedContent || '').trim().replace(/\r\n/g, '\n');
                const passed = actual === expected;
                runtimeResults.push({
                  id: req.id,
                  passed,
                  marksEarned: passed ? req.marks : 0,
                  maxMarks: req.marks,
                  message: passed 
                    ? `File '${req.filename}' generated with expected contents.` 
                    : `File '${req.filename}' was created, but contents did not match expected output.`
                });
              } else {
                runtimeResults.push({
                  id: req.id,
                  passed: false,
                  marksEarned: 0,
                  maxMarks: req.marks,
                  message: `Expected output file '${req.filename}' was not created.`
                });
              }
            }
          }
        }

        // Clean up scratch container directory or placeholder
        if (isVmSandbox && wslRunDir) {
          try {
            execSync(`wsl rm -rf ${wslRunDir}`);
          } catch (e) {}
        } else {
          try {
            fs.writeFileSync(PROGRAM_FILE, '// Sandbox idle placeholder\npublic class Program { public static void Main() {} }\n', 'utf8');
            if (options.mockFiles && typeof options.mockFiles === 'object') {
              for (const fn of Object.keys(options.mockFiles)) {
                const p = path.join(CSHARP_DIR, path.basename(fn));
                if (fs.existsSync(p)) fs.unlinkSync(p);
              }
            }
          } catch (e) {}
        }

        if (timedOut) {
          return resolve({
            success: false,
            compileError: 'Execution timed out (5000ms sandbox limit). Possible infinite loop or slow initialization.',
            results: structuralResults,
            stdout: stdout
          });
        }

        const hasRuntimeTests = requirements.some(r => r.type === 'test-case' || r.type === 'file-output');
        const structuralScore = structuralResults.reduce((s, r) => s + (r.marksEarned || 0), 0);
        const maxScore = requirements.reduce((s, r) => s + (r.marks || 0), 0);

        // Check if build/compile error
        if (code !== 0 && !stdout.includes(startMarker)) {
          const errorLines = (stderr + '\n' + stdout)
            .split('\n')
            .filter(l => l.includes('error CS') || l.includes('Build FAILED') || l.includes('error:'))
            .join('\n');

          // If the question is purely structural (standard OCR snippet question without runtime unit test cases)
          if (!hasRuntimeTests) {
            return resolve({
              success: structuralScore > 0,
              compileError: structuralScore === maxScore ? null : (errorLines || null),
              totalScore: structuralScore,
              maxScore: maxScore,
              results: structuralResults,
              stdout: stdout
            });
          }

          return resolve({
            success: false,
            compileError: errorLines || 'Compilation failed. Check C# syntax and types.',
            totalScore: structuralScore,
            maxScore: maxScore,
            results: structuralResults,
            stdout: stdout
          });
        }

        // Merge structural results with runtime results
        const finalResults = [];
        for (const req of requirements) {
          if (req.type === 'structural') {
            const sRes = structuralResults.find(r => r.id === req.id);
            finalResults.push(sRes || { id: req.id, passed: false, marksEarned: 0, maxMarks: req.marks, message: 'Structural check missing.' });
          } else {
            const rRes = runtimeResults.find(r => r.id === req.id);
            finalResults.push(rRes || { id: req.id, passed: false, marksEarned: 0, maxMarks: req.marks, message: 'Test execution failed.' });
          }
        }

        const totalScore = finalResults.reduce((s, r) => s + (r.marksEarned || 0), 0);

        // Clean stdout of internal markers
        const markerRegex = new RegExp(`__RESULT_${nonce}_START__[\\s\\S]*?__RESULT_${nonce}_END__`);
        const cleanedStdout = stdout.replace(markerRegex, '').trim();

        resolve({
          success: true,
          compileError: null,
          isSandboxedVm: isVmSandbox,
          totalScore,
          maxScore,
          results: finalResults,
          stdout: cleanedStdout
        });
      });
    });
  });
}

module.exports = {
  runCsharpCode,
  runCsharpStructuralChecks
};
