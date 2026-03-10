package com.livedebug.api

import com.google.gson.Gson
import com.google.gson.annotations.SerializedName
import com.intellij.openapi.diagnostic.Logger
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration

data class TerminalErrorRequest(
    @SerializedName("raw_output") val rawOutput: String,
    @SerializedName("language") val language: String?,
    @SerializedName("file_context") val fileContext: String?
)

data class DebugResponse(
    @SerializedName("error_type") val errorType: String,
    @SerializedName("error_message") val errorMessage: String,
    @SerializedName("file_path") val filePath: String?,
    @SerializedName("line_number") val lineNumber: Int?,
    @SerializedName("explanation") val explanation: String,
    @SerializedName("suggested_fix") val suggestedFix: String,
    @SerializedName("code_snippet") val codeSnippet: String?,
    @SerializedName("confidence") val confidence: Float
)

class LiveDebugClient(private val serverUrl: String) {
    private val client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()
    private val gson = Gson()
    private val log = Logger.getInstance(LiveDebugClient::class.java)

    fun analyzeError(rawOutput: String, language: String?, fileContext: String?): DebugResponse? {
        try {
            val endpoint = if (serverUrl.endsWith("/")) "${serverUrl}api/analyze" else "$serverUrl/api/analyze"
            val reqPayload = TerminalErrorRequest(rawOutput, language, fileContext)
            val json = gson.toJson(reqPayload)

            val request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build()

            val response = client.send(request, HttpResponse.BodyHandlers.ofString())

            if (response.statusCode() == 200) {
                return gson.fromJson(response.body(), DebugResponse::class.java)
            } else {
                log.warn("LiveDebug API returned ${response.statusCode()}: ${response.body()}")
            }
        } catch (e: Exception) {
            log.warn("Failed to contact LiveDebug AI Backend: ${e.message}")
        }
        return null
    }
}
