class JukeboxSlave {
    constructor() {
        console.log('JukeboxSlave constructor called');
        this.currentScreen = 'location';
        this.playlist = [];
        this.playlistPage = 0;
        this.playlistPageSize = 5;
        this.albums = [];
        this.songs = [];
        this.currentAlbum = null;
        this.searchMode = 'instant';
        this.searchTimeout = null;
        this.refreshInterval = null;
        this.apiBaseUrl = '/api';
        
        console.log('JukeboxSlave properties initialized, calling init()');
        this.init();
    }

    init() {
        console.log('JukeboxSlave init() called');
        this.setupEventListeners();
        console.log('Event listeners setup complete, showing location screen');
        this.showScreen('location');
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
        
        // Login screen - commented out (no longer needed)
        // addListener('loginForm', 'submit', (e) => this.handleLogin(e));
        
        // Main app
        addListener('logoutBtn', 'click', () => this.logout());
        
        // Playlist navigation
        addListener('prevPlaylist', 'click', () => this.prevPlaylistPage());
        addListener('nextPlaylist', 'click', () => this.nextPlaylistPage());
        addListener('refreshPlaylist', 'click', () => this.refreshPlaylist());
        
        // Home buttons
        addListener('viewAlbumsBtn', 'click', () => this.showAlbums());
        addListener('searchBtn', 'click', () => this.showSearch());
        
        
        // Search functionality
        addListener('searchInput', 'input', (e) => this.handleSearchInput(e));
        addListener('searchSubmitBtn', 'click', () => this.performSearch());
        addListener('closeSearchBtn', 'click', () => this.hideSearch());
        
        // Albums functionality
        addListener('closeAlbumsBtn', 'click', () => this.hideAlbums());
        addListener('backToAlbumsBtn', 'click', () => this.showAlbums());
        
        // Modal functionality
        addListener('closeModal', 'click', () => this.closeModal());
        addListener('confirmAdd', 'click', () => this.confirmAddToQueue());
        addListener('cancelAdd', 'click', () => this.closeModal());
        
        // Search mode radio buttons
        const searchModeRadios = document.querySelectorAll('input[name="searchMode"]');
        if (searchModeRadios.length > 0) {
            searchModeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.searchMode = e.target.value;
                    this.updateSearchBehavior();
                });
            });
            console.log(`✅ Added change listeners to ${searchModeRadios.length} search mode radios`);
        } else {
            console.error('❌ No search mode radio buttons found');
        }
        
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

    async requestLocation() {
        if (!navigator.geolocation) {
            this.showError('Geolocation is not supported by this browser.');
            return;
        }

        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
        };

        try {
            const position = await this.getCurrentPosition(options);
            const { latitude, longitude } = position.coords;
            
            // Check if location is allowed (you can add your location bounds here)
            if (this.isLocationAllowed(latitude, longitude)) {
                console.log('Location allowed:', latitude, longitude);
                this.showScreen('main');
                await this.loadData();
                this.startAutoRefresh();
            } else {
                console.log('Location not allowed:', latitude, longitude);
                this.showError('Location not within allowed area. Please contact administrator.');
            }
            
        } catch (error) {
            console.error('Location error:', error);
            // If location fails, show error but don't proceed
            this.showError('Unable to access location. Please enable location services and try again.');
        }
    }

    getCurrentPosition(options) {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    }

    isLocationAllowed(lat, lng) {
        // For now, allow access from anywhere
        // You can add specific location bounds here later
        return true;
        
        // Example of location restriction (commented out):
        // const allowedBounds = {
        //     north: 40.7589,  // Example: New York area
        //     south: 40.4774,
        //     east: -73.7004,
        //     west: -74.2591
        // };
        // return this.isWithinBounds(lat, lng, allowedBounds);
    }

    isWithinBounds(lat, lng, bounds) {
        return lat >= bounds.south && lat <= bounds.north && 
               lng >= bounds.west && lng <= bounds.east;
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
        // Reload the page to restart the location check
        window.location.reload();
    }

    // Clean song title by removing track numbers and file extensions
    cleanSongTitle(title) {
        if (!title) return title;
        
        // Remove track numbers (e.g., "02 - ", "01. ", "1) ", etc.)
        let cleaned = title.replace(/^\d{1,2}[\s\-\.\)]+/, '');
        
        // Remove file extensions (e.g., ".mp3", ".wav", ".flac", etc.)
        cleaned = cleaned.replace(/\.(mp3|wav|flac|m4a|aac|ogg)$/i, '');
        
        // Trim whitespace
        cleaned = cleaned.trim();
        
        return cleaned;
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
            
            // Only update if playlist has changed to avoid unnecessary re-renders
            if (JSON.stringify(newPlaylist) !== JSON.stringify(this.playlist)) {
                this.playlist = newPlaylist;
                this.renderPlaylist();
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
                    <i class="fas fa-music"></i>
                </div>
                <div class="album-title">${album.title}</div>
            `;
            albumCard.addEventListener('click', () => this.showAlbumDetail(album));
            albumsGrid.appendChild(albumCard);
        });
        console.log('Albums rendered successfully');
    }

    renderPlaylist() {
        const container = document.getElementById('playlistContainer');
        container.innerHTML = '';

        const startIndex = this.playlistPage * this.playlistPageSize;
        const endIndex = Math.min(startIndex + this.playlistPageSize, this.playlist.length);
        const pageSongs = this.playlist.slice(startIndex, endIndex);

        // Fill with empty slots if needed
        for (let i = 0; i < this.playlistPageSize; i++) {
            const playlistItem = document.createElement('div');
            playlistItem.className = 'playlist-item';
            
            if (i < pageSongs.length) {
                const song = pageSongs[i];
                const statusIcon = song.existsAtMaster ? 
                    (song.status === 'playing' ? '▶️' : '✅') : 
                    '⏳';
                const statusText = song.existsAtMaster ? 
                    (song.status === 'playing' ? 'Playing' : 'Confirmed') : 
                    'Pending Master';
                
                playlistItem.innerHTML = `
                    <div class="song-title">${song.title || 'Unknown Song'}</div>
                    <div class="song-artist">${song.artist || 'Unknown Artist'}</div>
                    <div class="song-status">${statusIcon} ${statusText}</div>
                `;
                if (song.status === 'playing') {
                    playlistItem.classList.add('playing');
                }
                if (!song.existsAtMaster) {
                    playlistItem.classList.add('pending');
                }
            } else {
                playlistItem.innerHTML = `
                    <div class="song-title">Empty Slot</div>
                    <div class="song-artist">No song</div>
                `;
            }
            
            container.appendChild(playlistItem);
        }

        this.updatePlaylistNavigation();
    }

    updatePlaylistNavigation() {
        const totalPages = Math.ceil(this.playlist.length / this.playlistPageSize) || 1;
        const currentPage = this.playlistPage + 1;
        
        document.getElementById('playlistPage').textContent = `${currentPage} of ${totalPages}`;
        document.getElementById('prevPlaylist').disabled = this.playlistPage === 0;
        document.getElementById('nextPlaylist').disabled = this.playlistPage >= totalPages - 1;
    }

    prevPlaylistPage() {
        if (this.playlistPage > 0) {
            this.playlistPage--;
            this.renderPlaylist();
        }
    }

    nextPlaylistPage() {
        const totalPages = Math.ceil(this.playlist.length / this.playlistPageSize) || 1;
        if (this.playlistPage < totalPages - 1) {
            this.playlistPage++;
            this.renderPlaylist();
        }
    }

    async showAlbums() {
        console.log('showAlbums called, current albums count:', this.albums.length);
        console.log('Current screen:', this.currentScreen);
        
        // Ensure albums are loaded
        if (this.albums.length === 0) {
            console.log('No albums loaded, loading albums...');
            await this.loadAlbums();
        }
        console.log('Showing albums section, albums count:', this.albums.length);
        
        const albumsSection = document.getElementById('albumsSection');
        const albumDetailSection = document.getElementById('albumDetailSection');
        
        if (albumsSection) {
            albumsSection.classList.remove('hidden');
            console.log('Albums section classes after remove hidden:', albumsSection.className);
        } else {
            console.error('albumsSection element not found!');
        }
        
        if (albumDetailSection) {
            albumDetailSection.classList.add('hidden');
        } else {
            console.error('albumDetailSection element not found!');
        }
        
        console.log('Albums section should now be visible');
    }

    hideAlbums() {
        document.getElementById('albumsSection').classList.add('hidden');
    }

    async showAlbumDetail(album) {
        this.currentAlbum = album;
        document.getElementById('albumDetailTitle').textContent = album.title;
        document.getElementById('albumName').textContent = album.title;
        document.getElementById('albumArtist').textContent = 'Various Artists'; // You can add artist field to albums
        
        // Ensure songs are loaded
        if (this.songs.length === 0) {
            await this.loadSongs();
        }
        
        // Get songs for this album
        const albumSongs = this.songs.filter(song => song.album === album.title);
        this.renderAlbumSongs(albumSongs);
        
        document.getElementById('albumDetailSection').classList.remove('hidden');
    }

    renderAlbumSongs(songs) {
        const songsList = document.getElementById('albumSongsList');
        songsList.innerHTML = '';

        songs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist || 'Unknown Artist'}</div>
                </div>
                <button class="add-btn" data-song='${JSON.stringify(song)}'>
                    <i class="fas fa-plus"></i>
                </button>
            `;
            
            songItem.querySelector('.add-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAddToQueueModal(song);
            });
            
            songsList.appendChild(songItem);
        });
    }

    showSearch() {
        document.getElementById('searchSection').classList.remove('hidden');
        this.updateSearchBehavior();
    }

    hideSearch() {
        document.getElementById('searchSection').classList.add('hidden');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchResults').innerHTML = '';
    }

    updateSearchBehavior() {
        const searchInput = document.getElementById('searchInput');
        const searchSubmitBtn = document.getElementById('searchSubmitBtn');
        
        if (this.searchMode === 'instant') {
            searchSubmitBtn.style.display = 'none';
        } else {
            searchSubmitBtn.style.display = 'block';
        }
    }

    handleSearchInput(e) {
        if (this.searchMode === 'instant') {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch();
            }, 300); // 300ms delay for instant search
        }
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            document.getElementById('searchResults').innerHTML = '';
            return;
        }

        try {
            // Local search through songs
            const results = this.songs.filter(song => 
                song.title.toLowerCase().includes(query.toLowerCase()) ||
                (song.artist && song.artist.toLowerCase().includes(query.toLowerCase()))
            );
            this.renderSearchResults(results);
        } catch (error) {
            console.error('Search error:', error);
            this.renderSearchResults([]);
        }
    }

    renderSearchResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        resultsContainer.innerHTML = '';

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="no-results">No songs found matching your search.</p>';
            return;
        }

        results.forEach(song => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist || 'Unknown Artist'}</div>
                    <div class="song-album">${song.album || 'Unknown Album'}</div>
                </div>
                <button class="add-btn" data-song='${JSON.stringify(song)}'>
                    <i class="fas fa-plus"></i>
                </button>
            `;
            
            resultItem.querySelector('.add-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.showAddToQueueModal(song);
            });
            
            resultsContainer.appendChild(resultItem);
        });
    }

    showAddToQueueModal(song) {
        document.getElementById('songTitle').textContent = song.title;
        document.getElementById('addToQueueModal').classList.remove('hidden');
        this.currentSongToAdd = song;
    }

    closeModal() {
        document.getElementById('addToQueueModal').classList.add('hidden');
        this.currentSongToAdd = null;
    }

    async confirmAddToQueue() {
        if (!this.currentSongToAdd) return;

        const priority = parseInt(document.getElementById('priority').value);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/tracklist`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    songId: this.currentSongToAdd._id || this.currentSongToAdd.id,
                    title: this.cleanSongTitle(this.currentSongToAdd.title),
                    artist: this.currentSongToAdd.artist || 'Unknown Artist',
                    album: this.currentSongToAdd.album || 'Unknown Album',
                    duration: this.currentSongToAdd.duration || 180,
                    priority: priority,
                    requestedBy: 'user',
                    masterId: 'webapp',
                    slaveId: 'webapp',
                    existsAtMaster: false,  // Initially false - master needs to confirm
                    length: 0  // Initially 0 - master will set actual length
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Song added to tracklist (pending master confirmation):', result);
            
            // Refresh the playlist to show the new entry
            await this.loadPlaylist();
            
            this.showSuccess('Song sent to master for confirmation!');
            this.closeModal();
            // Auto-scroll to show the added song
            this.scrollToLastPlaylistItem();
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