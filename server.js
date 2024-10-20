const { createServer } = require('http');
const next = require('next');
const socketIo = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  const io = socketIo(server);

  io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Signaling events for WebRTC
    socket.on('offer', (data) => {
      console.log('Offer received', data);
      socket.broadcast.emit('offer', data);
    });

    socket.on('answer', (data) => {
      console.log('Answer received', data);
      socket.broadcast.emit('answer', data);
    });

    socket.on('ice-candidate', (data) => {
      console.log('ICE candidate received', data);
      socket.broadcast.emit('ice-candidate', data);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('Server running on http://localhost:3000');
  });
});
