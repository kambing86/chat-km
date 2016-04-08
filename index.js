(function() {
  var winston = require("winston");
  GLOBAL.logger = new(winston.Logger)({
    transports: [
      new(winston.transports.Console)({
        name: "info",
        timestamp: true,
        level: "info"
      }),
      new(winston.transports.File)({
        name: "error",
        timestamp: true,
        filename: "./logs/error.log",
        maxsize: 10240,
        level: "error"
      })
    ]
  });
})();

var cluster = require("cluster");
if (cluster.isMaster) {
  if (process.env.IP == null) process.env.IP = "localhost";
  cluster.fork();
  cluster.on("exit", function(_worker, code, signal) {
    logger.error("Worker " + _worker.process.pid + " died with code: " + code + ", and signal: " + signal);
    logger.info("Starting a new worker");
    cluster.fork();
  });
} else {
  var Q = require("q");
  var chatDb = require("./chat.db");
  var io;

  // init
  (function() {
    var express = require("express");
    var app = express();
    var upload = require("multer")({
      dest: "uploads/"
    });
    var server = require("http").createServer(app);
    io = require("socket.io")(server);
    var port = process.env.PORT || 3333;

    server.listen(port, function() {
      logger.info("Server listening at port %d", port);
    });

    app.use(express.static("./client"));

    var uploadTask = Q.async(function*(req, res) {
      var csvReader = require("./csv.reader");
      var userArray = yield csvReader.readCsv(req.file.path);
      yield chatDb.addUsers(userArray);
      return res;
    });

    app.post("/admin/upload", upload.single("upload"), function(req, res) {
      uploadTask(req, res).then(function(res) {
        res.send(true);
      }).catch(function(error) {
        logger.error(error);
        res.send(false);
      });
    });
  })();

  var usernames = {};
  var rooms = {};
  var usersOnProfile = {};
  var usersOnComments = {};
  var banUsernames = [];
  var generalRoom = "General Room";
  var commentsPage = "#commentsPage";
  var adminSocket = null;

  io.on("connection", function(socket) {
    var userId = null;
    var addedUser = false;
    var isAdmin = false;
    var joinedRoom = null;

    // check if already logged in
    socket.on("checklogin", Q.async(function*(username, reconnect) {

      var getUser = yield chatDb.getUserId(username);
      if (getUser == null) {
        socket.emit("username not exists");
        return;
      } else if (usernames[username] == null) {
        socket.emit("dologin", {username});
        return;
      } else {

      	var oldUser = usernames[username];
        delete usernames[username];
        oldUser.emit("forcelogout");
        oldUser.disconnect();

        socket.emit("dologin", {username});
        //socket.emit("already login", username);
        return;
      }
    }));

    // login
    socket.on("login", Q.async(function*(username, roomName) {
      if (usernames[username] != null) {
      	var oldUser = usernames[username];
        delete usernames[username];
        oldUser.emit("forcelogout");
        oldUser.disconnect();

        socket.emit("dologin", {username});
        //socket.emit("already login", username);
        return;
      }
      if (banUsernames.indexOf(username) != -1) {
        socket.emit("already ban");
        return;
      }
      //var getUser = yield chatDb.getUserId(username);
      var getUser = yield chatDb.getUser(username);
      if (getUser == null) {
        socket.emit("username not exists");
        return;
      }
      yield chatDb.updateUserLogintime(username);

      var dow = 1;
      console.log("roomName: " + roomName);
      var data = {
        roomName: roomName,
        dow: dow
      }

      socket.emit("login", getUser, data);

      userId = getUser._id;
      socket.username = username;
      usernames[username] = socket;
      addedUser = true;
      if (roomName == null)
        roomName = generalRoom;
      yield joinRoom(roomName);

      socket.emit("history", yield chatDb.getHistory(joinedRoom, 0, 0, 5));
      if (adminSocket)
        adminSocket.emit("admin user joined", {
          username: socket.username,
          users: rooms[joinedRoom].users
        });
      
      /*
      var isadmin = false;
      if(username == "admin1@dbs.com" || username == "admin2@dbs.com" || username == "admin3@dbs.com" || username == "admin4@dbs.com" || username == "admin5@dbs.com")
      	  isadmin = true;

      var d = new Date();
      d.setHours(d.getHours() + 8);

      var dow = d.getDay();
      if(dow == 0 || dow == 6)
      	  dow = 1;
      dow=3;

      socket.emit("login", {
        _id: userId,
        roomName: roomName,
        isAdmin: isadmin,
        dow: dow,
        rooms: yield chatDb.getRoomList()
      });
      socket.emit("history", yield chatDb.getHistory(joinedRoom, 0, 0, 5));
      if (adminSocket)
        adminSocket.emit("admin user joined", {
          username: socket.username,
          users: rooms[joinedRoom].users
        });

      */
    }));

    socket.on("gettotalmessage", Q.async(function*(roomName) {
      socket.emit("gettotalmessage", yield chatDb.getTotalMessage(roomName));
    }));

    socket.on("refreshlist", Q.async(function*(roomName, sortbylike) {
      socket.emit("history", yield chatDb.getHistory(roomName, sortbylike, 0, 5));
    }));

    socket.on("loadprevious", Q.async(function*(roomName, sortbylike, messagecount) {
      socket.emit("history", yield chatDb.getHistory(roomName, sortbylike, messagecount, 5));
    }));

    socket.on("loadmostlikes", Q.async(function*(roomName) {
      socket.emit("history", yield chatDb.getHistory(roomName, 1, 0, 5));
    }));

    socket.on("loadhistory", Q.async(function*(roomName) {
      socket.emit("history", yield chatDb.getHistory(roomName, 0, 0, 5));
    }));

    // when the user disconnects.. perform this
    socket.on("disconnect", function() {
      // remove the username from global usernames list
      if (addedUser) {
        if (usernames[socket.username])
          delete usernames[socket.username];
        if (adminSocket)
          adminSocket.emit("admin user left", {
            username: socket.username,
            users: rooms[joinedRoom].users
          });
        leaveRoom();
      }
      if (isAdmin)
        adminSocket = null;
    });

    var refreshRoomList = Q.async(function*() {
      io.emit("room list", yield chatDb.getRoomList());
    });

    var joinRoom = Q.async(function*(roomName) {
      leaveRoom();
      joinedRoom = roomName;
      yield chatDb.addRoom(joinedRoom);
      if (rooms[roomName] == null) {
        rooms[roomName] = {
          users: {}
        };
        yield refreshRoomList();
      }
      rooms[joinedRoom].users[socket.username] = true;
      socket.join(joinedRoom);
      socket.broadcast.to(joinedRoom).emit("user joined", {
        username: socket.username,
        users: rooms[joinedRoom].users
      });
    });

    function leaveRoom() {
      if (joinedRoom == null) return;
      socket.leave(joinedRoom);
      if (rooms[joinedRoom] != null) {
        delete rooms[joinedRoom].users[socket.username];
        if (joinedRoom != generalRoom && Object.keys(rooms[joinedRoom].users).length == 0)
          delete rooms[joinedRoom];
      }
/*
      socket.broadcast.to(joinedRoom).emit("user left", {
        username: socket.username,
        users: rooms[joinedRoom].users
      });
*/
    }

    // when the client emits "new message", this listens and executes
    socket.on("new message", Q.async(function*(data, roomName, givepoints) {
      // we tell the client to execute "new message"
      
      console.log("roomName: " + roomName);
      if(roomName == null)
      	  roomName = joinedRoom;
      if(givepoints == null)
      	  givepoints = 0;

      console.log("roomName: " + roomName);
      var msg = {
        username: socket.username,
        msg: data,
        room: roomName,
        time: new Date(),
        likes: [],
        likesCount: 0,
        lastLikeDate: null
      };
      yield chatDb.addChat(msg);

      if(givepoints > 0)
        yield chatDb.updateUserpoints(socket.username, givepoints);

      io.to(joinedRoom).emit("new message", msg, givepoints);
    }));

    // when the client emits "typing", we broadcast it to others
    socket.on("typing", function() {
      socket.broadcast.to(joinedRoom).emit("typing", {
        username: socket.username
      });
    });

    // when the client emits "stop typing", we broadcast it to others
    socket.on("stop typing", function() {
      socket.broadcast.to(joinedRoom).emit("stop typing", {
        username: socket.username
      });
    });

    // private message
    socket.on("pm", function(data) {
      var message = data.msg;
      var to = data.to;
      var receiver = usernames[to];
      if (receiver == null) {
        socket.emit("pm fail");
        return;
      }
      var pm = {
        from: socket.username,
        to: to,
        msg: message
      };
      receiver.emit("pm", pm);
    });

    socket.on("search", Q.async(function*(msg) {
      socket.emit("search", yield chatDb.searchChat(joinedRoom, msg));
    }));

    socket.on("create room", Q.async(function*(roomName) {
      if (joinedRoom == roomName || commentsPage == roomName || (yield chatDb.roomExists(roomName)) == 1) {
        socket.emit("room existed", roomName);
        return;
      }
      yield joinRoomAfterLogin(roomName);
    }));

    var joinRoomAfterLogin = Q.async(function*(roomName) {
      if (joinedRoom == roomName) {
        socket.emit("already joined", roomName);
        return;
      }
      yield joinRoom(roomName);
      socket.emit("join room", {
        users: rooms[joinedRoom].users,
        roomName: roomName
      });
      socket.emit("history", yield chatDb.getHistory(joinedRoom, 0, 0, 5));
    });

    socket.on("join room", joinRoomAfterLogin);

    var sendProfile = Q.async(function*(username) {
      if (usersOnProfile[username])
        usersOnProfile[username].emit("profile", yield chatDb.getUser(username), yield chatDb.getUserChats(username));
    });

    var sendProfileUpdate = Q.async(function*(username, chatId) {
      if (usersOnProfile[username])
      usersOnProfile[username].emit("profile", yield chatDb.getUser(username), yield chatDb.getChat(chatId));
    });

    var sendCommentsStat = Q.async(function*() {
      if (Object.keys(usersOnComments).length == 0) return;
      var task1 = chatDb.getRecentLikeComments();
      var task2 = chatDb.getMostLikeComments();
      io.to(commentsPage).emit("comments", yield task1, yield task2);
    });

    socket.on("like", Q.async(function*(chatId) {
      var chat = yield chatDb.likeChat(userId, chatId);
      io.to(joinedRoom).emit("like", chatId, chat.likes);
      yield sendProfileUpdate(chat.username, chatId);
      yield sendCommentsStat();
    }));

    socket.on("unlike", Q.async(function*(chatId) {
      var chat = yield chatDb.unlikeChat(userId, chatId);
      io.to(joinedRoom).emit("unlike", chatId, chat.likes);
      yield sendProfileUpdate(chat.username, chatId);
      yield sendCommentsStat();
    }));

    socket.on("updatemenuprofile", Q.async(function*(username) {
      var user = usernames[username];
      //var username = socket.username;
      //usersOnProfile[username] = socket;
      user.emit("updatemenuprofile", yield chatDb.getUser(username));
    }));

    socket.on("on profile", Q.async(function*() {
      var username = socket.username;
      usersOnProfile[username] = socket;
      sendProfile(username);
    }));

    socket.on("off profile", Q.async(function*() {
      var username = socket.username;
      if (usersOnProfile[username])
        delete usersOnProfile[username];
    }));

    socket.on("on comments", Q.async(function*() {
      socket.join(commentsPage);
      usersOnComments[socket.username] = true;
      sendCommentsStat();
    }));

    socket.on("off comments", Q.async(function*() {
      socket.leave(commentsPage);
      if (usersOnComments[socket.username])
        delete usersOnComments[socket.username];
    }));

    //admin function
    socket.on("admin login", function(password) {
      if (adminSocket == null && password == "123456") {
        isAdmin = true;
        adminSocket = socket;
        socket.emit("admin login", Object.keys(usernames));
      } else
        socket.emit("admin fail");
    });

    socket.on("ban", function(user) {
      if (!isAdmin) {
        socket.emit("admin fail");
        socket.disconnect();
        return;
      }
      var banUser = usernames[user];
      if (banUser == null) return;
      banUsernames.push(user);
      banUser.emit("ban");
      banUser.disconnect();
    });

    socket.on("checkpoll", Q.async(function*(data) {
      var getAnswer = yield chatDb.getAnswer(socket.username, data);
      var answerUser = usernames[socket.username];
      answerUser.emit("checkpoll", getAnswer[0]);
    }));
    
    socket.on("loadlb", Q.async(function*(data) {
      var lbdata = yield chatDb.loadLB(data);    
      //console.log("lbdata " + lbdata.length);
      //var answerUser = usernames[socket.username];
      //answerUser.emit("loadlb", lbdata);
      io.to("/leaderboard").emit("loadlb", lbdata);      
    }));    
    
    socket.on("gethighscore", Q.async(function*(data) {
      console.log("gethighscore: " + data.day + ", " + data.question + ", " + socket.username);
      var highscore = yield chatDb.getAnswer(socket.username, data);
      console.log("highscore: " + highscore[0].points);
      var answerUser = usernames[socket.username];
      answerUser.emit("gethighscore", highscore[0]);      
    }));        
    
    socket.on("updatescore", Q.async(function*(data) {
      var highscore = yield chatDb.getAnswer(socket.username, data);
      console.log("highscore: " + highscore + ", len " + highscore.length);
      
      var updateteam = 0;
      if(highscore == "undefined" || highscore.length == 0) {
		  var answerdata = {
			username: socket.username,
			day: data.day,
			question: data.question,
			answer: 1,
			points: data.score,
			status: true,
			time: new Date()
		  };
		  yield chatDb.addAnswer(answerdata);
      	  updateteam = 1;
      } else if(highscore[0].points < data.score) {
      	  console.log("highscore0: " + highscore[0].points);
      	  console.log("data.score: " + data.score);
      	  yield chatDb.updateScore(socket.username, data);
      	  updateteam = 1;
      } else {
      	  console.log("highscore1: " + highscore[0].points);
      	  //do nothing!
      }
      
      if(updateteam === 1) {
      	  
      }
    }));    
    socket.on("updateteamname", Q.async(function*(data) {
      yield chatDb.updateTeamname(data);

      var answerUser = usernames[socket.username];
      answerUser.emit("updateteamname", data.teamname);

    }));
    socket.on("getteam", Q.async(function*(data) {
      var teamusers = yield chatDb.getTeam(data);

      var answerUser = usernames[socket.username];
      answerUser.emit("getteam", teamusers);

    }));
    socket.on("checkteamanswers", Q.async(function*(data) {
      console.log("checkteamanswers: " + data.userteamId);
      var teamusers = yield chatDb.getTeam(data);

      var answerlist=[];
      for(var i in teamusers) {
      	var getAnswer = yield chatDb.getAnswer(teamusers[i].username, data);
      	//if(getAnswer[0])
      	answerlist.push(getAnswer[0]);
      	console.log("user: " + teamusers[i].username + ", answer: " + getAnswer[0]);
      };

      var answerUser = usernames[socket.username];
      answerUser.emit("checkteamanswers", answerlist);

    }));

    socket.on("getpollresults", Q.async(function*(data) {
      //logger.info("getpoolresults! " + data.day + ", " + data.question);
      var getResults1 = yield chatDb.getPollResults(data,1);
      var getResults2 = yield chatDb.getPollResults(data,2);
      var getResults3 = yield chatDb.getPollResults(data,3);
      var getResults4 = yield chatDb.getPollResults(data,4);
      //logger.info("getpoolresults2! " + getResults1);

      //io.to(joinedRoom).emit("getpollresults", getResults1, getResults2, getResults3, getResults4);
      var answerUser = usernames[socket.username];
      answerUser.emit("getpollresults", getResults1, getResults2, getResults3, getResults4);
    }));

    socket.on("new answer", Q.async(function*(data) {

      var correctanswer = false;
      var getAnswer = yield chatDb.getAnswer(socket.username, data);

      if (getAnswer.length == 0) {
        // it is a poll, all answers are correct!
        if(data.day == 1) {
	  correctanswer = true;

        } else if (data.day == 2) {
	  if(data.question == 1 || data.question == 2)
	  	correctanswer = true;
	  else if(data.question == 3 && data.answer == 2)
	  	correctanswer = true;
	  else if(data.question == 4 && data.answer == 1)
	  	correctanswer = true;

        } else if (data.day == 3) {
	  if(data.question == 1 || data.question == 2)
	  	correctanswer = true;
	  else if(data.question == 3 && data.answer == 2)
	  	correctanswer = true;

        } else if (data.day == 4) {
	  if(data.question == 1 || data.question == 2)
	  	correctanswer = true;
	  else if(data.question == 3 && data.answer == 3)
	  	correctanswer = true;

        } else if (data.day == 5) {
	  if(data.question == 1)
	  	correctanswer = true;
	  else if(data.question == 2 && data.answer == 2)
	  	correctanswer = true;
	  else if(data.question == 3 && data.answer == 1)
	  	correctanswer = true;

        } else if (data.day == 6) {
	  	correctanswer = true;
	}
      }

      var answerdata = {
        username: socket.username,
        day: data.day,
        question: data.question,
        answer: data.answer,
        points: data.points,
        status: correctanswer,
        time: new Date()
      };

      //if(correctanswer == true) {
	/*
        if(data.day == 1 && data.question == 2)
        	yield chatDb.updateAnswer(answerdata);
	else
	*/
      yield chatDb.addAnswer(answerdata);

      if(correctanswer == true) {
        yield chatDb.updateUserpoints(socket.username, answerdata.points);
      }

      if (getAnswer.length > 0) {
	if(getAnswer[0].answer == data.answer)
		answerdata.status = true;
	else
		answerdata.status = false;
	answerdata.points = 0;
      }

      //io.to(joinedRoom).emit("new answer", answerdata);
      var answerUser = usernames[socket.username];
      answerUser.emit("new answer", answerdata);
    }));
  });
}
