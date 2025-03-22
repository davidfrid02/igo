import * as vscode from "vscode";
import { registerStringBreak } from "./stringBreak";
import { registerHoverProvider } from "./hoverProvider";
import { registerImplementationCount } from "./implementationCount";
import { interfaceCache, clearCaches, updateCaches } from "./sharedCache";

export function activate(context: vscode.ExtensionContext) {
  updateCaches();

  const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*.go");
  fileWatcher.onDidChange(() => updateCaches());
  fileWatcher.onDidCreate(() => updateCaches());
  fileWatcher.onDidDelete(() => updateCaches());

  // Register all disposables with the extension context
  registerStringBreak(context);
  const hoverProviderDisposable = registerHoverProvider(context);
  const implementationCount = registerImplementationCount(context);

  const navigateToInterfaceCommand = vscode.commands.registerCommand(
    "golang-string-break.navigateToInterface",
    async (args: string | [string]) => {
      const interfaceName = Array.isArray(args) ? args[0] : args;
      const info = interfaceCache.get(interfaceName);
      if (info?.location) {
        const document = await vscode.workspace.openTextDocument(
          info.location.uri
        );
        const editor = await vscode.window.showTextDocument(document);
        editor.selection = new vscode.Selection(
          info.location.range.start,
          info.location.range.end
        );
        editor.revealRange(
          info.location.range,
          vscode.TextEditorRevealType.InCenter
        );
      }
    }
  );

  const navigateToMethodCommand = vscode.commands.registerCommand(
    "golang-string-break.navigateToMethod",
    async (args: string | { methodName: string; receiverType: string }) => {
      let methodName: string;
      let receiverType: string | undefined;

      if (typeof args === "string") {
        methodName = JSON.parse(args);
        vscode.window.showErrorMessage(
          "Method-only navigation is not supported. Please use the implementation links."
        );
        return;
      } else {
        methodName = args.methodName;
        receiverType = args.receiverType;
      }

      if (!receiverType) {
        vscode.window.showErrorMessage(
          "No receiver type provided for navigation"
        );
        return;
      }

      const files = await vscode.workspace.findFiles("**/*.go");
      let foundMethod = false;

      // Process files in batches to limit memory usage
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const promises = batch.map(async (file) => {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();

          const structRegex = new RegExp(
            `type\\s+${receiverType}\\s+struct\\s*{[^}]*}`,
            "g"
          );
          const structMatch = structRegex.exec(text);

          if (structMatch) {
            const methodRegex = new RegExp(
              `func\\s*\\(\\s*\\w+\\s*(?:\\*\\s*)?${receiverType}\\s*\\)\\s*${methodName}\\s*\\([^)]*\\)`,
              "g"
            );

            let methodMatch;
            let lastMatch = null;
            while ((methodMatch = methodRegex.exec(text)) !== null) {
              lastMatch = methodMatch;
            }

            if (lastMatch) {
              const position = document.positionAt(lastMatch.index);
              await vscode.window.showTextDocument(document);
              vscode.window.activeTextEditor?.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
              );
              return true;
            }
          }
          return false;
        });

        // Wait for all documents in the batch to be processed
        const results = await Promise.all(promises);
        if (results.some((found) => found)) {
          foundMethod = true;
          break;
        }
      }

      if (!foundMethod) {
        vscode.window.showErrorMessage(
          `No implementation found for method ${methodName} with type ${receiverType}`
        );
      }
    }
  );

  // Register all disposables with the extension context
  context.subscriptions.push(
    hoverProviderDisposable,
    implementationCount.decorationProvider,
    implementationCount.fileWatcher,
    navigateToInterfaceCommand,
    navigateToMethodCommand
  );
}

export function deactivate() {
  // Clear all caches
  clearCaches();
}
