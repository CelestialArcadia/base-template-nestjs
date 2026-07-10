FROM node:22-alpine As development

# Prisma's query engine is dynamically linked against OpenSSL; alpine ships without it.
RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Generates the typed client into node_modules/.prisma. Must run before `nest build`,
# which typechecks code that imports @prisma/client.
RUN npx prisma generate

RUN npm run build

FROM node:22-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN apk add --no-cache openssl

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

COPY --from=development /usr/src/app/dist ./dist
# The production install omits the `prisma` CLI, so the client can't be generated
# here — copy the one built in the development stage instead.
COPY --from=development /usr/src/app/node_modules/.prisma ./node_modules/.prisma

CMD ["node", "dist/apps/billing/main"]
