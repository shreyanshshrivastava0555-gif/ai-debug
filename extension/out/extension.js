"use strict";
/**
 * LiveDebug AI — VS Code Extension
 * Watches the integrated terminal, detects errors, and streams AI analysis.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const terminalWatcher_1 = require("./terminalWatcher");
const debugPanel_1 = require("./debugPanel");
const apiClient_1 = require("./apiClient");
let terminalWatcher = null;
let debugPanel = null;
let client;
let statusBarItem;
function activate(context) {
    console.log("LiveDebug AI activated");
    const config = vscode.workspace.getConfiguration("livedebug");
    client = new apiClient_1.LiveDebugClient(config.get("serverUrl") || "http://localhost:8000");
    // Status bar toggle button
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = "livedebug.toggleAutoWatch";
    updateStatusBar(false);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Command: analyze selected text in terminal or editor
    context.subscriptions.push(vscode.commands.registerCommand("livedebug.analyzeSelection", async () => {
        const editor = vscode.window.activeTextEditor;
        const selectedText = editor?.document.getText(editor.selection) || "";
        if (!selectedText.trim()) {
            vscode.window.showWarningMessage("LiveDebug AI: Please select terminal output or error text to analyze.");
            return;
        }
        await analyzeOutput(selectedText, context.extensionUri);
    }));
    // Command: toggle auto-watch
    context.subscriptions.push(vscode.commands.registerCommand("livedebug.toggleAutoWatch", () => {
        if (terminalWatcher?.isWatching) {
            terminalWatcher.stop();
            updateStatusBar(false);
            vscode.window.showInformationMessage("LiveDebug AI: Auto-watch stopped.");
        }
        else {
            startWatcher(context.extensionUri);
            updateStatusBar(true);
            vscode.window.showInformationMessage("LiveDebug AI: Watching terminal for errors...");
        }
    }));
    // Command: open panel manually
    context.subscriptions.push(vscode.commands.registerCommand("livedebug.openPanel", () => {
        getOrCreatePanel(context.extensionUri);
    }));
    // Auto-start watcher if configured
    if (config.get("autoWatch")) {
        startWatcher(context.extensionUri);
        updateStatusBar(true);
    }
}
function startWatcher(extensionUri) {
    terminalWatcher = new terminalWatcher_1.TerminalWatcher();
    terminalWatcher.onError(async (output) => {
        await analyzeOutput(output, extensionUri);
    });
    terminalWatcher.start();
}
async function analyzeOutput(rawOutput, extensionUri) {
    const panel = getOrCreatePanel(extensionUri);
    panel.showAnalyzing();
    try {
        const config = vscode.workspace.getConfiguration("livedebug");
        const language = config.get("language") === "auto" ? undefined : config.get("language");
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
    }
    catch (err) {
        panel.showError(err.message || "Failed to connect to LiveDebug AI backend.");
    }
}
function getOrCreatePanel(extensionUri) {
    if (!debugPanel || debugPanel.disposed) {
        debugPanel = new debugPanel_1.DebugPanel(extensionUri);
    }
    else {
        debugPanel.reveal();
    }
    return debugPanel;
}
function updateStatusBar(active) {
    statusBarItem.text = active ? "$(bug) LiveDebug: ON" : "$(bug) LiveDebug: OFF";
    statusBarItem.tooltip = active
        ? "LiveDebug AI is watching your terminal. Click to stop."
        : "LiveDebug AI is off. Click to start watching.";
    statusBarItem.backgroundColor = active
        ? new vscode.ThemeColor("statusBarItem.warningBackground")
        : undefined;
}
function deactivate() {
    terminalWatcher?.stop();
    debugPanel?.dispose();
}
//# sourceMappingURL=extension.js.map