const chalk = require('chalk');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const temporaryRuntimeDirectory = path.resolve(os.tmpdir(), `flood.test.${crypto.randomBytes(12).toString('hex')}`);

console.log(chalk.cyan(`Temporary runtime directory: ${temporaryRuntimeDirectory}\n`));

const rTorrentSession = path.join(temporaryRuntimeDirectory, '.session');
const rTorrentSocket = path.join(temporaryRuntimeDirectory, 'rtorrent.sock');

fs.mkdirSync(rTorrentSession, {recursive: true});

fs.writeFileSync(
  `${temporaryRuntimeDirectory}/rtorrent.rc`,
  `
directory.default.set = "${temporaryRuntimeDirectory}"
session.path.set = "${rTorrentSession}"
network.scgi.open_local = "${rTorrentSocket}"
`,
);

let argv = [];
argv.push('--rundir', temporaryRuntimeDirectory);
argv.push('--auth', 'none');
argv.push('--rtsocket', rTorrentSocket);
argv.push('--allowedpath', temporaryRuntimeDirectory);
argv.push('--rtorrent');
argv.push('--rtconfig', `${temporaryRuntimeDirectory}/rtorrent.rc`);
argv.push('--test');
argv = argv.concat(process.argv.slice(2));

let floodProcess;

const startFlood = () => {
  if (floodProcess != null) {
    return;
  }

  floodProcess = spawn(`${path.join(__dirname, '../dist/index.js')}`, argv, {stdio: 'inherit'});
};

const closeProcesses = () => {
  floodProcess.on('close', () => {
    if (process.env.CI !== 'true') {
      // TODO: This leads to test flakiness caused by ENOENT error
      // NeDB provides no method to close database connection
      fs.rmdirSync(temporaryRuntimeDirectory, {recursive: true});
    }
  });

  floodProcess.kill('SIGTERM');
  process.kill(Number(fs.readFileSync(`${temporaryRuntimeDirectory}/rtorrent.pid`).toString()));
};

startFlood();

process.on('SIGINT', () => {
  process.exit();
});

process.on('exit', () => {
  closeProcesses();
});
