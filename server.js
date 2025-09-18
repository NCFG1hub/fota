const ftpd = require("ftpd");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";  // listen on all interfaces
const PORT = 5300;       // custom FTP port

// Path to your firmware directory
const ROOT = path.join(__dirname, "firmware");

// Make sure firmware folder exists
if (!fs.existsSync(ROOT)) {
  fs.mkdirSync(ROOT, { recursive: true });
}

const server = new ftpd.FtpServer(HOST, {
  getInitialCwd: () => "/firmware", // virtual cwd
  getRoot: () => ROOT,              // physical root
  pasvPortRangeStart: 1025,         // passive mode ports
  pasvPortRangeEnd: 1050,
  useWriteFile: true,
  useReadFile: true,
  allowedCommands: ["LIST", "RETR", "STOR", "USER", "PASS", "QUIT"],
  tlsOptions: null,
  greeting: ["Welcome to NCFTrack FTP server!"]
});

server.on("error", (err) => {
  console.error("❌ FTP Server error:", err);
});

server.on("client:connected", (connection) => {
  const remoteAddress = connection.socket.remoteAddress;
  console.log(`🔗 Client connected from ${remoteAddress}`);

  let username = null;

  connection.on("command:user", (user, success, failure) => {
    console.log(`👤 USER command: ${user}`);
    if (user === "web") {
      username = user;
      success();
    } else {
      failure();
    }
  });

  connection.on("command:pass", (pass, success, failure) => {
    console.log(`🔑 PASS attempt for user=${username}`);
    if (username === "web" && pass === "web") {
      console.log(`✅ User ${username} authenticated`);
      success(username);
    } else {
      console.log(`❌ Invalid password for user=${username}`);
      failure();
    }
  });

  // Log every FTP command
  connection.on("command", (command, params) => {
    console.log(`[CMD] ${username || "unknown"} -> ${command} ${params || ""}`);
  });

  // Log file download (RETR)
  connection.on("RETR", (filePath) => {
    console.log(`📥 ${username} is downloading ${filePath}`);
  });

  // Log file upload (STOR)
  connection.on("STOR", (filePath) => {
    console.log(`📤 ${username} is uploading ${filePath}`);
  });
});

// Start server
server.listen(PORT);
console.log(`🚀 FTP server listening on ${HOST}:${PORT}`);
console.log(`📂 Serving firmware from: ${ROOT}`);
