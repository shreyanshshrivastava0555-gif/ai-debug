package com.livedebug.terminal

import com.intellij.execution.filters.ConsoleFilterProvider
import com.intellij.execution.filters.Filter
import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project
import com.livedebug.settings.LiveDebugSettings
import com.livedebug.api.LiveDebugClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class TerminalErrorWatcher : ConsoleFilterProvider {

    private val errorPatterns = listOf(
        Regex("Traceback \\(most recent call last\\)"),
        Regex("^\\w+Error:.*", RegexOption.MULTILINE),
        Regex("Exception in thread"),
        Regex("^panic:.*", RegexOption.MULTILINE),
        Regex("^error\\[E\\d+\\].*", RegexOption.MULTILINE),
        Regex("FATAL|SIGSEGV|Segmentation fault")
    )

    override fun getDefaultFilters(project: Project): Array<Filter> {
        return arrayOf(LiveDebugFilter(project))
    }

    class LiveDebugFilter(private val project: Project) : Filter {
        private val outputBuffer = StringBuilder()
        private var lastFlushTime = System.currentTimeMillis()

        override fun applyFilter(line: String, entireLength: Int): Filter.Result? {
            val settings = LiveDebugSettings.getInstance()
            if (!settings.autoWatch) return null

            outputBuffer.append(line)
            
            // Debounce processing to buffer multi-line errors
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastFlushTime > 1200) {
                flushBuffer(project, settings)
                lastFlushTime = currentTime
            }

            return null // Do not modify the console output
        }

        private fun flushBuffer(project: Project, settings: LiveDebugSettings) {
            val output = outputBuffer.toString()
            outputBuffer.clear()

            if (output.isBlank()) return

            val hasError = errorPatterns.any { it.containsMatchIn(output) }
            if (hasError) {
                CoroutineScope(Dispatchers.IO).launch {
                    val client = LiveDebugClient(settings.serverUrl)
                    val response = client.analyzeError(output, null, null) // In a real scenario we'd query standard editors
                    
                    if (response != null) {
                        NotificationGroupManager.getInstance()
                            .getNotificationGroup("LiveDebug AI Notifications")
                            .createNotification(
                                "LiveDebug: ${response.errorType}",
                                "<b>Error:</b> ${response.errorMessage}<br/><b>Explanation:</b> ${response.explanation}<br/><b>Fix:</b> ${response.suggestedFix}",
                                NotificationType.ERROR
                            )
                            .notify(project)
                    }
                }
            }
        }
    }
}
