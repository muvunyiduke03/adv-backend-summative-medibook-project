//This will handle the waitlist. One list per queue

const {redis} = require('../config/redis');
const slot_key = (doctor_id, sql_datetime) =>
  `waitlist:slot:${doctor_id}:${sql_datetime.slice(0, 16).replace(' ', 'T')}`;
const day_key = (doctor_id, day) => `waitlist:day:${doctor_id}:${day}`;
const processing_key = (queue_key) => `${queue_key}:processing`;

const JOIN_SCRIPT = `
  if redis.call('LPOS', KEYS[1], ARGV[1]) then return -1 end
  return redis.call('RPUSH', KEYS[1], ARGV[1])
`;

async function join(key, patient_id) {
  const position = await redis.eval(JOIN_SCRIPT, 1, key, String(patient_id));
  return position === -1 ? null : position;
}

async function members(key) {
  const ids = await redis.lrange(key, 0, -1);
  return ids.map(Number);
}

async function leave(key, patient_id) {
  return (await redis.lrem(key, 1, String(patient_id))) > 0;
}

//when a patient is promoted, they will not be deleted.
async function claim_next(key){
  return redis.lmove(key, processing_key(key), 'LEFT', 'RIGHT');
}

//when the booking works we will forget the entry
async function complete(key, entry) {
  await redis.lrem(processing_key(key), 1, entry);
}

//when the booking does not work we go to the front of the queue again
async function requeue_front(key, entry) {
  const results = await redis.multi().lrem(processing_key(key), 1, entry).lpush(key, entry).exec();
  for (const [err] of results) if (err) throw err;
}

//this will handle the progress in event of a crash so that it is not lost
async function recover(key) {
  let moved = 0;
  while (await redis.lmove(processing_key(key), key, 'RIGHT', 'LEFT')) moved += 1;
  return moved;
}

async function recover_all() {
  let cursor = '0';
  let total = 0;
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', 'waitlist:*:processing', 'COUNT', 100);
    cursor = next;
    for (const processing of keys) {
      total += await recover(processing.slice(0, -':processing'.length));
    }
  } while (cursor !== '0');
  return total;
}

async function leave_day(doctor_id, day, patient_id) {
  const keys = [day_key(doctor_id, day)];
  let cursor = '0';
  do {
    const [next, found] = await redis.scan(cursor, 'MATCH', `waitlist:slot:${doctor_id}:${day}T*`, 'COUNT', 100);
    cursor = next;
    keys.push(...found.filter((k) => !k.endsWith(':processing')));
  } while (cursor !== '0');
  for (const key of keys) await redis.lrem(key, 0, String(patient_id));
}

module.exports = {slot_key, day_key, join, members, leave, claim_next, complete, requeue_front, recover, recover_all, leave_day};
