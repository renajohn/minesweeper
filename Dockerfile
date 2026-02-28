FROM oven/bun:1-alpine

WORKDIR /app

COPY package.json tsconfig.json server.ts index.html ./

RUN mkdir -p /data

ENV DATA_DIR=/data

EXPOSE 3000

CMD ["bun", "run", "server.ts"]
