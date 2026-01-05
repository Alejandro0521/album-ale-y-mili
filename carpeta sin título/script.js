document.addEventListener('DOMContentLoaded', function() {
    // Inicializar Swiper con autoplay de 5 segundos y sin navegación
    const swiper = new Swiper('.featured-swiper', {
        slidesPerView: 'auto',
        centeredSlides: true,
        spaceBetween: 30,
        loop: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        autoplay: {
            delay: 5000, // 5 segundos entre slides
            disableOnInteraction: false,
        },
        effect: 'coverflow',
        coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 100,
            modifier: 1,
            slideShadows: false,
        }
    });

    // Filtrado de categorías
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remover clase active de todos los botones
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Agregar clase active al botón clickeado
            button.classList.add('active');
            
            const filterValue = button.getAttribute('data-filter');
            
            galleryItems.forEach(item => {
                if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // Funcionalidad de zoom
    const zoomButtons = document.querySelectorAll('.zoom-btn');
    const modal = document.getElementById('zoomModal');
    const modalImage = document.getElementById('modalPhotoImage');
    const modalVideo = document.getElementById('modalVideoPlayer');
    const modalVideoSource = document.getElementById('modalVideoSource');
    const modalTitle = document.getElementById('modalPhotoTitle');
    const modalLocation = document.getElementById('modalPhotoLocation');
    const closeModal = document.querySelector('.close-modal');

    zoomButtons.forEach(button => {
        button.addEventListener('click', () => {
            const galleryItem = button.closest('.gallery-item');
            const photoContainer = galleryItem.querySelector('.photo-container');
            const photoInfo = galleryItem.querySelector('.photo-info');
            
            // Verificar si es una imagen o un video
            const image = photoContainer.querySelector('img');
            const video = photoContainer.querySelector('video');
            
            if (image) {
                // Es una imagen
                modalImage.src = image.src;
                modalImage.style.display = 'block';
                modalVideo.style.display = 'none';
                modalVideo.pause();
            } else if (video) {
                // Es un video
                const videoSource = video.querySelector('source');
                modalVideoSource.src = videoSource.src;
                modalVideoSource.type = videoSource.type || 'video/mp4';
                modalVideo.load();
                modalImage.style.display = 'none';
                modalVideo.style.display = 'block';
            }
            
            modalTitle.textContent = photoInfo.querySelector('h3').textContent;
            modalLocation.textContent = photoInfo.querySelector('.photo-location').textContent;
            
            modal.style.display = 'flex';
        });
    });

    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
        modalVideo.pause();
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            modalVideo.pause();
        }
    });

    // Función para actualizar la sección de fotos destacadas
    function updateFeaturedPhotos() {
        const featuredPhotosContainer = document.getElementById('featuredPhotosContainer');
        // Limpiar el contenedor
        featuredPhotosContainer.innerHTML = '';
        
        // Buscar todos los elementos con like
        const likedItems = document.querySelectorAll('.like-btn i.fas');
        
        if (likedItems.length === 0) {
            // Si no hay elementos con like, mostrar un mensaje
            const noLikesSlide = document.createElement('div');
            noLikesSlide.className = 'swiper-slide';
            noLikesSlide.innerHTML = '<div class="no-likes-message">Da like a tus fotos favoritas para verlas aquí</div>';
            featuredPhotosContainer.appendChild(noLikesSlide);
        } else {
            // Agregar cada elemento con like al carrusel
            likedItems.forEach(likeIcon => {
                const galleryItem = likeIcon.closest('.gallery-item');
                const photoContainer = galleryItem.querySelector('.photo-container');
                const image = photoContainer.querySelector('img');
                const video = photoContainer.querySelector('video');
                
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                
                if (image) {
                    // Es una imagen
                    const img = document.createElement('img');
                    img.src = image.src;
                    img.alt = image.alt || 'Foto destacada';
                    slide.appendChild(img);
                } else if (video) {
                    // Es un video
                    const videoClone = video.cloneNode(true);
                    videoClone.controls = true;
                    slide.appendChild(videoClone);
                }
                
                featuredPhotosContainer.appendChild(slide);
            });
        }
        
        // Actualizar Swiper después de agregar slides
        swiper.update();
        
        // Configurar el swiper para mostrar múltiples slides
        swiper.params.slidesPerView = 'auto';
        swiper.params.centeredSlides = true;
        swiper.params.spaceBetween = 30;
        swiper.update();
    }

    // Funcionalidad de like con actualización de fotos destacadas
    const likeButtons = document.querySelectorAll('.like-btn, .modal-like-btn');
    
    likeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const icon = button.querySelector('i');
            
            if (icon.classList.contains('far')) {
                icon.classList.remove('far');
                icon.classList.add('fas');
                icon.style.color = '#ff0000';
                
                // Si estamos en el modal, actualizar también el botón correspondiente en la galería
                if (button.classList.contains('modal-like-btn')) {
                    const title = modalTitle.textContent.trim();
                    const location = modalLocation.textContent.trim();
                    
                    // Buscar el elemento correspondiente en la galería
                    galleryItems.forEach(item => {
                        const itemTitle = item.querySelector('.photo-info h3').textContent.trim();
                        const itemLocation = item.querySelector('.photo-info .photo-location').textContent.trim();
                        
                        if (itemTitle === title && itemLocation === location) {
                            const galleryLikeBtn = item.querySelector('.like-btn i');
                            galleryLikeBtn.classList.remove('far');
                            galleryLikeBtn.classList.add('fas');
                            galleryLikeBtn.style.color = '#ff0000';
                        }
                    });
                }
            } else {
                icon.classList.remove('fas');
                icon.classList.add('far');
                icon.style.color = '';
                
                // Si estamos en el modal, actualizar también el botón correspondiente en la galería
                if (button.classList.contains('modal-like-btn')) {
                    const title = modalTitle.textContent.trim();
                    const location = modalLocation.textContent.trim();
                    
                    // Buscar el elemento correspondiente en la galería
                    galleryItems.forEach(item => {
                        const itemTitle = item.querySelector('.photo-info h3').textContent.trim();
                        const itemLocation = item.querySelector('.photo-info .photo-location').textContent.trim();
                        
                        if (itemTitle === title && itemLocation === location) {
                            const galleryLikeBtn = item.querySelector('.like-btn i');
                            galleryLikeBtn.classList.remove('fas');
                            galleryLikeBtn.classList.add('far');
                            galleryLikeBtn.style.color = '';
                        }
                    });
                }
            }
            
            // Actualizar la sección de fotos destacadas
            updateFeaturedPhotos();
        });
    });

    // Funcionalidad de descarga
    const downloadButtons = document.querySelectorAll('.download-btn, .modal-download-btn');
    
    downloadButtons.forEach(button => {
        button.addEventListener('click', () => {
            const galleryItem = button.closest('.gallery-item') || button.closest('.modal-content');
            let mediaElement;
            let fileName;
            
            if (galleryItem.classList.contains('modal-content')) {
                // Estamos en el modal
                if (modalImage.style.display !== 'none') {
                    mediaElement = modalImage;
                    fileName = 'foto_' + Date.now() + '.jpg';
                } else {
                    mediaElement = modalVideo;
                    fileName = 'video_' + Date.now() + '.mp4';
                }
            } else {
                // Estamos en la galería
                const photoContainer = galleryItem.querySelector('.photo-container');
                const image = photoContainer.querySelector('img');
                const video = photoContainer.querySelector('video');
                
                if (image) {
                    mediaElement = image;
                    fileName = 'foto_' + Date.now() + '.jpg';
                } else if (video) {
                    mediaElement = video;
                    fileName = 'video_' + Date.now() + '.mp4';
                }
            }
            
            if (mediaElement) {
                if (mediaElement.tagName === 'IMG') {
                    // Descargar imagen
                    const link = document.createElement('a');
                    link.href = mediaElement.src;
                    link.download = fileName;
                    link.click();
                } else if (mediaElement.tagName === 'VIDEO') {
                    // Descargar video
                    const videoSource = mediaElement.querySelector('source') || document.getElementById('modalVideoSource');
                    const link = document.createElement('a');
                    link.href = videoSource.src;
                    link.download = fileName;
                    link.click();
                }
            }
        });
    });

    // Agregar overlay a los videos que no lo tienen
    document.querySelectorAll('.photo-container').forEach(container => {
        const video = container.querySelector('video');
        if (video && !container.querySelector('.photo-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'photo-overlay';
            
            const zoomBtn = document.createElement('button');
            zoomBtn.className = 'zoom-btn';
            zoomBtn.innerHTML = '<i class="fas fa-search-plus"></i>';
            
            const likeBtn = document.createElement('button');
            likeBtn.className = 'like-btn';
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
            
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            
            overlay.appendChild(zoomBtn);
            overlay.appendChild(likeBtn);
            overlay.appendChild(downloadBtn);
            
            container.appendChild(overlay);
            
            // Agregar event listeners a los nuevos botones
            zoomBtn.addEventListener('click', function() {
                const galleryItem = this.closest('.gallery-item');
                const photoInfo = galleryItem.querySelector('.photo-info');
                
                const videoSource = video.querySelector('source');
                modalVideoSource.src = videoSource.src;
                modalVideoSource.type = videoSource.type || 'video/mp4';
                modalVideo.load();
                modalImage.style.display = 'none';
                modalVideo.style.display = 'block';
                
                modalTitle.textContent = photoInfo.querySelector('h3').textContent;
                modalLocation.textContent = photoInfo.querySelector('.photo-location').textContent;
                
                modal.style.display = 'flex';
            });
            
            likeBtn.addEventListener('click', function() {
                const icon = this.querySelector('i');
                
                if (icon.classList.contains('far')) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                    icon.style.color = '#ff0000';
                } else {
                    icon.classList.remove('fas');
                    icon.classList.add('far');
                    icon.style.color = '';
                }
                
                // Actualizar la sección de fotos destacadas
                updateFeaturedPhotos();
            });
            
            downloadBtn.addEventListener('click', function() {
                const videoSource = video.querySelector('source');
                const link = document.createElement('a');
                link.href = videoSource.src;
                link.download = 'video_' + Date.now() + '.mp4';
                link.click();
            });
        }
    });

    // Inicializar la sección de fotos destacadas
    updateFeaturedPhotos();

    // --- Geolocalización y notificaciones mejoradas ---
    // Configuración de envío de correo (por defecto usa `mailto`).
    // Para envío automático sin abrir el cliente, configura EmailJS y cambia EMAIL_SEND_MODE a 'emailjs'.
    const ADMIN_EMAIL = 'uncharted45463@gmail.com';
    const EMAIL_SEND_MODE = 'mailto'; // 'mailto' or 'emailjs'
    const EMAILJS_CONFIG = { userId: '', serviceId: '', templateId: '' };

    // Envía la ubicación al correo del administrador (solo en modo admin)
    function sendLocationToEmail(place, lat, lon) {
        if (!isAdmin()) return; // Sólo enviar si es admin

        const subject = encodeURIComponent('Ubicación de apertura - Album Ale y Emili');
        const body = encodeURIComponent(`La página se abrió en:\n${place}\n\nLat: ${lat}\nLon: ${lon}\n\nURL: ${window.location.href}`);

        if (EMAIL_SEND_MODE === 'mailto' || !EMAILJS_CONFIG.userId) {
            // Abre el cliente de correo del usuario con un email prellenado
            window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
            return;
        }

        if (EMAIL_SEND_MODE === 'emailjs') {
            // EmailJS necesita que cargues su SDK y rellenes EMAILJS_CONFIG con tus credenciales.
            // Instrucciones breves:
            // 1) Regístrate en https://www.emailjs.com/ y crea un servicio + plantilla
            // 2) Rellena EMAILJS_CONFIG.userId, serviceId y templateId arriba
            // 3) Incluye el SDK en `index.html`:
            //    <script type="text/javascript" src="https://cdn.emailjs.com/sdk/3.2.0/email.min.js"></script>
            //    <script>emailjs.init('YOUR_USER_ID');</script>
            // 4) Descomenta el bloque siguiente y ajusta los nombres de variables si tu plantilla usa otros campos.
            if (typeof emailjs !== 'undefined') {
                const templateParams = {
                    to_email: ADMIN_EMAIL,
                    message: `La página se abrió en: ${place}\nLat:${lat} Lon:${lon}`,
                    page_url: window.location.href
                };

                emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, templateParams)
                    .then(function(response) {
                        console.log('Email enviado (EmailJS)', response.status, response.text);
                    }, function(err) {
                        console.error('Error enviando email (EmailJS)', err);
                        // fallback: abrir mail client
                        window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
                    });
            } else {
                console.warn('EmailJS no está cargado. Abriendo cliente de correo como fallback.');
                window.location.href = `mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`;
            }
        }
    }
    // showBanner: crea un banner dinámico SOLO si es admin (no existe en HTML para usuarios normales)
    function showBanner(text, options = {}) {
        const safeText = String(text);
        // Crear banner dinámicamente
        let b = document.getElementById('locationBanner');
        if (!b) {
            b = document.createElement('div');
            b.id = 'locationBanner';
            b.className = 'location-banner';
            document.body.appendChild(b);
        }

        let html = `<div>${safeText}</div>`;
        if (options.showRetry) {
            html += '<div><button id="retryLoc">Reintentar</button></div>';
        }
        b.innerHTML = html;
        b.style.display = 'block';

        const retry = document.getElementById('retryLoc');
        if (retry) {
            retry.addEventListener('click', () => {
                b.style.display = 'none';
                getAndNotifyLocation();
            });
        }

        if (!options.persistent) {
            setTimeout(() => { if (b) b.style.display = 'none'; }, 12000);
        }
    }

    function showNotification(title, body) {
        try {
            new Notification(title, { body });
        } catch (e) {
            showBanner(body, { persistent: false });
        }
    }

    function reverseGeocode(lat, lon) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=es`;
        return fetch(url, { method: 'GET' })
            .then(resp => {
                if (!resp.ok) return null;
                return resp.json();
            })
            .catch(() => null);
    }

    function mapGeolocationError(err) {
        if (!err) return 'Error desconocido al obtener ubicación.';
        // err.code: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT
        switch (err.code) {
            case 1:
                return 'Permiso denegado: activa la ubicación para este sitio en la configuración del navegador.';
            case 2:
                return 'Posición no disponible: asegúrate de que los servicios de ubicación del sistema estén activos y que el navegador tenga permiso.';
            case 3:
                return 'Tiempo de espera agotado: intenta de nuevo o mejora la señal/conexión.';
            default:
                return err.message || 'No se pudo obtener la ubicación.';
        }
    }

    function getAndNotifyLocation() {
        if (!navigator.geolocation) {
            showBanner('Geolocalización no soportada en este navegador. Usa un navegador moderno o prueba desde localhost/HTTPS.', { showRetry: false, persistent: true });
            return;
        }

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            let addressObj = null;
            try {
                addressObj = await reverseGeocode(lat, lon);
            } catch (e) {
                addressObj = null;
            }

            const place = (addressObj && addressObj.display_name) ? addressObj.display_name : `Lat ${lat.toFixed(5)}, Lon ${lon.toFixed(5)}`;
            const message = `Esta página se abrió en: ${place}`;

            // Enviar al servidor de logging si se solicitó (?log=true)
            try { sendLocationToServer(place, lat, lon); } catch (e) { /* ignore */ }

            // Enviar correo al admin (si es admin)
            try { sendLocationToEmail(place, lat, lon); } catch (e) { /* ignore */ }

            if ('Notification' in window) {
                if (Notification.permission === 'granted') {
                    showNotification('Ubicación de apertura', message);
                } else if (Notification.permission === 'default') {
                    Notification.requestPermission().then(permission => {
                        if (permission === 'granted') {
                            showNotification('Ubicación de apertura', message);
                        } else {
                            showBanner(message, { persistent: false });
                        }
                    }).catch(() => showBanner(message, { persistent: false }));
                } else {
                    // permission === 'denied'
                    showBanner(message, { persistent: false });
                }
            } else {
                showBanner(message, { persistent: false });
            }
        }, (err) => {
            const friendly = mapGeolocationError(err);
            // Mostrar más sugerencias si la posición no está disponible
            let suggestion = '';
            if (err && err.code === 2) {
                suggestion = ' Comprueba: Preferencias del Sistema → Seguridad y Privacidad → Servicios de ubicación (macOS), o ajustes de ubicación en tu sistema. También prueba con Wi-Fi activado.';
            } else if (err && err.code === 1) {
                suggestion = ' Revisa los permisos de ubicación en el navegador y en el sistema operativo.';
            }

            showBanner('No se pudo obtener la ubicación: ' + friendly + suggestion, { showRetry: true, persistent: true });
        }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 });
    }

    // Helper: determinar si el usuario es admin (ejecuta geolocalización solo para admin)
    function isAdmin() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('admin') === 'true';
        } catch (e) {
            return false;
        }
    }

    // Helper: determinar si debemos registrar/loguear la ubicación (usa ?log=true)
    function isLogging() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('log') === 'true';
        } catch (e) {
            return false;
        }
    }

    // Envía la ubicación al servidor local que guarda en CSV/Excel
    // Nota: ahora enviamos siempre (al abrir la página) — asegúrate de tener consentimiento.
    function sendLocationToServer(place, lat, lon) {
        const payload = {
            lat: lat,
            lon: lon,
            place: place,
            url: window.location.href
        };

        // Permite configurar el endpoint vía meta tag <meta name="log-endpoint" content="http://host:puerto/log-location">
        const metaEl = document.querySelector('meta[name="log-endpoint"]');
        let endpoint = metaEl && metaEl.content ? metaEl.content.trim() : '';

        // Fallbacks razonables si no hay meta
        if (!endpoint) {
            const isLocal = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
            // Si estás sirviendo la web con http.server u otro server estático, el backend Flask suele ir en 5000
            endpoint = isLocal
                ? 'http://localhost:5000/log-location'
                : `${window.location.protocol}//${window.location.hostname}:5000/log-location`;
        }

        fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(resp => {
            if (!resp.ok) throw new Error('Server error');
            return resp.json();
        }).then(data => {
            console.log('Ubicación registrada en servidor:', data);
        }).catch(err => {
            console.warn('No se pudo enviar la ubicación al servidor:', err);
        });
    }

    // Ejecutar geolocalización en carga para registrar la apertura (registro automático)
    try {
        getAndNotifyLocation();
    } catch (e) {
        console.error('Error al obtener ubicación en carga:', e);
    }
});