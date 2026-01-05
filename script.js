class JukeboxSlave {
    constructor() {
        console.log('JukeboxSlave constructor called');
        this.currentScreen = 'location'; // Start with location verification
        this.playlist = [];
        this.albums = [];
        this.songs = [];
        this.currentAlbum = null;
        this.searchMode = 'instant';
        this.searchTimeout = null;
        this.refreshInterval = null;
        this.apiBaseUrl = '/api'; // Will work with both HTTP and HTTPS
        this.songCooldown = 3000; // 3 seconds cooldown between song additions (will be updated from config)
        this.lastSongAddTime = 0;
        this.progressInterval = null; // For tracking song progress
        this.currentPlayingSong = null; // Track current playing song for progress
        
        console.log('JukeboxSlave properties initialized, calling init()');
        this.init();
    }

    init() {
        console.log('JukeboxSlave init() called');
        this.setupEventListeners();
        this.loadVenueInfo();
        this.loadUserConfig();
        console.log('Event listeners setup complete, starting with location verification');
        // Start with location verification
        this.showScreen('location');
        // Automatically start checking location
        this.requestLocation();
        console.log('JukeboxSlave init() complete');
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Helper function to safely add event listeners
        const addListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
                console.log(`✅ Added ${event} listener to ${id}`);
            } else {
                console.error(`❌ Element not found: ${id}`);
            }
        };
        
        // Location screen
        addListener('requestLocationBtn', 'click', () => this.requestLocation());
        addListener('debugLocationBtn', 'click', () => this.debugLocation());
        
        // Main app
        addListener('logoutBtn', 'click', () => this.logout());
        addListener('refreshPlaylist', 'click', () => this.refreshPlaylist());
        
        // View tabs
        addListener('albumsTab', 'click', () => this.showAlbumsView());
        addListener('songsTab', 'click', () => this.showSongsView());
        
        // Album detail navigation
        addListener('backToAlbumsBtn', 'click', () => this.showAlbumsView());
        
        // Fixed back button (always visible)
        addListener('fixedBackBtn', 'click', () => this.handleBackButton());
        
        // Browser back button handling
        window.addEventListener('popstate', (e) => {
            this.handleBrowserBack(e);
        });
        
        // Albums search functionality
        addListener('albumsSearchInput', 'input', (e) => this.handleAlbumsSearchInput(e));
        addListener('clearAlbumsSearchBtn', 'click', () => this.clearAlbumsSearch());
        
        // Songs search functionality
        addListener('songsSearchInput', 'input', (e) => this.handleSongsSearchInput(e));
        addListener('clearSongsSearchBtn', 'click', () => this.clearSongsSearch());
        
        console.log('Event listeners setup complete');
    }

    showScreen(screenName) {
        console.log('showScreen called with:', screenName);
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        
        // Show the requested screen
        const targetScreen = document.getElementById(screenName + 'Screen');
        if (targetScreen) {
            targetScreen.classList.remove('hidden');
            console.log('Showing screen:', screenName + 'Screen');
        } else {
            console.error('Screen not found:', screenName + 'Screen');
        }
        this.currentScreen = screenName;
    }



    // Login functions commented out - no longer needed
    // async handleLogin(e) {
    //     e.preventDefault();
    //     
    //     const username = document.getElementById('username').value;
    //     const password = document.getElementById('password').value;
    //     
    //     if (this.validateCredentials(username, password)) {
    //         this.showScreen('main');
    //         await this.loadData();
    //         this.startAutoRefresh();
    //     } else {
    //         this.showError('Invalid credentials. Please try again.');
    //     }
    // }

    // validateCredentials(username, password) {
    //     // Accept any non-empty credentials for now
    //     return username.trim() !== '' && password.trim() !== '';
    // }

    logout() {
        this.showScreen('location');
        this.stopAutoRefresh();
        this.stopProgressTracking();
        // Reload the page to restart the location check
        window.location.reload();
    }

    // Load venue information from admin config
    loadVenueInfo() {
        // Force set correct venue info
        const correctConfig = {
            venueName: "8-Bit Bar",
            address: "Queensland, Australia"
        };
        
        let config = correctConfig;
        
        // Update venue display
        const venueNameEl = document.getElementById('venueName');
        const venueAddressEl = document.getElementById('venueAddress');
        
        if (venueNameEl) {
            venueNameEl.textContent = config.venueName;
        }
        if (venueAddressEl) {
            venueAddressEl.textContent = config.address;
        }
    }

    // Load user configuration
    async loadUserConfig() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/config/user`);
            if (response.ok) {
                const config = await response.json();
                this.songCooldown = (config.songCooldown || 3) * 1000; // Convert to milliseconds
                console.log(`⏱️ Song cooldown set to: ${this.songCooldown / 1000} seconds`);
            }
        } catch (error) {
            console.error('Error loading user config:', error);
            // Keep default cooldown
        }
    }

    // Location verification methods
    async requestLocation() {
        console.log('Requesting location access...');
        
        // Clear previous messages and show checking spinner
        this.clearLocationMessages();
        this.showLocationChecking();
        
        if (!navigator.geolocation) {
            this.hideLocationChecking();
            this.showLocationError('Geolocation is not supported by this browser.');
            this.showRetryButton();
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };

        navigator.geolocation.getCurrentPosition(
            (position) => this.handleLocationSuccess(position),
            (error) => this.handleLocationError(error),
            options
        );
    }

    handleLocationSuccess(position) {
        console.log('Location obtained:', position.coords);
        
        // Hide checking spinner
        this.hideLocationChecking();
        
        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;
        
        // Check if location is allowed (using admin config)
        const locationCheck = this.isLocationAllowed(userLat, userLon);
        
        console.log('Location check result:', locationCheck);
        
        if (locationCheck.allowed) {
            this.showLocationSuccess(locationCheck);
            // Proceed to main app after a short delay
            setTimeout(() => {
                this.showScreen('main');
                this.loadData();
                this.startAutoRefresh();
            }, 3000);
        } else {
            this.showLocationDenied(locationCheck);
            this.showRetryButton();
        }
    }

    handleLocationError(error) {
        console.error('Location error:', error);
        
        // Hide checking spinner
        this.hideLocationChecking();
        
        let message = '';
        let showRetry = true;
        
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message = '❌ Location access denied. Please allow location access and try again.';
                break;
            case error.POSITION_UNAVAILABLE:
                message = '❌ Location information is unavailable. Please check your GPS settings.';
                break;
            case error.TIMEOUT:
                message = '❌ Location request timed out. Please try again.';
                break;
            default:
                message = '❌ Unable to get your location. Please try again.';
                break;
        }
        
        this.showLocationError(message);
        if (showRetry) {
            this.showRetryButton();
        }
    }

    isLocationAllowed(userLat, userLon) {
        // Force clear any old config and set correct coordinates
        const correctConfig = {
            venueName: "8-Bit Bar",
            address: "Queensland, Australia",
            latitude: -25.2842214,
            longitude: 152.8552310,
            allowedDistance: 50
        };
        
        // Always use the correct config
        localStorage.setItem('jukeboxLocationConfig', JSON.stringify(correctConfig));
        let config = correctConfig;
        
        const distance = this.calculateDistance(config.latitude, config.longitude, userLat, userLon);
        
        return {
            allowed: distance <= config.allowedDistance,
            distance: Math.round(distance),
            maxDistance: config.allowedDistance,
            venueName: config.venueName
        };
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // Distance in meters
    }

    showLocationSuccess(locationCheck) {
        const statusDiv = document.getElementById('locationStatus');
        const distanceInfo = document.getElementById('distanceInfo');
        const statusMessage = document.getElementById('statusMessage');
        
        if (statusDiv && distanceInfo && statusMessage) {
            distanceInfo.textContent = `📍 Welcome to ${locationCheck.venueName}!`;
            statusMessage.textContent = '✅ Location verified! Access granted. Redirecting to jukebox...';
            statusDiv.classList.remove('hidden');
            statusDiv.style.background = 'rgba(40, 167, 69, 0.1)';
            statusDiv.style.borderColor = 'var(--success)';
        }
    }

    showLocationDenied(locationCheck) {
        const statusDiv = document.getElementById('locationStatus');
        const distanceInfo = document.getElementById('distanceInfo');
        const statusMessage = document.getElementById('statusMessage');
        
        if (statusDiv && distanceInfo && statusMessage) {
            distanceInfo.textContent = `📍 You need to be at ${locationCheck.venueName} to use this jukebox.`;
            statusMessage.textContent = `❌ Please visit the bar to access the music.`;
            statusDiv.classList.remove('hidden');
            statusDiv.style.background = 'rgba(220, 53, 69, 0.1)';
            statusDiv.style.borderColor = 'var(--danger)';
        }
    }

    showLocationError(message) {
        const errorDiv = document.getElementById('locationError');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    showLocationChecking() {
        const checkingDiv = document.getElementById('locationChecking');
        if (checkingDiv) {
            checkingDiv.classList.remove('hidden');
        }
    }

    hideLocationChecking() {
        const checkingDiv = document.getElementById('locationChecking');
        if (checkingDiv) {
            checkingDiv.classList.add('hidden');
        }
    }

    showRetryButton() {
        const retryBtn = document.getElementById('requestLocationBtn');
        if (retryBtn) {
            retryBtn.classList.remove('hidden');
        }
    }

    hideRetryButton() {
        const retryBtn = document.getElementById('requestLocationBtn');
        if (retryBtn) {
            retryBtn.classList.add('hidden');
        }
    }

    clearLocationMessages() {
        // Clear error messages
        const errorDiv = document.getElementById('locationError');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
        
        // Clear status messages
        const statusDiv = document.getElementById('locationStatus');
        if (statusDiv) {
            statusDiv.classList.add('hidden');
            statusDiv.style.background = '';
            statusDiv.style.borderColor = '';
        }
        
        // Hide retry button
        this.hideRetryButton();
    }

    debugLocation() {
        console.log('Debug: Starting location debug...');
        
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by this browser.');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLon = position.coords.longitude;
                const accuracy = position.coords.accuracy;
                
                // Force clear any old config and set correct coordinates
                localStorage.removeItem('jukeboxLocationConfig');
                
                // Set the correct configuration
                const correctConfig = {
                    venueName: "8-Bit Bar",
                    address: "Queensland, Australia",
                    latitude: -25.2842214,
                    longitude: 152.8552310,
                    allowedDistance: 50
                };
                
                localStorage.setItem('jukeboxLocationConfig', JSON.stringify(correctConfig));
                
                // Use the correct config
                let config = correctConfig;
                
                const distance = this.calculateDistance(config.latitude, config.longitude, userLat, userLon);
                const isAllowed = distance <= config.allowedDistance;
                
                let debugInfo = `DEBUG LOCATION INFO:\n\n`;
                debugInfo += `Your Location:\n`;
                debugInfo += `  Latitude: ${userLat.toFixed(6)}\n`;
                debugInfo += `  Longitude: ${userLon.toFixed(6)}\n`;
                debugInfo += `  Accuracy: ${Math.round(accuracy)}m\n\n`;
                debugInfo += `Venue Location:\n`;
                debugInfo += `  Name: ${config.venueName}\n`;
                debugInfo += `  Latitude: ${config.latitude}\n`;
                debugInfo += `  Longitude: ${config.longitude}\n`;
                debugInfo += `  Allowed Distance: ${config.allowedDistance}m\n\n`;
                debugInfo += `Distance Calculation:\n`;
                debugInfo += `  Distance: ${Math.round(distance)}m\n`;
                debugInfo += `  Status: ${isAllowed ? '✅ ALLOWED' : '❌ DENIED'}\n\n`;
                debugInfo += `Google Maps Link:\n`;
                debugInfo += `https://www.google.com/maps?q=${userLat},${userLon}`;
                
                alert(debugInfo);
                console.log('Debug info:', debugInfo);
            },
            (error) => {
                let errorMsg = `Location Error: ${error.message}\nCode: ${error.code}`;
                alert(errorMsg);
                console.error('Debug location error:', error);
            },
            options
        );
    }

    // Clean song title by removing track numbers and file extensions
    cleanSongTitle(title) {
        if (!title) return title;
        
        // Remove track numbers (e.g., "02 - ", "01. ", "1) ", etc.)
        let cleaned = title.replace(/^\d{1,2}[\s\-\.\)]+/, '');
        
        // Remove file extensions (e.g., ".mp3", ".wav", ".flac", etc.)
        cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|aac|ogg|wma|m4p)$/i, '');
        
        // Remove any remaining file extensions that might be in the middle
        cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|aac|ogg|wma|m4p)/gi, '');
        
        // Trim whitespace
        cleaned = cleaned.trim();
        
        return cleaned;
    }

    // Get album cover URL
    getAlbumCoverUrl(albumTitle) {
        if (!albumTitle) return '';
        const encodedTitle = encodeURIComponent(albumTitle);
        return `${this.apiBaseUrl}/covers/${encodedTitle}`;
    }

    // Helper method to clean up song display text (show only song title)
    getCleanSongDisplay(song) {
        return song.title || 'Unknown Song';
    }

    // Local storage methods for persistence
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (error) {
            console.error('Error saving to localStorage:', error);
        }
    }

    loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            return null;
        }
    }

    async loadData() {
        try {
            this.showLoading(true);
            await Promise.all([
                this.loadAlbums(),
                this.loadSongs(),
                this.loadPlaylist()
            ]);
            
            // Render the new UI components
            this.updateNowPlaying();
            this.renderAlbums();
            this.renderSongs();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async loadAlbums() {
        console.log('Loading albums from API...');
        try {
            const response = await fetch(`${this.apiBaseUrl}/albums`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.albums = await response.json();
            console.log(`📀 Loaded ${this.albums.length} albums from API`);
        } catch (error) {
            console.error('Error loading albums from API:', error);
            // Fallback to mock data
            this.albums = this.getMockAlbums();
            console.log(`📀 Using ${this.albums.length} mock albums as fallback`);
        }
        
        this.renderAlbums();
    }

    async loadSongs() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/songs`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.songs = await response.json();
            
            // Clean up song titles - remove track numbers and file extensions
            this.songs = this.songs.map(song => ({
                ...song,
                title: this.cleanSongTitle(song.title)
            }));
            
            console.log(`🎵 Loaded ${this.songs.length} songs from API`);
        } catch (error) {
            console.error('Error loading songs from API:', error);
            // Fallback to mock data
            this.songs = this.getMockSongs();
            console.log(`🎵 Using ${this.songs.length} mock songs as fallback`);
        }
    }

    async loadPlaylist() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/tracklist`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const newPlaylist = await response.json();
            
            // Calculate progress for playing songs if not already present
            newPlaylist.forEach(song => {
                if (song.status === 'playing' && song.playedAt && song.length && !song.progress) {
                    song.progress = this.calculateLocalProgress(song);
                }
            });
            
            // Only update if playlist has changed to avoid unnecessary re-renders
            if (JSON.stringify(newPlaylist) !== JSON.stringify(this.playlist)) {
                this.playlist = newPlaylist;
                this.renderPlaylist();
                this.updateNowPlaying();
                this.startProgressTracking(); // Start/restart progress tracking
                console.log(`📋 Playlist updated: ${this.playlist.length} songs`);
            }
        } catch (error) {
            console.error('Error loading playlist from API:', error);
            // Don't clear playlist on error, keep existing data
        }
    }

    async refreshPlaylist() {
        const refreshBtn = document.getElementById('refreshPlaylist');
        const icon = refreshBtn.querySelector('i');
        
        // Show spinning animation
        icon.style.animation = 'spin 1s linear infinite';
        refreshBtn.disabled = true;
        
        try {
            await this.loadPlaylist();
            this.showSuccess('Playlist refreshed!');
        } catch (error) {
            this.showError('Failed to refresh playlist');
        } finally {
            // Stop spinning animation
            icon.style.animation = '';
            refreshBtn.disabled = false;
        }
    }

    renderAlbums() {
        console.log('Rendering albums:', this.albums.length, 'albums');
        const albumsGrid = document.getElementById('albumsGrid');
        if (!albumsGrid) {
            console.error('Albums grid element not found!');
            return;
        }
        albumsGrid.innerHTML = '';

        this.albums.forEach(album => {
            console.log('Rendering album:', album.title);
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.innerHTML = `
                <div class="album-cover">
                    <img src="${this.getAlbumCoverUrl(album.title)}" 
                         alt="${album.title}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <i class="fas fa-music" style="display: none;"></i>
                </div>
                <div class="album-title">${album.title}</div>
            `;
            albumCard.addEventListener('click', () => this.showAlbumDetail(album));
            albumsGrid.appendChild(albumCard);
        });
        console.log('Albums rendered successfully');
    }

    renderSongs() {
        console.log('Rendering songs:', this.songs.length, 'songs');
        const songsList = document.getElementById('songsList');
        if (!songsList) {
            console.error('Songs list element not found!');
            return;
        }
        songsList.innerHTML = '';

        this.songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-text">${this.getCleanSongDisplay(song)}</div>
            `;
            songItem.addEventListener('click', () => this.addSongToQueue(song));
            songsList.appendChild(songItem);
        });
        console.log('Songs rendered successfully');
    }

    // View management methods
    showAlbumsView() {
        // Update tab states
        document.getElementById('albumsTab').classList.add('active');
        document.getElementById('songsTab').classList.remove('active');
        
        // Show albums view, hide others
        document.getElementById('albumsView').classList.add('active');
        document.getElementById('songsView').classList.remove('active');
        document.getElementById('albumDetailView').classList.remove('active');
        
        // Hide fixed back button when on albums view
        const fixedBackBtn = document.getElementById('fixedBackBtn');
        if (fixedBackBtn) {
            fixedBackBtn.classList.add('hidden');
        }

        // Remove album-detail-open class to restore sticky headers
        document.body.classList.remove('album-detail-open');
        
        // Push history state for albums view
        if (window.history && window.history.pushState) {
            window.history.pushState({ view: 'albums' }, '', window.location.pathname);
        }
        
        console.log('Switched to albums view');
    }

    showSongsView() {
        // Update tab states
        document.getElementById('songsTab').classList.add('active');
        document.getElementById('albumsTab').classList.remove('active');
        
        // Show songs view, hide others
        document.getElementById('songsView').classList.add('active');
        document.getElementById('albumsView').classList.remove('active');
        document.getElementById('albumDetailView').classList.remove('active');
        
        // Hide fixed back button when on songs view
        const fixedBackBtn = document.getElementById('fixedBackBtn');
        if (fixedBackBtn) {
            fixedBackBtn.classList.add('hidden');
        }

        // Remove album-detail-open class to restore sticky headers
        document.body.classList.remove('album-detail-open');
        
        // Push history state for songs view
        if (window.history && window.history.pushState) {
            window.history.pushState({ view: 'songs' }, '', window.location.pathname);
        }
        
        console.log('Switched to songs view');
    }

    showAlbumDetailView(album) {
        // Hide all other views
        document.getElementById('albumsView').classList.remove('active');
        document.getElementById('songsView').classList.remove('active');
        document.getElementById('albumDetailView').classList.add('active');
        
        // Update album detail content
        document.getElementById('albumDetailTitle').textContent = album.title;
        document.getElementById('albumName').textContent = album.title;
        document.getElementById('albumArtist').textContent = album.artist || 'Unknown Artist';
        
        // Update album cover in detail view
        const albumCoverEl = document.querySelector('#albumDetailView .album-cover');
        if (albumCoverEl) {
            albumCoverEl.innerHTML = `
                <img src="${this.getAlbumCoverUrl(album.title)}" 
                     alt="${album.title}" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="fas fa-music" style="display: none;"></i>
            `;
        }
        
        // Get songs for this album
        const albumSongs = this.songs.filter(song => song.album === album.title);
        this.renderAlbumSongs(albumSongs);
        
        // Show fixed back button when viewing album detail
        const fixedBackBtn = document.getElementById('fixedBackBtn');
        if (fixedBackBtn) {
            fixedBackBtn.classList.remove('hidden');
        }

        // Add class to disable sticky playlist and avoid overlay
        document.body.classList.add('album-detail-open');
        
        // Push history state for album detail
        if (window.history && window.history.pushState) {
            window.history.pushState({ view: 'albumDetail', albumId: album.title }, '', window.location.pathname);
        }
        
        console.log('Showing album detail for:', album.title);
    }
    
    handleBackButton() {
        // Navigate back to albums view
        this.showAlbumsView();
    }
    
    handleBrowserBack(event) {
        // Check if we're on album detail view
        const albumDetailView = document.getElementById('albumDetailView');
        if (albumDetailView && albumDetailView.classList.contains('active')) {
            // Prevent default browser back behavior
            event.preventDefault();
            // Go back to albums view
            this.showAlbumsView();
        }
    }

    renderAlbumSongs(songs) {
        const songsList = document.getElementById('albumSongsList');
        songsList.innerHTML = '';

        songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-text">${this.getCleanSongDisplay(song)}</div>
            `;
            songItem.addEventListener('click', () => this.addSongToQueue(song));
            songsList.appendChild(songItem);
        });
    }

    // Songs search functionality
    handleSongsSearchInput(e) {
        const query = e.target.value.trim();
        const clearBtn = document.getElementById('clearSongsSearchBtn');
        
        if (query.length > 0) {
            clearBtn.classList.remove('hidden');
            this.filterSongs(query);
        } else {
            clearBtn.classList.add('hidden');
            this.renderSongs(); // Show all songs
        }
    }

    filterSongs(query) {
        const filteredSongs = this.songs.filter(song => 
            song.title.toLowerCase().includes(query.toLowerCase()) ||
            (song.artist && song.artist.toLowerCase().includes(query.toLowerCase())) ||
            (song.album && song.album.toLowerCase().includes(query.toLowerCase()))
        );
        
        this.renderFilteredSongs(filteredSongs);
    }

    renderFilteredSongs(songs) {
        const songsList = document.getElementById('songsList');
        songsList.innerHTML = '';

        songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-text">${song.title || 'Unknown Song'} - ${song.artist || 'Unknown Artist'}</div>
            `;
            songItem.addEventListener('click', () => this.addSongToQueue(song));
            songsList.appendChild(songItem);
        });
    }

    clearSongsSearch() {
        const searchInput = document.getElementById('songsSearchInput');
        const clearBtn = document.getElementById('clearSongsSearchBtn');
        
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        this.renderSongs(); // Show all songs
    }

    // Albums search functionality
    handleAlbumsSearchInput(e) {
        const query = e.target.value.trim();
        const clearBtn = document.getElementById('clearAlbumsSearchBtn');
        
        if (query.length > 0) {
            clearBtn.classList.remove('hidden');
            this.filterAlbumsAndSongs(query);
        } else {
            clearBtn.classList.add('hidden');
            this.renderAlbums(); // Show all albums
        }
    }

    filterAlbumsAndSongs(query) {
        const searchTerm = query.toLowerCase();
        
        // Filter albums
        const filteredAlbums = this.albums.filter(album => 
            album.title.toLowerCase().includes(searchTerm)
        );
        
        // Filter songs
        const filteredSongs = this.songs.filter(song => 
            song.title.toLowerCase().includes(searchTerm) ||
            (song.artist && song.artist.toLowerCase().includes(searchTerm)) ||
            (song.album && song.album.toLowerCase().includes(searchTerm))
        );
        
        this.renderAlbumsSearchResults(filteredAlbums, filteredSongs);
    }

    renderAlbumsSearchResults(albums, songs) {
        const albumsGrid = document.getElementById('albumsGrid');
        albumsGrid.innerHTML = '';

        // Show albums first
        albums.forEach(album => {
            const albumCard = document.createElement('div');
            albumCard.className = 'album-card';
            albumCard.innerHTML = `
                <div class="album-cover">
                    <img src="${this.getAlbumCoverUrl(album.title)}" 
                         alt="${album.title}" 
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <i class="fas fa-music" style="display: none;"></i>
                </div>
                <div class="album-title">${album.title}</div>
                <div class="search-result-type album">Album</div>
            `;
            albumCard.addEventListener('click', () => this.showAlbumDetail(album));
            albumsGrid.appendChild(albumCard);
        });

        // Show songs as individual items
        songs.forEach(song => {
            const songCard = document.createElement('div');
            songCard.className = 'album-card song-card';
            const cleanDisplay = this.getCleanSongDisplay(song);
            songCard.innerHTML = `
                <div class="album-cover">
                    <i class="fas fa-play"></i>
                </div>
                <div class="album-title">${cleanDisplay}</div>
                <div class="search-result-type song">Song</div>
            `;
            songCard.addEventListener('click', () => this.addSongToQueue(song));
            albumsGrid.appendChild(songCard);
        });

        // If no results, show message
        if (albums.length === 0 && songs.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = 'No albums or songs found matching your search.';
            noResults.style.gridColumn = '1 / -1';
            noResults.style.textAlign = 'center';
            noResults.style.padding = '40px';
            noResults.style.color = 'var(--gray)';
            albumsGrid.appendChild(noResults);
        }
    }

    clearAlbumsSearch() {
        const searchInput = document.getElementById('albumsSearchInput');
        const clearBtn = document.getElementById('clearAlbumsSearchBtn');
        
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        this.renderAlbums(); // Show all albums
    }

    renderPlaylist() {
        const container = document.getElementById('playlistContainer');
        container.innerHTML = '';

        if (this.playlist.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'playlist-item';
            emptyMessage.textContent = 'No songs in playlist';
            container.appendChild(emptyMessage);
            return;
        }

        // Remove duplicates and filter active songs, only show songs added by master
        const uniqueSongs = this.playlist.filter((song, index, self) => 
            index === self.findIndex(s => 
                (s.songId === song.songId || s._id === song._id) && 
                (s.status === 'queued' || s.status === 'playing') &&
                s.masterId === 'master'
            )
        );

        // Show songs with numbering, only 3 visible at a time with horizontal scrolling
        uniqueSongs.forEach((song, index) => {
            const playlistItem = document.createElement('div');
            playlistItem.className = 'playlist-item';
            
            // Set the song number (1-based index)
            const songNumber = index + 1;
            playlistItem.setAttribute('data-number', `${songNumber}.`);
            
            // Show only song titles with word wrapping
            const displayText = this.getCleanSongDisplay(song);
            
            playlistItem.textContent = displayText;
            
            container.appendChild(playlistItem);
        });
    }

    // Helper function to format seconds as MM:SS
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Calculate current progress for a playing song
    calculateLocalProgress(song) {
        if (!song || song.status !== 'playing' || !song.playedAt || !song.length) {
            return 0;
        }
        
        const now = new Date();
        const playedAt = song.playedAt instanceof Date ? song.playedAt : new Date(song.playedAt);
        const elapsedSeconds = Math.floor((now - playedAt) / 1000);
        const totalSeconds = song.length || song.duration || 0;
        
        return Math.max(0, Math.min(elapsedSeconds, totalSeconds));
    }

    updateNowPlaying() {
        const currentSongDisplay = document.getElementById('currentSongDisplay');
        const playingSong = this.playlist.find(song => song.status === 'playing' && song.masterId === 'master');
        
        if (playingSong) {
            this.currentPlayingSong = playingSong;
            const progress = this.calculateLocalProgress(playingSong);
            const totalTime = playingSong.length || playingSong.duration || 0;
            const progressText = totalTime > 0 ? ` ${this.formatTime(progress)}/${this.formatTime(totalTime)}` : '';
            currentSongDisplay.textContent = this.getCleanSongDisplay(playingSong) + progressText;
        } else {
            this.currentPlayingSong = null;
            currentSongDisplay.textContent = 'Song';
        }
    }

    // Start tracking progress for current playing song
    startProgressTracking() {
        // Clear existing interval
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
        }
        
        // Update progress every second
        this.progressInterval = setInterval(() => {
            if (this.currentPlayingSong && this.currentScreen === 'main') {
                const progress = this.calculateLocalProgress(this.currentPlayingSong);
                const totalTime = this.currentPlayingSong.length || this.currentPlayingSong.duration || 0;
                
                // Update display
                const currentSongDisplay = document.getElementById('currentSongDisplay');
                if (currentSongDisplay && this.currentPlayingSong) {
                    const progressText = totalTime > 0 ? ` ${this.formatTime(progress)}/${this.formatTime(totalTime)}` : '';
                    currentSongDisplay.textContent = this.getCleanSongDisplay(this.currentPlayingSong) + progressText;
                }
                
                // Check if song finished (progress >= total time)
                if (totalTime > 0 && progress >= totalTime) {
                    // Song finished - will be removed by server, just clear interval
                    if (this.progressInterval) {
                        clearInterval(this.progressInterval);
                        this.progressInterval = null;
                    }
                }
            }
        }, 1000);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }



    async showAlbumDetail(album) {
        this.currentAlbum = album;
        
        // Ensure songs are loaded
        if (this.songs.length === 0) {
            await this.loadSongs();
        }
        
        // Show album detail view
        this.showAlbumDetailView(album);
    }



    async addSongToQueue(song) {
        // Check cooldown
        const currentTime = Date.now();
        if (currentTime - this.lastSongAddTime < this.songCooldown) {
            const remainingTime = Math.ceil((this.songCooldown - (currentTime - this.lastSongAddTime)) / 1000);
            this.showError(`Please wait ${remainingTime} seconds before adding another song.`);
            return;
        }

        // Check if song is already in the queue
        const songId = song._id || song.id;
        const isAlreadyQueued = this.playlist.some(playlistSong => 
            (playlistSong.songId === songId || playlistSong.songId === song._id || playlistSong.songId === song.id) &&
            (playlistSong.status === 'queued' || playlistSong.status === 'playing')
        );
        
        if (isAlreadyQueued) {
            this.showError('This song is already in the queue!');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/tracklist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    songId: song._id || song.id,
                    title: this.cleanSongTitle(song.title),
                    artist: song.artist || 'Unknown Artist',
                    album: song.album || 'Unknown Album',
                    duration: song.duration || null, // Let master determine duration
                    priority: 2, // Default to normal priority
                    requestedBy: 'user',
                    masterId: 'webapp',
                    slaveId: 'webapp',
                    existsAtMaster: false,  // Initially false - master needs to confirm
                    length: null  // Let master determine actual length
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Song added to tracklist (pending master confirmation):', result);
            
            // Update cooldown timer
            this.lastSongAddTime = currentTime;
            
            // Don't refresh playlist immediately - wait for master to add it
            // The auto-refresh will pick it up when the master processes it
            
            if (result.existing) {
                this.showSuccess('Song is already in the queue!');
            } else {
                this.showSuccess('Song submitted to master! Waiting for confirmation...');
            }
        } catch (error) {
            console.error('Error adding song to queue:', error);
            this.showError('Failed to add song to queue. Please try again.');
        }
    }


    scrollToLastPlaylistItem() {
        // Scroll to the last page to show the newly added song
        const totalPages = Math.ceil(this.playlist.length / this.playlistPageSize) || 1;
        if (totalPages > 1) {
            this.playlistPage = totalPages - 1;
            this.renderPlaylist();
        }
    }

    startAutoRefresh() {
        // Refresh playlist every 10 seconds to get latest data
        this.refreshInterval = setInterval(() => {
            if (this.currentScreen === 'main') {
                this.loadPlaylist();
            }
        }, 10000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.stopProgressTracking();
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (show) {
            spinner.classList.remove('hidden');
        } else {
            spinner.classList.add('hidden');
        }
    }

    showError(message) {
        // Find the appropriate error container based on current screen
        let errorContainer;
        if (this.currentScreen === 'location') {
            errorContainer = document.getElementById('locationError');
        } else {
            // Create a temporary error display for main screen
            this.showTemporaryMessage(message, 'error');
            return;
        }
        
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.style.display = 'block';
            setTimeout(() => {
                errorContainer.style.display = 'none';
            }, 5000);
        }
    }

    showSuccess(message) {
        this.showTemporaryMessage(message, 'success');
    }

    showTemporaryMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `temporary-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            background: ${type === 'error' ? '#dc3545' : '#28a745'};
            color: white;
            border-radius: 8px;
            z-index: 1000;
            font-weight: bold;
        `;
        
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // Mock data for fallback
    getMockAlbums() {
        return [
            { title: 'AC-DC Best Of CD1' },
            { title: 'AC-DC Best Of CD2' },
            { title: 'Billy Idol - Best Of' },
            { title: 'Billy Joel - Very Best Of' },
            { title: 'Blondie - Best Of Blondie' },
            { title: 'Blur - Greatest Hits' },
            { title: 'Bon Jovi - Cross Road' },
            { title: 'Bruce Springsteen - Best of' },
            { title: 'Bryan Adams - The Best Of Me' },
            { title: 'Creedence Clearwater Revival - Best Of' }
        ];
    }

    getMockSongs() {
        return [
            { title: 'Thunderstruck', artist: 'AC/DC', album: 'AC-DC Best Of CD1' },
            { title: 'Live Wire', artist: 'AC/DC', album: 'AC-DC Best Of CD1' },
            { title: 'Dancing With Myself', artist: 'Billy Idol', album: 'Billy Idol - Best Of' },
            { title: 'White Wedding', artist: 'Billy Idol', album: 'Billy Idol - Best Of' },
            { title: 'Piano Man', artist: 'Billy Joel', album: 'Billy Joel - Very Best Of' },
            { title: 'Uptown Girl', artist: 'Billy Joel', album: 'Billy Joel - Very Best Of' },
            { title: 'Heart Of Glass', artist: 'Blondie', album: 'Blondie - Best Of Blondie' },
            { title: 'Call Me', artist: 'Blondie', album: 'Blondie - Best Of Blondie' },
            { title: 'Song 2', artist: 'Blur', album: 'Blur - Greatest Hits' },
            { title: 'Parklife', artist: 'Blur', album: 'Blur - Greatest Hits' }
        ];
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing JukeboxSlave...');
    try {
        new JukeboxSlave();
        console.log('JukeboxSlave initialized successfully');
    } catch (error) {
        console.error('Error initializing JukeboxSlave:', error);
    }
});