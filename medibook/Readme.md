# MediBook: clinic appointment API

Node.js and Express backend for booking clinic appointments. It uses MySQL 8 (3 tables, no ORM), a Redis waitlist, BullMQ background jobs run by a separate worker process, a file-based audit log, Jest unit tests, and a translated feedback page.

## Video walkthrough:   https://youtu.be/MZUEt7ntpd0

## Stack

- Node.js 18+, Express, `mysql2/promise` (parameterised queries only)
- MySQL 8: `patients`, `doctors`, `appointments`
- Redis 7 (Docker) and BullMQ for the waitlist and notification jobs
- Jest for unit tests

## Setup

### 1. Install

```bash
npm install
```

### 2. Environment

Copy `.env.example` to `.env` and fill in your MySQL password.

```bash
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

### 3. MySQL

Create the schema and load the sample data:

```bash
mysql -u root -p < database/schema.sql
mysql -u root -p medibook < database/seed.sql
```

On PowerShell, `<` is not supported, so use:

```powershell
Get-Content database\schema.sql | mysql -u root -p
Get-Content database\seed.sql | mysql -u root -p medibook
```

Re-run both files to reset the data.

### 4. Redis

```bash
docker run -d --name medibook-redis -p 6379:6379 -v medibook-redis-data:/data redis:7 redis-server --appendonly yes
docker exec medibook-redis redis-cli ping     # PONG
```

The volume and `--appendonly yes` keep the waitlist after a restart. Later runs: `docker start medibook-redis`.

### 5. Run

Two processes, in two terminals:

```bash
npm start            # API on http://localhost:3000/api
npm run worker       # worker for notifications and waitlist promotion
```

For development use `npm run dev` and `npm run worker:dev`, which restart on file changes.

### 6. Tests

```bash
npm test
```

The tests need no MySQL or Redis.

## Project structure

```
database/    schema.sql, seed.sql
locales/     en.json, fr.json
logs/        audit.log (created at runtime, not committed)
src/
  config/       mysql_db.js, redis.js, queue.js
  controllers/  request handling, validation, business rules, jobs
  models/       all SQL (and the Redis waitlist access)
  routes/       route definitions
  app.js, server.js, worker.js
tests/       Jest unit tests
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/patients`, `/api/doctors` | List and create |
| GET/PUT/DELETE | `/api/patients/:id`, `/api/doctors/:id` | Read, update, delete |
| GET | `/api/appointments` | List, filter by `doctor_id`, `patient_id`, `status` |
| GET | `/api/appointments/:id` | One appointment |
| POST | `/api/appointments` | Book `{patient_id, doctor_id, appt_datetime}` |
| POST | `/api/appointments/:id/cancellation` | Cancel and refund |
| GET | `/api/reports/...` | Doctor and busy-day reports (<fill in exact paths>) |
| POST/GET/DELETE | `/api/waitlist` | Join, view and leave the waitlist |
| GET | `/api/health` | Health check |
| GET | `/feedback?lang=en\|fr` | Course feedback page |

Status codes: 400 malformed input, 404 not found, 409 conflict, 422 rule violation, 503 Redis unavailable (waitlist only).

## Design justifications

### Part C: appointments and refunds

**Booking is a transaction.** It locks the doctor's row with `SELECT ... FOR UPDATE`, so bookings for the same doctor queue up. Inside the lock it checks that the slot is free and counts that day's live appointments against the daily cap of 12. The unique key on `(doctor_id, active_slot)` is a second safety net.

**Cancelled slots can be re-booked.** `active_slot` is a generated column that is `NULL` when the status is `CANCELLED`. A unique key ignores `NULL`s, so a cancelled slot is free again while the cancelled row stays for the refund history.

**Refunds are decided by the server.** The client sends no amounts. Refund tiers, by notice before the appointment:

| Notice | Refund |
|---|---|
| More than 48 hours | 100% |
| 24 hours up to and including 48 hours | 50% |
| Under 24 hours | 0% |

Exactly 48 hours falls in the 50% tier and exactly 24 hours is also 50%. The unit tests pin both boundaries. The refund amount is calculated in SQL with `DECIMAL` maths, so money never goes through floating point. Cancelling is a transaction with a row lock, so two cancellations of the same appointment cannot both succeed.

**Status codes.** 409 is for conflicts with existing data (slot taken, day full, already cancelled). 422 is for well-formed requests that break a rule (not on a 30-minute boundary, outside 09:00 to 16:30, in the past). 400 is for malformed input.

### Part D: audit log

Business events (`BOOKING_CREATED`, `APPOINTMENT_CANCELLED`, `NOTIFICATION_SENT` and the waitlist events) are appended to `logs/audit.log` as one JSON object per line, using `fs/promises`. One line per event is easy to read and to process with standard tools, and appending needs no locking. Failing to write a line must never fail a booking, so the API logs the problem and carries on. The worker uses a version that throws, so a failed write makes the job retry. Email addresses and phone numbers in the log are masked. The log is not committed to git.

### Part E: waitlist and notifications

**Why Redis lists.** The waitlist is a first-in, first-out queue. Joining is a single atomic Lua script, so two people cannot take the same position or join twice. There is one queue per exact slot (`waitlist:slot:<doctor>:<datetime>`) and one per day (`waitlist:day:<doctor>:<date>`) for a day that is full. When a slot is freed the slot queue is checked first, then the day queue.

**Why BullMQ and a separate worker.** Confirmations and promotions run outside the request. The API responds straight away, and a slow or failing job cannot block it. Jobs retry up to 5 times with exponential backoff. Jobs are named after the appointment, so a duplicate request cannot create a duplicate job.

**Reliability.**
- A promotion moves the person from the queue into a `:processing` list first and removes them only after the booking commits. If the worker crashes in between, the entry is put back on start-up.
- If the slot was taken or the patient no longer exists, the entry is dropped for good and the next person is tried.
- MySQL and Redis cannot share a transaction. After joining, the API checks again whether the slot was freed in the meantime and starts a promotion if so.
- The waitlist worker runs with concurrency 1 so promotions for the same queue happen in order.
- If Redis is down, booking and cancellation still work, and only joining the waitlist returns 503.

## i18n

`/feedback` renders five questions, the title, the instructions and today's date (using `Intl.DateTimeFormat`) from `locales/en.json` or `locales/fr.json`. Visit `/feedback?lang=fr` for French. A missing or unsupported `lang` falls back to English.

## Testing

`npm test` runs three Jest files: refund tiers and both boundaries, date parsing, and the booking slot rules (09:15, 16:30, 17:00, malformed input). A Postman collection for the waitlist and notification flows is described in the demo notes.