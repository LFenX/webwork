# lgplayblog MCP Server

An MCP (Model Context Protocol) server that exposes the **article module** of your
lgplayblog Next.js app to [Hermes Agent](https://github.com/) so Hermes can read /
write your articles directly.

It talks to PostgreSQL via Prisma (reusing the project's generated client at
`app/generated/prisma`), and runs as a stdio subprocess of Hermes — exactly as the
Hermes MCP spec describes.

---

## What it exposes

After Hermes connects, the following tools become available (prefixed `mcp_blog_`):

### Posts (4 types: `blog` / `daily` / `reflections` / `notes`)

| Tool             | Purpose                                                |
|------------------|--------------------------------------------------------|
| `list_posts`     | List metadata of the user's posts (filter by type/q/folder/visibility). |
| `get_post`       | Read a single post including markdown `content`.       |
| `create_post`    | Create a post. `slug` auto-generated from title if absent. |
| `update_post`    | Patch a post (any subset of fields).                   |
| `delete_post`    | Delete a post (and its comments) by id.                |

### Article folders

| Tool             | Purpose                                                |
|------------------|--------------------------------------------------------|
| `list_folders`   | List folders for a given post type with `postCount`.   |
| `create_folder`  | Create a folder bound to one post type.                |
| `update_folder`  | Patch a folder (cannot change its `type`).             |
| `delete_folder`  | Delete a folder; posts inside become folder-less.      |

### Comments

| Tool             | Purpose                                                |
|------------------|--------------------------------------------------------|
| `list_comments`  | List recent comments on your posts (or one post).      |
| `delete_comment` | Delete a comment you authored OR on one of your posts. |

### Uploads (images for embedding in markdown)

| Tool             | Purpose                                                |
|------------------|--------------------------------------------------------|
| `upload_image`   | Upload a base64-encoded image. Returns `/uploads/<userId>/<file>` + ready-to-paste markdown. |
| `list_uploads`   | List your uploads (optionally filter by `postId`).     |
| `delete_upload`  | Delete an upload row (the file on disk is left in place — matches existing API behavior). |

All tools resolve "the current user" from `BLOG_USER_ID` or `BLOG_USER_EMAIL`
declared in your Hermes config. No HTTP auth round-trip.

---

## Install (in WSL)

The server is a separate npm package under `mcp-server/`. Because Hermes runs from
WSL but the repo lives on the Windows mount, install its dependencies from inside
WSL so the binaries match the runtime:

```bash
# inside WSL
cd /mnt/d/appmy/webappwork/mcp-server
npm install
```

`tsx` runs the TypeScript source directly — no build step required.

---

## Configure Hermes

Edit `~/.hermes/config.yaml` and add:

```yaml
mcp_servers:
  blog:
    command: "npx"
    args:
      - "--prefix"
      - "/mnt/d/appmy/webappwork/mcp-server"
      - "tsx"
      - "/mnt/d/appmy/webappwork/mcp-server/src/server.ts"
    env:
      DATABASE_URL: "postgresql://postgres:123456@localhost:5432/lgplayblog?schema=public"
      # Account to act on behalf of (one of these is enough):
      BLOG_USER_ID: "cmo8c7l7f0000m0tci2i3i1yx"
      # BLOG_USER_EMAIL: "fli.gda@foxmail.com"
    timeout: 120
    connect_timeout: 60
```

> **Note on `DATABASE_URL`**: copy the exact value from the root `.env` of your
> Next.js app. The example above matches the current `.env`; if you change the
> Postgres credentials, change both.

> **Note on `BLOG_USER_EMAIL` vs `BLOG_USER_ID`**: either works. `_ID` is
> slightly faster (skips one lookup at startup) and unambiguous if you ever
> rename the email.

### Alternative: globally-installed `tsx`

If you have `tsx` on your `PATH` in WSL, you can shorten the command:

```yaml
mcp_servers:
  blog:
    command: "tsx"
    args: ["/mnt/d/appmy/webappwork/mcp-server/src/server.ts"]
    env:
      DATABASE_URL: "postgresql://postgres:123456@localhost:5432/lgplayblog?schema=public"
      BLOG_USER_ID: "cmo8c7l7f0000m0tci2i3i1yx"
```

---

## Environment variables

| Variable           | Required             | Purpose                                                                                       |
|--------------------|----------------------|-----------------------------------------------------------------------------------------------|
| `DATABASE_URL`     | yes                  | Postgres connection string (same one your Next.js app uses).                                  |
| `BLOG_USER_ID`     | one of these is required | Resolves the acting user by `User.id`.                                                    |
| `BLOG_USER_EMAIL`  | one of these is required | Resolves the acting user by `User.email` (case-insensitive).                              |
| `UPLOADS_DIR`      | no                   | Absolute path where image bytes are written. Defaults to `<repoRoot>/public/uploads`.         |

> Per the Hermes spec, **only variables listed under `env:` are forwarded** to
> the subprocess — the rest of your shell environment is not inherited.

---

## How tool names appear inside Hermes

Per the spec, Hermes prefixes tools with `mcp_<server_name>_`. Since we registered
the server as `blog`, you'll see e.g.:

- `mcp_blog_create_post`
- `mcp_blog_list_posts`
- `mcp_blog_upload_image`

---

## Verifying it works

After restarting Hermes:

```bash
hermes mcp status
hermes logs | grep -i mcp
```

You should see `[mcp-server] Bound to user fli.gda@foxmail.com (id=…)` followed
by `MCP server connected over stdio.`

---

## Things to know / behavior choices

- **Direct DB access.** Writes do *not* hit `revalidatePath` or
  `publishUserPageChanged`, so cached SSR pages refresh on the next request
  rather than instantly. The data itself is consistent.
- **Slug collisions.** `create_post` auto-suffixes the slug if `(userId, type,
  slug)` already exists.
- **Visibility values** are `private`, `friends`, or `public` (matches `lib/validators.ts`).
- **Image storage path.** Writes to `<repoRoot>/public/uploads/<userId>/…` so
  Next.js can serve it as `/uploads/<userId>/<file>`.
- **Upload delete** removes only the DB row, not the file on disk, matching the
  existing Next.js `DELETE /api/uploads/[id]` behavior. Leftover orphans can be
  cleaned by a periodic job.

---

## Spec deviations / corrections

While building this I cross-checked the Hermes MCP spec (`Hermes-MCP配置规范.md`)
against the official MCP transport contract. Findings:

1. The spec's example uses `command: "python"` — but the spec itself only requires
   a stdio-capable executable. Node + `tsx` is fully valid.
2. The spec lists `sampling.allowed_models: []` as "empty = all allowed". This is
   correct for Hermes but the inverse of how some MCP clients treat empty lists
   (whitelist-by-default vs deny-all). Worth noting if the user switches clients.
3. The fields documented (`command`, `args`, `env`, `url`, `headers`, `timeout`,
   `connect_timeout`, `sampling`) match the standard MCP YAML config schema —
   no errors found there.

No other deviations.
