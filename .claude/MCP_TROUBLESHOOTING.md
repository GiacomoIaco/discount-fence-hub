# Chrome DevTools MCP Troubleshooting

## Quick Check: Is MCP Working?

**Prompt me with:** "Check if Chrome DevTools MCP is available"

I should have access to tools starting with `mcp__chrome-devtools__` like:
- `mcp__chrome-devtools__list_pages`
- `mcp__chrome-devtools__navigate_page`
- `mcp__chrome-devtools__take_screenshot`

If I don't have these tools, follow the steps below.

---

## Troubleshooting Steps

### 1. Verify Configuration Files
```bash
# Check .mcp.json exists and is configured
cat .mcp.json

# Check Chrome path is correct
test -f "/c/Program Files/Google/Chrome/Application/chrome.exe" && echo "Chrome found" || echo "Chrome missing"

# Verify chrome-devtools-mcp works
npx chrome-devtools-mcp@latest --version
```

### 2. Reset MCP Project Approvals
```bash
# Reset approval choices (will prompt on next restart)
claude mcp reset-project-choices
```

### 3. Restart Claude Code
- Exit Claude Code completely
- Restart Claude Code
- When prompted, **approve** the `chrome-devtools` MCP server

### 4. Verify MCP is Active
After restart, prompt me with: "List available MCP tools"

I should then be able to list tools starting with `mcp__chrome-devtools__`

---

## Configuration Reference

### Location: `.mcp.json`
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp@latest"
      ],
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
  "enabledMcpjsonServers": [
    "chrome-devtools"
  ]
}
```

---

## Common Issues

### Issue: "No MCP tools available"
- **Cause**: MCP server not approved or Claude Code not restarted
- **Fix**: Run `claude mcp reset-project-choices` and restart Claude Code

### Issue: "chrome-devtools-mcp not found"
- **Cause**: npx can't find the package
- **Fix**: Run `npx -y chrome-devtools-mcp@latest --version` to install

### Issue: "Chrome not found"
- **Cause**: CHROME_EXECUTABLE_PATH incorrect
- **Fix**: Update path in `.mcp.json` to match your Chrome installation

---

## Quick Start Commands

```bash
# Full verification script
echo "=== Checking MCP Configuration ==="
echo "1. Chrome DevTools MCP version:"
npx chrome-devtools-mcp@latest --version

echo -e "\n2. Chrome executable:"
test -f "/c/Program Files/Google/Chrome/Application/chrome.exe" && echo "✓ Found" || echo "✗ Missing"

echo -e "\n3. .mcp.json exists:"
test -f ".mcp.json" && echo "✓ Found" || echo "✗ Missing"

echo -e "\n4. Reset project approvals and restart Claude Code:"
claude mcp reset-project-choices
```

---

## What Worked Last Time

Yesterday we fixed this by:
1. Moved MCP config to `.mcp.json` in project root (not `.claude/mcp.json`)
2. Set `CHROME_EXECUTABLE_PATH` to `C:/Program Files/Google/Chrome/Application/chrome.exe`
3. Added permissions to `.claude/settings.local.json`
4. Restarted Claude Code and approved the MCP server

The key insight: **Project-scoped MCP servers in `.mcp.json` require user approval on startup**.
