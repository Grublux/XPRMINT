# XPRMINT Metadata API

Private metadata API for the NGMI Crafted V1 collection.

This project is designed to be deployed as a Vercel Serverless Functions project and fronted by a subdomain like `crafted.xprmint.com`.

## Endpoints

### Health

- `GET /api/health`
- Returns `{ ok: true }` for monitoring.

### Crafted Metadata

- `GET /api/crafted/metadata/[id]`
- Returns NFT metadata for a given Crafted token ID.
- Metadata is compatible with Magic Eden / OpenSea (name, image, external_url, attributes).

## Local Development

```bash
npm install
npm run dev
# Then hit http://localhost:3000/api/health
# or  http://localhost:3000/api/crafted/metadata/1
```

## Deployment

1. Push this repo to GitHub as **private**.
2. Create a new Vercel project from this repo.
3. Add a custom domain like `crafted.xprmint.com` to this Vercel project.
4. Add a CNAME `crafted -> cname.vercel-dns.com` where your DNS is hosted.
5. Set `_BASE_METADATA_URL` in your MasterCrafterV1 contract to:

```solidity
"https://crafted.xprmint.com/api/crafted/metadata/"
```

## Security Notes

- Do **not** commit secrets or API keys. Use environment variables if needed.
- This repo should remain **private**; only the HTTPS endpoints are public.

