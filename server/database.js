const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Ruta al archivo de la base de datos (se guardará en la carpeta 'server')
const dbPath = path.join(__dirname, 'users.db');
const db = new Database(dbPath);

console.log('Base de datos conectada en:', dbPath);

// Función para inicializar la base de datos y crear la tabla de usuarios
function initializeDatabase() {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                plant_id TEXT NOT NULL, -- abc-technologies, leoch-battery, etc.
                is_admin INTEGER DEFAULT 0 -- 1 para admin, 0 para usuario normal
            );
        `);
        console.log('Tabla de usuarios verificada/creada.');

        // Insertar usuario admin si no existe (solo la primera vez)
        const adminUsername = 'admin';
        const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);

        if (!adminUser) {
            const hashedPassword = bcrypt.hashSync('adminpass', 10); // Contraseña para el admin: adminpass
            db.prepare('INSERT INTO users (username, password_hash, plant_id, is_admin) VALUES (?, ?, ?, ?)').run(
                adminUsername,
                hashedPassword,
                'admin', // Plant_id 'admin' para el usuario administrador
                1
            );
            console.log('Usuario administrador "admin" insertado con contraseña "adminpass".');
        }

        // Insertar usuarios de plantas si no existen
        // ¡ACTUALIZA LAS CONTRASEÑAS AQUÍ si las cambiaste!
        const plantUsers = [
            { username: 'abcuser', password: 'ABC2123', plant_id: 'abc-technologies', is_admin: 0 },
            { username: 'leochuser', password: 'LEOCH1034', plant_id: 'leoch-battery', is_admin: 0 },
            { username: 'phillipsuser', password: 'PHILLIPS4050', plant_id: 'phillips', is_admin: 0 },
            { username: 'gerberuser', password: 'GERBER36C', plant_id: 'gerber', is_admin: 0 },
        ];

        plantUsers.forEach(user => {
            const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
            if (!existingUser) {
                const hashedPassword = bcrypt.hashSync(user.password, 10);
                db.prepare('INSERT INTO users (username, password_hash, plant_id, is_admin) VALUES (?, ?, ?, ?)').run(
                    user.username,
                    hashedPassword,
                    user.plant_id,
                    user.is_admin
                );
                console.log(`Usuario "${user.username}" insertado con contraseña "${user.password}".`);
            }
        });


    } catch (error) {
        console.error('Error al inicializar la base de datos:', error.message);
    }
}

// Llama a la función para inicializar la base de datos al cargar el módulo
initializeDatabase();

// Exporta la base de datos para usarla en app.js
module.exports = db;