FROM node:18-alpine AS build

WORKDIR /
COPY package* ./

RUN npm install

COPY *.js ./


RUN npm run build

FROM scratch
COPY --from=build /lucos_navbar.js /