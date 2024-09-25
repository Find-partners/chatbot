const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = new Map();

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('set username', (username) => {
    users.set(socket.id, username);
    socket.emit('user joined', username);
    io.emit('user list', Array.from(users.values()));
    socket.broadcast.emit('chat message', {
      sender: 'System',
      message: `${username} has joined the chat`
    });
  });

  socket.on('chat message', (msg) => {
    const username = users.get(socket.id);
    console.log(`Message received from ${username}: ${msg}`);
    
    // Broadcast the message to all clients
    io.emit('chat message', {
      sender: username,
      message: msg
    });

    // Simple bot logic
    let botReply = `Hello ${username}, I received your message: "${msg}". How can I help you?`;
    socket.emit('chat message', {
      sender: 'Chatbot',
      message: botReply
    });
  });

  socket.on('disconnect', () => {
    const username = users.get(socket.id);
    if (username) {
      console.log(`${username} disconnected`);
      users.delete(socket.id);
      io.emit('user list', Array.from(users.values()));
      socket.broadcast.emit('chat message', {
        sender: 'System',
        message: `${username} has left the chat`
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
