const fs = require("fs");
const path = require("path");
const ftpd = require("ftpd");

const HOST = "0.0.0.0";
const PORT = 5300;

const ROOT = __dirname;

const server = new ftpd.FtpServer(HOST, {
  getInitialCwd: () => "/",
  getRoot: () => ROOT,
  pasvPortRangeStart: 1025,
  pasvPortRangeEnd: 1050,
  useWriteFile: false,
  useReadFile: false,
  allowedCommands: ["USER", "PASS", "QUIT", "PWD", "CWD", "LIST", "RETR"],
});

server.on("client:connected", (connection) => {
  const addr = connection.socket.remoteAddress;
  console.log(`🔗 Client connected from ${addr}`);

  connection.on("command:user", (user, success, failure) => {
    if (user === "web") success();
    else failure();
  });

  connection.on("command:pass", (pass, success, failure) => {
    if (pass === "web") {
      console.log("✅ User web authenticated");
      success("web");
    } else failure();
  });

  // Handle file retrieval safely
  connection.on("file:retr", (filePath, writeStream) => {
    // filePath comes in as "/firmware/ncftrack_latest.bin"
    const absPath = path.join(ROOT, filePath); // join with project root

    console.log(`📥 RETR requested: ${filePath} -> ${absPath}`);

    fs.stat(absPath, (err, stats) => {
      if (err || !stats.isFile()) {
        console.error(`❌ File not found: ${absPath}`);
        writeStream.end();
        return;
      }

      const readStream = fs.createReadStream(absPath);
      readStream.pipe(writeStream);
      readStream.on("error", (e) => writeStream.end());
    });
  });
});

server.listen(PORT);
console.log(`🚀 FTP server listening on ${HOST}:${PORT}`);
console.log(`📂 Serving firmware from: ${ROOT}`);
