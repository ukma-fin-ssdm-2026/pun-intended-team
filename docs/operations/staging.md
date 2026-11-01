# Staging

Staging runs `main` on one Linux server: the API at `https://api.nearbystaging.app` and the web app at `https://nearbystaging.app` ([ADR-005](../architecture/decisions/ADR-005.md)). After every green build of `main`, CI publishes two images to GHCR, `ghcr.io/ukma-fin-ssdm-2026/nearby-api` and `ghcr.io/ukma-fin-ssdm-2026/nearby-web`, each tagged with the commit and with `main`, and the **Deploy staging** job deploys them over SSH. The server builds nothing: it pulls the image and runs everything in Docker Compose ([`docker-compose.staging.yml`](../../docker-compose.staging.yml)). Besides Docker it only has the checkout, its `.env`, the keys and the backups.

| Service | Runs | Reachable from |
|---|---|---|
| `caddy` | Reverse proxy for both domains: TLS with a Let's Encrypt certificate for each that it renews itself, HTTP → HTTPS ([`deploy/Caddyfile`](../../deploy/Caddyfile)) | The internet, ports 80 and 443 |
| `api` | The API, `NODE_ENV=production`, as the `nearby_main` role | `caddy` only |
| `web` | The web app: the static export of `app/`, served by its own Caddy ([`app/Caddyfile`](../../app/Caddyfile)) | `caddy` only |
| `db` | PostgreSQL 18, data in the `nearby-staging-db` volume | The server itself (`127.0.0.1:5432`) |
| `migrate` | Before every API start, from the same image: `prisma migrate deploy` as the owner, then the passwords of `nearby_main` and `nearby_import`; then exits | — |
| `backup` | Nightly `pg_dump` at 01:00 UTC, 7 daily and 4 weekly copies ([`deploy/backup-db.sh`](../../deploy/backup-db.sh)) | — |
| `import` | One event import run, started by hand | — |

## Settings and secrets

The server's `.env` is rendered on every deploy from [`deploy/staging.env`](../../deploy/staging.env): the template holds the staging values, and its `${…}` placeholders are filled from the GitHub environment **`staging`** (Settings → Environments). Change a value there, not on the server: the next deploy overwrites the file.

| In the `staging` environment | Kind | Value |
|---|---|---|
| `SSH_HOST`, `SSH_USER` | variable | The server's IP and the `deploy` user |
| `SSH_KNOWN_HOSTS` | variable | The server's host key: `ssh-keyscan <SSH_HOST>` |
| `SSH_KEY` | secret | The private half of the deploy key |
| `POSTGRES_PASSWORD`, `NEARBY_MAIN_PASSWORD`, `NEARBY_IMPORT_PASSWORD` | secret | Each from `openssl rand -hex 24` |
| `GOOGLE_CLIENT_IDS` | variable | As in the local `.env` |
| `TURBOSMS_SENDER` | variable | Optional |
| `TELEGRAM_GATEWAY_TOKEN`, `TURBOSMS_TOKEN` | secret | Optional; codes are switched off ([ADR-004](../architecture/decisions/ADR-004.md)) |

The `staging` environment only releases its secrets to jobs running from `main`: under Deployment branches and tags it allows the branch `main` alone, and administrators cannot bypass that. Create it this way before the first deploy; a job that names a missing environment creates it without any rules.

The repository variable `STAGING_DEPLOY` (Settings → Variables) switches the deploys on with `true`. The repository variable `EXPO_PUBLIC_GOOGLE_CLIENT_ID` holds the id of the Google web client, which the publish job builds into the web app; without it the job fails. The key files are not in GitHub: they are created on the server.

The jobs run on the course's self-hosted runners, like the rest of CI: their administrators can see the secrets of the jobs, and the deploy needs outbound SSH (port 22) from them. The publish job removes its images from the runner after pushing them.

The image is private. The server keeps no registry credentials: every deploy job passes its own token, valid only while the job runs, and the script logs out of `ghcr.io` when it ends.

## First setup

1. An x86 server (CI builds the image for `linux/amd64` only; on Hetzner a CX or CPX, not an ARM CAX) with Ubuntu, a fixed public IP and a firewall that opens only ports 22, 80 and 443.
2. At name.com, `A` records from `nearbystaging.app` and `api.nearbystaging.app` to the server's IP. Caddy can only get a certificate once a name resolves: `dig +short nearbystaging.app api.nearbystaging.app`.
3. On the server, Docker, a `deploy` user for CI and the checkout:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo useradd --create-home --groups docker deploy
   sudo git clone https://github.com/ukma-fin-ssdm-2026/pun-intended-team.git /opt/nearby
   sudo mkdir -p /var/backups/nearby
   sudo chown -R deploy:deploy /opt/nearby /var/backups/nearby
   ```
   Membership of the `docker` group is as good as root, so the deploy key below is as powerful as the root password.
4. A deploy key on your machine: `ssh-keygen -t ed25519 -N '' -C nearby-staging-deploy -f deploy-key`. Append `deploy-key.pub` to `/home/deploy/.ssh/authorized_keys` on the server; put `deploy-key` in the `SSH_KEY` secret and in the team vault, then delete the local copy.
5. In the Google Cloud console, add `https://nearbystaging.app` to the authorized JavaScript origins of the web client.
6. Fill in the `staging` environment (table above) and the repository variable `EXPO_PUBLIC_GOOGLE_CLIENT_ID`, and set `STAGING_DEPLOY` to `true`. Re-run the latest CI run on `main`, or merge anything: the Deploy staging job deploys it.
7. Save `keys/contact-hmac.key` and `keys/data-encryption.key` from `/opt/nearby/keys/` (readable with `sudo`) in the team vault. The database backups cannot be read without them, and they cannot be created again.

