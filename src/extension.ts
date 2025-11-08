// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import * as path from 'path';

const pendingNotebookNavigationKeys = new Set<string>();

// This method is called when the extension is activated
// The extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('The extension "deeplink" is now active!');

	// Register URI Handler to intercept custom deeplink URLs
	const uriHandler: vscode.UriHandler = {
		handleUri(uri: vscode.Uri) {
			console.log('Received URI:', uri.toString());
			
			// Handle notebook deeplinks: vscode://eystein.makedeeplink/openNotebook?file=...&cell=N
			if (uri.path === '/openNotebook') {
				const query = new URLSearchParams(uri.query);
				const filePath = query.get('file');
				const cellStr = query.get('cell');
				
				if (filePath && cellStr) {
					const cellNumber = parseInt(cellStr, 10);
					if (cellNumber > 0) {
						openNotebookAndNavigate(filePath, cellNumber);
					}
				}
			}
		}
	};
	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

	// Listen for notebook opening to handle cell navigation from URI fragments
	const onDidOpenNotebook = vscode.workspace.onDidOpenNotebookDocument((notebook) => {
		handleNotebookLinkNavigation(notebook.uri);
	});

	// Handle notebook editors that become active (covers already-open notebooks)
	const onDidChangeActiveNotebookEditor = vscode.window.onDidChangeActiveNotebookEditor((editor) => {
		if (editor) {
			handleNotebookLinkNavigation(editor.notebook.uri);
		}
	});

	// Main command: Copy DeepLink (handles both text files and notebooks)
	const copyLinkCommand = vscode.commands.registerCommand('deeplink.copyLocalLink', () => {
		vscode.window.showInformationMessage('Copy local DeepLink!');

		// Check if we're in a notebook editor
		const notebookEditor = vscode.window.activeNotebookEditor;
		if (notebookEditor) {
			handleNotebookDeepLink(notebookEditor);
			return;
		}

		// Check if we're in a text editor
		const textEditor = vscode.window.activeTextEditor;
		if (textEditor) {
			handleTextFileDeepLink(textEditor);
			return;
		}

		// No active editor found
		vscode.window.showInformationMessage('No active editor found.');
	});


	// If the extension activates after a notebook is already focused, attempt navigation immediately
	if (vscode.window.activeNotebookEditor) {
		handleNotebookLinkNavigation(vscode.window.activeNotebookEditor.notebook.uri);
	}

	context.subscriptions.push(copyLinkCommand, onDidOpenNotebook, onDidChangeActiveNotebookEditor);
}

// Handle deeplink generation for text files
function handleTextFileDeepLink(editor: vscode.TextEditor) {
	const documentUri = editor.document.uri;
	const filePath = editor.document.fileName;
	const cursorPosition = editor.selection.active;
	const line = cursorPosition.line + 1;
	const column = cursorPosition.character + 1;

	const encodedPath = encodeURI(documentUri.path);
	const deeplink = `vscode://file${encodedPath}:${line}:${column}`;

	const baseName = path.basename(filePath);
	const link = `[${baseName}:${line}:${column}](${deeplink})`;

	vscode.env.clipboard.writeText(link).then(
		() => {
			vscode.window.showInformationMessage('DeepLink (with cursor position) copied to clipboard!');
		},
		(error) => {
			vscode.window.showErrorMessage(`Failed to copy deeplink: ${error}`);
		}
	);
}

// Handle deeplink generation for notebook cells
function handleNotebookDeepLink(editor: vscode.NotebookEditor) {
	const notebook = editor.notebook;
	const filePath = notebook.uri.fsPath;
	const baseName = path.basename(filePath);

	// Get the first selected cell index (0-based in API)
	const selection = editor.selections[0];
	const cellIndex = selection.start;

	// Display as 1-based for user readability (Cell 1, Cell 2, etc.)
	const displayCellNumber = cellIndex + 1;

	// Generate custom URI: vscode://eystein.makedeeplink/openNotebook?file=...&cell=N
	// This allows the extension to intercept and handle the cell navigation
	const encodedFilePath = encodeURIComponent(filePath);
	const deeplink = `vscode://eystein.makedeeplink/openNotebook?file=${encodedFilePath}&cell=${displayCellNumber}`;
	
	// Create markdown link
	const link = `[${baseName} Cell ${displayCellNumber}](${deeplink})`;
	
	// Log for debugging
	console.log(`Generated notebook deeplink: ${deeplink}`);
	
	vscode.env.clipboard.writeText(link).then(
		() => {
			vscode.window.showInformationMessage(
				`Notebook Cell ${displayCellNumber} DeepLink copied to clipboard!`
			);
		},
		(error) => {
			vscode.window.showErrorMessage(`Failed to copy link: ${error}`);
		}
	);
}

