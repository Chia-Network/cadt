import { assert } from 'chai';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import { Server } from 'socket.io';

describe('my awesome project', function () {
  let io, serverSocket, clientSocket;

  before(function (done) {
    const httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  after(function () {
    io.close();
    clientSocket.close();
  });

  it('should work', function (done) {
    clientSocket.on('connection', function (arg) {
      assert.equal(arg, 'projects');
      done();
    });
    serverSocket.emit('connection', 'projects');
  });
});
