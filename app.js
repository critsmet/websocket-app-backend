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
  socket.on("signup", username => {
    //in the previous commit, I stored the socket ID. I decided against this and implemented an ID instead because the socket ID can change even if the same user logs in.
    //it's also easy to refrence the socket id from the socket itself
    let newUserObj = {id: setId(), socketId: socket.id, username}

    //tell the client that it was succesfully registered
    socket.emit("successfulSignup", newUserObj)
    //tell other clients a new user is here
    socket.broadcast.emit("newUser", newUserObj)

    //we'll emit this before we push the new user to the list of users so they are not included
    //this lets the client know who else is here and all the messages so far
    socket.emit("allUsers", users)
    socket.emit("allMessages", messages)

    //push this to the array after the broadcast so the user doesn't end up in the array
    users.push(newUserObj)
    console.log(`Signup was successful! Welcome ${newUserObj.username}`);
  })

  socket.on("login", loginId => {

    //set the user's socketId attribute which we'll use on a disconnect, esp if there's a hard refresh or page close
    //i don't want to adjust the new object directly, but rather make a copy
    let updatedUserObject
    users = users.map(user => {
      if(user.id === loginId){
        updatedUserObject = {...user, socketId: socket.id}
        return updatedUserObject
      } else {
        return user
      }
    })
    //tells client that the user was found
    socket.emit("successfulLogin", updatedUserObject)
    console.log(`${updatedUserObject.username} just logged back in`);
    //broadcasts to other clients to say "hey this user is now logged in"
    socket.broadcast.emit("newLogin", updatedUserObject)
    //sends information to client, except the users array will not include the user themself
    socket.emit("allUsers", users.filter(user => user.id !== loginId))
    socket.emit("allMessages", messages)
  })

  socket.on("disconnect", () => {

    //emit the logout of the user by sending the id of the disconnected socket

    //perform the inverse of login here, setting socketId to null:
    console.log(typeof(socket.id));
    users = users.map(user => {
      if(user.socketId === socket.id){
        socket.broadcast.emit("userLogout", user)
        console.log(`${user.username} has disconnected, current users:`, users);
        return {...user, socketId: null}
      } else {
        return user
      }
    })

  });

  socket.on("sentMessage", (message) => {
    console.log("We just got a message!", message)
    let user = users.find(user => user.socketId === socket.id)
    let messageObj = {userId: user.id, message}
    messages.push(messageObj)
    io.emit("newMessage", messageObj)
  })

  //all WebRTC peer connection communication:

  socket.on("offer", (watcherSocketId, description) => {
    console.log(description);
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
