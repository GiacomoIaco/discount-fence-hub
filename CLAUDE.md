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
