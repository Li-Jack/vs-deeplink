// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('The extension "deeplink" is now active!');

	// The command is defined in the package.json file
	const command1 = vscode.commands.registerCommand('deeplink.copyLocalLink', () => {

		// The display message
		vscode.window.showInformationMessage('Copy local DeepLink!');

		// Get the active editor
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			vscode.window.showInformationMessage('No active editor found.');
			return;
		}

		// Get the path of the current file and the cursor position (convert to 1-based indices)
		const documentUri = activeEditor.document.uri;
		const filePath = activeEditor.document.fileName;
		const cursorPosition = activeEditor.selection.active;
		const line = cursorPosition.line + 1;
		const column = cursorPosition.character + 1;

		// Normalise the URI so vscode understands the deeplink and opens at the desired position
		const encodedPath = encodeURI(documentUri.path);
		const deeplink = `vscode://file${encodedPath}:${line}:${column}`;

		// Extract the base name of the file path
		const baseName = path.basename(filePath);
		// Make a markdown link
		const link = `[${baseName}:${line}:${column}](${deeplink})`;

		// Copy the absolute path to the clipboard
		vscode.env.clipboard.writeText(link).then(
			() => {
				vscode.window.showInformationMessage('DeepLink (with cursor position) copied to clipboard!');
			},
			(error) => {
				vscode.window.showErrorMessage(`Failed to copy absolute path: ${error}`);
			}
		);
	});

	context.subscriptions.push(command1);

}
