FROM mikefarah/yq:4 AS yq

FROM node:20.18-bookworm

# Copy yq from the yq image
COPY --from=yq /usr/bin/yq /usr/local/bin/yq

RUN apt-get update && apt-get install -y \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json /app/
COPY package-lock.json /app/
COPY src /app/src/
COPY tests /app/tests/
WORKDIR /app

RUN npm install && npm install yaml

RUN mkdir -p /root/.chia/mainnet/config/ssl && mkdir -p /root/.chia/mainnet/cadt/v1

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD [ "npm", "run", "start" ]
