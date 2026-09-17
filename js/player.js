/**
 * SoundPulse - Audio Player Engine
 * Powered by HTML5 Audio, Web Audio API, 10-Band EQ, and MediaSession.
 */

import { Storage } from './storage.js';

export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS = {
  'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  'Bass Boost': [6, 5.5, 4.5, 3, 1, 0, 0, 0, 0, 0],
  'Treble Boost': [0, 0, 0, 0, 0, 1, 2.5, 4, 5.5, 6],
  'Vocal': [-2, -2, -1, 2, 4.5, 4, 3, 1.5, 0, -1],
  'Electronic': [5, 4.5, 2, 0, -1.5, 1.5, 3, 4, 4.5, 5],
  'Rock': [4.5, 3.5, -1, -2, -1, 1, 3, 4, 4.5, 4.5],
  'Pop': [-1.5, 1, 2.5, 3.5, 3, 1.5, 0, 1, 2.5, 3],
  'Lo-Fi': [3, 2, 0, -2, -1, 0, 1, -2, -5, -8]
};

export class AudioEngine {
  constructor() {
    this.audio = new Audio();
    this.audio.crossOrigin = 'anonymous';
    this.audio.preload = 'metadata';

    this.queue = [];
    this.currentIndex = -1;
    this.currentTrack = null;

    // Playback modes
    const settings = Storage.getSettings();
    this.shuffle = settings.shuffle || false;
    this.repeat = settings.repeat || 'off'; // 'off', 'all', 'one'
    this.volume = settings.volume !== undefined ? settings.volume : 0.8;
    this.audio.volume = this.volume;

    // Web Audio API components
    this.audioCtx = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.eqFilters = [];
    this.isWebAudioInitialized = false;

    // Sleep timer state
    this.sleepTimerId = null;
    this.sleepEndTime = null;

    // Callbacks
    this.onTrackChange = null;
    this.onStateChange = null;
    this.onTimeUpdate = null;
    this.onQueueUpdate = null;
    this.onSleepTimerTick = null;

    this.initAudioEvents();
    this.initMediaSession();
  }

  // Lazy-initialize Web Audio Context on first user interaction
  initWebAudio() {
    if (this.isWebAudioInitialized) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();

      // Master Gain
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // Realtime Analyser for Visualizer
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.82;

      // 10-Band Graphic Equalizer filters
      this.eqFilters = EQ_BANDS.map(freq => {
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.4;
        filter.gain.value = 0;
        return filter;
      });

      // Connect HTML5 Audio Source
      try {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);

        // Chain: Source -> EQ Filter 0 -> ... -> EQ Filter 9 -> Gain -> Analyser -> Destination
        let prevNode = this.sourceNode;
        this.eqFilters.forEach(filter => {
          prevNode.connect(filter);
          prevNode = filter;
        });

        prevNode.connect(this.gainNode);
        this.gainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioCtx.destination);
      } catch (corsErr) {
        console.warn('Audio cross-origin source connection fallback:', corsErr);
      }

      this.isWebAudioInitialized = true;

      // Restore saved EQ preset
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
      console.warn('Playback stream error:', e);
      // If live radio drops or track link expires, notify or attempt next
      if (this.onStateChange) {
        this.onStateChange({ isPlaying: false, error: 'Playback stream unavailable' });
      }
    });
  }

  // Load a track or station and start playback
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
      this.audio.play().catch(e => console.warn('Play error:', e));
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

    // If more than 3 seconds in, restart track
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

    // Check if sleep timer set for end of track
    if (this.sleepMode === 'end_of_track') {
      this.cancelSleepTimer();
      this.audio.pause();
      return;
    }

    this.next();
  }

  seek(percent) {
    if (this.currentTrack && this.currentTrack.isLive) return; // Live stations cannot seek
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

  // Queue Operations
  addToQueue(track) {
    this.queue.push(track);
    if (this.onQueueUpdate) this.onQueueUpdate(this.queue, this.currentIndex);
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

  // Equalizer Controls
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

  // Sleep Timer
  setSleepTimer(minutes) {
    this.cancelSleepTimer();

    if (minutes === 'end_of_track') {
      this.sleepMode = 'end_of_track';
      if (this.onSleepTimerTick) this.onSleepTimerTick('End of Song');
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
    // 4-second soft fade out
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

  // MediaSession API Integration
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
      artwork: [
        { src: track.artwork, sizes: '512x512', type: 'image/jpeg' }
      ]
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
