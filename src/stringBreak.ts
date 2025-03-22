import * as vscode from "vscode";

let firstContinuationIndent: string | null = null;

export function registerStringBreak(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      firstContinuationIndent = null;
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document.languageId !== "go") {
        vscode.commands.executeCommand("setContext", "isInsideGoString", false);
        return;
      }

      const position = editor.selection.active;
      const line = editor.document.lineAt(position.line);
      const text = line.text;
      const beforeCursor = text.substring(0, position.character);
      const afterCursor = text.substring(position.character);

      const stringStart = beforeCursor.lastIndexOf('"');
      const stringEnd = afterCursor.indexOf('"');

      const isInside = stringStart !== -1 && stringEnd !== -1;
      vscode.commands.executeCommand(
        "setContext",
        "isInsideGoString",
        isInside
      );
    })
  );

  const disposable = vscode.commands.registerTextEditorCommand(
    "golang-string-break.breakString",
    (textEditor) => {
      const position = textEditor.selection.active;
      const line = textEditor.document.lineAt(position.line);
      const text = line.text;
      const beforeCursor = text.substring(0, position.character);
      const afterCursor = text.substring(position.character);

      const stringStart = beforeCursor.lastIndexOf('"');
      const stringEnd = afterCursor.indexOf('"');

      if (stringStart === -1 || stringEnd === -1) {
        return;
      }

      const stringBeforeCursor = beforeCursor.substring(stringStart + 1);
      const stringAfterCursor = afterCursor.substring(0, stringEnd);

      const baseIndentation = text.match(/^\s*/)?.[0] || "";

      let newIndentation;
      if (!text.includes('" +')) {
        if (baseIndentation.includes("\t")) {
          newIndentation = baseIndentation;
        } else {
          newIndentation = baseIndentation + "\t";
        }
      }

      const newText =
        beforeCursor.substring(0, stringStart) +
        '"' +
        stringBeforeCursor +
        '" +\n' +
        newIndentation +
        '"' +
        stringAfterCursor +
        '"' +
        afterCursor.substring(stringEnd + 1);

      textEditor
        .edit((editBuilder) => {
          editBuilder.replace(line.range, newText);
        })
        .then(() => {
          const newPosition = new vscode.Position(
            position.line + 1,
            newIndentation.length + 1
          );
          textEditor.selection = new vscode.Selection(newPosition, newPosition);
        });
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivateStringBreak() {
  firstContinuationIndent = null;
}
