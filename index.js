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
      io.to("/leaderboard").emit("loadlb", lbdata);      
    }));    
    socket.on("loadchallenge", Q.async(function*(data) {
      var lbdata = yield chatDb.loadLB(data);    
      //console.log("loadchallenge " + lbdata.length);
      //io.to(joinedRoom).emit("loadchallenge", lbdata);
      if(joinedRoom == "/pair")
      	  io.to(joinedRoom).emit("loadchallenge", lbdata);
      else
      	  io.to("/page5").emit("loadchallenge", lbdata);
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
      console.log("data question: " + data.question);

      var updateteam = 0;
      var user_highscore = 0;
      var score_diff = 0;
      var score = parseInt(data.score);
      if(highscore == "undefined" || highscore.length == 0) {
		  var answerdata = {
			username: socket.username,
			day: data.day,
			question: data.question,
			answer: 1,
			points: score,
			status: true,
			time: new Date()
		  };
		  yield chatDb.addAnswer(answerdata);
      	  updateteam = 1;
      } else if(highscore[0].points < score) {
      	  user_highscore = highscore[0].points;
      	  yield chatDb.updateScore(socket.username, data);
      	  updateteam = 1;
      } else {
      	  console.log("highscore1: " + highscore[0].points);
      	  //do nothing!
      }
      
      if(updateteam === 1) {
      	  // for team, make username= "team"+teamId, answer=2 
      	  var team_username = "team"+data.userteamId;
      	  var teamscore = yield chatDb.getAnswer(team_username, data);
      	  score_diff = score - user_highscore;
      	  console.log("Adding points for " + team_username + " - " + score_diff);
      	  
      	  if(teamscore == "undefined" || teamscore.length == 0) {
      	  	  console.log("No record found, adding as new ");
      	  	  var answerdata = {
      	  	  	  username: team_username,
      	  	  	  teamname: data.userteamName,
      	  	  	  day: data.day,
      	  	  	  question: data.question,
      	  	  	  answer: 2,
      	  	  	  points: score,
      	  	  	  status: true,
      	  	  	  time: new Date()
      	  	  };
      	  	  
      	  	  yield chatDb.addAnswer(answerdata);
      	  	  yield chatDb.updateUserpoints(socket.username, score);
      	  	  
      	  } else if(score_diff > 0) {
      	  	  data.score = teamscore[0].points + score_diff;
      	  	  yield chatDb.updateScore(team_username, data);
      	  	  yield chatDb.updateUserpoints(socket.username, score_diff);
      	  } else {
      	  	  console.log("Error! Score_diff is less than 0! " + data.score + " - " + user_highscore);
      	  	  //do nothing!
      	  }      	  
      }
      
      var question = parseInt(data.question);
      console.log(question);
      if(question == 2) {
      	  var data = {score:score, diff:score_diff, team:updateteam};
      	  var answerUser = usernames[socket.username];
      	  answerUser.emit("updatescore", data);
      }
    }));
    
    socket.on("updateteamname", Q.async(function*(data) {
      yield chatDb.updateTeamname(data);

      yield chatDb.updateTeamnameInChallengeTeam1(data);
      yield chatDb.updateTeamnameInChallengeTeam2(data);
      
      var userteam = "team" + data.userteamId;
      var teamdata = {userteamId:userteam, teamname:data.teamname};
      
      //console.log("teamdata: " + teamdata.userteamId + ", " + teamdata.teamname);
      yield chatDb.updateTeamnameInAnswers(teamdata);
      
      var answerUser = usernames[socket.username];
      answerUser.emit("updateteamname", data.teamname);

    }));
    socket.on("getteam", Q.async(function*(data) {
      var teamusers = yield chatDb.getTeam(data);

      var answerUser = usernames[socket.username];
      answerUser.emit("getteam", teamusers);

    }));
    socket.on("checkteamanswers", Q.async(function*(data) {
      
      //console.log("checkteamanswers: " + data.userteamId);
      var teamusers = yield chatDb.getTeam(data);

      var answerlist=[];
      for(var i in teamusers) {
      	var getAnswer = yield chatDb.getAnswer(teamusers[i].username, data);
      	//if(getAnswer[0])
      	answerlist.push(getAnswer[0]);
      	//console.log("user: " + teamusers[i].username + ", answer: " + getAnswer[0]);
      };

      var answerUser = usernames[socket.username];
      answerUser.emit("checkteamanswers", answerlist);

    }));
    
    socket.on("checkteamscore", Q.async(function*(data) {
      
      var teamusername = "team" + data.userteamId;
      var teamScore = yield chatDb.getTeamScore(teamusername, data);

      var answerUser = usernames[socket.username];
      answerUser.emit("checkteamscore", teamScore[0], data);

    }));    
    socket.on("checkmenu", Q.async(function*() {
      var step = 0;
      
      var menustep = yield chatDb.getMenu("menu");
      if(menustep != null)
      	  step = menustep.day;
      
      console.log("step now: " + step + ", " + menustep.day);
      var answerUser = usernames[socket.username];
      answerUser.emit("checkmenu", step);

    }));     
    
    socket.on("new challenge", Q.async(function*(data) {
    		
    	var teamdata = {userteamId:data.team1} 
    	var team1 = yield chatDb.getTeam(teamdata);
    	var team1name = team1[0].teamName;

    	teamdata = {userteamId:data.team2} 
    	var team2 = yield chatDb.getTeam(teamdata);
    	var team2name = team2[0].teamName;
    	
		  var challengedata1 = {
			team1: data.team1,
			team1name: team1name,
			team2: data.team2,
			team2name: team2name,
			round: data.round,
			win: 0,
			primary: true,
			status: true,
			time: new Date()
		  };
		  yield chatDb.addChallenge(challengedata1);
		  
		  var challengedata2 = {
			team1: data.team2,
			team1name: team2name,
			team2: data.team1,
			team2name: team1name,
			round: data.round,
			win: 0,
			primary: false,
			status: true,
			time: new Date()
		  };		  
		  yield chatDb.addChallenge(challengedata2);
		  
      var answerUser = usernames[socket.username];
      answerUser.emit("new challenge");
		  
    }));
    
    socket.on("checkteampairs", Q.async(function*(round) {
      
      var allteams;
      if(round > 1) {
      	  allteams = yield chatDb.getWinnerTeamChallenge(round-1);
      } else {
      	  allteams = yield chatDb.getAllTeams();
      }

      var pairedlist=[];
      var unpairedlist=[];

      var challenge; 
      
      console.log("allteams: " + allteams.length + ", round: " + round); 
	  for(var i in allteams) {
		if(round > 1) 
			var data = {teamid:allteams[i].team1, round:round}
		else
			var data = {teamid:allteams[i].teamId, round:round}
		
		challenge = yield chatDb.getChallenge(data);
		//console.log("challenge: " + challenge.length);
		if (challenge == null) {
			unpairedlist.push(allteams[i]);
		} else {
			pairedlist.push(challenge);
		}
	  };
     
      console.log("pairedlist: " + pairedlist.length + ", unpairedlist: " + unpairedlist.length);
      var answerUser = usernames[socket.username];
      answerUser.emit("checkteampairs", pairedlist, unpairedlist, round);

    }));    
    socket.on("checkteamchallenge", Q.async(function*(round) {
      
      var teamchallenge = yield chatDb.getTeamChallenge(round);

      console.log("teamchallenge " + teamchallenge.length);
      var answerUser = usernames[socket.username];
      answerUser.emit("checkteamchallenge", teamchallenge, round);

    }));        
    socket.on("updatequiz", Q.async(function*(data) {
      
      var teamchallenge = yield chatDb.getTeamChallenge(round);

      console.log("teamchallenge " + teamchallenge.length);
      var answerUser = usernames[socket.username];
      answerUser.emit("checkteamchallenge", teamchallenge, round);

    }));            
    socket.on("updatemenu", Q.async(function*(step) {
      yield chatDb.updateMenu(step);
      var answerUser = usernames[socket.username];
      answerUser.emit("updatemenu");

    }));    
    socket.on("closeround", Q.async(function*(round) {
      var day = 5;
      if(round == 2)
      	  day = 6;
      
      var teams = yield chatDb.getTeamChallenge(round);
      console.log("total paired teams " + teams.length);
      var wincount = 0;
      var team1score = team2score = 0;
      for(var i=0; i<teams.length; i++) {
      	  console.log("team1: " + teams[i].team1 + ", team2: " + teams[i].team2);
      	  var team1score = team2score = 0;
      	  if(teams[i].win == 0) {
			  var team1 = "team" + teams[i].team1;
			  var data = {day:day,question:1}
			  var team1answer = yield chatDb.getAnswer(team1, data);
			  if(team1answer[0] != null)
			  	  team1score = team1answer[0].points;
			  console.log("team1score: " + team1score);
			  
			  var team2 = "team" + teams[i].team2;
			  var data = {day:day,question:1}
			  var team2answer = yield chatDb.getAnswer(team2, data);
			  if(team2answer[0] != null)
			  	  team2score = team2answer[0].points;  
			  console.log("team2score: " + team2score);
			  
			  var winner = 0;
			  if(team1score > team2score) {
				  winner = teams[i].team1;
			  } else if (team2score > team1score){
				  winner = teams[i].team2;
			  }
			  if(winner > 0) { 
			  	  console.log("team1: " + teams[i].team1 + ", winner: " + winner);
			  	  yield chatDb.updateTeamChallenge(teams[i].team1, winner, round);
			  	  wincount++;
			  } 
		  }
	  }
	  
	  console.log("wincount: " + wincount);
	  var answerUser = usernames[socket.username];
	  answerUser.emit("closeround", round, wincount);	  
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
        if(data.day == 0) {
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