function handleNotebookLinkNavigation(uri: vscode.Uri) {
	const cellNumber = extractCellNumberFromUri(uri);
	if (cellNumber === null) {
		return;
	}

	scheduleNotebookNavigation(uri, cellNumber);
}

function extractCellNumberFromUri(uri: vscode.Uri): number | null {
	const fragment = uri.fragment;
	let candidate = fragment;

	if (!candidate) {
		const fullUri = uri.toString(true);
		const hashIndex = fullUri.indexOf('#');
		candidate = hashIndex >= 0 ? fullUri.slice(hashIndex + 1) : '';
	}

	if (!candidate) {
		return null;
	}

	const match = candidate.match(/(?:^|&)cell=(\d+)/i);
	if (!match) {
		return null;
	}

	const cellNumber = Number.parseInt(match[1], 10);
	if (!Number.isFinite(cellNumber) || cellNumber <= 0) {
		return null;
	}

	return cellNumber;
}

function scheduleNotebookNavigation(uri: vscode.Uri, cellNumber: number) {
	const navigationKey = createNavigationKey(uri, cellNumber);
	if (pendingNotebookNavigationKeys.has(navigationKey)) {
		return;
	}

	pendingNotebookNavigationKeys.add(navigationKey);

	const maxAttempts = 10;
	const attemptDelayMs = 200;

	const attemptNavigation = (remainingAttempts: number) => {
		const editor = findNotebookEditorByUri(uri);
		if (editor) {
			void navigateToCell(editor, cellNumber).finally(() => {
				pendingNotebookNavigationKeys.delete(navigationKey);
			});
			return;
		}

		if (remainingAttempts <= 0) {
			pendingNotebookNavigationKeys.delete(navigationKey);
			return;
		}

		setTimeout(() => attemptNavigation(remainingAttempts - 1), attemptDelayMs);
	};

	attemptNavigation(maxAttempts);
}

function createNavigationKey(uri: vscode.Uri, cellNumber: number): string {
	return `${uri.fsPath}|cell=${cellNumber}`;
}

function findNotebookEditorByUri(uri: vscode.Uri): vscode.NotebookEditor | undefined {
	const targetPath = uri.fsPath;
	return vscode.window.visibleNotebookEditors.find(
		(editor) => editor.notebook.uri.fsPath === targetPath
	);
}

// Open a notebook file and navigate to a specific cell
async function openNotebookAndNavigate(filePath: string, cellNumber: number) {
	try {
		// Convert file path to URI
		const fileUri = vscode.Uri.file(filePath);
		
		// Open the notebook file
		await vscode.commands.executeCommand('vscode.open', fileUri);
		
		// Schedule navigation to the cell (with retry mechanism)
		scheduleNotebookNavigation(fileUri, cellNumber);
		
	} catch (error) {
		console.error('Failed to open notebook:', error);
		vscode.window.showErrorMessage(`Failed to open notebook: ${error}`);
	}
}

// Navigate to a specific cell in an open notebook editor
async function navigateToCell(editor: vscode.NotebookEditor, cellNumber: number) {
	try {
		// Convert 1-based cell number to 0-based index
		const cellIndex = cellNumber - 1;
		
		// Validate cell index
		if (cellIndex < 0 || cellIndex >= editor.notebook.cellCount) {
			vscode.window.showWarningMessage(
				`Cell ${cellNumber} is out of range. Notebook has ${editor.notebook.cellCount} cells.`
			);
			return;
		}
		
		// Select and reveal the target cell
		const targetRange = new vscode.NotebookRange(cellIndex, cellIndex + 1);
		editor.selection = targetRange;
		
		// Reveal the cell in the center of the viewport
		editor.revealRange(targetRange, vscode.NotebookEditorRevealType.InCenter);
		
		// Show success message
		vscode.window.showInformationMessage(`Jumped to Cell ${cellNumber}`);
		
		console.log(`Successfully navigated to cell ${cellNumber}`);
		
	} catch (error) {
		console.error('Failed to navigate to cell:', error);
		vscode.window.showErrorMessage(`Failed to navigate to cell: ${error}`);
	}
}


