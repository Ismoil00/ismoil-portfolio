# The public site as a container image (a production build), for `docker compose up` (repo root) and
# for the pipeline, which builds it on every change. Vercel doesn't use it: Vercel builds from source.
#
#   docker build -t portfolio-public frontends/public
#   docker run -e API_URL=http://host.docker.internal:8000/api/v1 -p 3000:3000 portfolio-public

# 1. Dependencies (reused until package-lock.json changes)
FROM node:22-alpine AS deps
WORKDIR /app
# The same npm as on the development machine (it wrote package-lock.json; npm 10 reads it differently).
RUN npm install --global npm@11.6.0
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build: NEXT_OUTPUT=standalone makes `next build` write a self-contained server (next.config.ts).
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are written into the browser code at build time.
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

# 3. Run: only the built server, its static files and public/ — no source, no dev dependencies.
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
# API_URL (the backend, server-side only) and INTERNAL_API_TOKEN are read when the server starts.
CMD ["node", "server.js"]
