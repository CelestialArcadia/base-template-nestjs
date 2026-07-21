FROM node:22-alpine As development

# Prisma's query engine is dynamically linked against OpenSSL; alpine ships without it.
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Orders itself has no Postgres, but the monorepo build typechecks billing,
# which imports the generated @prisma/client types.
RUN npx prisma generate

RUN npm run build

FROM node:22-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/orders/main"]