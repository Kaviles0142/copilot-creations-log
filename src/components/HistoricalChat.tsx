import { useState, useEffect, useRef } from "react";
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
  const [selectedAIProvider, setSelectedAIProvider] = useState<'openai' | 'grok' | 'claude' | 'azure'>('claude'); // Claude as default
  const [isVoiceChatting, setIsVoiceChatting] = useState(false);
  const [isAutoVoiceEnabled, setIsAutoVoiceEnabled] = useState(true); // Auto-enable voice responses
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [availableFakeYouVoices, setAvailableFakeYouVoices] = useState<any[]>([]);
  const [selectedFakeYouVoice, setSelectedFakeYouVoice] = useState<any | null>(null);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("auto"); // Track voice selection from VoiceSettings
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
  const voiceCreatedForFigure = useRef<string | null>(null);
  
  useEffect(() => {
    if (selectedFigure && voiceCreatedForFigure.current !== selectedFigure.id) {
      voiceCreatedForFigure.current = selectedFigure.id;
      createAuthenticVoice(selectedFigure);
      const figureLanguage = getFigureLanguage(selectedFigure);
      setSelectedLanguage(figureLanguage);
      fetchFakeYouVoicesForFigure(selectedFigure);
    }
  }, [selectedFigure]);

  // Fetch available FakeYou voices for the selected figure
  const fetchFakeYouVoicesForFigure = async (figure: HistoricalFigure) => {
    setIsLoadingVoices(true);
    try {
      console.log('🔍 Fetching FakeYou voices for:', figure.name);
      
      const figureName = figure.name.toLowerCase();
      console.log(`🎯 Figure name: "${figure.name}" (lowercase: "${figureName}")`);
      
      // Build search term for backend
      let searchTerm = '';
      let excludeTerms: string[] = [];
      
      if (figureName.includes('robert') && figureName.includes('kennedy')) {
        searchTerm = 'kennedy';
        excludeTerms = ['john'];
        console.log('🔍 Searching for Robert F. Kennedy voices');
      } else if (figureName.includes('john') && figureName.includes('kennedy')) {
        searchTerm = 'kennedy';
        excludeTerms = ['robert', 'bobby', 'rfk'];
        console.log('🔍 Searching for John F. Kennedy voices');
      } else if (figureName.includes('kennedy')) {
        searchTerm = 'kennedy';
        console.log('🔍 Searching for Kennedy voices');
      } else if (figureName.includes('trump')) {
        searchTerm = 'trump';
        console.log('🔍 Searching for Trump voices');
      } else if (figureName.includes('martin luther king')) {
        searchTerm = 'martin luther king';
        console.log('🔍 Searching for Martin Luther King Jr. voices');
      } else {
        // For other figures, use last significant word
        const words = figureName.split(' ');
        const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'];
        const lastName = words.reverse().find(word => !suffixes.includes(word.toLowerCase()));
        searchTerm = lastName || figureName;
        console.log('🔍 Searching for:', searchTerm);
      }
      
      // Pass search term to backend for more efficient filtering
      const { data: voicesData, error: voicesError } = await supabase.functions.invoke('fakeyou-tts', {
        body: { 
          action: 'list_voices',
          searchTerm: searchTerm
        }
      });

      if (voicesError) {
        console.error('Error fetching voices:', voicesError);
        setAvailableFakeYouVoices([]);
        return;
      }

      let candidateVoices = voicesData.voices || [];
      console.log(`📋 Backend returned ${candidateVoices.length} voices for "${searchTerm}"`);
      
      // Apply client-side exclusions if needed
      const matchingVoices = candidateVoices.filter((voice: any) => {
        const voiceTitle = voice.title.toLowerCase();
        
        // Check exclusions
        for (const excludeTerm of excludeTerms) {
          if (voiceTitle.includes(excludeTerm)) {
            console.log(`❌ Excluded: "${voice.title}" (contains "${excludeTerm}")`);
            return false;
          }
        }
        
        console.log(`✅ Included: "${voice.title}"`);
        return true;
      });
      
      console.log(`✅ Final count: ${matchingVoices.length} matching voices`);
      console.log('📝 All voices:', matchingVoices.map(v => v.title));
      
      
      console.log(`✅ Final FakeYou count: ${matchingVoices.length} voices`);
      
      // Combine all voices from different providers
      const allVoices = [...matchingVoices.map((v: any) => ({ ...v, provider: 'fakeyou' }))];
      
      // Add ElevenLabs voices - search their library dynamically
      try {
        console.log('🔍 Searching ElevenLabs for:', figure.name);
        // Note: ElevenLabs voice search would go here when API supports it
        // For now, keeping hardcoded authentic voices for specific figures
        const figureSpecificVoices: Record<string, { voiceId: string; title: string }> = {
          'john-f-kennedy': { voiceId: '2vubyVoGjNJ5HPga4SkV', title: `${figure.name} (ElevenLabs - Authentic)` },
          'martin-luther-king-jr': { voiceId: '2ts4Q14DjMa5I5EgteS4', title: `${figure.name} (ElevenLabs - Authentic)` },
        };
        
        if (figureSpecificVoices[figure.id]) {
          const specificVoice = figureSpecificVoices[figure.id];
          allVoices.push({
            voiceToken: `elevenlabs_${figure.id}_authentic`,
            title: specificVoice.title,
            provider: 'elevenlabs',
            voiceId: specificVoice.voiceId
          });
          console.log(`✅ Added ElevenLabs voice for ${figure.name}`);
        } else {
          console.log('ℹ️ No ElevenLabs voices configured for', figure.name);
        }
      } catch (error) {
        console.log('⚠️ ElevenLabs search failed (possibly no credits):', error);
      }
      
      // Add cloned voices from database (all providers)
      try {
        console.log('🔍 Searching database for cloned voices:', figure.name);
        const { data: clonedVoices, error: clonedError } = await supabase
          .from('cloned_voices')
          .select('voice_id, voice_name, provider')
          .eq('figure_id', figure.id)
          .eq('is_active', true);

        if (!clonedError && clonedVoices && clonedVoices.length > 0) {
          console.log(`✅ Found ${clonedVoices.length} cloned voices for ${figure.name}`);
          clonedVoices.forEach((voice: any) => {
            allVoices.push({
              voiceToken: `${voice.provider}_${voice.voice_id}`,
              title: voice.voice_name, // Use the voice_name from database directly
              provider: voice.provider,
              voiceId: voice.voice_id
            });
          });
        } else {
          console.log('ℹ️ No cloned voices found for', figure.name);
        }
      } catch (error) {
        console.log('⚠️ Database voice search failed:', error);
      }
      
      // Always add fallback voices from multiple providers
      const isMale = detectGender(figure);
      
      // Check if Resemble marketplace voice already exists
      const hasResembleMarketplace = allVoices.some(v => v.provider === 'resemble' && v.voiceId.includes('marketplace'));
      
      if (!hasResembleMarketplace) {
        // Add Resemble AI fallback voice (British accent)
        allVoices.push({
          voiceToken: `resemble_marketplace_${isMale ? 'male' : 'female'}`,
          title: `${figure.name} (Resemble AI - British Voice)`,
          provider: 'resemble',
          voiceId: isMale ? '0f2e6952' : '02fc35a6'
        });
        console.log(`📢 Added Resemble AI voice: ${isMale ? '0f2e6952 (male British)' : '02fc35a6 (female)'}`);
      }
      
      // Add FakeYou generic fallback voices (not character-specific)
      const hasFakeYouGeneric = allVoices.some(v => v.provider === 'fakeyou' && v.voiceToken.includes('generic'));
      
      if (!hasFakeYouGeneric) {
        // Add a generic male/female FakeYou voice (American accent)
        allVoices.push({
          voiceToken: `fakeyou_generic_${isMale ? 'male' : 'female'}`,
          title: `${figure.name} (FakeYou - American Voice)`,
          provider: 'fakeyou',
          voiceId: isMale ? 'weight_8r5ycvxqpbqvn90v9mh8p72yf' : 'TM:a3b2c1d4e5f6' // Using Morgan Freeman voice as American male fallback
        });
        console.log(`📢 Added FakeYou generic fallback voice`);
      }
      
      console.log(`📊 Total voices from all providers: ${allVoices.length}`);
      
      setAvailableFakeYouVoices(allVoices);
      
      if (allVoices.length > 0) {
        setSelectedFakeYouVoice(allVoices[0]);
        console.log(`🎙️ Auto-selected: "${allVoices[0].title}" (${allVoices[0].provider})`);
      } else {
        setSelectedFakeYouVoice(null);
      }
      
      
    } catch (error) {
      console.error('❌ Error:', error);
      setAvailableFakeYouVoices([]);
      setSelectedFakeYouVoice(null);
    } finally {
      setIsLoadingVoices(false);
    }
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

      // Generate voice using the selected voice from VoiceSettings
      if (isAutoVoiceEnabled && aiResponse.length > 20) {
        console.log('🎙️ Starting voice generation for:', selectedFigure!.name);
        console.log('🎯 Using voice ID:', selectedVoiceId);
        
        generateVoiceWithSelection(aiResponse, selectedFigure!, selectedVoiceId).catch(voiceError => {
          console.error('Voice generation failed:', voiceError);
          toast({
            title: "FakeYou unavailable, switching to backup TTS",
            description: "Using fallback voice",
            variant: "default",
            duration: 3000,
          });
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

      // If voice starts with "resemble-", use Resemble AI
      if (voiceId.startsWith('resemble-')) {
        const resembleVoiceId = voiceId.replace('resemble-', '');
        console.log('🎤 Using Resemble AI with voice:', resembleVoiceId);
        
        const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
          body: { 
            text: text,
            voice: resembleVoiceId,
            figure_name: figure.name
          }
        });

        if (error || !data?.audioContent) {
          throw new Error('Resemble AI TTS failed');
        }

        console.log('✅ Successfully used Resemble AI TTS');
        playAudioFromBase64(data.audioContent);
        return;
      }

      // Otherwise use ElevenLabs (or check for cloned voice if "auto")
      if (voiceId === "auto") {
        // Check for cloned voice
        const { data: clonedVoiceData } = await supabase
          .from('cloned_voices')
          .select('voice_id')
          .eq('figure_id', figure.id)
          .eq('is_active', true)
          .limit(1);

        if (clonedVoiceData && clonedVoiceData.length > 0) {
          voiceId = clonedVoiceData[0].voice_id;
          console.log('🎯 Using CLONED voice:', voiceId, 'for', figure.name);
        } else {
          // Use default voice for this figure from VoiceSettings mapping
          voiceId = figure.name; // This will be mapped in elevenlabs-text-to-speech
        }
      }

      console.log('🎤 Using ElevenLabs TTS with voice:', voiceId);
      
      const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
        body: { 
          text: text,
          voice: voiceId
        }
      });

      if (error || !data?.audioContent) {
        throw new Error('ElevenLabs TTS failed');
      }

      console.log('✅ Successfully used ElevenLabs TTS');
      playAudioFromBase64(data.audioContent);
      
    } catch (error) {
      console.error('Error generating voice with selection:', error);
      throw error;
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

      // Priority 1: Check if FakeYou has a voice for this figure
      if (availableFakeYouVoices && availableFakeYouVoices.length > 0) {
        console.log(`🎯 FakeYou voices available (${availableFakeYouVoices.length}), using FakeYou as PRIMARY`);
        
        // Use the first FakeYou voice (or selected one if available)
        const voiceToUse = selectedFakeYouVoice || availableFakeYouVoices[0];
        
        try {
          // Temporarily set selected voice if not already set
          const wasSelected = selectedFakeYouVoice;
          if (!wasSelected) {
            setSelectedFakeYouVoice(voiceToUse);
          }
          
          await generateFakeYouVoice(text, figure);
          console.log('✅ FakeYou TTS successful');
          return;
        } catch (fakeYouError) {
          console.log('❌ FakeYou TTS failed, falling back to Resemble AI:', fakeYouError);
        }
      } else {
        console.log('ℹ️ No FakeYou voices available, will use Resemble AI fallback');
      }

      // Priority 2: Fallback to Resemble AI marketplace voices
      console.log('🎤 Using Resemble AI marketplace voice as fallback...');
      generatePremiumSpeech(text, figure).then(() => {
        console.log('✅ Resemble AI TTS successful');
      }).catch((premiumError) => {
        console.log('❌ Resemble AI TTS failed, falling back to browser speech:', premiumError);
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

  const generateFakeYouVoice = async (text: string, figure: HistoricalFigure) => {
    try {
      console.log('🎤 Generating voice for:', figure.name);
      
      // Check if a voice is selected
      if (!selectedFakeYouVoice) {
        console.log('❌ No voice selected');
        toast({
          title: "No voice selected",
          description: `Please select a voice for ${figure.name} from the dropdown`,
          variant: "destructive",
          duration: 4000,
        });
        throw new Error('No voice selected');
      }
      
      // Check which provider to use
      if (selectedFakeYouVoice.provider === 'resemble') {
        console.log(`✅ Using Resemble AI voice: "${selectedFakeYouVoice.title}"`);
        
        toast({
          title: "Generating Resemble AI voice",
          description: `Using "${selectedFakeYouVoice.title}"...`,
          duration: 3000,
        });
        
        const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
          body: { 
            text: text,
            voice: selectedFakeYouVoice.voiceId,
            figure_name: figure.name
          }
        });

        if (error) {
          console.error('❌ Resemble AI TTS Error:', error);
          throw error;
        }

        if (!data?.audioContent) {
          console.error('❌ No audio content received from Resemble AI');
          throw new Error('No audio content');
        }

        console.log('✅ Resemble AI TTS successful');
        playAudioFromBase64(data.audioContent);
        return;
      }
      
      if (selectedFakeYouVoice.provider === 'elevenlabs') {
        console.log(`✅ Using ElevenLabs voice: "${selectedFakeYouVoice.title}"`);
        
        toast({
          title: "Generating ElevenLabs voice",
          description: `Using "${selectedFakeYouVoice.title}"...`,
          duration: 3000,
        });
        
        const { data, error } = await supabase.functions.invoke('elevenlabs-text-to-speech', {
          body: { 
            text: text,
            voice: selectedFakeYouVoice.voiceId // Use the voice ID directly
          }
        });

        if (error) {
          console.error('❌ ElevenLabs TTS Error:', error);
          throw error;
        }

        if (!data?.audioContent) {
          console.error('❌ No audio content received from ElevenLabs');
          throw new Error('No audio content');
        }

        console.log('✅ ElevenLabs TTS successful');
        playAudioFromBase64(data.audioContent);
        return;
      }
      
      // Otherwise use FakeYou
      toast({
        title: "Preparing voice response",
        description: `Using "${selectedFakeYouVoice.title}" - this takes about 10-15 seconds...`,
        duration: 4000,
      });
      
      console.log(`✅ Using FakeYou voice: "${selectedFakeYouVoice.title}"`);
      
      // Step 3: Generate TTS
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('fakeyou-tts', {
        body: {
          action: 'generate_tts',
          text: text.substring(0, 2000), // Increased limit for longer responses
          voiceToken: selectedFakeYouVoice.voiceId, // Use voiceId instead of voiceToken for FakeYou
        },
      });
      
      if (ttsError) {
        console.error('TTS generation request error:', ttsError);
        throw ttsError;
      }
      if (!ttsData.success) {
        console.error('TTS generation failed:', ttsData);
        throw new Error('TTS generation failed');
      }
      
      const jobToken = ttsData.jobToken;
      console.log('🔄 TTS job started:', jobToken);
      
      toast({
        title: "Generating speech",
        description: "This may take 10-30 seconds...",
        duration: 3000,
      });
      
      // Step 4: Poll for completion with progress feedback
      let pollCount = 0;
      const maxPolls = 40; // 40 seconds max
      
      for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        pollCount++;
        
        const { data: statusData, error: statusError } = await supabase.functions.invoke('fakeyou-tts', {
          body: {
            action: 'check_status',
            jobToken: jobToken,
          },
        });
        
        if (statusError) {
          console.error('Status check error:', statusError);
          throw statusError;
        }
        if (!statusData.success) {
          console.error('Status check failed:', statusData);
          throw new Error('Status check failed');
        }
        
        console.log(`⏳ Polling (${pollCount}/${maxPolls}): ${statusData.status}`);
        
        // Show progress every 5 seconds
        if (pollCount % 5 === 0) {
          toast({
            title: "Still generating",
            description: `${pollCount} seconds elapsed...`,
            duration: 2000,
          });
        }
        
        if (statusData.isComplete && statusData.audioUrl) {
          console.log('✅ FakeYou audio ready:', statusData.audioUrl);
          
          // Convert old Google Storage URLs to new CDN-2 format
          let audioUrl = statusData.audioUrl;
          if (audioUrl.includes('storage.googleapis.com/vocodes-public')) {
            audioUrl = audioUrl.replace('https://storage.googleapis.com/vocodes-public', 'https://cdn-2.fakeyou.com');
            console.log('🔄 Converted to CDN URL:', audioUrl);
          }
          
          toast({
            title: "Voice ready!",
            description: `Playing ${figure.name}'s authentic voice`,
            duration: 2000,
          });
          
          // Try direct access to cdn-2.fakeyou.com URLs
          console.log('🎵 Final Audio URL:', audioUrl);
          console.log('🔗 Attempting direct audio access...');
          
          const audio = new Audio();
          audio.crossOrigin = 'anonymous';
          audio.src = audioUrl;
          
          // Slow down playback for more natural, conversational pacing
          audio.playbackRate = 0.85;
          
          audio.onloadeddata = () => {
            console.log('📡 Audio loaded, starting playback at 0.85x speed for natural conversation');
            audio.play().then(() => {
              setIsPlayingAudio(true);
              setCurrentAudio(audio);
              console.log('🔊 FakeYou voice playing');
            }).catch(err => {
              console.error('❌ Audio playback failed:', err);
              setIsPlayingAudio(false);
              throw err;
            });
          };
          
          audio.onerror = (e) => {
            console.error('❌ Audio load failed:', e);
            setIsPlayingAudio(false);
            
            toast({
              title: "Audio playback error",
              description: "Failed to load audio file",
              variant: "destructive",
            });
          };
          
          audio.onended = () => {
            console.log('✅ Audio playback completed');
            setIsPlayingAudio(false);
            setCurrentAudio(null);
          };
          
          return; // Success!
        }
        
        if (statusData.isFailed) {
          console.error('❌ TTS generation failed on FakeYou servers');
          throw new Error('TTS generation failed');
        }
      }
      
      // Timeout
      console.error('⏱️ TTS generation timeout after', maxPolls, 'seconds');
      throw new Error('TTS timeout - generation took too long');
      
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
    if (femaleNames.some(name => figureName.includes(name))) return false;
    
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
      // Check for existing cloned Resemble voice
      const { data: existingVoices } = await supabase
        .from('cloned_voices')
        .select('voice_id, provider')
        .eq('figure_id', figure.id)
        .eq('is_active', true)
        .limit(1);
      
      const clonedVoice = existingVoices?.[0];
      
      // If we have a Resemble cloned voice, use it
      if (clonedVoice && clonedVoice.provider === 'resemble') {
        console.log(`🎯 Using Resemble CLONED voice: ${clonedVoice.voice_id} for ${figure.name}`);
        
        const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
          body: { 
            text: text,
            voice: clonedVoice.voice_id,
            figure_name: figure.name
          }
        });

        // If Resemble works, use it
        if (!error && data?.audioContent) {
          console.log('✅ Successfully used Resemble cloned voice');
          playAudioFromBase64(data.audioContent);
          return;
        } else {
          console.warn('❌ Resemble cloned voice failed, trying marketplace:', error);
        }
      }
      
      // No cloned voice, use Resemble marketplace fallback voices
      console.log(`🎵 Using Resemble AI marketplace fallback for ${figure.name}`);
      
      // Detect gender for marketplace voice selection
      const isMale = detectGender(figure);
      const marketplaceVoice = isMale ? 'arthur_marketplace' : 'niki_marketplace';
      
      console.log(`🎭 Detected gender: ${isMale ? 'male' : 'female'}, using ${marketplaceVoice}`);
      
      const { data, error } = await supabase.functions.invoke('resemble-text-to-speech', {
        body: { 
          text: text,
          voice: marketplaceVoice,
          figure_name: figure.name
        }
      });

      if (error) {
        console.error('❌ Resemble marketplace TTS Error:', error);
        throw error;
      }

      if (!data?.audioContent) {
        console.error('❌ No audio content received from Resemble TTS');
        throw new Error('No audio content');
      }

      console.log('✅ Resemble marketplace voice TTS successful');
      playAudioFromBase64(data.audioContent);
      
    } catch (error) {
      console.error('Error in generatePremiumSpeech:', error);
      throw error;
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
          audioUrl: null // Let it create fallback voice with Resemble marketplace
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
      
      // Use Resemble AI for authentic voice cloning from historical sources
      const { data, error } = await supabase.functions.invoke('resemble-voice-clone', {
        body: { 
          figureName: figure.name,
          figureId: figure.id,
          audioUrl: null // Let the function find historical audio or use marketplace fallback
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
            <Select value={selectedAIProvider} onValueChange={(value: 'openai' | 'grok' | 'claude' | 'azure') => setSelectedAIProvider(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card z-50">
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
                <SelectItem value="azure">
                  <div className="flex items-center">
                    <span className="mr-2">🔷</span>
                    Azure OpenAI (Bing)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedAIProvider === 'claude'
                ? 'Claude offers intelligent, nuanced responses with superior reasoning'
                : selectedAIProvider === 'openai' 
                ? 'OpenAI provides reliable, well-structured responses'
                : selectedAIProvider === 'azure'
                ? 'Azure OpenAI powered by Bing for enterprise-grade AI'
                : 'Grok offers conversational, real-time aware responses'
              }
            </p>
          </Card>

          {/* Voice Selection */}
          {selectedFigure && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3 flex items-center">
                <Volume2 className="h-4 w-4 mr-2" />
                Voice Selection
              </h3>
              {isLoadingVoices ? (
                <div className="text-sm text-muted-foreground">
                  Loading voices...
                </div>
              ) : availableFakeYouVoices.length > 0 ? (
                <>
                  <Select 
                    value={selectedFakeYouVoice?.voiceToken} 
                    onValueChange={(token) => {
                      const voice = availableFakeYouVoices.find(v => v.voiceToken === token);
                      setSelectedFakeYouVoice(voice);
                      toast({
                        title: "Voice selected",
                        description: `Now using "${voice?.title}"`,
                        duration: 2000,
                      });
                    }}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {availableFakeYouVoices.map((voice) => (
                        <SelectItem key={voice.voiceToken} value={voice.voiceToken}>
                          {voice.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    {availableFakeYouVoices.length} voice{availableFakeYouVoices.length !== 1 ? 's' : ''} available for {selectedFigure.name}
                    {selectedFakeYouVoice && ` • ${selectedFakeYouVoice.provider === 'resemble' ? 'Resemble AI' : selectedFakeYouVoice.provider === 'elevenlabs' ? 'ElevenLabs' : 'FakeYou'}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No FakeYou voices found for {selectedFigure.name}
                </p>
              )}
            </Card>
          )}

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
            onVoiceSelected={(voiceId) => {
              console.log('Voice selected:', voiceId);
              setSelectedVoiceId(voiceId);
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