FROM node:20.18-bookworm

COPY . /app
WORKDIR /app

RUN npm install && npm install -g @babel/cli @babel/preset-env pkg
RUN chmod +x dist/cadt
RUN cp node_modules/sqlite3/build/Release/node_sqlite3.node ./dist/

