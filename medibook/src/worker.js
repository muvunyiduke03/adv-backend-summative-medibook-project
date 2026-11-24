//this is a background worker working on its own. run on its own process
require('dotenv').config();
const { Worker } = require('bullmq');
const { bull_connection } = require('./config/redis');
const { notification_queue_name, waitlist_queue_name } = require('./config/queue');
const pooling = require('./config/mysql_db');
const waitlistModel = require('./models/waitlistModel');
const { process_confirmation } = require('./controllers/notifications');
const { process_slot_freed } = require('./controllers/waitlist_jobs');

function watch(worker, label) {
  worker.on('completed', (job, result) => console.log(`[worker] ${label} job ${job.id} done: ${result}`));
  worker.on('failed', (job, err) => {
    const left = job && job.opts.attempts - job.attemptsMade;
    console.error(`[worker] ${label} job ${job && job.id} failed (attempt ${job && job.attemptsMade}/${job && job.opts.attempts}): ${err.message}${left > 0 && err.name !== 'UnrecoverableError' ? ' - will retry' : ''}`);
  });
  worker.on('error', (err) => console.error(`[worker] ${label} error:`, err.message));
}

// Confirmation messages: independent of each other, so several at once is fine.
const notification_worker = new Worker(notification_queue_name, process_confirmation, {
  connection: bull_connection,
  concurrency: 5,
});
watch(notification_worker, 'notification');

// Waitlist promotions: ONE at a time, so two promotions never fight over the same queue.
const waitlist_worker = new Worker(waitlist_queue_name, process_slot_freed, {
  connection: bull_connection,
  concurrency: 1,
});
watch(waitlist_worker, 'waitlist');

// On start-up, put back anyone a crashed worker left "in processing".
waitlistModel.recover_all()
  .then((n) => console.log(`[worker] MediBook worker started${n ? ` - restored ${n} waitlist entr${n === 1 ? 'y' : 'ies'} from a previous crash` : ''}`))
  .catch((err) => console.error('[worker] could not check for crashed promotions:', err.message));

// Ctrl+C / stop: finish the job in hand, then close cleanly.
async function shut_down() {
  console.log('[worker] shutting down...');
  await Promise.all([notification_worker.close(), waitlist_worker.close()]);
  await pooling.end();
  process.exit(0);
}
process.on('SIGINT', shut_down);
process.on('SIGTERM', shut_down);