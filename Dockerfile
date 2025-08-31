# PRODUCTION DOCKERFILE
# ---------------------
# This Dockerfile allows to build a Docker image of the NestJS application
# and based on a NodeJS 20 image. The multi-stage mechanism allows to build
# the application in a "builder" stage and then create a lightweight production
# image containing the required dependencies and the JS build files.
# 
# Dockerfile best practices
# https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
# Dockerized NodeJS best practices
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md
# https://www.bretfisher.com/node-docker-good-defaults/
# http://goldbergyoni.com/checklist-best-practice-of-node-js-in-production/

FROM node:jod-slim AS builder
ENV NODE_ENV=build
# USER node
WORKDIR /home/app

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
# COPY --chown=node:node . .
COPY . .
RUN yarn build

## ----------------------------Copy necessary only

FROM node:jod-slim

# args
ARG IMAGE_ID=backend

# Install logrotate
RUN apt-get update && apt-get -y install logrotate
RUN mkdir /var/log/${IMAGE_ID}
COPY logrotate.conf /etc/logrotate.d/${IMAGE_ID}
RUN sed -i s/backend/${IMAGE_ID}/ /etc/logrotate.d/${IMAGE_ID}

ENV NODE_ENV=production
# USER node
WORKDIR /home/app

COPY --from=builder /home/app/package*.json ./
COPY --from=builder /home/app/node_modules/ ./node_modules/
COPY --from=builder /home/app/dist/ ./dist/
# COPY --from=builder /home/app/credentials/ ./credentials/
COPY --from=builder /home/app/resources/ ./resources/

CMD ["sh", "-c", "service cron start && yarn start:prod"]
