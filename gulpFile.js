/*
 *  gulpfile.js
 *  ===========
 *
 *  Rather than manage one giant configuration file responsible
 *  for creating multiple tasks, each task has been broken out into
 *  its own file in gulp/tasks. Any files in that directory get
 *  automatically required below.
 *
 *  To add a new task, simply add a new task file in that directory.
 *  gulp/tasks/default.js specifies the default set of tasks to run
 *  when you run `gulp`.
 *
 */

var gulp = require("gulp");
var nodemon = require("gulp-nodemon");
var exec = require("child_process").exec;
var port = process.env.PORT || 3000;
gulp.task("default", function() {
  nodemon({
    // exec: "node --debug-brk",
    script: "index.js",
    ext: "js",
    ignore: ["client/*"]
  });
  // exec("%AppData%\\npm\\node-inspector");
  // exec("start chrome 127.0.0.1:8080/?port=5858");
  // exec("start chrome 127.0.0.1:8080/?port=5859");
  exec("start chrome 127.0.0.1:" + port);
});
