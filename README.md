# Time Vault

[![CI](https://github.com/HackerOverlord/time-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/HackerOverlord/time-vault/actions/workflows/ci.yml)

**Private memory sharing for families, with time capsules that open on a date you choose.**

🔗 **Live app:** https://time-vault-imhg.vercel.app

Time Vault lets a family or a small group share photos, videos and notes in private vaults. Any post can be sealed as a **time capsule**: members see that something is waiting and a countdown, but the content stays hidden, even from the author, until the unlock date.

## Features

- **Vaults:** private shared spaces with their own color, cover and description. Invite people with a single-use link.
- **Posting:** record video or take photos right in the browser, upload files, or write text.
- **Time capsules:** lock a post until a future date. Locking is enforced by the API, which never sends locked content.
- **Two views:** a full-screen, swipeable **Feed** with autoplaying video, and a **Timeline** grouped by year and month.
- **Social:** likes, comments, search and filters by type (photos, videos, text, capsules).
- **Notifications:** member activity, capsule unlocks and a daily digest.
- **Child vaults:** build a vault for a child that they can claim later.
- **Responsive:** desktop sidebar layout, plus mobile bottom navigation.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Flask REST API, SQLAlchemy, JWT auth ([backend repo](https://github.com/HackerOverlord/time-vault-backend), private) |
| Media | Cloudflare R2 object storage |
| Hosting | Vercel (frontend) + PythonAnywhere (API) |
| Testing | Vitest + Testing Library (frontend), pytest (backend) |

## Security highlights

- JWT stored in `sessionStorage` (per tab) and sent as a Bearer header. Tokens are revoked when the password changes.
- Login lockout after repeated failures. All authorization is enforced server-side.
- Locked capsules are redacted by the API: no caption and no media URL until unlock.
- Content Security Policy, HSTS, `X-Frame-Options: DENY` and a strict Permissions-Policy (camera and mic only for this site).

## Running locally

```bash
pnpm install
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" > .env.local
pnpm dev              # http://localhost:3000
pnpm test             # Vitest
```

You'll also need the Flask API running on port 5000.

## Project structure

```
app/                Next.js entry (single-page app at "/")
components/screens  Login, register, feed, vault, settings, claim screens
components/feed     Feed post, timeline, capsule card, sidebar, notifications
components/upload   Upload modal, in-browser photo and video capture
lib/                API client, countdown/time helpers, filters, types
```

## Author

**Selab Kakar**, cybersecurity student at Sheridan College
