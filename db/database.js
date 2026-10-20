const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'gis_bali.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite GIS Bali database at:', dbPath);
  }
});

// Helper for promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize schema
async function initDatabase() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      kabupaten TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      ticket_price TEXT,
      opening_hours TEXT,
      rating REAL DEFAULT 4.5,
      image_url TEXT,
      description TEXT,
      facilities TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Check if admin exists, else create default
  const admin = await dbGet('SELECT * FROM admins WHERE username = ?', ['admin']);
  if (!admin) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);
    await dbRun('INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)', ['admin', hash, 'superadmin']);
    console.log('Default admin created: username "admin", password "admin123"');
  }

  // Check if places table is empty, if so, seed
  const placeCount = await dbGet('SELECT COUNT(*) as count FROM places');
  if (placeCount && placeCount.count === 0) {
    console.log('Seeding initial Bali tourism data...');
    const seedPlaces = require('./seed-data');
    for (const p of seedPlaces) {
      await dbRun(`
        INSERT INTO places (
          name, category, kabupaten, latitude, longitude, address,
          ticket_price, opening_hours, rating, image_url, description, facilities
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.name, p.category, p.kabupaten, p.latitude, p.longitude, p.address || '',
        p.ticket_price || 'Rp 20.000', p.opening_hours || '08:00 - 18:00',
        p.rating || 4.5, p.image_url || '', p.description || '', p.facilities || ''
      ]);
    }
    console.log(`Seeded ${seedPlaces.length} tourism places successfully!`);
  }
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDatabase
};