### Making an account admin

Register through the app, then on the server:

```bash
cd /opt/nearby && docker compose -f docker-compose.staging.yml exec db psql -U nearby -d nearby
```

```sql
SELECT id, created_at FROM accounts ORDER BY created_at DESC LIMIT 5;
UPDATE accounts SET role = 'admin' WHERE id = '<account id>';
```

## Deploying and rolling back

Every green merge to `main` deploys itself: **Publish images**, then **Deploy staging**. [`deploy/deploy-staging.sh`](../../deploy/deploy-staging.sh) checks out that commit, so the compose file and scripts always match the images, pulls the images, backs up the database to `/var/backups/nearby/manual/` and restarts the services; `migrate` runs before the API starts. Only commits on `main` are accepted. If the API is not healthy within 2 minutes, or the web app is not, the script goes back to the commit and image that ran before, and the job fails. Each deploy and rollback is a line in `/opt/nearby/deploy.log`.

To deploy an earlier commit, run Actions → **Deploy staging** → **Run workflow** on `main` with its full SHA; leave it empty for the latest `main`. The run shows who deployed what.

If GitHub Actions is down, deploy on the server as `deploy`, logged in with your own token (`read:packages`):

```bash
docker login ghcr.io -u <your GitHub user>
/opt/nearby/deploy/deploy-staging.sh <commit>
docker logout ghcr.io
```

A rollback does not undo migrations, so it only works while the older code still fits the database. A deploy that changes the `db` service in the compose file restarts the database for a few seconds. Deploy only through the script. A `docker compose` command that starts a container by hand needs the deployed image: prefix it with `API_VERSION=$(git rev-parse HEAD)`, since the checkout always matches the running version.

## A migration failed

Migrations run before anything is replaced, so the version that was running keeps serving. The job fails with `Error: P3018` and `Migration name: …` in its log, and every deploy stops at the same point until the migration is resolved. On the server, in `/opt/nearby`:

1. Undo what the migration changed before it failed: compare its `migration.sql` with the database (`docker compose -f docker-compose.staging.yml exec db psql -U nearby -d nearby`). Prisma does not run a migration in a transaction, so the statements before the failing one stay applied.
2. Mark it as rolled back:
   ```bash
   API_VERSION=$(git rev-parse HEAD) docker compose -f docker-compose.staging.yml run --rm migrate \
     node_modules/.bin/prisma migrate resolve --rolled-back <migration name>
   ```
3. Fix the migration in a new commit on `main`; its deploy applies it again.

## Logs

```bash
cd /opt/nearby
docker compose -f docker-compose.staging.yml logs -f api      # or web, caddy, migrate, backup
docker compose -f docker-compose.staging.yml ps               # state and health of every service
cat deploy.log                                                # what was deployed and when
```

Each container keeps at most 3 log files of 10 MB; older lines are dropped. After a successful deploy, the script removes the images no container uses that were built more than a week ago; a rollback to one of them pulls it again.

## Backups and restore

Backups are in `/var/backups/nearby/`: `daily/`, `weekly/` and `manual/` (before each deploy, last 5). A restore replaces the current data:

```bash
docker compose -f docker-compose.staging.yml stop api
docker compose -f docker-compose.staging.yml exec backup pg_restore --clean --if-exists -d nearby /backups/daily/<file>.dump
docker compose -f docker-compose.staging.yml start api
```

`docker compose down -v` does not delete the data: both volumes are external. Only `docker volume rm nearby-staging-db` does.

## Event import

```bash
API_VERSION=$(git rev-parse HEAD) docker compose -f docker-compose.staging.yml run --rm import
```

## Connecting clients

- App: `EXPO_PUBLIC_API_URL=https://api.nearbystaging.app`.
- MCP server: `API_BASE_URL=https://api.nearbystaging.app node tools/mcp-start.mjs`.
- Web app: built for staging by CI, at `https://nearbystaging.app`. Its origin is the only entry of `CORS_ORIGINS` in [`deploy/staging.env`](../../deploy/staging.env); another web client needs its origin there and in the authorized JavaScript origins of the Google web client.

## AI Usage Note

Drafted with Claude Code; the steps were checked by running the staging stack locally. Reviewed by: Viktoriia Baran.
