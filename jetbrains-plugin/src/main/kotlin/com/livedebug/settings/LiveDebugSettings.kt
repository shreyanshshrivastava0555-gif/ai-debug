package com.livedebug.settings

import com.intellij.openapi.components.*
import com.intellij.openapi.project.Project
import com.intellij.util.xmlb.XmlSerializerUtil

@State(
    name = "LiveDebugSettings",
    storages = [Storage("LiveDebugPlugin.xml")]
)
class LiveDebugSettings : PersistentStateComponent<LiveDebugSettings> {
    var serverUrl: String = "http://localhost:8000"
    var autoWatch: Boolean = true
    var languageOverride: String = "auto"

    override fun getState(): LiveDebugSettings {
        return this
    }

    override fun loadState(state: LiveDebugSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        fun getInstance(): LiveDebugSettings {
            return ApplicationManager.getApplication().getService(LiveDebugSettings::class.java)
        }
    }
}
