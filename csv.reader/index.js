var fs = require("fs");
var Q = require("q");

exports.readCsv = Q.async(function*(path) {
  var jsonAry = [];
  var data = yield readFile(path);
  var deleteTask = deleteFile(path);
  var tempAry = data.split("\r\n");
  for (var i in tempAry) {
    var temp = tempAry[i];
    if (temp !== "") {
      var dataAry = temp.split(",");
      jsonAry.push({
        username: dataAry[0],
        userType: parseInt(dataAry[1]),
        points: parseInt(dataAry[2]),
        teamId: dataAry[3],
        teamName: "Team " + dataAry[3]
      });
    }
  }
  yield deleteTask;
  return jsonAry;
});

function readFile(path) {
  var deferred = Q.defer();
  fs.readFile(path, "utf8", deferred.makeNodeResolver());
  return deferred.promise;
}

function deleteFile(path) {
  var deferred = Q.defer();
  fs.unlink(path, deferred.makeNodeResolver());
  return deferred.promise;
}
