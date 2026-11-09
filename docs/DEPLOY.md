# Hosting SpendMate

One service runs everything: the Node server answers `/api/*` and the live connection, and also delivers the built
app. One address means the sign-in cookie (which is strict about sites) and WebSockets work with no extra settings.

Stack to host: **Render** (the app) + **MongoDB Atlas** (the database, which you already use).

## Before you start

1. **Rotate your Atlas database password.** It was pasted into a chat earlier. In Atlas: Database Access, edit the
   user, set a new password, then update `server/.env` locally with the new connection string.
2. **Use a separate database for the live app.** Put a different name in the connection string path, for example
   `...mongodb.net/spendmate_prod?...`. Test accounts from development stay out of it, and Secret Pins made locally
   will not need to match the live secret.
3. **Commit and push** your latest work (`git add -A`, `git commit`, `git push`). `.env` and `dist` are git-ignored,
   so no secrets are uploaded.

## Deploy on Render

1. Sign in at render.com with GitHub. Choose **New > Blueprint**, pick the `spend-mate` repository. Render reads
   `render.yaml` and proposes one web service called `spendmate`.
2. It asks for two values:
   - `MONGODB_URI`: your Atlas connection string (with the new password and the `spendmate_prod` name).
   - `CLIENT_ORIGIN`: the address the service will get, like `https://spendmate.onrender.com`. If you do not know it
     yet, put your best guess, finish the first deploy, then correct it under **Environment** and redeploy.
3. Click **Apply**. The first build takes a few minutes. When the status says **Live**, open the address.
4. `JWT_ACCESS_SECRET` and `PIN_PEPPER` are generated for you. Open **Environment**, copy `PIN_PEPPER` into a
   password manager **now**. If it is lost, nobody can sign in again.

## Let Render reach Atlas

In Atlas: **Network Access > Add IP Address > Allow access from anywhere** (`0.0.0.0/0`). Render's addresses change,
so a fixed list does not work on the free setup. The database password and the encrypted connection still protect it.

## Check it works

- Open the address on your phone, create an account, add a spending.
- Open it on a second device, link the accounts, and watch an entry appear on the other phone without refreshing.
- Visit `https://YOUR-ADDRESS/api/health`: it should say `{"ok":true}`.

## Good to know

- **Free plan sleeps.** After about 15 idle minutes the service stops, and the next visit waits roughly a minute while
  it wakes. Live connections drop and reconnect by themselves. For daily family use, switch the plan to **Starter**
  (a few dollars a month) in the dashboard, or edit `plan:` in `render.yaml`.
- **Updates:** every `git push` to `main` rebuilds and redeploys automatically.
- **Do not run two copies.** Live updates keep their connection list in one server's memory. If you ever scale to
  several copies, add a shared message channel such as Redis first.
- **Secrets live only in Render's Environment page.** Never commit `.env`.
- **Your own domain** (optional): Render > Settings > Custom Domains. Then change `CLIENT_ORIGIN` to match.
- **Backups:** Atlas free clusters have no automatic backups. Export now and then, or move to a paid tier once the
  data matters.
- **Logs:** Render > Logs. A start-up message like `Invalid environment` means a variable is missing or too short.
