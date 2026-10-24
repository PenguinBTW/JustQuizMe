// Security Sandbox Validator for OCR CS JustQuizMe
// Enforces strict sandbox isolation and prevents filesystem, process, network, and reflection breakouts.

const MAX_CODE_LENGTH = 65536; // 64 KB limit

// Prohibited tokens and namespaces in C#
const CSHARP_BANNED_PATTERNS = [
  // Filesystem Traversal / Host Escape (Relative sandbox file access via StreamReader/StreamWriter/FileStream is permitted)
  { regex: /["'][a-zA-Z]:[\\\/]/, name: 'Absolute Windows drive path' },
  { regex: /["'](\\\\|\/\/)/, name: 'UNC network path' },
  { regex: /["']\.\.[\/\\]\.\./, name: 'Parent directory traversal (../../)' },
  { regex: /["']\/(mnt|etc|var|root|boot|home|proc|sys)\b/, name: 'Host Linux system path' },
  
  // Process and OS execution
  { regex: /\bSystem\.Diagnostics\b/i, name: 'System.Diagnostics' },
  { regex: /\bProcess(\.Start|StartInfo)?\b/, name: 'Process execution' },
  
  // Network and Sockets
  { regex: /\bSystem\.Net\b/i, name: 'System.Net' },
  { regex: /\b(Socket|TcpClient|UdpClient|WebClient|HttpClient|HttpRequestMessage)\b/, name: 'Network Sockets' },
  
  // Reflection & Dynamic Code Execution
  { regex: /\bSystem\.Reflection\b/i, name: 'System.Reflection' },
  { regex: /\b(Assembly|Type\.GetType|Activator\.CreateInstance|MethodInfo|FieldInfo|PropertyInfo|ILGenerator)\b/, name: 'Dynamic Reflection' },
  
  // Native code and P/Invoke
  { regex: /\bSystem\.Runtime\b/i, name: 'System.Runtime' },
  { regex: /\bDllImport\b/, name: 'DllImport / Native Interop' },
  { regex: /\bunsafe\b/, name: 'Unsafe memory block' },
  
  // Environment and Process Control
  { regex: /\bEnvironment\b/, name: 'Environment Control' },
  { regex: /\bAppDomain\b/, name: 'AppDomain manipulation' },
  { regex: /\bMicrosoft\.Win32\b/i, name: 'Microsoft.Win32' },
  { regex: /\bRegistry\b/i, name: 'Windows Registry' },
  { regex: /\bSystem\.Security\b/i, name: 'System.Security' },
  
  // Uncontrolled Threading / Forking
  { regex: /\bSystem\.Threading\b/i, name: 'Threading manipulation' }
];

// Prohibited tokens in OCR Pseudocode
const OCR_BANNED_PATTERNS = [
  { regex: /\bprocess\b/i, name: 'process' },
  { regex: /\brequire\s*\(/i, name: 'require()' },
  { regex: /\bimport\b/i, name: 'import' },
  { regex: /\bmodule\b/i, name: 'module' },
  { regex: /\bconstructor\b/i, name: 'constructor property' },
  { regex: /__proto__/i, name: '__proto__' },
  { regex: /\bprototype\b/i, name: 'prototype' },
  { regex: /\bglobal(This)?\b/i, name: 'global / globalThis' },
  { regex: /\beval\s*\(/i, name: 'eval()' },
  { regex: /\bFunction\s*\(/i, name: 'Function() constructor' },
  { regex: /\bBuffer\b/i, name: 'Buffer' },
  { regex: /\bchild_process\b/i, name: 'child_process' },
  { regex: /\bfs\b/i, name: 'fs' },
  { regex: /\b(fetch|XMLHttpRequest|WebSocket)\b/i, name: 'Network API' },
  { regex: /\b(setTimeout|setInterval|setImmediate)\b/i, name: 'Timers' },
  { regex: /\b(atob|btoa|unescape|decodeURI)\b/i, name: 'Obfuscation decoding API' }
];

/**
 * Validates C# source code against the security sandbox policy
 */
function validateCsharpSecurity(sourceCode) {
  if (typeof sourceCode !== 'string') return { safe: true };
  if (sourceCode.length > MAX_CODE_LENGTH) {
    return { safe: false, reason: `Code exceeds maximum allowed size (${MAX_CODE_LENGTH} bytes).` };
  }

  // Strip single-line and multi-line comments
  const cleanCode = sourceCode
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  for (const { regex, name } of CSHARP_BANNED_PATTERNS) {
    if (regex.test(cleanCode)) {
      return {
        safe: false,
        reason: `Security Sandbox Violation: Usage of '${name}' is restricted in the exam environment.`
      };
    }
  }

  return { safe: true };
}

/**
 * Validates OCR Pseudocode source code against the security sandbox policy
 */
function validateOcrPseudocodeSecurity(sourceCode) {
  if (typeof sourceCode !== 'string') return { safe: true };
  if (sourceCode.length > MAX_CODE_LENGTH) {
    return { safe: false, reason: `Code exceeds maximum allowed size (${MAX_CODE_LENGTH} bytes).` };
  }

  // Strip single-line comments
  const cleanCode = sourceCode
    .replace(/\/\/.*$/gm, '')
    .replace(/#.*$/gm, '');

  for (const { regex, name } of OCR_BANNED_PATTERNS) {
    if (regex.test(cleanCode)) {
      return {
        safe: false,
        reason: `Security Sandbox Violation: Identifier '${name}' is prohibited in the OCR pseudocode environment.`
      };
    }
  }

  return { safe: true };
}

/**
 * Validates LMC source code size
 */
function validateLmcSecurity(sourceCode) {
  if (typeof sourceCode !== 'string') return { safe: true };
  if (sourceCode.length > MAX_CODE_LENGTH) {
    return { safe: false, reason: `Code exceeds maximum allowed size (${MAX_CODE_LENGTH} bytes).` };
  }
  return { safe: true };
}

module.exports = {
  validateCsharpSecurity,
  validateOcrPseudocodeSecurity,
  validateLmcSecurity,
  MAX_CODE_LENGTH
};
