# syntax=docker/dockerfile:1
# One image for both processes: `node dist/main.js` (API) and
# `node dist/worker.js` (worker).

FROM node:24.22.3-alpine3.24 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Scanner binaries, pinned by version and verified by SHA-256.
FROM node:24.22.3-alpine3.24 AS scanners
ARG TARGETARCH
ARG OSV_SCANNER_VERSION=2.7.1
ARG GITLEAKS_VERSION=8.30.1
RUN apk add --no-cache curl
RUN set -eux; \
    case "${TARGETARCH}" in \
      amd64) OSV_SHA=fb7dab19a8bd9bbe5c3189f09d4b7ee1820c9553a23bac202648a56efd2f6ee8; \
             GL_ARCH=x64; GL_SHA=551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb ;; \
      arm64) OSV_SHA=983d22fbad9724514e3fcc6acc83b5fa64c5ffa6b0d9f510028f22c1b223ff81; \
             GL_ARCH=arm64; GL_SHA=e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080 ;; \
      *) echo "unsupported architecture ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSLo /tmp/osv-scanner "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_linux_${TARGETARCH}"; \
    echo "${OSV_SHA}  /tmp/osv-scanner" | sha256sum -c -; \
    install -m 0755 /tmp/osv-scanner /usr/local/bin/osv-scanner; \
    curl -fsSLo /tmp/gitleaks.tar.gz "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz"; \
    echo "${GL_SHA}  /tmp/gitleaks.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/gitleaks.tar.gz -C /tmp gitleaks; \
    install -m 0755 /tmp/gitleaks /usr/local/bin/gitleaks; \
    curl -fsSLo /opt/gitleaks.toml "https://raw.githubusercontent.com/gitleaks/gitleaks/v${GITLEAKS_VERSION}/config/gitleaks.toml"; \
    echo "e163e53b9e7e8a8511e77271e2b323ed057759542a6d988258afe3a1fa329caf  /opt/gitleaks.toml" | sha256sum -c -

FROM node:24.22.3-alpine3.24 AS runtime
RUN apk add --no-cache git tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=scanners /usr/local/bin/osv-scanner /usr/local/bin/gitleaks /usr/local/bin/
COPY --from=scanners /opt/gitleaks.toml /opt/scanners/gitleaks.toml
COPY config/osv-scanner.toml /opt/scanners/osv-scanner.toml
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
