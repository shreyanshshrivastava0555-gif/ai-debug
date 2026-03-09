--[[
  LiveDebug AI — Neovim Plugin
  Real-time terminal error detection and AI debugging analysis.
  Requires: Neovim 0.9+, curl (for HTTP requests)

  Installation (lazy.nvim):
    { "yourusername/livedebug.nvim", config = function()
        require("livedebug").setup({ server_url = "http://localhost:8000" })
      end
    }
--]]

local M = {}
local api = require("livedebug.api")
local watcher = require("livedebug.watcher")
local ui = require("livedebug.ui")

-- Default configuration
M.config = {
  server_url = "http://localhost:8000",
  auto_watch = true,
  language = "auto",   -- auto, python, javascript, java, go, rust
  keymap_analyze = "<leader>da",
  keymap_toggle = "<leader>dt",
  keymap_open = "<leader>do",
}

function M.setup(opts)
  M.config = vim.tbl_deep_extend("force", M.config, opts or {})

  api.setup(M.config)
  ui.setup(M.config)
  watcher.setup(M.config, function(output)
    M.analyze(output)
  end)

  -- Keymaps
  vim.keymap.set("n", M.config.keymap_analyze, function()
    M.analyze_visual_selection()
  end, { desc = "LiveDebug AI: Analyze selection" })

  vim.keymap.set("v", M.config.keymap_analyze, function()
    M.analyze_visual_selection()
  end, { desc = "LiveDebug AI: Analyze selection" })

  vim.keymap.set("n", M.config.keymap_toggle, function()
    watcher.toggle()
    vim.notify("LiveDebug AI: Auto-watch " .. (watcher.active and "ON" or "OFF"),
      vim.log.levels.INFO)
  end, { desc = "LiveDebug AI: Toggle auto-watch" })

  vim.keymap.set("n", M.config.keymap_open, function()
    ui.open()
  end, { desc = "LiveDebug AI: Open panel" })

  -- User commands
  vim.api.nvim_create_user_command("LiveDebugAnalyze", function()
    M.analyze_visual_selection()
  end, { desc = "Analyze selection with LiveDebug AI" })

  vim.api.nvim_create_user_command("LiveDebugToggle", function()
    watcher.toggle()
  end, { desc = "Toggle LiveDebug AI auto-watch" })

  -- Start watcher if auto_watch enabled
  if M.config.auto_watch then
    watcher.start()
  end
end

function M.analyze(raw_output)
  if not raw_output or raw_output == "" then return end

  ui.open()
  ui.show_analyzing()

  local lang = M.config.language ~= "auto" and M.config.language or nil
  local file_context = M._get_file_context()

  api.analyze_error(raw_output, lang, file_context, function(result, err)
    if err then
      ui.show_error(err)
      return
    end
    ui.show_result(result)
  end)
end

function M.analyze_visual_selection()
  -- Get selected text (works in both normal and visual mode)
  local mode = vim.fn.mode()
  local lines

  if mode == "v" or mode == "V" then
    local start_pos = vim.fn.getpos("'<")
    local end_pos = vim.fn.getpos("'>")
    lines = vim.fn.getline(start_pos[2], end_pos[2])
  else
    -- Use clipboard content if no selection
    lines = { vim.fn.getreg("+") }
  end

  if not lines or #lines == 0 then
    vim.notify("LiveDebug AI: No text selected. Select error output first.", vim.log.levels.WARN)
    return
  end

  M.analyze(table.concat(lines, "\n"))
end

function M._get_file_context()
  local bufnr = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
  if #lines > 200 then
    lines = vim.list_slice(lines, 1, 200)  -- Limit context size
  end
  return table.concat(lines, "\n")
end

return M
