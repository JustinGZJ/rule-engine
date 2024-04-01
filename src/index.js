"use strict";

// Some settings you can edit easily
// Flows file name
const flowfile = "flows.json";
// Start on the dashboard page
const url = "/dashboard";
// url for the editor page
const urledit = "/admin";
// tcp port to use
//const listenPort = "18880"; // fix it just because
const listenPort = parseInt(Math.random() * 16383 + 49152); // or random ephemeral port

const os = require("os");
const electron = require("electron");
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const { Menu, MenuItem } = electron;

if (require("electron-squirrel-startup")) {
  app.quit();
}

var http = require("http");
var express = require("express");
var RED = require("node-red");

// Create an Express app
var red_app = express();

// Add a simple route for static content served from 'public'
//red_app.use(express.static(__dirname +"/public"));

// Create a server
var server = http.createServer(red_app);

var userdir;
if (process.argv[1] && process.argv[1] === "index.js") {
  userdir = __dirname;
} else {
  // We set the user directory to be in the users home directory...
  const fs = require("fs");
  userdir = os.homedir() + "/.node-red";
  if (!fs.existsSync(userdir)) {
    fs.mkdirSync(userdir);
  }
  if (!fs.existsSync(userdir + "/" + flowfile)) {
    fs.writeFileSync(
      userdir + "/" + flowfile,
      fs.readFileSync(__dirname + "/" + flowfile)
    );
  }
}
console.log("Setting UserDir to ", userdir);

// Create the settings object - see default settings.js file for other options
var settings = {
  verbose: true,
  httpAdminRoot: "/admin",
  httpNodeRoot: "/",
  userDir: userdir,
  flowFile: flowfile,
  functionGlobalContext: {}, // enables global context
};

// Initialise the runtime with a server and settings
RED.init(server, settings);

// Serve the editor UI from /red
red_app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
red_app.use(settings.httpNodeRoot, RED.httpNode);

// Create the Application's main menu
var template = [
  {
    label: "应用程序",
    submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }],
  },
  {
    label: "Node-RED",
    submenu: [
      {
        label: "控制台",
        accelerator: "Shift+CmdOrCtrl+D",
        click() {
          mainWindow.loadURL("http://localhost:" + listenPort + url);
        },
      },
      {
        label: "编辑器",
        accelerator: "Shift+CmdOrCtrl+E",
        click() {
          mainWindow.loadURL("http://localhost:" + listenPort + urledit);
        },
      },
    ],
  },
  {
    label: "编辑",
    submenu: [
      { label: "撤销", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
      { label: "重做", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
      { type: "separator" },
      { label: "剪切", accelerator: "CmdOrCtrl+X", selector: "cut:" },
      { label: "复制", accelerator: "CmdOrCtrl+C", selector: "copy:" },
      { label: "粘贴", accelerator: "CmdOrCtrl+V", selector: "paste:" },
      { label: "全选", accelerator: "CmdOrCtrl+A", selector: "selectAll:" },
    ],
  },
  {
    label: "视图",
    submenu: [
      {
        label: "重新加载",
        accelerator: "CmdOrCtrl+R",
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.reload();
        },
      },
      {
        label: "切换开发者工具",
        accelerator:
          process.platform === "darwin" ? "Alt+Command+I" : "Ctrl+Shift+I",
        click(item, focusedWindow) {
          if (focusedWindow) focusedWindow.webContents.toggleDevTools();
        },
      },
      { type: "separator" },
      { role: "resetzoom", label: "实际大小" },
      { role: "zoomin", label: "放大" },
      { role: "zoomout", label: "缩小" },
      { type: "separator" },
      { role: "togglefullscreen", label: "切换全屏" },
      { role: "minimize", label: "最小化" },
    ],
  },
];
let mainWindow;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
    },
    title: "流程引擎",
    fullscreenable: true,
    width: 1024,
    height: 768,
    icon: __dirname + "/favicon.png",
  });

  var webContents = mainWindow.webContents;

  webContents.session.webRequest.onCompleted((details) => {
    if (details.statusCode == 404) {
      // 延时1s重新加载
      setTimeout(() => {
        webContents.reload();
      }, 1000);
    }
  });

  // 将菜单添加到主窗口
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  mainWindow.webContents.on(
    "new-window",
    function (e, url, frameName, disposition, options) {
      // if a child window opens... modify any other options such as width/height, etc
      // in this case make the child overlap the parent exactly...
      var w = mainWindow.getBounds();
      options.x = w.x;
      options.y = w.y;
      options.width = w.width;
      options.height = w.height;
      //re-use the same child name so all "2nd" windows use the same one.
      //frameName = "child";
    }
  );

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// Called when Electron has finished initialization and is ready to create browser windows.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
    mainWindow.loadURL("http://127.0.0.1:" + listenPort + url);
  }
});

// Start the Node-RED runtime, then load the inital page
RED.start().then(function () {
  server.listen(listenPort, "127.0.0.1", function () {
    mainWindow.loadURL("http://127.0.0.1:" + listenPort + url);
  });
});
