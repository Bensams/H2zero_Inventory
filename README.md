# Inventory System

PHP REST-style API (`index.php` + `Backend/`) and a static browser UI under `Frontend/`. This guide explains how to run the API and MySQL on [Railway](https://railway.app/) and the UI on [Vercel](https://vercel.com/).

---

## What you are deploying

| Part | Platform | Role |
|------|----------|------|
| Static HTML/CSS/JS in `Frontend/` | **Vercel** | Login and admin/staff pages |
| `index.php` and `Backend/` | **Railway** (Docker) | API and PHP sessions |
| MySQL | **Railway** (MySQL plugin) | Data store |

The UI calls the API with `fetch(..., credentials: "include")`, so the API must allow your Vercel origin (CORS) and use cross-site–safe session cookies over HTTPS.

---

## Prerequisites

- A Git repository hosting this project (GitHub, GitLab, or Bitbucket) connected to both Railway and Vercel.
- Your database created and tables loaded. Use **`schema.sql`** at the repo root (import via phpMyAdmin, MySQL client, or Railway’s query UI). On Railway, if MySQL already provides a database name, omit the `CREATE DATABASE` / `USE` lines in `schema.sql` and run the rest against that database.
- After the API is live, you will set **one** full API URL on Vercel, for example:  
  `https://your-api-service.up.railway.app/index.php`  
  (always include `/index.php` unless you add your own URL rewriting.)

---

## Part 1 — Railway (MySQL)

1. **Create a Railway project**  
   Open [Railway Dashboard](https://railway.app/dashboard) and create a new project.

2. **Add MySQL**  
   - In the project, click **New** → **Database** → **MySQL** (or add the MySQL template).  
   - Wait until the database is provisioned.

3. **Create the database and tables**  
   - Open the MySQL service → use **Connect** / **Data** / **Query** (or connect with a local MySQL client using the public connection details Railway shows).  
   - Paste and run the contents of **`schema.sql`**. If Railway already created an empty schema, skip the `CREATE DATABASE` / `USE h2zero_inventory` lines and execute from the `SET FOREIGN_KEY_CHECKS` / `DROP TABLE` section onward (or only the `CREATE TABLE` block on a truly empty database).

4. **Note the MySQL variables**  
   When the web service is **linked** to this database (next section), Railway injects variables such as:

   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLDATABASE`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`

   The PHP app reads these automatically in `Backend/config/database.php`. You can instead set `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, and `DB_PORT` if you prefer.

---

## Part 2 — Railway (PHP API)

1. **Add a new service from this repository**  
   - **New** → **GitHub Repo** (or your Git provider) → select this repo.  
   - Railway should detect the **`Dockerfile`** at the repo root.

2. **Set the service to use Docker**  
   - In the service **Settings**, ensure the deployment uses **Dockerfile** build (not Nixpacks only, if both appear).  
   - Root directory should be the repository root (where `Dockerfile` and `index.php` live).

3. **Link MySQL to the web service**  
   - Open the **PHP/web** service → **Variables**.  
   - Use **Add Variable** → **Reference** (or “Variable from another service”) and pull in the MySQL connection variables so `MYSQLHOST`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`, and `MYSQLPORT` exist on the **web** service.  
   - Railway’s UI wording may vary; the goal is: the running container must have the same MySQL env vars the app expects (see `.env.example`).

4. **Configure CORS and optional flags**  
   On the **same** web service, add:

   | Variable | Example | Purpose |
   |----------|---------|---------|
   | `CORS_ALLOWED_ORIGINS` | `https://your-app.vercel.app,http://localhost:5500` | Comma-separated list of **exact** browser origins allowed to call the API. |
   | `ALLOW_VERCEL_PREVIEWS` | `1` | Optional. Allows any `https://*.vercel.app` origin (useful for Vercel preview URLs). |
   | `SESSION_SAMESITE_NONE` | `1` | Optional. Force `SameSite=None` session cookies if HTTPS detection is wrong behind a proxy. |

   **Important:** With `credentials: "include"`, you cannot use `*` for CORS. Each production frontend URL (and any local dev origin you use) should be listed in `CORS_ALLOWED_ORIGINS`, unless you enable `ALLOW_VERCEL_PREVIEWS=1` for Vercel previews.

5. **Deploy and copy the public URL**  
   - Trigger a deploy; wait until it succeeds.  
   - Open **Settings** → **Networking** (or **Public URL**) and generate or copy the public URL, e.g. `https://your-api-service.up.railway.app`.  
   - Your API base URL for the frontend will be:  
     **`https://your-api-service.up.railway.app/index.php`**

6. **Smoke-test the API**  
   In a browser or with curl (replace the URL):

   ```text
   https://your-api-service.up.railway.app/index.php?route=auth&action=me
   ```

   You should get JSON (likely unauthorized until logged in), not a 404 from the wrong path.

---

## Part 3 — Vercel (Frontend)

1. **Import the project**  
   - Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New** → **Project**.  
   - Import the **same** Git repository.

2. **Project root and build**  
   - Leave the **root directory** at the repository root so Vercel picks up `vercel.json`.  
   - `vercel.json` is already configured with:  
     - `buildCommand`: `npm run vercel-build`  
     - `outputDirectory`: `Frontend`  
     - A redirect from `/` to `/pages/index.html`

3. **Set the build-time API URL**  
   In **Settings** → **Environment Variables**, add:

   | Name | Value | Environment |
   |------|--------|-------------|
   | `API_BASE_URL` | `https://your-api-service.up.railway.app/index.php` | Production (and Preview if you want previews to hit the same API) |

   The script `scripts/vercel-build.js` replaces the first line of `Frontend/assets/js/config.js` during build. If `API_BASE_URL` is missing, the build keeps the default localhost URL and production will not work until you set it.

4. **Deploy**  
   Deploy the project. After deploy, open the Vercel URL, log in, and confirm API calls succeed (check **Network** in browser devtools).

5. **Align CORS with your Vercel domain**  
   - Production: add your canonical Vercel URL to Railway `CORS_ALLOWED_ORIGINS`, e.g. `https://inventory-system.vercel.app`.  
   - Previews: either add each preview origin, or set `ALLOW_VERCEL_PREVIEWS=1` on Railway (only if you accept any `https://*.vercel.app` calling your API).

---

## Checklist (quick reference)

- [ ] MySQL on Railway has the correct schema and data.
- [ ] Web service has `MYSQL*` (or `DB_*`) variables from the database.
- [ ] Web service has `CORS_ALLOWED_ORIGINS` including your Vercel production URL (and local dev if needed).
- [ ] Vercel has `API_BASE_URL` = `https://<railway-host>/index.php`.
- [ ] Railway public URL is HTTPS; session cookies use `Secure` + `SameSite=None` when HTTPS is detected (see `Backend/config/bootstrap.php`).

---

## Local development (XAMPP)

- Place the project under your web root (e.g. `htdocs/inventory-system`).
- With no `MYSQL*` / `DB_*` env vars, `Backend/config/database.php` defaults to localhost MySQL/XAMPP-style settings.
- Keep `Frontend/assets/js/config.js` pointing at your local API, e.g.  
  `http://localhost/inventory-system/index.php`  
- Local CORS defaults include `http://localhost` and common Live Server ports; override with `CORS_ALLOWED_ORIGINS` if you use another origin.

---

## Troubleshooting

| Symptom | What to check |
|---------|----------------|
| Browser CORS errors | `CORS_ALLOWED_ORIGINS` on Railway includes the **exact** origin (scheme + host + port). For Vercel previews, use `ALLOW_VERCEL_PREVIEWS=1` or list the preview URL. |
| Login succeeds then “Unauthorized” on next request | Session cookie not sent cross-site: ensure API is HTTPS, and see `Backend/config/bootstrap.php`. Try `SESSION_SAMESITE_NONE=1` on Railway if behind a proxy. |
| Vercel UI still calls `localhost` | Redeploy after setting `API_BASE_URL`; confirm build logs show `vercel-build: API_BASE_URL set for deployment`. |
| Database connection errors on Railway | Verify MySQL variables on the **web** service; check DB name, user, password, and that MySQL allows connections from the web service (Railway private networking / credentials). |
| 404 on API | Use `/index.php` in `API_BASE_URL`; confirm Railway service is public and the path matches your deployment root. |
| `schema.sql` “does nothing” or errors in DBeaver | Use **Execute SQL Script** (toolbar: execute script / often **Alt+X**), not **Ctrl+Enter** (that runs only the single statement at the cursor). Connect as a user allowed to run `CREATE DATABASE` (e.g. `root` on XAMPP) or omit `CREATE DATABASE` / `USE` and run against an existing database. |

---

## Default administrator (auto-seed)

On the **first** HTTP request to the API (after the database is reachable), if there is **no** user with `role = 'admin'`, the app inserts:

- **Email:** `admin@gmail.com`  
- **Password:** `admin123` (bcrypt)  
- **Full name:** `Administrator`  
- **Role:** `admin`  

Set **`DISABLE_AUTO_ADMIN=1`** on the server to turn this off (recommended once you rely on your own admin only).

---

## Account registration (API)

Passwords are stored as **bcrypt** (`PASSWORD_BCRYPT`, cost 12) via `Backend/helpers/password.php`.

| Action | URL | Auth | When |
|--------|-----|------|------|
| **Bootstrap admin** | `POST index.php?route=auth&action=bootstrap` | None | Only while **`users` has zero rows**. Body: JSON `full_name`, `username` (Gmail) or `email`, `password` (min 6 chars); optional `age`, `gender`. Creates **admin**. |
| **Public staff signup** | `POST index.php?route=auth&action=signup` | None | Requires **`ALLOW_PUBLIC_STAFF_SIGNUP=1`** on the API service. Same fields as bootstrap; creates **staff**. |
| **Admin creates staff** | `POST index.php?route=auth&action=register` | Admin session | Existing flow; bcrypt hashed. |

Generate a hash from the CLI: `php hash.php` (edit `$plain` in `hash.php` first).

---

## Reference files

- `schema.sql` — MySQL DDL for all application tables (fresh install).
- `.env.example` — Variable names for Railway and Vercel.
- `Dockerfile` — PHP 8.2 CLI + `pdo_mysql`, listens on `$PORT`.
- `vercel.json` — Static output from `Frontend/` and build hook.
- `Backend/config/database.php`, `cors.php`, `bootstrap.php` — Environment-driven DB, CORS, and session behavior.

For platform-specific help, see [Railway Documentation](https://docs.railway.app/) and [Vercel Documentation](https://vercel.com/docs).
