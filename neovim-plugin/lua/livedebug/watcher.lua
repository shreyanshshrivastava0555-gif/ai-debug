--[[
  LiveDebug AI — Terminal Watcher (Neovim)
  Hooks into Neovim's terminal buffers and watches for error patterns.
--]]

local M = {}
M.active = false

local config = {}
local error_callback = nil
local buffer_map = {}  -- bufnr -> accumulated output
local flush_timers = {}

-- Error signal patterns
local ERROR_PATTERNS = {
  "Traceback %(most recent call last%)",  -- Python
  "%w+Error:",                             -- Python errors
  "Error: .+\n%s+at ",                    -- Node.js
  "Exception in thread",                  -- Java
  "^panic:",                               -- Go
  "^error%[E%d+%]",                       -- Rust
  "BUILD FAILURE",                         -- Maven
  "FAILED",                               -- General
}

function M.setup(cfg, on_error)
  config = cfg
  error_callback = on_error
end

function M.start()
  if M.active then return end
  M.active = true

  -- Watch all existing terminal buffers
  for _, bufnr in ipairs(vim.api.nvim_list_bufs()) do
    if vim.bo[bufnr].buftype == "terminal" then
      M._attach_to_buffer(bufnr)
    end
  end

  -- Watch newly opened terminal buffers
  vim.api.nvim_create_autocmd("TermOpen", {
    group = vim.api.nvim_create_augroup("LiveDebugWatcher", { clear = true }),
    callback = function(ev)
      M._attach_to_buffer(ev.buf)
    end,
  })
end

function M.stop()
  M.active = false
  vim.api.nvim_clear_autocmds({ group = "LiveDebugWatcher" })
  buffer_map = {}
  for _, timer in pairs(flush_timers) do
    timer:stop()
    timer:close()
  end
  flush_timers = {}
end

function M.toggle()
  if M.active then
    M.stop()
  else
    M.start()
  end
end

function M._attach_to_buffer(bufnr)
  -- Use nvim_buf_attach to get line-by-line updates
  vim.api.nvim_buf_attach(bufnr, false, {
    on_lines = function(_, buf, _, first_line, last_line)
      if not M.active then return true end  -- true = detach

      local lines = vim.api.nvim_buf_get_lines(buf, first_line, last_line, false)
      local text = table.concat(lines, "\n")

      if not buffer_map[buf] then buffer_map[buf] = "" end
      buffer_map[buf] = buffer_map[buf] .. "\n" .. text

      -- Debounce: restart flush timer
      if flush_timers[buf] then
        flush_timers[buf]:stop()
        flush_timers[buf]:close()
      end

      local timer = vim.uv.new_timer()
      flush_timers[buf] = timer
      timer:start(1200, 0, vim.schedule_wrap(function()
        M._flush_buffer(buf)
        timer:stop()
        timer:close()
        flush_timers[buf] = nil
      end))
    end,
  })
end

function M._flush_buffer(bufnr)
  local output = buffer_map[bufnr] or ""
  buffer_map[bufnr] = ""

  if output:match("^%s*$") then return end

  -- Check for error patterns
  local has_error = false
  for _, pattern in ipairs(ERROR_PATTERNS) do
    if output:match(pattern) then
      has_error = true
      break
    end
  end

  if has_error and error_callback then
    error_callback(output)
  end
end

return M
