--[[
  LiveDebug AI — API Client (Neovim)
  Uses curl via vim.fn.jobstart for async HTTP requests to the FastAPI backend.
--]]

local M = {}
local config = {}

function M.setup(cfg)
  config = cfg
end

function M.analyze_error(raw_output, language, file_context, callback)
  local body = vim.json.encode({
    raw_output = raw_output,
    language = language,
    file_context = file_context,
  })

  -- Write body to a temp file (avoids shell escaping issues)
  local tmpfile = vim.fn.tempname()
  local f = io.open(tmpfile, "w")
  if not f then
    callback(nil, "Failed to create temp file for request body")
    return
  end
  f:write(body)
  f:close()

  local url = config.server_url .. "/api/analyze"
  local stdout_chunks = {}

  local job_id = vim.fn.jobstart({
    "curl", "-s", "-X", "POST",
    "-H", "Content-Type: application/json",
    "--data", "@" .. tmpfile,
    "--max-time", "30",
    url,
  }, {
    stdout_buffered = true,
    on_stdout = function(_, data)
      for _, line in ipairs(data) do
        if line ~= "" then
          table.insert(stdout_chunks, line)
        end
      end
    end,
    on_exit = function(_, exit_code)
      vim.fn.delete(tmpfile)

      if exit_code ~= 0 then
        vim.schedule(function()
          callback(nil, "curl failed (exit " .. exit_code .. "). Is the backend running?")
        end)
        return
      end

      local response_text = table.concat(stdout_chunks, "")
      local ok, result = pcall(vim.json.decode, response_text)

      vim.schedule(function()
        if not ok or not result then
          callback(nil, "Invalid response from backend: " .. response_text:sub(1, 200))
        elseif result.detail then
          callback(nil, "Backend error: " .. tostring(result.detail))
        else
          callback(result, nil)
        end
      end)
    end,
  })

  if job_id <= 0 then
    callback(nil, "Failed to start curl. Is curl installed?")
  end
end

function M.health_check(callback)
  local url = config.server_url .. "/api/health"
  vim.fn.jobstart({ "curl", "-s", "--max-time", "5", url }, {
    stdout_buffered = true,
    on_stdout = function(_, data)
      local text = table.concat(data, "")
      local ok, result = pcall(vim.json.decode, text)
      callback(ok and result and result.status == "ok")
    end,
    on_exit = function(_, code)
      if code ~= 0 then callback(false) end
    end,
  })
end

return M
