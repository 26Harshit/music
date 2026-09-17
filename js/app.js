/**
 * SoundPulse - Main Application Coordinator
 */

import { MusicAPI, CURATED_STATIONS } from './api.js';
import { AudioEngine, EQ_BANDS, EQ_PRESETS } from './player.js';
import { AudioVisualizer } from './visualizer.js';
import { Storage } from './storage.js';

class SoundPulseApp {
  constructor() {
    this.player = new AudioEngine();
    this.currentView = 'discover';
    this.currentGenre = 'All';
    this.trendingTracks = [];
    this.radioStations = [];
    this.searchResults = [];

    this.initDOM();
    this.initVisualizer();
    this.bindEvents();
    this.bindPlayerEvents();
    this.initKeyboardShortcuts();
    this.initDragAndDrop();

    // Initial load
    this.loadTrending('All');
    this.loadRadioStations();
    this.renderLibrary();
    this.renderQueue();
  }

  initDOM() {
    // Nav items
    this.navItems = document.querySelectorAll('.nav-item');
    this.viewSections = document.querySelectorAll('.view-section');

    // Search
    this.searchInput = document.getElementById('search-input');
    this.searchClearBtn = document.getElementById('search-clear-btn');

    // Player Elements
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

    // Visualizer Elements
    this.visModal = document.getElementById('visualizer-modal');
    this.visCanvas = document.getElementById('visualizer-canvas');
    this.openVisBtn = document.getElementById('btn-open-vis');
    this.closeVisBtn = document.getElementById('btn-close-vis');
    this.visTrackTitle = document.getElementById('vis-track-title');
    this.visTrackArtist = document.getElementById('vis-track-artist');
    this.visModeBtns = document.querySelectorAll('.vis-mode-btn');

    // Equalizer Elements
    this.eqModal = document.getElementById('eq-modal');
    this.openEqBtn = document.getElementById('btn-open-eq');
    this.closeEqBtn = document.getElementById('btn-close-eq');
    this.eqPresetBtns = document.querySelectorAll('.eq-preset-btn');
    this.eqSlidersContainer = document.getElementById('eq-sliders-grid');

    // Queue Elements
    this.queuePanel = document.getElementById('queue-panel');
    this.openQueueBtn = document.getElementById('btn-open-queue');
    this.closeQueueBtn = document.getElementById('btn-close-queue');
    this.queueListEl = document.getElementById('queue-items-list');
    this.clearQueueBtn = document.getElementById('btn-clear-queue');

    // Sleep Timer Elements
    this.sleepBtn = document.getElementById('btn-sleep-timer');
    this.sleepBadge = document.getElementById('sleep-timer-badge');
    this.sleepModal = document.getElementById('sleep-modal');
    this.closeSleepBtn = document.getElementById('btn-close-sleep');

    // Custom Stream Modal Elements
    this.customStreamModal = document.getElementById('custom-stream-modal');
    this.openCustomStreamBtn = document.getElementById('btn-open-custom-stream');
    this.closeCustomStreamBtn = document.getElementById('btn-close-custom-stream');
    this.customStreamForm = document.getElementById('custom-stream-form');

    // Setup EQ Sliders DOM
    this.buildEqSliders();
  }

  initVisualizer() {
    this.visualizer = new AudioVisualizer(this.visCanvas, this.player);
    this.visualizer.start();
  }

  bindEvents() {
    // View navigation
    this.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetView = item.dataset.view;
        if (targetView) this.switchView(targetView);
      });
    });

    // Genre pills
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

    // Search input with debounce
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

    // Player Bar Controls
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

    // Progress bar scrub
    this.progressBar.addEventListener('input', (e) => {
      const percent = parseFloat(e.target.value) / 100;
      this.player.seek(percent);
    });

    // Volume Slider & Mute
    this.volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value) / 100;
      this.player.setVolume(vol);
      this.updateVolumeIcon(vol, false);
    });

    this.muteBtn.addEventListener('click', () => {
      const isMuted = this.player.toggleMute();
      this.updateVolumeIcon(this.player.volume, isMuted);
    });

    // Visualizer modal open/close
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

    // Equalizer modal open/close
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

    // Queue Panel
    this.openQueueBtn.addEventListener('click', () => this.queuePanel.classList.toggle('active'));
    this.closeQueueBtn.addEventListener('click', () => this.queuePanel.classList.remove('active'));
    this.clearQueueBtn.addEventListener('click', () => this.player.clearQueue());

    // Sleep Timer Modal
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

    // Custom Stream Modal
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

    // Close modals when clicking backdrop
    [this.eqModal, this.sleepModal, this.customStreamModal].forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
      });
    });

    // Radio quick search
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

      // Highlight playing card or table row
      document.querySelectorAll('.music-card, .track-row, .station-card').forEach(el => {
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

    this.player.onQueueUpdate = (queue, currentIndex) => {
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
        html += `<div class="cards-grid" id="search-radio-grid"></div>`;
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

        // Deselect presets
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
      // Don't trigger shortcuts if typing inside an input field
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

// Instantiate once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.SoundPulse = new SoundPulseApp();
});
