require('dotenv').config(); // Cargar variables de entorno del archivo .env
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./database'); // Importar la conexión a la base de datos
const path = require('path');     // Para manejar rutas de archivos
const fs = require('fs');         // Para verificar si un archivo existe
const cookieParser = require('cookie-parser'); // Importar cookie-parser

const app = express();
// Usa el puerto que Railway te asigne (process.env.PORT) o 3000 para desarrollo local
const PORT = process.env.PORT || 3000; 
const JWT_SECRET = process.env.JWT_SECRET; // Tu secreto JWT del archivo .env

// =========================================================================
// Middleware PRINCIPAL Y ORDEN CRÍTICO
// =========================================================================

// 0. RUTA EXPLÍCITA PARA LA RAÍZ: AHORA USA LA RUTA ABSOLUTA DIRECTAMENTE DENTRO DEL CONTENEDOR
//    Esto es CRÍTICO para que Express encuentre index.html en Railway cuando el Root Directory es '.'
app.get('/', (req, res) => {
    res.sendFile('/app/public/index.html'); 
});

// 1. **Luego:** Servir archivos estáticos del frontend.
//    ¡CAMBIO CLAVE! AHORA USA LA RUTA ABSOLUTA DIRECTA EN EL CONTENEDOR
//    Esto asegura que style.css, script.js, img/, y las otras páginas de rutas HTML se sirvan.
app.use(express.static('/app/public')); 

// 2. **Luego:** Parsers para el cuerpo de las solicitudes (JSON).
app.use(express.json());

// 3. **Luego:** Middleware para parsear cookies (necesario para leer req.cookies).
app.use(cookieParser());

// 4. **Luego:** Configuración manual de CORS.
app.use((req, res, next) => {
    // URL PÚBLICA REAL DE TU APP EN RAILWAY
    res.header('Access-Control-Allow-Origin', 'https://rutas-tecsa.up.railway.app');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});


// ==========================================
// RUTAS DE AUTENTICACIÓN (API)
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
        // Si no hay token y es una solicitud para una página HTML protegida, redirigir.
        if (req.accepts('html') && req.method === 'GET' && req.originalUrl.startsWith('/routes/')) {
            return res.redirect('https://rutas-tecsa.up.railway.app'); // URL DE TU APP DESPLEGADA
        }
        return res.status(401).json({ message: 'Token de autenticación no proporcionado. Acceso denegado.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Error de verificación de token:', err);
            res.clearCookie('jwt');
            if (req.accepts('html') && req.method === 'GET' && req.originalUrl.startsWith('/routes/')) {
                return res.redirect('https://rutas-tecsa.up.railway.app'); // URL DE TU APP DESPLEGADA
            }
            return res.status(403).json({ message: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
        }
        req.user = user;
        next();
    });
}

// ==========================================
// RUTA PARA OBTENER INFORMACIÓN DEL USUARIO LOGUEADO (Protegida)
// ==========================================
app.get('/api/userinfo', authenticateToken, (req, res) => {
    res.json({ username: req.user.username, plant_id: req.user.plant_id, isAdmin: req.user.is_admin });
});


// ==========================================
// RUTAS PROTEGIDAS (SERVIR PÁGINAS HTML DE RUTAS)
// ==========================================

app.get('/routes/:plantId', authenticateToken, (req, res) => {
    const requestedPlantId = req.params.plantId;
    const userPlantId = req.user.plant_id;
    const isAdmin = req.user.is_admin;

    if (!isAdmin && requestedPlantId !== userPlantId) {
        // Si no está autorizado para esta planta, y es una solicitud HTML, redirige.
        if (req.accepts('html')) {
            return res.redirect('https://rutas-tecsa.up.railway.app'); // URL DE TU APP DESPLEGADA
        }
        return res.status(403).send('Acceso denegado. No tienes permisos para ver las rutas de esta planta.');
    }

    const routeFileName = `${requestedPlantId}-routes.html`;
    // ¡CAMBIO CLAVE! AHORA USA LA RUTA ABSOLUTA DIRECTA EN EL CONTENEDOR
    const routeFilePath = `/app/public/${routeFileName}`; 
    
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
    console.log(`Servidor Express corriendo en http://localhost:${PORT} (local)`); 
    console.log(`Aplicación lista para escuchar en el puerto ${PORT}`);
});