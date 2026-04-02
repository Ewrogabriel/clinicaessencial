# Getting Started

> A quick guide for new contributors to set up and run Clínica Essencial locally.

## Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Node.js | 18.x |
| npm | 9.x |
| Git | 2.x |

## 1. Clone the repository

```bash
git clone https://github.com/Ewrogabriel/clinicaessencial.git
cd clinicaessencial
```

## 2. Install dependencies

```bash
npm install
```

## 3. Configure environment

Copy the example environment file and fill in your Supabase credentials:

```bash
cp .env.example .env.local
```

Required variables:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

> **Never commit `.env.local`** – it is listed in `.gitignore`.

## 4. Start the development server

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

## 5. Run tests

```bash
npm test                   # run all tests once
npm run test:watch         # watch mode
npm run test:coverage      # with coverage report
```

Coverage thresholds: **lines ≥ 75 %, functions ≥ 80 %, branches ≥ 70 %**.

## 6. Lint

```bash
npm run lint
```

## 7. Build for production

```bash
npm run build
```

Output goes to `dist/`.

## 8. Project structure at a glance

```
src/
├── App.tsx          # All routes
├── pages/           # One file per route
├── components/      # Shared components
├── modules/         # Domain modules
├── integrations/    # Supabase client + generated types
├── lib/             # Utility functions
└── test/            # Test setup and suites
```

See [ARCHITECTURE_UPDATED.md](./ARCHITECTURE_UPDATED.md) for the full picture.

## 9. First contribution checklist

- [ ] Read [CODE_STYLE_GUIDE.md](./CODE_STYLE_GUIDE.md)
- [ ] Read [TESTING_GUIDE.md](./TESTING_GUIDE.md)
- [ ] Check existing tests pass with `npm test`
- [ ] Create a feature branch: `git checkout -b feat/my-feature`
- [ ] Write or update tests for your changes
- [ ] Ensure lint passes: `npm run lint`
- [ ] Open a pull request and reference the related issue

## 10. Useful commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm test` | Run all tests |
| `npm run test:coverage` | Test + coverage report |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `node scripts/codemods/migrate-imports.js --dry-run` | Preview import migrations |
| `bash scripts/migrate.sh --dry-run` | Preview all codemods |
