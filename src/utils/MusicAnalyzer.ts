export class MusicAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private isAnalyzing = false;
  private animationFrame: number | null = null;

  constructor(private onMusicData: (musicData: MusicData) => void) {}

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      
      // Configure analyser for musical analysis
      this.analyser.fftSize = 8192; // Higher resolution for better pitch detection
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.isAnalyzing = true;
      this.analyze();
    } catch (error) {
      console.error('Error starting music analysis:', error);
      throw error;
    }
  }

  private analyze() {
    if (!this.analyser || !this.isAnalyzing) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatFrequencyData(dataArray);

    const musicData = this.extractMusicFeatures(dataArray);
    this.onMusicData(musicData);

    this.animationFrame = requestAnimationFrame(() => this.analyze());
  }

  private extractMusicFeatures(frequencyData: Float32Array): MusicData {
    const sampleRate = this.audioContext?.sampleRate || 44100;
    const nyquist = sampleRate / 2;
    const fundamentalFreq = this.findFundamentalFrequency(frequencyData, nyquist);
    
    return {
      fundamentalFrequency: fundamentalFreq,
      note: this.frequencyToNote(fundamentalFreq),
      amplitude: this.getAmplitude(frequencyData),
      harmonics: this.analyzeHarmonics(frequencyData, fundamentalFreq, nyquist),
      spectralCentroid: this.getSpectralCentroid(frequencyData, nyquist),
      tempo: this.estimateTempo(frequencyData),
      key: this.estimateKey(frequencyData, nyquist),
      chords: this.detectChords(frequencyData, nyquist)
    };
  }

  private findFundamentalFrequency(frequencyData: Float32Array, nyquist: number): number {
    let maxPower = -Infinity;
    let fundamentalFreq = 0;
    
    // Focus on musical range (80Hz to 2000Hz)
    const minBin = Math.floor((80 / nyquist) * frequencyData.length);
    const maxBin = Math.floor((2000 / nyquist) * frequencyData.length);
    
    for (let i = minBin; i < maxBin; i++) {
      if (frequencyData[i] > maxPower) {
        maxPower = frequencyData[i];
        fundamentalFreq = (i / frequencyData.length) * nyquist;
      }
    }
    
    return fundamentalFreq;
  }

  private frequencyToNote(frequency: number): string {
    if (frequency < 80) return '';
    
    const A4 = 440;
    const semitone = Math.round(12 * Math.log2(frequency / A4));
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor((semitone + 57) / 12);
    const noteIndex = ((semitone + 57) % 12 + 12) % 12;
    
    return `${noteNames[noteIndex]}${octave}`;
  }

  private getAmplitude(frequencyData: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += Math.pow(10, frequencyData[i] / 10);
    }
    return Math.sqrt(sum / frequencyData.length);
  }

  private analyzeHarmonics(frequencyData: Float32Array, fundamental: number, nyquist: number): number[] {
    const harmonics = [];
    
    for (let harmonic = 2; harmonic <= 8; harmonic++) {
      const harmonicFreq = fundamental * harmonic;
      if (harmonicFreq > nyquist) break;
      
      const bin = Math.round((harmonicFreq / nyquist) * frequencyData.length);
      if (bin < frequencyData.length) {
        harmonics.push(Math.pow(10, frequencyData[bin] / 10));
      }
    }
    
    return harmonics;
  }

  private getSpectralCentroid(frequencyData: Float32Array, nyquist: number): number {
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < frequencyData.length; i++) {
      const magnitude = Math.pow(10, frequencyData[i] / 10);
      const frequency = (i / frequencyData.length) * nyquist;
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  private estimateTempo(frequencyData: Float32Array): number {
    // Simplified tempo estimation based on energy in low frequencies
    const bassEnergy = frequencyData.slice(0, 50).reduce((sum, val) => sum + Math.pow(10, val / 10), 0);
    return Math.round(bassEnergy * 120); // Very basic tempo estimation
  }

  private estimateKey(frequencyData: Float32Array, nyquist: number): string {
    const chromaVector = new Array(12).fill(0);
    
    // Calculate chroma features
    for (let i = 0; i < frequencyData.length; i++) {
      const frequency = (i / frequencyData.length) * nyquist;
      if (frequency > 80 && frequency < 2000) {
        const note = Math.round(12 * Math.log2(frequency / 440)) % 12;
        const normalizedNote = ((note % 12) + 12) % 12;
        chromaVector[normalizedNote] += Math.pow(10, frequencyData[i] / 10);
      }
    }
    
    // Find dominant note
    const maxIndex = chromaVector.indexOf(Math.max(...chromaVector));
    const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
    return noteNames[maxIndex];
  }

  private detectChords(frequencyData: Float32Array, nyquist: number): string[] {
    const notes = [];
    const threshold = -40; // dB threshold for note detection
    
    // Detect prominent frequencies
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > threshold) {
        const frequency = (i / frequencyData.length) * nyquist;
        if (frequency > 80 && frequency < 2000) {
          const note = this.frequencyToNote(frequency);
          if (note && !notes.includes(note.slice(0, -1))) { // Remove octave for chord detection
            notes.push(note.slice(0, -1));
          }
        }
      }
    }
    
    return notes.slice(0, 6); // Limit to 6 most prominent notes
  }

  stop() {
    this.isAnalyzing = false;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}

export interface MusicData {
  fundamentalFrequency: number;
  note: string;
  amplitude: number;
  harmonics: number[];
  spectralCentroid: number;
  tempo: number;
  key: string;
  chords: string[];
}