require('dotenv').config();
const app = require('./app');
const {init_audit_log} = require('./controllers/audit_log');

const PORT = process.env.PORT || 3000;
init_audit_log();
app.listen(PORT, () => {
  console.log(`MediBook is live and running on http://localhost:${PORT}/api`);
});
