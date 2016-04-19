$(function() {
  var $window = $(window);
  var sideBar = new MobileSideBar();
  var FADE_TIME = 150; // ms
  var TYPING_TIMER_LENGTH = 400; // ms
  var COLORS = [
    "#FF491D", "#C88F46", "#F8A700", "#B8F14D",
    "#2ADC00", "#4DF0F1", "#4DF181", "#52ECC8",
    "#3BB9EB", "#9579FF", "#FF64FF", "#F1DE4D"
  ];
  var daysarray = ["day1", "day2", "day3", "day4", "day5"];

  var username, userteamName, userId, joinedRoom, onProfile = false, onComments = false;
  var userteamId = 0;
  var usertype = 0;
  var sortbylike=false;
  var stopBlinking=false;
  var reconnect_count=0;

  var socket = io();

  var localusername = getCookie("username");
  //var localusertype = getCookie("usertype");
  //var localuserteamId = getCookie("userteamId");
  var currentLoc = window.location.pathname;
  var viewingLB = 1;

/*
  if( currentLoc == "/menu.html") {
    var blinking = getCookie("blinking");
    if(blinking == 1) {
	stopBlinking = true;
    } else {
	stopBlinking = false;
    	setCookie("blinking", 1, 5);
	setTimeout(function() { stopBlinking = true; }, 10000);
	blink("#mark");
  	$("#mark").on("click", function() {
        	stopBlinking = true;
        	$("#mark").hide();
  	});
    }
  }
*/

  if( currentLoc == "/login.html") {
        //do nothing
        localusername = "";
	document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
  } else if(!localusername && currentLoc!="/login.html" && currentLoc != "/user.html") {
	window.location = "login.html";
  } else if ( localusername ) {
	//console.log("checklogin: " + localusername);
        socket.emit("checklogin", localusername, 0);
  }

  var $userArea = $("#sidebar-wrapper-right ul.sidebar-nav");

  var typing = false;
  var lastTypingTime;
  var $inputMessage = $(".inputMessage");
  $inputMessage.on("input", function() {
    if (!typing) {
      typing = true;
      //socket.emit("typing");
    }
    lastTypingTime = (new Date()).getTime();

    setTimeout(function() {
      var typingTimer = (new Date()).getTime();
      var timeDiff = typingTimer - lastTypingTime;
      if (timeDiff >= TYPING_TIMER_LENGTH && typing) {
        //socket.emit("stop typing");
        typing = false;
      }
    }, TYPING_TIMER_LENGTH);
  }).on("keydown", function(event) {
    if (event.which === 13) {
      sendMessage("inputMessage",joinedRoom);
      //socket.emit("stop typing");
      typing = false;
      return;
    }
  });
  var $submitComment = $("#submitComment");
  
  $submitComment.on("click", function() {
	//console.log("Comment clicked " + joinedRoom);
      sendMessage("inputComment",joinedRoom);
      //socket.emit("stop typing");
      typing = false;
      return;
  });
  var $messages = $(".messages");
  var $roomlist = $(".roomlist");

  function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
  }

  function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
    }
    return "";
  }

  function alertBox(msg, options) {
    options = options || {};
    $("#alertbox").html(msg); 
    $("#sm-alertbox").modal("show"); 
    if(options.reload == true) {
      $('#sm-alertbox').on('hidden.bs.modal', function (e) {
        location.reload(true);
      })
    } else if(options.relogin == true) {
      $('#sm-alertbox').on('hidden.bs.modal', function (e) {
        window.location = "login.html";
      })
    } else if(options.gomenu == true) {
      $('#sm-alertbox').on('hidden.bs.modal', function (e) {
        window.location = "menu.html";
      })
    } else if(options.goback == true) {
      $('#sm-alertbox').on('hidden.bs.modal', function (e) {
        window.history.back();
      })
    }
    
  }

  function blink(selector) {
    if (stopBlinking) {
	$("#mark").hide();
    } else {
	$("#mark").show();
    }
/*
    if (!stopBlinking) {
      $(selector).delay(500).fadeIn('fast', function() {
        $(this).delay(2000).fadeOut('fast', function() {
            if (!stopBlinking)
            {
                blink(this);
            }
            else
            {
                $(this).hide();
            }
        });
      });
   }
*/
  }


  function setUsername() {

    //console.log(localusername);
    if(localusername && localusername.length > 0)
    	username = localusername;
    else
    	username = cleanInput($(".usernameInput").val().trim());

    if (username && validateEmail(username)) {
      var hashArray = location.hash.split("@");
      var room = null;
      if (hashArray.length > 1)
        room = decodeURI(hashArray[1]);

      var dayRoom = window.location.pathname.split(".html");
      dayRoom = dayRoom[0];

      //console.log("socket emit login: " + username + ", room: " + dayRoom);
      socket.emit("login", username, dayRoom);

    } else {
      alertBox("Please enter a valid email");
      username = null;
      //sessionStorage.clear();
      document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    }
  }

  function validateEmail(email) {
    var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(email);
  }

  function addParticipants(data) {
    var message = "";
    var numUsers = Object.keys(data.users).length;
    if (data.numUsers === 1)
      message += "there's 1 participant";
    else
      message += "there are " + numUsers + " participants";
    log(message);
    var userData = "";
    for (var i in data.users)
      userData += "<li><a href='javascript:void(0)' onclick='whisper(event)'>" + i + "</a></li>";
    $userArea.html(userData);
  }

