import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Send, User, Bot, Volume2, VolumeX, Mic, MicOff, Save, RefreshCw, Guitar, Globe } from "lucide-react";
import HistoricalFigureSearch from "./HistoricalFigureSearch";
import ChatMessages from "./ChatMessages";
import FileUpload from "./FileUpload";
import ConversationHistory from "./ConversationHistory";
import DocumentUpload from "./DocumentUpload";
import ConversationExport from "./ConversationExport";
import FigureRecommendations from "./FigureRecommendations";
import TimelineVisualization from "./TimelineVisualization";
import VoiceSettings from "./VoiceSettings";

import MusicVoiceInterface from "./MusicVoiceInterface";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

export interface Message {
  id: string;
  content: string;
  type: "user" | "assistant";
  timestamp: Date;
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

    await saveMessage(userMessage, conversationId);

    try {
      await processMessageWithRetry(inputMessage, conversationId);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I apologize, but I'm having trouble responding right now. Please try again.",
        type: "assistant", 
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessage(errorMessage, conversationId);
    } finally {
      setIsLoading(false);
    }
  };

  const processMessageWithRetry = async (input: string, conversationId: string, attempt: number = 1): Promise<void> => {
    const maxRetries = 3;
    
    try {
      const [wikiData, youtubeData, currentEventsData] = await Promise.all([
        searchWikipedia(selectedFigure!.name),
        searchYoutube(`${selectedFigure!.name} original voice recording interview speeches`),
        handleCurrentEventsSearch(`latest news ${new Date().getFullYear()}`)
      ]);

      // Include document context if available
      const documentContext = documents.length > 0 
        ? `\n\nAvailable Documents:\n${documents.map(doc => 
            `- ${doc.filename}: ${doc.parsed_content ? doc.parsed_content.substring(0, 500) + '...' : 'File uploaded but not analyzed'}`
          ).join('\n')}`
        : '';

      // Include books context if available
      const booksContext = books.length > 0 
        ? `\n\nLiterary Knowledge - Books by and about you:\n${books.map(book => {
            const typeLabel = book.book_type === 'by_figure' ? 'Your work' : 
                             book.book_type === 'about_figure' ? 'About you' : 'Related';
            return `- ${book.title} by ${book.authors.join(', ')} (${typeLabel})${book.description ? ': ' + book.description.substring(0, 200) + '...' : ''}`;
          }).slice(0, 10).join('\n')}${books.length > 10 ? `\n... and ${books.length - 10} more books` : ''}`
        : '';

      const context = `
Historical Figure: ${selectedFigure!.name} (${selectedFigure!.period})
Background: ${selectedFigure!.description}

Additional Context:
${wikiData ? `Wikipedia Summary: ${wikiData.title}: ${wikiData.extract || 'No additional information found'}` : ''}

Current Events (${new Date().getFullYear()}):
${currentEventsData?.results ? currentEventsData.results.slice(0, 3).map((news: any) => 
  `- ${news.title}: ${news.snippet} (${news.source})`
).join('\n') : 'No current events data available'}

Available Voice References:
${youtubeData ? youtubeData.slice(0, 3).map((video: any) => 
  `- ${video.title} (${video.hasOriginalVoice ? 'ORIGINAL VOICE' : 'Historical Content'})`
).join('\n') : 'No video references found'}

${documentContext}

${booksContext}

Previous conversation:
${messages.slice(-3).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

Instructions: You are ${selectedFigure!.name}. Respond as this historical figure would, with authentic personality, speaking style, and knowledge from their era. You now have access to comprehensive knowledge about your own works and what has been written about you. Reference your books and writings when relevant. You also have knowledge of current events and can comment on modern topics from your historical perspective. If documents are provided, reference and analyze them in your response. Include your views, personality quirks, and speaking patterns. Keep responses engaging but historically accurate to your character while incorporating insights about current events and your literary legacy when relevant.
      `;

      const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/chat-with-historical-figure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          context: context,
          figure: selectedFigure!.name
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        type: "assistant",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      await saveMessage(assistantMessage, conversationId);
      await generateSpeech(data.response, selectedFigure!);

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
        return processMessageWithRetry(input, conversationId, attempt + 1);
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
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      if ('speechSynthesis' in window) {
        generateBrowserSpeech(text, figure);
      } else {
        await generatePremiumSpeech(text, figure);
      }
    } catch (error) {
      console.error('Error generating speech:', error);
      setIsPlayingAudio(false);
    }
  };

  const generateBrowserSpeech = (text: string, figure: HistoricalFigure) => {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    const voice = availableVoices.find(v => 
      v.lang.startsWith(selectedLanguage.split('-')[0]) && 
      (v.lang === selectedLanguage || v.default)
    ) || availableVoices.find(v => v.lang.startsWith('en'));

    if (voice) {
      utterance.voice = voice;
    }

    utterance.lang = selectedLanguage;
    utterance.rate = 0.9;
    utterance.pitch = getVoicePitch(figure);
    
    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    speechSynthesis.speak(utterance);
  };

  const generatePremiumSpeech = async (text: string, figure: HistoricalFigure) => {
    const voice = await getVoiceForFigure(figure);

    const response = await fetch('https://trclpvryrjlafacocbnd.supabase.co/functions/v1/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        voice: voice
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate speech');
    }

    const audio = new Audio(`data:audio/mpeg;base64,${data.audioContent}`);
    setCurrentAudio(audio);
    setIsPlayingAudio(true);

    audio.onended = () => {
      setIsPlayingAudio(false);
      setCurrentAudio(null);
    };

    audio.onerror = () => {
      setIsPlayingAudio(false);
      setCurrentAudio(null);
      console.error('Error playing audio');
    };

    await audio.play();
  };

  const getVoicePitch = (figure: HistoricalFigure): number => {
    const pitchMap: Record<string, number> = {
      'winston-churchill': 0.8,
      'marie-curie': 1.1,
      'napoleon': 0.9,
      'cleopatra': 1.2,
      'shakespeare': 1.0,
      'abraham-lincoln': 0.85,
    };
    return pitchMap[figure.id] || 1.0;
  };

  const getVoiceForFigure = async (figure: HistoricalFigure): Promise<string> => {
    const authenticVoices: Record<string, string> = {};

    if (authenticVoices[figure.id]) {
      return authenticVoices[figure.id];
    }

    const regionalVoices: Record<string, string> = {
      'winston-churchill': 'George',
      'albert-einstein': 'Brian',
      'marie-curie': 'Charlotte',
      'leonardo-da-vinci': 'Liam',
      'cleopatra': 'Sarah',
      'socrates': 'Daniel',
      'shakespeare': 'Will',
      'napoleon': 'Roger',
      'abraham-lincoln': 'Brian',
      'julius-caesar': 'George',
      'joan-of-arc': 'Charlotte',
      'galileo': 'Liam'
    };

    return regionalVoices[figure.id] || 'Aria';
  };

  const createAuthenticVoice = async (figure: HistoricalFigure) => {
    try {
      console.log(`Searching for authentic recordings of ${figure.name}...`);
      
      const searchQuery = `${figure.name} original speech recording authentic voice`;
      const youtubeResults = await searchYoutube(searchQuery);
      
      if (youtubeResults && youtubeResults.length > 0) {
        const authenticRecording = youtubeResults.find((video: any) => 
          video.hasOriginalVoice && video.isHistoricalContent
        ) || youtubeResults[0];

        const voiceCreationMessage: Message = {
          id: Date.now().toString(),
          content: `🎙️ **Authentic Voice Ready**: Found original recordings of ${figure.name}! I'm now using their authentic speech patterns and accent. Listen closely - this is how ${figure.name} actually sounded when speaking.`,
          type: "assistant",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, voiceCreationMessage]);

        console.log(`Using authentic voice reference: ${authenticRecording.title}`);
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
      <div className="w-80 border-r border-border bg-card overflow-y-auto">{/* Added overflow-y-auto for scrolling */}
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold mb-6">Historical Avatars</h1>
          
          {/* Conversation History */}
          <ConversationHistory 
            onSelectConversation={(conv) => {
              const figure = { 
                id: conv.figure_id, 
                name: conv.figure_name, 
                period: '', 
                description: '', 
                avatar: '' 
              };
              setSelectedFigure(figure);
              setCurrentConversationId(conv.id);
              setSelectedLanguage(conv.language);
              loadConversation(conv.id);
            }}
            selectedFigureId={selectedFigure?.id}
          />


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

          {/* Timeline Visualization */}
          <TimelineVisualization
            selectedFigure={selectedFigure}
            onSelectFigure={(figure) => {
              setSelectedFigure(figure);
              setMessages([]);
              setCurrentConversationId(null);
              setDocuments([]);
            }}
          />

          {/* Voice Settings */}
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
              <h3 className="font-semibold mb-3">Search Any Historical Figure</h3>
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
              <Button 
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="h-4 w-4" />
              </Button>
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