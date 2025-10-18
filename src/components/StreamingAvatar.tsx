import { useEffect, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface StreamingAvatarProps {
  avatarId?: string;
  onReady?: () => void;
  onError?: (error: string) => void;
}

export const StreamingAvatar = ({ avatarId, onReady, onError }: StreamingAvatarProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const channelRef = useRef<string | null>(null);

  useEffect(() => {
    if (!avatarId) return;

    let mounted = true;

    const connectToAvatar = async () => {
      try {
        setIsConnecting(true);
        setError(null);

        console.log('🎭 Connecting to streaming avatar...');

        // Get Agora token from A2E
        const { data: tokenData, error: tokenError } = await supabase.functions.invoke('a2e-get-stream-token', {
          body: { avatar_id: avatarId, expire_seconds: 3600 }
        });

        if (tokenError || !tokenData) {
          throw new Error('Failed to get streaming token');
        }

        console.log('✅ Token received:', tokenData);

        const { appId, channel, token, uid } = tokenData;
        channelRef.current = channel;

        // Create Agora client
        const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
        clientRef.current = client;

        // Set as audience (viewer)
        client.setClientRole("audience");

        // Handle remote user published
        client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType) => {
          console.log('📺 Remote user published:', mediaType);
          
          await client.subscribe(user, mediaType);
          console.log('✅ Subscribed to', mediaType);

          if (mediaType === "video" && videoContainerRef.current) {
            const remoteVideoTrack = user.videoTrack;
            if (remoteVideoTrack) {
              remoteVideoTrack.play(videoContainerRef.current);
              console.log('▶️ Playing remote video');
            }
          }

          if (mediaType === "audio") {
            const remoteAudioTrack = user.audioTrack;
            if (remoteAudioTrack) {
              remoteAudioTrack.play();
              console.log('🔊 Playing remote audio');
            }
          }
        });

        // Handle user unpublished
        client.on("user-unpublished", (user) => {
          console.log('📴 Remote user unpublished');
        });

        // Join the channel
        await client.join(appId, channel, token, uid);
        console.log('✅ Joined Agora channel');

        if (mounted) {
          setIsConnected(true);
          setIsConnecting(false);
          onReady?.();
        }

      } catch (err) {
        console.error('❌ Error connecting to streaming avatar:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to connect';
        if (mounted) {
          setError(errorMsg);
          setIsConnecting(false);
          onError?.(errorMsg);
        }
      }
    };

    connectToAvatar();

    return () => {
      mounted = false;
      
      // Cleanup
      if (clientRef.current) {
        clientRef.current.leave();
        clientRef.current.removeAllListeners();
        clientRef.current = null;
      }
    };
  }, [avatarId, onReady, onError]);

  // Method to make avatar speak
  const speak = async (text: string) => {
    if (!channelRef.current) {
      console.error('❌ No active channel');
      return;
    }

    try {
      console.log('🗣️ Sending text to avatar...');
      
      const { error } = await supabase.functions.invoke('a2e-avatar-speak', {
        body: {
          channel: channelRef.current,
          text,
        }
      });

      if (error) {
        throw error;
      }

      console.log('✅ Avatar speaking command sent');
    } catch (err) {
      console.error('❌ Error making avatar speak:', err);
    }
  };

  // Expose speak method
  useEffect(() => {
    if (isConnected) {
      (window as any).avatarSpeak = speak;
    }
  }, [isConnected]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-secondary/20 rounded-lg">
        <div className="text-center p-6">
          <p className="text-destructive mb-2">Failed to connect to avatar</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <div 
        ref={videoContainerRef} 
        className="w-full h-full"
        style={{ minHeight: '480px' }}
      />
      
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
            <p className="text-white">Connecting to avatar...</p>
          </div>
        </div>
      )}

      {!isConnected && !isConnecting && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
          <p className="text-white text-lg">Waiting for avatar...</p>
        </div>
      )}
    </div>
  );
};

export default StreamingAvatar;
