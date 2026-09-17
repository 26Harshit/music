/**
 * SoundPulse - Canvas Audio Visualizer
 * Supports Spectrum Bars, Neon Waveform, and Radial Frequency Pulse.
 */

export class AudioVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.engine = audioEngine;

    this.mode = 'bars'; // 'bars' | 'waveform' | 'radial'
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

    // Dark clear with trailing fade effect
    ctx.fillStyle = 'rgba(6, 8, 14, 0.28)';
    ctx.fillRect(0, 0, width, height);

    // Fetch FFT data if Web Audio Analyser is ready
    let freqData = null;
    let timeData = null;
    let isLiveAudio = false;

    if (this.engine.analyserNode && !this.engine.audio.paused) {
      const bufferLength = this.engine.analyserNode.frequencyBinCount;
      freqData = new Uint8Array(bufferLength);
      timeData = new Uint8Array(bufferLength);
      this.engine.analyserNode.getByteFrequencyData(freqData);
      this.engine.analyserNode.getByteTimeDomainData(timeData);

      // Verify if we actually have non-zero signal (or CORS fallback)
      const sum = freqData.reduce((acc, val) => acc + val, 0);
      if (sum > 10) {
        isLiveAudio = true;
      }
    }

    // Synthesize organic idle / fallback wave if audio is playing but analyser has no direct hook
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

    // Draw ambient floating particles
    this.drawParticles();

    // Render mode
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

      // Peak drop tracking
      if (!this.peaks[i] || barHeight > this.peaks[i]) {
        this.peaks[i] = barHeight;
      } else {
        this.peaks[i] = Math.max(0, this.peaks[i] - 1.5);
      }

      // Dynamic electric gradient
      const grad = ctx.createLinearGradient(0, y, 0, height);
      grad.addColorStop(0, '#06b6d4');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#ec4899');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();

      // Peak line
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
    ctx.shadowBlur = 0; // reset
  }

  drawRadial(data) {
    const { ctx, width, height } = this;
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.22;
    const barCount = 72;
    const angleStep = (Math.PI * 2) / barCount;

    // Glowing inner aura
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
