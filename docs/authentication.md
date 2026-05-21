# Authentication in Madness Desktop

Madness Desktop is a fork of GitHub Desktop. Because the OAuth app registration belongs to GitHub, the browser OAuth callback will not redirect back to Madness Desktop. This doc covers the two working sign-in paths.

## Option A: Personal Access Token (PAT)

This gives you full account integration — your avatar, PR status, issue links, and repository lists all work.

### 1. Generate a PAT on GitHub

1. Go to **GitHub → Settings → Developer settings → Personal access tokens**
2. Choose **Fine-grained tokens** (recommended) or **Tokens (classic)**
3. For classic tokens, enable the `repo` scope (and `read:org` if you work with org repos)
4. Copy the token — you won't see it again

### 2. Sign in to Madness Desktop

1. Open Madness Desktop
2. Go to **Settings → Accounts** (or the sign-in screen on first launch)
3. Click **"Use a token instead"** under the sign-in button
4. Paste your PAT and submit

You are now signed in with full account access.

---

## Option B: External Credential Helper

This requires no sign-in inside the app. Git operations (push, pull, fetch) use your system's existing credentials — macOS Keychain, Git Credential Manager, or whatever your shell `git` already uses.

### Enable it

1. Open **Settings → Advanced**
2. Toggle on **"Use External Credential Helper"**
3. Save and close Settings

Push and pull now fall through to your system credential manager. The Accounts tab will show no signed-in account, but all git operations work.

### When to use this

- You already have `git push` working in your terminal for the same repos
- You're on a machine where PAT management is handled centrally
- You want minimal app-managed credentials

---

## Which should I use?

| | PAT | External Helper |
|---|---|---|
| Account features (avatar, PRs, issues) | Yes | No |
| Push/pull works | Yes | Yes |
| Requires GitHub token | Yes | No |
| Uses system keychain | No | Yes |

Most workshop machines: **External Helper** is fastest.  
Primary dev machine where you want full account features: **PAT**.
