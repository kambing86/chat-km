//var url = "mongodb://" + process.env.IP;
var url = "mongodb://develop-sg";
var userCollection = null;
var chatCollection = null;
var roomCollection = null;
var answerCollection = null;

var Q = require("q");
var MongoClient = require("mongodb").MongoClient;
var ObjectID = require('mongodb').ObjectID;
var assert = require("assert");

MongoClient.connect(url, function(err, db) {
  assert.equal(err, null);
  logger.info("Connected to mongodb server.");
  userCollection = db.collection("user");
  chatCollection = db.collection("chat");
  roomCollection = db.collection("room");
  answerCollection = db.collection("answer");
});

exports.getUserId = function(username) {
  return userCollection.findOne({
    username: username
  }, {
    _id: 1
  });
};

exports.getUser = function(username) {
  return userCollection.findOne({
    username: username
  });
};

exports.addUsers = Q.async(function*(userArray) {
  for (var i in userArray) {
    var user = userArray[i];
    yield userCollection.updateOne({
      username: user.username
    }, user, {
      upsert: true,
      w: 1
    });
  }
});

function findOrCreateRoom(roomName) {
  return roomCollection.findOneAndUpdate({
    roomName: roomName
  }, {
    $setOnInsert: {
      roomName: roomName
    }
  }, {
    upsert: true,
    returnOriginal: false
  });
}

exports.addRoom = Q.async(function*(roomName) {
  var result = yield findOrCreateRoom(roomName);
  return result.value._id;
});

exports.roomExists = Q.async(function*(roomName) {
  return roomCollection.find({
    roomName: roomName
  }).count();
});

// function getLimitData(limit, cursor) {
//   return cursor.limit(limit).toArray();
// }

exports.getRoomList = Q.async(function*(roomId) {
  var cursor;
  if (roomId == undefined)
    cursor = roomCollection.find();
  else
    cursor = roomCollection.find({
      _id: {
        $gt: roomId
      }
    });
  return yield cursor.toArray();
  //return yield getLimitData(20, cursor);
});

exports.addChat = function(msg) {
  return chatCollection.insertOne(msg);
};

exports.addAnswer = function(answer) {
  return answerCollection.insertOne(answer);
};

exports.updateAnswer = function(data) {
  return answerCollection.findOneAndUpdate({
      username: data.username
  }, {
    $set: {
      answer: 1,
      time: new Date()
    }
  });
};
exports.updateScore = function(username, data) {
  return answerCollection.findOneAndUpdate({
      username: username,
      day: data.day,
      question: data.question
  }, {
    $set: {
      points: data.score,
      time: new Date()
    }
  });
};
exports.updateTeamname = function(data) {
  return userCollection.update({
      teamId: data.userteamId
  }, {
    $set: {
      teamName: data.teamname
  }},
    { 
    	multi: true     
  });
};
exports.getTeam = function(data) {
  return userCollection.find({
    teamId: data.userteamId
  }).toArray();
};
exports.loadLB = function(data) {
  return answerCollection.find({
    day: data.day,
    question: data.question,
    answer: data.type
  }).sort({
  	points: -1
  }).toArray();
};
exports.getAnswer = function(user,data) {
  return answerCollection.find({
    username: user,
    day: data.day,
    question: data.question
  }).toArray();
};
exports.getPollResults = function(data, a) {
  return answerCollection.find({
   day: data.day,
   question: data.question,
   answer: a
  }).count();
};

exports.getHistory = function(roomName, sortbylike, skip, limit) {

  if(sortbylike == true) {

    return chatCollection.find({
      room: roomName
    }).sort({
      likesCount: -1
    }).skip(skip).limit(limit).toArray();

  } else {

    return chatCollection.find({
      room: roomName
    }).sort({
      time: -1
    }).skip(skip).limit(limit).toArray();
  }

};

exports.getTotalMessage = function(roomName) {
  return chatCollection.find({
    room: roomName
  }).count();
};

exports.searchChat = function(roomName, search) {
  return chatCollection.find({
    room: roomName,
    $text: {
      $search: search
    }
  }).sort({
    time: 1
  }).toArray();
};

function updateChatLikes(userId, chatId) {
  return chatCollection.findOneAndUpdate({
    _id: new ObjectID(chatId),
    likes: {
      $nin: [new ObjectID(userId)]
    }
  }, {
    $push: {
      likes: new ObjectID(userId)
    },
    $inc: {
      likesCount: 1
    },
    $set: {
      lastLikeDate: new Date()
    }
  }, {
    returnOriginal: false
  });
}

function updateChatUnlikes(userId, chatId) {
  return chatCollection.findOneAndUpdate({
    _id: new ObjectID(chatId),
    likes: {
      $in: [new ObjectID(userId)]
    }
  }, {
    $pull: {
      likes: new ObjectID(userId)
    },
    $inc: {
      likesCount: -1
    }
  }, {
    returnOriginal: false
  });
}

function updateUserPoints(username, points) {
  return userCollection.updateOne({
    username: username
  }, {
    $inc: {
      points: points
    }
  });
}

exports.updateUserpoints = Q.async(function*(username, points) {
  return yield updateUserPoints(username, points);
});

function updateUserLoginTime(username) {
  return userCollection.updateOne({
    username: username
  }, {
    $set: {
      login: new Date()
    }
  });
}

exports.updateUserLogintime = Q.async(function*(username) {
  return yield updateUserLoginTime(username);
});

exports.likeChat = Q.async(function*(userId, chatId) {
  var result = yield updateChatLikes(userId, chatId);
  var chat = result.value;
  yield updateUserPoints(chat.username, 5);
  return chat;
});

exports.unlikeChat = Q.async(function*(userId, chatId) {
  var result = yield updateChatUnlikes(userId, chatId);
  var chat = result.value;
  yield updateUserPoints(chat.username, -5);
  return chat;
});

exports.getUserChats = Q.async(function*(username) {
  return chatCollection.find({
    username: username
  }).sort({
    time: -1
  }).toArray();
});

/*
exports.getUserChats = function(username, sortbylike, skip, limit) {

  if(sortbylike == true) {

    return chatCollection.find({
      username: username 
    }).sort({
      likesCount: -1
    }).skip(skip).limit(limit).toArray();

  } else {

    return chatCollection.find({
      username: username 
    }).sort({
      time: -1
    }).skip(skip).limit(limit).toArray();
  }
};
*/

exports.getChat = Q.async(function*(chatId) {
  return chatCollection.findOne({
    _id: new ObjectID(chatId)
  });
});

exports.getRecentLikeComments = Q.async(function*() {
  return chatCollection.find({
    lastLikeDate: {
      $ne: null
    }
  }).sort({
    lastLikeDate: -1
  }).limit(100).toArray();
});

exports.getMostLikeComments = Q.async(function*() {
  return chatCollection.find({
    likesCount: {
      $ne: 0
    }
  }).sort({
    likesCount: -1
  }).limit(100).toArray();
});
