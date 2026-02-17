import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'jouw-geheime-sleutel-wijzig-dit-in-productie';

// Trust proxy for Railway/Heroku (needed for rate limiting behind reverse proxy)
app.set('trust proxy', 1);
const DB_PATH = path.join(__dirname, 'rooster.db');

// Database initialization
let db;

async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      naam TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      wachtwoord_hash TEXT NOT NULL,
      rol TEXT DEFAULT 'medewerker' CHECK(rol IN ('medewerker', 'manager')),
      afdeling TEXT,
      telefoon TEXT,
      aanstellingsdatum TEXT DEFAULT CURRENT_DATE,
      vakantiesaldo REAL DEFAULT 25,
      actief INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medewerker_id INTEGER NOT NULL,
      datum TEXT NOT NULL,
      starttijd TEXT NOT NULL,
      eindtijd TEXT NOT NULL,
      pauze INTEGER DEFAULT 0,
      afdeling TEXT,
      status TEXT DEFAULT 'concept' CHECK(status IN ('concept', 'gepubliceerd', 'afgerond')),
      notities TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medewerker_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS time_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medewerker_id INTEGER NOT NULL,
      shift_id INTEGER,
      datum TEXT NOT NULL,
      inchecktijd TEXT,
      uitchecktijd TEXT,
      pauze_minuten INTEGER DEFAULT 0,
      goedgekeurd INTEGER DEFAULT 0,
      notities TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medewerker_id) REFERENCES users(id),
      FOREIGN KEY (shift_id) REFERENCES shifts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medewerker_id INTEGER NOT NULL,
      begindatum TEXT NOT NULL,
      einddatum TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('vakantie', 'zorgverlof', 'bijzonder_verlof', 'onbetaald_verlof', 'ziekte')),
      status TEXT DEFAULT 'in_behandeling' CHECK(status IN ('in_behandeling', 'goedgekeurd', 'afgewezen')),
      opmerking TEXT,
      beoordeling_door INTEGER,
      beoordeling_opmerking TEXT,
      aantal_dagen REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medewerker_id) REFERENCES users(id),
      FOREIGN KEY (beoordeling_door) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medewerker_id INTEGER NOT NULL,
      dag_van_week INTEGER NOT NULL CHECK(dag_van_week >= 0 AND dag_van_week <= 6),
      beschikbaar_van TEXT,
      beschikbaar_tot TEXT,
      beschikbaar INTEGER DEFAULT 1,
      type TEXT DEFAULT 'vast' CHECK(type IN ('vast', 'uitzondering')),
      datum TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medewerker_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS shift_swaps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      aanvrager_id INTEGER NOT NULL,
      ontvanger_id INTEGER NOT NULL,
      shift_aanvrager_id INTEGER NOT NULL,
      shift_ontvanger_id INTEGER,
      status TEXT DEFAULT 'verzonden' CHECK(status IN ('verzonden', 'geaccepteerd', 'geweigerd', 'goedgekeurd', 'afgekeurd')),
      opmerking TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aanvrager_id) REFERENCES users(id),
      FOREIGN KEY (ontvanger_id) REFERENCES users(id),
      FOREIGN KEY (shift_aanvrager_id) REFERENCES shifts(id),
      FOREIGN KEY (shift_ontvanger_id) REFERENCES shifts(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ontvanger_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      titel TEXT NOT NULL,
      bericht TEXT,
      link TEXT,
      gelezen INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ontvanger_id) REFERENCES users(id)
    )
  `);

  // Invitations table for employee registration
  db.run(`
    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      naam TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      rol TEXT DEFAULT 'medewerker',
      afdeling TEXT,
      gebruikt INTEGER DEFAULT 0,
      vervalt_op TEXT NOT NULL,
      aangemaakt_door INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (aangemaakt_door) REFERENCES users(id)
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_shifts_datum ON shifts(datum)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_shifts_medewerker ON shifts(medewerker_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leave_medewerker ON leave_requests(medewerker_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_ontvanger ON notifications(ontvanger_id)`);

  // Create default admin user if none exists
  const users = db.exec(`SELECT COUNT(*) as count FROM users`);
  if (users[0].values[0][0] === 0) {
    // Create admin account for Bart
    const hash = bcrypt.hashSync('WelkomRooster2026!', 10);
    db.run(`INSERT INTO users (naam, email, wachtwoord_hash, rol, afdeling) VALUES (?, ?, ?, ?, ?)`,
      ['Bart De Smedt', 'bart@fidfinance.nl', hash, 'manager', 'Beheer']
    );
    
    saveDatabase();
  }

  console.log('Database initialized');
}

function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// Helper function to run queries
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results[0] || null;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  return { lastID: db.exec("SELECT last_insert_rowid()")[0]?.values[0][0] };
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Geen toegangstoken' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Ongeldig of verlopen token' });
    req.user = decoded;
    next();
  });
}

function requireManager(req, res, next) {
  if (req.user.rol !== 'manager') {
    return res.status(403).json({ error: 'Alleen toegankelijk voor managers' });
  }
  next();
}

// ======= AUTH ROUTES =======

// Setup initial admin account (only works if no users exist)
app.post('/api/auth/setup-admin', async (req, res) => {
  try {
    const { email, password, naam } = req.body;
    
    // Check if any users exist
    const userCount = dbGet('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count > 0) {
      return res.status(400).json({ error: 'Er bestaat al een admin account' });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    dbRun(
      'INSERT INTO users (naam, email, wachtwoord_hash, rol, afdeling) VALUES (?, ?, ?, ?, ?)',
      [naam, email, hash, 'manager', 'Beheer']
    );
    
    res.json({ message: 'Admin account aangemaakt', email });
  } catch (error) {
    console.error('Setup admin error:', error);
    res.status(500).json({ error: 'Fout bij aanmaken admin' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, wachtwoord } = req.body;
    
    const user = dbGet('SELECT * FROM users WHERE email = ? AND actief = 1', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }
    
    const validPassword = bcrypt.compareSync(wachtwoord, user.wachtwoord_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens' });
    }
    
    const token = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    delete user.wachtwoord_hash;
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Serverfout bij inloggen' });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  try {
    const user = dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Gebruiker niet gevonden' });
    delete user.wachtwoord_hash;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Serverfout' });
  }
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  try {
    const { naam, telefoon } = req.body;
    dbRun('UPDATE users SET naam = ?, telefoon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [naam, telefoon, req.user.id]
    );
    const user = dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    delete user.wachtwoord_hash;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij bijwerken profiel' });
  }
});

app.post('/api/auth/change-password', authenticateToken, (req, res) => {
  try {
    const { huidigWachtwoord, nieuwWachtwoord } = req.body;
    const user = dbGet('SELECT * FROM users WHERE id = ?', [req.user.id]);
    
    if (!bcrypt.compareSync(huidigWachtwoord, user.wachtwoord_hash)) {
      return res.status(400).json({ error: 'Huidig wachtwoord is onjuist' });
    }
    
    const hash = bcrypt.hashSync(nieuwWachtwoord, 10);
    dbRun('UPDATE users SET wachtwoord_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hash, req.user.id]
    );
    
    res.json({ message: 'Wachtwoord gewijzigd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij wijzigen wachtwoord' });
  }
});

// ======= INVITATION ROUTES =======

// Generate random token
function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Create invitation (manager only)
app.post('/api/invitations', authenticateToken, requireManager, (req, res) => {
  try {
    const { email, naam, rol, afdeling } = req.body;
    
    // Check if email already exists
    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'E-mailadres is al in gebruik' });
    }
    
    // Check if invitation already exists
    const existingInvite = dbGet('SELECT id FROM invitations WHERE email = ? AND gebruikt = 0', [email]);
    if (existingInvite) {
      return res.status(400).json({ error: 'Er is al een uitnodiging voor dit e-mailadres' });
    }
    
    const token = generateToken();
    const vervaltOp = new Date();
    vervaltOp.setDate(vervaltOp.getDate() + 7); // Valid for 7 days
    
    dbRun(
      'INSERT INTO invitations (email, naam, token, rol, afdeling, vervalt_op, aangemaakt_door) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email, naam, token, rol || 'medewerker', afdeling, vervaltOp.toISOString(), req.user.id]
    );
    
    const invitation = dbGet('SELECT * FROM invitations WHERE token = ?', [token]);
    res.status(201).json({
      ...invitation,
      link: `${process.env.FRONTEND_URL || 'https://rooster-planning.netlify.app'}/registreer/${token}`
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ error: 'Fout bij aanmaken uitnodiging' });
  }
});

// Get all invitations (manager only)
app.get('/api/invitations', authenticateToken, requireManager, (req, res) => {
  try {
    const invitations = dbAll(`
      SELECT i.*, u.naam as aangemaakt_door_naam 
      FROM invitations i 
      JOIN users u ON i.aangemaakt_door = u.id 
      ORDER BY i.created_at DESC
    `);
    res.json(invitations.map(inv => ({
      ...inv,
      link: `${process.env.FRONTEND_URL || 'https://rooster-planning.netlify.app'}/registreer/${inv.token}`
    })));
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen uitnodigingen' });
  }
});

// Delete invitation (manager only)
app.delete('/api/invitations/:id', authenticateToken, requireManager, (req, res) => {
  try {
    dbRun('DELETE FROM invitations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Uitnodiging verwijderd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwijderen uitnodiging' });
  }
});

// Verify invitation token (public - for registration page)
app.get('/api/invitations/verify/:token', (req, res) => {
  try {
    const invitation = dbGet(
      'SELECT * FROM invitations WHERE token = ? AND gebruikt = 0',
      [req.params.token]
    );
    
    if (!invitation) {
      return res.status(404).json({ error: 'Uitnodiging niet gevonden of al gebruikt' });
    }
    
    if (new Date(invitation.vervalt_op) < new Date()) {
      return res.status(400).json({ error: 'Uitnodiging is verlopen' });
    }
    
    res.json({
      email: invitation.email,
      naam: invitation.naam,
      afdeling: invitation.afdeling
    });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verifiëren uitnodiging' });
  }
});

// Register with invitation token (public)
app.post('/api/register', (req, res) => {
  try {
    const { token, wachtwoord } = req.body;
    
    const invitation = dbGet(
      'SELECT * FROM invitations WHERE token = ? AND gebruikt = 0',
      [token]
    );
    
    if (!invitation) {
      return res.status(404).json({ error: 'Uitnodiging niet gevonden of al gebruikt' });
    }
    
    if (new Date(invitation.vervalt_op) < new Date()) {
      return res.status(400).json({ error: 'Uitnodiging is verlopen' });
    }
    
    // Check password strength
    if (!wachtwoord || wachtwoord.length < 8) {
      return res.status(400).json({ error: 'Wachtwoord moet minimaal 8 tekens zijn' });
    }
    
    // Create user
    const hash = bcrypt.hashSync(wachtwoord, 10);
    dbRun(
      'INSERT INTO users (naam, email, wachtwoord_hash, rol, afdeling) VALUES (?, ?, ?, ?, ?)',
      [invitation.naam, invitation.email, hash, invitation.rol, invitation.afdeling]
    );
    
    // Mark invitation as used
    dbRun('UPDATE invitations SET gebruikt = 1 WHERE id = ?', [invitation.id]);
    
    // Get created user by email (more reliable than lastID)
    const user = dbGet('SELECT * FROM users WHERE email = ?', [invitation.email]);
    if (!user) {
      return res.status(500).json({ error: 'Account aangemaakt maar kon niet worden opgehaald' });
    }
    delete user.wachtwoord_hash;
    
    // Create JWT token so user is logged in immediately
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    
    res.status(201).json({ token: jwtToken, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Fout bij registreren' });
  }
});

// ======= USER ROUTES =======

app.get('/api/users', authenticateToken, requireManager, (req, res) => {
  try {
    const users = dbAll('SELECT * FROM users ORDER BY naam');
    res.json(users.map(u => { delete u.wachtwoord_hash; return u; }));
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen gebruikers' });
  }
});

app.get('/api/employees', authenticateToken, (req, res) => {
  try {
    const users = dbAll('SELECT id, naam, email, afdeling, rol FROM users WHERE actief = 1 ORDER BY naam');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen medewerkers' });
  }
});

app.post('/api/users', authenticateToken, requireManager, (req, res) => {
  try {
    const { naam, email, wachtwoord, rol, afdeling, vakantiesaldo } = req.body;
    
    const existing = dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(400).json({ error: 'E-mailadres is al in gebruik' });
    }
    
    const hash = bcrypt.hashSync(wachtwoord, 10);
    dbRun(
      'INSERT INTO users (naam, email, wachtwoord_hash, rol, afdeling, vakantiesaldo) VALUES (?, ?, ?, ?, ?, ?)',
      [naam, email, hash, rol || 'medewerker', afdeling, vakantiesaldo || 25]
    );
    
    const user = dbGet('SELECT * FROM users WHERE email = ?', [email]);
    delete user.wachtwoord_hash;
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij aanmaken gebruiker' });
  }
});

app.put('/api/users/:id', authenticateToken, requireManager, (req, res) => {
  try {
    const { naam, email, wachtwoord, rol, afdeling, vakantiesaldo, actief } = req.body;
    
    let sql = 'UPDATE users SET naam = ?, email = ?, rol = ?, afdeling = ?, vakantiesaldo = ?, actief = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    let params = [naam, email, rol, afdeling, vakantiesaldo, actief ? 1 : 0, req.params.id];
    
    if (wachtwoord) {
      const hash = bcrypt.hashSync(wachtwoord, 10);
      sql = 'UPDATE users SET naam = ?, email = ?, wachtwoord_hash = ?, rol = ?, afdeling = ?, vakantiesaldo = ?, actief = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
      params = [naam, email, hash, rol, afdeling, vakantiesaldo, actief ? 1 : 0, req.params.id];
    }
    
    dbRun(sql, params);
    const user = dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
    delete user.wachtwoord_hash;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij bijwerken gebruiker' });
  }
});

app.delete('/api/users/:id', authenticateToken, requireManager, (req, res) => {
  try {
    dbRun('UPDATE users SET actief = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ message: 'Gebruiker gedeactiveerd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij deactiveren gebruiker' });
  }
});

// ======= SHIFT ROUTES =======

app.get('/api/shifts', authenticateToken, (req, res) => {
  try {
    const { startDatum, eindDatum, medewerker_id } = req.query;
    
    let sql = `
      SELECT s.*, u.naam as medewerker_naam 
      FROM shifts s 
      JOIN users u ON s.medewerker_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (startDatum) {
      sql += ' AND s.datum >= ?';
      params.push(startDatum);
    }
    if (eindDatum) {
      sql += ' AND s.datum <= ?';
      params.push(eindDatum);
    }
    if (medewerker_id) {
      sql += ' AND s.medewerker_id = ?';
      params.push(medewerker_id);
    }
    
    // Non-managers can only see published shifts
    if (req.user.rol !== 'manager') {
      sql += ' AND (s.status = ? OR s.medewerker_id = ?)';
      params.push('gepubliceerd', req.user.id);
    }
    
    sql += ' ORDER BY s.datum, s.starttijd';
    
    const shifts = dbAll(sql, params);
    res.json(shifts);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen diensten' });
  }
});

