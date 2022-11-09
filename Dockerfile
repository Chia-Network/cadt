FROM node:16.13

WORKDIR /usr/src/app
RUN npm install -g json
RUN npm install semver
COPY package*.json ./
COPY check_node_version.js ./
RUN json -I -f package.json -e "this.type=\"commonjs\""
COPY ./build .
RUN npm set-script prepare ""
RUN npm set-script postinstall ""
RUN npm set-script requirements-check ""
RUN npm install

EXPOSE 3030
CMD [ "node", "server.js" ]
