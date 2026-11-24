const { timeStamp } = require('console');
const fs = require('fs/promises');
const path = require('path');
const log_directory = path.join(__dirname, '..', '..', 'logs');
const log_file = path.join(log_directory, 'audit.log');

//this will create the directory logs/ if it does not already exist.
async function check_logs_dir() {
  await fs.mkdir(log_directory, {recursive: true});
}

//will be called once at start-up for the folder to exist from the beginning
async function init_audit_log() {
  try {
    await check_logs_dir();
  } catch (err) {
    console.error('audit log: We could not create the logs/', err.message);
  }
}

//the following will append the one JSON line for successfull booking or cancellation
async function write_audit(event, details = {}) {
  const line = JSON.stringify({timeStamp: new Date().toISOString(), event, ...details}) + '\n';
  await check_logs_dir();
  await fs.appendFile(log_file, line, 'utf8');
}

// when a log fails it must not fail the user.
async function audit_log(event, details = {}) {
  try{
    await write_audit(event, details);
  } catch (err){
    console.error('Audit Log: We could not write an entry:', err.message);
  }
}

module.exports = {audit_log, init_audit_log, log_file, write_audit};