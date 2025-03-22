import * as vscode from "vscode";
import { analyzeMethod } from "./methodAnalyzer";

export interface InterfaceInfo {
  name: string;
  methods: string[];
  location?: vscode.Location;
}

export interface MethodInfo {
  name: string;
  receiverType: string | null; // null for regular functions
  location?: vscode.Location;
  isRecursive?: boolean;
}

export interface ImplementationCount {
  count: number;
  implementations: Array<{
    type: string;
    filePath: string;
  }>;
}

export const interfaceCache = new Map<string, InterfaceInfo>();
export const methodCache = new Map<string, MethodInfo[]>();
export const implementationCache = new Map<string, ImplementationCount>();

export function clearCaches() {
  interfaceCache.clear();
  methodCache.clear();
  implementationCache.clear();
}

export async function updateCaches() {
  clearCaches();

  const files = await vscode.workspace.findFiles("**/*.go");

  for (const file of files) {
    const document = await vscode.workspace.openTextDocument(file);
    const text = document.getText();

    // First, find all interfaces
    const interfaceRegex =
      /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface\s*{([^}]*)}/g;
    let match;
    while ((match = interfaceRegex.exec(text)) !== null) {
      const interfaceName = match[1];
      const interfaceBody = match[2];
      const methods = extractMethodNames(interfaceBody);
      const location = new vscode.Location(
        document.uri,
        new vscode.Range(
          document.positionAt(match.index),
          document.positionAt(match.index + match[0].length)
        )
      );
      interfaceCache.set(interfaceName, {
        name: interfaceName,
        methods,
        location,
      });
    }

    // Then find all methods with receivers
    const methodRegex = /func\s*\(([^)]+)\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    while ((match = methodRegex.exec(text)) !== null) {
      const fullReceiverType = match[1].trim();
      const receiverType =
        fullReceiverType.split(/[\s*]+/).pop() || fullReceiverType;
      const methodName = match[2];
      const methods = methodCache.get(methodName) || [];

      const analysis = analyzeMethod(document, match, receiverType, methodName);
      methods.push({
        name: methodName,
        receiverType,
        location: analysis.location,
        isRecursive: analysis.isRecursive,
      });
      methodCache.set(methodName, methods);
    }

    // Finally, find regular functions
    const functionRegex = /func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    while ((match = functionRegex.exec(text)) !== null) {
      const functionName = match[1];
      const methods = methodCache.get(functionName) || [];

      const analysis = analyzeMethod(document, match, null, functionName);
      methods.push({
        name: functionName,
        receiverType: null,
        location: analysis.location,
        isRecursive: analysis.isRecursive,
      });
      methodCache.set(functionName, methods);
    }
  }
}

function extractMethodNames(interfaceBody: string): string[] {
  const methods: string[] = [];
  const methodRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
  let match;
  while ((match = methodRegex.exec(interfaceBody)) !== null) {
    methods.push(match[1]);
  }
  return methods;
}

export function findInterfacesWithMethod(methodName: string): string[] {
  const interfaces: string[] = [];
  for (const [interfaceName, info] of interfaceCache) {
    if (info.methods.includes(methodName)) {
      interfaces.push(interfaceName);
    }
  }
  return interfaces;
}

export function findInterfaceMethods(interfaceName: string): string[] {
  const info = interfaceCache.get(interfaceName);
  return info ? info.methods : [];
}
