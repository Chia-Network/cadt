FROM node:16

WORKDIR /usr/src/app
RUN npm install -g json
COPY package*.json ./
RUN json -I -f package.json -e "this.type=\"commonjs\""
RUN npm set-script prepare ""
RUN npm set-script requirements-check ""
COPY ./build .
RUN npm install

EXPOSE 3030
CMD [ "node", "server.js" ]