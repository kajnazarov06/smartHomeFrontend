# syntax=docker/dockerfile:1

# --- deps: node_modules from the lockfile ---------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# --- dev: Vite dev server with HMR (source is bind-mounted by docker-compose) ---------------
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- build: static bundle ---------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# --- runtime: nginx serves the SPA and proxies /api, /sanctum and the Reverb socket ----------
FROM nginx:1.27-alpine AS runtime
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/nginx/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_UPSTREAM=nginx:80 \
    REVERB_UPSTREAM=reverb:8080 \
    REVERB_APP_KEY=""
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
