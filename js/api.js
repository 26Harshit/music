/**
 * SoundPulse - API Module
 * Integrates with Audius Decentralized Music Network and Radio Browser Network.
 * 100% Free, No ads, No API keys required.
 */

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

// Fallback curated ad-free live streams for immediate playback
export const CURATED_STATIONS = [
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

export const MusicAPI = {
  appName: 'SoundPulseMusicApp',

  // Normalizes an Audius track item into unified player track format
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
      artistHandle: item.user ? item.user.handle : '',
      artwork: artwork,
      streamUrl: streamUrl,
      duration: item.duration || 0,
      genre: item.genre || 'Various',
      mood: item.mood || '',
      playCount: item.play_count || 0,
      isLive: false,
      source: 'Audius'
    };
  },

  // Fetch Trending Tracks from Audius
  async getTrending(genre = '', limit = 30) {
    try {
      let url = `${currentAudiusNode}/v1/tracks/trending?app_name=${this.appName}&limit=${limit}`;
      if (genre && genre !== 'All') {
        url += `&genre=${encodeURIComponent(genre)}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Trending fetch failed: ${res.status}`);
      const data = await res.json();

      if (data && Array.isArray(data.data)) {
        return data.data.map(track => this.formatAudiusTrack(track));
      }
      return [];
    } catch (err) {
      console.warn('Primary Audius node failed, trying secondary node...', err);
      // Failover to secondary node
      currentAudiusNode = AUDIUS_DISCOVERY_NODES[1];
      try {
        let url = `${currentAudiusNode}/v1/tracks/trending?app_name=${this.appName}&limit=${limit}`;
        if (genre && genre !== 'All') url += `&genre=${encodeURIComponent(genre)}`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.data || []).map(track => this.formatAudiusTrack(track));
      } catch (err2) {
        console.error('All Audius nodes failed:', err2);
        return [];
      }
    }
  },

  // Search online tracks by query
  async searchTracks(query, limit = 30) {
    if (!query || !query.trim()) return [];
    try {
      const url = `${currentAudiusNode}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${this.appName}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      return (data.data || []).map(track => this.formatAudiusTrack(track));
    } catch (err) {
      console.error('Track search error:', err);
      return [];
    }
  },

  // Radio Browser API: Get Top Stations
  async getTopRadioStations(limit = 24) {
    try {
      const url = `${currentRadioNode}/json/stations/topclick/${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Radio fetch failed: ${res.status}`);
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
        codec: item.codec || 'MP3',
        isLive: true,
        source: 'Radio'
      }));

      // Merge curated high quality stations at front
      return [...CURATED_STATIONS, ...stations];
    } catch (err) {
      console.warn('Radio Browser query failed, using curated stations:', err);
      return CURATED_STATIONS;
    }
  },

  // Search Radio Stations by Tag or Name
  async searchRadioStations(query, limit = 20) {
    if (!query || !query.trim()) return [];
    try {
      const url = `${currentRadioNode}/json/stations/search?name=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Radio search failed: ${res.status}`);
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
      console.error('Radio search error:', err);
      return [];
    }
  }
};
