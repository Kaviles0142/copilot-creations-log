import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import VoiceCloningManager from '@/components/VoiceCloningManager';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Send, User, Bot, Volume2, VolumeX, Mic, MicOff, Save, RefreshCw, Guitar, Globe, Square, Pause, RotateCcw, Play } from "lucide-react";
import HistoricalFigureSearch from "./HistoricalFigureSearch";
import ChatMessages from "./ChatMessages";
import FileUpload from "./FileUpload";
import FigureList from "./FigureList";
import DocumentUpload from "./DocumentUpload";
import ConversationExport from "./ConversationExport";
import FigureRecommendations from "./FigureRecommendations";
import ConversationHistory from "./ConversationHistory";
import RealisticAvatar from "./RealisticAvatar";

import MusicVoiceInterface from "./MusicVoiceInterface";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { clearFigureMetadata } from "@/utils/clearCache";
import { useVideoPreloader } from "@/hooks/useVideoPreloader";
import { getFigureContext } from "@/utils/figureContextMapper";

export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  speakerName?: string;
  sourcesUsed?: {
    books: number;
    documents: number;
    youtube: number;
    wikipedia: boolean;
    currentEvents: number;
    historicalContext: number;
    webArticles: number;
  };
  aiProvider?: string;
  model?: string;
  fallbackUsed?: boolean;
}

export interface HistoricalFigure {
  id: string;
  name: string;
  period: string;
  description: string;
  avatar: string;
}

interface UploadedDocument {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  parsed_content: string | null;
  created_at: string;
}

interface BookInfo {
  id: string;
  title: string;
  authors: string[];
  description: string | null;
  published_date: string | null;
  page_count: number | null;
  categories: string[];
  book_type: 'by_figure' | 'about_figure' | 'related';
}

