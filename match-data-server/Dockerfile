FROM node:18-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=6 \
  CMD wget -q -O - http://127.0.0.1:3001/readyz || exit 1

CMD ["npm", "start"]