app.post('/api/shifts', authenticateToken, requireManager, (req, res) => {
  try {
    const { medewerker_id, datum, starttijd, eindtijd, pauze, afdeling, status, notities } = req.body;
    
    dbRun(
      'INSERT INTO shifts (medewerker_id, datum, starttijd, eindtijd, pauze, afdeling, status, notities) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [medewerker_id, datum, starttijd, eindtijd, pauze || 0, afdeling, status || 'concept', notities]
    );
    
    const shift = dbGet('SELECT s.*, u.naam as medewerker_naam FROM shifts s JOIN users u ON s.medewerker_id = u.id WHERE s.medewerker_id = ? AND s.datum = ? AND s.starttijd = ? ORDER BY s.id DESC LIMIT 1', [medewerker_id, datum, starttijd]);
    res.status(201).json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij aanmaken dienst' });
  }
});

app.put('/api/shifts/:id', authenticateToken, requireManager, (req, res) => {
  try {
    const { medewerker_id, datum, starttijd, eindtijd, pauze, afdeling, status, notities } = req.body;
    
    dbRun(
      'UPDATE shifts SET medewerker_id = ?, datum = ?, starttijd = ?, eindtijd = ?, pauze = ?, afdeling = ?, status = ?, notities = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [medewerker_id, datum, starttijd, eindtijd, pauze, afdeling, status, notities, req.params.id]
    );
    
    const shift = dbGet('SELECT s.*, u.naam as medewerker_naam FROM shifts s JOIN users u ON s.medewerker_id = u.id WHERE s.id = ?', [req.params.id]);
    res.json(shift);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij bijwerken dienst' });
  }
});

