/**
 * LiveDebug AI — VS Code Extension
 * Watches the integrated terminal, detects errors, and streams AI analysis.
 */

import * as vscode from "vscode";
import { TerminalWatcher } from "./terminalWatcher";
import { DebugPanel } from "./debugPanel";
import { LiveDebugClient } from "./apiClient";

let terminalWatcher: TerminalWatcher | null = null;
let debugPanel: DebugPanel | null = null;
let client: LiveDebugClient;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    console.log("LiveDebug AI activated");

    const config = vscode.workspace.getConfiguration("livedebug");
    client = new LiveDebugClient(config.get("serverUrl") || "http://localhost:8000");

    // Status bar toggle button
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "livedebug.toggleAutoWatch";
    updateStatusBar(false);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Command: analyze selected text in terminal or editor
    context.subscriptions.push(
        vscode.commands.registerCommand("livedebug.analyzeSelection", async () => {
            const editor = vscode.window.activeTextEditor;
            const selectedText = editor?.document.getText(editor.selection) || "";

            if (!selectedText.trim()) {
                vscode.window.showWarningMessage("LiveDebug AI: Please select terminal output or error text to analyze.");
                return;
            }

            await analyzeOutput(selectedText, context.extensionUri);
        })
    );

    // Command: toggle auto-watch
    context.subscriptions.push(
        vscode.commands.registerCommand("livedebug.toggleAutoWatch", () => {
            if (terminalWatcher?.isWatching) {
                terminalWatcher.stop();
                updateStatusBar(false);
                vscode.window.showInformationMessage("LiveDebug AI: Auto-watch stopped.");
            } else {
                startWatcher(context.extensionUri);
                updateStatusBar(true);
                vscode.window.showInformationMessage("LiveDebug AI: Watching terminal for errors...");
            }
        })
    );

    // Command: open panel manually
    context.subscriptions.push(
        vscode.commands.registerCommand("livedebug.openPanel", () => {
            getOrCreatePanel(context.extensionUri);
        })
    );

    // Auto-start watcher if configured
    if (config.get("autoWatch")) {
        startWatcher(context.extensionUri);
        updateStatusBar(true);
    }
}

function startWatcher(extensionUri: vscode.Uri) {
    terminalWatcher = new TerminalWatcher();
    terminalWatcher.onError(async (output: string) => {
        await analyzeOutput(output, extensionUri);
    });
    terminalWatcher.start();
}

async function analyzeOutput(rawOutput: string, extensionUri: vscode.Uri) {
    const panel = getOrCreatePanel(extensionUri);
    panel.showAnalyzing();

    try {
        const config = vscode.workspace.getConfiguration("livedebug");
        const language = config.get<string>("language") === "auto" ? undefined : config.get<string>("language");

        // Get source file context (active editor content)
        const fileContext = vscode.window.activeTextEditor?.document.getText();

        const result = await client.analyzeError({
            raw_output: rawOutput,
            language,
            file_context: fileContext,
        });

        panel.showResult(result);

        // Jump to error line if available
        if (result.file_path && result.line_number) {
            const uri = vscode.Uri.file(result.file_path);
            const pos = new vscode.Position(result.line_number - 1, 0);
            const range = new vscode.Range(pos, pos);
            vscode.window.showTextDocument(uri, { selection: range, preserveFocus: true });
        }
    } catch (err: any) {
        panel.showError(err.message || "Failed to connect to LiveDebug AI backend.");
    }
}

function getOrCreatePanel(extensionUri: vscode.Uri): DebugPanel {
    if (!debugPanel || debugPanel.disposed) {
        debugPanel = new DebugPanel(extensionUri);
    } else {
        debugPanel.reveal();
    }
    return debugPanel;
}

function updateStatusBar(active: boolean) {
    statusBarItem.text = active ? "$(bug) LiveDebug: ON" : "$(bug) LiveDebug: OFF";
    statusBarItem.tooltip = active
        ? "LiveDebug AI is watching your terminal. Click to stop."
        : "LiveDebug AI is off. Click to start watching.";
    statusBarItem.backgroundColor = active
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined;
}

export function deactivate() {
    terminalWatcher?.stop();
    debugPanel?.dispose();
}
