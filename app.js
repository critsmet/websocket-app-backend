const express = require("express");
const http = require("http");
const socketIo = require("socket.io");

const port = process.env.PORT || 4001;
const index = require("./routes/index");

const app = express();
app.use(index);

const server = http.createServer(app);

const io = socketIo(server);

//we'll store the users here as their clients make connections
let users = []

let messages = []

let idSetter = 0

//keeping track of userIds this way until we get a database
let setId = () => idSetter += 1

io.on("connection", socket => {
  console.log("New client connected with a socket ID of: ", socket.id)
  socket.on("initializeSession", username => {
    //in the previous commit, I stored the socket ID. I decided against this and implemented an ID instead because the socket ID can change even if the same user logs in.
    //it's also easy to refrence the socket id from the socket itself

    let userObj = users.find(user => user.username === username)
    if (userObj){
      userObj.socketId = socket.id
    } else {
      userObj = {socketId: socket.id, username}
      users.push(userObj)
    }

    //tell the client that it was succesfully registered
    socket.emit("initializedSession", userObj, users.filter(user => user.username !== userObj.username), messages)

    //tell other clients a new user is here
    socket.broadcast.emit("newUserJoin", userObj)
  })


  socket.on("disconnect", () => {

    //emit the logout of the user by sending the id of the disconnected socket

    //perform the inverse of login here, setting socketId to null:
    users = users.map(user => {
      if(user.socketId === socket.id){
        socket.broadcast.emit("userLogout", user)
        return {...user, socketId: null}
        console.log(`${user.username} has disconnected, current users:`, users);
      } else {
        return user
      }
    })

  });

  socket.on("sentMessage", (message) => {
    console.log("We just got a message!", message)
    let user = users.find(user => user.socketId === socket.id)
    let messageObj = {username: user.username, message}
    messages.push(messageObj)
    io.emit("newMessage", messageObj)
  })

  //all WebRTC peer connection communication:

  socket.on("offer", (watcherSocketId, description) => {
    console.log(`Offer Received! We're connecting with your peer ${users.find(user => user.socketId === watcherSocketId)} now`);
    socket.to(watcherSocketId).emit("offer", socket.id, description)
  })

  socket.on("answer", (broadcasterSocketId, description) => {
    console.log("Answer Received! We're telling the broadcaster you're good to go!")
    socket.to(broadcasterSocketId).emit("answer", socket.id, description)
  })

  socket.on("candidate", (id, message) => {
    console.log("YEEHAW LOOKING FOR A CANDIDATE");
    socket.to(id).emit("candidate", socket.id, message);
  });
});

server.listen(port, () => console.log(`Listening on port ${port}`));