app.delete('/api/shifts/:id', authenticateToken, requireManager, (req, res) => {
  try {
    dbRun('DELETE FROM shifts WHERE id = ?', [req.params.id]);
    res.json({ message: 'Dienst verwijderd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwijderen dienst' });
  }
});

app.post('/api/shifts/publish', authenticateToken, requireManager, (req, res) => {
  try {
    const { startDatum, eindDatum } = req.body;
    
    dbRun(
      'UPDATE shifts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE datum >= ? AND datum <= ? AND status = ?',
      ['gepubliceerd', startDatum, eindDatum, 'concept']
    );
    
    // Create notifications for all employees with shifts in this period
    const employees = dbAll(
      'SELECT DISTINCT medewerker_id FROM shifts WHERE datum >= ? AND datum <= ?',
      [startDatum, eindDatum]
    );
    
    for (const emp of employees) {
      dbRun(
        'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
        [emp.medewerker_id, 'rooster', 'Nieuw rooster gepubliceerd', `Het rooster voor ${startDatum} t/m ${eindDatum} is gepubliceerd.`, '/rooster']
      );
    }
    
    res.json({ message: 'Rooster gepubliceerd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij publiceren rooster' });
  }
});

// ======= TIME REGISTRATION ROUTES =======

app.get('/api/time-registrations', authenticateToken, (req, res) => {
  try {
    const { startDatum, eindDatum, medewerker_id } = req.query;
    
    let sql = `
      SELECT t.*, u.naam as medewerker_naam, s.starttijd as gepland_start, s.eindtijd as gepland_eind
      FROM time_registrations t 
      JOIN users u ON t.medewerker_id = u.id 
      LEFT JOIN shifts s ON t.shift_id = s.id
      WHERE 1=1
    `;
    const params = [];
    
    // Non-managers can only see their own registrations
    if (req.user.rol !== 'manager') {
      sql += ' AND t.medewerker_id = ?';
      params.push(req.user.id);
    } else if (medewerker_id) {
      sql += ' AND t.medewerker_id = ?';
      params.push(medewerker_id);
    }
    
    if (startDatum) {
      sql += ' AND t.datum >= ?';
      params.push(startDatum);
    }
    if (eindDatum) {
      sql += ' AND t.datum <= ?';
      params.push(eindDatum);
    }
    
    sql += ' ORDER BY t.datum DESC, t.inchecktijd DESC';
    
    const registrations = dbAll(sql, params);
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen urenregistraties' });
  }
});

