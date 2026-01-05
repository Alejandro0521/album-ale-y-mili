document.addEventListener('DOMContentLoaded', () => {
    const ACCESS_CODE = 'BOB';
    const SESSION_KEY = 'albumHiddenAccess';
    const LOCAL_STORAGE_KEY = 'albumHiddenUploads';

    function ensureAccess() {
        const alreadyGranted = sessionStorage.getItem(SESSION_KEY) === 'true';
        if (alreadyGranted) {
            return true;
        }
        const input = prompt('Introduce la clave para acceder a la galeria oculta:');
        if (input && input.trim().toUpperCase() === ACCESS_CODE) {
            sessionStorage.setItem(SESSION_KEY, 'true');
            return true;
        }
        alert('Clave incorrecta. Volviendo al album principal.');
        window.location.href = 'index.html';
        return false;
    }

    if (!ensureAccess()) {
        return;
    }

    const closeButton = document.getElementById('closeHiddenGallery');
    const galleryContainer = document.getElementById('hiddenGallery');
    const emptyState = document.getElementById('noHiddenItems');
    const uploadForm = document.getElementById('hiddenUploadForm');
    const uploadStatus = document.getElementById('hiddenUploadStatus');
    const uploadButton = document.getElementById('hiddenUploadButton');

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    let firebaseApp = null;
    let firebaseDb = null;
    let firebaseStorage = null;
    let firebaseEnabled = false;
    let firebaseItems = [];
    let localItems = [];
    let localLoaded = false;
    let unsubscribe = null;

    function saveLocalItems() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localItems));
        } catch (err) {
            console.warn('No se pudieron guardar los elementos ocultos en localStorage.', err);
        }
    }

    function loadLocalItems() {
        if (localLoaded) return;
        localLoaded = true;
        try {
            const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                localItems = parsed.map(item => ({
                    id: item.id || `lok-${Date.now()}`,
                    title: item.title || '',
                    location: item.location || '',
                    category: item.category || 'extra',
                    mediaType: item.mediaType || 'image',
                    mediaMime: item.mediaMime || '',
                    mediaUrl: item.mediaUrl || '',
                    createdAt: item.createdAt || Date.now()
                }));
            }
        } catch (err) {
            console.warn('No se pudieron leer los elementos ocultos guardados.', err);
            localItems = [];
        }
    }

    function buildFileName(base, mime) {
        if (!mime) return `${base}.bin`;
        if (mime.includes('png')) return `${base}.png`;
        if (mime.includes('gif')) return `${base}.gif`;
        if (mime.includes('webp')) return `${base}.webp`;
        if (mime.includes('jpeg') || mime.includes('jpg')) return `${base}.jpg`;
        if (mime.includes('mp4')) return `${base}.mp4`;
        if (mime.includes('mov')) return `${base}.mov`;
        if (mime.includes('avi')) return `${base}.avi`;
        if (mime.includes('mkv')) return `${base}.mkv`;
        return `${base}`;
    }

    function downloadMedia(sourceUrl, baseName, mime) {
        if (!sourceUrl) return;
        const link = document.createElement('a');
        link.href = sourceUrl;
        link.download = buildFileName(baseName, mime);
        link.click();
    }

    function renderGallery() {
        if (!galleryContainer) return;
        galleryContainer.innerHTML = '';

        const combined = [...firebaseItems, ...localItems].sort((a, b) => {
            const tsA = typeof a.createdAt === 'number' ? a.createdAt : 0;
            const tsB = typeof b.createdAt === 'number' ? b.createdAt : 0;
            return tsB - tsA;
        });

        if (combined.length === 0) {
            if (emptyState) emptyState.hidden = false;
            return;
        }

        if (emptyState) emptyState.hidden = true;

        combined.forEach(item => {
            const card = document.createElement('div');
            card.className = 'gallery-item';
            card.dataset.category = (item.category || 'extra').toLowerCase();
            card.dataset.dynamic = 'true';

            const photoContainer = document.createElement('div');
            photoContainer.className = 'photo-container';

            if (item.mediaType === 'video') {
                const video = document.createElement('video');
                video.controls = true;
                const source = document.createElement('source');
                source.src = item.mediaUrl;
                source.type = item.mediaMime || 'video/mp4';
                video.appendChild(source);
                photoContainer.appendChild(video);
            } else {
                const image = document.createElement('img');
                image.src = item.mediaUrl;
                image.alt = item.title || 'Foto oculta';
                image.loading = 'lazy';
                photoContainer.appendChild(image);
            }

            const overlay = document.createElement('div');
            overlay.className = 'photo-overlay';
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
            downloadBtn.addEventListener('click', () => {
                const nameBase = item.mediaType === 'video' ? 'video_oculto' : 'foto_oculta';
                downloadMedia(item.mediaUrl, `${nameBase}_${Date.now()}`, item.mediaMime);
            });
            overlay.appendChild(downloadBtn);
            photoContainer.appendChild(overlay);

            const info = document.createElement('div');
            info.className = 'photo-info';
            const titleEl = document.createElement('h3');
            titleEl.textContent = item.title || 'Sin titulo';
            const locationEl = document.createElement('p');
            locationEl.className = 'photo-location';
            const icon = document.createElement('i');
            icon.className = 'fas fa-map-marker-alt';
            locationEl.appendChild(icon);
            locationEl.appendChild(document.createTextNode(' ' + (item.location || 'Ubicacion secreta')));

            info.appendChild(titleEl);
            info.appendChild(locationEl);

            card.appendChild(photoContainer);
            card.appendChild(info);

            galleryContainer.appendChild(card);
        });
    }

    function addLocalItem(file, metadata) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const newItem = {
                    id: `lok-${Date.now()}`,
                    title: metadata.title,
                    location: metadata.location,
                    category: metadata.category,
                    mediaType: metadata.mediaType,
                    mediaMime: metadata.mediaMime,
                    mediaUrl: reader.result,
                    createdAt: Date.now()
                };
                localItems.unshift(newItem);
                saveLocalItems();
                renderGallery();
                resolve(newItem);
            };
            reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
            reader.readAsDataURL(file);
        });
    }

    async function handleUpload(event) {
        event.preventDefault();

        const fileInput = uploadForm.querySelector('#hiddenMediaFile');
        const titleInput = uploadForm.querySelector('#hiddenMediaTitle');
        const locationInput = uploadForm.querySelector('#hiddenMediaLocation');
        const categorySelect = uploadForm.querySelector('#hiddenMediaCategory');

        const file = fileInput && fileInput.files ? fileInput.files[0] : null;
        if (!file) {
            if (uploadStatus) uploadStatus.textContent = 'Selecciona un archivo antes de subir.';
            return;
        }

        const title = titleInput ? titleInput.value.trim() : '';
        const location = locationInput ? locationInput.value.trim() : '';
        const category = categorySelect ? categorySelect.value.trim() : 'extra';
        const mediaType = file.type && file.type.startsWith('video') ? 'video' : 'image';
        const mediaMime = file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        const firebaseReady = firebaseEnabled && firebaseDb && firebaseStorage;

        try {
            if (uploadButton) {
                uploadButton.disabled = true;
                uploadButton.textContent = firebaseReady ? 'Subiendo...' : 'Guardando...';
            }
            if (uploadStatus) {
                uploadStatus.textContent = firebaseReady
                    ? 'Subiendo archivo oculto, espera un momento...'
                    : 'Guardando archivo oculto en este navegador...';
            }

            if (firebaseReady) {
                const storageRef = firebaseStorage.ref().child(`hidden/${Date.now()}_${file.name}`);
                await storageRef.put(file);
                const downloadURL = await storageRef.getDownloadURL();

                await firebaseDb.collection('hiddenGalleryItems').add({
                    title,
                    location,
                    category,
                    mediaType,
                    mediaMime,
                    mediaUrl: downloadURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                uploadForm.reset();
                if (uploadStatus) uploadStatus.textContent = 'Archivo agregado a la galeria oculta.';
            } else {
                await addLocalItem(file, { title, location, category, mediaType, mediaMime });
                uploadForm.reset();
                if (uploadStatus) uploadStatus.textContent = 'Archivo oculto guardado localmente.';
            }
        } catch (error) {
            console.error('Error al guardar archivo oculto', error);
            if (uploadStatus) {
                uploadStatus.textContent = firebaseReady
                    ? 'No se pudo subir el archivo oculto. Revisa la consola.'
                    : 'No se pudo guardar el archivo oculto. Intenta nuevamente.';
            }
        } finally {
            if (uploadButton) {
                uploadButton.disabled = false;
                uploadButton.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir a la galeria oculta';
            }
        }
    }

    function startRealtimeSync() {
        if (!firebaseDb) return;
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }

        unsubscribe = firebaseDb
            .collection('hiddenGalleryItems')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const items = [];
                snapshot.forEach(doc => {
                    const data = doc.data() || {};
                    items.push({
                        id: doc.id,
                        title: data.title || '',
                        location: data.location || '',
                        category: data.category || 'extra',
                        mediaType: data.mediaType || 'image',
                        mediaMime: data.mediaMime || '',
                        mediaUrl: data.mediaUrl || '',
                        createdAt: data.createdAt && data.createdAt.toMillis ? data.createdAt.toMillis() : Date.now()
                    });
                });
                firebaseItems = items;
                renderGallery();
            }, error => {
                console.error('Error sincronizando la galeria oculta', error);
            });
    }

    function configureDataSources() {
        loadLocalItems();
        renderGallery();

        const firebaseAvailable = typeof firebase !== 'undefined' && window.firebaseConfig;
        if (!firebaseAvailable) {
            firebaseEnabled = false;
            if (uploadStatus) {
                uploadStatus.textContent = 'Sin Firebase: los archivos ocultos solo viven en este navegador.';
            }
            return;
        }

        try {
            firebaseApp = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
            firebaseStorage = firebase.storage();
            firebaseDb = firebase.firestore();
            firebaseEnabled = true;
            if (uploadStatus) uploadStatus.textContent = '';
            startRealtimeSync();
        } catch (error) {
            console.error('No se pudo inicializar Firebase para la galeria oculta', error);
            firebaseEnabled = false;
            if (uploadStatus) {
                uploadStatus.textContent = 'No se pudo conectar con Firebase. Se usara almacenamiento local.';
            }
        }
    }

    configureDataSources();

    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
});
