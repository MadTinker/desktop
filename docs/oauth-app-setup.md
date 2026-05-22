# GitHub OAuth App Setup

Internal reference for configuring the GitHub OAuth app for madnessDesktop sign-in.

## Why OAuth App (not GitHub App)

madnessDesktop uses the standard OAuth 2.0 desktop flow — browser opens to GitHub,
user authorizes, GitHub redirects back via custom URL scheme. This requires an
**OAuth App**, not a GitHub App. The distinction matters because GitHub Apps use
a different token flow (installation tokens) that doesn't map to the per-user
auth model GitHub Desktop uses.

## Creating the OAuth App

Go to: **github.com → Settings → Developer Settings → OAuth Apps → New OAuth App**

| Field | Value |
|-------|-------|
| Application name | `MadnessDesktop` |
| Homepage URL | `https://github.com/MadnessEngineering/madnessDesktop` |
| Authorization callback URL | `x-madness-desktop-auth://oauth-callback` |

The callback URL is a custom protocol. The app registers `x-madness-desktop-auth://`
as a URL scheme with the OS — GitHub redirects to it and the app intercepts it
locally without needing a web server.

After creating, GitHub gives you:
- **Client ID** — safe to commit (it's public)
- **Client Secret** — never commit, use env var only

## Wiring into the build

Set environment variables before building:

```bash
export DESKTOP_OAUTH_CLIENT_ID=<your-client-id>
export DESKTOP_OAUTH_CLIENT_SECRET=<your-client-secret>
yarn build:prod
```

These are injected at build time via webpack defines in `app/app-info.ts`:

```typescript
__OAUTH_CLIENT_ID__: s(process.env.DESKTOP_OAUTH_CLIENT_ID || devClientId),
__OAUTH_SECRET__: s(process.env.DESKTOP_OAUTH_CLIENT_SECRET || devClientSecret),
```

For development builds, fallback dev credentials are used (see `app/app-info.ts`).
Production releases must always provide these env vars.

## Dev OAuth App (optional)

For local development it's useful to have a separate OAuth App with:

| Field | Value |
|-------|-------|
| Application name | `MadnessDesktop Dev` |
| Authorization callback URL | `x-madness-desktop-dev-auth://oauth-callback` |

Set the dev credentials directly in `app/app-info.ts` as the fallback values.
These dev credentials are low-risk (callback is a localhost-equivalent protocol)
but should still not be org-wide secrets.

## Current status

- [ ] OAuth App created under MadnessEngineering org
- [ ] Client ID set in `app/app-info.ts` default
- [ ] Client Secret stored securely (not committed)
- [ ] Production build CI configured with `DESKTOP_OAUTH_CLIENT_ID` + `DESKTOP_OAUTH_CLIENT_SECRET`
- [ ] Dev OAuth App created (optional, for local dev)
