# Aura Studio Preview

Aura Studio is a concept application that helps multi-disciplinary engineers craft an adaptive personal presence. This repository contains a lightweight static prototype demonstrating the onboarding journey, marketing site, and admin workspace concepts without external dependencies.

## What's included

- **Marketing homepage** that introduces Aura Studio's positioning, feature highlights, and calls to action.
- **Onboarding flow** featuring CV upload support, AI-inspired analysis that extracts highlights/skills, guided questions, and automatic workspace population with categories, entries, and homepage layout suggestions.
- **Admin dashboard** backed by JSON APIs for managing categories, entries, homepage layout, and the contact inbox with inline CRUD interactions (pre-seeded with the onboarding output).
- **Profile editor** tab that stores headline, bio, focus areas, skills, and link metadata used to power the public site.
- **Personal site preview** at `/site.html` that renders the generated portfolio, featured items, category pages, and contact links directly from the stored data.
- **Vanilla design system** inspired by shadcn/tweakcn aesthetics using modern CSS and Google fonts.
- **Zero-dependency Node server** (`server.js`) to serve the static prototype locally or in deployment environments without package installs.

## Getting started

1. Ensure Node.js 18+ is available.
2. Install dependencies: _none required_.
3. Start the local preview server:

   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to explore the homepage. The onboarding, dashboard, and public site demos are available at `/onboarding.html`, `/dashboard.html`, and `/site.html` respectively.

To change the default port, set the `PORT` environment variable before running the command.

## Local data & API endpoints

- All persistent data lives in `data/state.json`. Updating the site through the onboarding flow, admin dashboard, or contact form writes back to this file.
- The Node server exposes JSON endpoints under `/api` for profile, categories, entries, homepage layout, messages, and the new `/api/onboarding` blueprint generator that orchestrates CV analysis plus initial content seeding.
- A combined `/api/site` endpoint provides the aggregated payload for the personal site preview page.
- To reset the prototype data, stop the server, delete `data/state.json`, and restart; a fresh file will be generated automatically.

## Project structure

```
public/
  assets/
    app.js           // shared UI helpers
    onboarding.js    // onboarding stepper logic
    dashboard.js     // admin tab interactions and API calls
    styles.css       // global styling inspired by shadcn aesthetics
  index.html         // marketing landing page
  onboarding.html    // onboarding wizard demo
  dashboard.html     // admin workspace demo
  404.html           // fallback page
server.js            // zero-dependency static server
README.md            // documentation
```

## Deployment notes

- The prototype is self-contained and deployable on any static hosting solution. When hosting without Node, serve the contents of the `public` folder directly.
- For environments that require a runtime (e.g., Render, Fly.io, Railway), run `node server.js`. No build step is required.
- Because the app avoids external packages, `npm install` succeeds by design and the preview can be hosted without registry access.
- A ready-to-use Render configuration (`render.yaml`) and GitHub Actions workflow (`.github/workflows/deploy.yml`) are included. After creating a free Render Web Service with this repository, add the `RENDER_SERVICE_ID` and `RENDER_API_KEY` secrets in GitHub to enable one-click deployments from the workflow. Render is preferred over Vercel for this prototype because the JSON data store requires a writable filesystem.

## Roadmap considerations

- Replace mock data with real persistence and APIs.
- Integrate true AI-powered CV parsing and insight generation.
- Expand the design system with configurable themes and layout presets.
- Add authentication, role management, and content CRUD endpoints.
