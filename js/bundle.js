/**
 * SoundPulse - Unified Bundle
 * Fully self-contained ad-free online music streaming client.
 * Compatible with both local file:// protocol and http:// server.
 */

(function() {
  'use strict';

  // ==========================================
  // 1. STORAGE MODULE
  // ==========================================
  const STORAGE_KEYS = {
    FAVORITES: 'soundpulse_favorites',
    PLAYLISTS: 'soundpulse_playlists',
    HISTORY: 'soundpulse_history',
    SETTINGS: 'soundpulse_settings',
    EQ: 'soundpulse_eq_preset'
  };

  const Storage = {
    getFavorites() {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
        return data ? JSON.parse(data) : [];
      } catch (e) {
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
      } catch (e) {}
      return isNowFav;
    },

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
      if (history.length > 50) history.pop();
      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
      } catch (e) {}
    },

    getSettings() {
      try {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        return data ? JSON.parse(data) : {
          volume: 0.8,
          isMuted: false,
          shuffle: false,
          repeat: 'off',
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

  // ==========================================
  // 2. API & ONLINE SOURCES MODULE
  // ==========================================
  const AUDIUS_DISCOVERY_NODES = [
    'https://discoveryprovider.audius.co',
    'https://audius-discovery-1.cultur3stake.com',
    'https://discovery-us-01.audius.openplayer.org',
    'https://audius-dp.amsterdam.creatorseed.com'
  ];

  const RADIO_BROWSER_NODES = [
    'https://de1.api.radio-browser.info',
    'https://nl1.api.radio-browser.info',
    'https://at1.api.radio-browser.info'
  ];

  let currentAudiusNode = AUDIUS_DISCOVERY_NODES[0];
  let currentRadioNode = RADIO_BROWSER_NODES[0];

  const CURATED_STATIONS = [
    {
      id: 'station_rp_main',
      title: 'Radio Paradise (Main Mix)',
      artist: 'Eclectic Rock & Indie (320k HD)',
      artwork: 'https://radioparadise.com/graphics/rp_logo_300.png',
      streamUrl: 'https://stream.radioparadise.com/mp3-320',
      tags: 'Eclectic, Rock, HD, Ad-Free',
      isLive: true
    },
    {
      id: 'station_rp_mellow',
      title: 'Radio Paradise (Mellow Mix)',
      artist: 'Chill Acoustic & Ambient (320k HD)',
      artwork: 'https://radioparadise.com/graphics/rp_logo_300.png',
      streamUrl: 'https://stream.radioparadise.com/mellow-320',
      tags: 'Mellow, Acoustic, Ambient',
      isLive: true
    },
    {
      id: 'station_somafm_groove',
      title: 'SomaFM Groove Salad',
      artist: 'A nicely chilled plate of ambient/downtempo beats',
      artwork: 'https://somafm.com/img3/groovesalad-400.jpg',
      streamUrl: 'https://ice1.somafm.com/groovesalad-256-mp3',
      tags: 'Downtempo, Chillout, Ambient',
      isLive: true
    },
    {
      id: 'station_somafm_drone',
      title: 'SomaFM Drone Zone',
      artist: 'Atmospheric ambient space music with no commercials',
      artwork: 'https://somafm.com/img3/dronezone-400.jpg',
      streamUrl: 'https://ice1.somafm.com/dronezone-256-mp3',
      tags: 'Space, Drone, Atmospheric',
      isLive: true
    },
    {
      id: 'station_somafm_defcon',
      title: 'SomaFM DEF CON Radio',
      artist: 'Music for Hacking & Coding',
      artwork: 'https://somafm.com/img3/defcon-400.jpg',
      streamUrl: 'https://ice1.somafm.com/defcon-256-mp3',
      tags: 'Chillhop, Electronic, Synth',
      isLive: true
    },
    {
      id: 'station_nightwave',
      title: 'Nightwave Plaza',
      artist: '24/7 Vaporwave, Future Funk & Lo-Fi',
      artwork: 'https://plaza.one/img/cover.png',
      streamUrl: 'https://radio.plaza.one/mp3',
      tags: 'Vaporwave, Synth, Future Funk',
      isLive: true
    },
    {
      id: 'station_classic_vinyl',
      title: 'Classic Vinyl HD',
      artist: 'Legendary 60s, 70s & 80s Hits (320k)',
      artwork: 'https://icecast.walmradio.com:8443/classic.jpg',
      streamUrl: 'https://icecast.walmradio.com:8443/classic',
      tags: 'Classic Rock, 70s, 80s, Vinyl',
      isLive: true
    },
    {
      id: 'station_kexp',
      title: 'KEXP 90.3 FM',
      artist: 'Where the Music Matters - Seattle Indie & Alternative',
      artwork: 'https://www.kexp.org/static/assets/img/kexp-logo-square.png',
      streamUrl: 'https://kexp.streamguys1.com/kexp160.aac',
      tags: 'Indie, Alternative, Live',
      isLive: true
    }
  ];

  const MusicAPI = {
    appName: 'SoundPulseAdFree',

    formatAudiusTrack(item) {
      let artwork = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
      if (item.artwork) {
        artwork = item.artwork['480x480'] || item.artwork['150x150'] || item.artwork['1000x1000'] || artwork;
      }

      const streamUrl = (item.stream && item.stream.url)
        ? item.stream.url
        : `${currentAudiusNode}/v1/tracks/${item.id}/stream?app_name=${this.appName}`;

      return {
        id: 'audius_' + item.id,
        rawId: item.id,
        title: item.title || 'Untitled Track',
        artist: (item.user && item.user.name) ? item.user.name : 'Unknown Artist',
        artwork: artwork,
        streamUrl: streamUrl,
        duration: item.duration || 0,
        genre: item.genre || 'Various',
        mood: item.mood || '',
        isLive: false,
        source: 'Audius'
      };
    },

    async getTrending(genre = '', limit = 30) {
      try {
        let url = `${currentAudiusNode}/v1/tracks/trending?app_name=${this.appName}&limit=${limit}`;
        if (genre && genre !== 'All') {
          url += `&genre=${encodeURIComponent(genre)}`;
        }
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Trending error ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.data)) {
          return data.data.map(track => this.formatAudiusTrack(track));
        }
        return [];
      } catch (err) {
        console.warn('Audius primary node failover...', err);
        currentAudiusNode = AUDIUS_DISCOVERY_NODES[1];
        try {
          let url = `${currentAudiusNode}/v1/tracks/trending?app_name=${this.appName}&limit=${limit}`;
          if (genre && genre !== 'All') url += `&genre=${encodeURIComponent(genre)}`;
          const res = await fetch(url);
          const data = await res.json();
          return (data.data || []).map(track => this.formatAudiusTrack(track));
        } catch (e2) {
          return [];
        }
      }
    },

    async searchTracks(query, limit = 30) {
      if (!query || !query.trim()) return [];
      try {
        const url = `${currentAudiusNode}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${this.appName}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Search error ${res.status}`);
        const data = await res.json();
        return (data.data || []).map(track => this.formatAudiusTrack(track));
      } catch (err) {
        return [];
      }
    },

    async getTopRadioStations(limit = 24) {
      try {
        const url = `${currentRadioNode}/json/stations/topclick/${limit}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Radio fetch ${res.status}`);
        const list = await res.json();

        const stations = list.map(item => ({
          id: 'radio_' + item.stationuuid,
          title: item.name || 'Live Radio',
          artist: (item.country ? `${item.country} • ` : '') + (item.tags ? item.tags.split(',').slice(0, 2).join(', ') : 'Live Stream'),
          artwork: item.favicon || 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?w=500&auto=format&fit=crop&q=60',
          streamUrl: item.url_resolved || item.url,
          duration: 0,
          genre: item.tags || 'Radio',
          bitrate: item.bitrate ? `${item.bitrate} kbps` : '',
          isLive: true,
          source: 'Radio'
        }));

        return [...CURATED_STATIONS, ...stations];
      } catch (err) {
        return CURATED_STATIONS;
      }
    },

    async searchRadioStations(query, limit = 20) {
      if (!query || !query.trim()) return [];
      try {
        const url = `${currentRadioNode}/json/stations/search?name=${encodeURIComponent(query)}&limit=${limit}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const list = await res.json();
        return list.map(item => ({
          id: 'radio_' + item.stationuuid,
          title: item.name || 'Live Radio',
          artist: item.country ? `${item.country} • Live` : 'Live Stream',
          artwork: item.favicon || 'https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?w=500&auto=format&fit=crop&q=60',
          streamUrl: item.url_resolved || item.url,
          duration: 0,
          genre: item.tags || 'Radio',
          isLive: true,
          source: 'Radio'
        }));
      } catch (err) {
        return [];
      }
    }
  };

  // ==========================================
  // 3. AUDIO PLAYER & WEB AUDIO ENGINE
  // ==========================================
  const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_PRESETS = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'Bass Boost': [6, 5.5, 4.5, 3, 1, 0, 0, 0, 0, 0],
    'Treble Boost': [0, 0, 0, 0, 0, 1, 2.5, 4, 5.5, 6],
    'Vocal': [-2, -2, -1, 2, 4.5, 4, 3, 1.5, 0, -1],
    'Electronic': [5, 4.5, 2, 0, -1.5, 1.5, 3, 4, 4.5, 5],
    'Rock': [4.5, 3.5, -1, -2, -1, 1, 3, 4, 4.5, 4.5],
    'Pop': [-1.5, 1, 2.5, 3.5, 3, 1.5, 0, 1, 2.5, 3],
    'Lo-Fi': [3, 2, 0, -2, -1, 0, 1, -2, -5, -8]
  };

  class AudioEngine {
    constructor() {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      this.audio.preload = 'metadata';

      this.queue = [];
      this.currentIndex = -1;
      this.currentTrack = null;

      const settings = Storage.getSettings();
      this.shuffle = settings.shuffle || false;
      this.repeat = settings.repeat || 'off';
      this.volume = settings.volume !== undefined ? settings.volume : 0.8;
      this.audio.volume = this.volume;

      this.audioCtx = null;
      this.sourceNode = null;
      this.gainNode = null;
      this.analyserNode = null;
      this.eqFilters = [];
      this.isWebAudioInitialized = false;

      this.sleepTimerId = null;
      this.sleepEndTime = null;

      this.onTrackChange = null;
      this.onStateChange = null;
      this.onTimeUpdate = null;
      this.onQueueUpdate = null;
      this.onSleepTimerTick = null;

      this.initAudioEvents();
      this.initMediaSession();
    }

    initWebAudio() {
      if (this.isWebAudioInitialized) return;
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtxClass) return;

        this.audioCtx = new AudioCtxClass();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.value = 1.0;

        this.analyserNode = this.audioCtx.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.82;

        this.eqFilters = EQ_BANDS.map(freq => {
          const filter = this.audioCtx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1.4;
          filter.gain.value = 0;
          return filter;
        });

        try {
          this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
          let prevNode = this.sourceNode;
          this.eqFilters.forEach(filter => {
            prevNode.connect(filter);
            prevNode = filter;
          });
          prevNode.connect(this.gainNode);
          this.gainNode.connect(this.analyserNode);
          this.analyserNode.connect(this.audioCtx.destination);
        } catch (e) {
          console.warn('Direct media element audio context hook skipped:', e);
        }

        this.isWebAudioInitialized = true;
        const savedPreset = Storage.getSettings().eqPreset || 'Flat';
        this.applyEqPreset(savedPreset);
      } catch (e) {
        console.warn('Web Audio initialization error:', e);
      }
    }

    initAudioEvents() {
      this.audio.addEventListener('play', () => {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        this.notifyStateChange(true);
        this.updateMediaSessionPlaybackState('playing');
      });

      this.audio.addEventListener('pause', () => {
        this.notifyStateChange(false);
        this.updateMediaSessionPlaybackState('paused');
      });

      this.audio.addEventListener('timeupdate', () => {
        if (this.onTimeUpdate) {
          this.onTimeUpdate({
            currentTime: this.audio.currentTime,
            duration: this.audio.duration || 0,
            progress: this.audio.duration ? (this.audio.currentTime / this.audio.duration) : 0
          });
        }
      });

      this.audio.addEventListener('ended', () => {
        this.handleTrackEnded();
      });

      this.audio.addEventListener('error', (e) => {
        if (this.onStateChange) {
          this.onStateChange({ isPlaying: false, error: 'Playback stream unavailable' });
        }
      });
    }

    async playTrack(track, queue = null, index = -1) {
      if (!track) return;
      this.initWebAudio();

      if (queue && Array.isArray(queue)) {
        this.queue = [...queue];
        this.currentIndex = index >= 0 ? index : this.queue.findIndex(t => t.id === track.id);
        if (this.currentIndex === -1) {
          this.queue.unshift(track);
          this.currentIndex = 0;
        }
      } else if (this.currentIndex === -1 || !this.queue.some(t => t.id === track.id)) {
        this.queue.push(track);
        this.currentIndex = this.queue.length - 1;
      }

      this.currentTrack = track;
      Storage.addToHistory(track);

      this.audio.src = track.streamUrl;
      this.audio.currentTime = 0;

      try {
        await this.audio.play();
      } catch (err) {
        console.warn('Autoplay prevented or stream error:', err);
      }

      if (this.onTrackChange) this.onTrackChange(this.currentTrack);
      if (this.onQueueUpdate) this.onQueueUpdate(this.queue, this.currentIndex);
      this.updateMediaSessionMetadata(this.currentTrack);
    }

    togglePlay() {
      this.initWebAudio();
      if (!this.currentTrack && this.queue.length > 0) {
        this.playTrack(this.queue[0], this.queue, 0);
        return;
      }
      if (this.audio.paused) {
        this.audio.play().catch(e => console.warn(e));
      } else {
        this.audio.pause();
      }
    }

    next() {
      if (this.queue.length === 0) return;
      if (this.shuffle) {
        let randIndex;
        do {
          randIndex = Math.floor(Math.random() * this.queue.length);
        } while (this.queue.length > 1 && randIndex === this.currentIndex);
        this.currentIndex = randIndex;
      } else {
        this.currentIndex++;
        if (this.currentIndex >= this.queue.length) {
          if (this.repeat === 'all') {
            this.currentIndex = 0;
          } else {
            this.currentIndex = this.queue.length - 1;
            this.audio.pause();
            return;
          }
        }
      }
      this.playTrack(this.queue[this.currentIndex]);
    }

    prev() {
      if (this.queue.length === 0) return;
      if (this.audio.currentTime > 3) {
        this.audio.currentTime = 0;
        return;
      }
      this.currentIndex--;
      if (this.currentIndex < 0) {
        this.currentIndex = this.queue.length - 1;
      }
      this.playTrack(this.queue[this.currentIndex]);
    }

    handleTrackEnded() {
      if (this.repeat === 'one') {
        this.audio.currentTime = 0;
        this.audio.play().catch(e => console.warn(e));
        return;
      }
      if (this.sleepMode === 'end_of_track') {
        this.cancelSleepTimer();
        this.audio.pause();
        return;
      }
      this.next();
    }

    seek(percent) {
      if (this.currentTrack && this.currentTrack.isLive) return;
      if (this.audio.duration) {
        this.audio.currentTime = percent * this.audio.duration;
      }
    }

    setVolume(val) {
      this.volume = Math.max(0, Math.min(1, val));
      this.audio.volume = this.volume;
      Storage.saveSettings({ volume: this.volume });
    }

    toggleMute() {
      this.audio.muted = !this.audio.muted;
      Storage.saveSettings({ isMuted: this.audio.muted });
      return this.audio.muted;
    }

    toggleShuffle() {
      this.shuffle = !this.shuffle;
      Storage.saveSettings({ shuffle: this.shuffle });
      return this.shuffle;
    }

    cycleRepeat() {
      const modes = ['off', 'all', 'one'];
      const nextIdx = (modes.indexOf(this.repeat) + 1) % modes.length;
      this.repeat = modes[nextIdx];
      Storage.saveSettings({ repeat: this.repeat });
      return this.repeat;
    }

    removeFromQueue(index) {
      if (index < 0 || index >= this.queue.length) return;
      this.queue.splice(index, 1);
      if (index < this.currentIndex) {
        this.currentIndex--;
      } else if (index === this.currentIndex) {
        if (this.queue.length > 0) {
          this.currentIndex = Math.min(this.currentIndex, this.queue.length - 1);
          this.playTrack(this.queue[this.currentIndex]);
        } else {
          this.currentIndex = -1;
          this.currentTrack = null;
          this.audio.src = '';
        }
      }
      if (this.onQueueUpdate) this.onQueueUpdate(this.queue, this.currentIndex);
    }

    clearQueue() {
      this.queue = this.currentTrack ? [this.currentTrack] : [];
      this.currentIndex = this.queue.length > 0 ? 0 : -1;
      if (this.onQueueUpdate) this.onQueueUpdate(this.queue, this.currentIndex);
    }

    applyEqPreset(presetName) {
      const gains = EQ_PRESETS[presetName] || EQ_PRESETS['Flat'];
      if (this.eqFilters && this.eqFilters.length === gains.length) {
        this.eqFilters.forEach((filter, idx) => {
          filter.gain.setTargetAtTime(gains[idx], this.audioCtx ? this.audioCtx.currentTime : 0, 0.05);
        });
      }
      Storage.saveSettings({ eqPreset: presetName });
      return gains;
    }

    setEqBand(index, gainDb) {
      if (this.eqFilters && this.eqFilters[index]) {
        this.eqFilters[index].gain.setTargetAtTime(gainDb, this.audioCtx ? this.audioCtx.currentTime : 0, 0.05);
        Storage.saveSettings({ eqPreset: 'Custom' });
      }
    }

    setSleepTimer(minutes) {
      this.cancelSleepTimer();
      if (minutes === 'end_of_track') {
        this.sleepMode = 'end_of_track';
        if (this.onSleepTimerTick) this.onSleepTimerTick('End of Track');
        return;
      }
      const durationMs = minutes * 60 * 1000;
      this.sleepEndTime = Date.now() + durationMs;
      this.sleepMode = 'time';

      const updateTick = () => {
        const remaining = Math.max(0, this.sleepEndTime - Date.now());
        if (remaining <= 0) {
          this.performSleepFadeOut();
          return;
        }
        const minsLeft = Math.ceil(remaining / 60000);
        if (this.onSleepTimerTick) this.onSleepTimerTick(`${minsLeft}m`);
      };

      updateTick();
      this.sleepTimerInterval = setInterval(updateTick, 10000);
      this.sleepTimerId = setTimeout(() => {
        this.performSleepFadeOut();
      }, durationMs);
    }

    performSleepFadeOut() {
      const initialVol = this.audio.volume;
      const fadeSteps = 20;
      let step = 0;
      const interval = setInterval(() => {
        step++;
        this.audio.volume = Math.max(0, initialVol * (1 - step / fadeSteps));
        if (step >= fadeSteps) {
          clearInterval(interval);
          this.audio.pause();
          this.audio.volume = initialVol;
          this.cancelSleepTimer();
        }
      }, 200);
    }

    cancelSleepTimer() {
      if (this.sleepTimerId) clearTimeout(this.sleepTimerId);
      if (this.sleepTimerInterval) clearInterval(this.sleepTimerInterval);
      this.sleepTimerId = null;
      this.sleepTimerInterval = null;
      this.sleepEndTime = null;
      this.sleepMode = null;
      if (this.onSleepTimerTick) this.onSleepTimerTick(null);
    }

    initMediaSession() {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.prev());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && this.audio.duration) {
          this.seek(details.seekTime / this.audio.duration);
        }
      });
    }

    updateMediaSessionMetadata(track) {
      if (!('mediaSession' in navigator) || !track) return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.isLive ? 'Live Radio' : (track.genre || 'SoundPulse Online Music'),
        artwork: [{ src: track.artwork, sizes: '512x512', type: 'image/jpeg' }]
      });
    }

    updateMediaSessionPlaybackState(state) {
      if (!('mediaSession' in navigator)) return;
      navigator.mediaSession.playbackState = state;
    }

    notifyStateChange(isPlaying) {
      if (this.onStateChange) {
        this.onStateChange({
          isPlaying,
          track: this.currentTrack,
          isLive: this.currentTrack ? !!this.currentTrack.isLive : false
        });
      }
    }
  }

  // ==========================================
  // 4. CANVAS AUDIO VISUALIZER
  // ==========================================
  class AudioVisualizer {
    constructor(canvas, audioEngine) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.engine = audioEngine;

      this.mode = 'bars';
      this.animationFrameId = null;
      this.particles = [];
      this.peaks = [];
      this.idlePhase = 0;

      this.initParticles();
      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    resize() {
      if (!this.canvas) return;
      const dpr = window.devicePixelRatio || 1;
      this.width = this.canvas.clientWidth || window.innerWidth;
      this.height = this.canvas.clientHeight || window.innerHeight;

      this.canvas.width = this.width * dpr;
      this.canvas.height = this.height * dpr;
      this.ctx.scale(dpr, dpr);
    }

    initParticles() {
      this.particles = [];
      for (let i = 0; i < 40; i++) {
        this.particles.push({
          x: Math.random() * (this.width || 800),
          y: Math.random() * (this.height || 600),
          radius: Math.random() * 2 + 1,
          speedX: (Math.random() - 0.5) * 0.8,
          speedY: (Math.random() - 0.5) * 0.8,
          alpha: Math.random() * 0.6 + 0.2
        });
      }
    }

    setMode(newMode) {
      if (['bars', 'waveform', 'radial'].includes(newMode)) {
        this.mode = newMode;
      }
    }

    start() {
      if (this.animationFrameId) return;
      const render = () => {
        this.draw();
        this.animationFrameId = requestAnimationFrame(render);
      };
      this.animationFrameId = requestAnimationFrame(render);
    }

    stop() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    draw() {
      const { ctx, width, height } = this;
      if (!ctx || !width || !height) return;

      ctx.fillStyle = 'rgba(6, 8, 14, 0.28)';
      ctx.fillRect(0, 0, width, height);

      let freqData = null;
      let timeData = null;
      let isLiveAudio = false;

      if (this.engine.analyserNode && !this.engine.audio.paused) {
        const bufferLength = this.engine.analyserNode.frequencyBinCount;
        freqData = new Uint8Array(bufferLength);
        timeData = new Uint8Array(bufferLength);
        this.engine.analyserNode.getByteFrequencyData(freqData);
        this.engine.analyserNode.getByteTimeDomainData(timeData);

        const sum = freqData.reduce((acc, val) => acc + val, 0);
        if (sum > 10) isLiveAudio = true;
      }

      if (!isLiveAudio) {
        this.idlePhase += this.engine.audio.paused ? 0.01 : 0.05;
        const count = 64;
        freqData = new Uint8Array(count);
        timeData = new Uint8Array(count);
        for (let i = 0; i < count; i++) {
          const factor = this.engine.audio.paused ? 15 : 70;
          freqData[i] = Math.sin(this.idlePhase + i * 0.15) * factor + factor;
          timeData[i] = 128 + Math.sin(this.idlePhase * 2 + i * 0.2) * (this.engine.audio.paused ? 8 : 40);
        }
      }

      this.drawParticles();

      if (this.mode === 'bars') {
        this.drawBars(freqData);
      } else if (this.mode === 'waveform') {
        this.drawWaveform(timeData);
      } else if (this.mode === 'radial') {
        this.drawRadial(freqData);
      }
    }

    drawBars(data) {
      const { ctx, width, height } = this;
      const barCount = Math.min(64, data.length);
      const gap = 4;
      const barWidth = (width - (barCount * gap)) / barCount;
      const maxHeight = height * 0.65;

      for (let i = 0; i < barCount; i++) {
        const val = data[i] / 255;
        const barHeight = Math.max(4, val * maxHeight);
        const x = i * (barWidth + gap);
        const y = height - barHeight;

        if (!this.peaks[i] || barHeight > this.peaks[i]) {
          this.peaks[i] = barHeight;
        } else {
          this.peaks[i] = Math.max(0, this.peaks[i] - 1.5);
        }

        const grad = ctx.createLinearGradient(0, y, 0, height);
        grad.addColorStop(0, '#06b6d4');
        grad.addColorStop(0.5, '#8b5cf6');
        grad.addColorStop(1, '#ec4899');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        if (this.peaks[i] > 4) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, height - this.peaks[i] - 3, barWidth, 2);
        }
      }
    }

    drawWaveform(data) {
      const { ctx, width, height } = this;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#8b5cf6';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#06b6d4';

      ctx.beginPath();
      const sliceWidth = width / data.length;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        const v = data[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    drawRadial(data) {
      const { ctx, width, height } = this;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.22;
      const barCount = 72;
      const angleStep = (Math.PI * 2) / barCount;

      const auraGrad = ctx.createRadialGradient(centerX, centerY, baseRadius * 0.2, centerX, centerY, baseRadius * 1.5);
      auraGrad.addColorStop(0, 'rgba(139, 92, 246, 0.35)');
      auraGrad.addColorStop(0.7, 'rgba(236, 72, 153, 0.15)');
      auraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < barCount; i++) {
        const dataIdx = Math.floor((i / barCount) * data.length);
        const val = (data[dataIdx] || 0) / 255;
        const barLen = val * 90;
        const angle = i * angleStep;

        const x1 = centerX + Math.cos(angle) * baseRadius;
        const y1 = centerY + Math.sin(angle) * baseRadius;
        const x2 = centerX + Math.cos(angle) * (baseRadius + barLen);
        const y2 = centerY + Math.sin(angle) * (baseRadius + barLen);

        ctx.strokeStyle = `hsl(${260 + i * 2}, 90%, 65%)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }

    drawParticles() {
      const { ctx, width, height } = this;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  // ==========================================
  // 5. APP CONTROLLER
  // ==========================================
  class SoundPulseApp {
    constructor() {
      this.player = new AudioEngine();
      this.currentView = 'discover';
      this.currentGenre = 'All';
      this.trendingTracks = [];
      this.radioStations = [];

      this.initDOM();
      this.initVisualizer();
      this.bindEvents();
      this.bindPlayerEvents();
      this.initKeyboardShortcuts();
      this.initDragAndDrop();

      this.loadTrending('All');
      this.loadRadioStations();
      this.renderLibrary();
      this.renderQueue();
    }

    initDOM() {
      this.navItems = document.querySelectorAll('.nav-item');
      this.viewSections = document.querySelectorAll('.view-section');

      this.searchInput = document.getElementById('search-input');
      this.searchClearBtn = document.getElementById('search-clear-btn');

      this.playBtn = document.getElementById('btn-play');
      this.playIcon = document.getElementById('play-icon');
      this.prevBtn = document.getElementById('btn-prev');
      this.nextBtn = document.getElementById('btn-next');
      this.shuffleBtn = document.getElementById('btn-shuffle');
      this.repeatBtn = document.getElementById('btn-repeat');
      this.favBtn = document.getElementById('btn-fav');
      this.favIcon = document.getElementById('fav-icon');

      this.progressBar = document.getElementById('progress-bar');
      this.currentTimeEl = document.getElementById('current-time');
      this.durationEl = document.getElementById('total-duration');

      this.volumeSlider = document.getElementById('volume-slider');
      this.muteBtn = document.getElementById('btn-mute');
      this.muteIcon = document.getElementById('mute-icon');

      this.trackArtwork = document.getElementById('current-artwork');
      this.trackTitle = document.getElementById('current-title');
      this.trackArtist = document.getElementById('current-artist');

      this.visModal = document.getElementById('visualizer-modal');
      this.visCanvas = document.getElementById('visualizer-canvas');
      this.openVisBtn = document.getElementById('btn-open-vis');
      this.closeVisBtn = document.getElementById('btn-close-vis');
      this.visTrackTitle = document.getElementById('vis-track-title');
      this.visTrackArtist = document.getElementById('vis-track-artist');
      this.visModeBtns = document.querySelectorAll('.vis-mode-btn');

      this.eqModal = document.getElementById('eq-modal');
      this.openEqBtn = document.getElementById('btn-open-eq');
      this.closeEqBtn = document.getElementById('btn-close-eq');
      this.eqPresetBtns = document.querySelectorAll('.eq-preset-btn');
      this.eqSlidersContainer = document.getElementById('eq-sliders-grid');

      this.queuePanel = document.getElementById('queue-panel');
      this.openQueueBtn = document.getElementById('btn-open-queue');
      this.closeQueueBtn = document.getElementById('btn-close-queue');
      this.queueListEl = document.getElementById('queue-items-list');
      this.clearQueueBtn = document.getElementById('btn-clear-queue');

      this.sleepBtn = document.getElementById('btn-sleep-timer');
      this.sleepBadge = document.getElementById('sleep-timer-badge');
      this.sleepModal = document.getElementById('sleep-modal');
      this.closeSleepBtn = document.getElementById('btn-close-sleep');

      this.customStreamModal = document.getElementById('custom-stream-modal');
      this.openCustomStreamBtn = document.getElementById('btn-open-custom-stream');
      this.closeCustomStreamBtn = document.getElementById('btn-close-custom-stream');
      this.customStreamForm = document.getElementById('custom-stream-form');

      this.buildEqSliders();
    }

    initVisualizer() {
      this.visualizer = new AudioVisualizer(this.visCanvas, this.player);
      this.visualizer.start();
    }

    bindEvents() {
      this.navItems.forEach(item => {
        item.addEventListener('click', () => {
          const targetView = item.dataset.view;
          if (targetView) this.switchView(targetView);
        });
      });

      const genrePills = document.querySelectorAll('.genre-pill');
      genrePills.forEach(pill => {
        pill.addEventListener('click', () => {
          genrePills.forEach(p => p.classList.remove('active'));
          pill.classList.add('active');
          const genre = pill.dataset.genre || 'All';
          this.currentGenre = genre;
          this.loadTrending(genre);
        });
      });

      let debounceTimer;
      this.searchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        this.searchClearBtn.style.display = val ? 'block' : 'none';

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (val.length >= 2) {
            this.performSearch(val);
          }
        }, 350);
      });

      this.searchClearBtn.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchClearBtn.style.display = 'none';
        if (this.currentView === 'search') {
          this.switchView('discover');
        }
      });

      this.playBtn.addEventListener('click', () => this.player.togglePlay());
      this.prevBtn.addEventListener('click', () => this.player.prev());
      this.nextBtn.addEventListener('click', () => this.player.next());

      this.shuffleBtn.addEventListener('click', () => {
        const active = this.player.toggleShuffle();
        this.shuffleBtn.classList.toggle('active', active);
      });

      this.repeatBtn.addEventListener('click', () => {
        const mode = this.player.cycleRepeat();
        this.repeatBtn.classList.toggle('active', mode !== 'off');
        this.repeatBtn.title = `Repeat: ${mode.toUpperCase()}`;
      });

      this.favBtn.addEventListener('click', () => {
        if (this.player.currentTrack) {
          const isFav = Storage.toggleFavorite(this.player.currentTrack);
          this.favBtn.classList.toggle('active', isFav);
          this.renderLibrary();
        }
      });

      this.progressBar.addEventListener('input', (e) => {
        const percent = parseFloat(e.target.value) / 100;
        this.player.seek(percent);
      });

      this.volumeSlider.addEventListener('input', (e) => {
        const vol = parseFloat(e.target.value) / 100;
        this.player.setVolume(vol);
        this.updateVolumeIcon(vol, false);
      });

      this.muteBtn.addEventListener('click', () => {
        const isMuted = this.player.toggleMute();
        this.updateVolumeIcon(this.player.volume, isMuted);
      });

      this.openVisBtn.addEventListener('click', () => this.openVisualizer());
      this.closeVisBtn.addEventListener('click', () => this.closeVisualizer());
      this.trackArtwork.addEventListener('click', () => this.openVisualizer());
      this.trackTitle.addEventListener('click', () => this.openVisualizer());

      this.visModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.visModeBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const mode = btn.dataset.mode;
          this.visualizer.setMode(mode);
          Storage.saveSettings({ visMode: mode });
        });
      });

      this.openEqBtn.addEventListener('click', () => this.eqModal.classList.add('active'));
      this.closeEqBtn.addEventListener('click', () => this.eqModal.classList.remove('active'));

      this.eqPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          this.eqPresetBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const preset = btn.dataset.preset;
          const gains = this.player.applyEqPreset(preset);
          this.updateEqSlidersFromGains(gains);
        });
      });

      this.openQueueBtn.addEventListener('click', () => this.queuePanel.classList.toggle('active'));
      this.closeQueueBtn.addEventListener('click', () => this.queuePanel.classList.remove('active'));
      this.clearQueueBtn.addEventListener('click', () => this.player.clearQueue());

      this.sleepBtn.addEventListener('click', () => this.sleepModal.classList.add('active'));
      this.closeSleepBtn.addEventListener('click', () => this.sleepModal.classList.remove('active'));

      document.querySelectorAll('.sleep-opt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.mins;
          if (val === 'cancel') {
            this.player.cancelSleepTimer();
          } else if (val === 'end_of_track') {
            this.player.setSleepTimer('end_of_track');
          } else {
            this.player.setSleepTimer(parseInt(val, 10));
          }
          this.sleepModal.classList.remove('active');
        });
      });

      this.openCustomStreamBtn.addEventListener('click', () => this.customStreamModal.classList.add('active'));
      this.closeCustomStreamBtn.addEventListener('click', () => this.customStreamModal.classList.remove('active'));

      this.customStreamForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('stream-url-input').value.trim();
        const title = document.getElementById('stream-title-input').value.trim() || 'Custom Stream';
        const artist = document.getElementById('stream-artist-input').value.trim() || 'Direct Stream';

        if (url) {
          const track = {
            id: 'custom_' + Date.now(),
            title,
            artist,
            artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
            streamUrl: url,
            duration: 0,
            isLive: true,
            source: 'Custom'
          };
          this.player.playTrack(track);
          this.customStreamModal.classList.remove('active');
          this.customStreamForm.reset();
        }
      });

      [this.eqModal, this.sleepModal, this.customStreamModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) modal.classList.remove('active');
        });
      });

      const radioSearchInput = document.getElementById('radio-search-input');
      if (radioSearchInput) {
        let rDebounce;
        radioSearchInput.addEventListener('input', (e) => {
          const val = e.target.value.trim();
          clearTimeout(rDebounce);
          rDebounce = setTimeout(async () => {
            if (val.length >= 2) {
              const stations = await MusicAPI.searchRadioStations(val);
              this.renderRadioGrid(stations);
            } else {
              this.renderRadioGrid(this.radioStations);
            }
          }, 350);
        });
      }
    }

    bindPlayerEvents() {
      this.player.onTrackChange = (track) => {
        this.trackTitle.textContent = track.title;
        this.trackArtist.textContent = track.artist;
        this.trackArtwork.src = track.artwork;

        this.visTrackTitle.textContent = track.title;
        this.visTrackArtist.textContent = track.artist;

        const isFav = Storage.isFavorite(track.id);
        this.favBtn.classList.toggle('active', isFav);

        if (track.isLive) {
          this.durationEl.innerHTML = '<span class="live-indicator"><span class="live-dot"></span> LIVE</span>';
          this.progressBar.disabled = true;
        } else {
          this.progressBar.disabled = false;
        }

        document.querySelectorAll('.music-card, .station-card').forEach(el => {
          el.classList.toggle('active', el.dataset.trackId === track.id);
        });
      };

      this.player.onStateChange = ({ isPlaying, error }) => {
        if (isPlaying) {
          this.playIcon.innerHTML = `<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>`;
        } else {
          this.playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
        }
        if (error) {
          console.warn('Playback notice:', error);
        }
      };

      this.player.onTimeUpdate = ({ currentTime, duration, progress }) => {
        this.currentTimeEl.textContent = this.formatTime(currentTime);
        if (!this.player.currentTrack || !this.player.currentTrack.isLive) {
          this.durationEl.textContent = this.formatTime(duration);
          this.progressBar.value = (progress * 100).toFixed(1);
        }
      };

      this.player.onQueueUpdate = () => {
        this.renderQueue();
      };

      this.player.onSleepTimerTick = (label) => {
        if (label) {
          this.sleepBadge.textContent = label;
          this.sleepBadge.style.display = 'inline-block';
        } else {
          this.sleepBadge.style.display = 'none';
        }
      };
    }

    switchView(viewName) {
      this.currentView = viewName;
      this.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
      });

      this.viewSections.forEach(sec => {
        sec.classList.toggle('active', sec.id === `view-${viewName}`);
      });

      if (viewName === 'library') {
        this.renderLibrary();
      }
    }

    async loadTrending(genre) {
      const grid = document.getElementById('trending-grid');
      grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Streaming fresh tracks...</div>';

      try {
        this.trendingTracks = await MusicAPI.getTrending(genre);
        this.renderTrackCards(this.trendingTracks, grid);
      } catch (err) {
        grid.innerHTML = '<div style="color: #ef4444; padding: 20px;">Could not load online tracks. Check network connection.</div>';
      }
    }

    async loadRadioStations() {
      const grid = document.getElementById('radio-grid');
      grid.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Connecting to 40,000+ live stations...</div>';

      try {
        this.radioStations = await MusicAPI.getTopRadioStations();
        this.renderRadioGrid(this.radioStations);
      } catch (err) {
        this.renderRadioGrid(CURATED_STATIONS);
      }
    }

    async performSearch(query) {
      this.switchView('search');
      const container = document.getElementById('search-results-container');
      const searchHeader = document.getElementById('search-query-header');
      searchHeader.textContent = `Results for "${query}"`;
      container.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Searching online songs and radio...</div>';

      try {
        const [tracks, stations] = await Promise.all([
          MusicAPI.searchTracks(query),
          MusicAPI.searchRadioStations(query)
        ]);

        if (tracks.length === 0 && stations.length === 0) {
          container.innerHTML = `<div style="color: var(--text-muted); padding: 40px; text-align: center;">No results found for "${query}". Try another artist or genre.</div>`;
          return;
        }

        let html = '';
        if (tracks.length > 0) {
          html += `<h3 style="margin: 20px 0 14px; font-size: 1.1rem; color: #fff;">Songs (${tracks.length})</h3>`;
          html += `<div class="cards-grid" id="search-tracks-grid"></div>`;
        }
        if (stations.length > 0) {
          html += `<h3 style="margin: 30px 0 14px; font-size: 1.1rem; color: #fff;">Radio Stations (${stations.length})</h3>`;
          html += `<div class="cards-grid" id="search-radio-grid" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));"></div>`;
        }

        container.innerHTML = html;

        if (tracks.length > 0) {
          this.renderTrackCards(tracks, document.getElementById('search-tracks-grid'));
        }
        if (stations.length > 0) {
          this.renderRadioCards(stations, document.getElementById('search-radio-grid'));
        }
      } catch (err) {
        container.innerHTML = `<div style="color: #ef4444; padding: 20px;">Search encountered an error. Please try again.</div>`;
      }
    }

    renderTrackCards(tracks, container) {
      if (!container) return;
      if (!tracks || tracks.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted);">No songs available.</div>';
        return;
      }

      container.innerHTML = '';
      tracks.forEach((track, idx) => {
        const card = document.createElement('div');
        card.className = 'music-card';
        card.dataset.trackId = track.id;

        card.innerHTML = `
          <div class="card-img-wrap">
            <img src="${track.artwork}" alt="${track.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'">
            <div class="card-play-overlay">
              <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            ${track.genre ? `<span class="card-tag">${track.genre}</span>` : ''}
          </div>
          <div class="card-title" title="${track.title}">${track.title}</div>
          <div class="card-subtitle" title="${track.artist}">${track.artist}</div>
          <div class="card-footer">
            <span class="card-badge">Ad-Free</span>
            <span>${this.formatTime(track.duration)}</span>
          </div>
        `;

        card.addEventListener('click', () => {
          this.player.playTrack(track, tracks, idx);
        });

        container.appendChild(card);
      });
    }

    renderRadioGrid(stations) {
      const container = document.getElementById('radio-grid');
      if (!container) return;
      container.innerHTML = '';

      stations.forEach((st) => {
        const card = document.createElement('div');
        card.className = 'station-card';
        card.dataset.trackId = st.id;

        card.innerHTML = `
          <div class="station-logo">
            <img src="${st.artwork}" alt="${st.title}" onerror="this.src='https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?w=500&auto=format&fit=crop&q=60'">
          </div>
          <div class="station-info">
            <div class="station-name" title="${st.title}">${st.title}</div>
            <div class="station-tags" title="${st.artist}">${st.artist}</div>
            <div class="station-meta">
              <span class="live-indicator"><span class="live-dot"></span> LIVE</span>
              ${st.bitrate ? `<span>• ${st.bitrate}</span>` : ''}
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          this.player.playTrack(st);
        });

        container.appendChild(card);
      });
    }

    renderRadioCards(stations, container) {
      if (!container) return;
      container.innerHTML = '';
      stations.forEach((st) => {
        const card = document.createElement('div');
        card.className = 'station-card';
        card.dataset.trackId = st.id;
        card.innerHTML = `
          <div class="station-logo">
            <img src="${st.artwork}" alt="${st.title}" onerror="this.src='https://images.unsplash.com/photo-1593697821252-0c9137d9fc45?w=500&auto=format&fit=crop&q=60'">
          </div>
          <div class="station-info">
            <div class="station-name">${st.title}</div>
            <div class="station-tags">${st.artist}</div>
            <div class="station-meta">
              <span class="live-indicator"><span class="live-dot"></span> LIVE</span>
            </div>
          </div>
        `;
        card.addEventListener('click', () => this.player.playTrack(st));
        container.appendChild(card);
      });
    }

    renderLibrary() {
      const favs = Storage.getFavorites();
      const favCountEl = document.getElementById('fav-count-badge');
      if (favCountEl) favCountEl.textContent = favs.length;

      const favsContainer = document.getElementById('library-favs-grid');
      if (favsContainer) {
        if (favs.length === 0) {
          favsContainer.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">No liked songs yet. Click the heart icon on any playing song!</div>';
        } else {
          this.renderTrackCards(favs, favsContainer);
        }
      }

      const history = Storage.getHistory();
      const historyContainer = document.getElementById('library-history-grid');
      if (historyContainer) {
        if (history.length === 0) {
          historyContainer.innerHTML = '<div style="color: var(--text-muted); padding: 20px;">Listening history will appear here.</div>';
        } else {
          this.renderTrackCards(history, historyContainer);
        }
      }
    }

    renderQueue() {
      if (!this.queueListEl) return;
      const queue = this.player.queue;
      const currentIdx = this.player.currentIndex;

      if (queue.length === 0) {
        this.queueListEl.innerHTML = '<div style="color: var(--text-muted); padding: 20px; text-align: center;">Queue is empty</div>';
        return;
      }

      this.queueListEl.innerHTML = '';
      queue.forEach((track, idx) => {
        const item = document.createElement('div');
        item.className = `queue-item ${idx === currentIdx ? 'active' : ''}`;
        item.innerHTML = `
          <img class="queue-thumb" src="${track.artwork}" alt="${track.title}">
          <div class="queue-item-info">
            <div class="queue-item-title">${track.title}</div>
            <div class="queue-item-artist">${track.artist}</div>
          </div>
          <button class="queue-remove-btn" title="Remove">&times;</button>
        `;

        item.addEventListener('click', (e) => {
          if (!e.target.classList.contains('queue-remove-btn')) {
            this.player.playTrack(track, queue, idx);
          }
        });

        const removeBtn = item.querySelector('.queue-remove-btn');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.player.removeFromQueue(idx);
        });

        this.queueListEl.appendChild(item);
      });
    }

    buildEqSliders() {
      if (!this.eqSlidersContainer) return;
      this.eqSlidersContainer.innerHTML = '';

      EQ_BANDS.forEach((band, idx) => {
        const col = document.createElement('div');
        col.className = 'eq-band-col';

        const labelText = band >= 1000 ? `${band / 1000}k` : `${band}`;
        col.innerHTML = `
          <span class="eq-db-label" id="eq-val-${idx}">0dB</span>
          <input type="range" class="eq-slider-vertical" id="eq-slider-${idx}" min="-12" max="12" step="0.5" value="0">
          <span class="eq-label">${labelText}</span>
        `;

        const slider = col.querySelector('.eq-slider-vertical');
        const valLabel = col.querySelector('.eq-db-label');

        slider.addEventListener('input', (e) => {
          const gain = parseFloat(e.target.value);
          valLabel.textContent = (gain > 0 ? `+${gain}` : `${gain}`) + 'dB';
          this.player.setEqBand(idx, gain);
          this.eqPresetBtns.forEach(b => b.classList.remove('active'));
        });

        this.eqSlidersContainer.appendChild(col);
      });
    }

    updateEqSlidersFromGains(gains) {
      if (!gains) return;
      gains.forEach((gain, idx) => {
        const slider = document.getElementById(`eq-slider-${idx}`);
        const valLabel = document.getElementById(`eq-val-${idx}`);
        if (slider && valLabel) {
          slider.value = gain;
          valLabel.textContent = (gain > 0 ? `+${gain}` : `${gain}`) + 'dB';
        }
      });
    }

    openVisualizer() {
      this.visModal.classList.add('active');
      this.visualizer.resize();
    }

    closeVisualizer() {
      this.visModal.classList.remove('active');
    }

    updateVolumeIcon(vol, isMuted) {
      if (isMuted || vol === 0) {
        this.muteIcon.innerHTML = `<path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
      } else if (vol < 0.5) {
        this.muteIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
      } else {
        this.muteIcon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>`;
      }
    }

    initKeyboardShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

        switch (e.code) {
          case 'Space':
            e.preventDefault();
            this.player.togglePlay();
            break;
          case 'ArrowRight':
            e.preventDefault();
            if (this.player.audio.duration) {
              this.player.audio.currentTime = Math.min(this.player.audio.duration, this.player.audio.currentTime + 5);
            }
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.player.audio.currentTime = Math.max(0, this.player.audio.currentTime - 5);
            break;
          case 'ArrowUp':
            e.preventDefault();
            this.player.setVolume(Math.min(1, this.player.volume + 0.05));
            this.volumeSlider.value = (this.player.volume * 100).toFixed(0);
            this.updateVolumeIcon(this.player.volume, false);
            break;
          case 'ArrowDown':
            e.preventDefault();
            this.player.setVolume(Math.max(0, this.player.volume - 0.05));
            this.volumeSlider.value = (this.player.volume * 100).toFixed(0);
            this.updateVolumeIcon(this.player.volume, false);
            break;
          case 'KeyM':
            const isMuted = this.player.toggleMute();
            this.updateVolumeIcon(this.player.volume, isMuted);
            break;
          case 'KeyN':
            this.player.next();
            break;
          case 'KeyP':
            this.player.prev();
            break;
          case 'KeyL':
            if (this.player.currentTrack) {
              const isFav = Storage.toggleFavorite(this.player.currentTrack);
              this.favBtn.classList.toggle('active', isFav);
              this.renderLibrary();
            }
            break;
          case 'Escape':
            this.closeVisualizer();
            this.eqModal.classList.remove('active');
            this.sleepModal.classList.remove('active');
            this.customStreamModal.classList.remove('active');
            this.queuePanel.classList.remove('active');
            break;
        }
      });
    }

    initDragAndDrop() {
      const dropOverlay = document.getElementById('drop-overlay');

      window.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropOverlay.classList.add('active');
      });

      window.addEventListener('dragleave', (e) => {
        if (e.relatedTarget === null) {
          dropOverlay.classList.remove('active');
        }
      });

      window.addEventListener('drop', (e) => {
        e.preventDefault();
        dropOverlay.classList.remove('active');

        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
        if (files.length > 0) {
          const localTracks = files.map((file, i) => ({
            id: 'local_' + Date.now() + '_' + i,
            title: file.name.replace(/\.[^/.]+$/, ""),
            artist: 'Local Audio',
            artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
            streamUrl: URL.createObjectURL(file),
            duration: 0,
            isLive: false,
            source: 'Local'
          }));

          this.player.playTrack(localTracks[0], localTracks, 0);
        }
      });
    }

    formatTime(seconds) {
      if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    window.SoundPulse = new SoundPulseApp();
  });
})();
