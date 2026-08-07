'use strict';

/**
 * @deprecated Socket.IO is legacy and unmaintained. No longer used; skip in
 * testing and future maintenance.
 */

import { Project, Unit, Staging } from './models/index.js';
import { ProjectV2, UnitV2, StagingV2 } from './models/v2/index.js';
import { logger } from './config/logger.js';

const socketSubscriptions = {};

//future authentication logic goes here
const authenticate = () => true;

export const connection = (socket) => {
  socket.on('authentication', () => {
    if (!authenticate(socket)) {
      logger.error('authentication failure');
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
      // V2 subscriptions
      case 'projects-v2':
        if (!socketSubscriptions[socket.id].includes('projects-v2')) {
          ProjectV2.changes.subscribe((data) => {
            socket.emit('change:projects-v2', data);
          });
          socketSubscriptions[socket.id].push('projects-v2');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
      case 'units-v2':
        if (!socketSubscriptions[socket.id].includes('units-v2')) {
          UnitV2.changes.subscribe((data) => {
            socket.emit('change:units-v2', data);
          });
          socketSubscriptions[socket.id].push('units-v2');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
      case 'staging-v2':
        if (!socketSubscriptions[socket.id].includes('staging-v2')) {
          StagingV2.changes.subscribe((data) => {
            socket.emit('change:staging-v2', data);
          });
          socketSubscriptions[socket.id].push('staging-v2');
          callback('success');
        } else {
          callback('already subscribed');
        }
        break;
    }
  });
};
