# Kard — Docs site

The installation docs site for Kard. React + Vite + Tailwind v4 + Motion.

## Run locally

```bash
cd docs-site
npm install
npm run dev
# opens http://localhost:5173 automatically
```

## Build for production

```bash
npm run build
npm run preview
```

Output goes to `docs-site/dist/` — drop the static files on any host (Vercel,
Netlify, Cloudflare Pages, S3, etc.).

## Structure

```
src/
├── App.tsx                  composition root: Hero + Marquee + Docs
├── components/
│   ├── Hero.tsx             top hero with video bg + floating navbar
│   ├── Marquee.tsx          seamless logo scroller
│   └── Docs.tsx             8-step installation walkthrough
├── lib/cn.ts                clsx + tailwind-merge helper
├── index.css                Tailwind v4 + fonts
└── main.tsx                 entry point
```
