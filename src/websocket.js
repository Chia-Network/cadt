'use strict';

import { Project, Unit } from "./models/index.js";
import { BehaviorSubject, zip } from "rxjs";

const socketSubscriptions = {};

const ORG_UID = 0;
const ENTITY_NAME = 1;

const authenticate = (_payload) => true;

const subscribedChangeFeeds = ({ projects, units }) => [projects, units].filter(feed => !!feed);

export const connection = (socket) => {
  let combinedChangeFeedSubscription = null;
  
  const changeFeeds = new BehaviorSubject({
    projects: null,
    units: null,
  });
  
  socket.on('disconnect', () => {
    if (changeFeedListSub) {
      changeFeedListSub.unsubscribe();
    }
    
    if (socketSubscriptions[socket.id]) {
      socketSubscriptions[socket.id].unsubscribe();
      delete socketSubscriptions[socket.id];
    }
    
  });
  
  socket.on('/subscribe', (feed) => {
    switch (feed) {
      case 'projects':
        if (!changeFeeds.projects) {
          changeFeeds.projects = Project.changes;
        }
      break;
      case 'units':
        if (!changeFeeds.units) {
          changeFeeds.units = Unit.changes;
        }
      break;
    }
  });
  
  if (!authenticate(socket)) {
    console.log('authentication failure');
    return socket.disconnect();
  } else {
    socket.broadcast.emit('authenticated');
  }
  
  const changeFeedListSub = changeFeeds.subscribe((feeds) => {
    if (combinedChangeFeedSubscription) {
      combinedChangeFeedSubscription.unsubscribe();
    }
  
    combinedChangeFeedSubscription = zip(...subscribedChangeFeeds(feeds)).subscribe(update => {
      socket.broadcast.emit(`change:${update[ENTITY_NAME]}`, JSON.stringify({ orgUid: update[ORG_UID] }));
    });
    
  });
  
}