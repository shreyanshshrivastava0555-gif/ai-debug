/**
 * LiveDebug AI — Terminal Watcher
 * Hooks into VS Code's terminal to capture output and detect errors.
 *
 * Uses the Terminal Data Write API (vscode.window.onDidWriteTerminalData)
 * available in VS Code 1.85+
 */

import * as vscode from "vscode";

// Error signal patterns — triggers analysis when found in terminal output
const ERROR_PATTERNS = [
    /Traceback \(most recent call last\)/,          // Python
    /^\w+Error:/m,                                  // Python named errors
    /Error: .+\n\s+at /m,                           // Node.js
    /Exception in thread/,                          // Java
    /^panic:/m,                                     // Go
    /^error\[E\d+\]/m,                              // Rust
    /FATAL|SIGSEGV|Segmentation fault/,             // C/C++
    /npm ERR!/,                                     // npm
    /FAILED|BUILD FAILURE/,                         // Maven/Gradle
];

const BUFFER_FLUSH_DELAY_MS = 1200; // Wait for output to settle before analyzing

export class TerminalWatcher {
    public isWatching = false;
    private disposables: vscode.Disposable[] = [];
    private outputBuffer = new Map<string, string>(); // terminalId -> buffered output
    private flushTimers = new Map<string, NodeJS.Timeout>();
    private errorCallback: ((output: string) => void) | null = null;

    onError(callback: (output: string) => void) {
        this.errorCallback = callback;
    }

    start() {
        this.isWatching = true;

        // Listen to terminal data writes (requires VS Code 1.85+)
        const watcher = (vscode.window as any).onDidWriteTerminalData((e: any) => {
            this.handleTerminalData(e.terminal, e.data);
        });

        this.disposables.push(watcher);
    }

    stop() {
        this.isWatching = false;
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
        this.flushTimers.forEach((t) => clearTimeout(t));
        this.flushTimers.clear();
        this.outputBuffer.clear();
    }

    private handleTerminalData(terminal: vscode.Terminal, data: string) {
        // Strip ANSI escape codes for cleaner text
        const clean = data.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
        const id = (terminal as any).processId?.toString() || terminal.name;

        // Accumulate output per terminal
        const current = this.outputBuffer.get(id) || "";
        this.outputBuffer.set(id, current + clean);

        // Debounce: reset flush timer on each new chunk
        const existingTimer = this.flushTimers.get(id);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
            this.flushBuffer(id);
        }, BUFFER_FLUSH_DELAY_MS);

        this.flushTimers.set(id, timer);
    }

    private flushBuffer(terminalId: string) {
        const output = this.outputBuffer.get(terminalId) || "";
        this.outputBuffer.set(terminalId, ""); // Clear buffer

        if (!output.trim()) return;

        // Check if output contains error patterns
        const hasError = ERROR_PATTERNS.some((pattern) => pattern.test(output));
        if (hasError && this.errorCallback) {
            this.errorCallback(output);
        }
    }
}
