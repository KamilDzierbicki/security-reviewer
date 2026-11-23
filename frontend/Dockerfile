# syntax=docker/dockerfile:1
FROM node:24.22.3-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Static files only; runs as a non-root user on port 8080.
FROM nginxinc/nginx-unprivileged:1.31.7-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
