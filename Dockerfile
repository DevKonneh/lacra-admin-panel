# Build Stage
# Node 20 is end-of-life and won't get the October 2026 security patches
# (eMudhra cert compromise + Node.js CVEs) - bumped to 22-alpine. This stage
# only runs `npm install && vite build`; the actual served runtime below is
# nginx, not Node, so this isn't a live attack surface, but there's no
# reason to build on an unpatched/EOL image either.
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

# Serve Stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
