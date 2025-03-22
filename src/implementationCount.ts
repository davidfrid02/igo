import * as vscode from "vscode";
import {
  interfaceCache,
  implementationCache,
  clearCaches,
  findInterfaceMethods,
  updateCaches,
} from "./sharedCache";

export interface ImplementationCountResult {
  decorationProvider: vscode.TextEditorDecorationType;
  fileWatcher: vscode.FileSystemWatcher;
  dispose: () => void;
}

export function registerImplementationCount(
  context: vscode.ExtensionContext
): ImplementationCountResult {
  updateImplementationCache();

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.go");
  const decorationProvider = vscode.window.createTextEditorDecorationType({
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
  });

  const disposables: vscode.Disposable[] = [];
  disposables.push(fileWatcher, decorationProvider);

  const updateAndRefresh = async () => {
    await updateImplementationCache();
    vscode.window.visibleTextEditors.forEach((editor) => {
      if (editor.document.languageId === "go") {
        updateDecorations(editor, decorationProvider);
      }
    });
  };

  disposables.push(
    fileWatcher.onDidChange(updateAndRefresh),
    fileWatcher.onDidCreate(updateAndRefresh),
    fileWatcher.onDidDelete(updateAndRefresh)
  );

  disposables.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        updateDecorations(editor, decorationProvider);
      }
    })
  );

  disposables.push(
    vscode.workspace.onDidChangeTextDocument(async (event) => {
      if (event.document === vscode.window.activeTextEditor?.document) {
        if (event.document.languageId === "go") {
          await updateImplementationCache();
          updateDecorations(vscode.window.activeTextEditor, decorationProvider);
        }
      }
    })
  );

  // Add all disposables to the extension's subscriptions
  context.subscriptions.push(...disposables);

  return {
    decorationProvider,
    fileWatcher,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}

async function updateImplementationCache() {
  await updateCaches();
  implementationCache.clear();

  const files = await vscode.workspace.findFiles("**/*.go");
  const typeMethodsMap = new Map();
  const typeLocations = new Map();

  // Use a document manager to handle document lifecycle
  const documentManager = new DocumentManager();

  try {
    // First pass: collect all methods and type locations
    for (const file of files) {
      const document = await documentManager.openDocument(file);
      const text = document.getText();

      // Find type definitions
      const typeRegex = /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+struct/g;
      let typeMatch;
      while ((typeMatch = typeRegex.exec(text)) !== null) {
        typeLocations.set(typeMatch[1], file);
      }

      // Find methods
      const methodRegex =
        /func\s*\(\s*\w+\s*(?:\*\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
      let match;
      while ((match = methodRegex.exec(text)) !== null) {
        const receiverType = match[1];
        const methodName = match[2];
        const typeMethods = typeMethodsMap.get(receiverType) || new Set();
        typeMethods.add(methodName);
        typeMethodsMap.set(receiverType, typeMethods);
      }
    }

    // Process the collected data
    for (const [interfaceName, info] of interfaceCache) {
      const implementations = [];
      let count = 0;

      for (const [type, methods] of typeMethodsMap) {
        const requiredMethods = new Set(info.methods);
        let implementsAll = true;

        for (const method of requiredMethods) {
          if (!methods.has(method)) {
            implementsAll = false;
            break;
          }
        }

        if (implementsAll) {
          count++;
          const filePath = typeLocations.get(type);
          if (filePath) {
            implementations.push({
              type,
              filePath: filePath.fsPath,
            });
          }
        }
      }

      if (count > 0) {
        implementationCache.set(interfaceName, { count, implementations });
      }
    }
  } finally {
    await documentManager.dispose();
  }
}

// Helper class to manage document lifecycle
class DocumentManager {
  private documents = new Set<vscode.TextDocument>();

  async openDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    const document = await vscode.workspace.openTextDocument(uri);
    this.documents.add(document);
    return document;
  }

  async dispose() {
    // VS Code manages TextDocument lifecycle, but we'll clear our references
    this.documents.clear();
  }
}

function updateDecorations(
  editor: vscode.TextEditor,
  decorationProvider: vscode.TextEditorDecorationType
) {
  if (editor.document.languageId !== "go") {
    return;
  }

  const decorations: vscode.DecorationOptions[] = [];
  const text = editor.document.getText();

  const interfaceRegex = /type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+interface/g;
  let match;
  while ((match = interfaceRegex.exec(text)) !== null) {
    const interfaceName = match[1];
    const count = implementationCache.get(interfaceName);

    if (count) {
      const hoverMarkdown = new vscode.MarkdownString();
      hoverMarkdown.isTrusted = true;
      hoverMarkdown.supportHtml = true;
      hoverMarkdown.supportThemeIcons = true;

      for (const impl of count.implementations) {
        let displayPath = impl.filePath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
          const workspacePath = workspaceFolders[0].uri.fsPath;
          displayPath = impl.filePath
            .replace(workspacePath, "")
            .replace(/^[/\\]/, "");
        }

        const methods = findInterfaceMethods(interfaceName);
        const methodName = methods[0];
        const args = JSON.stringify({ methodName, receiverType: impl.type });
        const commandArgs = encodeURIComponent(args);
        const commandUri = `command:golang-string-break.navigateToMethod?${commandArgs}`;

        hoverMarkdown.appendMarkdown(
          `<div style="font-size: 0.85em; line-height: 1.2; white-space: nowrap;">` +
            `<a href="${commandUri}" style="color: #4e94ce; text-decoration: underline; font-family: monospace;">${impl.type}</a>` +
            `<span style="color: #888888; font-family: monospace; margin-left: 1em;">(${displayPath})</span>` +
            `</div>`
        );
      }

      const decoration = {
        range: new vscode.Range(
          editor.document.positionAt(match.index),
          editor.document.positionAt(match.index + match[0].length)
        ),
        hoverMessage: hoverMarkdown,
        renderOptions: {
          before: {
            contentText: `● ${count.count}`,
            color: new vscode.ThemeColor("symbolIcon.interfaceForeground"),
            margin: "0 0.5em 0 0",
            fontWeight: "bold",
          },
        },
      };

      decorations.push(decoration);
    }
  }

  editor.setDecorations(decorationProvider, decorations);
}

export function deactivateImplementationCount() {
  clearCaches();
}
