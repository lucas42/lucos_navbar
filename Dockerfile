FROM node:23-alpine AS build

WORKDIR /
COPY package* ./

RUN npm install

COPY assets ./assets
COPY *js ./

RUN npm run build

FROM scratch
COPY --from=build /lucos_navbar.js /