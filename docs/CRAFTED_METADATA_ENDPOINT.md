# Crafted Metadata Endpoint – Next.js Check

This repo does **not** appear to be a Next.js app.

What I checked:
- `package.json`: no `next` dependency and no `next dev/build/start` scripts (scripts use Vite).
- Repo layout: no `pages/`, no `app/`, no `next.config.js`/`next.config.mjs`.

Result:
- Because there is no Next.js router here, no serverless API route was added.
- The canonical plan is to host the Crafted metadata endpoint as a Next.js API route at `/api/crafted/metadata/[id]` in the repo that actually powers https://www.xprmint.com.

Next step:
- Run this prompt again from the correct Next.js repo (the one deployed to xprmint.com) to add `/api/crafted/metadata/[id]` there.

