'use strict';

import { Project, Unit, Staging } from './models/index.js';

const socketSubscriptions = {};

//future authentication logic goes here
const authenticate = () => true;

export const connection = (socket) => {
  console.log(socketSubscriptions);
  socket.on('authentication', () => {
    if (!authenticate(socket)) {
      console.log('authentication failure');
      return socket.disconnect();
    } else {
      socket.emit('authenticated');
    }
  });

  socket.on('disconnect', () => {
    if (socketSubscriptions[socket.id]) {
      delete socketSubscriptions[socket.id];
    }
  });

  socket.on('/subscribe', (feed, callback) => {
    if (!socketSubscriptions[socket.id]) {
      socketSubscriptions[socket.id] = [];
    }

    switch (feed) {
      case 'projects':
        if (!socketSubscriptions[socket.id].includes('projects')) {
          Project.changes.subscribe((data) => {
            socket.emit('change:projects', data);
          });
          socketSubscriptions[socket.id].push('projects');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
      case 'units':
        if (!socketSubscriptions[socket.id].includes('units')) {
          Unit.changes.subscribe((data) => {
            socket.emit('change:units', data);
          });
          socketSubscriptions[socket.id].push('units');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
      case 'staging':
        if (!socketSubscriptions[socket.id].includes('staging')) {
          Staging.changes.subscribe((data) => {
            socket.emit('change:staging', data);
          });
          socketSubscriptions[socket.id].push('staging');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
    }
  });
};
