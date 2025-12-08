# Project Standards for Claude Code

## Deployment

- **Git pushes to `main` trigger automatic Netlify deployments**
- After committing changes, push to `origin/main` to deploy
- Netlify URL: https://discount-fence-hub.netlify.app/

## Database

- Using Supabase for backend database
- Run migrations with: `npm run migrate:apply:<migration_name>`

## Development

- React + TypeScript + Vite
- TanStack Query (React Query) for data fetching
- Tailwind CSS for styling

## Testing Changes

- After pushing, verify changes on the live Netlify URL
- Use Chrome DevTools MCP for automated browser testing when needed

## Roadmap Discipline

The project uses a database-backed roadmap system with hub-prefixed codes:
- **O-XXX**: Ops Hub (Calculator, Yard)
- **R-XXX**: Requests
- **C-XXX**: Chat/Communication
- **A-XXX**: Analytics
- **S-XXX**: Settings/Admin
- **G-XXX**: General/App-wide
- **L-XXX**: Leadership Hub

### Session Workflow

1. **Start of Session**: Ask if there are specific roadmap items to tackle (e.g., "Let's work on O-012")
2. **During Work**:
   - Reference codes in commit messages: `feat: yard improvements (O-012)`
   - After completing significant work, update item status to 'done'
   - If new ideas emerge, offer to add them to the roadmap
3. **End of Session**: Quick sync - summarize completed items, add new ideas

### Reading/Updating Roadmap

Query the `roadmap_items` table to read items:
```sql
SELECT code, title, status, raw_idea, claude_analysis
FROM roadmap_items
WHERE code = 'O-012';
```

Update status or add analysis:
```sql
UPDATE roadmap_items
SET status = 'done', session_notes = 'Implemented in session Dec 7'
WHERE code = 'O-012';
```

### Expanding Ideas

When user asks to expand on an idea (e.g., "expand on S-001"):
1. Read the raw_idea field
2. Research best practices
3. Update claude_analysis with detailed thoughts
4. Consider related items and link them
