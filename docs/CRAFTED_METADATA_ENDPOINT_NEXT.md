# Crafted Metadata Endpoint – Next.js Check (Not Applicable Here)

This repo does **not** appear to be a Next.js app that Vercel deploys:

- `package.json` has no `next` dependency and no `next dev/build/start` scripts (it uses Vite).
- No `pages/` or `app/` directories.
- No `next.config.js` / `next.config.mjs`.

Because there is no Next.js routing here, no serverless API route was added. The Crafted metadata endpoint should be added to the actual Next.js repo that powers https://www.xprmint.com, at:

```
/api/crafted/metadata/[id]
```

Please run the same prompt in the correct Next.js repo to add the route there. Here, we stop with documentation only.

