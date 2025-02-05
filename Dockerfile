FROM node:20.18-bookworm

COPY package.json /app/
COPY package-lock.json /app/
COPY src /app/src/
COPY tests /app/tests/
WORKDIR /app

RUN npm install && npm install -g @babel/cli @babel/preset-env

CMD [ "npm", "run", "start" ]
