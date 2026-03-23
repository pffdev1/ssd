FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets

RUN npm run build

EXPOSE 4000
CMD ["npm", "run", "start"]
