import { useState, useEffect } from "react";
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
import VoiceSettings from "./VoiceSettings";
import ConversationHistory from "./ConversationHistory";

import MusicVoiceInterface from "./MusicVoiceInterface";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
  sourcesUsed?: {
    books: number;
    documents: number;
    youtube: number;
    wikipedia: boolean;
    currentEvents: number;
    historicalContext: number;
    webArticles: number;
  };
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
  const [selectedAIProvider, setSelectedAIProvider] = useState<'openai' | 'grok' | 'claude'>('claude'); // Claude as default
  const [isVoiceChatting, setIsVoiceChatting] = useState(false);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true); // Auto-enable voice responses
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { toast } = useToast();

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
  useEffect(() => {
    if (selectedFigure) {
      createAuthenticVoice(selectedFigure);
      const figureLanguage = getFigureLanguage(selectedFigure);
      setSelectedLanguage(figureLanguage);
    }
  }, [selectedFigure]);

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

  // Handle current events search using SerpApi
  const handleCurrentEventsSearch = async (query: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('serpapi-search', {
        body: { 
          query: query + " current events news",
          type: "news",
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
    if (!inputMessage.trim() || !selectedFigure) return;

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

    // If audio is playing, pause it instead of stopping
    if (isPlayingAudio) {
      handlePauseAudio();
      return;
    }

    // Complete stop - reset everything
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    // Reset all states
    setIsLoading(false);
    setIsPlayingAudio(false);
    setIsPaused(false);
    setRetryCount(0);
    
    console.log('🛑 Generation completely stopped');
    
    toast({
      title: "Stopped",
      description: "Generation and voice playback have been stopped",
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
          aiProvider: selectedAIProvider
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
      };

      // Generate FakeYou voice using our dedicated edge function
      if (isAutoVoiceEnabled && aiResponse.length > 20) {
        console.log('🎙️ Starting FakeYou voice generation for:', selectedFigure!.name);
        
        generateFakeYouVoice(aiResponse, selectedFigure!).catch(voiceError => {
          console.error('FakeYou voice generation failed:', voiceError);
          // Fallback to standard TTS
          generateSpeech(aiResponse, selectedFigure!).catch(speechError => {
            console.error('All speech generation failed:', speechError);
          });
        });
      }

      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage(assistantMessage, conversationId);
      
      // Reset loading state after text response is complete (UI becomes responsive)
      setIsLoading(false);
      setAbortController(null);

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

  const generateSpeech = async (text: string, figure: HistoricalFigure) => {
    console.log('🔊 Starting speech generation for:', figure.name, 'Text:', text.substring(0, 50) + '...');
    
    if (!isAutoVoiceEnabled) {
      console.log('🔇 Auto voice is disabled, skipping speech');
      return;
    }

    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      // Start TTS generation immediately without waiting
      console.log('🎤 Attempting Resemble.ai TTS...');
      generatePremiumSpeech(text, figure).then(() => {
        console.log('✅ Resemble.ai TTS successful');
      }).catch((premiumError) => {
        console.log('❌ Resemble.ai TTS failed, falling back to browser speech:', premiumError);
        if ('speechSynthesis' in window) {
          generateBrowserSpeech(text, figure);
        } else {
          console.error('Speech synthesis not supported in this browser');
        }
      });
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsPlayingAudio(false);
    }
  };

  // Helper function to chunk text for Elite plan 2-minute limit (~300 words = ~120 seconds)
  const chunkTextForFakeYou = (text: string, maxWords: number = 300): string[] => {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';
    let wordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      
      if (wordCount + sentenceWords <= maxWords) {
        currentChunk += sentence;
        wordCount += sentenceWords;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
        wordCount = sentenceWords;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  };

  const generateFakeYouVoice = async (text: string, figure: HistoricalFigure) => {
    try {
      console.log('🎤 Generating FakeYou voice for:', figure.name);
      
      // Chunk text for 10-second limit
      const textChunks = chunkTextForFakeYou(text);
      const chunkCount = textChunks.length;
      
      if (chunkCount > 1) {
        console.log(`📝 Split into ${chunkCount} chunks for 10-second limit`);
      }
      
      toast({
        title: "Preparing voice response",
        description: chunkCount > 1 
          ? `Generating ${chunkCount} audio segments with Elite quality...`
          : `Cloning ${figure.name}'s voice with Elite speed - ~10 seconds...`,
        duration: 4000,
      });
      
      // Step 1: Search for the figure's voice on FakeYou (only once)
      const { data: voicesData, error: voicesError } = await supabase.functions.invoke('fakeyou-tts', {
        body: { 
          action: 'list_voices',
        },
      });
      
      if (voicesError) {
        console.error('Voice list fetch error:', voicesError);
        throw voicesError;
      }
      if (!voicesData.success) {
        console.error('Voice list fetch failed:', voicesData);
        throw new Error('Failed to fetch voices');
      }
      
      console.log(`✅ Fetched ${voicesData.voices?.length || 0} voices from FakeYou`);
      
      // Step 2: Smart name matching with variations
      const figureName = figure.name.toLowerCase();
      const nameWithoutPunctuation = figureName.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      const nameWords = nameWithoutPunctuation.split(' ').filter((w: string) => w.length > 0);
      const lastName = nameWords.length > 0 ? nameWords[nameWords.length - 1] : '';
      const firstName = nameWords.length > 0 ? nameWords[0] : '';
      
      // Common name variations and abbreviations
      const nameVariations: Record<string, string[]> = {
        'john f kennedy': ['jfk', 'kennedy', 'john f kennedy', 'john kennedy', 'president kennedy'],
        'martin luther king jr': ['mlk', 'martin luther king', 'dr king', 'king jr', 'martin luther king jr'],
        'franklin d roosevelt': ['fdr', 'franklin roosevelt', 'roosevelt', 'president roosevelt'],
        'winston churchill': ['churchill', 'winston', 'winston churchill', 'sir winston'],
        'abraham lincoln': ['lincoln', 'abe lincoln', 'president lincoln', 'abraham lincoln'],
        'albert einstein': ['einstein', 'albert einstein'],
        'william shakespeare': ['shakespeare', 'william shakespeare', 'bard'],
        'napoleon bonaparte': ['napoleon', 'bonaparte'],
        'cleopatra': ['cleopatra', 'cleopatra vii'],
        'leonardo da vinci': ['leonardo', 'da vinci', 'leonardo da vinci'],
        'marie curie': ['marie curie', 'curie'],
        'nikola tesla': ['tesla', 'nikola tesla'],
        'george washington': ['washington', 'george washington', 'president washington'],
        'julius caesar': ['caesar', 'julius caesar'],
      };
      
      const searchTerms = nameVariations[nameWithoutPunctuation] || [
        figureName,
        nameWithoutPunctuation,
        lastName,
        firstName,
        `${firstName} ${lastName}`,
        ...nameWords.filter(w => w.length > 3) // Include significant words
      ];
      
      console.log(`🔍 Searching FakeYou for: ${searchTerms.join(', ')}`);
      
      // Find matching voice using prioritized search (exact match first, then partial)
      let matchingVoice = null;
      
      // First pass: Try to find exact full name matches (most specific)
      for (const term of searchTerms.slice(0, 3)) { // Check first 3 terms (most specific)
        matchingVoice = voicesData.voices?.find((v: any) => {
          const voiceTitle = v.title.toLowerCase();
          // Exact match or contains full term as a word (not just substring)
          const termRegex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (termRegex.test(voiceTitle)) {
            console.log(`✓ Full match found: "${v.title}" matches "${term}"`);
            return true;
          }
          return false;
        });
        
        if (matchingVoice) break;
      }
      
      // Second pass: If no exact match, try broader search
      if (!matchingVoice) {
        matchingVoice = voicesData.voices?.find((v: any) => {
          const voiceTitle = v.title.toLowerCase();
          return searchTerms.some((term: string) => {
            // Check if voice title contains the search term
            if (voiceTitle.includes(term)) {
              console.log(`✓ Partial match found: "${v.title}" contains "${term}"`);
              return true;
            }
            return false;
          });
        });
      }
      
      if (!matchingVoice) {
        console.log('❌ No FakeYou voice found. Tried:', searchTerms);
        toast({
          title: "Voice not found",
          description: `No authentic voice available for ${figure.name}. Using fallback.`,
          variant: "destructive",
          duration: 4000,
        });
        throw new Error('Voice not found');
      }
      
      console.log(`✅ Found FakeYou voice: "${matchingVoice.title}"`);
      toast({
        title: "Voice found!",
        description: `Using "${matchingVoice.title}" voice`,
        duration: 2000,
      });
      
      // Step 3: Generate and play chunks with streaming - play first chunk ASAP
      const audioQueue: string[] = [];
      let isPlayingQueue = false;
      let currentPlayingIndex = 0;
      
      // Function to play next audio in queue
      const playNextInQueue = () => {
        if (currentPlayingIndex >= audioQueue.length) {
          // Wait a bit and check again if more chunks are coming
          if (generationComplete && currentPlayingIndex >= textChunks.length) {
            console.log('✅ All audio chunks completed');
            setIsPlayingAudio(false);
            setCurrentAudio(null);
            isPlayingQueue = false;
          } else if (!generationComplete) {
            // Still generating, wait and check again
            setTimeout(() => playNextInQueue(), 500);
          }
          return;
        }
        
        const audioUrl = audioQueue[currentPlayingIndex];
        console.log(`🔊 Playing chunk ${currentPlayingIndex + 1}`);
        
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.src = audioUrl;
        audio.playbackRate = 0.85;
        
        audio.onloadeddata = () => {
          audio.play().then(() => {
            setIsPlayingAudio(true);
            setCurrentAudio(audio);
          }).catch(err => {
            console.error(`❌ Chunk ${currentPlayingIndex + 1} playback failed:`, err);
            currentPlayingIndex++;
            playNextInQueue();
          });
        };
        
        audio.onerror = (e) => {
          console.error(`❌ Chunk ${currentPlayingIndex + 1} load failed:`, e);
          currentPlayingIndex++;
          playNextInQueue();
        };
        
        audio.onended = () => {
          console.log(`✅ Chunk ${currentPlayingIndex + 1} completed`);
          currentPlayingIndex++;
          playNextInQueue();
        };
      };
      
      // Show initial toast
      toast({
        title: "Generating voice...",
        description: chunkCount > 1 
          ? `Preparing ${chunkCount} segments - Elite speed, voice starting in ~10 seconds...`
          : "Elite processing - voice will start in ~10 seconds...",
        duration: 3000,
      });
      
      // Track which chunks are ready
      const chunkResults: Array<string | null> = new Array(textChunks.length).fill(null);
      let firstChunkPlayed = false;
      let generationComplete = false;
      
      // Function to check and queue ready chunks in order
      const checkAndQueueChunks = () => {
        while (audioQueue.length < chunkResults.length && chunkResults[audioQueue.length] !== null) {
          const audioUrl = chunkResults[audioQueue.length];
          if (audioUrl) {
            audioQueue.push(audioUrl);
            console.log(`📦 Queued chunk ${audioQueue.length}/${chunkResults.length}`);
          }
        }
        
        // Start playing if first chunk is ready and we haven't started yet
        if (!firstChunkPlayed && audioQueue.length > 0 && !isPlayingQueue) {
          firstChunkPlayed = true;
          console.log('🎵 Starting playback immediately');
          toast({
            title: "Voice ready!",
            description: chunkCount > 1 
              ? `Playing part 1/${chunkCount}...`
              : `Playing ${figure.name}'s voice`,
            duration: 2000,
          });
          isPlayingQueue = true;
          playNextInQueue();
        }
      };
      
      // Generate ALL chunks in parallel
      const chunkPromises = textChunks.map(async (chunk, chunkIndex) => {
        try {
          console.log(`🎤 Starting chunk ${chunkIndex + 1}/${chunkCount}`);
          
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('fakeyou-tts', {
            body: {
              action: 'generate_tts',
              text: chunk,
              voiceToken: matchingVoice.voiceToken,
            },
          });
          
          if (ttsError || !ttsData.success) {
            console.error(`❌ Chunk ${chunkIndex + 1} generation failed`);
            return;
          }
          
          const jobToken = ttsData.jobToken;
          console.log(`🔄 Job ${chunkIndex + 1} started:`, jobToken);
          
          // Poll for completion
          for (let i = 0; i < 40; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { data: statusData, error: statusError } = await supabase.functions.invoke('fakeyou-tts', {
              body: { action: 'check_status', jobToken },
            });
            
            if (statusError || !statusData.success) continue;
            
            if (statusData.isComplete && statusData.audioUrl) {
              let audioUrl = statusData.audioUrl;
              if (audioUrl.includes('storage.googleapis.com/vocodes-public')) {
                audioUrl = audioUrl.replace('https://storage.googleapis.com/vocodes-public', 'https://cdn-2.fakeyou.com');
              }
              console.log(`✅ Chunk ${chunkIndex + 1} ready`);
              
              // Store and check queue
              chunkResults[chunkIndex] = audioUrl;
              checkAndQueueChunks();
              return;
            }
            
            if (statusData.isFailed) {
              console.error(`❌ Chunk ${chunkIndex + 1} failed`);
              return;
            }
          }
        } catch (error) {
          console.error(`❌ Chunk ${chunkIndex + 1} error:`, error);
        }
      });
      
      // Wait for all chunks to complete
      await Promise.all(chunkPromises);
      generationComplete = true;
      console.log(`✅ All ${textChunks.length} chunks generated`);
      
    } catch (error) {
      console.error('💥 FakeYou generation failed:', error);
      setIsPlayingAudio(false);
      
      toast({
        title: "Using fallback voice",
        description: "FakeYou unavailable, switching to backup TTS",
        variant: "default",
        duration: 3000,
      });
      
      throw error; // Re-throw to trigger fallback
    }
  };

  const generateBrowserSpeech = (text: string, figure: HistoricalFigure) => {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Detect gender from figure information
    const isMale = detectGender(figure);
    console.log(`Detected gender for ${figure.name}: ${isMale ? 'Male' : 'Female'}`);
    
    let selectedVoice = null;
    
    if (isMale) {
      // For male figures - prioritize definitively masculine voices
      selectedVoice = availableVoices.find(v => {
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase();
        
        // First priority: Explicitly male voices
        if (name.includes('male') || name.includes('man') || name.includes('david') || 
            name.includes('mark') || name.includes('daniel') || name.includes('alex') ||
            name.includes('james') || name.includes('michael') || name.includes('thomas') ||
            name.includes('google us english') || name.includes('microsoft david') ||
            name.includes('aaron') || name.includes('albert')) {
          return lang.startsWith(selectedLanguage.split('-')[0]) || lang.startsWith('en');
        }
        return false;
      });
      
      // Second priority: Voices that are NOT female
      if (!selectedVoice) {
        selectedVoice = availableVoices.find(v => {
          const name = v.name.toLowerCase();
          const lang = v.lang.toLowerCase();
          
          return (lang.startsWith(selectedLanguage.split('-')[0]) || lang.startsWith('en')) &&
                 !name.includes('female') && !name.includes('woman') && 
                 !name.includes('samantha') && !name.includes('victoria') &&
                 !name.includes('kate') && !name.includes('susan') && !name.includes('anna') &&
                 !name.includes('marie') && !name.includes('karen') && !name.includes('helen');
        });
      }
    } else {
      // For female figures - prioritize feminine voices
      selectedVoice = availableVoices.find(v => {
        const name = v.name.toLowerCase();
        const lang = v.lang.toLowerCase();
        
        return (lang.startsWith(selectedLanguage.split('-')[0]) || lang.startsWith('en')) &&
               (name.includes('female') || name.includes('woman') || name.includes('samantha') ||
                name.includes('victoria') || name.includes('kate') || name.includes('susan') ||
                name.includes('anna') || name.includes('marie') || name.includes('karen') ||
                name.includes('helen') || name.includes('microsoft zira'));
      });
    }
    
    // Final fallback to any voice in the right language
    if (!selectedVoice) {
      selectedVoice = availableVoices.find(v => 
        v.lang.startsWith(selectedLanguage.split('-')[0]) || v.lang.startsWith('en')
      );
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`Selected voice for ${figure.name}: ${selectedVoice.name} (${selectedVoice.lang})`);
    } else {
      console.log(`No specific voice found for ${figure.name}, using default`);
    }

    utterance.lang = selectedLanguage;
    
    // Make voice sound more natural and less robotic
    utterance.rate = 0.85;  // Slightly slower for more natural speech
    utterance.pitch = getVoicePitch(figure);
    utterance.volume = 0.9;
    
    // Add natural pauses and inflection by processing the text
    const naturalText = addNaturalPauses(text);
    utterance.text = naturalText;
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => {
      setIsPlayingAudio(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setIsPaused(false);
    };

    speechSynthesis.speak(utterance);
  };

  // Gender detection function
  const detectGender = (figure: HistoricalFigure): boolean => {
    // Known male figures
    const maleNames = [
      'albert einstein', 'winston churchill', 'abraham lincoln', 'napoleon',
      'socrates', 'shakespeare', 'galileo', 'leonardo da vinci', 'julius caesar',
      'isaac newton', 'charles darwin', 'thomas edison', 'benjamin franklin',
      'george washington', 'martin luther king', 'nelson mandela', 'mozart',
      'beethoven', 'bach', 'hendrix', 'elvis', 'john lennon', 'bob dylan',
      'plato', 'aristotle', 'confucius', 'buddha', 'jesus', 'muhammad',
      'tesla', 'jobs', 'gates', 'musk'
    ];
    
    // Known female figures  
    const femaleNames = [
      'marie curie', 'cleopatra', 'joan of arc', 'anne frank', 'mother teresa',
      'rosa parks', 'amelia earhart', 'virginia woolf', 'jane austen',
      'frida kahlo', 'coco chanel', 'oprah winfrey', 'malala yousafzai',
      'elizabeth', 'victoria', 'catherine', 'mary', 'helen keller'
    ];
    
    const figureName = figure.name.toLowerCase();
    const figureDesc = figure.description.toLowerCase();
    
    // Check explicit lists first
    if (maleNames.some(name => figureName.includes(name))) return true;
    if (femaleNames.some(name => figureName.includes(name))) return true;
    
    // Check for gender indicators in description
    if (figureDesc.includes('he ') || figureDesc.includes('his ') || 
        figureDesc.includes('him ') || figureDesc.includes('man') ||
        figureDesc.includes('king') || figureDesc.includes('emperor') ||
        figureDesc.includes('father') || figureDesc.includes('son') ||
        figureDesc.includes('brother') || figureDesc.includes('male')) {
      return true;
    }
    
    if (figureDesc.includes('she ') || figureDesc.includes('her ') || 
        figureDesc.includes('woman') || figureDesc.includes('queen') ||
        figureDesc.includes('empress') || figureDesc.includes('mother') ||
        figureDesc.includes('daughter') || figureDesc.includes('sister') ||
        figureDesc.includes('female')) {
      return false;
    }
    
    // Default to male (most historical figures in databases are male)
    return true;
  };

  // Add natural pauses and inflection to make speech less robotic
  const addNaturalPauses = (text: string): string => {
    let naturalText = text;
    
    // Add slight pauses after punctuation for more natural speech
    naturalText = naturalText.replace(/\./g, '..');
    naturalText = naturalText.replace(/,/g, ', ');
    naturalText = naturalText.replace(/!/g, '!.');
    naturalText = naturalText.replace(/\?/g, '?.');
    
    // Add emphasis markers for important words
    naturalText = naturalText.replace(/\b(I am|I was|my|very|indeed|certainly|absolutely)\b/gi, '$1');
    
    return naturalText;
  };

  // Enhanced fallback voice selection with historical accuracy
  const getFallbackVoice = (figure: HistoricalFigure): string => {
    const isMale = detectGender(figure);
    
    if (isMale) {
      const maleVoices = {
        // Presidential/Political Figures - Authoritative, clear voices
        'john-f-kennedy': 'Brian',          // Deep, presidential voice
        'jfk': 'Brian',                     
        'abraham-lincoln': 'Bill',          // Deep, resonant voice for Lincoln
        'winston-churchill': 'George',      // British-accented voice
        'franklin-d-roosevelt': 'Daniel',   // Confident presidential voice
        
        // Intellectual/Scientific - Thoughtful, measured voices  
        'albert-einstein': 'Eric',          // Intellectual, slightly accented
        'socrates': 'Will',                 // Wise, measured tone
        'leonardo-da-vinci': 'Callum',      // Renaissance intellectual
        'charles-darwin': 'Chris',          // Scientific, British accent
        
        // Military/Leadership - Strong, commanding voices
        'napoleon': 'George',               // Commanding, authoritative
        'alexander-the-great': 'Liam',      // Young but powerful
        'julius-caesar': 'Bill',            // Roman authority
        
        // Literary/Artistic - Expressive, cultured voices
        'shakespeare': 'Callum',            // British, dramatic
        'mark-twain': 'Daniel',             // American storyteller
        'edgar-allan-poe': 'Eric',          // Dark, mysterious
        
        // Religious/Philosophical - Gentle but authoritative
        'martin-luther-king-jr': '2ts4Q14DjMa5I5EgteS4', // Custom MLK voice from ElevenLabs
        'confucius': 'Will',                // Wise, calm
        'gandhi': 'Eric',                   // Gentle but firm
      };
      
      return maleVoices[figure.id] || 'Daniel'; // Default to presidential voice
    } else {
      const femaleVoices = {
        // Scientific/Intellectual 
        'marie-curie': 'Sarah',             // Intelligent, French-accented
        'rosalind-franklin': 'Laura',       // Scientific, British
        
        // Historical Leaders
        'cleopatra': 'Charlotte',           // Regal, commanding
        'elizabeth-i': 'Jessica',           // Royal British accent
        'catherine-the-great': 'Alice',     // Imperial, authoritative
        
        // Social/Political Activists
        'joan-of-arc': 'Jessica',           // Young but determined French
        'florence-nightingale': 'Laura',    // Caring but authoritative British
        'eleanor-roosevelt': 'Sarah',       // First Lady elegance
        
        // Literary/Artistic
        'jane-austen': 'Charlotte',         // Refined British
        'virginia-woolf': 'Alice',          // Literary, thoughtful
        'frida-kahlo': 'Aria',             // Passionate, artistic
      };
      
      return femaleVoices[figure.id] || 'Sarah'; // Default to intellectual voice
    }
  };

  const generatePremiumSpeech = async (text: string, figure: HistoricalFigure) => {
    try {
      // Check for existing cloned voice quickly
      const { data: existingVoices } = await supabase
        .from('cloned_voices')
        .select('voice_id')
        .eq('figure_id', figure.id)
        .eq('is_active', true)
        .limit(1);
      
      const clonedVoiceId = existingVoices?.[0]?.voice_id;
      
      if (clonedVoiceId && (clonedVoiceId.startsWith('resemble_') || clonedVoiceId.startsWith('coqui_'))) {
        console.log(`🎯 Using CLONED voice: ${clonedVoiceId} for ${figure.name}`);
        
        // Use ElevenLabs TTS for cloned voices
        const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
          body: { 
            text: text,
            voice: figure.name // Use figure name for voice mapping
          }
        });

        // If ElevenLabs works, use it
        if (!error && data?.audioContent) {
          console.log('✅ Successfully used ElevenLabs TTS');
          playAudioFromBase64(data.audioContent);
          return;
        } else {
          console.warn('❌ ElevenLabs TTS failed, falling back to default:', error);
        }
      } else {
        console.log('❌ No cloned voice found, creating premium voice clone...');
        
        // Try to create an authentic voice for this figure
        try {
          await getOrCreateAuthenticVoice(figure);
          console.log('✅ Voice clone initiated, using fallback for now');
        } catch (cloneError) {
          console.warn('Voice cloning failed:', cloneError);
        }
      }
      
      // Use ElevenLabs as fallback with proper voice mapping
      console.log(`🎵 Using ElevenLabs fallback for ${figure.name}`);
      
      // Get the mapped voice ID for this figure
      const fallbackVoice = getFallbackVoice(figure);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: { 
          text: text,
          voice: fallbackVoice // Use mapped voice ID instead of figure name
        }
      });

      if (error) {
        console.error('❌ ElevenLabs TTS Error:', error);
        // Add a toast notification for quota exceeded errors
        if (error.message?.includes('quota_exceeded') || error.message?.includes('401')) {
          console.warn('ElevenLabs quota exceeded - voice unavailable');
        }
        return;
      }

      if (!data?.audioContent) {
        console.error('❌ No audio content received from Premium TTS');
        return;
      }

      console.log('✅ Premium voice TTS successful');
      playAudioFromBase64(data.audioContent);
      
    } catch (error) {
      console.error('Error in generatePremiumSpeech:', error);
    }
  };

  const playAudioFromBase64 = async (audioContent: string) => {
    try {
      // Convert base64 to audio blob and play
      const binaryString = atob(audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      setCurrentAudio(audio);
      setIsPlayingAudio(true);
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        setIsPaused(false);
        setCurrentAudio(null);
        console.log('Audio playback completed');
      };

      audio.onerror = () => {
        setIsPlayingAudio(false);
        setIsPaused(false);
        setCurrentAudio(null);
        console.error('Error playing audio');
      };

      await audio.play();
    } catch (error) {
      console.error('Error in playAudioFromBase64:', error);
      setIsPlayingAudio(false);
      setIsPaused(false);
      setCurrentAudio(null);
    }
  };

  // Auto-clone voice for historical figure using authentic recordings
  const getOrCreateAuthenticVoice = async (figure: HistoricalFigure): Promise<string> => {
    try {
      // Check if we already have a cloned voice in the new table
      const { data: existingVoices, error } = await supabase
        .from('cloned_voices')
        .select('*')
        .eq('figure_id', figure.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && existingVoices && existingVoices.length > 0) {
        console.log(`Using existing cloned voice for ${figure.name}:`, existingVoices[0].voice_name);
        return existingVoices[0].voice_id;
      }

      console.log(`No cloned voice found for ${figure.name}, creating voice clone...`);
      
      // Use Coqui XTTS voice cloning (upgraded from Resemble for better quality)
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/coqui-voice-clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRyY2xwdnJ5cmpsYWZhY29jYm5kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMDk5NTAsImV4cCI6MjA3NDY4NTk1MH0.noDkcnCcthJhY4WavgDDZYl__QtOq1Y9t9dTowrU2tc`,
        },
        body: JSON.stringify({
          figureName: figure.name,
          figureId: figure.id,
          audioUrl: null // Let it create fallback voice
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
          // If cloning failed, use fallback voice
          return getFallbackVoice(figure);
        }
      } else {
        console.error(`Auto-clone-voice API call failed for ${figure.name}:`, response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        // If API call failed, use fallback voice
        return getFallbackVoice(figure);
      }

      // Fallback to preset voices if auto-cloning fails
      return getFallbackVoice(figure);
      
    } catch (error) {
      console.error('Error getting/creating authentic voice:', error);
      console.error('Error details:', error.message || error);
      console.error('Falling back to preset voice for:', figure.name);
      return getFallbackVoice(figure);
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
      
      // Use Coqui XTTS for authentic voice cloning from historical sources
      const { data, error } = await supabase.functions.invoke('coqui-voice-clone', {
        body: { 
          figureName: figure.name,
          figureId: figure.id,
          audioUrl: null // Let the function find historical audio
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
    try {
      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/youtube-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, maxResults: 3 }),
      });

      const data = await response.json();
      
      if (data.success) {
        return data.results;
      } else {
        console.error('YouTube search failed:', data.error);
        return null;
      }
    } catch (error) {
      console.error('Error searching YouTube:', error);
      return null;
    }
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
          
          
          {/* AI Provider Selection */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 flex items-center">
              <Bot className="h-4 w-4 mr-2" />
              AI Provider
            </h3>
            <Select value={selectedAIProvider} onValueChange={(value: 'openai' | 'grok' | 'claude') => setSelectedAIProvider(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">
                  <div className="flex items-center">
                    <span className="mr-2">🧠</span>
                    Claude (Anthropic)
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
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedAIProvider === 'claude'
                ? 'Claude offers intelligent, nuanced responses with superior reasoning'
                : selectedAIProvider === 'openai' 
                ? 'OpenAI provides reliable, well-structured responses'
                : 'Grok offers conversational, real-time aware responses'
              }
            </p>
          </Card>

          {/* Conversation Export */}
          <ConversationExport
            messages={messages}
            selectedFigure={selectedFigure}
          />

          {/* Figure Recommendations */}
          <FigureRecommendations
            selectedFigure={selectedFigure}
            onSelectFigure={(figure) => {
              setSelectedFigure(figure);
              setMessages([]);
              setCurrentConversationId(null);
              setDocuments([]);
            }}
          />

          {/* Figure Recommendations */}
          <FigureRecommendations
            selectedFigure={selectedFigure}
            onSelectFigure={(figure) => {
              setSelectedFigure(figure);
              setMessages([]);
              setCurrentConversationId(null);
              setDocuments([]);
            }}
          />


          {/* Voice Settings - Clean User Interface */}
          <VoiceSettings
            selectedFigure={selectedFigure}
            onVoiceGenerated={(audioUrl) => {
              const audio = new Audio(audioUrl);
              audio.play();
            }}
          />

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

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center">
                <Globe className="mr-2 h-4 w-4" />
                Speech Language
              </label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">🇺🇸 English (US)</SelectItem>
                  <SelectItem value="en-GB">🇬🇧 English (UK)</SelectItem>
                  <SelectItem value="fr-FR">🇫🇷 French</SelectItem>
                  <SelectItem value="de-DE">🇩🇪 German</SelectItem>
                  <SelectItem value="it-IT">🇮🇹 Italian</SelectItem>
                  <SelectItem value="es-ES">🇪🇸 Spanish</SelectItem>
                  <SelectItem value="pt-BR">🇧🇷 Portuguese</SelectItem>
                  <SelectItem value="ru-RU">🇷🇺 Russian</SelectItem>
                  <SelectItem value="ja-JP">🇯🇵 Japanese</SelectItem>
                  <SelectItem value="zh-CN">🇨🇳 Chinese</SelectItem>
                  <SelectItem value="ar-SA">🇸🇦 Arabic</SelectItem>
                  <SelectItem value="hi-IN">🇮🇳 Hindi</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Free browser-based text-to-speech in multiple languages
              </p>
            </div>

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
                // Show pause button during audio playback
                <Button 
                  onClick={handlePauseAudio}
                  size="icon"
                  variant="secondary"
                  className="h-[60px] w-[60px]"
                >
                  <Pause className="h-4 w-4" />
                </Button>
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
                  disabled={!inputMessage.trim()}
                  size="icon"
                  className="h-[60px] w-[60px]"
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