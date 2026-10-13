# Staging

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
