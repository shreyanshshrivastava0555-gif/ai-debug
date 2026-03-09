--[[
  LiveDebug AI — UI Module (Neovim)
  Displays analysis results in a floating window with syntax highlighting.
--]]

local M = {}
local win_id = nil
local buf_id = nil

function M.setup(cfg)
  -- Define highlight groups
  vim.api.nvim_set_hl(0, "LiveDebugTitle",    { fg = "#f48771", bold = true })
  vim.api.nvim_set_hl(0, "LiveDebugSection",  { fg = "#4fc1ff", bold = true })
  vim.api.nvim_set_hl(0, "LiveDebugCode",     { fg = "#ce9178", bg = "#1e1e1e" })
  vim.api.nvim_set_hl(0, "LiveDebugMuted",    { fg = "#808080" })
  vim.api.nvim_set_hl(0, "LiveDebugSuccess",  { fg = "#4ec9b0" })
end

function M.open()
  if win_id and vim.api.nvim_win_is_valid(win_id) then
    vim.api.nvim_set_current_win(win_id)
    return
  end

  -- Create dedicated buffer
  buf_id = vim.api.nvim_create_buf(false, true)
  vim.bo[buf_id].filetype = "livedebug"
  vim.bo[buf_id].modifiable = false

  -- Calculate floating window size
  local width = math.min(90, vim.o.columns - 4)
  local height = math.min(35, vim.o.lines - 4)
  local col = math.floor((vim.o.columns - width) / 2)
  local row = math.floor((vim.o.lines - height) / 2)

  win_id = vim.api.nvim_open_win(buf_id, true, {
    relative = "editor",
    width = width,
    height = height,
    col = col,
    row = row,
    style = "minimal",
    border = "rounded",
    title = " 🐛 LiveDebug AI ",
    title_pos = "center",
  })

  vim.wo[win_id].wrap = true
  vim.wo[win_id].cursorline = false

  -- Close on q or Escape
  vim.keymap.set("n", "q", function() M.close() end, { buffer = buf_id, nowait = true })
  vim.keymap.set("n", "<Esc>", function() M.close() end, { buffer = buf_id, nowait = true })
end

function M.close()
  if win_id and vim.api.nvim_win_is_valid(win_id) then
    vim.api.nvim_win_close(win_id, true)
  end
  win_id = nil
  buf_id = nil
end

function M.show_analyzing()
  M._set_lines({
    "",
    "  ⏳ Analyzing error with AI...",
    "",
    "  Please wait a moment.",
  })
end

function M.show_result(result)
  local confidence = math.floor((result.confidence or 0) * 100)
  local lines = {
    "",
    string.format("  ⚠  %s", result.error_type or "Error"),
    string.format("  %s", result.error_message or ""),
    "",
  }

  if result.file_path then
    local loc = result.file_path
    if result.line_number then loc = loc .. ":" .. result.line_number end
    table.insert(lines, "  📍 " .. loc)
    table.insert(lines, "")
  end

  table.insert(lines, "  ─── What Happened ───────────────────────────")
  table.insert(lines, "")
  -- Word-wrap explanation
  for _, line in ipairs(M._wrap(result.explanation or "", 80)) do
    table.insert(lines, "  " .. line)
  end
  table.insert(lines, "")

  table.insert(lines, "  ─── How to Fix ──────────────────────────────")
  table.insert(lines, "")
  for _, line in ipairs(M._wrap(result.suggested_fix or "", 80)) do
    table.insert(lines, "  " .. line)
  end
  table.insert(lines, "")

  if result.code_snippet and result.code_snippet ~= vim.NIL then
    table.insert(lines, "  ─── Suggested Code ──────────────────────────")
    table.insert(lines, "")
    for _, line in ipairs(vim.split(result.code_snippet, "\n")) do
      table.insert(lines, "  " .. line)
    end
    table.insert(lines, "")
  end

  table.insert(lines, string.format("  ✓ Confidence: %d%%  │  Press q to close", confidence))
  table.insert(lines, "")

  M._set_lines(lines)
end

function M.show_error(message)
  M._set_lines({
    "",
    "  ✗ LiveDebug AI: Connection Error",
    "",
    "  " .. (message or "Unknown error"),
    "",
    "  Make sure the backend is running:",
    "  $ cd backend && uvicorn main:app --reload",
    "",
    "  Press q to close",
  })
end

function M._set_lines(lines)
  if not buf_id or not vim.api.nvim_buf_is_valid(buf_id) then return end
  vim.bo[buf_id].modifiable = true
  vim.api.nvim_buf_set_lines(buf_id, 0, -1, false, lines)
  vim.bo[buf_id].modifiable = false
end

function M._wrap(text, width)
  local result = {}
  local line = ""
  for word in text:gmatch("%S+") do
    if #line + #word + 1 > width then
      table.insert(result, line)
      line = word
    else
      line = line == "" and word or (line .. " " .. word)
    end
  end
  if line ~= "" then table.insert(result, line) end
  return result
end

return M
