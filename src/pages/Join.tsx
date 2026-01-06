import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Join = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createRoom = async () => {
      try {
        const guestId = !user ? `guest_${crypto.randomUUID()}` : null;
        
        const { data, error: insertError } = await supabase
          .from('rooms')
          .insert({
            user_id: user?.id || null,
            guest_id: guestId,
          })
          .select('room_code')
          .single();

        if (insertError) throw insertError;

        navigate(`/rooms/${data.room_code}`, { replace: true });
      } catch (err) {
        console.error('Error creating room:', err);
        setError('Failed to create room. Please try again.');
      }
    };

    createRoom();
  }, [user, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-primary hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Creating your room...</p>
      </div>
    </div>
  );
};

export default Join;
