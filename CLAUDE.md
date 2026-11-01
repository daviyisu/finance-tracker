# CLAUDE.md

## Language

All repository-facing text must be written in **English**, regardless of the language used in the conversation:

- Commit messages
- Pull request titles and descriptions
- PR/issue comments and review replies
- Code comments and documentation
- Branch names

## Project

Ionic 9 + Angular 22 app (standalone components) with Capacitor, configured as a PWA.

- `npm start` — dev server (`ng serve`; the service worker is disabled in dev mode)
- `npm run build` — production build to `www/`
- `npm run lint` — ESLint
- `npm test` — unit tests (Vitest)

### PWA

- Service worker: `@angular/service-worker`, registered in `src/main.ts`, configured in `ngsw-config.json`.
- Manifest and icons live in `public/` (copied to the build root via `angular.json` assets).
