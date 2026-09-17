/**
 * SoundPulse - Storage Module
 * Manages LocalStorage persistence for favorites, playlists, history, and user settings.
 */

const STORAGE_KEYS = {
  FAVORITES: 'soundpulse_favorites',
  PLAYLISTS: 'soundpulse_playlists',
  HISTORY: 'soundpulse_history',
  SETTINGS: 'soundpulse_settings',
  EQ: 'soundpulse_eq_preset'
};

export const Storage = {
  // Favorites
  getFavorites() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Failed to read favorites:', e);
      return [];
    }
  },

  isFavorite(trackId) {
    const favs = this.getFavorites();
    return favs.some(item => item.id === trackId);
  },

  toggleFavorite(track) {
    if (!track || !track.id) return false;
    let favs = this.getFavorites();
    const index = favs.findIndex(item => item.id === track.id);
    let isNowFav = false;

    if (index >= 0) {
      favs.splice(index, 1);
      isNowFav = false;
    } else {
      favs.unshift({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        streamUrl: track.streamUrl,
        duration: track.duration,
        genre: track.genre || '',
        isLive: !!track.isLive,
        addedAt: Date.now()
      });
      isNowFav = true;
    }

    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favs));
    } catch (e) {
      console.error('Failed to save favorites:', e);
    }
    return isNowFav;
  },

  // Playlists
  getPlaylists() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      return data ? JSON.parse(data) : [
        {
          id: 'pl_chill',
          name: 'Chill & Lo-Fi',
          description: 'Relaxing ambient & lo-fi beats',
          tracks: []
        },
        {
          id: 'pl_favorites',
          name: 'Liked Songs',
          description: 'Your starred music',
          tracks: []
        }
      ];
    } catch (e) {
      console.error('Failed to read playlists:', e);
      return [];
    }
  },

  savePlaylists(playlists) {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    } catch (e) {
      console.error('Failed to save playlists:', e);
    }
  },

  createPlaylist(name, description = '') {
    const playlists = this.getPlaylists();
    const newPlaylist = {
      id: 'pl_' + Date.now(),
      name: name.trim() || 'New Playlist',
      description: description.trim(),
      tracks: []
    };
    playlists.push(newPlaylist);
    this.savePlaylists(playlists);
    return newPlaylist;
  },

  addTrackToPlaylist(playlistId, track) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return false;

    if (!pl.tracks.some(t => t.id === track.id)) {
      pl.tracks.push({
        id: track.id,
        title: track.title,
        artist: track.artist,
        artwork: track.artwork,
        streamUrl: track.streamUrl,
        duration: track.duration,
        genre: track.genre || '',
        isLive: !!track.isLive
      });
      this.savePlaylists(playlists);
    }
    return true;
  },

  removeTrackFromPlaylist(playlistId, trackId) {
    const playlists = this.getPlaylists();
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return false;

    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
    this.savePlaylists(playlists);
    return true;
  },

  deletePlaylist(playlistId) {
    let playlists = this.getPlaylists();
    playlists = playlists.filter(p => p.id !== playlistId);
    this.savePlaylists(playlists);
  },

  // Listening History
  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  addToHistory(track) {
    if (!track || !track.id) return;
    let history = this.getHistory();
    // Remove if already in history so it moves to front
    history = history.filter(t => t.id !== track.id);
    history.unshift({
      id: track.id,
      title: track.title,
      artist: track.artist,
      artwork: track.artwork,
      streamUrl: track.streamUrl,
      duration: track.duration,
      playedAt: Date.now()
    });
    // Keep max 50 recent tracks
    if (history.length > 50) history.pop();
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    } catch (e) {}
  },

  clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  },

  // Settings & Presets
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? JSON.parse(data) : {
        volume: 0.8,
        isMuted: false,
        shuffle: false,
        repeat: 'off', // 'off' | 'all' | 'one'
        visMode: 'bars',
        eqPreset: 'Flat'
      };
    } catch (e) {
      return { volume: 0.8, isMuted: false, shuffle: false, repeat: 'off', visMode: 'bars', eqPreset: 'Flat' };
    }
  },

  saveSettings(settings) {
    try {
      const current = this.getSettings();
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
    } catch (e) {}
  }
};