app.post('/api/time-registrations/checkin', authenticateToken, (req, res) => {
  try {
    const datum = new Date().toISOString().split('T')[0];
    const tijd = new Date().toTimeString().slice(0, 5);
    
    // Check if already checked in today
    const existing = dbGet(
      'SELECT * FROM time_registrations WHERE medewerker_id = ? AND datum = ? AND uitchecktijd IS NULL',
      [req.user.id, datum]
    );
    
    if (existing) {
      return res.status(400).json({ error: 'Je bent al ingecheckt vandaag' });
    }
    
    // Find matching shift
    const shift = dbGet(
      'SELECT id FROM shifts WHERE medewerker_id = ? AND datum = ?',
      [req.user.id, datum]
    );
    
    dbRun(
      'INSERT INTO time_registrations (medewerker_id, shift_id, datum, inchecktijd) VALUES (?, ?, ?, ?)',
      [req.user.id, shift?.id || null, datum, tijd]
    );
    
    const registration = dbGet('SELECT * FROM time_registrations WHERE medewerker_id = ? AND datum = ? ORDER BY id DESC LIMIT 1', [req.user.id, datum]);
    res.status(201).json(registration);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij inchecken' });
  }
});

app.post('/api/time-registrations/checkout', authenticateToken, (req, res) => {
  try {
    const datum = new Date().toISOString().split('T')[0];
    const tijd = new Date().toTimeString().slice(0, 5);
    
    const existing = dbGet(
      'SELECT * FROM time_registrations WHERE medewerker_id = ? AND datum = ? AND uitchecktijd IS NULL',
      [req.user.id, datum]
    );
    
    if (!existing) {
      return res.status(400).json({ error: 'Je bent nog niet ingecheckt vandaag' });
    }
    
    dbRun(
      'UPDATE time_registrations SET uitchecktijd = ? WHERE id = ?',
      [tijd, existing.id]
    );
    
    const registration = dbGet('SELECT * FROM time_registrations WHERE id = ?', [existing.id]);
    res.json(registration);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij uitchecken' });
  }
});

