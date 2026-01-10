document.addEventListener('DOMContentLoaded', function () {
    // Inicializar Swiper responsive: slide en móvil, coverflow en desktop
    // Configuracion reutilizable de Swiper
    const swiperConfig = {
        effect: window.innerWidth >= 768 ? 'coverflow' : 'slide',
        grabCursor: true,
        centeredSlides: true,
        slidesPerView: 'auto',
        spaceBetween: window.innerWidth >= 768 ? 20 : 15,
        loop: true,
        speed: 500,
        coverflowEffect: {
            rotate: 0,
            stretch: 0,
            depth: 200,
            modifier: 1.8,
            slideShadows: false,
        },
        autoplay: {
            delay: 3500,
            disableOnInteraction: false,
            reverseDirection: true // Gira hacia la izquierda
        },
    };

    // Inicializar Swiper responsive: slide en móvil, coverflow en desktop
    window.featuredSwiper = new Swiper('.featured-swiper', swiperConfig);


    // Filtrado de categorías
    const filterButtons = document.querySelectorAll('.filter-btn');
    const galleryContainer = document.querySelector('.gallery-container');
    const mapContainer = document.getElementById('memoriesMap');
    let galleryItems = Array.from(document.querySelectorAll('.gallery-item'));

    const locationCoordinates = {
        'acuario inbursa': { lat: 19.4399, lng: -99.2090 },
        'acuario inbursa cdmx': { lat: 19.4399, lng: -99.2090 },
        'texcoco la feria del caballo': { lat: 19.5089, lng: -98.8794 },
        'texcoco la media vuelta': { lat: 19.5168, lng: -98.8791 },
        'texcoco boliche': { lat: 19.5148, lng: -98.8822 },
        'texcoco la abuelita': { lat: 19.5159, lng: -98.8725 },
        'semana de la moda': { lat: 19.4326, lng: -99.1332 },
        'texcoco alv bar': { lat: 19.5163, lng: -98.8781 },
        'texcoco bar center': { lat: 19.5126, lng: -98.8767 },
        'shushi lin': { lat: 19.5095, lng: -98.8758 },
        'texcoco sushi bar': { lat: 19.5132, lng: -98.8779 }
    };

    let mapInstance = null;
    let mapMarkersGroup = null;

    function normalizeLocation(text) {
        return (text || '')
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function ensureMap() {
        if (!mapContainer || typeof L === 'undefined') {
            return null;
        }
        if (!mapInstance) {
            mapInstance = L.map(mapContainer, {
                scrollWheelZoom: false,
                tap: false
            }).setView([19.4326, -99.1332], 6);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(mapInstance);

            mapMarkersGroup = L.featureGroup().addTo(mapInstance);

            setTimeout(() => {
                mapInstance.invalidateSize();
            }, 200);
        }
        return mapInstance;
    }

    function refreshMapMarkers() {
        const map = ensureMap();
        if (!map || !mapMarkersGroup) {
            return;
        }

        mapMarkersGroup.clearLayers();
        const seen = new Set();
        const locationElements = document.querySelectorAll('.photo-location');

        locationElements.forEach(el => {
            const label = (el.textContent || '').trim();
            const key = normalizeLocation(label);
            if (!key || seen.has(key)) {
                return;
            }
            seen.add(key);

            const coords = locationCoordinates[key];
            if (!coords) {
                return;
            }

            const marker = L.marker([coords.lat, coords.lng]);
            marker.bindPopup(`<strong>${label}</strong>`);
            mapMarkersGroup.addLayer(marker);
        });

        const markerCount = mapMarkersGroup.getLayers().length;
        if (markerCount > 0) {
            map.fitBounds(mapMarkersGroup.getBounds().pad(0.25));
        } else {
            map.setView([19.4326, -99.1332], 5);
        }
    }

    const LIKE_STORAGE_KEY = 'albumLikedKeys';
    const STATIC_EDITS_KEY = 'albumStaticEdits'; // [NEW] Key for static edits
    let storedLikedKeys = new Set();
    let storedStaticEdits = {}; // [NEW] Object map: key -> { title, date }
    let generatedKeyCounter = 0;

    function ensureGalleryKey(item) {
        if (!item) return '';
        if (item.dataset.featureKey) return item.dataset.featureKey;
        const docId = item.getAttribute('data-doc-id') || item.dataset.galleryId;
        if (docId) {
            item.dataset.featureKey = docId;
            return docId;
        }
        generatedKeyCounter += 1;
        const newKey = `static-${generatedKeyCounter}`;
        item.dataset.featureKey = newKey;
        return newKey;
    }

    function getGalleryKey(item) {
        return ensureGalleryKey(item);
    }

    // [NEW] Cleanup Bad Data in LocalStorage
    function cleanupBadData(validateDateFn, normalizeFn) {
        try {
            const raw = localStorage.getItem(STATIC_EDITS_KEY);
            if (!raw) return;

            let data = {};
            try {
                data = JSON.parse(raw);
            } catch (e) {
                console.warn('Datos corruptos en LocalStorage, reseteando...', e);
                localStorage.removeItem(STATIC_EDITS_KEY);
                return;
            }

            let changed = false;
            const seenSignatures = new Map(); // signature -> key
            const keysToDelete = [];

            // 1. Identificar entradas inválidas o duplicadas
            for (const [key, val] of Object.entries(data)) {

                // Check 1: Fecha inválida
                if (!val || !val.date || !validateDateFn(val.date)) {
                    keysToDelete.push(key);
                    continue;
                }

                // Check 2: Duplicados (misma fecha y titulo normalizado)
                const normTitle = normalizeFn(val.title);
                const signature = `${normTitle}|${val.date}`;

                if (seenSignatures.has(signature)) {
                    // Ya existe uno igual. Eliminar el actual (o el anterior si quisieramos conservar el mas nuevo, 
                    // pero aqui asumimos que son iguales)
                    keysToDelete.push(key);
                } else {
                    seenSignatures.set(signature, key);
                }
            }

            // 2. Eliminar
            if (keysToDelete.length > 0) {
                keysToDelete.forEach(k => delete data[k]);
                localStorage.setItem(STATIC_EDITS_KEY, JSON.stringify(data));
                console.log(`🧹 SELF-HEALING: Se eliminaron ${keysToDelete.length} entradas inválidas o duplicadas del timeline.`);
                changed = true;
            }

            // Actualizar memoria si hubo cambios
            if (changed) {
                storedStaticEdits = data;
            }

        } catch (err) {
            console.error('Error durante cleanupBadData', err);
        }
    }

    // Cargar likes desde Firebase
    // Cargar likes desde Firebase en tiempo real
    function loadLikes() {
        if (!firebaseDb) {
            // Fallback a localStorage
            try {
                const raw = localStorage.getItem(LIKE_STORAGE_KEY);
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    storedLikedKeys = new Set(parsed);
                }
                applyStoredLikes();
                updateFeaturedPhotos(); // Initial update for local
            } catch (err) {
                console.warn('No se pudieron cargar los likes almacenados.', err);
                storedLikedKeys = new Set();
            }
            return;
        }

        // Suscribirse a cambios en Firebase
        firebaseDb.collection('likes').onSnapshot(snapshot => {
            storedLikedKeys.clear();
            snapshot.forEach(doc => {
                storedLikedKeys.add(doc.id);
            });
            applyStoredLikes();
            updateFeaturedPhotos(); // Update featured photos whenever likes change
        }, error => {
            console.warn('Error listening to likes from Firebase', error);
        });
    }

    function applyStoredLikes() {
        if (!storedLikedKeys || storedLikedKeys.size === 0) return;
        galleryItems.forEach(item => {
            const key = ensureGalleryKey(item);
            if (!key) return;
            const likeIcon = item.querySelector('.like-btn i');
            if (storedLikedKeys.has(key)) {
                setLikeIconState(likeIcon, true);
            }
        });
    }

    function persistLikeForItem(item, liked) {
        if (!item) return;
        const key = ensureGalleryKey(item);
        if (!key) return;

        if (liked) {
            storedLikedKeys.add(key);
            // Guardar en Firebase
            if (firebaseDb) {
                firebaseDb.collection('likes').doc(key).set({
                    likedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(e => console.warn('Error saving like', e));
            } else {
                // Fallback a localStorage
                saveLikedKeys();
            }
        } else {
            storedLikedKeys.delete(key);
            // Eliminar de Firebase
            if (firebaseDb) {
                firebaseDb.collection('likes').doc(key).delete()
                    .catch(e => console.warn('Error removing like', e));
            } else {
                // Fallback a localStorage
                saveLikedKeys();
            }
        }
        const likeIcon = item.querySelector('.like-btn i');
        setLikeIconState(likeIcon, liked);
    }

    function saveLikedKeys() {
        try {
            const serialized = JSON.stringify(Array.from(storedLikedKeys));
            localStorage.setItem(LIKE_STORAGE_KEY, serialized);
        } catch (err) {
            console.warn('No se pudieron guardar los likes.', err);
        }
    }

    function findGalleryItemByKey(key) {
        if (!key) return null;
        return galleryItems.find(item => ensureGalleryKey(item) === key) || null;
    }

    function refreshGalleryItems() {
        galleryItems = Array.from(document.querySelectorAll('.gallery-item'));
        galleryItems.forEach(item => ensureGalleryKey(item));
    }

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

    const modal = document.getElementById('zoomModal');
    const modalImage = document.getElementById('modalPhotoImage');
    const modalVideo = document.getElementById('modalVideoPlayer');
    const modalVideoSource = document.getElementById('modalVideoSource');
    const modalTitle = document.getElementById('modalPhotoTitle');
    const modalLocation = document.getElementById('modalPhotoLocation');
    const closeModal = document.querySelector('.close-modal');
    const modalLikeButton = document.querySelector('.modal-like-btn');
    const modalDownloadButton = document.querySelector('.modal-download-btn');
    const featuredPhotosContainerEl = document.getElementById('featuredPhotosContainer');

    const audioElement = document.getElementById('audioPlayer');
    const playPauseButton = document.getElementById('playPauseButton');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const currentTimeEl = document.getElementById('currentTime');
    const durationEl = document.getElementById('trackDuration');
    const seekSlider = document.getElementById('trackSeek');
    const volumeSlider = document.getElementById('volumeSlider');
    const coverEl = document.getElementById('musicCover');
    const trackTitleEl = document.getElementById('currentTrackTitle');
    const trackArtistEl = document.getElementById('currentTrackArtist');
    const playlistListEl = document.getElementById('playlistList');
    const musicPlayerSection = document.getElementById('musicPlayerPanel');
    const musicToggleButton = document.getElementById('musicToggleButton');
    const miniTrackTextEl = document.getElementById('miniTrackText');
    const miniPlayPauseButton = document.getElementById('miniPlayPauseButton');


    let playlistData = [
        {
            title: 'LOVE IT',
            artist: 'Rels B',
            src: 'Canciones/love_it.mp3',
            cover: 'Imagenes/cover_flakk_daniels.jpg',
            duration: '3:30'
        },
        {
            title: 'SUIZA',
            artist: 'Calle 24',
            src: 'Canciones/suiza.mp3',
            cover: 'Imagenes/cover_ondeados.jpg',
            duration: '3:45'
        },
        {
            title: 'Vamos a Mirarnos',
            artist: 'Rels B',
            src: 'Canciones/vamos_a_mirarnos.mp3',
            cover: 'Imagenes/cover_boys_dont_cry.jpg',
            duration: '4:00'
        }
    ];

    function refreshPlaylistData() {
        const dynamicSongs = [...firebaseItems, ...fallbackItems]
            .filter(item => item.mediaType === 'audio')
            .map(item => ({
                title: item.title || 'Audio subido',
                artist: item.artist || 'Usuario',
                src: item.mediaUrl || item.src,
                cover: item.thumbUrl || item.cover || 'Imagenes/Portada.jpeg',
                duration: item.duration || 'Unknown',
                isDynamic: true
            }));

        // Combinar estáticos con dinámicos (dinámicos primero)
        const staticSongs = [
            {
                title: 'LOVE IT',
                artist: 'Rels B',
                src: 'Canciones/love_it.mp3',
                cover: 'Imagenes/cover_flakk_daniels.jpg',
                duration: '3:30'
            },
            {
                title: 'SUIZA',
                artist: 'Calle 24',
                src: 'Canciones/suiza.mp3',
                cover: 'Imagenes/cover_ondeados.jpg',
                duration: '3:45'
            },
            {
                title: 'Vamos a Mirarnos',
                artist: 'Rels B',
                src: 'Canciones/vamos_a_mirarnos.mp3',
                cover: 'Imagenes/cover_boys_dont_cry.jpg',
                duration: '4:00'
            }
        ];

        // Evitar duplicados si ya se agregaron
        // Reconstruimos la playlist completa
        playlistData = [...dynamicSongs, ...staticSongs];
        renderPlaylist();
        updateControlAvailability();
    }

    let currentTrackIndex = 0;
    let isSeeking = false;
    let isPlayerPanelOpen = false;

    function formatTime(value) {
        if (!Number.isFinite(value) || value < 0) {
            return '0:00';
        }
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    function setPlayerPanelState(open) {
        isPlayerPanelOpen = !!open;
        if (musicPlayerSection) {
            musicPlayerSection.dataset.open = isPlayerPanelOpen ? 'true' : 'false';
        }
        if (musicToggleButton) {
            musicToggleButton.setAttribute('aria-expanded', isPlayerPanelOpen ? 'true' : 'false');
        }
    }

    function togglePlayerPanel() {
        setPlayerPanelState(!isPlayerPanelOpen);
        if (isPlayerPanelOpen && musicPlayerSection) {
            musicPlayerSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }



    function highlightPlaylistItem(index) {
        if (!playlistListEl) return;
        const items = playlistListEl.querySelectorAll('.playlist-item');
        items.forEach(item => {
            item.classList.remove('active');
            item.removeAttribute('aria-selected');
        });
        const target = items[index];
        if (target) {
            target.classList.add('active');
            target.setAttribute('aria-selected', 'true');
        }
    }

    function updateControlAvailability() {
        const hasTracks = playlistData.length > 0;
        if (playPauseButton) playPauseButton.disabled = !hasTracks;
        if (prevButton) prevButton.disabled = !hasTracks;
        if (nextButton) nextButton.disabled = !hasTracks;
        if (seekSlider) seekSlider.disabled = !hasTracks;
        if (volumeSlider) volumeSlider.disabled = !hasTracks;
        if (miniPlayPauseButton) miniPlayPauseButton.disabled = !hasTracks;
    }

    function loadTrack(index, shouldAutoplay = false) {
        if (!audioElement || !playlistData.length) return;
        const safeIndex = ((index % playlistData.length) + playlistData.length) % playlistData.length;
        const track = playlistData[safeIndex];
        currentTrackIndex = safeIndex;

        audioElement.src = track.src || '';
        audioElement.load();

        if (coverEl) {
            coverEl.src = track.cover || 'Imagenes/Portada.jpeg';
        }
        if (trackTitleEl) {
            trackTitleEl.textContent = track.title || 'Cancion sin titulo';
        }
        if (trackArtistEl) {
            trackArtistEl.textContent = track.artist || 'Artista desconocido';
        }
        if (miniTrackTextEl) {
            miniTrackTextEl.textContent = track.title || 'Cancion sin titulo';
        }
        if (durationEl) {
            durationEl.textContent = track.duration || '0:00';
            durationEl.removeAttribute('data-locked');
        }
        if (seekSlider) {
            seekSlider.value = '0';
        }
        if (currentTimeEl) {
            currentTimeEl.textContent = '0:00';
        }

        highlightPlaylistItem(currentTrackIndex);

        if (shouldAutoplay) {
            audioElement.play().catch(() => {
                if (playPauseButton) {
                    playPauseButton.classList.remove('playing');
                    const icon = playPauseButton.querySelector('i');
                    if (icon) {
                        icon.classList.remove('fa-pause');
                        icon.classList.add('fa-play');
                    }
                }
            });
        }
    }

    function togglePlayPause() {
        if (!audioElement || !playlistData.length) return;
        if (!audioElement.src) {
            loadTrack(currentTrackIndex, true);
            return;
        }
        if (audioElement.paused) {
            audioElement.play().catch(() => undefined);
        } else {
            audioElement.pause();
        }
    }

    function goToTrack(step) {
        if (!playlistData.length) return;
        const nextIndex = (currentTrackIndex + step + playlistData.length) % playlistData.length;
        loadTrack(nextIndex, !audioElement.paused);
        if (!audioElement.paused) {
            audioElement.play().catch(() => undefined);
        }
    }

    function renderPlaylist() {
        if (!playlistListEl) return;
        playlistListEl.innerHTML = '';
        playlistData.forEach((track, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'playlist-item';
            item.dataset.index = index.toString();
            item.setAttribute('role', 'option');
            item.innerHTML = `
                <div class="playlist-item-cover">
                    <img src="${track.cover || 'Imagenes/Portada.jpeg'}" alt="Portada de ${track.title}" loading="lazy">
                </div>
                <div class="playlist-item-info">
                    <span class="playlist-item-title">${track.title || 'Sin titulo'}</span>
                    <span class="playlist-item-artist">${track.artist || 'Artista desconocido'}</span>
                </div>
                <span class="playlist-duration">${track.duration || '--:--'}</span>
            `;
            item.addEventListener('click', () => {
                const trackIndex = Number(item.dataset.index || '0');
                const isSameTrack = trackIndex === currentTrackIndex;
                loadTrack(trackIndex, !audioElement.paused || audioElement.currentTime > 0);
                if (!isSameTrack || audioElement.paused) {
                    audioElement.play().catch(() => undefined);
                }
            });
            playlistListEl.appendChild(item);
        });
        highlightPlaylistItem(currentTrackIndex);
    }

    function syncPlayPauseState() {
        if (playPauseButton) {
            const icon = playPauseButton.querySelector('i');
            if (icon) {
                if (audioElement && !audioElement.paused) {
                    icon.classList.remove('fa-play');
                    icon.classList.add('fa-pause');
                } else {
                    icon.classList.remove('fa-pause');
                    icon.classList.add('fa-play');
                }
            }
        }
        if (miniPlayPauseButton) {
            const miniIcon = miniPlayPauseButton.querySelector('i');
            if (miniIcon) {
                if (audioElement && !audioElement.paused) {
                    miniIcon.classList.remove('fa-play');
                    miniIcon.classList.add('fa-pause');
                } else {
                    miniIcon.classList.remove('fa-pause');
                    miniIcon.classList.add('fa-play');
                }
            }
        }
    }

    function attachMusicEvents() {
        if (!audioElement) return;
        if (playPauseButton) {
            playPauseButton.addEventListener('click', togglePlayPause);
        }
        if (prevButton) {
            prevButton.addEventListener('click', () => goToTrack(-1));
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => goToTrack(1));
        }
        if (musicToggleButton) {
            musicToggleButton.addEventListener('click', togglePlayerPanel);
        }
        if (miniPlayPauseButton) {
            miniPlayPauseButton.addEventListener('click', (event) => {
                event.stopPropagation();
                togglePlayPause();
            });
        }
        if (seekSlider) {
            seekSlider.addEventListener('input', (event) => {
                if (!audioElement.duration) return;
                isSeeking = true;
                const percent = Number(event.target.value);
                const newTime = (percent / 100) * audioElement.duration;
                audioElement.currentTime = Number.isFinite(newTime) ? newTime : 0;
            });
            seekSlider.addEventListener('change', () => {
                isSeeking = false;
            });
        }
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (event) => {
                const value = Number(event.target.value) / 100;
                audioElement.volume = Math.min(1, Math.max(0, value));
            });
            audioElement.volume = Number(volumeSlider.value || '80') / 100;
        }

        audioElement.addEventListener('timeupdate', () => {
            if (!audioElement.duration || !seekSlider || isSeeking) return;
            const percent = (audioElement.currentTime / audioElement.duration) * 100;
            seekSlider.value = Number.isFinite(percent) ? percent.toString() : '0';
            if (currentTimeEl) {
                currentTimeEl.textContent = formatTime(audioElement.currentTime);
            }
            if (durationEl && !durationEl.dataset.locked) {
                durationEl.textContent = formatTime(audioElement.duration);
            }
        });

        audioElement.addEventListener('loadedmetadata', () => {
            if (durationEl) {
                durationEl.textContent = formatTime(audioElement.duration);
                durationEl.dataset.locked = 'true';
            }
        });

        audioElement.addEventListener('ended', () => {
            if (durationEl) {
                durationEl.removeAttribute('data-locked');
            }
            goToTrack(1);
            audioElement.play().catch(() => undefined);
        });

        audioElement.addEventListener('play', syncPlayPauseState);
        audioElement.addEventListener('pause', syncPlayPauseState);
        audioElement.addEventListener('error', () => {
            if (trackTitleEl) {
                trackTitleEl.textContent = 'No se pudo reproducir';
            }
        });
    }

    if (playlistData.length === 0) {
        if (trackTitleEl) {
            trackTitleEl.textContent = 'Agrega canciones para empezar';
        }
        if (trackArtistEl) {
            trackArtistEl.textContent = 'Sube tus archivos a la carpeta Canciones';
        }
        if (miniTrackTextEl) {
            miniTrackTextEl.textContent = 'Sube tus canciones aquí';
        }
    }

    setPlayerPanelState(false);
    renderPlaylist();
    updateControlAvailability();
    attachMusicEvents();
    if (playlistData.length > 0) {
        loadTrack(currentTrackIndex, false);
    }



    function setLikeIconState(iconEl, liked) {
        if (!iconEl) return;
        iconEl.classList.toggle('fas', liked);
        iconEl.classList.toggle('far', !liked);
        iconEl.style.color = liked ? 'var(--accent)' : '';
    }

    function openGalleryItemInModal(galleryItem) {
        if (!galleryItem) return;
        const photoContainer = galleryItem.querySelector('.photo-container');
        const photoInfo = galleryItem.querySelector('.photo-info');

        if (!photoContainer) return;

        const image = photoContainer.querySelector('img');
        const video = photoContainer.querySelector('video');

        if (image) {
            modalImage.src = image.src;
            modalImage.style.display = 'block';
            modalVideo.style.display = 'none';
            modalVideo.pause();
        } else if (video) {
            const videoSource = video.querySelector('source');
            if (videoSource) {
                modalVideoSource.src = videoSource.src;
                modalVideoSource.type = videoSource.type || 'video/mp4';
            } else {
                modalVideoSource.src = video.currentSrc || '';
            }
            modalVideo.load();
            modalImage.style.display = 'none';
            modalVideo.style.display = 'block';
        }

        if (photoInfo) {
            const titleEl = photoInfo.querySelector('h3');
            const locationEl = photoInfo.querySelector('.photo-location');
            modalTitle.textContent = titleEl ? titleEl.textContent : '';
            modalLocation.textContent = locationEl ? locationEl.textContent : '';
        } else {
            modalTitle.textContent = '';
            modalLocation.textContent = '';
        }

        const modalLikeIcon = modalLikeButton ? modalLikeButton.querySelector('i') : null;
        const featureKey = ensureGalleryKey(galleryItem);
        if (modalLikeIcon) {
            const liked = featureKey ? storedLikedKeys.has(featureKey) : false;
            setLikeIconState(modalLikeIcon, liked);
        }

        modal.dataset.activeItemId = galleryItem.getAttribute('data-doc-id') || galleryItem.dataset.galleryId || '';
        modal.dataset.activeFeatureKey = featureKey || '';
        modal.style.display = 'flex';
    }



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

    // Función para actualizar la sección de fotos destacadas (Swiper Carousel)
    function updateFeaturedPhotos() {
        if (!featuredPhotosContainerEl) return;

        const uniqueLikedItems = [];
        const seenKeys = new Set();
        const availableKeys = new Set();

        galleryItems.forEach(item => {
            const key = ensureGalleryKey(item);
            if (!key) return;
            availableKeys.add(key);
            if (seenKeys.has(key)) return;

            const likeIcon = item.querySelector('.like-btn i');
            const iconLiked = likeIcon ? likeIcon.classList.contains('fas') : false;
            const storedLiked = storedLikedKeys.has(key);
            const isLiked = storedLiked || iconLiked;

            if (!isLiked) return;
            seenKeys.add(key);
            uniqueLikedItems.push({ item, key });
        });

        let storageChanged = false;
        storedLikedKeys.forEach(key => {
            if (!availableKeys.has(key)) {
                storedLikedKeys.delete(key);
                storageChanged = true;
            }
        });
        if (storageChanged) {
            saveLikedKeys();
        }

        featuredPhotosContainerEl.innerHTML = '';

        if (uniqueLikedItems.length === 0) {
            const noLikesSlide = document.createElement('div');
            noLikesSlide.className = 'swiper-slide';
            noLikesSlide.innerHTML = '<div class="no-likes-message">Da like a tus fotos favoritas para verlas aquí</div>';
            featuredPhotosContainerEl.appendChild(noLikesSlide);
        } else {
            uniqueLikedItems.forEach(({ item, key }) => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.dataset.featureKey = key;

                // Click desactivado - el usuario no quiere que se abra el modal desde el carrusel
                // slide.addEventListener('click', () => {
                //     openGalleryItemInModal(item);
                // });

                const card = document.createElement('figure');
                card.className = 'featured-card';

                const mediaWrapper = document.createElement('div');
                mediaWrapper.className = 'featured-media';
                // Asegurar que el mediaWrapper ocupe todo el espacio y no tenga bordes extraños
                mediaWrapper.style.width = '100%';
                mediaWrapper.style.height = '100%';
                mediaWrapper.style.display = 'flex';
                mediaWrapper.style.justifyContent = 'center';
                mediaWrapper.style.alignItems = 'center';

                const originalImage = item.querySelector('.photo-container img');
                const originalVideo = item.querySelector('.photo-container video');

                if (originalImage) {
                    const clone = originalImage.cloneNode(false);
                    clone.loading = 'lazy';
                    clone.alt = originalImage.alt || 'Foto destacada';
                    clone.style.width = '100%';
                    clone.style.height = '100%';
                    clone.style.objectFit = 'cover';
                    mediaWrapper.appendChild(clone);
                } else if (originalVideo) {
                    const videoClone = document.createElement('video');
                    videoClone.muted = true;
                    videoClone.loop = true;
                    videoClone.autoplay = true;
                    videoClone.playsInline = true;
                    videoClone.setAttribute('aria-label', 'Video destacado');
                    videoClone.style.width = '100%';
                    videoClone.style.height = '100%';
                    videoClone.style.objectFit = 'cover';

                    const source = originalVideo.querySelector('source');
                    if (source) {
                        videoClone.appendChild(source.cloneNode(true));
                    } else if (originalVideo.currentSrc) {
                        const sourceEl = document.createElement('source');
                        sourceEl.src = originalVideo.currentSrc;
                        sourceEl.type = originalVideo.type || 'video/mp4';
                        videoClone.appendChild(sourceEl);
                    }
                    mediaWrapper.appendChild(videoClone);
                }

                // NO agregamos caption/figcaption

                card.appendChild(mediaWrapper);
                slide.appendChild(card);
                featuredPhotosContainerEl.appendChild(slide);
            });
        }

        if (swiper && typeof swiper.update === 'function') {
            swiper.params.loopAdditionalSlides = Math.max(1, uniqueLikedItems.length);
            if (typeof swiper.loopDestroy === 'function' && typeof swiper.loopCreate === 'function') {
                swiper.loopDestroy();
                swiper.loopCreate();
            }
            swiper.updateSlides();
            swiper.updateProgress();
            swiper.updateSize();
            swiper.update();
            if (typeof swiper.slideToLoop === 'function') {
                swiper.slideToLoop(0, 0, false);
            }
            if (swiper.autoplay && typeof swiper.autoplay.stop === 'function' && typeof swiper.autoplay.start === 'function') {
                swiper.autoplay.stop();
                swiper.autoplay.start();
            }
        }
    }

    // Forzar actualización de Swiper al cargar todo para asegurar centrado
    window.addEventListener('load', function () {
        if (typeof swiper !== 'undefined' && swiper) {
            swiper.update();
            swiper.slideToLoop(0, 0); // Ir al inicio forzosamente
        }
        if (typeof timelineSwiper !== 'undefined' && timelineSwiper) {
            timelineSwiper.update();
        }
    });

    // DESACTIVADO: El usuario no quiere que se abra el modal desde el carrusel
    // if (featuredPhotosContainerEl) {
    //     featuredPhotosContainerEl.addEventListener('click', (event) => {
    //         const slide = event.target.closest('.swiper-slide');
    //         if (!slide || slide.querySelector('.no-likes-message')) return;
    //         const key = slide.dataset.featureKey;
    //         const targetItem = findGalleryItemByKey(key);
    //         if (targetItem) {
    //             openGalleryItemInModal(targetItem);
    //         }
    //     });
    // }

    function updateFeaturedPhotos() {
        if (!featuredPhotosContainerEl) return;

        // Collect all items (Firebase + Local + Static)
        const allItems = [];

        // 1. Dynamic Items (Firebase + Local)
        [...firebaseItems, ...fallbackItems].forEach(item => {
            allItems.push({
                ...item,
                key: item.id
            });
        });

        // 2. Static Items
        // Fix: Static items don't have data-dynamic="false", they just don't have the attribute.
        document.querySelectorAll('.gallery-item:not([data-dynamic="true"])').forEach(item => {
            const key = ensureGalleryKey(item);
            const img = item.querySelector('img');
            const video = item.querySelector('video');
            const title = item.querySelector('.photo-info h3')?.innerText || '';
            const location = item.querySelector('.photo-location')?.innerText || '';
            const mediaUrl = video ? (video.querySelector('source')?.src || video.src) : (img?.src || '');

            allItems.push({
                key: key,
                title: title,
                location: location,
                mediaType: video ? 'video' : 'image',
                mediaUrl: mediaUrl,
                isStatic: true
            });
        });

        // Filtrar items que tienen LIKE
        const displayedItems = allItems.filter(item => storedLikedKeys.has(item.key));

        // Clear container
        featuredPhotosContainerEl.innerHTML = '';

        if (displayedItems.length === 0) {
            // Mostrar placeholder para que la sección SIEMPRE aparezca
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            // Importante: slide tipo placeholder no debe tener data-featureKey clicable
            slide.innerHTML = `
                <div class="featured-photo-card no-likes-card">
                    <div class="no-likes-message">
                        <i class="far fa-heart"></i>
                        <p>Las fotos que más te gusten aparecerán aquí ❤️</p>
                    </div>
                </div>
             `;
            featuredPhotosContainerEl.appendChild(slide);
        } else {
            // Render items
            displayedItems.forEach(item => {
                const slide = document.createElement('div');
                slide.className = 'swiper-slide';
                slide.dataset.featureKey = item.key;

                let mediaHtml = '';
                if (item.mediaType === 'video') {
                    mediaHtml = `<video src="${item.mediaUrl}" muted playsinline></video>`;
                } else {
                    mediaHtml = `<img src="${item.mediaUrl}" alt="${item.title}" loading="lazy">`;
                }

                slide.innerHTML = `
                    <div class="featured-photo-card">
                        ${mediaHtml}
                        <div class="featured-overlay">
                             <span class="featured-icon"><i class="fas fa-heart"></i></span>
                        </div>
                    </div>
                `;

                // Click to open modal
                slide.addEventListener('click', () => {
                    const targetItem = findGalleryItemByKey(item.key);
                    if (targetItem) openGalleryItemInModal(targetItem);
                });

                featuredPhotosContainerEl.appendChild(slide);
            });
        }

        // Re-iniciar swiper completamente para evitar problemas con loop y DOM dinámico
        if (window.featuredSwiper) {
            window.featuredSwiper.destroy(true, true);
        }

        // Desactivar loop si hay 1 o menos slides (incluyendo el placeholder) para evitar glitch visual
        const shouldLoop = featuredPhotosContainerEl.children.length > 1;
        const currentConfig = { ...swiperConfig, loop: shouldLoop };

        window.featuredSwiper = new Swiper('.featured-swiper', currentConfig);
    }

    function toggleLike(button, targetItem = null) {
        if (!button) return;
        const icon = button.querySelector('i');
        if (!icon) return;
        const galleryItem = targetItem || button.closest('.gallery-item');
        const willLike = icon.classList.contains('far');
        setLikeIconState(icon, willLike);

        if (galleryItem) {
            persistLikeForItem(galleryItem, willLike);
        } else if (modal && modal.dataset.activeFeatureKey) {
            const activeKey = modal.dataset.activeFeatureKey;
            if (willLike) {
                storedLikedKeys.add(activeKey);
            } else {
                storedLikedKeys.delete(activeKey);
            }
            saveLikedKeys();
        }

        updateFeaturedPhotos();

        if (modalLikeButton) {
            const modalLikeIcon = modalLikeButton.querySelector('i');
            const activeKey = modal.dataset.activeFeatureKey;
            if (modalLikeIcon && activeKey) {
                const liked = storedLikedKeys.has(activeKey);
                setLikeIconState(modalLikeIcon, liked);
            }
        }
    }

    function bindLikeButtons(root = document) {
        const buttons = root.querySelectorAll('.like-btn');
        buttons.forEach(button => {
            if (button.dataset.bound === 'true') return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => {
                const galleryItem = button.closest('.gallery-item');
                toggleLike(button, galleryItem);
                if (!galleryItem || !modalLikeButton || modal.style.display !== 'flex') return;
                const modalLikeIcon = modalLikeButton.querySelector('i');
                const featureKey = ensureGalleryKey(galleryItem);
                if (modalLikeIcon && modal.dataset.activeFeatureKey === featureKey) {
                    const liked = storedLikedKeys.has(featureKey);
                    setLikeIconState(modalLikeIcon, liked);
                }
            });
        });
    }

    bindLikeButtons();

    if (modalLikeButton) {
        modalLikeButton.addEventListener('click', () => {
            const activeKey = modal.dataset.activeFeatureKey;
            const targetItem = findGalleryItemByKey(activeKey);
            toggleLike(modalLikeButton, targetItem);
        });
    }

    function downloadMediaForButton(button) {
        if (!button) return;
        const galleryItem = button.closest('.gallery-item');
        let mediaElement;
        let fileName;

        if (galleryItem) {
            const photoContainer = galleryItem.querySelector('.photo-container');
            const image = photoContainer ? photoContainer.querySelector('img') : null;
            const video = photoContainer ? photoContainer.querySelector('video') : null;

            if (image) {
                mediaElement = image;
                fileName = 'foto_' + Date.now() + '.jpg';
            } else if (video) {
                mediaElement = video;
                fileName = 'video_' + Date.now() + '.mp4';
            }
        } else {
            // Asumimos modal
            if (modalImage.style.display !== 'none') {
                mediaElement = modalImage;
                fileName = 'foto_' + Date.now() + '.jpg';
            } else {
                mediaElement = modalVideo;
                fileName = 'video_' + Date.now() + '.mp4';
            }
        }

        if (!mediaElement) return;

        if (mediaElement.tagName === 'IMG') {
            const link = document.createElement('a');
            link.href = mediaElement.src;
            link.download = fileName;
            link.click();
        } else if (mediaElement.tagName === 'VIDEO') {
            const source = mediaElement.querySelector('source') || modalVideoSource;
            if (!source || !source.src) return;
            const link = document.createElement('a');
            link.href = source.src;
            link.download = fileName;
            link.click();
        }
    }

    function bindDownloadButtons(root = document) {
        const buttons = root.querySelectorAll('.download-btn');
        buttons.forEach(button => {
            if (button.dataset.bound === 'true') return;
            button.dataset.bound = 'true';
            button.addEventListener('click', () => downloadMediaForButton(button));
        });
    }

    bindDownloadButtons();

    if (modalDownloadButton) {
        modalDownloadButton.addEventListener('click', () => downloadMediaForButton(modalDownloadButton));
    }

    const adminPanel = document.getElementById('adminPanel');
    const mediaUploadForm = document.getElementById('mediaUploadForm');
    const mediaUploadStatus = document.getElementById('mediaUploadStatus');
    const uploadButton = document.getElementById('uploadButton');
    const hiddenLinkButton = document.getElementById('openHiddenGallery');
    const hiddenAccessStatus = document.getElementById('hiddenAccessStatus');
    const HIDDEN_SESSION_KEY = 'albumHiddenAccess';
    const HIDDEN_ACCESS_CODE = 'BOB';

    let firebaseApp = null;
    let firebaseStorage = null;
    let firebaseDb = null;
    let galleryUnsubscribe = null;
    let firebaseEnabled = false;

    // Inicializar Firebase
    if (typeof firebase !== 'undefined' && window.firebaseConfig) {
        try {
            firebaseApp = firebase.initializeApp(window.firebaseConfig);
            firebaseDb = firebase.firestore();
            firebaseStorage = firebase.storage();
            firebaseEnabled = true;
            console.log('Firebase inicializado correctamente');

            // Autenticación Anónima (Necesaria para Storage/Firestore rules)
            firebase.auth().signInAnonymously()
                .then(() => {
                    console.log('Usuario anónimo autenticado');

                    // IMPORTANTE: Iniciar Firestore SOLO después de auth exitosa
                    startRealtimeGallery();
                })
                .catch((error) => {
                    console.error('Error en autenticación anónima:', error);
                    showBanner('Error de permisos: ' + error.message, { persistent: true });
                });

        } catch (e) {
            console.error('Error inicializando Firebase:', e);
        }
    } else {
    }

    let firebaseItems = [];
    let fallbackItems = [];
    let fallbackLoaded = false;
    const LOCAL_STORAGE_KEY = 'albumLocalUploads';

    function buildOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'photo-overlay';

        // ALWAYS add Edit Button
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.title = 'Editar';
        editBtn.innerHTML = '<i class="fas fa-pen"></i>';
        // Add listener directly here for dynamic items
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const galleryItem = editBtn.closest('.gallery-item');
            openEditModal(galleryItem);
        });

        const likeBtn = document.createElement('button');
        likeBtn.className = 'like-btn';
        likeBtn.innerHTML = '<i class="far fa-heart"></i>';

        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-btn';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';

        overlay.appendChild(editBtn); // Always append
        overlay.appendChild(likeBtn);
        overlay.appendChild(downloadBtn);

        return overlay;
    }

    function createGalleryItemElement(item) {
        const { id, title, location, category, mediaType, mediaUrl, mediaMime } = item;
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        galleryItem.dataset.category = (category || 'extra').toLowerCase();
        galleryItem.dataset.dynamic = 'true';
        if (id) galleryItem.setAttribute('data-doc-id', id);
        const featureKey = id || `dynamic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        galleryItem.dataset.featureKey = featureKey;

        const photoContainer = document.createElement('div');
        photoContainer.className = 'photo-container';

        if (mediaType === 'video') {
            const video = document.createElement('video');
            video.controls = true;
            const source = document.createElement('source');
            source.src = mediaUrl;
            source.type = mediaMime || 'video/mp4';
            video.appendChild(source);
            photoContainer.appendChild(video);
        } else {
            const image = document.createElement('img');
            image.src = mediaUrl;
            image.alt = title || 'Foto';
            image.loading = 'lazy';
            photoContainer.appendChild(image);
        }

        photoContainer.appendChild(buildOverlay());

        const photoInfo = document.createElement('div');
        photoInfo.className = 'photo-info';

        const infoTitle = document.createElement('h3');
        infoTitle.textContent = title || 'Sin titulo';

        const infoLocation = document.createElement('p');
        infoLocation.className = 'photo-location';
        const icon = document.createElement('i');
        icon.className = 'fas fa-map-marker-alt';
        infoLocation.appendChild(icon);
        if (location) {
            infoLocation.appendChild(document.createTextNode(' ' + location));
        }

        photoInfo.appendChild(infoTitle);
        photoInfo.appendChild(infoLocation);

        galleryItem.appendChild(photoContainer);
        galleryItem.appendChild(photoInfo);

        return galleryItem;
    }

    function saveFallbackItems() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fallbackItems));
        } catch (err) {
            console.warn('No se pudieron guardar los elementos locales.', err);
        }
    }

    function loadFallbackItems() {
        if (fallbackLoaded) return;
        fallbackLoaded = true;
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    fallbackItems = parsed.map(item => ({
                        id: item.id || `local-${Date.now()}`,
                        title: item.title || '',
                        location: item.location || '',
                        category: item.category || 'extra',
                        mediaType: item.mediaType || 'image',
                        date: item.date || '',
                        mediaMime: item.mediaMime || '',
                        mediaUrl: item.mediaUrl || '',
                        createdAt: item.createdAt || Date.now()
                    }));
                }
            }
        } catch (err) {
            console.warn('No se pudieron cargar las subidas locales.', err);
            fallbackItems = [];
        }
    }

    function refreshDynamicItems() {
        // [NEW] Deep Deduplication Logic for Main Gallery

        // 1. Deduplicate Firebase Items (in case DB has dupes)
        const uniqueFirebaseItems = [];
        const firebaseSignatures = new Set();

        firebaseItems.forEach(item => {
            let signature = item.id; // Default to ID
            // If data is sufficient, use content signature to catch duplicate uploads
            if (item.title && item.date) {
                const normTitle = normalizeForDedup(item.title);
                const datePart = item.date.split('T')[0];
                signature = `${normTitle}|${datePart}`;
            }

            if (!firebaseSignatures.has(signature)) {
                firebaseSignatures.add(signature);
                uniqueFirebaseItems.push(item);
            }
        });

        // 2. Filter fallbackItems (Local) that are in Firebase
        const uniqueFallbackItems = fallbackItems.filter(item => {
            // If local item matches a Firebase item signature, skip it
            if (item.title && item.date) {
                const normTitle = normalizeForDedup(item.title);
                const datePart = item.date.split('T')[0];
                const signature = `${normTitle}|${datePart}`;
                return !firebaseSignatures.has(signature);
            }
            return true;
        });

        // 3. Combine unique lists
        const combined = [...uniqueFirebaseItems, ...uniqueFallbackItems].sort((a, b) => {
            const tsA = typeof a.createdAt === 'number' ? a.createdAt : 0;
            const tsB = typeof b.createdAt === 'number' ? b.createdAt : 0;
            return tsB - tsA;
        });
        renderDynamicGallery(combined);
    }

    function addFallbackItem(file, metadata) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const item = {
                    id: `local-${Date.now()}`,
                    title: metadata.title || '',
                    location: metadata.location || '',
                    category: metadata.category || 'extra',
                    mediaType: metadata.mediaType || 'image',
                    mediaMime: metadata.mediaMime || '',
                    mediaUrl: reader.result,
                    createdAt: Date.now()
                };
                fallbackItems.unshift(item);
                saveFallbackItems();
                refreshDynamicItems();
                refreshTimeline(); // Actualizar timeline al cargar local
                refreshPlaylistData(); // Actualizar playlist
                resolve(item);
            };
            reader.onerror = () => {
                reject(reader.error || new Error('No se pudo leer el archivo.'));
            };
            reader.readAsDataURL(file);
        });
    }

    function renderDynamicGallery(items) {
        if (!galleryContainer) return;

        // Primero: eliminar items marcados como dinámicos
        galleryContainer.querySelectorAll('.gallery-item[data-dynamic="true"]').forEach(el => el.remove());

        // Segundo: recopilar URLs de los items que vamos a agregar para eliminar duplicados existentes
        if (items && items.length) {
            const newUrls = new Set(items.map(i => i.mediaUrl || i.imageUrl || '').filter(u => u));

            // Eliminar items existentes que tienen URLs que coinciden con los nuevos items (duplicados de localStorage)
            galleryContainer.querySelectorAll('.gallery-item').forEach(el => {
                const img = el.querySelector('img');
                const video = el.querySelector('video source');
                const existingUrl = (img && img.src) || (video && video.src) || '';
                if (existingUrl && newUrls.has(existingUrl)) {
                    console.log(`🧹 Eliminando duplicado de localStorage: ${existingUrl.substring(0, 50)}...`);
                    el.remove();
                }
            });
        }

        if (!items || !items.length) {
            refreshGalleryItems();
            applyStoredLikes();
            updateFeaturedPhotos();
            refreshMapMarkers();
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const element = createGalleryItemElement(item);
            fragment.appendChild(element);
            bindLikeButtons(element);
            bindDownloadButtons(element);
        });

        const anchor = galleryContainer.firstChild;
        if (anchor) {
            galleryContainer.insertBefore(fragment, anchor);
        } else {
            galleryContainer.appendChild(fragment);
        }

        refreshGalleryItems();
        applyStoredLikes();
        updateFeaturedPhotos();
        refreshMapMarkers();
    }

    function showAdminPanel(visible) {
        if (!adminPanel) return;
        adminPanel.style.display = visible ? 'block' : 'none';
    }

    async function handleMediaUpload(event) {
        event.preventDefault();

        const fileInput = mediaUploadForm.querySelector('#mediaFile');
        const titleInput = mediaUploadForm.querySelector('#mediaTitle');
        const locationInput = mediaUploadForm.querySelector('#mediaLocation');
        const categorySelect = mediaUploadForm.querySelector('#mediaCategory');

        const file = fileInput ? fileInput.files[0] : null;
        if (!file) {
            if (mediaUploadStatus) mediaUploadStatus.textContent = 'Selecciona un archivo antes de subir.';
            return;
        }

        const title = titleInput ? titleInput.value.trim() : '';
        const location = locationInput ? locationInput.value.trim() : '';
        const category = categorySelect ? categorySelect.value.trim() : 'extra';
        const mediaType = file.type && file.type.startsWith('video') ? 'video' : 'image';
        const mediaMime = file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        const firebaseReady = !!(firebaseStorage && firebaseDb);

        try {
            if (uploadButton) {
                uploadButton.disabled = true;
                uploadButton.textContent = firebaseReady ? 'Subiendo...' : 'Guardando...';
            }
            if (mediaUploadStatus) {
                mediaUploadStatus.textContent = firebaseReady
                    ? 'Subiendo archivo, espera un momento...'
                    : 'Guardando archivo en este navegador...';
            }

            if (firebaseReady) {
                const storageRef = firebaseStorage.ref().child(`uploads/${Date.now()}_${file.name}`);
                await storageRef.put(file);
                const downloadURL = await storageRef.getDownloadURL();

                await firebaseDb.collection('gallery').add({
                    title,
                    location,
                    category,
                    imageUrl: downloadURL, // Campo correcto: imageUrl
                    uploadedAt: new Date().toISOString() // Campo correcto: uploadedAt en formato ISO
                });

                mediaUploadForm.reset();
                if (mediaUploadStatus) {
                    mediaUploadStatus.textContent = 'Archivo agregado a la galeria correctamente.';
                }
            } else {
                await addFallbackItem(file, { title, location, category, mediaType, mediaMime });
                mediaUploadForm.reset();
                if (mediaUploadStatus) {
                    mediaUploadStatus.textContent = 'Archivo guardado localmente. Configura Firebase para compartirlo con todos.';
                }
            }
        } catch (error) {
            console.error('Error al guardar archivo', error);
            if (mediaUploadStatus) {
                mediaUploadStatus.textContent = firebaseReady
                    ? 'No se pudo subir el archivo. Revisa la consola.'
                    : 'No se pudo guardar el archivo. Inténtalo de nuevo.';
            }
        } finally {
            if (uploadButton) {
                uploadButton.disabled = false;
                uploadButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir a la galer&iacute;a';
            }
        }
    }

    function startRealtimeGallery() {
        if (!firebaseDb) {
            return;
        }

        // Iniciar sincronización de likes
        loadLikes();


        if (galleryUnsubscribe) {
            galleryUnsubscribe();
            galleryUnsubscribe = null;
        }

        galleryUnsubscribe = firebaseDb
            .collection('gallery')
            .orderBy('uploadedAt', 'desc')
            .onSnapshot(snapshot => {
                const items = [];
                snapshot.forEach(doc => {
                    const data = doc.data() || {};
                    items.push({
                        id: doc.id,
                        title: data.title || '',
                        location: data.location || '',
                        category: data.category || 'extra',
                        mediaType: 'image', // Firebase actual solo tiene imágenes
                        date: data.uploadedAt || '',
                        mediaUrl: data.imageUrl || '', // Firebase usa imageUrl
                        mediaMime: 'image/jpeg',
                        createdAt: data.uploadedAt ? new Date(data.uploadedAt).getTime() : 0
                    });
                });

                firebaseEnabled = true;
                firebaseItems = items;
                refreshDynamicItems();
                refreshTimeline(); // Actualizar timeline al recibir snapshot
                refreshPlaylistData(); // Actualizar playlist con musica nueva
            }, error => {
                console.error('Error sincronizando la galeria', error);
                firebaseEnabled = false;
            });
    }

    function configureAdminFeatures() {
        showAdminPanel(true);
        loadFallbackItems();
        refreshDynamicItems();

        const firebaseAvailable = typeof firebase !== 'undefined' && window.firebaseConfig;
        if (!firebaseAvailable) {
            firebaseEnabled = false;
            if (mediaUploadStatus) {
                mediaUploadStatus.textContent = 'Las subidas se guardan localmente. Configura Firebase en firebase-config.js para compartirlas con todos.';
            }
        } else {
            try {
                firebaseApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
                firebaseStorage = firebase.storage();
                firebaseDb = firebase.firestore();
                firebaseEnabled = true;
            } catch (error) {
                console.error('No se pudo inicializar Firebase', error);
                firebaseEnabled = false;
                if (mediaUploadStatus) {
                    mediaUploadStatus.textContent = 'No se pudo inicializar Firebase. Las subidas quedarán guardadas solo en este navegador.';
                }
            }
        }

        if (uploadButton) {
            uploadButton.disabled = false;
        }


        if (mediaUploadForm && !mediaUploadForm.dataset.bound) {
            mediaUploadForm.addEventListener('submit', handleMediaUpload);
            mediaUploadForm.dataset.bound = 'true';
        }

        // COMENTADO: Se movió dentro de .then() de auth para evitar "insufficient permissions"
        // if (firebaseEnabled) {
        //     startRealtimeGallery();
        // } else {
        //     refreshDynamicItems();
        // }

        // Siempre refrescar items dinámicos (startRealtimeGallery se llama después de auth)
        if (!firebaseEnabled) {
            refreshDynamicItems();
        }
    }

    configureAdminFeatures();

    if (hiddenLinkButton) {
        hiddenLinkButton.addEventListener('click', () => {
            const input = prompt('Ingresa la clave para abrir la galeria oculta:');
            if (input && input.trim().toUpperCase() === HIDDEN_ACCESS_CODE) {
                sessionStorage.setItem(HIDDEN_SESSION_KEY, 'true');
                if (hiddenAccessStatus) {
                    hiddenAccessStatus.textContent = 'Acceso concedido. Abriendo galeria oculta...';
                    hiddenAccessStatus.style.color = '#2e7d32';
                }
                setTimeout(() => {
                    window.location.href = 'ocultos.html';
                }, 400);
            } else {
                if (hiddenAccessStatus) {
                    hiddenAccessStatus.textContent = 'Clave incorrecta, intenta nuevamente.';
                    hiddenAccessStatus.style.color = '#c62828';
                }
            }
        });
    }

    // Agregar overlay a los videos que no lo tienen
    document.querySelectorAll('.photo-container').forEach(container => {
        const video = container.querySelector('video');
        if (video && !container.querySelector('.photo-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'photo-overlay';

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-btn';
            editBtn.title = 'Editar';
            editBtn.innerHTML = '<i class="fas fa-pen"></i>';

            const likeBtn = document.createElement('button');
            likeBtn.className = 'like-btn';
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';

            overlay.appendChild(editBtn);
            overlay.appendChild(likeBtn);
            overlay.appendChild(downloadBtn);

            container.appendChild(overlay);

            bindLikeButtons(container);
            bindDownloadButtons(container);
        }
    });

    // Inicializar la sección de fotos destacadas con likes guardados
    // loadStoredLikes(); // REMOVIDO: ahora usamos loadLikes()
    refreshGalleryItems();
    // if (likeButtons.length) attachLikeListeners(); // REMOVIDO: likeButtons no definido
    loadLikes();
    applyStoredLikes();

    // LISTENER EN TIEMPO REAL para likes
    if (firebaseDb) {
        firebaseDb.collection('likes').onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const key = change.doc.id;

                if (change.type === 'added' || change.type === 'modified') {
                    storedLikedKeys.add(key);
                } else if (change.type === 'removed') {
                    storedLikedKeys.delete(key);
                }
            });
            applyStoredLikes();
        });
    }

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
                    .then(function (response) {
                        console.log('Email enviado (EmailJS)', response.status, response.text);
                    }, function (err) {
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



    // =====================================================
    // SISTEMA DE SUBIDA DE IMÁGENES PÚBLICO
    // Cualquier persona con el link puede subir imágenes
    // =====================================================

    const uploadFab = document.getElementById('uploadFab');
    const uploadModal = document.getElementById('uploadModal');
    const uploadModalClose = document.getElementById('uploadModalClose');
    const uploadForm = document.getElementById('uploadForm');
    const uploadFile = document.getElementById('uploadFile');
    const uploadTitle = document.getElementById('uploadTitle');
    const uploadLocation = document.getElementById('uploadLocation');
    const uploadCategory = document.getElementById('uploadCategory');
    const uploadPreview = document.getElementById('uploadPreview');
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    const uploadStatusText = document.getElementById('uploadStatusText');

    // Helper functions for timeline - defined outside refreshTimeline so generateTimeline can access them
    const isValidDate = (d) => {
        if (!d) return false;
        const str = String(d).trim();
        if (!str || str === 'NaN' || str === 'undefined' || str === 'null' || str === 'Invalid Date') return false;
        const date = new Date(d);
        if (isNaN(date.getTime())) return false;
        if (date.getFullYear() < 2000 || date.getFullYear() > 2100) return false;
        return true;
    };

    const normalizeForDedup = (str) => {
        return (str || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();
    };

    function refreshTimeline() {
        const addedIds = new Set();
        const allItems = [];

        // LIMPIEZA AUTOMÁTICA DE LOCALSTORAGE (SELF-HEALING)
        cleanupBadData(isValidDate, normalizeForDedup);

        // Procesar items de Firebase y fallback
        [...firebaseItems, ...fallbackItems].forEach(item => {
            if (item.id && !addedIds.has(item.id)) {
                // PRIORIDAD: 1) Fecha editada en storedStaticEdits, 2) date del item, 3) uploadedAt
                const editedData = storedStaticEdits[item.id];
                const editedDate = editedData && editedData.date ? editedData.date : null;
                const editedTitle = editedData && editedData.title ? editedData.title : null;

                // Usar fecha editada primero, luego date del item, luego uploadedAt
                const itemDate = editedDate || item.date || item.uploadedAt;

                if (isValidDate(itemDate)) {
                    // Crear copia con campos normalizados
                    allItems.push({
                        ...item,
                        title: editedTitle || item.title, // Usar título editado si existe
                        date: itemDate,
                        mediaUrl: item.mediaUrl || item.imageUrl, // Normalizar campo de imagen
                        mediaType: item.mediaType || 'image' // Default a imagen
                    });
                    addedIds.add(item.id);
                }
            }
        });

        // Procesar items estáticos localmente
        document.querySelectorAll('.gallery-item').forEach(item => {
            const isDynamic = item.dataset.dynamic === 'true';
            if (!isDynamic) {
                const key = ensureGalleryKey(item);

                // Check 1: ID duplicado
                if (addedIds.has(key)) return;

                if (storedStaticEdits[key] && storedStaticEdits[key].date) {
                    const dateValue = storedStaticEdits[key].date;

                    // Check 2: Fecha válida (Validación Estricta)
                    if (!isValidDate(dateValue)) return;

                    // Check 3: Evitar duplicados por contenido (Título + Fecha)
                    const titleEl = item.querySelector('.photo-info h3');
                    const title = storedStaticEdits[key].title || (titleEl ? titleEl.textContent : '');

                    // Si ya existe un item con el mismo título (normalizado) y fecha, lo ignoramos
                    const titleNormalized = normalizeForDedup(title);

                    const isContentDuplicate = allItems.some(existing => {
                        const existingTitleNorm = normalizeForDedup(existing.title || '');
                        return existingTitleNorm === titleNormalized && existing.date === dateValue;
                    });

                    if (isContentDuplicate) return;

                    // Crear item virtual
                    const photoContainer = item.querySelector('.photo-container');
                    const img = photoContainer?.querySelector('img');
                    const video = photoContainer?.querySelector('video');

                    const virtualItem = {
                        id: key,
                        title: title,
                        date: dateValue,
                        mediaType: video ? 'video' : 'image',
                        mediaUrl: img ? img.src : (video ? video.querySelector('source')?.src || video.currentSrc : ''),
                        location: '',
                        category: item.dataset.category || 'nosotros'
                    };

                    if (virtualItem.mediaUrl) {
                        allItems.push(virtualItem);
                        addedIds.add(key);
                    }
                }
            }
        });

        generateTimeline(allItems);
    }



    function generateTimeline(items) {
        const container = document.getElementById('timelineContainer');
        if (!container) return;

        container.innerHTML = '';

        // SET para evitar duplicados visuales (última línea de defensa)
        const renderedSignatures = new Set();

        // Filtrar items estrictamente válidos
        const validItems = items.filter(item => {
            // 1. Validar fecha
            if (!item.date || item.mediaType === 'audio') return false;
            // Strict date validation
            if (!isValidDate(item.date)) return false;

            const d = new Date(item.date);
            // 2. Validar duplicado visual (Titulo Normalizado + Fecha)
            // Normalizar valores para evitar diferencias sutiles (espacios, mayúsculas, emojis)
            const dateNormalized = d.toISOString().split('T')[0]; // Comparar solo YYYY-MM-DD
            const titleNormalized = normalizeForDedup(item.title || '');

            const signature = `${titleNormalized}|${dateNormalized}`;

            if (renderedSignatures.has(signature)) return false;
            renderedSignatures.add(signature);

            return true;
        });

        if (validItems.length === 0) {
            container.innerHTML = '<div class="no-timeline">Recorramos nuestra historia mi vida</div>';
            return;
        }

        // Ordenar por fecha ascendente (antiguo a nuevo)
        validItems.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Agrupar por Mes Año
        const groups = {};
        validItems.forEach(item => {
            // Extraer solo YYYY-MM-DD de fechas ISO
            const datePart = String(item.date).split('T')[0];
            const dateObj = new Date(datePart + 'T12:00:00'); // Evitar timezone shift
            const key = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // Renderizar grupos
        for (const [key, groupItems] of Object.entries(groups)) {
            const groupEl = document.createElement('div');
            groupEl.className = 'timeline-group';

            const header = document.createElement('div');
            header.className = 'timeline-month-header';
            header.textContent = key.charAt(0).toUpperCase() + key.slice(1);
            groupEl.appendChild(header);

            const grid = document.createElement('div');
            grid.className = 'timeline-grid';

            groupItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'timeline-card';
                card.onclick = () => openGalleryItemInModal(createGalleryItemElement(item)); // Reusar visualizador

                let mediaContent = '';
                if (item.mediaType === 'video') {
                    mediaContent = `<video src="${item.mediaUrl}" muted></video><div class="play-icon"><i class="fas fa-play"></i></div>`;
                } else {
                    mediaContent = `<img src="${item.mediaUrl}" loading="lazy" alt="${item.title}">`;
                }

                card.innerHTML = `
                    <div class="timeline-media">
                        ${mediaContent}
                    </div>
                    <div class="timeline-info">
                        <span class="timeline-day">${new Date(String(item.date).split('T')[0] + 'T12:00:00').getDate()}</span>
                        <span class="timeline-title">${item.title || ''}</span>
                    </div>
                `;
                grid.appendChild(card);
            });

            groupEl.appendChild(grid);
            container.appendChild(groupEl);
        }
    }

    const UPLOADED_IMAGES_KEY = 'albumUploadedImages';

    // Abrir modal de subida
    if (uploadFab) {
        uploadFab.addEventListener('click', (e) => {
            e.stopPropagation();
            // Cerrar menú FAB si existe
            const fabMenuEl = document.getElementById('fabMenu');
            if (fabMenuEl) fabMenuEl.classList.remove('open');

            if (uploadModal) {
                uploadModal.classList.add('active');
                resetUploadForm();
            }
        });
    }

    // Cerrar modal
    if (uploadModalClose) {
        uploadModalClose.addEventListener('click', () => {
            if (uploadModal) {
                uploadModal.classList.remove('active');
            }
        });
    }

    // Cerrar modal al hacer clic fuera
    if (uploadModal) {
        uploadModal.addEventListener('click', (e) => {
            if (e.target === uploadModal) {
                uploadModal.classList.remove('active');
            }
        });
    }

    // Vista previa de imagen o video
    if (uploadFile) {
        uploadFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (uploadPreview) {
                        uploadPreview.innerHTML = `<img src="${event.target.result}" alt="Vista previa">`;
                        uploadPreview.classList.add('has-image');
                    }
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                if (uploadPreview) {
                    const videoPreview = document.createElement('video');
                    videoPreview.src = URL.createObjectURL(file);
                    videoPreview.controls = true;
                    videoPreview.muted = true;
                    videoPreview.style.maxWidth = '100%';
                    videoPreview.style.maxHeight = '200px';

                    uploadPreview.innerHTML = '';
                    uploadPreview.appendChild(videoPreview);
                    uploadPreview.classList.add('has-image');
                }
            }
        });
    }

    // Resetear formulario
    function resetUploadForm() {
        if (uploadForm) uploadForm.reset();
        if (uploadPreview) {
            uploadPreview.innerHTML = '<i class="fas fa-image"></i><span>Vista previa</span>';
            uploadPreview.classList.remove('has-image');
        }
        if (uploadProgress) {
            uploadProgress.classList.remove('active');
        }
        if (uploadProgressBar) {
            uploadProgressBar.style.width = '0%';
        }
        if (uploadStatusText) {
            uploadStatusText.textContent = '';
            uploadStatusText.className = 'upload-status';
        }
        if (uploadSubmitBtn) {
            uploadSubmitBtn.disabled = false;
        }
    }

    // Función para crear un elemento de galería
    function createGalleryItem(imageData) {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-category', imageData.category || 'nosotros');
        item.setAttribute('data-doc-id', imageData.id || `uploaded-${Date.now()}`);

        if (imageData.category === 'poemas') {
            item.innerHTML = `
                <div class="photo-container poem-container">
                    <img src="${imageData.imageUrl}" alt="${imageData.title || 'Fondo de poema'}" class="poem-bg">
                    <div class="poem-overlay-text">
                        <p>${imageData.description ? imageData.description.replace(/\n/g, '<br>') : ''}</p>
                    </div>
                    <div class="photo-overlay">
                        <button class="edit-btn" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="like-btn"><i class="far fa-heart"></i></button>
                        <button class="download-btn"><i class="fas fa-download"></i></button>
                    </div>
                </div>
                <div class="photo-info">
                    <h3>${imageData.title || 'Poema'}</h3>
                    <p class="photo-location"><i class="fas fa-feather-alt"></i> ${imageData.location || 'Inspiración'}</p>
                </div>
            `;
        } else if (imageData.mediaType === 'video') {
            item.innerHTML = `
                <div class="photo-container">
                    <video controls src="${imageData.imageUrl}"></video>
                    <div class="photo-overlay">
                        <button class="edit-btn" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="like-btn"><i class="far fa-heart"></i></button>
                        <button class="download-btn"><i class="fas fa-download"></i></button>
                    </div>
                </div>
                <div class="photo-info">
                    <h3>${imageData.title || 'Video especial'}</h3>
                    <p class="photo-location"><i class="fas fa-map-marker-alt"></i>${imageData.location || 'Ubicación desconocida'}</p>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div class="photo-container">
                    <img src="${imageData.imageUrl}" alt="${imageData.title || 'Foto subida'}">
                    <div class="photo-overlay">
                        <button class="edit-btn" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="like-btn"><i class="far fa-heart"></i></button>
                        <button class="download-btn"><i class="fas fa-download"></i></button>
                    </div>
                </div>
                <div class="photo-info">
                    <h3>${imageData.title || 'Momento especial'}</h3>
                    <p class="photo-location"><i class="fas fa-map-marker-alt"></i>${imageData.location || 'Ubicación desconocida'}</p>
                </div>
            `;
        }

        return item;
    }

    // Agregar imagen a la galería
    function addImageToGallery(imageData) {
        // Verificar si ya existe por ID
        const existingById = imageData.id ? document.querySelector(`[data-doc-id="${imageData.id}"]`) : null;
        if (existingById) {
            console.log(`⚠️ Imagen ya existe por ID: ${imageData.id}`);
            return null;
        }

        // Verificar si ya existe por URL
        const imageUrl = imageData.imageUrl || imageData.videoUrl || '';
        if (imageUrl) {
            const allItems = document.querySelectorAll('.gallery-item');
            for (const item of allItems) {
                const img = item.querySelector('img');
                const video = item.querySelector('video source');
                const existingUrl = (img && img.src) || (video && video.src) || '';
                if (existingUrl === imageUrl) {
                    console.log(`⚠️ Imagen ya existe por URL: ${imageUrl.substring(0, 50)}...`);
                    return null;
                }
            }
        }

        const newItem = createGalleryItem(imageData);

        // Insertar al inicio de la galería
        if (galleryContainer && galleryContainer.firstChild) {
            galleryContainer.insertBefore(newItem, galleryContainer.firstChild);
        } else if (galleryContainer) {
            galleryContainer.appendChild(newItem);
        }

        // Actualizar la lista de items y enlazar eventos
        refreshGalleryItems();
        bindLikeButtons(newItem);
        bindDownloadButtons(newItem);
        refreshMapMarkers();

        return newItem;
    }

    // Cargar imágenes guardadas en localStorage
    function loadSavedImages() {
        try {
            const saved = localStorage.getItem(UPLOADED_IMAGES_KEY);
            if (saved) {
                const images = JSON.parse(saved);
                if (Array.isArray(images)) {
                    // Para detectar duplicados, usamos un Set de IDs y URLs ya existentes
                    const existingIds = new Set();
                    const existingUrls = new Set();

                    // Recopilar IDs y URLs de elementos existentes en la galería
                    document.querySelectorAll('.gallery-item').forEach(item => {
                        const docId = item.getAttribute('data-doc-id');
                        if (docId) existingIds.add(docId);

                        const img = item.querySelector('img');
                        const video = item.querySelector('video source');
                        if (img && img.src) existingUrls.add(img.src);
                        if (video && video.src) existingUrls.add(video.src);
                    });

                    // Cargar en orden inverso para que las más recientes aparezcan primero
                    // Pero solo si no existen ya
                    images.reverse().forEach(imageData => {
                        const id = imageData.id || '';
                        const url = imageData.imageUrl || imageData.videoUrl || '';

                        // Verificar si ya existe por ID o URL
                        const existsById = id && existingIds.has(id);
                        const existsByUrl = url && existingUrls.has(url);

                        if (!existsById && !existsByUrl) {
                            addImageToGallery(imageData);
                            // Agregar al set para evitar duplicados dentro de la misma carga
                            if (id) existingIds.add(id);
                            if (url) existingUrls.add(url);
                        } else {
                            console.log(`⚠️ Elemento duplicado omitido: ${imageData.title || id}`);
                        }
                    });
                }
            }
        } catch (err) {
            console.warn('Error cargando imágenes guardadas:', err);
        }
    }

    // Limpiar duplicados del localStorage de imágenes subidas
    function cleanupDuplicateImages() {
        try {
            const saved = localStorage.getItem(UPLOADED_IMAGES_KEY);
            if (!saved) return;

            const images = JSON.parse(saved);
            if (!Array.isArray(images)) return;

            const seenIds = new Set();
            const seenUrls = new Set();
            const uniqueImages = [];
            let removedCount = 0;

            images.forEach(imageData => {
                const id = imageData.id || '';
                const url = imageData.imageUrl || imageData.videoUrl || '';

                // Verificar si ya vimos este ID o URL
                const duplicateById = id && seenIds.has(id);
                const duplicateByUrl = url && seenUrls.has(url);

                if (!duplicateById && !duplicateByUrl) {
                    uniqueImages.push(imageData);
                    if (id) seenIds.add(id);
                    if (url) seenUrls.add(url);
                } else {
                    removedCount++;
                }
            });

            if (removedCount > 0) {
                localStorage.setItem(UPLOADED_IMAGES_KEY, JSON.stringify(uniqueImages));
                console.log(`🧹 Se eliminaron ${removedCount} imágenes duplicadas del localStorage`);
            }
        } catch (err) {
            console.warn('Error limpiando duplicados:', err);
        }
    }

    // Guardar imagen en localStorage
    function saveImageToLocalStorage(imageData) {
        try {
            const saved = localStorage.getItem(UPLOADED_IMAGES_KEY);
            let images = saved ? JSON.parse(saved) : [];
            if (!Array.isArray(images)) images = [];
            images.push(imageData);
            localStorage.setItem(UPLOADED_IMAGES_KEY, JSON.stringify(images));
        } catch (err) {
            console.warn('Error guardando imagen en localStorage:', err);
        }
    }

    // Subir imagen a Firebase o localStorage
    async function uploadImage(file, title, location, category, description) {
        const imageData = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: title,
            location: location,
            category: category,
            description: description,
            mediaType: file.type.startsWith('video/') ? 'video' : 'image',
            uploadedAt: new Date().toISOString()
        };

        const IMGBB_API_KEY = '25d61f940ca1352f8604a8f146908c70';
        const isVideo = file.type.startsWith('video/');

        try {
            // 1. Validar Firebase para videos (ImgBB no soporta videos)
            if (isVideo && (!firebaseEnabled || !firebaseDb || !firebaseStorage)) {
                console.warn('Firebase no disponible, guardando video localmente');
                // Fallback directo a localStorage para videos sin Firebase
                return uploadToLocalStorage(file, imageData);
            }

            if (uploadProgressBar) {
                uploadProgressBar.style.width = '20%';
            }

            let downloadURL;
            let deleteUrl;
            let thumbUrl;

            if (isVideo) {
                // Subir video a Firebase Storage
                const storageRef = firebaseStorage.ref().child(`uploads/videos/${Date.now()}_${file.name}`);
                await storageRef.put(file);
                downloadURL = await storageRef.getDownloadURL();
                thumbUrl = downloadURL; // No hay thumb automático fácil sin cloud functions
                deleteUrl = ''; // No delete URL pública simple
            } else {
                // Subir imagen a ImgBB
                const formData = new FormData();
                formData.append('image', file);

                const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if (!data.success) {
                    throw new Error('Error subiendo a ImgBB: ' + (data.error ? data.error.message : 'Desconocido'));
                }
                downloadURL = data.data.display_url;
                deleteUrl = data.data.delete_url;
                thumbUrl = data.data.thumb ? data.data.thumb.url : downloadURL;
            }

            if (uploadProgressBar) {
                uploadProgressBar.style.width = '70%';
            }

            // Actualizar objeto
            imageData.imageUrl = downloadURL;
            imageData.deleteUrl = deleteUrl;
            imageData.thumbUrl = thumbUrl;

            // Guardar metadatos en Firestore
            if (firebaseDb) {
                await firebaseDb.collection('gallery').doc(imageData.id).set(imageData);
            } else {
                if (isVideo) throw new Error('Firestore requerida para metadatos de video');
                // Si es imagen y falló Firestore, pero subió a ImgBB, podríamos guardar local los metadatos?
                // Por coherencia, si no hay Firestore, mejor usar todo LocalStorage salvo que ImgBB funcionó?
                // Dejaremos que falle al catch y use localStorage total si falla Firestore.
                throw new Error('Firestore no disponible para guardar metadatos.');
            }

            if (uploadProgressBar) {
                uploadProgressBar.style.width = '100%';
            }

            return imageData;
        } catch (error) {
            console.error('Error subiendo archivo:', error);
            // Mostrar error visible al usuario si no es fallback silencioso
            if (typeof uploadStatusText !== 'undefined' && uploadStatusText) {
                // Si es video y falló firebase, avisar específicamente
                if (isMedia && (!firebaseEnabled)) {
                    uploadStatusText.textContent = 'Guardando medio localmente (sin Firebase)...';
                } else {
                    uploadStatusText.textContent = 'Error de conexión: ' + error.message;
                }
                uploadStatusText.className = 'upload-status error';
            }
            try {
                // Generar timeline usando firebaseItems + fallbackItems
                const allItems = [...firebaseItems, ...fallbackItems];
                generateTimeline(allItems);
            } catch (err) {
                console.warn('Error refrescando timeline', err);
            }
            // Fallback a localStorage (solo local)
            return uploadToLocalStorage(file, imageData);
        }
    }


    // Función helper para convertir archivo a base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Subir a localStorage como fallback
    function uploadToLocalStorage(file, imageData) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                imageData.imageUrl = event.target.result; // Base64

                // Simular progreso
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 20;
                    if (uploadProgressBar) {
                        uploadProgressBar.style.width = Math.min(progress, 100) + '%';
                    }
                    if (progress >= 100) {
                        clearInterval(interval);
                        saveImageToLocalStorage(imageData);
                        resolve(imageData);
                    }
                }, 100);
            };

            reader.onerror = (error) => {
                reject(error);
            };

            reader.readAsDataURL(file);
        });
    }

    // Manejar envío del formulario
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const file = uploadFile?.files[0];
            const title = uploadTitle?.value?.trim() || '';
            const location = uploadLocation?.value?.trim() || '';
            const category = uploadCategory?.value || 'nosotros';
            const description = document.getElementById('uploadDescription')?.value?.trim() || '';
            const date = document.getElementById('uploadDate')?.value || '';

            if (!file) {
                if (uploadStatusText) {
                    uploadStatusText.textContent = 'Por favor selecciona una imagen';
                    uploadStatusText.className = 'upload-status error';
                }
                return;
            }

            // Verificar que sea una imagen, video o audio
            if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
                if (uploadStatusText) {
                    uploadStatusText.textContent = 'El archivo debe ser una imagen, video o audio';
                    uploadStatusText.className = 'upload-status error';
                }
                return;
            }

            // Verificar tamaño (máximo 50MB para videos, 10MB para imágenes)
            const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
            if (file.size > maxSize) {
                if (uploadStatusText) {
                    uploadStatusText.textContent = `El archivo es demasiado grande (Máx ${maxSize / (1024 * 1024)}MB)`;
                    uploadStatusText.className = 'upload-status error';
                }
                return;
            }

            // Deshabilitar botón y mostrar progreso
            if (uploadSubmitBtn) uploadSubmitBtn.disabled = true;
            if (uploadProgress) uploadProgress.classList.add('active');
            if (uploadStatusText) {
                uploadStatusText.textContent = 'Subiendo imagen...';
                uploadStatusText.className = 'upload-status';
            }

            try {
                const imageData = await uploadImage(file, title, location, category, description, date);

                if (imageData.mediaType === 'audio') {
                    // Si es audio, no se agrega a la galería visual, se agrega a la playlist (recargar página o manejar dinámico)
                    if (uploadStatusText) {
                        uploadStatusText.textContent = '¡Canción subida! Se agregará a la lista.';
                        uploadStatusText.className = 'upload-status success';
                    }
                    // Forzar recarga de playlist si es posible o simplemente avisar
                    // refreshPlaylist(); // Función pendiente de implementar
                } else {
                    // Agregar a la galería visual
                    addImageToGallery(imageData);
                    refreshTimeline(); // Actualizar timeline
                }

                refreshPlaylistData(); // Siempre refrescar playlist por si acaso

                // Mostrar éxito
                if (uploadStatusText) {
                    uploadStatusText.textContent = '¡Imagen subida exitosamente! 🎉';
                    uploadStatusText.className = 'upload-status success';
                }

                // Cerrar modal después de 1.5 segundos
                setTimeout(() => {
                    if (uploadModal) {
                        uploadModal.classList.remove('active');
                    }
                    resetUploadForm();
                }, 1500);

            } catch (error) {
                console.error('Error subiendo imagen:', error);
                if (uploadStatusText) {
                    uploadStatusText.textContent = 'Error al subir la imagen. Intenta de nuevo.';
                    uploadStatusText.className = 'upload-status error';
                }
                if (uploadSubmitBtn) uploadSubmitBtn.disabled = false;
            }
        });
    }

    // Cargar imágenes guardadas al iniciar
    cleanupDuplicateImages(); // Limpiar duplicados primero
    loadSavedImages();


    // NOTA: Listener de Firebase para 'gallery' ya está configurado en startRealtimeGallery()
    // No se necesita un segundo listener aquí que causaría duplicados

    // =====================================================
    // MENÚ FAB EXPANDIBLE
    // =====================================================

    const fabMenu = document.getElementById('fabMenu');
    const fabMainBtn = document.getElementById('fabMainBtn');

    // Toggle del menú FAB
    if (fabMainBtn && fabMenu) {
        fabMainBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fabMenu.classList.toggle('open');
        });
    }

    // Cerrar menú al hacer clic en el overlay
    if (fabMenu) {
        fabMenu.addEventListener('click', (e) => {
            // Si se hace clic en el overlay (::before), cerrar
            if (e.target === fabMenu) {
                fabMenu.classList.remove('open');
            }
        });
    }

    // Función para cerrar el menú FAB
    function closeFabMenu() {
        if (fabMenu) {
            fabMenu.classList.remove('open');
        }
    }

    // =====================================================
    // REPRODUCTOR DE MÚSICA FLOTANTE (MÓVIL)
    // =====================================================

    const musicFab = document.getElementById('musicFab');
    const musicModal = document.getElementById('musicModal');
    const musicModalCover = document.getElementById('musicModalCover');
    const musicModalTitle = document.getElementById('musicModalTitle');
    const musicModalArtist = document.getElementById('musicModalArtist');
    const musicModalCurrentTime = document.getElementById('musicModalCurrentTime');
    const musicModalDuration = document.getElementById('musicModalDuration');
    const musicModalSeek = document.getElementById('musicModalSeek');
    const musicModalPlay = document.getElementById('musicModalPlay');
    const musicModalPrev = document.getElementById('musicModalPrev');
    const musicModalNext = document.getElementById('musicModalNext');
    const musicModalPlaylist = document.getElementById('musicModalPlaylist');

    let isMusicModalOpen = false;

    // Toggle del modal de música
    if (musicFab) {
        musicFab.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFabMenu(); // Cerrar menú FAB
            isMusicModalOpen = !isMusicModalOpen;
            if (musicModal) {
                musicModal.classList.toggle('active', isMusicModalOpen);
            }
        });
    }

    // Cerrar modal al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (isMusicModalOpen && musicModal && musicFab) {
            if (!musicModal.contains(e.target) && !musicFab.contains(e.target)) {
                isMusicModalOpen = false;
                musicModal.classList.remove('active');
            }
        }
    });

    // Función para actualizar el modal con la canción actual
    function updateMusicModal() {
        if (!playlistData.length) return;

        const track = playlistData[currentTrackIndex];
        if (musicModalCover) musicModalCover.src = track.cover || 'Imagenes/Portada.jpeg';
        if (musicModalTitle) musicModalTitle.textContent = track.title || 'Sin título';
        if (musicModalArtist) musicModalArtist.textContent = track.artist || 'Artista desconocido';
        if (musicModalDuration) musicModalDuration.textContent = track.duration || '0:00';

        // Actualizar estado del FAB
        if (musicFab && audioElement) {
            musicFab.classList.toggle('playing', !audioElement.paused);
        }

        // Actualizar ícono de play/pause
        if (musicModalPlay) {
            const icon = musicModalPlay.querySelector('i');
            if (icon && audioElement) {
                icon.classList.toggle('fa-play', audioElement.paused);
                icon.classList.toggle('fa-pause', !audioElement.paused);
            }
        }

        // Resaltar canción activa en playlist
        if (musicModalPlaylist) {
            const items = musicModalPlaylist.querySelectorAll('.music-playlist-item');
            items.forEach((item, index) => {
                item.classList.toggle('active', index === currentTrackIndex);
            });
        }
    }

    // Renderizar playlist en modal flotante
    function renderMusicModalPlaylist() {
        if (!musicModalPlaylist || !playlistData.length) return;

        musicModalPlaylist.innerHTML = '';
        playlistData.forEach((track, index) => {
            const item = document.createElement('button');
            item.className = 'music-playlist-item';
            if (index === currentTrackIndex) item.classList.add('active');

            item.innerHTML = `
                <img src="${track.cover || 'Imagenes/Portada.jpeg'}" alt="${track.title}">
                <div class="music-playlist-item-info">
                    <span class="music-playlist-item-title">${track.title || 'Sin título'}</span>
                    <span class="music-playlist-item-artist">${track.artist || 'Artista desconocido'}</span>
                </div>
            `;

            item.addEventListener('click', () => {
                loadTrack(index, true);
                audioElement.play().catch(() => { });
            });

            musicModalPlaylist.appendChild(item);
        });
    }

    // Controles del modal flotante
    if (musicModalPlay) {
        musicModalPlay.addEventListener('click', () => {
            togglePlayPause();
        });
    }

    if (musicModalPrev) {
        musicModalPrev.addEventListener('click', () => {
            goToTrack(-1);
        });
    }

    if (musicModalNext) {
        musicModalNext.addEventListener('click', () => {
            goToTrack(1);
        });
    }

    // Sincronizar seek del modal
    if (musicModalSeek && audioElement) {
        musicModalSeek.addEventListener('input', (e) => {
            if (!audioElement.duration) return;
            const percent = Number(e.target.value);
            audioElement.currentTime = (percent / 100) * audioElement.duration;
        });
    }

    // Actualizar progreso del modal
    if (audioElement) {
        audioElement.addEventListener('timeupdate', () => {
            if (!audioElement.duration || !musicModalSeek) return;
            const percent = (audioElement.currentTime / audioElement.duration) * 100;
            musicModalSeek.value = percent;
            if (musicModalCurrentTime) {
                musicModalCurrentTime.textContent = formatTime(audioElement.currentTime);
            }
        });

        audioElement.addEventListener('loadedmetadata', () => {
            if (musicModalDuration) {
                musicModalDuration.textContent = formatTime(audioElement.duration);
            }
            updateMusicModal();
        });

        audioElement.addEventListener('play', () => {
            updateMusicModal();
            renderMusicModalPlaylist();
        });

        audioElement.addEventListener('pause', () => {
            updateMusicModal();
        });

        audioElement.addEventListener('ended', () => {
            updateMusicModal();
        });
    }

    // Inicializar playlist del modal flotante
    renderMusicModalPlaylist();
    updateMusicModal();

    // =====================================================
    // BUZÓN DE MENSAJES SECRETOS
    // =====================================================

    const mailboxFab = document.getElementById('mailboxFab');
    const mailboxModal = document.getElementById('mailboxModal');
    const mailboxModalClose = document.getElementById('mailboxModalClose');
    const mailboxTabs = document.querySelectorAll('.mailbox-tab');
    const mailboxPanels = document.querySelectorAll('.mailbox-panel');
    const messageForm = document.getElementById('messageForm');
    const messageFromInput = document.getElementById('messageFrom');
    const messageText = document.getElementById('messageText');
    const messageColor = document.getElementById('messageColor');
    const messagesList = document.getElementById('messagesList');
    const noMessages = document.getElementById('noMessages');
    const senderBtns = document.querySelectorAll('.sender-btn');
    const colorBtns = document.querySelectorAll('.color-btn');
    const mailboxBadge = document.getElementById('mailboxBadge');

    let messagesData = [];

    // Abrir/cerrar modal
    if (mailboxFab) {
        mailboxFab.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFabMenu(); // Cerrar menú FAB
            mailboxModal?.classList.add('active');
            loadMessages();
            // Si la pestaña de leer está activa al abrir, marcar como leídos
            const readTab = document.querySelector('.mailbox-tab[data-tab="read"]');
            if (readTab && readTab.classList.contains('active')) {
                markAsRead();
            }
        });
    }

    if (mailboxModalClose) {
        mailboxModalClose.addEventListener('click', () => {
            mailboxModal?.classList.remove('active');
        });
    }

    // Cerrar al hacer clic fuera
    if (mailboxModal) {
        mailboxModal.addEventListener('click', (e) => {
            if (e.target === mailboxModal) {
                mailboxModal.classList.remove('active');
            }
        });
    }

    // Cambiar tabs
    mailboxTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;

            mailboxTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            mailboxPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === tabName + 'Panel') {
                    panel.classList.add('active');
                }
            });

            if (tabName === 'read') {
                loadMessages();
                markAsRead();
            }
        });
    });

    // Selector de remitente
    senderBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            senderBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (messageFromInput) {
                messageFromInput.value = btn.dataset.sender;
            }
        });
    });

    // Selector de color
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (messageColor) {
                messageColor.value = btn.dataset.color;
            }
        });
    });

    // Enviar mensaje
    if (messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const sender = messageFromInput?.value || 'Anónimo';
            const text = messageText?.value?.trim();
            const color = messageColor?.value || '#fff0f5';

            if (!text) return;

            const message = {
                id: 'msg_' + Date.now(),
                sender: sender,
                text: text,
                color: color,
                createdAt: new Date().toISOString()
            };

            // Guardar en Firestore si está disponible
            if (firebaseEnabled && firebaseDb) {
                try {
                    await firebaseDb.collection('messages').doc(message.id).set(message);
                } catch (err) {
                    console.warn('Error guardando en Firestore, usando localStorage:', err);
                    saveMessageToLocalStorage(message);
                }
            } else {
                saveMessageToLocalStorage(message);
            }

            // Limpiar formulario
            messageText.value = '';

            // Cambiar a tab de leer y mostrar mensaje
            mailboxTabs.forEach(t => t.classList.remove('active'));
            mailboxPanels.forEach(p => p.classList.remove('active'));
            document.querySelector('[data-tab="read"]')?.classList.add('active');
            document.getElementById('readPanel')?.classList.add('active');

            loadMessages();
            markAsRead(); // Marcar como leídos al enviar (implícito porque se ve)
        });
    }

    // Guardar mensaje en localStorage
    function saveMessageToLocalStorage(message) {
        try {
            const saved = JSON.parse(localStorage.getItem('secretMessages') || '[]');
            saved.unshift(message);
            localStorage.setItem('secretMessages', JSON.stringify(saved));
        } catch (err) {
            console.error('Error guardando mensaje:', err);
        }
    }

    // Cargar mensajes
    async function loadMessages() {
        messagesData = [];

        // Cargar de Firestore si está disponible
        if (firebaseEnabled && firebaseDb) {
            try {
                const snapshot = await firebaseDb.collection('messages')
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get();

                snapshot.forEach(doc => {
                    messagesData.push(doc.data());
                });
            } catch (err) {
                console.warn('Error cargando de Firestore:', err);
            }
        }

        // Cargar de localStorage
        try {
            const saved = JSON.parse(localStorage.getItem('secretMessages') || '[]');
            // Combinar, evitando duplicados
            saved.forEach(msg => {
                if (!messagesData.find(m => m.id === msg.id)) {
                    messagesData.push(msg);
                }
            });
        } catch (err) {
            console.error('Error cargando mensajes locales:', err);
        }

        // Ordenar por fecha
        messagesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        renderMessages();
    }

    // Renderizar mensajes
    function renderMessages() {
        if (!messagesList) return;

        // Limpiar solo las tarjetas, conservar noMessages
        const cards = messagesList.querySelectorAll('.message-card');
        cards.forEach(card => card.remove());

        if (messagesData.length === 0) {
            if (noMessages) noMessages.style.display = 'block';
            return;
        }

        if (noMessages) noMessages.style.display = 'none';

        messagesData.forEach(msg => {
            const card = document.createElement('div');
            card.className = 'message-card' + (msg.sender === 'Ale' ? ' from-ale' : '');
            card.style.background = msg.color || '#fff0f5';

            const senderEmoji = msg.sender === 'Ale' ? '💙' : '💖';
            const senderClass = msg.sender === 'Ale' ? 'ale' : 'mili';

            card.innerHTML = `
                <div class="message-sender ${senderClass}">
                    ${senderEmoji} ${msg.sender}
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
                <div class="message-date">${formatRelativeDate(msg.createdAt)}</div>
            `;

            messagesList.insertBefore(card, noMessages);
        });

        // Actualizar badge
        updateBadge();
    }

    // Escapar HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Formato de fecha relativa
    function formatRelativeDate(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) return 'Hace un momento';
        if (minutes < 60) return `Hace ${minutes} min`;
        if (hours < 24) return `Hace ${hours}h`;
        if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;

        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
    }

    // Actualizar badge
    function updateBadge() {
        if (!mailboxBadge) return;

        // Obtener última vez que se leyó
        const lastRead = parseInt(localStorage.getItem('mailboxLastRead') || '0');

        // Contar mensajes nuevos (creados después de la última lectura)
        // Filtrar mensajes propios si se quisiera, pero por ahora contamos todos los nuevos
        const unread = messagesData.filter(m => new Date(m.createdAt).getTime() > lastRead).length;

        if (unread > 0) {
            mailboxBadge.textContent = unread > 9 ? '9+' : unread;
            mailboxBadge.style.display = 'flex';
        } else {
            mailboxBadge.style.display = 'none';
        }
    }

    // Marcar mensajes como leídos
    function markAsRead() {
        localStorage.setItem('mailboxLastRead', Date.now().toString());
        updateBadge();
    }

    // Cargar mensajes al inicio y escuchar cambios en tiempo real
    loadMessages();

    if (firebaseEnabled && firebaseDb) {
        try {
            firebaseDb.collection('messages')
                .orderBy('createdAt', 'desc')
                .limit(50)
                .onSnapshot((snapshot) => {
                    loadMessages();
                });
        } catch (err) {
            console.warn('Error configurando listener de mensajes:', err);
        }
    }

    // =====================================================
    // PARTÍCULAS FLOTANTES (CORAZONES Y ESTRELLAS)
    // =====================================================

    const particlesContainer = document.getElementById('particlesContainer');
    const particleTypes = [
        { icon: '❤️', class: 'heart' },
        { icon: '💕', class: 'heart' },
        { icon: '💖', class: 'heart' },
        { icon: '✨', class: 'sparkle' },
        { icon: '⭐', class: 'star' },
        { icon: '💗', class: 'heart' }
    ];

    function createParticle() {
        if (!particlesContainer) return;

        // Limitar número de partículas activas
        if (particlesContainer.children.length > 15) {
            particlesContainer.removeChild(particlesContainer.firstChild);
        }

        const particle = document.createElement('span');
        const type = particleTypes[Math.floor(Math.random() * particleTypes.length)];

        particle.className = `particle ${type.class}`;
        particle.textContent = type.icon;

        // Posición horizontal aleatoria
        const leftPos = Math.random() * 100;
        particle.style.left = `${leftPos}%`;

        // Posición inicial desde abajo
        particle.style.bottom = '-50px';

        // Tamaño aleatorio
        const size = 0.8 + Math.random() * 1.2;
        particle.style.fontSize = `${size}rem`;

        // Duración aleatoria
        const duration = 8 + Math.random() * 12;
        particle.style.animationDuration = `${duration}s`;

        // Tipo de animación aleatoria
        const animType = Math.random() > 0.5 ? 'float-up' : 'float-up-sway';
        particle.style.animationName = animType;

        particlesContainer.appendChild(particle);

        // Eliminar después de la animación
        setTimeout(() => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        }, duration * 1000);
    }

    // Generar partículas periódicamente
    function startParticles() {
        // Crear algunas partículas iniciales
        for (let i = 0; i < 5; i++) {
            setTimeout(() => createParticle(), i * 600);
        }

        // Continuar generando cada cierto tiempo
        setInterval(createParticle, 2000);
    }

    // =====================================================
    // LISTA DE DESEOS (WISHLIST)
    // =====================================================

    const wishlistFab = document.getElementById('wishlistFab');
    const wishlistModal = document.getElementById('wishlistModal');
    const wishlistModalClose = document.getElementById('wishlistModalClose');
    const wishInput = document.getElementById('wishInput');
    const addWishBtn = document.getElementById('addWishBtn');
    const wishlistItems = document.getElementById('wishlistItems');
    const noWishes = document.getElementById('noWishes');
    const completedCount = document.getElementById('completedCount');
    const totalCount = document.getElementById('totalCount');
    const wishlistProgressBar = document.getElementById('wishlistProgressBar');

    let wishesData = [];

    // Abrir modal
    if (wishlistFab) {
        wishlistFab.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFabMenu(); // Cerrar menú FAB
            if (wishlistModal) {
                wishlistModal.classList.add('active');
                loadWishes();
            }
        });
    }

    // Cerrar modal
    if (wishlistModalClose) {
        wishlistModalClose.addEventListener('click', () => {
            if (wishlistModal) wishlistModal.classList.remove('active');
        });
    }

    if (wishlistModal) {
        wishlistModal.addEventListener('click', (e) => {
            if (e.target === wishlistModal) {
                wishlistModal.classList.remove('active');
            }
        });
    }

    // Agregar deseo
    if (addWishBtn) {
        addWishBtn.addEventListener('click', addNewWish);
    }

    if (wishInput) {
        wishInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addNewWish();
        });
    }

    async function addNewWish() {
        const text = wishInput.value.trim();
        if (!text) return;

        const newWish = {
            id: Date.now().toString(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };

        // Guardar en Firestore
        if (firebaseEnabled && firebaseDb) {
            try {
                await firebaseDb.collection('wishlist').add(newWish);
                wishInput.value = '';
            } catch (err) {
                console.error('Error guardando deseo en Firebase:', err);
                // Fallback local
                saveLocalWish(newWish);
                wishInput.value = '';
                loadWishes();
            }
        } else {
            // Guardar local
            saveLocalWish(newWish);
            wishInput.value = '';
            loadWishes();
        }
    }

    function saveLocalWish(wish) {
        const saved = JSON.parse(localStorage.getItem('wishlist') || '[]');
        saved.push(wish);
        localStorage.setItem('wishlist', JSON.stringify(saved));
    }

    async function loadWishes() {
        wishesData = [];

        // Cargar de Firestore
        if (firebaseEnabled && firebaseDb) {
            try {
                const snapshot = await firebaseDb.collection('wishlist').orderBy('createdAt', 'desc').get();
                snapshot.forEach(doc => {
                    wishesData.push({ id: doc.id, ...doc.data() });
                });
            } catch (err) {
                console.warn('Error cargando wishlist de Firebase:', err);
            }
        }

        // Cargar de localStorage (y combinar si es necesario)
        try {
            const localWishes = JSON.parse(localStorage.getItem('wishlist') || '[]');
            // Si no hay conexión o no hay datos en FB, usar local
            if (wishesData.length === 0) {
                wishesData = localWishes;
            } else {
                // Merge simple: si el ID no existe en remote, agregarlo (opcional, por ahora solo priorizamos remoto)
                // Para simplicidad, si hay remoto, usamos remoto.
            }
        } catch (err) {
            console.error('Error loading local wishlist:', err);
        }

        renderWishes();
    }

    function renderWishes() {
        if (!wishlistItems) return;
        wishlistItems.innerHTML = '';

        if (wishesData.length === 0) {
            if (noWishes) {
                noWishes.style.display = 'block';
                wishlistItems.appendChild(noWishes);
            }
            updateProgress();
            return;
        }

        if (noWishes) noWishes.style.display = 'none';

        // Ordenar: primero no completados, luego completados
        wishesData.sort((a, b) => {
            if (a.completed === b.completed) {
                return new Date(b.createdAt) - new Date(a.createdAt);
            }
            return a.completed ? 1 : -1;
        });

        wishesData.forEach(wish => {
            const item = document.createElement('div');
            item.className = 'wish-item' + (wish.completed ? ' completed' : '');
            item.innerHTML = `
                <div class="wish-checkbox" onclick="toggleWish('${wish.id}', ${!wish.completed})">
                    <i class="fas fa-check"></i>
                </div>
                <div class="wish-text">${escapeHtml(wish.text)}</div>
                <button class="wish-delete" onclick="deleteWish('${wish.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            wishlistItems.appendChild(item);
        });

        updateProgress();
    }

    window.toggleWish = async function (id, completed) {
        // Actualizar localmente para UI rápida
        const index = wishesData.findIndex(w => w.id === id);
        if (index !== -1) {
            wishesData[index].completed = completed;
            renderWishes();
        }

        // Actualizar en BD/Storage
        if (firebaseEnabled && firebaseDb) {
            try {
                // Buscar por ID (si el ID es el del doc, directo. Si es generado localmente, query)
                // Asumimos que si viene de FB tiene ID de doc, si es nuevo tiene ID timestamp.
                // Intentamos actualizar doc, si falla es porque el ID es timestamp (creado en local o nueva estructura).
                // Simplificación: si ID tiene longitud > 15 y no es numérico puro, es FB ID probably.
                // Mejor: query por campo id si guardamos el ID dentro del doc también.
                // En addNewWish guardamos id: Date.now(). Pero FB genera su propio ID de documento.
                // CORRECCIÓN: Al cargar de FB, usamos doc.id como el id del objeto.
                // Si el ID es numérico (local), no se puede actualizar en FB directamente sin query.

                await firebaseDb.collection('wishlist').doc(id).update({ completed: completed });
            } catch (err) {
                // Si falla (ej. es un ID local), intentamos buscar por el campo 'id' si lo guardamos
                // Pero para simplificar, asumiremos que si falla es un error o es local.
                console.warn('No se pudo actualizar en FB directo:', err);
            }
        }

        // Actualizar localStorage
        updateLocalStorage();
    };

    window.deleteWish = async function (id) {
        if (!confirm('¿Borrar este deseo?')) return;

        // UI Optimista
        wishesData = wishesData.filter(w => w.id !== id);
        renderWishes();

        if (firebaseEnabled && firebaseDb) {
            try {
                await firebaseDb.collection('wishlist').doc(id).delete();
            } catch (err) {
                console.warn('Error borrando de FB:', err);
            }
        }
        updateLocalStorage();
    };

    function updateLocalStorage() {
        localStorage.setItem('wishlist', JSON.stringify(wishesData));
    }

    function updateProgress() {
        const total = wishesData.length;
        const completed = wishesData.filter(w => w.completed).length;

        if (totalCount) totalCount.textContent = total;
        if (completedCount) completedCount.textContent = completed;

        if (wishlistProgressBar) {
            const percent = total === 0 ? 0 : (completed / total) * 100;
            wishlistProgressBar.style.width = `${percent}%`;
        }
    }

    // Listener de cambios en tiempo real (si hay FB)
    if (firebaseEnabled && firebaseDb) {
        try {
            firebaseDb.collection('wishlist')
                .orderBy('createdAt', 'desc')
                .onSnapshot((snapshot) => {
                    const wishes = [];
                    snapshot.forEach(doc => {
                        wishes.push({ id: doc.id, ...doc.data() });
                    });

                    // Merge inteligente para no perder estado local si no se ha sincronizado?
                    // Por ahora, la fuente de verdad es FB.
                    wishesData = wishes;
                    renderWishes();
                });
        } catch (err) {
            console.warn('Error configurando listener de wishlist:', err);
        }
    }

    // Iniciar partículas después de un pequeño delay
    setTimeout(startParticles, 1000);

    // --- SISTEMA DE EDICIÓN SIMPLIFICADO ---
    // Similar a los likes: guarda TODO en Firebase para sincronizar en todos los dispositivos
    (function initEditSystem() {
        const editModal = document.getElementById('editModal');
        if (!editModal) return;

        const editModalClose = document.getElementById('editModalClose');
        const editForm = document.getElementById('editForm');
        const editTitleInput = document.getElementById('editDescription');
        const editDateInput = document.getElementById('editDate');
        const editItemKeyInput = document.getElementById('editItemKey');

        // Cerrar modal
        if (editModalClose) {
            editModalClose.onclick = () => editModal.style.display = 'none';
        }
        editModal.onclick = (e) => {
            if (e.target === editModal) editModal.style.display = 'none';
        };

        // Abrir modal al hacer clic en botón de editar
        document.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            if (!editBtn) return;

            e.preventDefault();
            e.stopPropagation();

            const item = editBtn.closest('.gallery-item');
            if (!item) return;

            const key = ensureGalleryKey(item);
            const titleEl = item.querySelector('.photo-info h3');

            // Cargar valores actuales
            let currentTitle = titleEl ? titleEl.textContent : '';
            let currentDate = '';

            // Si ya tiene edición guardada, usar esos valores
            if (storedStaticEdits[key]) {
                currentTitle = storedStaticEdits[key].title || currentTitle;
                currentDate = storedStaticEdits[key].date || '';
            }

            editItemKeyInput.value = key;
            editTitleInput.value = currentTitle;
            editDateInput.value = currentDate;
            editModal.style.display = 'flex';
        }, true);

        // Guardar cambios - SIEMPRE en Firebase
        if (editForm) {
            editForm.onsubmit = async (e) => {
                e.preventDefault();

                const key = editItemKeyInput.value;
                const newTitle = editTitleInput.value.trim();
                const newDate = editDateInput.value;

                if (!key) {
                    alert('Error: No se pudo identificar la imagen.');
                    return;
                }

                const saveBtn = editForm.querySelector('.save-edit-btn');
                const originalText = saveBtn.innerHTML;
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

                try {
                    // SIEMPRE guardar en Firebase para que todos vean los cambios
                    if (firebaseDb) {
                        await firebaseDb.collection('imageEdits').doc(key).set({
                            title: newTitle,
                            date: newDate,
                            editedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        // El listener de onSnapshot actualizará storedStaticEdits automáticamente
                    } else {
                        // Fallback local
                        storedStaticEdits[key] = { title: newTitle, date: newDate };
                        localStorage.setItem(STATIC_EDITS_KEY, JSON.stringify(storedStaticEdits));
                    }

                    // Actualizar el DOM inmediatamente
                    const item = findGalleryItemByKey(key);
                    if (item) {
                        const titleEl = item.querySelector('.photo-info h3');
                        if (titleEl) titleEl.textContent = newTitle;
                    }

                    editModal.style.display = 'none';
                    showBanner('Cambios guardados correctamente', { persistent: false });

                } catch (err) {
                    console.error('Error guardando edición:', err);
                    alert('Error al guardar: ' + err.message);
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            };
        }

        // Listener en tiempo real para sincronizar ediciones de Firebase
        if (firebaseDb) {
            firebaseDb.collection('imageEdits').onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const key = change.doc.id;
                    const data = change.doc.data();

                    if (change.type === 'added' || change.type === 'modified') {
                        storedStaticEdits[key] = {
                            title: data.title || '',
                            date: data.date || ''
                        };
                        // Actualizar DOM
                        const item = findGalleryItemByKey(key);
                        if (item) {
                            const titleEl = item.querySelector('.photo-info h3');
                            if (titleEl && data.title) titleEl.textContent = data.title;
                        }
                        // Actualizar línea de tiempo
                        refreshTimeline();
                    } else if (change.type === 'removed') {
                        delete storedStaticEdits[key];
                    }
                });
            });
        }

        // Inyectar botones de editar en todas las fotos
        function addEditButtons() {
            document.querySelectorAll('.gallery-item').forEach(item => {
                let overlay = item.querySelector('.photo-overlay');
                if (!overlay) {
                    const container = item.querySelector('.photo-container');
                    if (!container) return;
                    overlay = document.createElement('div');
                    overlay.className = 'photo-overlay';
                    container.appendChild(overlay);
                }
                if (!overlay.querySelector('.edit-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'edit-btn';
                    btn.title = 'Editar';
                    btn.innerHTML = '<i class="fas fa-pen"></i>';
                    overlay.insertBefore(btn, overlay.firstChild);
                }
            });
        }

        addEditButtons();
    })();

    // Asegurar que la UI se actualice al menos una vez al cargar
    setTimeout(() => {
        applyStoredLikes();
        updateFeaturedPhotos();
        refreshTimeline(); // Asegurar que timeline se actualice
    }, 500);

});

