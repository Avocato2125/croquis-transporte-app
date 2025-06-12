require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./database');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cookieParser());
app.use((req, res, next) => {
    // ¡IMPORTANTE! URL DE TU APP DESPLEGADA
    res.header('Access-Control-Allow-Origin', 'https://croquis-rutas-online.onrender.com');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' }); }
    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) { return res.status(401).json({ message: 'Credenciales inválidas.' }); }
        const isMatch = bcrypt.compareSync(password, user.password_hash);
        if (!isMatch) { return res.status(401).json({ message: 'Credenciales inválidas.' }); }
        const token = jwt.sign({ id: user.id, username: user.username, plant_id: user.plant_id, is_admin: user.is_admin }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', maxAge: 3600000 });
        res.json({ token, plant_id: user.plant_id, username: user.username });
    } catch (error) { console.error('Error en el inicio de sesión:', error); res.status(500).json({ message: 'Error interno del servidor.' }); }
});

function authenticateToken(req, res, next) {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) { token = authHeader.split(' ')[1]; }
    if (!token && req.cookies && req.cookies.jwt) { token = req.cookies.jwt; }
    if (!token) {
        // URL DE TU APP DESPLEGADA
        if (req.accepts('html') && req.method === 'GET' && req.originalUrl.startsWith('/routes/')) { return res.redirect('https://croquis-rutas-online.onrender.com'); }
        return res.status(401).json({ message: 'Token de autenticación no proporcionado. Acceso denegado.' });
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Error de verificación de token:', err);
            res.clearCookie('jwt');
            // URL DE TU APP DESPLEGADA
            if (req.accepts('html') && req.method === 'GET' && req.originalUrl.startsWith('/routes/')) { return res.redirect('https://croquis-rutas-online.onrender.com'); }
            return res.status(403).json({ message: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
        }
        req.user = user; next();
    });
}

app.get('/api/userinfo', authenticateToken, (req, res) => { res.json({ username: req.user.username, plant_id: req.user.plant_id, isAdmin: req.user.is_admin }); });

app.get('/routes/:plantId', authenticateToken, (req, res) => {
    const requestedPlantId = req.params.plantId;
    const userPlantId = req.user.plant_id;
    const isAdmin = req.user.is_admin;
    if (!isAdmin && requestedPlantId !== userPlantId) {
        // URL DE TU APP DESPLEGADA
        if (req.accepts('html')) { return res.redirect('https://croquis-rutas-online.onrender.com'); }
        return res.status(403).send('Acceso denegado. No tienes permisos para ver las rutas de esta planta.');
    }
    const routeFileName = `${requestedPlantId}-routes.html`;
    const routeFilePath = path.join(__dirname, '../public', routeFileName);
    if (fs.existsSync(routeFilePath)) { res.sendFile(routeFilePath); } else { res.status(404).send(`La página de rutas para "${requestedPlantId}" no fue encontrada.`); }
});

app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    console.log('Accede a la página de inicio en http://localhost:3000');
});