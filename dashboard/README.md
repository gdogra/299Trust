# 299Trust Admin Dashboard

Static React (Vite) SPA showing the funnel: KPI cards, step-by-step conversion
with drop-off, recent sessions, and the orphan-submission warning. It calls the
`admin-metrics` Edge Function and is gated by `ADMIN_API_SECRET`, which the
operator enters at runtime (kept in `localStorage`, never baked into the build).

## Develop

```bash
cd dashboard
npm install
cp .env.example .env     # VITE_FUNCTIONS_URL — defaults to the 299Trust project if unset
npm run dev              # enter the ADMIN_API_SECRET at the login screen
```

## Build

```bash
npm run build            # type-checks, then emits dist/ (a static SPA)
npm run preview          # serve dist/ locally to sanity-check
```

`dist/` is a plain static bundle — host it anywhere. The Functions URL falls
back to the 299Trust project, so a no-env build works out of the box; override
with `VITE_FUNCTIONS_URL` for a different project.

## Deploy (pick one — each builds + ships dist/)

```bash
# Netlify
npx netlify-cli deploy --dir=dist --prod

# Vercel
npx vercel deploy dist --prod

# Cloudflare Pages
npx wrangler pages deploy dist

# GitHub Pages (via gh-pages)
npx gh-pages -d dist

# Any host / quick share — just serve the folder
npx serve dist
```

Run `npm run build` first so `dist/` is fresh. All of the above serve from the
domain root, which matches the bundle's absolute asset paths.

## Notes

- **Secret model:** the dashboard sends `ADMIN_API_SECRET` as the
  `x-admin-secret` header on each request. It is entered at runtime, not built
  in — so the static bundle carries no secret and is safe to host publicly. The
  data behind it is still protected because `admin-metrics` rejects any request
  without the matching secret.
- **Before wide use:** upgrade from the shared secret to Supabase Auth + an
  `admin` role (the views and function are already isolated for this).
