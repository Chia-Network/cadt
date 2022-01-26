import { assert } from 'chai';
import { createServer } from "http";
import { io as Client } from "socket.io-client";
import { Server } from "socket.io";

describe("my awesome project", () => {
  let io, serverSocket, clientSocket;

  before((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on("connection", (socket) => {
        serverSocket = socket;
      });
      clientSocket.on("connect", done);
    });
  });

  after(() => {
    io.close();
    clientSocket.close();
  });

  it("should work", (done) => {
    clientSocket.on("connection", (arg) => {
      assert.equal(arg, "projects");
      done();
    });
    serverSocket.emit("connection", "projects");
  });

});