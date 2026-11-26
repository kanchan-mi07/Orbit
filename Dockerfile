FROM node:24-alpine

ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js ./server.js
COPY public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]
