/**
 * LiveDebug AI — API Client
 * HTTP client for communicating with the FastAPI backend.
 */

interface AnalyzeRequest {
    raw_output: string;
    language?: string;
    file_context?: string;
    session_id?: string;
}

export class LiveDebugClient {
    constructor(private baseUrl: string) { }

    async analyzeError(request: AnalyzeRequest): Promise<any> {
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

    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/health`, { method: "GET" });
            return response.ok;
        } catch {
            return false;
        }
    }
}
