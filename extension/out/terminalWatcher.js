"use strict";
/**
 * LiveDebug AI — Terminal Watcher
 * Hooks into VS Code's terminal to capture output and detect errors.
 *
 * Uses the Terminal Data Write API (vscode.window.onDidWriteTerminalData)
 * available in VS Code 1.85+
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
exports.TerminalWatcher = void 0;
const vscode = __importStar(require("vscode"));
// Error signal patterns — triggers analysis when found in terminal output
const ERROR_PATTERNS = [
    /Traceback \(most recent call last\)/, // Python
    /^\w+Error:/m, // Python named errors
    /Error: .+\n\s+at /m, // Node.js
    /Exception in thread/, // Java
    /^panic:/m, // Go
    /^error\[E\d+\]/m, // Rust
    /FATAL|SIGSEGV|Segmentation fault/, // C/C++
    /npm ERR!/, // npm
    /FAILED|BUILD FAILURE/, // Maven/Gradle
];
const BUFFER_FLUSH_DELAY_MS = 1200; // Wait for output to settle before analyzing
class TerminalWatcher {
    isWatching = false;
    disposables = [];
    outputBuffer = new Map(); // terminalId -> buffered output
    flushTimers = new Map();
    errorCallback = null;
    onError(callback) {
        this.errorCallback = callback;
    }
    start() {
        this.isWatching = true;
        // Listen to terminal data writes (requires VS Code 1.85+)
        const watcher = vscode.window.onDidWriteTerminalData((e) => {
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
    handleTerminalData(terminal, data) {
        // Strip ANSI escape codes for cleaner text
        const clean = data.replace(/\x1B\[[0-9;]*[mGKHF]/g, "");
        const id = terminal.processId?.toString() || terminal.name;
        // Accumulate output per terminal
        const current = this.outputBuffer.get(id) || "";
        this.outputBuffer.set(id, current + clean);
        // Debounce: reset flush timer on each new chunk
        const existingTimer = this.flushTimers.get(id);
        if (existingTimer)
            clearTimeout(existingTimer);
        const timer = setTimeout(() => {
            this.flushBuffer(id);
        }, BUFFER_FLUSH_DELAY_MS);
        this.flushTimers.set(id, timer);
    }
    flushBuffer(terminalId) {
        const output = this.outputBuffer.get(terminalId) || "";
        this.outputBuffer.set(terminalId, ""); // Clear buffer
        if (!output.trim())
            return;
        // Check if output contains error patterns
        const hasError = ERROR_PATTERNS.some((pattern) => pattern.test(output));
        if (hasError && this.errorCallback) {
            this.errorCallback(output);
        }
    }
}
exports.TerminalWatcher = TerminalWatcher;
//# sourceMappingURL=terminalWatcher.js.map