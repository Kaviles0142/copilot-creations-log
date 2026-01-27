import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BarChart3, 
  Users, 
  Video, 
  MessageSquare, 
  Server, 
  Play, 
  Square, 
  RefreshCw,
  Lock,
  Activity,
  Database,
  Mic,
  Image
} from 'lucide-react';
import { toast } from 'sonner';

interface Metrics {
  totalConversations: number;
  totalMessages: number;
  totalVideoJobs: number;
  activeRooms: number;
  cachedAvatars: number;
  clonedVoices: number;
  recentVideoJobs: any[];
}

interface ServerStatus {
  id: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown';
  gpuType?: string;
  uptimeSeconds?: number;
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [videoLogs, setVideoLogs] = useState<any[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const [podId, setPodId] = useState('');

  // Simple password check (in production, use proper auth)
  const handleLogin = () => {
    // This is a simple gate - in production use Supabase Auth with role checks
    if (password === 'admin2024') {
      setIsAuthenticated(true);
      localStorage.setItem('admin_authenticated', 'true');
      toast.success('Authenticated successfully');
    } else {
      toast.error('Invalid password');
    }
  };

  useEffect(() => {
    // Check if already authenticated
    if (localStorage.getItem('admin_authenticated') === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch metrics from database
  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const [
        { count: conversationCount },
        { count: messageCount },
        { count: videoJobCount },
        { count: roomCount },
        { count: avatarCount },
        { count: voiceCount },
        { data: recentJobs }
      ] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('video_jobs').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('avatar_image_cache').select('*', { count: 'exact', head: true }),
        supabase.from('cloned_voices').select('*', { count: 'exact', head: true }),
        supabase.from('video_jobs').select('*').order('created_at', { ascending: false }).limit(10)
      ]);

      setMetrics({
        totalConversations: conversationCount || 0,
        totalMessages: messageCount || 0,
        totalVideoJobs: videoJobCount || 0,
        activeRooms: roomCount || 0,
        cachedAvatars: avatarCount || 0,
        clonedVoices: voiceCount || 0,
        recentVideoJobs: recentJobs || []
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch video logs
  const fetchVideoLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('video_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setVideoLogs(data || []);
    } catch (error) {
      console.error('Error fetching video logs:', error);
      toast.error('Failed to fetch video logs');
    }
  };

  // RunPod API functions
  const checkServerStatus = async () => {
    if (!podId) {
      toast.error('Please enter a Pod ID');
      return;
    }
    
    setServerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('runpod-manage', {
        body: { action: 'status', podId }
      });

      if (error) throw error;
      setServerStatus(data);
      toast.success('Server status updated');
    } catch (error) {
      console.error('Error checking server status:', error);
      toast.error('Failed to check server status');
      setServerStatus({ id: podId, status: 'unknown' });
    } finally {
      setServerLoading(false);
    }
  };

  const startServer = async () => {
    if (!podId) {
      toast.error('Please enter a Pod ID');
      return;
    }

    setServerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('runpod-manage', {
        body: { action: 'start', podId }
      });

      if (error) throw error;
      setServerStatus({ id: podId, status: 'starting' });
      toast.success('Server starting...');
      
      // Poll for status
      setTimeout(checkServerStatus, 5000);
    } catch (error) {
      console.error('Error starting server:', error);
      toast.error('Failed to start server');
    } finally {
      setServerLoading(false);
    }
  };

  const stopServer = async () => {
    if (!podId) {
      toast.error('Please enter a Pod ID');
      return;
    }

    setServerLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('runpod-manage', {
        body: { action: 'stop', podId }
      });

      if (error) throw error;
      setServerStatus({ id: podId, status: 'stopping' });
      toast.success('Server stopping...');
      
      // Poll for status
      setTimeout(checkServerStatus, 5000);
    } catch (error) {
      console.error('Error stopping server:', error);
      toast.error('Failed to stop server');
    } finally {
      setServerLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMetrics();
      fetchVideoLogs();
    }
  }, [isAuthenticated]);

  // Login gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>Enter the admin password to continue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button className="w-full" onClick={handleLogin}>
              Authenticate
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500';
      case 'stopped': return 'bg-red-500';
      case 'starting': return 'bg-yellow-500';
      case 'stopping': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'processing': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">System management & monitoring</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              localStorage.removeItem('admin_authenticated');
              setIsAuthenticated(false);
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="server" className="gap-2">
              <Server className="w-4 h-4" />
              Server
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Video className="w-4 h-4" />
              Video Logs
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Overview</h2>
              <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalConversations || 0}</div>
                  <p className="text-xs text-muted-foreground">All time conversations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
                  <Database className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalMessages || 0}</div>
                  <p className="text-xs text-muted-foreground">Messages exchanged</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Video Jobs</CardTitle>
                  <Video className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalVideoJobs || 0}</div>
                  <p className="text-xs text-muted-foreground">Avatar videos generated</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
                  <Users className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.activeRooms || 0}</div>
                  <p className="text-xs text-muted-foreground">Currently active</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Cached Avatars</CardTitle>
                  <Image className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.cachedAvatars || 0}</div>
                  <p className="text-xs text-muted-foreground">Avatar images cached</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Cloned Voices</CardTitle>
                  <Mic className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.clonedVoices || 0}</div>
                  <p className="text-xs text-muted-foreground">Voice clones created</p>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Video Jobs</CardTitle>
                <CardDescription>Latest avatar video generation requests</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Figure</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics?.recentVideoJobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.figure_name || 'Unknown'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <span className={`w-2 h-2 rounded-full ${getStatusColor(job.status)}`} />
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(job.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!metrics?.recentVideoJobs || metrics.recentVideoJobs.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No video jobs yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Server Control Tab */}
          <TabsContent value="server" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">RunPod Server Control</h2>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Avatar Generation Server
                </CardTitle>
                <CardDescription>
                  Manage your RunPod GPU server for avatar video generation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Pod ID Input */}
                <div className="flex gap-4">
                  <Input
                    placeholder="Enter RunPod Pod ID"
                    value={podId}
                    onChange={(e) => setPodId(e.target.value)}
                    className="max-w-md"
                  />
                  <Button 
                    variant="outline" 
                    onClick={checkServerStatus}
                    disabled={serverLoading || !podId}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${serverLoading ? 'animate-spin' : ''}`} />
                    Check Status
                  </Button>
                </div>

                {/* Server Status */}
                {serverStatus && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(serverStatus.status)} animate-pulse`} />
                        <div>
                          <p className="font-medium">Pod: {serverStatus.id}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            Status: {serverStatus.status}
                            {serverStatus.gpuType && ` • GPU: ${serverStatus.gpuType}`}
                          </p>
                        </div>
                      </div>
                      <Activity className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="flex gap-4">
                  <Button 
                    onClick={startServer} 
                    disabled={serverLoading || !podId || serverStatus?.status === 'running'}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Server
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={stopServer}
                    disabled={serverLoading || !podId || serverStatus?.status === 'stopped'}
                    className="gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop Server
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>💡 <strong>Tip:</strong> Find your Pod ID in the RunPod dashboard under "My Pods".</p>
                  <p className="mt-1">Make sure you've added your RUNPOD_API_KEY to Supabase Edge Function Secrets.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Video Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Video Response Logs</h2>
              <Button variant="outline" size="sm" onClick={fetchVideoLogs}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>All Video Jobs</CardTitle>
                <CardDescription>Complete log of avatar video generation requests</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Figure</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Request ID</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {videoLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">
                            {log.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.figure_name || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1">
                              <span className={`w-2 h-2 rounded-full ${getStatusColor(log.status)}`} />
                              {log.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.ditto_request_id ? `${log.ditto_request_id.slice(0, 12)}...` : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-red-500 text-sm">
                            {log.error || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                      {videoLogs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No video logs found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
