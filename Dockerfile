FROM node:20-alpine AS frontend
WORKDIR /web
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
COPY web/package*.json ./
RUN npm install
COPY web/tsconfig.json ./tsconfig.json
COPY web/tailwind.config.cjs ./tailwind.config.cjs
COPY web/postcss.config.cjs ./postcss.config.cjs
COPY web/vite.config.ts ./vite.config.ts
COPY web/index.html ./index.html
COPY web/public ./public
COPY web/src ./src
RUN npm run build

FROM node:20-alpine AS papers
WORKDIR /papers
COPY plataformapaper/package*.json ./
RUN npm install
COPY plataformapaper/tsconfig.json ./tsconfig.json
COPY plataformapaper/tailwind.config.cjs ./tailwind.config.cjs
COPY plataformapaper/postcss.config.cjs ./postcss.config.cjs
COPY plataformapaper/vite.config.ts ./vite.config.ts
COPY plataformapaper/index.html ./index.html
COPY plataformapaper/src ./src
COPY plataformapaper/public ./public
RUN npm run build

FROM node:20-alpine AS backend
WORKDIR /app
COPY api/package*.json ./
RUN npm install
COPY api/tsconfig.json ./tsconfig.json
COPY api/src ./src
COPY api/trl ./trl
COPY api/.env.example ./.env.example
COPY init.sql ./init.sql
COPY --from=frontend /web/dist ./web-dist
COPY --from=papers /papers/dist ./paper-dist
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
