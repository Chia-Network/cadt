#!/usr/bin/env node

import 'regenerator-runtime/runtime.js';
import rootRouter from './routes';
import http from 'http';
import { Server } from 'socket.io';
import { connection } from './websocket';
import { CONFIG } from './user-config';
import { logger } from './logger.js';
import { getMirrorUrl } from './utils/datalayer-utils';

import dotenv from 'dotenv';

dotenv.config();
logger.info('CADT:server');

const port = CONFIG().CADT.PORT || 3030;
const bindAddress = CONFIG().CADT.BIND_ADDRESS || 'localhost';
const server = http.createServer(rootRouter);

server.on('error', onError);
server.on('listening', onListening);

server.listen(port, bindAddress, async () => {
  console.log(`Server listening at http://${bindAddress}:${port}`);
  console.log(`Mirror URL: ${await getMirrorUrl()}`);
});

const io = new Server(server);
io.of('/v1/ws').on('connection', connection);

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  logger.info('Listening on ' + bind);
}

export default rootRouter;
