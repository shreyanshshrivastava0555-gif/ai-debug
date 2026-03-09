/**
 * LiveDebug AI — Debug Panel (WebView)
 * Displays AI analysis results in a VS Code side panel.
 */

import * as vscode from "vscode";

export interface AnalysisResult {
    error_type: string;
    error_message: string;
    file_path?: string;
    line_number?: number;
    explanation: string;
    suggested_fix: string;
    code_snippet?: string;
    confidence: number;
}

export class DebugPanel {
    public disposed = false;
    private panel: vscode.WebviewPanel;

    constructor(extensionUri: vscode.Uri) {
        this.panel = vscode.window.createWebviewPanel(
            "livedebugAI",
            "LiveDebug AI",
            vscode.ViewColumn.Beside,
            { enableScripts: true, retainContextWhenHidden: true }
        );

        this.panel.onDidDispose(() => {
            this.disposed = true;
        });

        this.panel.webview.html = this.getBaseHtml("Ready. Run your program and I'll catch any errors.");
    }

    reveal() {
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

    dispose() {
        this.panel.dispose();
    }

    showAnalyzing() {
        this.panel.webview.html = this.getLoadingHtml();
        this.reveal();
    }

    showResult(result: AnalysisResult) {
        this.panel.webview.html = this.getResultHtml(result);
        this.reveal();
    }

    showError(message: string) {
        this.panel.webview.html = this.getErrorHtml(message);
        this.reveal();
    }

    private getBaseHtml(message: string): string {
        return this.wrapHtml(`
      <div class="empty-state">
        <div class="icon">🐛</div>
        <p>${message}</p>
      </div>
    `);
    }

    private getLoadingHtml(): string {
        return this.wrapHtml(`
      <div class="analyzing">
        <div class="spinner"></div>
        <p>Analyzing error with AI...</p>
      </div>
    `);
    }

    private getResultHtml(r: AnalysisResult): string {
        const confidence = Math.round(r.confidence * 100);
        const codeBlock = r.code_snippet
            ? `<div class="section"><h3>💡 Suggested Fix</h3><pre><code>${escapeHtml(r.code_snippet)}</code></pre></div>`
            : "";

        const location = r.file_path
            ? `<div class="location">📍 ${r.file_path}${r.line_number ? ":" + r.line_number : ""}</div>`
            : "";

        return this.wrapHtml(`
      <div class="result">
        <div class="error-header">
          <span class="error-badge">${escapeHtml(r.error_type)}</span>
          <span class="confidence">${confidence}% confident</span>
        </div>
        <div class="error-message">${escapeHtml(r.error_message)}</div>
        ${location}

        <div class="section">
          <h3>🔍 What Happened</h3>
          <p>${escapeHtml(r.explanation)}</p>
        </div>

        <div class="section">
          <h3>🔧 How to Fix</h3>
          <p>${escapeHtml(r.suggested_fix)}</p>
        </div>

        ${codeBlock}
      </div>
    `);
    }

    private getErrorHtml(message: string): string {
        return this.wrapHtml(`
      <div class="error-state">
        <div class="icon">⚠️</div>
        <p><strong>Could not connect to LiveDebug AI backend.</strong></p>
        <p class="sub">${escapeHtml(message)}</p>
        <p class="sub">Make sure the backend is running: <code>uvicorn main:app</code></p>
      </div>
    `);
    }

    private wrapHtml(content: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LiveDebug AI</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, monospace);
    font-size: 13px;
    color: var(--vscode-editor-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    line-height: 1.6;
  }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
       color: var(--vscode-descriptionForeground); margin-bottom: 6px; }
  .section { margin-bottom: 18px; }
  .error-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .error-badge {
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    color: var(--vscode-inputValidation-errorForeground, #f48771);
    padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;
  }
  .confidence { font-size: 11px; color: var(--vscode-descriptionForeground); }
  .error-message {
    font-family: var(--vscode-editor-font-family, monospace);
    background: var(--vscode-textBlockQuote-background);
    padding: 8px 12px; border-radius: 4px; margin-bottom: 14px;
    border-left: 3px solid var(--vscode-inputValidation-errorBorder, #f48771);
    font-size: 12px; word-break: break-word;
  }
  .location { font-size: 11px; color: var(--vscode-textLink-foreground); margin-bottom: 14px; }
  pre { background: var(--vscode-textCodeBlock-background); padding: 12px;
        border-radius: 4px; overflow-x: auto; }
  code { font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; }
  .empty-state, .analyzing, .error-state {
    text-align: center; padding: 40px 20px; color: var(--vscode-descriptionForeground);
  }
  .icon { font-size: 40px; margin-bottom: 12px; }
  .sub { font-size: 11px; margin-top: 6px; }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid var(--vscode-descriptionForeground);
    border-top-color: var(--vscode-textLink-foreground);
    animation: spin 0.8s linear infinite; margin: 0 auto 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>${content}</body>
</html>`;
    }
}

function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
