document.addEventListener('DOMContentLoaded', () => {
    console.log('¡Script.js cargado y ejecutándose!'); // Mensaje de depuración

    const plantCards = document.querySelectorAll('.plant-card');

    const loginModal = document.getElementById('loginModal');
    const closeButton = document.querySelector('.close-button');
    const modalPlantTitle = document.getElementById('modalPlantTitle');
    const modalPlantName = document.getElementById('modalPlantName');
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton');
    const cancelButton = document.getElementById('cancelButton');

    let currentPlantId = '';

    function showModal(plantId, plantName) {
        currentPlantId = plantId;
        modalPlantTitle.textContent = `Acceso a Rutas de ${plantName}`;
        modalPlantName.textContent = plantName;
        usernameInput.value = '';
        passwordInput.value = '';
        errorMessage.textContent = '';
        loginModal.style.display = 'flex';
        requestAnimationFrame(() => loginModal.classList.add('show'));
        usernameInput.focus();
    }

    function hideModal() {
        loginModal.classList.remove('show');
        setTimeout(() => loginModal.style.display = 'none', 300);
    }

    plantCards.forEach(card => {
        card.addEventListener('click', () => {
            console.log('Clic en tarjeta de planta:', card.dataset.plant);
            const plantId = card.dataset.plant;
            const plantName = card.querySelector('h3').textContent;
            showModal(plantId, plantName);
        });
    });

    if (closeButton) closeButton.addEventListener('click', hideModal);
    if (cancelButton) cancelButton.addEventListener('click', hideModal);
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            const username = usernameInput.value;
            const password = passwordInput.value;

            errorMessage.textContent = '';

            if (!username || !password) {
                errorMessage.textContent = 'Por favor, ingresa tu usuario y contraseña.';
                return;
            }

            try {
                // URL DE TU APP DESPLEGADA
                const response = await fetch('https://croquis-rutas-online.onrender.com/api/login', {
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
                    // URL DE TU APP DESPLEGADA
                    window.location.href = `https://croquis-rutas-online.onrender.com/routes/${currentPlantId}`;

                } else {
                    errorMessage.textContent = data.message || 'Error de inicio de sesión. Credenciales inválidas.';
                }

            } catch (error) {
                console.error('Error al conectar con el backend o procesar la respuesta:', error);
                errorMessage.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
            }
        });
    }

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

    if (loginModal) {
        window.addEventListener('click', (event) => {
            if (event.target === loginModal) {
                hideModal();
            }
        });
    }

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
            window.location.href = 'https://croquis-rutas-online.onrender.com'; // URL DE TU APP DESPLEGADA
            return;
        }

        try {
            // URL DE TU APP DESPLEGADA
            const response = await fetch('https://croquis-rutas-online.onrender.com/api/userinfo', {
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
                window.location.href = 'https://croquis-rutas-online.onrender.com'; // URL DE TU APP DESPLEGADA
                return;
            }

            const userPlantId = userData.plant_id;
            const isAdmin = userData.isAdmin;

            if (!isAdmin && requestedPlantId !== userPlantId) {
                alert('No tienes permiso para ver las rutas de esta planta.');
                window.location.href = 'https://croquis-rutas-online.onrender.com'; // URL DE TU APP DESPLEGADA
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
                    window.location.href = 'https://croquis-rutas-online.onrender.com'; // URL DE TU APP DESPLEGADA
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
            window.location.href = 'https://croquis-rutas-online.onrender.com'; // URL DE TU APP DESPLEGADA
        }
    };

    checkAuthAndLoadContent();


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