const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { v4: uuidv4 } = require('uuid');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb'); // DynamoDB client
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb'); // DynamoDB document client

// configure aws client
const dynamoDBClient = new DynamoDBClient({ region: 'us-east-2' }); // Set your preferred region
const docClient = DynamoDBDocumentClient.from(dynamoDBClient); // Use DynamoDBDocumentClient for simplified usage


app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
//test
const users = new Map();

// placeholder for message json creation
function createMessageJson(senderId, individualChat, messageText, fileAddress) {
  const message = {
    messageID: uuidv4(), // Generate a unique messageId
    individualChat: individualChat,
    content: {
      type: 'text', // Assuming the type is 'text' for now
      senderId: senderId,
      messageText: messageText,
      fileAddress: fileAddress, // Empty for now, as it's a text message
      dateTime: new Date().toISOString() // Current timestamp
    }
  };
  return message;
}

async function uploadMessageToDynamoDB(messageJson) {
  const params = {
    TableName: 'Message', // Replace with your DynamoDB table name
    Item: messageJson      // The message JSON object you want to upload
  };

  try {
    const data = await docClient.send(new PutCommand(params));
    console.log("Message added to DynamoDB:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Unable to add message to DynamoDB. Error JSON:", JSON.stringify(err, null, 2));
  }
}


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

    const messageJson = createMessageJson(username, true, msg, '');
    console.log('Message JSON ready for DynamoDB:', JSON.stringify(messageJson, null, 2));
    uploadMessageToDynamoDB(messageJson);

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
