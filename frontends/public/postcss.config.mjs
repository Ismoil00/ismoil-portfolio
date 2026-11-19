// Tailwind CSS v4 via PostCSS — the setup documented by Next.js.
// (Replaces the experimental @tailwindcss/turbopack loader, which didn't pick up
// new classes from .tsx files while the dev server was running.)
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
