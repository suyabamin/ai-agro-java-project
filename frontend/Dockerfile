# ---- Build stage -------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage -----------------------------------------------------
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist .
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1
