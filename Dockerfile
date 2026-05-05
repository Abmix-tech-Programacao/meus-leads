FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY src ./src
COPY seed-config.json ./seed-config.json
COPY logo.jpg ./logo.jpg
COPY logo-transparente.png ./logo-transparente.png

RUN mkdir -p /app/data

EXPOSE 4100

CMD ["sh", "-c", "npm run bootstrap && npm run start"]