/*
  window.whisper = function(event) {
    if (event.target.innerHTML == username) return;
    location.hash = "#chat@" + encodeURI(joinedRoom);
    $window.hashchange();
    $inputMessage.val("/w " + event.target.innerHTML + " ").focus();
    sideBar.closeSidebar();
  };
*/

  function sendMessage(field, room) {
    var message = $("."+field).val();
    // Prevent markup from being injected into the message
    if(field == "inputMessage")
    	message = cleanInput(message);

    if(message.length == 0) {
	alertBox("Your message is empty");
	return;
    }
    if(message.length < 10) {
	alertBox("Please elaborate more.");
	return;
    }

    // if there is a non-empty message and a socket connection
    if (message) {
      $("."+field).val("");
      var matchPrivateMessage = /\/w ([^\s]+) (.+)/.exec(message);
      if (matchPrivateMessage != null) {
        if (matchPrivateMessage[1] == username) {
          alertBox("cannot private message yourself");
          return;
        }
        var data = {
          to: matchPrivateMessage[1],
          msg: matchPrivateMessage[2]
        };
        addChatMessage({
          username: username + " whisper to " + data.to,
          msg: data.msg
        });
        socket.emit("pm", {
          to: matchPrivateMessage[1],
          msg: matchPrivateMessage[2]
        });
        return;
      }
      var matchSearch = /\/search (.+)/.exec(message);
      if (matchSearch != null) {
        socket.emit("search", matchSearch[1]);
        return;
      }

      var givepoints = 0;
      if(room == "/ask" || room == "/haiku" || room == "/day2quiz" || room == "/day3quiz" || room == "/day4quiz" )
	givepoints = 10;
	
	//console.log("new message: " + message + ": " + room);
      socket.emit("new message", message, room, givepoints);
    }
  }

  // Log a message
  function log(message, options) {
    var $el = $("<li>").addClass("log").text(message);
    addMessageElement($el, options);
  }

  function showSearchMsg(message) {
    var $el = $("<li>").html(message);
    addMessageElement($el);
  }

  function likeMsg() {
    socket.emit("like", $(this).attr("id"));
  }

  function unlikeMsg() {
    socket.emit("unlike", $(this).attr("id"));
  }

  function makeLikeDiv($likeDiv, chatId, totalLikes, likeDone) {
    $likeDiv.empty();
    var $likeButton = $("<a class='red-text text-right' id='" + chatId + "' href='javascript:void(0)' data-likecount='" + totalLikes + "'>").text(likeDone ? "Unlike" : "Like");
    if (likeDone)
      $likeButton.click(unlikeMsg);
    else
      $likeButton.click(likeMsg);
    var $likeCount = $("<span class='black-text text-right'/>").text(totalLikes + ((totalLikes > 1) ? " likes" : " like"));
    $likeDiv.append($likeCount);
    $likeDiv.append("<br>");
    $likeDiv.append($likeButton);
  }

  function makeChatMessage(data, showUsername) {
    var m = moment(data.time);
    var displayDate = "";
    displayDate = m.fromNow();

    var roomDiv = "In <a class='red-text' href='"+data.room+".html'>"+data.room+".html</a> ";

    if(showUsername) {
    	var $usernameDiv = $("<span class='red-text'/>")
      		.text(data.username + " ");
    } else {
    	var $usernameDiv = roomDiv;
    }

    var $messageTs = $("<small class='grey-text'>").text(displayDate);

    var newmsg = data.msg.replace(/\n/g, "<br>");
    var $messageBodyDiv = $("<span class='messageBody black-text'/>")
      .html(newmsg);

    var $likeDiv = "";
    if (data.likes) {
      $likeDiv = $("<span style='float:right' class='likesDiv'/>");
      var totalLikes = Object.keys(data.likes).length;
      var likeDone = data.likes.indexOf(userId) != -1;
      makeLikeDiv($likeDiv, data._id, totalLikes, likeDone);
    }

    var numMessage = $(".profileChats div").length;
    var $messageDiv = "";

    if(numMessage % 2)
      $messageDiv = $("<div align='left' class='message panel-body grey'/>")
      .data("username", data.username)
      .append($usernameDiv, $messageTs, $likeDiv, "<br>", $messageBodyDiv);
    else
      $messageDiv = $("<div align='left' style='border:1px solid lightgrey' class='message panel-body white'/>")
      .data("username", data.username)
      .append($usernameDiv, $messageTs, $likeDiv, "<br>", $messageBodyDiv);

    return($messageDiv);
  }

  // Adds the visual chat message to the message list
  function addChatMessage(data, options) {
    // Don't fade the message in if there is an "X was typing"
    var $typingMessages = getTypingMessages(data);

    var m = moment(data.time);
    var displayDate = "";
    displayDate = m.fromNow();

    options = options || {};
    if ($typingMessages.length !== 0) {
      options.fade = false;
      $typingMessages.remove();
    }

/*
    var $usernameDiv = $("<span class='username'/>")
      .text(data.username)
      .css("color", getUsernameColor(data.username));
*/
    var $usernameDiv = $("<span class='black-text'/>")
      .html("<b>"+ data.username + "</b> ");

    var $messageTs = $("<small class='grey-text'>").text(displayDate);

    var newmsg = data.msg.replace(/\n/g, "<br>");
    var $messageBodyDiv = $("<span class='messageBody black-text'/>")
      .html(newmsg);

    var $likeDiv = "";
    if (data.likes) {
      $likeDiv = $("<span style='float:right' class='likesDiv'/>");
      var totalLikes = Object.keys(data.likes).length;
      var likeDone = data.likes.indexOf(userId) != -1;
      makeLikeDiv($likeDiv, data._id, totalLikes, likeDone);
    }

    var typingClass = data.typing ? "typing" : "";

    var numMessage = $(".messages div").length;
    var $messageDiv = "";

    if(numMessage % 2)
      $messageDiv = $("<div align='left' class='message panel-body grey'/>")
      .data("username", data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageTs, $likeDiv, "<br>", $messageBodyDiv);
    else
      $messageDiv = $("<div align='left' style='border:1px solid lightgrey' class='message panel-body white'/>")
      .data("username", data.username)
      .addClass(typingClass)
      .append($usernameDiv, $messageTs, $likeDiv, "<br>", $messageBodyDiv);


    addMessageElement($messageDiv, options);
  }

  // Adds the visual chat typing message
  function addChatTyping(data) {
    data.typing = true;
    data.msg = "is typing";
    addChatMessage(data);
  }

  // Removes the visual chat typing message
  function removeChatTyping(data) {
    getTypingMessages(data).fadeOut(function() {
      $(this).remove();
    });
  }

  // Adds a message element to the messages and scrolls to the bottom
  // el - The element to add as a message
  // options.fade - If the element should fade-in (default = true)
  // options.prepend - If the element should prepend
  //   all other messages (default = false)
  function addMessageElement(el, options) {
    var $el = $(el);

    // Setup default options
    if (!options) {
      options = {};
    }
    if (typeof options.fade === "undefined") {
      options.fade = true;
    }
    if (typeof options.prepend === "undefined") {
      options.prepend = false;
    }

    // Apply options
    if (options.fade) {
      $el.hide().fadeIn(FADE_TIME);
    }
    if (options.prepend) {
      $messages.prepend($el);
    } else {
      $messages.append($el);
    }
    $messages[0].scrollTop = $messages[0].scrollHeight;
  }

  // Prevents input from having injected markup
  function cleanInput(input) {
    return $("<div/>").text(input).text();
  }

  // Gets the "X is typing" messages of a user
  function getTypingMessages(data) {
    return $(".typing.message").filter(function() {
      return $(this).data("username") === data.username;
    });
  }

  // Gets the color of a username through our hash function
  function getUsernameColor(username) {
    // Compute hash code
    var hash = 7;
    for (var i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + (hash << 5) - hash;
    }
    // Calculate color
    var index = Math.abs(hash % COLORS.length);
    return COLORS[index];
  }

  // Socket events

  // Whenever the server emits "login", log the login message
  function toCorrectPage() {
    $messages.empty();

    if(currentLoc == "/login.html") {
      window.location = "instructions.html";
    } else if (currentLoc == "/") {
      window.location = "menu.html";
    }

    /*
    if(data.isAdmin == false ) {
    	if(currentLoc == "/day2.html" && data.dow < 2)
      		window.location = "menu.html";
    	if(currentLoc == "/day3.html" && data.dow < 3)
      		window.location = "menu.html";
    	if(currentLoc == "/day4.html" && data.dow < 4)
      		window.location = "menu.html";
    	if(currentLoc == "/day5.html" && data.dow < 5)
      		window.location = "menu.html";
    }

    if( currentLoc == "/feedback.html") {
        var answer1 = getCookie("feedback1");
        var answer2 = getCookie("feedback2");
        var answer3 = getCookie("feedback3");
        var answer4 = getCookie("feedback4");

        if(answer1==1 && answer2==1 && answer3==1 && answer4==1) {
                alertBox("Thank you for your visit! You have submitted feedback earlier. <br>You'll be redirect to main page.", {gomenu:true});
        } 
    }

    if( currentLoc == "/profile.html") {
        socket.emit("on profile");
        onProfile = true;
    } else {
        onProfile = false;
    }
    */
  }
  function toChatPage(data) {
    $messages.empty();
    joinedRoom = data.roomName;
    var message = "Welcome to " + joinedRoom;
    log(message, {
      prepend: true
    });
    //addParticipants(data);
    location.hash = "#chat@" + encodeURI(joinedRoom);
    $(window).hashchange();
    $inputMessage.focus();
    if (data.rooms)
      refreshRoomList(data.rooms);
  }

  socket.on("login", function(user, data) {
    setCookie("username", username, 1);

    $("#usernameSpan").text(username);
    //$fullpage.off("click").fadeOut();
    //$usernameInput.off("keydown");
    userId = user._id;
    usertype = user.userType;
    userteamId = parseInt(user.teamId);
    userteamName = user.teamName;
    //console.log("userId: " + userId);
    //console.log("username: " + username);
    //console.log("usertype: " + usertype);
    //console.log("userteamId: " + userteamId);
    //console.log("userteamName: " + userteamName);
    //console.log("joinedRoom: " + data.roomName);
    joinedRoom = data.roomName;

    /*
    var isAdmin = data.isAdmin;
    var dow = data.dow;
    
    if(isAdmin) {
	for(var i=0; i<=daysarray.length; i++) {
		var button = "#" + daysarray[i] + "button";
		$(button).removeAttr("disabled");
		var lock = "#" + daysarray[i] + "lock";
		$(lock).text("");
	}
    } else {
	for(var i=0; i<dow; i++) {
		var button = "#" + daysarray[i] + "button";
		$(button).removeAttr("disabled");
		var lock = "#" + daysarray[i] + "lock";
		$(lock).text("");
	}
    }

    if(username == "hello1@123.com")
      toChatPage(data);
    else
    */
    
    if(joinedRoom == "/page0") {
    	checkTeamAnswers(0,1);
    } else if(joinedRoom == "/page1") {
    	checkTeamScore(1,1);
    } else if(joinedRoom == "/page2") {
    	checkTeamScore(2,1); 
		var score = decodeURIComponent($.urlParam('score'));
		if(score.length > 0) {
			var data = Base64.decode(score);
			var dataarr = data.split(":");
			var uid = dataarr[0];
			var score = dataarr[1];
		
			updateQuiz(uid, score, 2, 2);
		}    	
    } else if(joinedRoom == "/page3") {
    	checkTeamScore(3,1); 
		var score = decodeURIComponent($.urlParam('score'));
		if(score.length > 0) {
			var data = Base64.decode(score);
			var dataarr = data.split(":");
			var uid = dataarr[0];
			var score = dataarr[1];
		
			updateQuiz(uid, score, 3, 2);
		} 
    } else if(joinedRoom == "/page4") {
    	checkTeamScore(4,1); 
		var score = decodeURIComponent($.urlParam('score'));
		if(score.length > 0) {
			var data = Base64.decode(score);
			var dataarr = data.split(":");
			var uid = dataarr[0];
			var score = dataarr[1];
		
			updateQuiz(uid, score, 4, 2);
		} 
    } else if(joinedRoom == "/page5") {
    	checkTeamChallenge(1);		
    } else if(joinedRoom == "/menu") {
    	checkMenu();
    } else if(joinedRoom == "/team") {
    	getTeam();    	
    } else if(joinedRoom == "/unbelievable") {
    	checkTeamScore(1,1);
    } else if(joinedRoom == "/game") {
    	var level = decodeURIComponent($.urlParam('level'));
    	getHighscore(level);
    } else if(joinedRoom == "/leaderboard") {
    	console.log("in leaderboard");
    	setTimeout(function(){loadLB(1,1,1);},500);
    } else if(joinedRoom == "/pair") {
    	checkTeamPairs(1);
    }     
    
      toCorrectPage();

  });

  //socket.on("join room", toChatPage);
  socket.on("join room", function(data) {
    $messages.empty();
  });

  socket.on("username not exists", function() {
    alertBox("Invalid email address. Please try again!");
  });

  socket.on("already joined", function(roomName) {
    alertBox("already joined " + roomName);
  });

  // Whenever the server emits "new message", update the chat body
  socket.on("new message", function(data, givepoints) {
  		  
  	//console.log("data.room: ", data.room);
  	//console.log("joinedRoom: ", joinedRoom);
    if(data.room == joinedRoom) {
	if(data.username == username) {
		if(givepoints>0)
			alertBox("Thank you, you've earned " + givepoints + " points.");
	}
    	addChatMessage(data, {prepend:true});
    } else if(data.room == "/ask") {
	if(data.username == username) {
		alertBox("Thank you, your question has been submitted. <br>You've earned " + givepoints + " points.");
		$("#day1submitask").val('');
	}
    } else if(data.room == "/day2quiz") {
	if(data.username == username) {
		alertBox("Thank you for your submission. <br>You've earned " + givepoints + " points.");
		$("#day2submitquiz").val('');
	}
    } else if(data.room == "/day3quiz") {
	if(data.username == username) {
		alertBox("Thank you for your submission. <br>You've earned " + givepoints + " points.");
		$("#day3submitquiz").val('');
	}
    } else if(data.room == "/day4quiz") {

	if(data.username == username) {
		alertBox("Thank you for your submission. <br>You've earned " + givepoints + " points.");
		$("#day4submitquiz").val('');
	}
    } else if(data.room == "/fbquestion3") {
	if(data.username == username) {
                setCookie("feedback3", 1, 10);
		fbsubmitq4();
		processAnswer(data);
	}
    } else if(data.room == "/fbquestion4") {
	if(data.username == username) {
                setCookie("feedback4", 1, 10);
		showThankyou();
		processAnswer(data);
	}
    }
  });

  // Whenever the server emits "user joined", log it in the chat body
  socket.on("user joined", function(data) {
    //log(data.username + " joined");
    //addParticipants(data);
  });

  // Whenever the server emits "user left", log it in the chat body
  socket.on("user left", function(data) {
    //log(data.username + " left");
    //addParticipants(data);
    removeChatTyping(data);
  });

  socket.on("room existed", function() {
    alertBox("room existed");
  });

  // Whenever the server emits "typing", show the typing message
  socket.on("typing", function(data) {
    addChatTyping(data);
  });

  // Whenever the server emits "stop typing", kill the typing message
  socket.on("stop typing", removeChatTyping);

  socket.on("dologin", function(data) { 
	//console.log("dologin: " + data.username);
    	setUsername( data.username );
  });

  socket.on("already login", function(name) {
    alertBox("You <b>("+name+")</b> have logged on another browser. Please try again.");
    username = null;
  });

  socket.on("forcelogout", function() {
	var displayname = username;
    	username = null;
    	document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
    	alertBox("You <b>("+displayname+")</b> have been logged out. Please sign in again.", {relogin:true});
  });

  socket.on("already ban", function() {
    alertBox("already ban");
    username = null;
  });

  socket.on("ban", function() {
    alertBox("being ban");
  });

  socket.on("disconnect", function() {
    //alertBox("You're disconnected, the page will now reload.", {reload:true});
    //localusername = getCookie("username");
    //document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";

    if (socket.connected === false &&
        socket.disconnected === true) {
	reconnect_count++;
	console.log("reconnecting: " + reconnect_count);
    	localusername = getCookie("username");
	if(localusername) { 

		if(reconnect_count <= 5) {
			console.log("reconnecting...");
        		setTimeout(function() {
        			socket.connect();
			}, 1000);

        		setTimeout(function() {
				socket.emit("checklogin", localusername, reconnect_count);
			}, 2000);
		} else {
    			alertBox("Reconnecting failed. Please check your internet connection and sign in again.", {relogin:true});
		}
	}
    }

  });

  socket.on("pm", function(data) {
    addChatMessage({
      username: data.from + " whisper to " + data.to,
      msg: data.msg
    });
  });

  socket.on("pm fail", function() {
    alert("cannot find the user");
  });

  socket.on("search", function(data) {
    var str = "search result:<br/>";
    for (var i in data) {
      var temp = data[i];
      str += temp.user + " " + temp.msg + "<br/>";
    }
    showSearchMsg(str);
  });

  socket.on("gettotalmessage", function(data) {
    if(data <= 5) {
	$("#previousmsg").hide();
    } else {
	var messagecount = 0;
        messagecount = $(".messages div").length;
	//console.log("messagecount: " + messagecount);
	//console.log("data: " + data);

/*
	if(messagecount >= 10 && $("#refreshlist").length == 0) {
    		var $refreshmsg = $("<a href='#' id='refreshlist' onclick='refreshlist();return false;' class='black-text text-left'/>").text("Refresh list");
		$("#previousmsg").before($refreshmsg);
	}
*/
	var remains = data - messagecount; 
	$("#previousmsg").show();

	if(remains > 0)
		$("#totalmessage").text(" (" + remains + ")");
	else
		$("#previousmsg").hide();
    }
  });

  socket.on("history", function(data) {
    //console.log(data);
    for (var i in data)
      addChatMessage(data[i],{prepend:false});

    socket.emit("gettotalmessage", joinedRoom);
  });

  socket.on("room list", refreshRoomList);

  socket.on("like", function(chatId, likes) {
    var $likeButton = $("#" + chatId);
    var totalLikes = $likeButton.data("likecount");
    var $likeDiv = $likeButton.parent();
    var likeDone = likes.indexOf(userId) != -1;
    makeLikeDiv($likeDiv, chatId, totalLikes + 1, likeDone);
  });

  socket.on("unlike", function(chatId, likes) {
    var $likeButton = $("#" + chatId);
    var totalLikes = $likeButton.data("likecount");
    var $likeDiv = $likeButton.parent();
    var likeDone = likes.indexOf(userId) != -1;
    makeLikeDiv($likeDiv, chatId, totalLikes - 1, likeDone);
  });

  socket.on("updatemenuprofile", function(user) {
      var $profileUsername = $("#menuUsername");
      var $profileUserType = $("#menuUserType");
      var $profilePoints = $("#menuUserPoints");
      $profileUsername.text(user.username);
      $profileUserType.text(user.userType);
      $profilePoints.text(user.points + " points");
  });

  socket.on("new answer", function(data) {
      if(data == null)
    	return;

      if(data.username == username) {

        if(data.day == 6) {
                if(data.question == 1) {
                        //if(data.status) {
                                setCookie("feedback1", 1, 10);
				submitfeedback(2);
			//}
                } else if(data.question == 2) {
                        //if(data.status) {
                                setCookie("feedback2", 1, 10);
				fbsubmitq3();
			//}
                }
        }
        processAnswer(data);
      }
  });  
  socket.on("new challenge", function() {
  		  alertBox("Updated team pairs", {reload:true});
  		  
  });    
  socket.on("loadlb", function(data) {
  	//console.log("loadlb data " + data.length);
    if(data == null || data.length==0) {
    	$("#lbdetails").html("No record found");
  		$("#teamlbdetails").html("No record found");
      return;
    }
  
    if(viewingLB != data[0].day)
    	return;
    
    var members = "";
    for(var i = 0; i<data.length; i++) {
    	if(data[i].teamId < 100) {
			members += "<div class='col-xs-9 col-sm-9 col-md-9 col-lg-9'>";
			
			if(data[0].answer == 1) { 
				members += data[i].username + "</div>";
			} else {
				members += data[i].teamname + "</div>";
			}
			
			members += "<div class='col-xs-3 col-sm-3 col-md-3 col-lg-3'>";
			members += data[i].points+"</div>";
		}
    }
    
    if(members == "")
    	members = "No record found";
  
    if(data[0].answer == 1)
    	$("#lbdetails").html(members);
    else if(data[0].answer == 2)
  		$("#teamlbdetails").html(members);
    
    if(data[0].answer == 1) { // load team later
    	var teamdata = {day:data[0].day, question:data[0].question, type:2, limit:10};
    	socket.emit("loadlb", teamdata);
    }
  });
  socket.on("loadchallenge", function(data) {
  	//console.log("loadchallenge data " + data.length);
    if(data == null || data.length==0)
      return;
  
    for(var i = 0; i<data.length; i++) {
    	$("#"+data[i].username).text(data[i].points);
    }    
  });  
  socket.on("gethighscore", function(data) {
    if(data == null)
      return;
    $("#highscore").html("Highscore: " + data.points);    	
  });    
  socket.on("getscore", function(data) {
    if(data == null)
      return;
    $("#lbdetails").html(members);    	
  });  
  socket.on("updateteamname", function(teamname) {
    if(teamname == null || teamname.length==0)
      return;
  	
  	userteamName = teamname;
  	$("#teamname").val("");
    $("#myteam").text(userteamName);
    
    alertBox("Your battle unit is now \"" + userteamName + "\"");
  });    
  socket.on("getteam", function(data) {
    $("#tableid").html("Table " + userteamId);
    if(data == null)
      return;
    var members = "";
    for(var i = 0; i<data.length; i++) {
    	
    	members += "<div class='col-xs-9 col-sm-9 col-md-9 col-lg-9'>";
    	if(data[i].userType === 1)
    		members += "* ";
    	if(data[i].username == username)
    		members += "<span class='red-text'>"+data[i].username+"</span>";
    	else 
    		members += data[i].username;
    	members += "</div>";
    	
    	members += "<div class='col-xs-3 col-sm-3 col-md-3 col-lg-3'>";
    	if(data[i].username == username)
    		members += "<span class='red-text'>"+data[i].points+"</span>";
    	else 
    		members += data[i].points;
    	
    	members += "</div>";
    }
    $("#myteam").text(userteamName);
    $("#teammembers").html(members);   

    var data = {userteamId:userteamId, username:username, day:0, question:1};
    socket.emit("checkteamanswers", data);
  });  
  socket.on("checkteamanswers", function(data) {
    if(data == null)
      return;
    
    var count = 0;
    var day = 0;
    var question = 1;
    var completed = "";
    for(var i = 0; i<data.length; i++) {
    	if(data[i] && data[i].status === true) {
    		day = data[i].day;
    		question = data[i].question;
    		if(day == 0)
    			completed += "<i class='fa fa-check-circle-o'></i> "+data[i].username + "<br>";
    		else 
    			completed += data[i].username + " - " + data[i].points + " points<br>";
    		count++;
    	}
    }
    
    $("#info").html(completed);
    //count=data.length;
    if(day == 0) {
    	$("#d"+day+"q"+question).html(count + " of " + data.length + " members completed <i class='fa fa-info-circle'></i>");
    
    	if(count >= data.length || usertype == 2) {
    		
    		if(joinedRoom == "/page0") { 
				$("#namebattle").unbind("click");
				$("#namebattle").click(function() {
					window.location = "team.html"; 
				});
				$("#lock0").empty().remove();
				
			} else if(joinedRoom == "/team") {
				$("#lockteam").empty().remove();
				$("#updateteam").unbind("click");				
				
				if(usertype >= 1) {	
					$("#updateteam").click(function() {
						updateTeam();
						return false;
					});				
				} else {
					$("#updateteam").click(function() {
						alertBox("Only Team Leader is allowed to update the Team Name.");
						return false;
					});									
				}
			}
		}
    }
    	
  });
  socket.on("checkteamscore", function(data, oridata) {
    var minpoints = 0;
  	if(oridata.day == 1) {
  		minpoints = 800;
  	} else if(oridata.day == 2) {
  		minpoints = 4000;
  	} else if(oridata.day == 3) {
  		minpoints = 8000;
  	} else if(oridata.day == 4) {
  		minpoints = 16000;  		
  	}
  	//data = {day:4,question:1,points:16200}
    if(data == null && usertype < 2) {
    	if(joinedRoom != "/quiz")
    		$("#d"+oridata.day+"q"+oridata.question).html("0 of "+minpoints+" points earned");
    	else 
    		alertBox("Your team has to earn at least "+minpoints+" points to unlock this mission.", {goback:true});
    	return;
    }
    
    if(data == null) {
    	data = {day:oridata.day, question:oridata.question, points:0};
    }
    $("#d"+data.day+"q"+data.question).html(data.points + " of "+minpoints+" points earned <i class='fa fa-info-circle'></i>");
    
    if(data.points >= minpoints || usertype == 2) {
    	if(data.day == 1) {
    		if(joinedRoom == "/page1") {
				$("#mission1").unbind("click");
				$("#mission1").click(function() {
					window.location = "unbelievable.html"; 
				});
			} else if (joinedRoom == "/unbelievable") {
				$("#locklyrics").empty().remove();
				$("#submitLyrics").unbind("click");
				
				if(usertype >= 1) {	
					$("#submitLyrics").click(function() {
							sendMessage("inputComment",joinedRoom);
						    typing = false;
						    return false
					});				
				} else {
					$("#submitLyrics").click(function() {
						alertBox("Only Team Leader is allowed to submit the lyrics.");
						return false;
					});									
				}				
			}
		/*
		} else {
    		$("#mission"+data.day).unbind("click");
    		$("#mission"+data.day).click(function() {
    			window.location = "quiz.html?level="+ data.day + "&user="+username;
    		});			
		}
		*/
    	} else if(data.day == 2) {
    		$("#mission2").unbind("click");
    		$("#mission2").click(function() {
    			var data = Base64.encodeURI(username+":"+1908+":"+Date.now().toString());
    			window.location = "https://dev-sg-app.vocohub.com/sgConf/main/app/index.html?data="+data;
    			//window.location = "quiz.html?level="+ data.day;
    		});
    	} else if(data.day == 3) {
    		$("#mission3").unbind("click");
    		$("#mission3").click(function() {
    			var data = Base64.encodeURI(username+":"+1910+":"+Date.now().toString());
    			window.location = "https://dev-sg-app.vocohub.com/sgConf/main/app/index.html?data="+data; 
    		});    		
    	} else if(data.day == 4) {
    		$("#mission4").unbind("click");
    		$("#mission4").click(function() {
    			var data = Base64.encodeURI(username+":"+1909+":"+Date.now().toString());
    			window.location = "https://dev-sg-app.vocohub.com/sgConf/main/app/index.html?data="+data; 
    		});    		    		
    	} 
		$("#lock"+data.day).empty().remove();		
    } else {
    	alertBox("Your team has to earn at least "+minpoints+" points to unlock this mission.", {goback:true});
    	return;
    }

	var data = {userteamId:userteamId, username:username, day:data.day, question:data.question};
    socket.emit("checkteamanswers", data);
    
  });  
  socket.on("checkteampairs", function(pairedlist, unpairedlist, round) {
    var teams = "";
    for(var i = 0; i<pairedlist.length; i++) {
    	if(pairedlist[i].primary == true) {
    		if(pairedlist[i].win > 0) {
				//teams += pairedlist[i].team1name + " vs " + pairedlist[i].team2name + "<br>";
				
				if(pairedlist[i].win != pairedlist[i].team1)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'>" + pairedlist[i].team1name + "</div>";
				else 
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + pairedlist[i].team1name + "</div>";
				
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'>VS</div>";
				
				if(pairedlist[i].win != pairedlist[i].team2)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'>" + pairedlist[i].team2name + "</div>";
				else
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + pairedlist[i].team2name + "</div>";
				
				var team1id = "team" + pairedlist[i].team1;
				var team2id = "team" + pairedlist[i].team2;
				
				if(pairedlist[i].win != pairedlist[i].team1)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'><span id='"+team1id+"'>0</span></div>";
				else
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team1id+"'>0</span></div>";
				
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'></div>";
				if(pairedlist[i].win != pairedlist[i].team2)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'><span id='"+team2id+"'>0</span></div>";
				else 
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team2id+"'>0</span></div>";
			} else {
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + pairedlist[i].team1name + "</div>";
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'>VS</div>";
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + pairedlist[i].team2name + "</div>";
				var team1id = "team" + pairedlist[i].team1;
				var team2id = "team" + pairedlist[i].team2;
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team1id+"'>0</span></div>";
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'></div>";
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team2id+"'>0</span></div>";				
			}
    	}
    }
    $("#pairedteams" + round).html(teams);

    teams = "";
    for(var i = 0; i<unpairedlist.length; i++) {
    	if(round > 1)
    		teams += unpairedlist[i].team1name + " - " + unpairedlist[i].team1+ "<br>";
    	else
	    	teams += unpairedlist[i].teamName + " - " + unpairedlist[i].teamId+ "<br>"; 
    }
    $("#unpairedteams" + round).html(teams);
    
    var data = {day:5, question:round, type:2, limit:100};      
    socket.emit("loadchallenge", data);     
  });  

  socket.on("checkteamchallenge", function(data, round) {
    var teams = "";
    //console.log("checkteamchallenge " + data.length);
    var onboard = 0;
    for(var i = 0; i<data.length; i++) {
    	//console.log("team1: " + data[i].team1 + ", team2: " + data[i].team2);
    	if(userteamId == data[i].team1 || userteamId == data[i].team2)
    		onboard = 1;
    	
    		if(data[i].win > 0) {
				//teams += pairedlist[i].team1name + " vs " + pairedlist[i].team2name + "<br>";
				
				if(data[i].win != data[i].team1)
					teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'>" + data[i].team1name + "</div>";
				else 
					teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team1name + "</div>";
				
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'>VS</div>";
				
				if(data[i].win != data[i].team2)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'>" + data[i].team2name + "</div></div>";
				else
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team2name + "</div></div>";
				
				var team1id = "team" + data[i].team1;
				var team2id = "team" + data[i].team2;
				
				if(data[i].win != data[i].team1)
					teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'><span id='"+team1id+"'>0</span></div>";
				else
					teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team1id+"'>0</span></div>";
				
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'></div>";
				if(data[i].win != data[i].team2)
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center black-text'><span id='"+team2id+"'>0</span></div></div>";
				else 
					teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team2id+"'>0</span></div></div>";
			} else {
				teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team1name + "</div>";
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'>VS</div>";
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team2name + "</div></div>";
				var team1id = "team" + data[i].team1;
				var team2id = "team" + data[i].team2;
				teams += "<div class='row'><div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team1id+"'>0</span></div>";
				teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'></div>";
				teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team2id+"'>0</span></div></div>";				
			}    	
    	/*
    	teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team1name + "</div>";
    	teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'>VS</div>";
    	teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center'>" + data[i].team2name + "</div>";
    	var team1id = "team" + data[i].team1;
    	var team2id = "team" + data[i].team2;
    	teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team1id+"'>0</span></div>";
    	teams += "<div class='col-xs-2 col-sm-2 col-md-2 col-lg-2 text-center'></div>";
    	teams += "<div class='col-xs-5 col-sm-5 col-md-5 col-lg-5 text-center red-text'><span id='"+team2id+"'>0</span></div>";
    	*/
    }
    $("#teamchallenge" + round).html(teams);
    
    var pairlink = $("<button id='pairlink' />");
    pairlink.html("Go to PAIR");
    pairlink.addClass("btn btn-primary text-center");
    pairlink.click(function() {
   		window.location="pair.html";
    });
    if(usertype == 2) {
    	$("#pairlink").empty().remove();
    	$("#teamchallenge" + round).after(pairlink);
    }
    
    if(onboard || usertype == 2) {
    	var level = 0;
    	if(round == 1)
    		level = 5;
    	else if (round == 2)
    		level = 6;
    	
    	$("#startr"+round+"lock").empty().remove();
    	$("#startr"+round).unbind("click");
    	$("#startr"+round).click(function() {
    			window.location = "game.html?level="+level;
    	});
    }
    
    var data = {day:5, question:round, type:2, limit:100};      
    socket.emit("loadchallenge", data); 
    
  });    
  socket.on("updatescore", function(data) {
    //console.log("Something wrong?");
    //console.log("updatescore: " + data.score + ", score_diff: " + data.diff + ", update_team: " + data.team);
    if(data.score == 0) {
    	alertBox("Please try again!");
    } if(data.team == 0 && data.score > 0) {
    	alertBox("You've previously scored the same or higher than " + data.score + " points. No additional points earned.");
    	//alertBox("Congratulations! You've earned " + data.score + " points");
    } else if ( data.diff > 0 ) {          
    	
    	if(data.diff == data.score) 
    		alertBox("Congratulations! You've earned " + data.diff + " points.");
    	else {
    		var previous_score = data.score - data.diff;
    		alertBox("Congratulations! You've earned additional " + data.diff + " points. Your previous score was " + previous_score + " points.");
    	}
    }
  });        
  socket.on("closeround", function(round, wincount) {
    alertBox("Total updated: " + wincount, {reload:true});    
  });      
  socket.on("checkmenu", function(day) {
  	if(usertype == 2)
  		day = 5;
    for(var i=1; i<=day; i++) {
    	var step = i;
    	$("#menu"+step).empty().remove();
    	$("#menubtn"+step).unbind("click");
    	$("#menubtn"+step).addClass("btn-enabled");
    	$("#menubtn"+step).attr("href", "page"+step+".html");
    }
    var topx = $("#step"+day).offset().top;
    topx = topx - 200;
    var speed = topx + 1000;
    //console.log("top: " + topx);
    $('html, body').animate({
    		scrollTop: topx 
    }, speed);
  });        
  socket.on("checkpoll", function(data) {
      if(data == null)
    	return;

      if(data.username == username) {
        //if(data.status) {
	  if(data.day == 1 && data.status) {
	  	showday1poll1(data);
	  	socket.emit("getpollresults", data);

	  } else if(data.day == 2) {
		if(data.question == 3) {
			var day2quiz1ans = {answer:2}; 
	  		showday2quiz1(data, day2quiz1ans);

		} else if (data.question == 4) {
			var day2quiz2ans = {answer:1}; 
	  		showday2quiz2(data, day2quiz2ans);
		}
	  } else if(data.day == 3) {
		if(data.question == 3) {
			var day3quiz1ans = {answer:2}; 
	  		showday3quiz1(data, day3quiz1ans);
		}

	  } else if(data.day == 4) {
		if(data.question == 3) {
			var day4quiz1ans = {answer:3}; 
	  		showday4quiz1(data, day4quiz1ans);
		}

	  } else if(data.day == 5) {
		if(data.question == 2) {
			var day5quiz1ans = {answer:2}; 
	  		showday5quiz1(data, day5quiz1ans);

		} else if(data.question == 3) {
			var day5quiz2ans = {answer:1}; 
	  		showday5quiz2(data, day5quiz2ans);
		}
	  }
        //} 
      }
  });
  socket.on("getpollresults", function(a1,a2,a3,a4) {
	showday1poll1results(a1,a2,a3,a4);
  });

  function createChatString(chat) {
    var room = chat.room;
    var m = moment(chat.time);
    var displayDate = "";
    displayDate = m.fromNow();
    var newmsg = chat.msg.replace(/\n/g, "<br>");

    var $likeDiv = "";
    if (chat.likes) {
      $likeDiv = $("<span style='float:right' class='likesDiv'/>");
      var totalLikes = Object.keys(data.likes).length;
      var likeDone = data.likes.indexOf(userId) != -1;
      makeLikeDiv($likeDiv, data._id, totalLikes, likeDone);
    }
    //addChatMessage(chat);

    var totalLikes = Object.keys(chat.likes).length;
    return "<div>In <a class='red-text' href='" + room + ".html'>"+ room +".html</a> " + displayDate + "<br>" + newmsg;
	// +  with " + totalLikes + ((totalLikes > 1) ? " likes" : " like") + "</div>";
  }

  // Profile page
    var $profileUsername = $(".profileUsername");
    //var $profileUserType = $(".profileUserType");
    var $profilePoints = $(".profilePoints");
    var $profileChats = $(".profileChats");
    socket.on("profile", function(user, chats) {
      $profileUsername.text(user.username);
      //$profileUserType.text(user.userType);
      $profilePoints.text(user.points + " points");
      var chat;
      if (Array.isArray(chats)) {
        for (var i in chats) {
          chat = chats[i];
	  $profileChats.append(makeChatMessage(chat, false));
        }
      } else {
        chat = chats;
        var $chat = $("#profile" + chat._id).parent();
        $chat.replaceWith($(createChatString(chat)));
      }
    });

  // Comments page
  (function() {
    var $recentLikes = $(".recentLikes");
    var $mostLikes = $(".mostLikes");
    socket.on("comments", function(chats1, chats2) {
      var i, chat, chatString = "";
      for (i in chats1) {
        chat = chats1[i];
        chatString += createChatString(chat) + " and recent like on " + moment(chat.lastLikeDate).format("dddd, MMMM Do YYYY, h:mm:ss a");
      }
      $recentLikes.html(chatString);
      chatString = "";
      for (i in chats2) {
        chat = chats2[i];
        chatString += createChatString(chat) + " and recent like on " + moment(chat.lastLikeDate).format("dddd, MMMM Do YYYY, h:mm:ss a");
      }
      $mostLikes.html(chatString);
    });
  })();

  function refreshRoomList(data) {
    var roomData = "";
    for (var i in data) {
      var room = data[i];
      roomData += "<li><a href='javascript:void(0)' onclick='joinRoom(event)'>" + room.roomName + "</a></li>";
    }
    $roomlist.html(roomData);
  }

  window.enterRoom = function(roomName) {
    //var roomName = event.target.innerHTML;
    //if (roomName == joinedRoom) alert("already joined " + roomName);
    //if (confirm("Are you sure to join room " + roomName + "?"))
      socket.emit("join room", roomName);
  };

  window.joinRoom = function(event) {
    var roomName = event.target.innerHTML;
    if (roomName == joinedRoom) alert("already joined " + roomName);
    if (confirm("Are you sure to join room " + roomName + "?"))
      socket.emit("join room", roomName);
  };

  var $btnCreateRoom = $(".btnCreateRoom");
  $btnCreateRoom.click(function() {
    var roomName = prompt("Please enter the room name?");
    if (roomName != null && roomName != "") {
      socket.emit("create room", roomName);
    } else if (roomName != null) {
      alert("Invalid room name");
    }
  });

  window.formsubmit = function() {
      localusername = "";
      document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
      setUsername();
  }
  window.updateMenuProfile = function() {
	$("#mark").hide();
	stopBlinking = true;

    	if (socket.connected === false &&
        	socket.disconnected === true) {

    		alertBox("You <b>("+username+")</b> is disconnected. The page will now reload.", {reload:true});
		return;
    	}
        socket.emit("updatemenuprofile", username);
  }

  window.refreshlist = function() {
	$(".messages").empty();
        socket.emit("refreshlist", joinedRoom, sortbylike);
  }
  window.submitAnswer = function(data) {
    	setCookie("pausevideo", 1, 1);
        socket.emit("new answer", data);
  }
  window.pauseVideo = function() {
	var pausevideo = getCookie("pausevideo");
	if(!pausevideo || pausevideo == null) {
		alertBox("You need to complete the video to earn your points!"); 
    		setCookie("pausevideo", 1, 1);
	}
  }
  window.getTeam = function() {
  	  var data = {userteamId:userteamId, username:username};
        socket.emit("getteam", data);
  }    
  window.checkTeamAnswers = function(day,question) {
  	  var data = {userteamId:userteamId, username:username, day:day, question:question};
        socket.emit("checkteamanswers", data);
  }  
  window.checkTeamScore = function(day,question) {
  	  var data = {userteamId:userteamId, username:username, day:day, question:question};
        socket.emit("checkteamscore", data);
  }    
  window.loadLB = function(d,q,t) {
  	  var data = {day:d, question:q, type:t, limit:20};
  	  viewingLB = d;
  	  $("#lbdetails").empty();
  	  $("#teamlbdetails").empty();
      socket.emit("loadlb", data);
  }    
  window.loadChallenge = function(d,q,t) {
  	  var data = {day:d, question:q, type:t, limit:100};
  	  //viewingLB = d;
  	  //$("#lbdetails").empty();
  	  //$("#teamlbdetails").empty();
      socket.emit("loadchallenge", data);
  }  
  window.getHighscore = function(level) {
  	  level = parseInt(level);
  	  var data = {day:level, question:1};
        socket.emit("gethighscore", data);
  }      
  window.updateScore = function(level, score) {
  	  level = parseInt(level);
  	  var data = {day:level, question:1, score:score, userteamId:userteamId, userteamName:userteamName};
        socket.emit("updatescore", data);
  }  
  window.updateQuiz = function(uid, score, d, q) {
  	  if(uid != username) {
  	  	  //console.log("uid: " + uid + ", username: " + username + ", score: " +score);
  	  	  alertBox("Invalid user!!! ");
  	  	  return;
  	  }
  	  
  	  var data = {day:d, question:q, score:score, userteamId:userteamId, userteamName:userteamName};
        socket.emit("updatescore", data);
  }    
  window.updateTeamname = function() {
  	  var teamname = $("#teamname").val();
  	  if(teamname.length == 0) {
  	  	  alertBox("Please enter a valid name.");
  	  	  return;
  	  }
  	  if(teamname.length > 20) {
  	  	  alertBox("Please enter a name that is shorter than 25 characters.");
  	  	  return;
  	  }  	  
  	  var data = {userteamId:userteamId, username:username, teamname:teamname};
        socket.emit("updateteamname", data);
  }    
  window.pairTeam = function(round) {

  	  var team1val, team2val;
  	  
  	  if(round == 1) {
  	  	  team1val = $("#team11val").val();
  	  	  team2val = $("#team12val").val();
  	  } else if(round == 2) {
  	  	  team1val = $("#team21val").val();
  	  	  team2val = $("#team22val").val();  	  	  
  	  }
  	  
  	  if(team1val.length==0 || team2val.length==0) {
  	  	  alertBox("Please enter correct values!" + team1val + ", " + team2val);
  	  	  return;
  	  }
  	  
  	  var data = {team1:parseInt(team1val), team2:parseInt(team2val), round:parseInt(round)}
  	  socket.emit("new challenge", data);
  }
  window.closeRound = function(round) {
  	  socket.emit("closeround", round);
  }  
  window.checkTeamPairs = function(round) {
        socket.emit("checkteampairs", round);
  }    
  window.checkTeamChallenge = function(round) {
        socket.emit("checkteamchallenge", round);
  }      
  window.checkMenu = function() {
        socket.emit("checkmenu");
  }      
  window.checkPoll = function(data) {
        socket.emit("checkpoll", data);
  }  
  window.submitPoll = function(data) {
        socket.emit("new answer", data);
  }
  window.alertbox = function(msg, option) {
  	  alertBox(msg, option);
  }
  window.day1submit = function() {
	var msg = $("#day1submitask").val();
	if(msg.length == 0) {
		alertBox("Your message is empty");
		return;
	}
	if(msg.length < 10) {
		alertBox("Please elaborate more.");
		return;
	}
	socket.emit("new message", msg, "/ask", 10);
  }
  window.day2submit = function() {
	var msg = $("#day2submitquiz").val();
	if(msg.length == 0) {
		alertBox("Your message is empty");
		return;
	}
	if(msg.length < 10) {
		alertBox("Please elaborate more.");
		return;
	}
	socket.emit("new message", msg, "/day2quiz", 10);
  }
  window.day3submit = function() {
	var msg = $("#day3submitquiz").val();
	if(msg.length == 0) {
		alertBox("Your message is empty");
		return;
	}
	if(msg.length < 10) {
		alertBox("Please elaborate more.");
		return;
	}
	socket.emit("new message", msg, "/day3quiz", 10);
  }
  window.day4submit = function() {
	var msg = $("#day4submitquiz").val();
	if(msg.length == 0) {
		alertBox("Your message is empty");
		return;
	}
	if(msg.length < 10) {
		alertBox("Please elaborate more.");
		return;
	}
	socket.emit("new message", msg, "/day4quiz", 10);
  }
  window.fbsubmitq3 = function() {
	var msg = $("#fbcomment1").val();
	socket.emit("new message", msg, "/fbquestion3", 0);
  }
  window.fbsubmitq4 = function() {
	var msg = $("#fbcomment2").val();
	socket.emit("new message", msg, "/fbquestion4", 0);
  }
  window.loadPreviousMessage = function() {
      var messagecount = 0;
      messagecount = $(".messages div").length;
      socket.emit("loadprevious", joinedRoom, sortbylike, messagecount);
  }
  window.showThankyou = function() {
        var answer1 = getCookie("feedback1");
        var answer2 = getCookie("feedback2");
        var answer3 = getCookie("feedback3");
        var answer4 = getCookie("feedback4");

        if(answer1==1 && answer2==1 && answer3==1 && answer4==1) {
                alertBox("Thank you for your feedback!", {gomenu:true});
        } else {
                alertBox("Error while submitting to server, please try submit again!");
		$("#feedbacksubmit").show();
        }
  }
  window.loadMostLikes = function() {

      if(sortbylike==false || !sortbylike) {
      	$("#viewmostlikes").text("View Recent");
      	$("#loadpreviousmsg").text("View more comments");
        sortbylike=true;
        socket.emit("loadmostlikes", joinedRoom);
      } else {
      	$("#viewmostlikes").text("View Most Likes");
      	$("#loadpreviousmsg").text("View earlier comments");
        sortbylike=false;
        socket.emit("loadhistory", joinedRoom);
      }
      $(".messages").empty();
      return false;
  }
  $window.hashchange(function() {
    if (username && location.hash == "#chat") {
      location.hash = "#chat@" + encodeURI(joinedRoom);
      return;
    }
    sideBar.changeHash();
    if (username) {
      if (!onProfile && location.hash == "#profile") {
        socket.emit("on profile");
        onProfile = true;
      } else if (onProfile && location.hash != "#profile") {
        socket.emit("off profile");
        onProfile = false;
      }
      if (!onComments && location.hash == "#comments") {
        socket.emit("on comments");
        onComments = true;
      } else if (onComments && location.hash != "#comments") {
        socket.emit("off comments");
        onComments = false;
      }
    }
  });
  $window.hashchange();
});
