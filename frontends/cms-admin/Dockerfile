# The admin panel as a container image (a production build), for `docker compose up` (repo root) and
# for the pipeline, which builds it on every change. Vercel doesn't use it: Vercel builds from source.
#
#   docker build --build-arg API_URL=http://host.docker.internal:8000 -t portfolio-admin frontends/cms-admin
#   docker run -e API_URL=http://host.docker.internal:8000 -p 3001:3000 portfolio-admin

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
# The /api and /media forwarding to the backend is fixed at build time, so the backend's address is a
# build argument; NEXT_PUBLIC_* values are written into the browser code at build time too.
ARG API_URL=http://backend:8000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    API_URL=$API_URL \
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
# API_URL (server-side calls to the backend) is read when the server starts.
CMD ["node", "server.js"]
