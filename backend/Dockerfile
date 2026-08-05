FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
# Must run before `npm run build` - tsc needs the generated Prisma Client
# (model types, enums like Gender/BranchGender, Prisma.Decimal, etc.) to exist
# on disk first. Without this, every file that imports @prisma/client fails
# to typecheck, exactly like the errors seen on the first Render build.
RUN npx prisma generate
RUN npm run build

# Runner stage
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 3000

# IMPORTANT: this CMD runs on every `docker compose restart backend` / container
# start, not just the first one. It used to run `prisma db push --accept-data-loss`
# and `prisma db seed` unconditionally every time, which silently wiped real data
# on ordinary restarts (Prisma's --accept-data-loss will drop/recreate tables if it
# detects any schema drift, and this ran on every single restart). Schema pushes and
# seeding are now manual, one-off steps (see PROJECT_STATUS.md) - run them yourself
# with `docker compose exec backend npx prisma db push` / `npx prisma db seed` only
# when you've actually changed schema.prisma or want to reset demo data.
#
# `npm start` (node dist/app.js), NOT `npm run start:dev`. start:dev needs
# ts-node-dev and the raw src/ folder - neither exists in this runner stage
# (only compiled dist/ was copied in, and devDependencies were skipped via
# `npm install --omit=dev` above), so start:dev would crash on boot in
# production/Render. dist/app.js is the whole reason the builder stage exists.
CMD ["sh", "-c", "npx prisma generate && npm start"]
