const ftpd = require("ftpd");
const fs = require("fs");
const path = require("path");

const HOST = "0.0.0.0";  // listen on all interfaces
const PORT = 5300;       // custom FTP port

// Paths
const ROOT = path.join(__dirname, "firmware");
const LOG_DIR = path.join(__dirname, "logs");

// Make sure firmware and logs folders exist
if (!fs.existsSync(ROOT)) fs.mkdirSync(ROOT, { recursive: true });
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// 🔥 Logger helper (console + file)
function logMessage(message) {
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").split(".")[0];
  const logLine = `[${timestamp}] ${message}`;

  console.log(logLine);

  const logFile = path.join(LOG_DIR, `ftp-${now.toISOString().split("T")[0]}.log`);
  fs.appendFileSync(logFile, logLine + "\n");
}

const server = new ftpd.FtpServer(HOST, {
  getInitialCwd: () => "/",          // virtual cwd
  getRoot: () => __dirname,          // physical root (so /firmware is visible)
  pasvPortRangeStart: 1025,          // passive mode ports
  pasvPortRangeEnd: 1050,
  pasvAddress: "199.192.25.155",     // your server’s public IP
  useWriteFile: true,
  useReadFile: true,
  tlsOptions: null,
  greeting: ["Welcome to NCFTrack FTP server!"]
});

server.on("error", (err) => {
  logMessage(`❌ FTP Server error: ${err}`);
});

server.on("client:connected", (connection) => {
  const remoteAddress = connection.socket.remoteAddress;
  logMessage(`🔗 Client connected from ${remoteAddress}`);

  let username = null;

  connection.on("command:user", (user, success, failure) => {
    logMessage(`👤 USER command: ${user}`);
    if (user === "web") {
      username = user;
      success();
    } else {
      failure();
    }
  });

  connection.on("command:pass", (pass, success, failure) => {
    logMessage(`🔑 PASS attempt for user=${username}`);
    if (username === "web" && pass === "web") {
      logMessage(`✅ User ${username} authenticated`);
      connection.username = username; // save for later
      success(username);
    } else {
      logMessage(`❌ Invalid password for user=${username}`);
      failure();
    }
  });

  // Log raw commands
  connection.on("command", (command, params) => {
    logMessage(`[CMD] ${connection.username || "unknown"} -> ${command} ${params || ""}`);
  });

  // 📥 File download with progress
  connection.on("file:retr", (filePath, stream) => {
    // 🔒 Ensure path is inside firmware/
    const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, "");
    const relPath = safePath.startsWith("firmware") ? safePath.slice("firmware".length + 1) : safePath;
    const absPath = path.join(ROOT, relPath);

    let size = 0;
    try {
      size = fs.statSync(absPath).size;
    } catch (err) {
      logMessage(`❌ Could not stat file: ${absPath} (${err.message})`);
      stream.emit("error", new Error("File not found"));
      return;
    }

    let transferred = 0;
    logMessage(`📥 ${connection.username} START downloading ${path.basename(absPath)} (${size} bytes)`);

    stream.on("data", (chunk) => {
      transferred += chunk.length;
      const percent = ((transferred / size) * 100).toFixed(1);
      process.stdout.write(
        `   ↳ ${connection.username} downloading... ${transferred}/${size} bytes (${percent}%)\r`
      );
    });

    stream.on("end", () => {
      logMessage(`✅ ${connection.username} FINISHED downloading ${path.basename(absPath)} (${size} bytes)`);
    });

    stream.on("error", (err) => {
      logMessage(`❌ Error during download: ${err.message}`);
    });
  });
});

// Start server
server.listen(PORT);
logMessage(`🚀 FTP server listening on ${HOST}:${PORT}`);
logMessage(`📂 Serving firmware from: ${ROOT}`);