const HistoricalChat = () => {
  console.log("HistoricalChat component loading...");
  const [selectedFigure, setSelectedFigure] = useState<HistoricalFigure | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationType, setConversationType] = useState<'casual' | 'educational' | 'debate' | 'philosophical' | 'theological'>('casual');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTranscript, setRecordingTranscript] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [books, setBooks] = useState<BookInfo[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [showMusicInterface, setShowMusicInterface] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState<'kimi-k2' | 'openai' | 'grok' | 'claude' | 'lovable-ai'>('kimi-k2'); // Kimi K2 as default (matches backend priority)
  const [isVoiceChatting, setIsVoiceChatting] = useState(false);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true); // Auto-enable voice responses
  // Removed: responseLanguage now uses selectedLanguage for both text and speech
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("auto"); // Track voice selection from VoiceSettings
  const [isGreetingPlaying, setIsGreetingPlaying] = useState(false); // Track if greeting is playing
  
  // Realistic avatar state
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(null);
  const [isLoadingAvatarImage, setIsLoadingAvatarImage] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [greetingAudioUrl, setGreetingAudioUrl] = useState<string | null>(null); // For audio fallback
  const [greetingText, setGreetingText] = useState<string | null>(null); // Text for K2 animation
  
  // Video state - external video generation like PodcastMode
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  
  // K2 Animation state
  const [animationFrames, setAnimationFrames] = useState<Array<{frameNumber: number; imageUrl: string; speechSegment: string}> | null>(null);
  
  // pendingResponse removed - now showing messages immediately while video generates
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null); // Changed to ref for immediate updates
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const currentVideoRef = useRef<HTMLVideoElement | null>(null);
  
  const { toast } = useToast();
  
  // K2 Animation generator hook
  const { generateK2Animation, clearCache: clearVideoCache } = useVideoPreloader();

  // Auto-select Australian English voice for Elon Musk
  useEffect(() => {
    if (selectedFigure && 
        (selectedFigure.id === 'elon-musk' || selectedFigure.name.toLowerCase().includes('elon musk')) &&
        selectedVoiceId === 'auto') {
      setSelectedVoiceId('en-AU-WilliamNeural');
      console.log('🎙️ Auto-selected Australian English for Elon Musk');
    }
  }, [selectedFigure]);

  // DEBUG: Watch isSpeaking state changes
  useEffect(() => {
    console.log('🎤🎤🎤 isSpeaking changed to:', isSpeaking);
  }, [isSpeaking]);

  // Initialize speech recognition with enhanced settings
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsListening(true);
        setIsRecording(true);
        setRecordingTranscript("");
        console.log('Voice recognition started in', selectedLanguage);
      };
      
      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        setRecordingTranscript(interimTranscript);

        if (finalTranscript) {
          setInputMessage(prev => prev + finalTranscript + ' ');
          setRecordingTranscript("");
        }
        
        console.log('Speech recognition result:', finalTranscript || interimTranscript);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsRecording(false);
        setRecordingTranscript("");
        
        if (event.error === 'no-speech') {
          console.log('No speech detected, stopping recognition');
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setIsRecording(false);
        setRecordingTranscript("");
        console.log('Voice recognition ended');
      };
      
      setRecognition(recognition);
    }
  }, [selectedLanguage]);

  // Clear avatar cache on component mount
  useEffect(() => {
    const clearCache = async () => {
      console.log('🧹 Clearing avatar cache on mount...');
      try {
        await supabase.functions.invoke('clear-avatar-cache');
        console.log('✅ Avatar cache cleared successfully');
      } catch (error) {
        console.error('Failed to clear avatar cache:', error);
      }
    };
    clearCache();
  }, []);

  // Initialize speech synthesis voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices);
  };

    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Auto-create authentic voice when figure is selected
  const voiceCreatedForFigure = useRef<string | null>(null);
  
  useEffect(() => {
    if (selectedFigure && voiceCreatedForFigure.current !== selectedFigure.id) {
      voiceCreatedForFigure.current = selectedFigure.id;
      // Removed auto-language switching - user's language selection takes priority
      
      // Generate static avatar portrait and play greeting (ONLY Azure TTS, no Resemble)
      generateAvatarPortraitAndGreeting(selectedFigure);
    }
  }, [selectedFigure]);
  
  // Generate avatar portrait and play greeting (K2 animation)
  const generateAvatarPortraitAndGreeting = async (figure: HistoricalFigure) => {
    console.log('🎨 Generating avatar portrait and greeting for:', figure.name);
    setIsLoadingAvatarImage(true);
    setIsGreetingPlaying(true);
    setCurrentVideoUrl(null);
    setAnimationFrames(null);
    setGreetingText(null);
    
    try {
      const greeting = getGreetingForFigure(figure);
      setGreetingText(greeting);
      
      // Get contextual setting for this figure (e.g., Einstein in a lab, Lincoln in Oval Office)
      const figureContext = getFigureContext(figure.name);
      console.log(`🎨 Using context for ${figure.name}: ${figureContext}`);
      
      // Generate avatar portrait and greeting audio IN PARALLEL
      const [avatarResult, audioResult] = await Promise.all([
        supabase.functions.invoke('generate-avatar-portrait', {
          body: {
            figureName: figure.name,
            figureId: figure.id,
            context: figureContext
          }
        }),
        supabase.functions.invoke('azure-text-to-speech', {
          body: {
            text: greeting,
            figure_name: figure.name,
            figure_id: figure.id,
            voice: selectedVoiceId === 'auto' ? 'auto' : selectedVoiceId,
            language: selectedLanguage
          }
        })
      ]);

      if (avatarResult.error) throw avatarResult.error;
      if (audioResult.error) throw audioResult.error;

      console.log('✅ Avatar portrait ready:', avatarResult.data.cached ? '(cached)' : '(new)');
      console.log('🎤 Greeting audio ready');
      
      const imageUrl = avatarResult.data.imageUrl;
      setAvatarImageUrl(imageUrl);
      setIsLoadingAvatarImage(false);
      
      if (!audioResult.data?.audioContent) {
        throw new Error('No audio content received from Azure TTS');
      }

      // Store data URL for audio fallback
      const greetingDataUrl = `data:audio/mpeg;base64,${audioResult.data.audioContent}`;
      setGreetingAudioUrl(greetingDataUrl);
      
      // Generate K2 animation frames
      console.log('🎬 Generating K2 animation frames...');
      setIsGeneratingVideo(true);
      
      const animationResult = await generateK2Animation(imageUrl, greeting, figure.id, figure.name);
      
      setIsGeneratingVideo(false);
      
      if (animationResult.frames && animationResult.frames.length > 0) {
        console.log(`✅ K2 animation ready: ${animationResult.frames.length} frames`);
        setAnimationFrames(animationResult.frames);
        // Audio will be played by RealisticAvatar when it receives frames
      } else if (animationResult.videoUrl) {
        // Legacy video support
        console.log('✅ Video ready:', animationResult.videoUrl.substring(0, 60) + '...');
        setCurrentVideoUrl(animationResult.videoUrl);
        setGreetingAudioUrl(null);
      } else {
        console.log('⚠️ Animation generation failed, will use audio fallback');
        // Play audio with static image
        playAudioFallback(greetingDataUrl);
      }
      
    } catch (error) {
      console.error('❌ Error in avatar/greeting:', error);
      toast({
        title: "Setup Complete",
        description: "You can now start chatting",
        variant: "default",
      });
      setIsGreetingPlaying(false);
      setIsGeneratingVideo(false);
    }
  };
  
  // Helper to play audio when video fails
  const playAudioFallback = async (audioDataUrl: string) => {
    console.log('🎤 Playing audio fallback (no video)');

    initializeAudioPipeline();
    if (audioContextRef.current!.state === 'suspended') {
      await audioContextRef.current!.resume();
    }

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }

    audioElementRef.current!.onplay = () => {
      setIsSpeaking(true);
      setIsPlayingAudio(true);
    };

    audioElementRef.current!.onended = () => {
      setIsSpeaking(false);
      setIsPlayingAudio(false);
      setCurrentAudio(null);
      setIsGreetingPlaying(false);
    };

    audioElementRef.current!.onerror = () => {
      setIsSpeaking(false);
      setIsPlayingAudio(false);
      setIsGreetingPlaying(false);
    };

    audioElementRef.current!.src = audioDataUrl;
    setCurrentAudio(audioElementRef.current!);
    audioElementRef.current!.load();
    await audioElementRef.current!.play();
  };
  
  // Get appropriate greeting for historical figure in selected language
  const getGreetingForFigure = (figure: HistoricalFigure): string => {
    const languageGreetings: Record<string, string[]> = {
      'en-US': [
        `Greetings! I am ${figure.name}. What would you like to discuss?`,
        `Hello! ${figure.name} here. How may I enlighten you today?`,
        `Welcome! I'm ${figure.name}. What questions do you have for me?`,
        `Salutations! I am ${figure.name}. What shall we speak of?`,
      ],
      'es-ES': [
        `¡Saludos! Soy ${figure.name}. ¿De qué te gustaría hablar?`,
        `¡Hola! ${figure.name} aquí. ¿Cómo puedo iluminarte hoy?`,
        `¡Bienvenido! Soy ${figure.name}. ¿Qué preguntas tienes para mí?`,
        `¡Saludos! Soy ${figure.name}. ¿De qué hablaremos?`,
      ],
      'fr-FR': [
        `Salutations! Je suis ${figure.name}. De quoi aimeriez-vous discuter?`,
        `Bonjour! ${figure.name} ici. Comment puis-je vous éclairer aujourd'hui?`,
        `Bienvenue! Je suis ${figure.name}. Quelles questions avez-vous pour moi?`,
        `Salutations! Je suis ${figure.name}. De quoi allons-nous parler?`,
      ],
      'de-DE': [
        `Grüße! Ich bin ${figure.name}. Worüber möchten Sie sprechen?`,
        `Hallo! ${figure.name} hier. Wie kann ich Sie heute erleuchten?`,
        `Willkommen! Ich bin ${figure.name}. Welche Fragen haben Sie an mich?`,
        `Grüße! Ich bin ${figure.name}. Worüber werden wir sprechen?`,
      ],
      'it-IT': [
        `Saluti! Sono ${figure.name}. Di cosa vorresti discutere?`,
        `Ciao! ${figure.name} qui. Come posso illuminarti oggi?`,
        `Benvenuto! Sono ${figure.name}. Che domande hai per me?`,
        `Saluti! Sono ${figure.name}. Di cosa parleremo?`,
      ],
      'pt-PT': [
        `Saudações! Sou ${figure.name}. Do que gostaria de falar?`,
        `Olá! ${figure.name} aqui. Como posso iluminá-lo hoje?`,
        `Bem-vindo! Sou ${figure.name}. Que perguntas tem para mim?`,
        `Saudações! Sou ${figure.name}. Do que vamos falar?`,
      ],
      'nl-NL': [
        `Gegroet! Ik ben ${figure.name}. Waarover wilt u praten?`,
        `Hallo! ${figure.name} hier. Hoe kan ik u vandaag verlichten?`,
        `Welkom! Ik ben ${figure.name}. Welke vragen heeft u voor mij?`,
        `Gegroet! Ik ben ${figure.name}. Waarover gaan we praten?`,
      ],
      'pl-PL': [
        `Pozdrowienia! Jestem ${figure.name}. O czym chciałbyś porozmawiać?`,
        `Cześć! ${figure.name} tutaj. Jak mogę cię dzisiaj oświecić?`,
        `Witaj! Jestem ${figure.name}. Jakie masz do mnie pytania?`,
        `Pozdrowienia! Jestem ${figure.name}. O czym będziemy rozmawiać?`,
      ],
      'ru-RU': [
        `Приветствую! Я ${figure.name}. О чем вы хотели бы поговорить?`,
        `Здравствуйте! ${figure.name} здесь. Как я могу просветить вас сегодня?`,
        `Добро пожаловать! Я ${figure.name}. Какие у вас вопросы ко мне?`,
        `Приветствую! Я ${figure.name}. О чем мы будем говорить?`,
      ],
      'ja-JP': [
        `ご挨拶！私は${figure.name}です。何について話し合いたいですか？`,
        `こんにちは！${figure.name}です。今日はどのようにお役に立てますか？`,
        `ようこそ！私は${figure.name}です。私に何か質問がありますか？`,
        `ご挨拶！私は${figure.name}です。何について話しましょうか？`,
      ],
      'zh-CN': [
        `您好！我是${figure.name}。您想讨论什么？`,
        `你好！${figure.name}在此。我今天能为您提供什么启发？`,
        `欢迎！我是${figure.name}。您有什么问题要问我？`,
        `您好！我是${figure.name}。我们要谈什么？`,
      ],
      'ko-KR': [
        `안녕하세요! 저는 ${figure.name}입니다. 무엇에 대해 이야기하고 싶으신가요?`,
        `안녕하세요! ${figure.name}입니다. 오늘 어떻게 도와드릴까요?`,
        `환영합니다! 저는 ${figure.name}입니다. 저에게 무슨 질문이 있으신가요?`,
        `안녕하세요! 저는 ${figure.name}입니다. 무엇에 대해 이야기할까요?`,
      ],
      'ar-SA': [
        `تحياتي! أنا ${figure.name}. ماذا تريد أن تناقش؟`,
        `مرحبا! ${figure.name} هنا. كيف يمكنني أن أنيرك اليوم؟`,
        `أهلا بك! أنا ${figure.name}. ما هي أسئلتك لي؟`,
        `تحياتي! أنا ${figure.name}. عن ماذا سنتحدث؟`,
      ],
      'hi-IN': [
        `नमस्ते! मैं ${figure.name} हूं। आप किस बारे में चर्चा करना चाहेंगे?`,
        `नमस्कार! ${figure.name} यहां। आज मैं आपको कैसे प्रबुद्ध कर सकता हूं?`,
        `स्वागत है! मैं ${figure.name} हूं। मेरे लिए आपके क्या सवाल हैं?`,
        `नमस्ते! मैं ${figure.name} हूं। हम किस बारे में बात करेंगे?`,
      ],
    };
    
    const greetings = languageGreetings[selectedLanguage] || languageGreetings['en-US'];
    return greetings[Math.floor(Math.random() * greetings.length)];
  };

  // Initialize audio pipeline (centralizes audio setup)
  const initializeAudioPipeline = () => {
    // Initialize audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🎧 AudioContext created, state:', audioContextRef.current.state);
    }
    
    // Resume AudioContext if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
      console.log('▶️ AudioContext resumed');
    }
    
    // Create analyser once
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
      console.log('📊 Analyser created');
    }
    
    // Create audio element ONCE (reuse for all playback)
    if (!audioElementRef.current) {
      audioElementRef.current = new Audio();
      audioElementRef.current.crossOrigin = 'anonymous';
      console.log('🔊 Audio element created (will be reused)');
    }
    
    // Create source node ONLY ONCE after element exists
    if (!sourceNodeRef.current && audioElementRef.current) {
      sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioElementRef.current);
      sourceNodeRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
      console.log('✅ Audio pipeline connected: Element -> Source -> Analyser -> Destination');
    }
  };

  // Generate and play TTS audio with avatar animation
  const generateAndPlayTTS = async (text: string) => {
    if (!selectedFigure) return;
    
    try {
      console.log('🎤 Generating Azure TTS for:', selectedFigure.name);
      
      // Use Azure TTS directly
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: {
          text: text,
          figure_name: selectedFigure.name,
          figure_id: selectedFigure.id,
          voice: selectedVoiceId === 'auto' ? 'auto' : selectedVoiceId,
          language: selectedLanguage
        }
      });

      if (error) throw error;

      if (!data?.audioContent) {
        throw new Error('No audio content received from Azure TTS');
      }

      // Initialize audio pipeline FIRST
      initializeAudioPipeline();
      
      // Ensure context is running
      if (audioContextRef.current!.state === 'suspended') {
        await audioContextRef.current!.resume();
      }
      
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      
      // CRITICAL: Attach event handlers BEFORE setting src
      audioElementRef.current!.onplay = () => {
        console.log('▶️ Audio PLAY event fired - Setting isSpeaking = TRUE');
        setIsSpeaking(true);
        setIsPlayingAudio(true);
      };
      
      audioElementRef.current!.onended = () => {
        console.log('⏹️ Audio ENDED event fired - Setting isSpeaking = FALSE');
        setIsSpeaking(false);
        setIsPlayingAudio(false);
        setCurrentAudio(null);
        setIsGreetingPlaying(false);
      };

      audioElementRef.current!.onerror = (err) => {
        console.error('❌ Audio ERROR event fired:', err);
        setIsSpeaking(false);
        setIsPlayingAudio(false);
        toast({
          title: "Audio playback failed",
          description: "Could not play the generated voice",
          variant: "destructive",
        });
      };
      
      audioElementRef.current!.onpause = () => {
        console.log('⏸️ Audio PAUSED');
        setIsSpeaking(false);
      };
      
      // Convert base64 to data URL for audio playback
      const audioDataUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      console.log('🎬 Playing audio directly (video generated externally now)');
      
      // Create blob for audio playback
      const audioBlob = base64ToBlob(data.audioContent, 'audio/mpeg');
      const playbackUrl = URL.createObjectURL(audioBlob);
      
      // Set source AFTER handlers
      audioElementRef.current!.src = playbackUrl;
      setCurrentAudio(audioElementRef.current!);
      
      // Load and play
      audioElementRef.current!.load();
      await audioElementRef.current!.play();
      console.log('🔊 Audio play() called - Context state:', audioContextRef.current!.state);
      
    } catch (error) {
      console.error('❌ Azure TTS generation error:', error);
      setIsSpeaking(false);
      toast({
        title: "Voice generation failed",
        description: "Could not generate voice response from Azure TTS",
        variant: "destructive",
      });
    }
  };

  // Helper function to convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };



  // Get exclusion terms to filter out related but different figures
  const getExcludeTermsForFigure = (figureName: string): string[] => {
    const name = figureName.toLowerCase();
    
    // Map of figures and terms to exclude from their voice searches
    const exclusionMap: Record<string, string[]> = {
      'john f. kennedy': ['robert', 'bobby', 'rfk', 'ted', 'edward'],
      'robert kennedy': ['john f', 'jfk', 'ted', 'edward'],
      'abraham lincoln': ['mary', 'todd'],
      'winston churchill': ['randolph', 'winston jr'],
      // Add more as needed
    };
    
    // Find matching exclusions
    for (const [key, exclusions] of Object.entries(exclusionMap)) {
      if (name.includes(key) || key.includes(name)) {
        return exclusions;
      }
    }
    
    return [];
  };

  const toggleVoiceRecognition = () => {
    if (!recognition) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.lang = selectedLanguage;
      recognition.start();
    }
  };

  // Get native language for historical figure
  const getFigureLanguage = (figure: HistoricalFigure): string => {
    const figureLanguages: Record<string, string> = {
      'winston-churchill': 'en-GB',
      'albert-einstein': 'de-DE',
      'marie-curie': 'fr-FR',
      'leonardo-da-vinci': 'it-IT',
      'cleopatra': 'ar-SA',
      'socrates': 'el-GR',
      'shakespeare': 'en-GB',
      'napoleon': 'fr-FR',
      'abraham-lincoln': 'en-US',
      'julius-caesar': 'la',
      'joan-of-arc': 'fr-FR',
      'galileo': 'it-IT'
    };
    return figureLanguages[figure.id] || 'en-US';
  };

  // Handle current events search using RSS scraper
  const handleCurrentEventsSearch = async (query: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('rss-news-scraper', {
        body: { 
          query: query,
          num: 5
        }
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Current events search error:', error);
      return null;
    }
  };

  // Create new conversation when figure is selected
  const createNewConversation = async (figure: HistoricalFigure) => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          figure_id: figure.id,
          figure_name: figure.name,
          language: selectedLanguage,
          title: `Chat with ${figure.name}`
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentConversationId(data.id);
      return data.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
      return null;
    }
  };

  // Load conversation history
  const loadConversation = async (conversationId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const loadedMessages: Message[] = messagesData?.map(msg => ({
        id: msg.id,
        content: msg.content,
        type: msg.type as "user" | "assistant",
        timestamp: new Date(msg.created_at)
      })) || [];

      setMessages(loadedMessages);

      // Load documents for this conversation
      const { data: docsData, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (docsError) throw docsError;
      setDocuments(docsData || []);

    } catch (error) {
      console.error('Error loading conversation:', error);
      toast({
        title: "Error",
        description: "Failed to load conversation",
        variant: "destructive",
      });
    }
  };

  // Save message to database
  const saveMessage = async (message: Message, conversationId: string) => {
    try {
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content: message.content,
          type: message.type
        });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedFigure || isGreetingPlaying) return;

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(selectedFigure);
      if (!conversationId) return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage,
      type: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setRetryCount(0);

    // Create new abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    await saveMessage(userMessage, conversationId);

    try {
      await processMessageWithRetry(inputMessage, conversationId, controller);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
        return;
      }
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble responding right now. Please try again.",
        type: "assistant", 
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage, conversationId);
      
      // Reset loading state on error
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handlePauseAudio = () => {
    // Pause current audio playback
    if (currentAudio && isPlayingAudio) {
      currentAudio.pause();
      setIsPlayingAudio(false);
      setIsPaused(true);
    }

    // Pause speech synthesis (note: no native pause, so we stop it)
    if ('speechSynthesis' in window && isPlayingAudio && !currentAudio) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
      setIsPaused(true);
    }
    
    console.log('⏸️ Audio paused');
    
    toast({
      title: "Paused",
      description: "Audio playback has been paused",
      duration: 2000,
    });
  };

  const handleResumeAudio = () => {
    // Resume current audio playback
    if (currentAudio && isPaused) {
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
    }

    // Resume speech synthesis
    if ('speechSynthesis' in window && isPaused && !currentAudio) {
      window.speechSynthesis.resume();
      setIsPlayingAudio(true);
      setIsPaused(false);
    }
    
    console.log('▶️ Audio resumed');
  };

  const handleReplayAudio = () => {
    // Replay current audio from beginning
    if (currentAudio) {
      currentAudio.currentTime = 0;
      currentAudio.play();
      setIsPlayingAudio(true);
      setIsPaused(false);
    }

    // For speech synthesis, we need to restart (no native replay)
    if ('speechSynthesis' in window && !currentAudio) {
      window.speechSynthesis.cancel();
      // We would need to re-generate the speech here
      setIsPlayingAudio(false);
      setIsPaused(false);
      
      toast({
        title: "Replay",
        description: "Click the voice button to replay the message",
        duration: 3000,
      });
      return;
    }
    
    console.log('🔄 Audio replayed from beginning');
    
    toast({
      title: "Replaying",
      description: "Audio restarted from the beginning",
      duration: 2000,
    });
  };

  const handleStopGeneration = () => {
    // Stop any ongoing API requests
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    // Complete stop - reset everything (don't pause, actually stop)
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Reset all states to allow new questions
    setIsLoading(false);
    setIsPlayingAudio(false);
    setIsPaused(false);
    setRetryCount(0);
    
    console.log('🛑 Generation completely stopped');
    
    toast({
      title: "Stopped",
      description: "Voice playback stopped. You can now ask a new question.",
      duration: 2000,
    });
  };

  const processMessageWithRetry = async (input: string, conversationId: string, controller?: AbortController, attempt: number = 1): Promise<void> => {
    const maxRetries = 3;
    
    try {
      // Get conversation history for context
      const conversationHistory = messages.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      // Call the AI chat function using Supabase client
      const { data, error } = await supabase.functions.invoke('chat-with-historical-figure', {
        body: {
          message: input,
          figure: selectedFigure,
          context: conversationHistory,
          conversationId: conversationId,
          aiProvider: selectedAIProvider,
          conversationType: conversationType,
          language: selectedLanguage.split('-')[0] // Use language code from selectedLanguage (e.g., 'en' from 'en-US')
        }
      });

      if (error) {
        console.error('AI chat failed:', error);
        throw new Error(`AI chat failed: ${error.message}`);
      }

      const result = data;
      const aiResponse = result.response || result.message || "I apologize, but I couldn't generate a proper response.";
      const usedProvider = result.aiProvider || selectedAIProvider;
      const sourcesUsed = result.sourcesUsed;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: aiResponse,
        type: "assistant",
        timestamp: new Date(),
        sourcesUsed: sourcesUsed,
        aiProvider: usedProvider,
        model: result.model,
        fallbackUsed: result.fallbackUsed
      };

      // Show message IMMEDIATELY, then generate video in parallel
      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage(assistantMessage, conversationId);
      
      // CRITICAL: Set loading to false IMMEDIATELY after message is shown
      // This prevents "thinking..." from appearing while video generates
      setIsLoading(false);
      setAbortController(null);
      
      // Generate TTS and video EXTERNALLY like PodcastMode (message already shown)
      if (aiResponse.length > 20 && isAutoVoiceEnabled && avatarImageUrl) {
        console.log('🎤 IMMEDIATE TTS START for:', selectedFigure!.name);
        setIsGeneratingVideo(true);
        
        try {
          // Generate TTS audio
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('azure-text-to-speech', {
            body: {
              text: aiResponse,
              figure_name: selectedFigure!.name,
              figure_id: selectedFigure!.id,
              voice: selectedVoiceId === 'auto' ? 'auto' : selectedVoiceId,
              language: selectedLanguage
            }
          });

          if (ttsError) throw ttsError;
          if (!ttsData?.audioContent) throw new Error('No audio content received');

          console.log('✅ TTS audio ready, generating K2 animation');
          
          // Create data URL for audio playback
          const audioDataUrl = `data:audio/mpeg;base64,${ttsData.audioContent}`;
          setGreetingAudioUrl(audioDataUrl);
          
          // Generate K2 animation frames
          console.log('🎬 Generating response K2 animation...');
          const animationResult = await generateK2Animation(avatarImageUrl, aiResponse, selectedFigure!.id, selectedFigure!.name);
          
          setIsGeneratingVideo(false);
          
          if (animationResult.frames && animationResult.frames.length > 0) {
            console.log(`✅ Response animation ready: ${animationResult.frames.length} frames`);
            setAnimationFrames(animationResult.frames);
          } else {
            console.log('⚠️ Animation generation failed, playing audio fallback');
            await playAudioFallback(audioDataUrl);
          }
          
        } catch (error) {
          console.error('❌ TTS/Video generation error:', error);
          setIsGeneratingVideo(false);
          toast({
            title: "Voice generation failed",
            description: "Response shown without voice",
            variant: "destructive",
          });
        }
      }
      
      // Loading state already reset above after message was shown

      /* Azure TTS infrastructure preserved for future activation
      if (isAutoVoiceEnabled) {
        console.log('🎙️ Starting voice generation for:', selectedFigure.name);
        
        try {
          const { data: azureData, error: azureError } = await supabase.functions.invoke('azure-text-to-speech', {
            body: {
              text: aiResponse,
              figure_name: selectedFigure.name,
              figure_id: selectedFigure.id
            }
          });

          if (azureError) {
            console.error('❌ Azure TTS error:', azureError);
          } else if (azureData?.audioContent) {
            console.log('✅ Successfully used Azure TTS');
            playAudioFromBase64(azureData.audioContent);
          }
        } catch (voiceError) {
          console.error('Voice generation error:', voiceError);
        }
      }
      */

      // Show toast indicating which AI was used
      toast({
        title: `Response from ${usedProvider === 'claude' ? 'Claude' : usedProvider === 'grok' ? 'Grok' : 'OpenAI'}`,
        description: `${selectedFigure.name} responded using ${usedProvider === 'claude' ? 'Anthropic Claude' : usedProvider === 'grok' ? 'X.AI Grok' : 'OpenAI GPT-4o Mini'}`,
        duration: 2000,
      });

    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        console.log(`Retrying... (${attempt + 1}/${maxRetries})`);
        setRetryCount(attempt);
        
        toast({
          title: "Retrying...",
          description: `Attempt ${attempt + 1} of ${maxRetries}`,
        });
        
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return processMessageWithRetry(input, conversationId, controller, attempt + 1);
      } else {
        throw error;
      }
    }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // New function to generate voice with the selected voice from VoiceSettings
  const generateVoiceWithSelection = async (text: string, figure: HistoricalFigure, voiceId: string) => {
    console.log('🎯 Generating voice with selected ID:', voiceId);
    
    if (!isAutoVoiceEnabled) {
      console.log('🔇 Auto voice is disabled, skipping speech');
      return;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Azure TTS - Only voice generation method
      console.log('🎤 Using Azure TTS for voice generation');
      
      const { data, error } = await supabase.functions.invoke('azure-text-to-speech', {
        body: { 
          text: text,
          voice: voiceId === 'auto' ? undefined : voiceId, // Let Azure auto-select if "auto"
          figure_name: figure.name,
          figure_id: figure.id,
          language: selectedLanguage
        }
      });

      if (!error && data?.audioContent) {
        console.log('✅ Successfully used Azure TTS');
        playAudioFromBase64(data.audioContent);
        return;
      } else {
        throw new Error(error?.message || 'Azure TTS failed');
      }
      
    } catch (error) {
      console.error('Error generating voice with Azure:', error);
      toast({
        title: "Voice generation failed",
        description: "Could not generate voice with Azure TTS",
        variant: "destructive",
        duration: 3000,
      });
      throw error;
    }
  };

  const generateSpeech = async (text: string, figure: HistoricalFigure) => {
    console.log('🔊 Starting Azure TTS generation for:', figure.name, 'Text:', text.substring(0, 50) + '...');
    
    if (!isAutoVoiceEnabled) {
      console.log('🔇 Auto voice is disabled, skipping speech');
      return;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Use Azure TTS - the only voice generation method
      await generateAndPlayTTS(text);
      console.log('✅ Azure TTS successful');
      
    } catch (error) {
      console.error('Error generating speech with Azure TTS:', error);
      setIsPlayingAudio(false);
      toast({
        title: "Voice generation failed",
        description: "Could not generate voice response",
        variant: "destructive",
      });
    }
  };


  const playAudioFromBase64 = async (audioContent: string) => {
    try {
      // Use centralized audio pipeline initialization
      initializeAudioPipeline();
      
      // Ensure audio context is running
      if (audioContextRef.current!.state !== 'running') {
        await audioContextRef.current!.resume();
        console.log('🎧 AudioContext resumed');
      }
      
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      
      // Convert base64 to audio blob
      const binaryString = atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Set audio source on shared element
      audioElementRef.current!.src = audioUrl;
      setCurrentAudio(audioElementRef.current!);
      
      // CRITICAL: Set event handlers BEFORE play
      audioElementRef.current!.onplay = () => {
        console.log('▶️ Audio PLAY event - Setting isSpeaking = TRUE');
        setIsSpeaking(true);
        setIsPlayingAudio(true);
      };
      
      audioElementRef.current!.onpause = () => {
        console.log('⏸️ Audio PAUSED event');
        setIsSpeaking(false);
      };
      
      audioElementRef.current!.onended = () => {
        console.log('⏹️ Audio ENDED event - Setting isSpeaking = FALSE');
        setIsSpeaking(false);
        setIsPlayingAudio(false);
        setIsPaused(false);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };

      audioElementRef.current!.onerror = () => {
        console.error('❌ Audio ERROR event');
        setIsSpeaking(false);
        setIsPlayingAudio(false);
        setIsPaused(false);
        setCurrentAudio(null);
      };

      // Play audio
      await audioElementRef.current!.play();
      console.log('🔊 Audio playing - Context:', audioContextRef.current!.state);
    } catch (error) {
      console.error('Error in playAudioFromBase64:', error);
      setIsSpeaking(false);
      setIsPlayingAudio(false);
      setIsPaused(false);
      setCurrentAudio(null);
    }
  };

  // Auto-clone voice for historical figure using authentic recordings
  const getOrCreateAuthenticVoice = async (figure: HistoricalFigure): Promise<string> => {
    try {
      // Option B: Skip database check - always return default voice
      if (false) {
        return '';
      }

      console.log(`No cloned voice found for ${figure.name}, creating voice clone...`);
      
      // Use Resemble AI voice cloning
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/resemble-voice-clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY2xwdnJ5cmpsYWZhY29jYm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDk5NTAsImV4cCI6MjA3NDY4NTk1MH0.noDkcnCcthJhY4WavgDDZYl__QtOq1Y9t9dTowrU2tc`,
        },
        body: JSON.stringify({
          figureName: figure.name,
          figureId: figure.id,
          audioUrl: null // Let it create fallback voice with Resemble AI
        }),
      });

      console.log(`Auto-clone-voice response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          console.log(`Successfully auto-cloned voice for ${figure.name}:`, result.voice_id);
          
          // Show success message to user with enhanced quality info
          const qualityInfo = result.quality_score ? ` (Quality: ${result.quality_score}/100)` : '';
          const pipelineInfo = result.enhancements?.processing_pipeline ? 
            `\n\n🔬 **Enhancement Pipeline**: ${result.enhancements.processing_pipeline}` : '';
          
          const successMessage: Message = {
            id: Date.now().toString(),
            content: `🎭 **Authentic Voice Activated**: I've created a voice profile for ${figure.name} using advanced AI voice synthesis!${qualityInfo}\n\nYou're now hearing an AI recreation designed to match how ${figure.name} might have sounded based on historical records and voice characteristics of their era.`,
            type: "assistant",
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, successMessage]);
          
          return result.voice_id;
        } else {
          console.log(`Auto-cloning failed for ${figure.name}:`, result.error || result.message);
          // Azure will auto-select appropriate voice
          return null;
        }
      } else {
        console.error(`Auto-clone-voice API call failed for ${figure.name}:`, response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        // Azure will auto-select appropriate voice
        return null;
      }

      // Azure will auto-select appropriate voice
      return null;
      
    } catch (error) {
      console.error('Error getting/creating authentic voice:', error);
      console.error('Error details:', error.message || error);
      console.error('Azure will auto-select voice for:', figure.name);
      return null;
    }
  };

  const getVoicePitch = (figure: HistoricalFigure): number => {
    const pitchMap: Record<string, number> = {
      'winston-churchill': 0.8,
      'albert-einstein': 0.75,   // Lower pitch for Einstein
      'marie-curie': 1.1,
      'napoleon': 0.9,
      'cleopatra': 1.2,
      'shakespeare': 1.0,
      'abraham-lincoln': 0.85,
      'leonardo-da-vinci': 0.9,
      'socrates': 0.8,
      'galileo': 0.85,
      'julius-caesar': 0.8,
      'joan-of-arc': 1.15,
    };
    return pitchMap[figure.id] || (figure.id.includes('marie') || figure.id.includes('cleopatra') || figure.id.includes('joan') ? 1.1 : 0.85);
  };


  const createAuthenticVoice = async (figure: HistoricalFigure) => {
    try {
      console.log(`Creating authentic voice for ${figure.name}...`);
      
      // Use Resemble AI for authentic voice cloning from historical sources
      const { data, error } = await supabase.functions.invoke('resemble-voice-clone', {
        body: { 
          figureName: figure.name,
          figureId: figure.id,
          audioUrl: null // Let the function find historical audio or use fallback
        }
      });

      if (error) {
        console.error('Voice cloning error:', error);
        return;
      }
      
      if (data?.success) {
        const voiceCreationMessage: Message = {
          id: Date.now().toString(),
          content: `🎭 **Authentic Voice Ready**: Created an AI voice profile for ${figure.name} using advanced voice synthesis! I'm now using speech patterns and characteristics designed to match how ${figure.name} might have sounded based on historical records.`,
          type: "assistant",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, voiceCreationMessage]);
        console.log(`Successfully created voice for ${figure.name}`);
      }
    } catch (error) {
      console.error('Error creating authentic voice:', error);
    }
  };

  const toggleAudio = () => {
    if (currentAudio) {
      if (isPlayingAudio) {
        currentAudio.pause();
        setIsPlayingAudio(false);
      } else {
        currentAudio.play();
        setIsPlayingAudio(true);
      }
    } else if ('speechSynthesis' in window && isPlayingAudio) {
      speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  };

  const searchWikipedia = async (query: string) => {
    try {
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/wikipedia-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('Wikipedia search failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      return null;
    }
  };

  const searchYoutube = async (query: string) => {
    // DISABLED: YouTube integration not currently in use
    console.log('YouTube search disabled - integration not active');
    return null;
  };

  const handleYoutubeSearch = async (query: string) => {
    const youtubeResults = await searchYoutube(query);
    if (youtubeResults && youtubeResults.length > 0) {
      const videoLinks = youtubeResults
        .slice(0, 3)
        .map((video: any) => `🎥 **${video.title}**\n${video.description.substring(0, 100)}...\n[Watch on YouTube](${video.url})`)
        .join('\n\n---\n\n');

      const searchMessage: Message = {
        id: Date.now().toString(),
        content: `🎬 **Authentic Voice References for "${query}"**\n\n${videoLinks}\n\n💡 **Note**: These recordings help me understand ${selectedFigure?.name}'s authentic voice patterns and speaking style.`,
        type: "assistant",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, searchMessage]);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card overflow-y-auto">
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold mb-6">Historical Avatars</h1>
          
          
          {/* Conversation Type Selection */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Bot className="h-4 w-4 mr-2" />
              Conversation Type
            </h3>
            <Select value={conversationType} onValueChange={(value: 'casual' | 'educational' | 'debate' | 'philosophical' | 'theological') => setConversationType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="casual">
                  <div className="flex items-center">
                    <span className="mr-2">💬</span>
                    Casual Conversation
                  </div>
                </SelectItem>
                <SelectItem value="educational">
                  <div className="flex items-center">
                    <span className="mr-2">📚</span>
                    Educational
                  </div>
                </SelectItem>
                <SelectItem value="debate">
                  <div className="flex items-center">
                    <span className="mr-2">⚔️</span>
                    Debate
                  </div>
                </SelectItem>
                <SelectItem value="philosophical">
                  <div className="flex items-center">
                    <span className="mr-2">🤔</span>
                    Philosophical
                  </div>
                </SelectItem>
                <SelectItem value="theological">
                  <div className="flex items-center">
                    <span className="mr-2">🙏</span>
                    Theological
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {conversationType === 'casual'
                ? 'Friendly, relaxed conversation style'
                : conversationType === 'educational' 
                ? 'Detailed explanations and teaching approach'
                : conversationType === 'debate'
                ? 'Challenging ideas and rigorous argumentation'
                : conversationType === 'philosophical'
                ? 'Deep exploration of abstract concepts'
                : 'Focus on spiritual and religious themes'
              }
            </p>
          </Card>

          {/* Unified Language Selection */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              Language
            </h3>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                <SelectItem value="en-GB">🇬🇧 English (UK)</SelectItem>
                <SelectItem value="es-ES">🇪🇸 Español (Spanish)</SelectItem>
                <SelectItem value="fr-FR">🇫🇷 Français (French)</SelectItem>
                <SelectItem value="de-DE">🇩🇪 Deutsch (German)</SelectItem>
                <SelectItem value="it-IT">🇮🇹 Italiano (Italian)</SelectItem>
                <SelectItem value="ja-JP">🇯🇵 日本語 (Japanese)</SelectItem>
                <SelectItem value="zh-CN">🇨🇳 中文 (Chinese)</SelectItem>
                <SelectItem value="ar-SA">🇸🇦 العربية (Arabic)</SelectItem>
                <SelectItem value="hi-IN">🇮🇳 हिन्दी (Hindi)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Controls both text responses and native voice accents
            </p>
          </Card>

          {/* AI Provider Selection */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Bot className="h-4 w-4 mr-2" />
              AI Provider
            </h3>
            
            {/* Show actual provider used in last response */}
            {messages.length > 0 && messages[messages.length - 1].type === 'assistant' && messages[messages.length - 1].aiProvider && (
              <div className="mb-3 p-2 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium mb-1">Currently Using:</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold capitalize">
                    {messages[messages.length - 1].aiProvider === 'kimi-k2' && '🌙 Kimi K2'}
                    {messages[messages.length - 1].aiProvider === 'openai' && '🤖 OpenAI'}
                    {messages[messages.length - 1].aiProvider === 'grok' && '🚀 Grok'}
                    {messages[messages.length - 1].aiProvider === 'anthropic' && '🧠 Claude'}
                    {messages[messages.length - 1].aiProvider === 'lovable-ai' && '✨ Lovable AI'}
                  </span>
                  {messages[messages.length - 1].fallbackUsed && (
                    <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Fallback</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {messages[messages.length - 1].model}
                </p>
              </div>
            )}
            
            <Select value={selectedAIProvider} onValueChange={(value: 'kimi-k2' | 'openai' | 'grok' | 'claude' | 'lovable-ai') => setSelectedAIProvider(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
                <SelectItem value="kimi-k2">
                  <div className="flex items-center">
                    <span className="mr-2">🌙</span>
                    Kimi K2 (Primary)
                  </div>
                </SelectItem>
                <SelectItem value="openai">
                  <div className="flex items-center">
                    <span className="mr-2">🤖</span>
                    OpenAI GPT-4o Mini
                  </div>
                </SelectItem>
                <SelectItem value="grok">
                  <div className="flex items-center">
                    <span className="mr-2">🚀</span>
                    Grok (X.AI)
                  </div>
                </SelectItem>
                <SelectItem value="claude">
                  <div className="flex items-center">
                    <span className="mr-2">🧠</span>
                    Claude (Anthropic)
                  </div>
                </SelectItem>
                <SelectItem value="lovable-ai">
                  <div className="flex items-center">
                    <span className="mr-2">✨</span>
                    Lovable AI (Gemini)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedAIProvider === 'kimi-k2'
                ? 'Kimi K2 with context caching for cost-effective responses'
                : selectedAIProvider === 'claude'
                ? 'Claude offers intelligent, nuanced responses with superior reasoning'
                : selectedAIProvider === 'openai' 
                ? 'OpenAI provides reliable, well-structured responses'
                : selectedAIProvider === 'lovable-ai'
                ? 'Lovable AI powered by Google Gemini 2.5 Flash'
                : 'Grok offers conversational, real-time aware responses'
              }
            </p>
          </Card>


          {/* Azure Voice Selection */}
          {selectedFigure && (() => {
            // Detect gender based on figure name
            const detectGender = (name: string): 'male' | 'female' => {
              const maleTitles = ['king', 'emperor', 'sir', 'lord', 'prince', 'mr', 'president', 'pope', 'sultan', 'khan', 'tsar', 'caesar'];
              const femaleTitles = ['queen', 'empress', 'lady', 'princess', 'mrs', 'ms', 'miss', 'tsarina'];
              const nameLower = name.toLowerCase();
              
              if (maleTitles.some(title => nameLower.includes(title))) return 'male';
              if (femaleTitles.some(title => nameLower.includes(title))) return 'female';
              
              const femaleNames = ['cleopatra', 'elizabeth', 'victoria', 'catherine', 'marie', 'joan', 'rosa', 'ada', 'jane', 'harriet', 'susan', 'amelia', 'florence', 'frida'];
              const maleNames = ['alexander', 'napoleon', 'julius', 'augustus', 'leonardo', 'william', 'charles', 'henry', 'george', 'albert', 'winston', 'abraham', 'thomas', 'benjamin'];
              
              if (femaleNames.some(n => nameLower.includes(n))) return 'female';
              if (maleNames.some(n => nameLower.includes(n))) return 'male';
              
              return 'male'; // default
            };
            
            const gender = detectGender(selectedFigure.name);
            
            // Define all Azure voices with gender
            const allAzureVoices = [
              { id: 'en-US-AndrewNeural', name: 'Andrew (US Male)', description: 'Clear American English, professional', gender: 'male' },
              { id: 'en-GB-RyanNeural', name: 'Ryan (British Male)', description: 'British English, refined accent', gender: 'male' },
              { id: 'fr-FR-HenriNeural', name: 'Henri (French Male)', description: 'Native French speaker', gender: 'male' },
              { id: 'de-DE-ConradNeural', name: 'Conrad (German Male)', description: 'Native German speaker', gender: 'male' },
              { id: 'es-ES-AlvaroNeural', name: 'Alvaro (Spanish Male)', description: 'Native Spanish speaker', gender: 'male' },
              { id: 'en-US-JennyNeural', name: 'Jenny (US Female)', description: 'Warm American English, conversational', gender: 'female' },
              { id: 'en-GB-SoniaNeural', name: 'Sonia (British Female)', description: 'British English, elegant accent', gender: 'female' },
              { id: 'fr-FR-DeniseNeural', name: 'Denise (French Female)', description: 'Native French speaker', gender: 'female' },
              { id: 'de-DE-KatjaNeural', name: 'Katja (German Female)', description: 'Native German speaker', gender: 'female' },
              { id: 'es-ES-ElviraNeural', name: 'Elvira (Spanish Female)', description: 'Native Spanish speaker', gender: 'female' },
            ];
            
            // Filter voices by gender and limit to 5
            const genderFilteredVoices = allAzureVoices
              .filter(v => v.gender === gender)
              .slice(0, 5);
            
            return (
              <Card className="p-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  <Volume2 className="h-4 w-4 mr-2" />
                  Azure Voice Selection
                </h3>
                <Select 
                  value={selectedVoiceId} 
                  onValueChange={(voiceId) => {
                    setSelectedVoiceId(voiceId);
                    const voice = [...genderFilteredVoices].find(v => v.id === voiceId);
                    toast({
                      title: "Voice selected",
                      description: voiceId === 'auto' ? `Auto mode for ${selectedFigure.name}` : voice?.description || `Now using ${voiceId}`,
                      duration: 2000,
                    });
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Azure voice" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="auto">Auto (Region-Based)</SelectItem>
                    {genderFilteredVoices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedVoiceId === 'auto' 
                    ? `Auto mode will select the best ${gender} voice based on ${selectedFigure.name}'s nationality` 
                    : 'Manual voice selection overrides auto-detection'}
                </p>
              </Card>
            );
          })()}

          {/* Conversation Export */}
          <ConversationExport
            messages={messages}
            selectedFigure={selectedFigure}
          />

          {/* Figure Recommendations */}
          <div className="space-y-3">
            <FigureRecommendations
              selectedFigure={selectedFigure}
              onSelectFigure={(figure) => {
                setSelectedFigure(figure);
                setMessages([]);
                setCurrentConversationId(null);
                setDocuments([]);
              }}
            />
          </div>
          {/* Document Upload */}
          <DocumentUpload
            conversationId={currentConversationId}
            onDocumentUploaded={setDocuments}
            documents={documents}
          />
          
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => setShowFileUpload(!showFileUpload)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload Documents
            </Button>


            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setMessages([]);
                setCurrentConversationId(null);
                setDocuments([]);
                if (selectedFigure) {
                  createNewConversation(selectedFigure);
                }
              }}
              disabled={!selectedFigure}
            >
              <Save className="mr-2 h-4 w-4" />
              New Conversation
            </Button>


            {showFileUpload && (
              <Card className="p-4">
                <FileUpload onFileUpload={(files) => console.log('Files uploaded:', files)} />
              </Card>
            )}

            <div>
              <h3 className="font-semibold mb-3">🔍 Find Historical Figures</h3>
              <HistoricalFigureSearch 
                selectedFigure={selectedFigure}
                onSelectFigure={(figure) => {
                  setSelectedFigure(figure);
                  setMessages([]);
                  setCurrentConversationId(null);
                  setDocuments([]);
                  setBooks([]);
                }}
              />

              {/* Conversation History for Selected Figure */}
              {selectedFigure && (
                <div className="mt-4">
                  <ConversationHistory
                    onSelectConversation={(conversation) => {
                      setCurrentConversationId(conversation.id);
                      loadConversation(conversation.id);
                    }}
                    selectedFigureId={selectedFigure.id}
                    onConversationDelete={() => {
                      setMessages([]);
                      setCurrentConversationId(null);
                    }}
                  />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          {selectedFigure ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">{selectedFigure.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedFigure.period}</p>
                <p className="text-xs text-green-600">
                  🎙️ Speaking in {selectedLanguage.split('-')[1]} 
                  {selectedLanguage.startsWith(getFigureLanguage(selectedFigure).split('-')[0]) 
                    ? ' (Native Language)' 
                    : ' (Translated)'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {/* Music Session Button for Musical Figures */}
                {(selectedFigure.id === 'hendrix' || 
                  selectedFigure.id === 'mozart' || 
                  selectedFigure.id === 'beethoven' || 
                  selectedFigure.id === 'bach' ||
                  selectedFigure.name?.toLowerCase().includes('musician') ||
                  selectedFigure.name?.toLowerCase().includes('composer') ||
                  selectedFigure.description?.toLowerCase().includes('music')) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMusicInterface(true)}
                    className="border-purple-500 text-purple-600 hover:bg-purple-50"
                  >
                    <Guitar className="h-4 w-4 mr-2" />
                    Live Music Session
                  </Button>
                )}
                
                {currentAudio && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleAudio}
                    className="ml-2"
                  >
                    {isPlayingAudio ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <h2 className="text-lg font-semibold text-muted-foreground">
              Select a historical figure to start chatting
            </h2>
          )}
        </div>

        {/* Realistic Avatar - External video generation like PodcastMode */}
        {selectedFigure && (
          <div className="border-b border-border bg-card px-6 py-4">
            <RealisticAvatar 
              imageUrl={avatarImageUrl}
              isLoading={isLoadingAvatarImage}
              videoUrl={currentVideoUrl}
              animationFrames={animationFrames || undefined}
              audioUrl={greetingAudioUrl}
              greetingText={greetingText || undefined}
              isGeneratingVideo={isGeneratingVideo}
              figureName={selectedFigure.name}
              figureId={selectedFigure.id}
              onVideoEnd={() => {
                console.log('⏹️ Video ended - clearing state');
                setIsSpeaking(false);
                setIsPlayingAudio(false);
                setIsGreetingPlaying(false);
                setCurrentVideoUrl(null);
                setAnimationFrames(null);
              }}
              onAnimationEnd={() => {
                console.log('⏹️ Animation ended - clearing state');
                setIsSpeaking(false);
                setIsPlayingAudio(false);
                setIsGreetingPlaying(false);
                setAnimationFrames(null);
              }}
              onVideoReady={(videoUrl) => {
                console.log('✅ Video ready callback:', videoUrl?.substring(0, 80));
                if (videoUrl && !videoUrl.startsWith('data:audio')) {
                  setIsSpeaking(true);
                  setIsPlayingAudio(true);
                }
              }}
            />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1">
          <ChatMessages 
            messages={messages} 
            selectedFigure={selectedFigure}
            isLoading={isLoading}
          />
        </div>

        {/* Input */}
        {selectedFigure && (
          <div className="border-t border-border bg-card p-4">
            <div className="flex space-x-2">
              <div className="flex-1 relative">
                <Textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Ask ${selectedFigure.name} anything... (or click the mic to speak in ${selectedLanguage.split('-')[1]})`}
                  className="min-h-[60px] resize-none pr-12"
                  disabled={isLoading}
                />
                <Button
                  onClick={toggleVoiceRecognition}
                  disabled={isLoading}
                  variant="ghost"
                  size="sm"
                  className={`absolute right-2 top-2 h-8 w-8 ${
                    isListening 
                      ? 'text-red-500 animate-pulse bg-red-50 dark:bg-red-950' 
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </div>
              {isLoading ? (
                // Show stop button during text generation
                <Button 
                  onClick={handleStopGeneration}
                  size="icon"
                  variant="destructive"
                  className="h-[60px] w-[60px]"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : isPlayingAudio ? (
                // Show pause and stop buttons during audio playback
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePauseAudio}
                    size="icon"
                    variant="secondary"
                    className="h-[60px] w-[60px]"
                  >
                    <Pause className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={handleStopGeneration}
                    size="icon"
                    variant="destructive"
                    className="h-[60px] w-[60px]"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              ) : isPaused ? (
                // Show play and replay buttons when paused
                <div className="flex gap-2">
                  <Button 
                    onClick={handleResumeAudio}
                    size="icon"
                    variant="default"
                    className="h-[60px] w-[60px]"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={handleReplayAudio}
                    size="icon"
                    variant="outline"
                    className="h-[60px] w-[60px]"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                // Show send button when ready
                <Button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isGreetingPlaying}
                  size="icon"
                  className="h-[60px] w-[60px]"
                  title={isGreetingPlaying ? "Please wait for greeting to finish..." : ""}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            {isRecording && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border-2 border-dashed border-primary/30">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-primary">
                    Listening in {selectedLanguage.split('-')[1]}...
                  </span>
                </div>
                {recordingTranscript && (
                  <p className="text-sm text-muted-foreground italic">
                    "{recordingTranscript}"
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Speak clearly. Say "stop" or click the mic to finish.
                </p>
              </div>
            )}
            
            {isListening && !isRecording && (
              <p className="text-sm text-muted-foreground mt-2 animate-pulse flex items-center">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-ping"></div>
                🎤 Preparing to listen... Speak now
              </p>
            )}
            
            {retryCount > 0 && (
              <div className="flex items-center space-x-2 text-sm text-orange-600 mt-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Retrying... ({retryCount}/3)</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Music Voice Interface Modal */}
      {showMusicInterface && selectedFigure && (
        <MusicVoiceInterface
          figureId={selectedFigure.id}
          figureName={selectedFigure.name}
          onClose={() => setShowMusicInterface(false)}
        />
      )}
    </div>
  );
};

export default HistoricalChat;