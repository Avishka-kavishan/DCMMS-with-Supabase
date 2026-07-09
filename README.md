This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploying to GitHub Pages

This project is configured to deploy automatically to GitHub Pages via a GitHub Actions workflow.

### Setup Instructions:
1. Go to your repository settings on GitHub.
2. Navigate to **Pages** on the left menu.
3. Under **Build and deployment** -> **Source**, choose **GitHub Actions** (instead of "Deploy from a branch").
4. Under **Settings** -> **Secrets and variables** -> **Actions**, add your Supabase credentials as repository secrets:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Every push to the `main` branch will now build and deploy the Next.js static export directly to GitHub Pages.
