$(function() {
  // Initialize varibles
  var $window = $(window);
  var $usernameInput = $(".usernameInput"); // Input for username
  var $userArea = $(".userArea"); // Messages area

  var $loginPage = $(".login.page"); // The login page
  var $chatPage = $(".chat.page"); // The chatroom page

  var $form = $("form");
  $form.submit(function(e) {
    e.preventDefault();
    var data = new FormData($form[0]);
    $.ajax({
      url: $form.attr("action"),
      type: "POST",
      data: data,
      cache: false,
      processData: false,
      contentType: false,
      success: function(data) {
        if (data)
          alert("success");
        else
          alert("fail");
      },
      error: function() {
        alert("upload error");
      }
    });
  });

  // Prompt for setting a username
  var username;
  var connected = false;

  var socket = io();

  // Sets the client's username
  function setUsername() {
    username = cleanInput($usernameInput.val().trim());

    // If the username is valid
    if (username) {
      // Tell the server your username
      socket.emit("admin login", username);
    } else {
      alert("please enter a valid email");
      username = null;
    }
  }

  // Prevents input from having injected markup
  function cleanInput(input) {
    return $("<div/>").text(input).text();
  }

  // Keyboard events
  $window.keydown(function(event) {
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      if (username == null) {
        setUsername();
      }
    }
  });

  window.kickUser = function(event) {
    var user = event.target.innerHTML;
    if (confirm("are you confirm to kick " + user + "?")) {
      socket.emit("ban", user);
      $(this).detach();
    }
  };

  // Socket events
  socket.on("admin login", function(data) {
    $loginPage.fadeOut();
    $chatPage.show();
    $loginPage.off("click");
    connected = true;
    var userData = "";
    for (var i in data) {
      var user = data[i];
      userData += "<a href='javascript:void(0)' onclick='kickUser(event)'>" + user + "</a><br/>";
    }
    $userArea.append(userData);
  });

  socket.on("admin user joined", function(data) {
    if (!connected) return;
    var user = data.username;
    $userArea.append("<a href='javascript:void(0)' onclick='kickUser(event)'>" + user + "</a><br/>");
  });

  socket.on("admin user left", function(data) {
    var user = data.username;
    var link = $("a:contains('" + user + "')");
    link.add(link.next()).detach();
  });

  socket.on("admin fail", function() {
    alert("login fail");
    username = null;
  });

  socket.on("disconnect", function() {
    alert("server disconnect");
    location.reload(true);
  });
});
