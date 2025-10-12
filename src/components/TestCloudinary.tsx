import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const TestCloudinary = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const testConnection = async () => {
    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-cloudinary');

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast({
          title: "✅ Cloudinary Connected!",
          description: "Your Cloudinary credentials are working correctly.",
        });
      } else {
        toast({
          title: "❌ Connection Failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: "❌ Test Failed",
        description: error.message || "Failed to test Cloudinary connection",
        variant: "destructive",
      });
      setResult({ success: false, error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Cloudinary Connection Test</CardTitle>
        <CardDescription>
          Test your Cloudinary API credentials and upload capability
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={testConnection} 
          disabled={testing}
          className="w-full"
        >
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>

        {result && (
          <div className="mt-4 p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-3">
              {result.success ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-semibold text-green-700">Success!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700">Failed</span>
                </>
              )}
            </div>

            {result.success ? (
              <div className="space-y-2 text-sm">
                <p><strong>Cloud Name:</strong> {result.cloudName}</p>
                <p><strong>Test Image:</strong></p>
                <img 
                  src={result.testImageUrl} 
                  alt="Test upload" 
                  className="mt-2 border rounded"
                />
                <p className="text-xs text-muted-foreground break-all">
                  {result.testImageUrl}
                </p>
              </div>
            ) : (
              <div className="text-sm text-red-600">
                <p><strong>Error:</strong> {result.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
