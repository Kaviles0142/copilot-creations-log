import * as THREE from 'three';

export class TalkingHead {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private head: THREE.Mesh | null = null;
  private mouth: THREE.Mesh | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationId: number | null = null;

  constructor(private container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    this.camera.position.z = 5;
    this.setupLighting();
    this.createAvatar();
    this.animate();

    // Handle window resize
    window.addEventListener('resize', this.handleResize);
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    this.scene.add(directionalLight);
  }

  private createAvatar() {
    // Create head
    const headGeometry = new THREE.SphereGeometry(1, 32, 32);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffdbac,
      shininess: 30
    });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.scene.add(this.head);

    // Create eyes
    const eyeGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.3, 0.3, 0.8);
    this.head.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.3, 0.3, 0.8);
    this.head.add(rightEye);

    // Create mouth
    const mouthGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.1);
    const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
    this.mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    this.mouth.position.set(0, -0.3, 0.9);
    this.head.add(this.mouth);
  }

  private handleResize = () => {
    if (!this.container) return;
    
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);

    // Animate based on audio if available
    if (this.analyser && this.mouth) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const normalizedVolume = average / 255;
      
      // Animate mouth based on volume
      this.mouth.scale.y = 0.1 + normalizedVolume * 2;
      
      // Slight head bob
      if (this.head) {
        this.head.rotation.y = Math.sin(Date.now() * 0.001) * 0.1;
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  async speak(audioUrl: string) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Fetch and decode audio
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      // Create audio source
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Create analyser for lip-sync
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      // Play audio
      source.start(0);

      // Reset mouth when done
      source.onended = () => {
        if (this.mouth) {
          this.mouth.scale.y = 1;
        }
        this.analyser = null;
      };
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }

  async speakFromBase64(base64Audio: string) {
    try {
      // Convert base64 to blob URL
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      await this.speak(url);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Error playing base64 audio:', error);
    }
  }

  setAvatarImage(imageUrl: string) {
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(imageUrl, (texture) => {
      if (this.head) {
        (this.head.material as THREE.MeshPhongMaterial).map = texture;
        (this.head.material as THREE.MeshPhongMaterial).needsUpdate = true;
      }
    });
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
    
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
    }
    
    if (this.audioContext) {
      this.audioContext.close();
    }
    
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
    
    this.renderer.dispose();
  }
}
