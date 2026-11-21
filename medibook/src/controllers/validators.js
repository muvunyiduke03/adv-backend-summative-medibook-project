const AppError =  require('./app_errors');
const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phone_regex = /^[0-9+()\-\s]{7,20}$/;
const int_max = 2147483647;

// This will help to parse ":id" from the url
function parseId(raw, label = 'id'){
  if (!/^[1-9]\d*$/.test(String(raw))){
    throw new AppError(400, `${label} must be a positive integer`);
  }
  const id = Number(raw);
  if (id > int_max) throw new AppError(400, `${label} is too large`);
  return id;
}

function validateFields(body, schema){
  if (body === null || typeof body !== 'object' || Array.isArray(body)){
    throw new AppError(400, 'Request body must be a JSON object');
  }

  const clean = {};
  const errors = [];

  for (const [field, spec] of Object.entries(schema)){
    let value = body[field];

    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      errors.push(`${field} is required!`);
      continue;
    }

    switch (spec.type){
      case 'string':
      case 'email':
      case 'phone':{
        if (typeof value !== 'string') {
          errors.push(`${field} must be a string!`);
          break;
        }
        
        value = value.trim();
        if (spec.max && value.length > spec.max){
          errors.push(`${field} must be at most ${spec.max} characters.`);
          break;
        }

        if (spec.type === 'email' && !email_regex.test(value)){
          errors.push(`${field} must be a valid email address.`);
          break;
        }

        if (spec.type === 'phone' && !phone_regex.test(value)){
          errors.push(`${field} must be a valid phone number (7 to 20) digits including ('+', '()', '-', and spaces)`);
          break;
        }

        clean[field] = spec.type === 'email' ? value.toLowerCase() : value;
        break;
      }
      case 'money': {
        const n = typeof value === 'string' ? Number(value) : value;
        if (typeof n !== 'number' || !Number.isFinite(n)) { errors.push(`${field} must be a number`); break; }
        if (n < 0) { errors.push(`${field} must be 0 or more`); break; }
        if (n > 99999999.99) { errors.push(`${field} is too large`); break; }
        if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-8) {
          errors.push(`${field} must have at most 2 decimal places`); break;
        }
        clean[field] = n;
        break;
      }
      default:
        throw new Error(`validateFields: unknown rule type "${spec.type}"`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, 'Validation failed', errors);
  }
  return clean;
}

function parse_date_time(raw, label = 'appt_datetime'){
  const m = typeof raw === 'string' && /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());

  if (!m) {
    throw new AppError(400, `${label} must look like this "YYYY-MM-DD HH:MM"`);
  }

  const [year, month, day, hour, minute] = m.slice(1, 6).map(Number);
  const second = m[6] ? Number(m[6]) : 0;
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
    throw new AppError(400, `${label} is not a real date of the calendar and time`);
  }
  return {date, year, month, day, hour, minute, second};
}

//This will have dates as 'YYYY-MM-DD HH:MM:SS'
const pad = (n) => String(n).padStart(2, '0');
function to_sql_date_time(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = {parseId, validateFields, parse_date_time, to_sql_date_time};
