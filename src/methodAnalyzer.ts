import * as vscode from "vscode";

export interface MethodAnalysis {
  isRecursive: boolean;
  methodBody: string;
  location: vscode.Location;
}

/**
 * Analyzes a Go method or function to determine if it contains recursive calls and extracts other relevant information.
 * @param document The document containing the method/function
 * @param methodMatch The regex match containing the definition
 * @param receiverType The type that the method is defined on (optional for regular functions)
 * @param methodName The name of the method/function
 * @returns Analysis results including recursion status and method body
 */
export function analyzeMethod(
  document: vscode.TextDocument,
  methodMatch: RegExpExecArray,
  receiverType: string | null,
  methodName: string
): MethodAnalysis {
  const methodBody = extractMethodBody(document, methodMatch);
  const isRecursive = detectRecursion(methodBody, receiverType, methodName);
  const location = new vscode.Location(
    document.uri,
    new vscode.Range(
      document.positionAt(methodMatch.index),
      document.positionAt(methodMatch.index + methodMatch[0].length)
    )
  );

  return {
    isRecursive,
    methodBody,
    location,
  };
}

/**
 * Extracts the full method/function body from the document.
 */
function extractMethodBody(
  document: vscode.TextDocument,
  methodMatch: RegExpExecArray
): string {
  const text = document.getText().slice(methodMatch.index);
  const openBrace = text.indexOf("{");
  if (openBrace === -1) return "";

  let braceCount = 1;
  let pos = openBrace + 1;
  let endPos = openBrace + 1;

  while (braceCount > 0 && pos < text.length) {
    if (text[pos] === "{") braceCount++;
    if (text[pos] === "}") braceCount--;
    if (braceCount === 0) {
      endPos = pos;
      break;
    }
    pos++;
  }

  return text.substring(openBrace + 1, endPos);
}

/**
 * Detects if a method/function contains recursive calls.
 * Handles both direct recursion and method recursion through receiver types.
 */
function detectRecursion(
  methodBody: string,
  receiverType: string | null,
  methodName: string
): boolean {
  const recursiveCallPatterns = [];

  // For both regular functions and methods
  recursiveCallPatterns.push(
    // Direct call without receiver
    `\\b${methodName}\\s*\\(`
  );

  // For methods only
  if (receiverType) {
    recursiveCallPatterns.push(
      // Call through receiver type
      `\\b${receiverType}\\s*\\.\\s*${methodName}\\s*\\(`,
      // Call through pointer to receiver type
      `\\b\\*?\\s*${receiverType}\\s*\\.\\s*${methodName}\\s*\\(`,
      // Call through receiver variable (assuming common patterns)
      `\\b(?:this|self|r|receiver)\\s*\\.\\s*${methodName}\\s*\\(`
    );
  }

  const recursiveCallRegex = new RegExp(recursiveCallPatterns.join("|"), "g");
  return recursiveCallRegex.test(methodBody);
}
