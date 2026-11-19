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
    return clean;
  }
}

module.exports = {parseId, validateFields};