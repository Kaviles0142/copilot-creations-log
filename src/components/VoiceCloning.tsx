import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Mic, User } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceCloningProps {
  onVoiceCloned?: (voiceId: string, voiceName: string) => void;
}

export const VoiceCloning: React.FC<VoiceCloningProps> = ({ onVoiceCloned }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [voiceName, setVoiceName] = useState('');
  const [description, setDescription] = useState('');
  const [isCloning, setIsCloning] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an audio file
      if (!file.type.startsWith('audio/')) {
        toast.error('Please select an audio file (MP3, WAV, M4A, etc.)');
        return;
      }
      
      // Check file size (max 20MB)
      if (file.size > 20 * 1024 * 1024) {
        toast.error('Audio file must be smaller than 20MB');
        return;
      }
      
      setAudioFile(file);
      toast.success(`Audio file selected: ${file.name}`);
    }
  };

  const handleCloneVoice = async () => {
    if (!audioFile || !voiceName.trim()) {
      toast.error('Please provide both an audio file and voice name');
      return;
    }

    setIsCloning(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('voiceName', voiceName.trim());
      formData.append('description', description.trim());

      console.log('Starting voice cloning process...');
      
      const response = await fetch(
        'https://trclpvryrjlafacocbnd.supabase.co/functions/v1/clone-historical-voice',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Voice cloning failed');
      }

      console.log('Voice cloning successful:', result);
      
      toast.success(`Successfully cloned voice for ${voiceName}!`);
      
      // Reset form
      setAudioFile(null);
      setVoiceName('');
      setDescription('');
      
      // Clear file input
      const fileInput = document.getElementById('audioFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      // Notify parent component
      if (onVoiceCloned) {
        onVoiceCloned(result.voice_id, result.voice_name);
      }

    } catch (error) {
      console.error('Voice cloning error:', error);
      toast.error(error instanceof Error ? error.message : 'Voice cloning failed');
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Clone Historical Voice
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor="voiceName" className="block text-sm font-medium mb-2">
            Historical Figure Name
          </label>
          <Input
            id="voiceName"
            placeholder="e.g., Albert Einstein"
            value={voiceName}
            onChange={(e) => setVoiceName(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-2">
            Description (Optional)
          </label>
          <Textarea
            id="description"
            placeholder="e.g., Cloned from 1940s Princeton interviews"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div>
          <label htmlFor="audioFile" className="block text-sm font-medium mb-2">
            Historical Audio Recording
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="audioFile"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Mic className="h-5 w-5 text-gray-400" />
          </div>
          {audioFile && (
            <p className="text-sm text-green-600 mt-1">
              Selected: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(1)}MB)
            </p>
          )}
        </div>

        <Button
          onClick={handleCloneVoice}
          disabled={!audioFile || !voiceName.trim() || isCloning}
          className="w-full"
        >
          {isCloning ? (
            <>
              <Upload className="h-4 w-4 mr-2 animate-spin" />
              Cloning Voice...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Clone Voice
            </>
          )}
        </Button>

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Upload clear audio recordings of the historical figure</p>
          <p>• Best quality: 1-10 minutes of clean speech</p>
          <p>• Supported formats: MP3, WAV, M4A</p>
          <p>• Max file size: 20MB</p>
        </div>
      </CardContent>
    </Card>
  );
};