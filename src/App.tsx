import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Landing from "./pages/Landing";
import Join from "./pages/Join";
import Room from "./pages/Room";
import OldApp from "./pages/OldApp";
import Admin from "./pages/Admin";
import TestAvatars from "./pages/TestAvatars";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Landing page */}
            <Route path="/" element={<Landing />} />
            
            {/* Rooms */}
            <Route path="/join" element={<Join />} />
            <Route path="/rooms/:roomCode" element={<Room />} />
            
            {/* Legacy App for reference */}
            <Route path="/old" element={<OldApp />} />
            
            {/* Admin Dashboard */}
            <Route path="/admin" element={<Admin />} />
            
            {/* Test Avatars */}
            <Route path="/test-avatars" element={<TestAvatars />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
