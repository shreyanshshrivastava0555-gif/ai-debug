"use strict";
/**
 * LiveDebug AI — API Client
 * HTTP client for communicating with the FastAPI backend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveDebugClient = void 0;
class LiveDebugClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async analyzeError(request) {
        const response = await fetch(`${this.baseUrl}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Backend error (${response.status}): ${error}`);
        }
        return response.json();
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, { method: "GET" });
            return response.ok;
        }
        catch {
            return false;
        }
    }
}
exports.LiveDebugClient = LiveDebugClient;
//# sourceMappingURL=apiClient.js.map