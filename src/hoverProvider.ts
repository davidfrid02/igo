import * as vscode from "vscode";
import {
  interfaceCache,
  methodCache,
  findInterfaceMethods,
} from "./sharedCache";

export function registerHoverProvider(
  context: vscode.ExtensionContext
): vscode.Disposable {
  const hoverProvider = vscode.languages.registerHoverProvider("go", {
    provideHover(document, position) {
      const range = document.getWordRangeAtPosition(position);
      if (!range) {
        return null;
      }

      const word = document.getText(range);
      const line = document.lineAt(position.line).text;

      // Check for method definitions
      const methodRegex = /func\s*\(([^)]+)\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
      const methodMatch = line.match(methodRegex);
      if (methodMatch && methodMatch[2] === word) {
        const method = methodMatch[2];
        const receiverType = methodMatch[1]
          .trim()
          .split(/[\s*]+/)
          .pop();
        if (!receiverType) {
          return null;
        }

        const interfaces = [];
        for (const [name, info] of interfaceCache) {
          if (info.methods.includes(method)) {
            interfaces.push(name);
          }
        }

        if (interfaces.length > 0) {
          const markdown = new vscode.MarkdownString();
          markdown.isTrusted = true;
          markdown.supportHtml = true;

          markdown.appendMarkdown(
            `This method is required by the following interfaces:\n\n`
          );

          for (const iface of interfaces) {
            const commandUri = `command:golang-string-break.navigateToInterface?${encodeURIComponent(
              JSON.stringify([iface])
            )}`;
            markdown.appendMarkdown(`• [${iface}](${commandUri})\n`);
          }

          return new vscode.Hover(markdown);
        }
      }

      // Check for regular function definitions
      const functionRegex = /func\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
      const functionMatch = line.match(functionRegex);
      if (functionMatch && functionMatch[1] === word) {
        const functionName = functionMatch[1];
        const functions = methodCache.get(functionName) || [];

        if (functions.length > 0) {
          const markdown = new vscode.MarkdownString();
          markdown.isTrusted = true;
          markdown.supportHtml = true;

          const func = functions[0]; // For regular functions, there should be only one
          if (func.isRecursive) {
            markdown.appendMarkdown(`↺ This function is recursive\n\n`);
          }

          return new vscode.Hover(markdown);
        }
      }

      // Check for interface definitions
      const interfaceRegex = /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface/;
      const interfaceMatch = line.match(interfaceRegex);
      if (interfaceMatch && interfaceMatch[1] === word) {
        const interfaceName = word;
        const methods = findInterfaceMethods(interfaceName);

        if (methods.length > 0) {
          const markdown = new vscode.MarkdownString();
          markdown.isTrusted = true;
          markdown.supportHtml = true;

          markdown.appendMarkdown(
            `${interfaceName} requires the following methods:\n\n`
          );

          for (const method of methods) {
            const implementations = methodCache.get(method) || [];
            markdown.appendMarkdown(
              `${method} (${implementations.length} implementation${
                implementations.length !== 1 ? "s" : ""
              }):\n\n`
            );

            for (const impl of implementations) {
              const commandArgs = {
                methodName: method,
                receiverType: impl.receiverType,
              };
              const commandUri = `command:golang-string-break.navigateToMethod?${encodeURIComponent(
                JSON.stringify(commandArgs)
              )}`;

              // Add recursive icon if the method is recursive
              const recursiveIcon = impl.isRecursive ? "↺ " : "";
              const displayName = impl.receiverType || "function";
              markdown.appendMarkdown(
                `• ${recursiveIcon}[${displayName}](${commandUri})\n`
              );
            }
            markdown.appendMarkdown("\n");
          }

          return new vscode.Hover(markdown);
        }
      }

      return null;
    },
  });

  context.subscriptions.push(hoverProvider);
  return hoverProvider;
}
