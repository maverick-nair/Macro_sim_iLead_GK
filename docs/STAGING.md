# Staging

Two ways to stage. **Vercel** hosts the app alone, on its in browser mock engine: fastest, nothing to run, and enough for people to judge the screens and the flow. **Fly.io** hosts the real server too. Pick Vercel for a design and flow playtest, Fly for anything that needs sign in links, saved progress, the group report across people, or report PDFs.

## Vercel: the app on its mock engine

`vercel.json` builds the app with `npx vite build` (no server addresses set, so the app uses its in browser mock engine and GenieKreator drafts from templates), serves `dist/`, falls back to `index.html` on every route and caches hashed assets for a year.

1. Sign in at vercel.com, choose **Add New, Project**, import the GitHub repository and pick the branch to stage (for example `eco-integration`). Leave the framework as **Other**: `vercel.json` sets the commands. Or from a terminal: `npx vercel` in the repository root, then `npx vercel --prod`.
2. Every push to that branch redeploys it; Vercel gives each push its own preview address as well.
3. Open the address. The participant app is at `/`, the group report at `/group` and GenieKreator at `/author`.

What this staging cannot do, because there is no server behind it:

- **No sign in links, no roles.** Anyone with the address gets in as the demo participant.
- **Progress stays in the browser** it was played in: a tester cannot resume on another device, and the group report shows only demo data, not your testers.
- **No report PDFs or email, no model.** The mock engine and mock voice run in the browser.
- Vercel runs short lived functions, not a long running process, so the real server (live connections for the conversations, an in memory engine cache, a Chromium for PDFs, a database file) does not run there. Put the server on Fly.io below, or on any container host, and keep Vercel for the app only if you wish.

## Fly.io: the real server

A staging copy of the participant app, the group report and GenieKreator, on Fly.io, for real people to play and author on before any client sees it. It runs the real server on its mock models, so it costs nothing per playtest and needs no model key. `fly.toml` is the config; the image is the repository's `Dockerfile` (docs/SERVER.md section 9).

## One time setup

You need a Fly.io account and `flyctl` signed in (`fly auth login`). Run these from the repository root. Each secret is generated on your machine and goes straight into Fly's secret store: it is never written to a file or to the repository.

```bash
# 1. The app and its volume (pick your own name; keep it the same in fly.toml's `app` and PUBLIC_URL)
fly apps create ilead-staging
fly volumes create ilead_data --app ilead-staging --region bom --size 1

# 2. Secrets: the launch secret signs sign in links, the admin token is for operators
fly secrets set --app ilead-staging \
  LAUNCH_SECRET="$(openssl rand -base64 48 | tr -d '\n')" \
  ADMIN_TOKEN="$(openssl rand -base64 48 | tr -d '\n')"

# 3. Deploy (builds the image on Fly's builders; the first build takes several minutes)
fly deploy --app ilead-staging
```

Check it: `curl https://ilead-staging.fly.dev/readyz` answers `{"status":"ok", ...}` with `"ai":"mock"`.

## Letting people in

Sign in is by a signed link, as an LMS or GenieKreator would send it (docs/SERVER.md "Launch links"). Minting one needs the launch secret, which Fly will not show you again. To mint links on your machine, set your own secret first and keep it in your password manager:

```bash
export LAUNCH_SECRET="<the value you set above>"
export PUBLIC_URL=https://ilead-staging.fly.dev

# A participant (links last 15 minutes by default; --ttl 86400 gives a day)
npm run server:mint -- --sub tester-01 --name "Asha Rao" --cohort playtest --ttl 86400

# A person who builds simulations in GenieKreator
npm run server:mint -- --sub author-01 --name "Meera Nair" --roles author --ttl 86400

# A facilitator who reads the group report
npm run server:mint -- --sub lead-01 --roles cohort_admin --cohorts playtest --ttl 86400
```

Each command prints a link. Send each person their own, since a link signs in as that person and keeps their progress.

## Updating and watching

- Redeploy after a merge: `fly deploy --app ilead-staging`.
- Logs: `fly logs --app ilead-staging` (JSON lines, no participant text).
- Status: `fly status --app ilead-staging`.
- Backup the database: `fly ssh sftp get /data/ilead.sqlite --app ilead-staging`.
- Reset everything: `fly volumes destroy` then `fly volumes create` the volume again, and redeploy.

## What staging does not cover

- **No model.** Conversations and the author chat use the mocks, so they show the flow and the screens, not the quality of real conversations. To test with a model, set `ANTHROPIC_API_KEY` yourself: `fly secrets set ANTHROPIC_API_KEY=... --app ilead-staging`, and remove `AI_PROVIDER = "mock"` from `fly.toml`. Each playtest then costs model calls.
- **No email.** The report email is off until `SMTP_URL` and `EMAIL_FROM` are set.
- **No LMS.** SCORM packages and the LMS launch are tested by the checks and by importing an exported package into a real LMS, not by this copy.
- **One machine.** SQLite on one volume carries a pilot. More than one machine needs Postgres (`DATABASE_URL`, docs/SERVER.md).
- The container image has not been built in the build environment used so far (no Docker there). The first `fly deploy` is its first real build, so expect to fix a snag if one shows up.
