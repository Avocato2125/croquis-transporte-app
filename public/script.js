document.addEventListener('DOMContentLoaded', () => {
    console.log('¡Script.js cargado y ejecutándose con nuevo diseño!');

    // =========================================================================
    // Variables y Funcionalidad del Nuevo Diseño (Modal, Parallax)
    // =========================================================================
    const modal = document.getElementById('loginModal'); // Referencia para el control de la clase 'show'
    const plantCards = document.querySelectorAll('.plant-card');
    const closeButton = document.querySelector('.close-button');
    const cancelButton = document.getElementById('cancelButton');
    const modalPlantName = document.getElementById('modalPlantName'); // Para el strong en la modal

    // Nuevas referencias a elementos del modal para la funcionalidad de login
    const modalPlantTitle = document.getElementById('modalPlantTitle'); // El h2 en la modal
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');

    let currentPlantId = ''; // Para saber qué planta se seleccionó

    // Función para mostrar la modal (ajustada para la clase 'show')
    function showModal(plantId, plantName) {
        currentPlantId = plantId;
        modalPlantTitle.textContent = `Acceso a Rutas de ${plantName}`;
        modalPlantName.textContent = plantName;
        usernameInput.value = ''; // Limpiar el input
        passwordInput.value = ''; // Limpiar el input de contraseña
        errorMessage.textContent = ''; // Limpiar mensajes de error
        modal.classList.add('show'); // Añadir clase 'show' para CSS
        usernameInput.focus(); // Poner el foco en el campo de usuario
    }

    // Función para ocultar la modal (ajustada para la clase 'show')
    function hideModal() {
        modal.classList.remove('show');
    }

    // Event listeners para las tarjetas de plantas (para mostrar la modal)
    plantCards.forEach(card => {
        card.addEventListener('click', () => {
            const plantId = card.dataset.plant;
            const plantName = card.querySelector('h3').textContent;
            showModal(plantId, plantName);
        });
    });

    // Event listeners para los botones de la modal (cerrar)
    if (closeButton) closeButton.addEventListener('click', hideModal);
    if (cancelButton) cancelButton.addEventListener('click', hideModal);

    // Cerrar modal al hacer click fuera
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal();
            }
        });
    }

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('show')) {
            hideModal();
        }
    });

    // Efecto parallax en las formas de fondo
    document.addEventListener('mousemove', (e) => {
        const shapes = document.querySelectorAll('.shape');
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 0.5; // Ajuste para el número de formas
            const xPos = x * speed * 10;
            const yPos = y * speed * 10;
            shape.style.transform = `translate(${xPos}px, ${yPos}px)`;
        });
    });


    // =========================================================================
    // Lógica de Autenticación y Backend (Combinada con el nuevo diseño)
    // =========================================================================

    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            const username = usernameInput.value;
            const password = passwordInput.value;

            errorMessage.textContent = ''; // Limpiar errores previos
            errorMessage.style.display = 'none'; // Ocultar mensaje de error

            if (!username || !password) {
                errorMessage.textContent = 'Por favor, ingresa tu usuario y contraseña.';
                errorMessage.style.display = 'block'; // Mostrar mensaje de error
                return;
            }

            try {
                const response = await fetch('https://rutas-tecsa.up.railway.app/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('jwtToken', data.token);
                    localStorage.setItem('userPlantId', data.plant_id);
                    localStorage.setItem('username', data.username);

                    hideModal();
                    // REDIRECCIÓN A LA RUTA PROTEGIDA
                    window.location.href = `https://rutas-tecsa.up.railway.app/routes/${currentPlantId}`;

                } else {
                    errorMessage.textContent = data.message || 'Error de inicio de sesión. Credenciales inválidas.';
                    errorMessage.style.display = 'block'; // Mostrar mensaje de error
                }

            } catch (error) {
                console.error('Error al conectar con el backend o procesar la respuesta:', error);
                errorMessage.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
                errorMessage.style.display = 'block'; // Mostrar mensaje de error
            }
        });
    }

    // Permitir iniciar sesión con Enter en los campos de usuario/contraseña
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                passwordInput.focus();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                loginButton.click();
            }
        });
    }

    // Lógica de Autenticación para Páginas de Rutas (se ejecuta en las páginas de rutas, no en index.html)
    const checkAuthAndLoadContent = async () => {
        const currentPath = window.location.pathname;
        let requestedPlantId = null;

        const match = currentPath.match(/\/routes\/(.+?)(?:-routes\.html|\/?)$/);
        if (match && match[1]) {
            requestedPlantId = match[1];
        } else {
            const directMatch = currentPath.match(/\/([a-z0-9-]+)-routes\.html$/);
            if (directMatch && directMatch[1]) {
                 requestedPlantId = directMatch[1];
            }
        }

        if (!requestedPlantId) {
            return;
        }

        const token = localStorage.getItem('jwtToken');

        if (!token) {
            alert('Sesión expirada o no autenticado. Por favor, inicia sesión.');
            window.location.href = 'https://rutas-tecsa.up.railway.app'; // Redirige al inicio de la APP DESPLEGADA
            return;
        }

        try {
            const response = await fetch('https://rutas-tecsa.up.railway.app/api/userinfo', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const userData = await response.json();

            if (!response.ok) {
                alert(userData.message || 'Error de autenticación. Por favor, vuelve a iniciar sesión.');
                localStorage.removeItem('jwtToken');
                localStorage.removeItem('userPlantId');
                localStorage.removeItem('username');
                window.location.href = 'https://rutas-tecsa.up.railway.app'; // Redirige al inicio de la APP DESPLEGADA
                return;
            }

            const userPlantId = userData.plant_id;
            const isAdmin = userData.isAdmin;

            if (!isAdmin && requestedPlantId !== userPlantId) {
                alert('No tienes permiso para ver las rutas de esta planta.');
                window.location.href = 'https://rutas-tecsa.up.railway.app'; // Redirige al inicio de la APP DESPLEGADA
                return;
            }

            console.log(`Acceso concedido a rutas de ${requestedPlantId} para ${userData.username}`);

            const header = document.querySelector('.header');
            if (header && !document.getElementById('logoutButton')) {
                const logoutBtn = document.createElement('button');
                logoutBtn.id = 'logoutButton';
                logoutBtn.textContent = 'Cerrar Sesión';
                logoutBtn.classList.add('button', 'secondary-button');
                logoutBtn.style.marginLeft = '20px';
                logoutBtn.onclick = () => {
                    localStorage.removeItem('jwtToken');
                    localStorage.removeItem('userPlantId');
                    localStorage.removeItem('username');
                    window.location.href = 'https://rutas-tecsa.up.railway.app'; // Redirige al inicio de la APP DESPLEGADA
                };
                const headerP = header.querySelector('p');
                if (headerP) {
                    headerP.appendChild(logoutBtn);
                } else {
                    const newP = document.createElement('p');
                    newP.appendChild(logoutBtn);
                    header.appendChild(newP);
                }
            }


        } catch (error) {
            console.error('Error al verificar autenticación en página de rutas:', error);
            alert('No se pudo verificar tu sesión. Por favor, inicia sesión de nuevo.');
            localStorage.removeItem('jwtToken');
            localStorage.removeItem('userPlantId');
            localStorage.removeItem('username');
            window.location.href = 'https://rutas-tecsa.up.railway.app'; // Redirige al inicio de la APP DESPLEGADA
        }
    };

    checkAuthAndLoadContent();


    // Código para el efecto de luz del ratón (mantenerlo si lo usas en las páginas de rutas)
    const mapContainers = document.querySelectorAll('.map-container');
    if (mapContainers.length > 0) {
        mapContainers.forEach(container => {
            container.addEventListener('mousemove', (e) => {
                const rect = container.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width * 100;
                const y = (e.clientY - rect.top) / rect.height * 100;
                container.style.setProperty('--mouse-x', `${x}%`);
                container.style.setProperty('--mouse-y', `${y}%`);
            });
        });
    }
});