app.post('/api/time-registrations', authenticateToken, (req, res) => {
  try {
    const { datum, inchecktijd, uitchecktijd, pauze_minuten, notities } = req.body;
    
    // Find matching shift
    const shift = dbGet(
      'SELECT id FROM shifts WHERE medewerker_id = ? AND datum = ?',
      [req.user.id, datum]
    );
    
    dbRun(
      'INSERT INTO time_registrations (medewerker_id, shift_id, datum, inchecktijd, uitchecktijd, pauze_minuten, notities) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, shift?.id || null, datum, inchecktijd, uitchecktijd, pauze_minuten || 0, notities]
    );
    
    const registration = dbGet('SELECT * FROM time_registrations WHERE medewerker_id = ? AND datum = ? ORDER BY id DESC LIMIT 1', [req.user.id, datum]);
    res.status(201).json(registration);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij registreren uren' });
  }
});

app.put('/api/time-registrations/:id', authenticateToken, (req, res) => {
  try {
    const reg = dbGet('SELECT * FROM time_registrations WHERE id = ?', [req.params.id]);
    
    // Only owner or manager can edit
    if (req.user.rol !== 'manager' && reg.medewerker_id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    
    const { inchecktijd, uitchecktijd, pauze_minuten, goedgekeurd, notities } = req.body;
    
    dbRun(
      'UPDATE time_registrations SET inchecktijd = ?, uitchecktijd = ?, pauze_minuten = ?, goedgekeurd = ?, notities = ? WHERE id = ?',
      [inchecktijd, uitchecktijd, pauze_minuten, goedgekeurd ? 1 : 0, notities, req.params.id]
    );
    
    const registration = dbGet('SELECT * FROM time_registrations WHERE id = ?', [req.params.id]);
    res.json(registration);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij bijwerken registratie' });
  }
});

app.delete('/api/time-registrations/:id', authenticateToken, (req, res) => {
  try {
    const reg = dbGet('SELECT * FROM time_registrations WHERE id = ?', [req.params.id]);
    
    if (req.user.rol !== 'manager' && reg.medewerker_id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    
    dbRun('DELETE FROM time_registrations WHERE id = ?', [req.params.id]);
    res.json({ message: 'Registratie verwijderd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwijderen registratie' });
  }
});

// ======= LEAVE REQUEST ROUTES =======

app.get('/api/leave-requests', authenticateToken, (req, res) => {
  try {
    const { status, medewerker_id } = req.query;
    
    let sql = `
      SELECT l.*, u.naam as medewerker_naam 
      FROM leave_requests l 
      JOIN users u ON l.medewerker_id = u.id 
      WHERE 1=1
    `;
    const params = [];
    
    if (req.user.rol !== 'manager') {
      sql += ' AND l.medewerker_id = ?';
      params.push(req.user.id);
    } else if (medewerker_id) {
      sql += ' AND l.medewerker_id = ?';
      params.push(medewerker_id);
    }
    
    if (status) {
      sql += ' AND l.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY l.created_at DESC';
    
    const requests = dbAll(sql, params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen verlofaanvragen' });
  }
});

app.post('/api/leave-requests', authenticateToken, (req, res) => {
  try {
    const { begindatum, einddatum, type, opmerking } = req.body;
    
    // Calculate work days
    let days = 0;
    const start = new Date(begindatum);
    const end = new Date(einddatum);
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    
    // Check vacation balance if type is vakantie
    if (type === 'vakantie') {
      const user = dbGet('SELECT vakantiesaldo FROM users WHERE id = ?', [req.user.id]);
      if (days > user.vakantiesaldo) {
        return res.status(400).json({ error: 'Onvoldoende vakantiesaldo' });
      }
    }
    
    dbRun(
      'INSERT INTO leave_requests (medewerker_id, begindatum, einddatum, type, opmerking, aantal_dagen) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, begindatum, einddatum, type, opmerking, days]
    );
    
    // Notify managers
    const managers = dbAll('SELECT id FROM users WHERE rol = ? AND actief = 1', ['manager']);
    for (const manager of managers) {
      dbRun(
        'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
        [manager.id, 'verlof', 'Nieuwe verlofaanvraag', `Nieuwe ${type} aanvraag ontvangen.`, '/vakantie/beheer']
      );
    }
    
    const request = dbGet('SELECT * FROM leave_requests WHERE medewerker_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij indienen aanvraag' });
  }
});

app.post('/api/leave-requests/:id/process', authenticateToken, requireManager, (req, res) => {
  try {
    const { status, opmerking } = req.body;
    const request = dbGet('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
    
    if (!request) {
      return res.status(404).json({ error: 'Aanvraag niet gevonden' });
    }
    
    dbRun(
      'UPDATE leave_requests SET status = ?, beoordeling_door = ?, beoordeling_opmerking = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, req.user.id, opmerking, req.params.id]
    );
    
    // Update vacation balance if approved and type is vakantie
    if (status === 'goedgekeurd' && request.type === 'vakantie') {
      dbRun(
        'UPDATE users SET vakantiesaldo = vakantiesaldo - ? WHERE id = ?',
        [request.aantal_dagen, request.medewerker_id]
      );
    }
    
    // Notify employee
    dbRun(
      'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
      [request.medewerker_id, 'verlof', `Verlofaanvraag ${status}`, `Je verlofaanvraag is ${status}.`, '/vakantie']
    );
    
    const updated = dbGet('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwerken aanvraag' });
  }
});

app.delete('/api/leave-requests/:id', authenticateToken, (req, res) => {
  try {
    const request = dbGet('SELECT * FROM leave_requests WHERE id = ?', [req.params.id]);
    
    if (req.user.rol !== 'manager' && request.medewerker_id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    
    if (request.status !== 'in_behandeling') {
      return res.status(400).json({ error: 'Kan alleen aanvragen in behandeling annuleren' });
    }
    
    dbRun('DELETE FROM leave_requests WHERE id = ?', [req.params.id]);
    res.json({ message: 'Aanvraag geannuleerd' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij annuleren aanvraag' });
  }
});

// ======= AVAILABILITY ROUTES =======

app.get('/api/availability', authenticateToken, (req, res) => {
  try {
    const medewerker_id = req.query.medewerker_id || req.user.id;
    
    if (req.user.rol !== 'manager' && medewerker_id != req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    
    const availability = dbAll(
      'SELECT * FROM availability WHERE medewerker_id = ? ORDER BY dag_van_week',
      [medewerker_id]
    );
    res.json(availability);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen beschikbaarheid' });
  }
});

app.post('/api/availability', authenticateToken, (req, res) => {
  try {
    const { dag_van_week, beschikbaar_van, beschikbaar_tot, beschikbaar, type, datum } = req.body;
    
    // Delete existing entry for this day
    dbRun(
      'DELETE FROM availability WHERE medewerker_id = ? AND dag_van_week = ? AND type = ?',
      [req.user.id, dag_van_week, type || 'vast']
    );
    
    dbRun(
      'INSERT INTO availability (medewerker_id, dag_van_week, beschikbaar_van, beschikbaar_tot, beschikbaar, type, datum) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, dag_van_week, beschikbaar_van, beschikbaar_tot, beschikbaar ? 1 : 0, type || 'vast', datum]
    );
    
    const availability = dbGet('SELECT * FROM availability WHERE medewerker_id = ? AND dag_van_week = ? ORDER BY id DESC LIMIT 1', [req.user.id, dag_van_week]);
    res.status(201).json(availability);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij opslaan beschikbaarheid' });
  }
});

// ======= SHIFT SWAP ROUTES =======

app.get('/api/shift-swaps', authenticateToken, (req, res) => {
  try {
    let sql = `
      SELECT sw.*,
        a.naam as aanvrager_naam,
        o.naam as ontvanger_naam,
        sa.datum as shift_aanvrager_datum,
        sa.starttijd as shift_aanvrager_start,
        sa.eindtijd as shift_aanvrager_eind,
        so.datum as shift_ontvanger_datum,
        so.starttijd as shift_ontvanger_start,
        so.eindtijd as shift_ontvanger_eind
      FROM shift_swaps sw
      JOIN users a ON sw.aanvrager_id = a.id
      JOIN users o ON sw.ontvanger_id = o.id
      JOIN shifts sa ON sw.shift_aanvrager_id = sa.id
      LEFT JOIN shifts so ON sw.shift_ontvanger_id = so.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.user.rol !== 'manager') {
      sql += ' AND (sw.aanvrager_id = ? OR sw.ontvanger_id = ?)';
      params.push(req.user.id, req.user.id);
    }
    
    sql += ' ORDER BY sw.created_at DESC';
    
    const swaps = dbAll(sql, params);
    res.json(swaps);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen ruilverzoeken' });
  }
});

app.post('/api/shift-swaps', authenticateToken, (req, res) => {
  try {
    const { shift_aanvrager_id, ontvanger_id, opmerking } = req.body;
    
    dbRun(
      'INSERT INTO shift_swaps (aanvrager_id, ontvanger_id, shift_aanvrager_id, opmerking) VALUES (?, ?, ?, ?)',
      [req.user.id, ontvanger_id, shift_aanvrager_id, opmerking]
    );
    
    // Notify recipient
    dbRun(
      'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
      [ontvanger_id, 'dienstruil', 'Nieuw ruilverzoek', 'Je hebt een nieuw ruilverzoek ontvangen.', '/dienstruil']
    );
    
    const swap = dbGet('SELECT * FROM shift_swaps WHERE aanvrager_id = ? ORDER BY id DESC LIMIT 1', [req.user.id]);
    res.status(201).json(swap);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij aanmaken ruilverzoek' });
  }
});

app.post('/api/shift-swaps/:id/respond', authenticateToken, (req, res) => {
  try {
    const { actie } = req.body;
    const swap = dbGet('SELECT * FROM shift_swaps WHERE id = ?', [req.params.id]);
    
    if (swap.ontvanger_id !== req.user.id) {
      return res.status(403).json({ error: 'Geen toegang' });
    }
    
    const status = actie === 'accepteer' ? 'geaccepteerd' : 'geweigerd';
    dbRun('UPDATE shift_swaps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    
    // Notify requester
    dbRun(
      'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
      [swap.aanvrager_id, 'dienstruil', `Ruilverzoek ${status}`, `Je ruilverzoek is ${status}.`, '/dienstruil']
    );
    
    const updated = dbGet('SELECT * FROM shift_swaps WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwerken reactie' });
  }
});

app.post('/api/shift-swaps/:id/approve', authenticateToken, requireManager, (req, res) => {
  try {
    const { actie } = req.body;
    const swap = dbGet('SELECT * FROM shift_swaps WHERE id = ?', [req.params.id]);
    
    const status = actie === 'goedkeur' ? 'goedgekeurd' : 'afgekeurd';
    dbRun('UPDATE shift_swaps SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, req.params.id]);
    
    // If approved, actually swap the shifts
    if (status === 'goedgekeurd') {
      const shift1 = dbGet('SELECT * FROM shifts WHERE id = ?', [swap.shift_aanvrager_id]);
      
      // Swap the employee assignments
      dbRun('UPDATE shifts SET medewerker_id = ? WHERE id = ?', [swap.ontvanger_id, swap.shift_aanvrager_id]);
      
      if (swap.shift_ontvanger_id) {
        dbRun('UPDATE shifts SET medewerker_id = ? WHERE id = ?', [swap.aanvrager_id, swap.shift_ontvanger_id]);
      }
    }
    
    // Notify both parties
    dbRun(
      'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
      [swap.aanvrager_id, 'dienstruil', `Ruil ${status}`, `De dienstwissel is ${status} door een manager.`, '/dienstruil']
    );
    dbRun(
      'INSERT INTO notifications (ontvanger_id, type, titel, bericht, link) VALUES (?, ?, ?, ?, ?)',
      [swap.ontvanger_id, 'dienstruil', `Ruil ${status}`, `De dienstwissel is ${status} door een manager.`, '/dienstruil']
    );
    
    const updated = dbGet('SELECT * FROM shift_swaps WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij verwerken goedkeuring' });
  }
});

// ======= NOTIFICATION ROUTES =======

app.get('/api/notifications', authenticateToken, (req, res) => {
  try {
    const notifications = dbAll(
      'SELECT * FROM notifications WHERE ontvanger_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij ophalen notificaties' });
  }
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    dbRun('UPDATE notifications SET gelezen = 1 WHERE id = ? AND ontvanger_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Gemarkeerd als gelezen' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij markeren als gelezen' });
  }
});

app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
  try {
    dbRun('UPDATE notifications SET gelezen = 1 WHERE ontvanger_id = ?', [req.user.id]);
    res.json({ message: 'Alle notificaties gemarkeerd als gelezen' });
  } catch (error) {
    res.status(500).json({ error: 'Fout bij markeren als gelezen' });
  }
});

// ======= REPORT ROUTES =======

app.get('/api/reports/hours', authenticateToken, requireManager, (req, res) => {
  try {
    const { startDatum, eindDatum } = req.query;
    
    const report = dbAll(`
      SELECT 
        u.id,
        u.naam,
        u.afdeling,
        COUNT(s.id) as aantal_diensten,
        SUM(
          (CAST(substr(s.eindtijd, 1, 2) AS REAL) * 60 + CAST(substr(s.eindtijd, 4, 2) AS REAL)) -
          (CAST(substr(s.starttijd, 1, 2) AS REAL) * 60 + CAST(substr(s.starttijd, 4, 2) AS REAL)) -
          COALESCE(s.pauze, 0)
        ) / 60.0 as totaal_uren
      FROM users u
      LEFT JOIN shifts s ON u.id = s.medewerker_id 
        AND s.datum >= ? AND s.datum <= ?
        AND s.status = 'gepubliceerd'
      WHERE u.actief = 1
      GROUP BY u.id
      ORDER BY u.naam
    `, [startDatum, eindDatum]);
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij genereren rapport' });
  }
});

app.get('/api/reports/leave', authenticateToken, requireManager, (req, res) => {
  try {
    const { jaar } = req.query;
    const startDate = `${jaar}-01-01`;
    const endDate = `${jaar}-12-31`;
    
    const report = dbAll(`
      SELECT 
        u.id,
        u.naam,
        u.vakantiesaldo,
        COALESCE(SUM(CASE WHEN l.status = 'goedgekeurd' THEN l.aantal_dagen ELSE 0 END), 0) as opgenomen,
        COALESCE(SUM(CASE WHEN l.status = 'in_behandeling' THEN l.aantal_dagen ELSE 0 END), 0) as in_behandeling
      FROM users u
      LEFT JOIN leave_requests l ON u.id = l.medewerker_id 
        AND l.begindatum >= ? AND l.einddatum <= ?
        AND l.type = 'vakantie'
      WHERE u.actief = 1
      GROUP BY u.id
      ORDER BY u.naam
    `, [startDate, endDate]);
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: 'Fout bij genereren rapport' });
  }
});

app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    
    const stats = {};
    
    // Shifts today
    stats.dienstenVandaag = dbGet(
      'SELECT COUNT(*) as count FROM shifts WHERE datum = ? AND status = ?',
      [today, 'gepubliceerd']
    ).count;
    
    // Employees working today
    stats.medewerkersVandaag = dbGet(
      'SELECT COUNT(DISTINCT medewerker_id) as count FROM shifts WHERE datum = ? AND status = ?',
      [today, 'gepubliceerd']
    ).count;
    
    // Pending leave requests
    stats.openstaandeAanvragen = dbGet(
      'SELECT COUNT(*) as count FROM leave_requests WHERE status = ?',
      ['in_behandeling']
    ).count;
    
    // Total hours this week (for managers)
    if (req.user.rol === 'manager') {
      const hoursResult = dbGet(`
        SELECT SUM(
          (CAST(substr(eindtijd, 1, 2) AS REAL) * 60 + CAST(substr(eindtijd, 4, 2) AS REAL)) -
          (CAST(substr(starttijd, 1, 2) AS REAL) * 60 + CAST(substr(starttijd, 4, 2) AS REAL)) -
          COALESCE(pauze, 0)
        ) / 60.0 as total
        FROM shifts 
        WHERE datum >= ? AND datum <= ? AND status = ?
      `, [weekStartStr, weekEndStr, 'gepubliceerd']);
      stats.urenDezeWeek = hoursResult.total || 0;
    }
    
    // User's shifts this week
    const myShifts = dbAll(
      'SELECT * FROM shifts WHERE medewerker_id = ? AND datum >= ? AND datum <= ? ORDER BY datum, starttijd',
      [req.user.id, weekStartStr, weekEndStr]
    );
    stats.mijnDiensten = myShifts;
    
    // User's upcoming shifts
    const upcomingShifts = dbAll(
      'SELECT * FROM shifts WHERE medewerker_id = ? AND datum >= ? ORDER BY datum, starttijd LIMIT 5',
      [req.user.id, today]
    );
    stats.komendeDiensten = upcomingShifts;
    
    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Fout bij ophalen dashboard statistieken' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
  });
});
