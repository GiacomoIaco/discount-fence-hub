# Chrome DevTools MCP Troubleshooting

## Quick Fix (Most Common Issue)

Stale lock files from a previous Chrome session:

```powershell
# Kill Chrome and clear lock files
powershell -Command "Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force"
powershell -Command "Remove-Item -Path 'C:\Users\giaco\.cache\chrome-devtools-mcp\chrome-profile\Singleton*' -ErrorAction SilentlyContinue"
```

Then use MCP tools directly - Chrome will launch automatically.

---

## Quick Check: Is MCP Working?

**Prompt me with:** "Check if Chrome DevTools MCP is available"

I should have access to tools starting with `mcp__chrome-devtools__` like:
- `mcp__chrome-devtools__list_pages`
- `mcp__chrome-devtools__navigate_page`
- `mcp__chrome-devtools__take_screenshot`

If I don't have these tools, follow the steps below.

---

## Troubleshooting Steps

### 1. Verify Configuration Files (Windows)

```powershell
# Check .mcp.json exists
if (Test-Path ".mcp.json") { Write-Host "Found .mcp.json" } else { Write-Host "Missing .mcp.json" }

# Check Chrome path
if (Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe") { Write-Host "Chrome found" } else { Write-Host "Chrome missing" }

# Verify chrome-devtools-mcp works
npx chrome-devtools-mcp@latest --version
```

### 2. Reset MCP Project Approvals

```bash
claude mcp reset-project-choices
```

### 3. Restart Claude Code
- Exit Claude Code completely
- Restart Claude Code
- When prompted, **approve** the `chrome-devtools` MCP server

### 4. Verify MCP is Active
After restart, prompt me with: "List available MCP tools"

---

## Configuration Reference

### Location: `.mcp.json` (project root)
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"],
      "env": {
        "CHROME_EXECUTABLE_PATH": "C:/Program Files/Google/Chrome/Application/chrome.exe"
      }
    }
  }
}
```

### Location: `.claude/settings.local.json`
Should include:
```json
{
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["chrome-devtools"]
}
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Browser already running" error | Stale lock files | Kill Chrome + delete `Singleton*` files (see Quick Fix above) |
| "Target closed" error | MCP connection reset | Try the MCP tool again - usually works on retry |
| No MCP tools available | Server not approved | Run `claude mcp reset-project-choices` and restart |
| chrome-devtools-mcp not found | Package not installed | Run `npx -y chrome-devtools-mcp@latest --version` |
| Chrome not found | Wrong path in config | Update `CHROME_EXECUTABLE_PATH` in `.mcp.json` |
