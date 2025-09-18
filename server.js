const ftpd = require("ftpd");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";  // listen on all interfaces
const PORT = 5300;         // default FTP port

// Path to your firmware directory
const ROOT = path.join(__dirname, "firmware");

// Make sure firmware folder exists
if (!fs.existsSync(ROOT)) {
  fs.mkdirSync(ROOT, { recursive: true });
}

const server = new ftpd.FtpServer(HOST, {
  getInitialCwd: () => "/firmware",
  getRoot: () => ROOT,
  pasvPortRangeStart: 1025, // passive mode ports (if needed)
  pasvPortRangeEnd: 1050,
  useWriteFile: true,
  useReadFile: true,
  allowedCommands: ["LIST", "RETR", "STOR", "USER", "PASS", "QUIT"],
  tlsOptions: null,
  greeting: ["Welcome to NCFTrack FTP server!"]
});

server.on("error", (err) => {
  console.error("FTP Server error:", err);
});

server.on("client:connected", (connection) => {
  console.log("Client connected");

  let username = null;

  connection.on("command:user", (user, success, failure) => {
    if (user === "web") {
      username = user;
      success();
    } else {
      failure();
    }
  });

  connection.on("command:pass", (pass, success, failure) => {
    if (username === "web" && pass === "web") {
      success(username);
    } else {
      failure();
    }
  });
});

// Start server
server.listen(PORT);
console.log(`FTP server listening on ${HOST}:${PORT}`);
console.log(`Serving firmware from: ${ROOT}`);
