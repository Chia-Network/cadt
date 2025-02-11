FROM node:20.18-bookworm

COPY package.json /app/
COPY package-lock.json /app/
COPY src /app/src/
COPY tests /app/tests/
WORKDIR /app

RUN npm install && npm install -g @babel/cli @babel/preset-env

RUN mkdir -p /root/.chia/mainnet/config/ssl && mkdir -p /root/.chia/mainnet/cadt/v1

CMD [ "npm", "run", "start" ]
