#!/usr/bin/env node

import rootRouter from './routes';
import http from 'http';
import Debug from 'debug';
import { Server } from 'socket.io';
import { Project, Unit } from "./models";

const debug = Debug('climate-warehouse:server');

const port = 3030;
const server = http.createServer(rootRouter);

const io = new Server(server);

const socketSubscriptions = {};

io.on("connection", (socket) => {
  const { url } = socket.request;
  let subject;
  
  if (url.includes('project')) {
    subject = Project.changes;
  } else if (url.includes('unit')) {
    subject = Unit.changes;
  } else {
    return socket.disconnect();
  }
  
  socket.on('disconnect', () => {
    if (socketSubscriptions[socket.id]) {
      socketSubscriptions[socket.id].unsubscribe();
      delete socketSubscriptions[socket.id];
    }
    
  });
  
  socketSubscriptions[socket.id] = subject.subscribe(orgUid => socket.broadcast.emit({ orgUid }));
});

server.on('error', onError);
server.on('listening', onListening);

server.listen(port);

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
  debug('Listening on ' + bind);
}

export default rootRouter;
