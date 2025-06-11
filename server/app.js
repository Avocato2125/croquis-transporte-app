require('dotenv').config(); // Cargar variables de entorno del archivo .env
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./database'); // Importar la conexión a la base de datos
const path = require('path');     // Para manejar rutas de archivos
const fs = require('fs');         // Para verificar si un archivo existe
const cookieParser = require('cookie-parser'); // Importar cookie-parser

const app = express();
const PORT = process.env.PORT || 3000; // El puerto en el que correrá tu servidor
const JWT_SECRET = process.env.JWT_SECRET; // Tu secreto JWT del archivo .env

// =========================================================================
// Middleware PRINCIPAL Y ORDEN CRÍTICO - ¡MUY IMPORTANTE EL ORDEN!
// =========================================================================

// 1. **PRIMERO:** Servir archivos estáticos del frontend.
//    Esto asegura que `index.html`, `style.css`, `script.js`, imágenes, y TUS ARCHIVOS DE RUTAS
//    (como `abc-technologies-routes.html`) se sirvan directamente sin pasar por middlewares de auth/CORS.
app.use(express.static(path.join(__dirname, '../public')));

// 2. **Luego:** Parsers para el cuerpo de las solicitudes (JSON).
app.use(express.json());

// 3. **Luego:** Middleware para parsear cookies (necesario para leer req.cookies).
app.use(cookieParser());

// 4. **Luego:** Configuración manual de CORS.
//    Esto permite que tu frontend (localhost:3000) haga peticiones a tus rutas de API.
//    Se aplica a todas las rutas que vengan DESPUÉS de este middleware.
//    NO AFECTA A LOS ARCHIVOS ESTÁTICOS YA SERVIDOS ARRIBA.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000'); // Permitir solo tu frontend
    res.header('Access-Control-Allow-Credentials', 'true'); // Permitir que se envíen/reciban cookies
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Métodos HTTP permitidos

    if (req.method === 'OPTIONS') { // Manejar las solicitudes OPTIONS (pre-flight requests) para CORS
        return res.sendStatus(200);
    }
    next();
});


// ==========================================
// RUTAS DE AUTENTICACIÓN
// ==========================================

// Endpoint para el inicio de sesión
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const isMatch = bcrypt.compareSync(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ message: 'Credenciales inválidas.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, plant_id: user.plant_id, is_admin: user.is_admin },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Establecer el token como una cookie HTTP-only y segura
        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            maxAge: 3600000
        });

        res.json({ token, plant_id: user.plant_id, username: user.username });

    } catch (error) {
        console.error('Error en el inicio de sesión:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN (Para proteger rutas)
// ==========================================
function authenticateToken(req, res, next) {
    let token = null;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (!token && req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        // Redirigir al inicio de sesión si no hay token (solo para solicitudes GET a rutas HTML protegidas)
        // Esto es para que el usuario no vea un JSON si intenta acceder directamente sin token.
        // Las llamadas API que esperan JSON seguirán recibiendo el 401/403.
        if (req.accepts('html') && req.method === 'GET') {
            return res.redirect('http://localhost:3000'); // Redirige a la página de inicio
        }
        return res.status(401).json({ message: 'Token de autenticación no proporcionado. Acceso denegado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Error de verificación de token:', err);
            res.clearCookie('jwt');
            if (req.accepts('html') && req.method === 'GET') {
                return res.redirect('http://localhost:3000'); // Redirige si el token es inválido para páginas HTML
            }
            return res.status(403).json({ message: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// RUTA PARA OBTENER INFORMACIÓN DEL USUARIO LOGUEADO (Protegida)
// El frontend la usará en las páginas de rutas para verificar el token
// ==========================================
app.get('/api/userinfo', authenticateToken, (req, res) => {
    res.json({ username: req.user.username, plant_id: req.user.plant_id, isAdmin: req.user.is_admin });
});


// ==========================================
// RUTAS PROTEGIDAS (SERVIR CONTENIDO DINÁMICO)
// ==========================================

// Esta ruta ahora SOLO se preocupa por la AUTORIZACIÓN de la planta,
// ya que el middleware 'authenticateToken' ya manejó la autenticación del token.
app.get('/routes/:plantId', authenticateToken, (req, res) => {
    const requestedPlantId = req.params.plantId;
    const userPlantId = req.user.plant_id;
    const isAdmin = req.user.is_admin;

    if (!isAdmin && requestedPlantId !== userPlantId) {
        // Si no está autorizado para esta planta, redirige o envía un 403
        if (req.accepts('html')) {
            return res.redirect('http://localhost:3000'); // Redirige al inicio si no tiene permisos HTML
        }
        return res.status(403).send('Acceso denegado. No tienes permisos para ver las rutas de esta planta.');
    }

    const routeFileName = `${requestedPlantId}-routes.html`;
    const routeFilePath = path.join(__dirname, '../public', routeFileName);
    
    if (fs.existsSync(routeFilePath)) {
        res.sendFile(routeFilePath);
    } else {
        res.status(404).send(`La página de rutas para "${requestedPlantId}" no fue encontrada.`);
    }
});


// ==========================================
// INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`Servidor Express corriendo en http://localhost:${PORT}`);
    console.log('Accede a la página de inicio en http://localhost:3000');
});