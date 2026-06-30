import db from './server/db.js'
try {
  const rows = db.prepare('SELECT * FROM log_monitor_config').all()
  console.log(JSON.stringify(rows, null, 2))
} catch (e) {
  console.error(e.message)
}
