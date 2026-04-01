# PubZub — Academic Publication Pipeline

A Kanban-style publication pipeline manager for academics. Track papers from Idea through Draft, Submitted, Revise & Resubmit, Resubmitted, Accepted, to Published.

## Features

- **Drag-and-drop pipeline** with 7 stages
- **Team collaboration** — invite members, set visibility per role, team analytics
- **Publication sharing** — invite collaborators with viewer/editor roles
- **Claude Code integration** — MCP server with 6 tools for AI-assisted pipeline management
- **Import/Export** — BibTeX import/export, PDF export, Excel export
- **REST API & GitHub webhook** — automate your pipeline from external tools
- **Offline support** with sync queue
- **Light/dark mode** with customizable color palettes

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Deployment:** Vercel (frontend), Supabase (backend)

## Local Development

```sh
# Clone the repo
git clone https://github.com/johanfourieza/EconTools.git
cd EconTools/pubzub

# Install dependencies
npm install

# Copy environment template and fill in your Supabase credentials
cp .env.example .env

# Start the dev server
npm run dev
```

The app runs at `http://localhost:8080`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon/public key |

## Deployment

The frontend is deployed on Vercel with the root directory set to `pubzub`. The Supabase backend (database, auth, edge functions) runs on Supabase's managed infrastructure.

## Claude Code (MCP) Integration

PubZub includes an MCP server that lets Claude Code interact with your pipeline. See Profile Settings > MCP Server in the app for setup instructions.

## License

Free to use. No monetization planned.
