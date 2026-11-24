// BullMQ queue definitions. No business logic lives here.
const { Queue } = require('bullmq');
const { bull_connection } = require('./redis');

const notification_queue_name = 'notifications';
const waitlist_queue_name = 'waitlist';

// Every job is retried up to 5 times, waiting 1s, 2s, 4s, 8s between tries.
// A job that still fails stays in the "failed" set for a week so it can be inspected.
const default_job_options = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

// Created on first use, so the worker process does not open a producer connection it never needs.
let notification_queue = null;
function get_notification_queue() {
  if (!notification_queue) {
    notification_queue = new Queue(notification_queue_name, {
      connection: { ...bull_connection, enableOfflineQueue: false },
      defaultJobOptions: default_job_options,
    });
    notification_queue.on('error', (err) => console.error('notification queue:', err.message));
  }
  return notification_queue;
}

let waitlist_queue = null;
function get_waitlist_queue() {
  if (!waitlist_queue) {
    waitlist_queue = new Queue(waitlist_queue_name, {
      connection: { ...bull_connection, enableOfflineQueue: false },
      defaultJobOptions: default_job_options,
    });
    waitlist_queue.on('error', (err) => console.error('waitlist queue:', err.message));
  }
  return waitlist_queue;
}

module.exports = { notification_queue_name, get_notification_queue, waitlist_queue_name, get_waitlist_queue };