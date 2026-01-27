import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Join from "./pages/Join";
import Room from "./pages/Room";
import OldApp from "./pages/OldApp";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Redirect root to join */}
            <Route path="/" element={<Navigate to="/join" replace />} />
            
            {/* Rooms */}
            <Route path="/join" element={<Join />} />
            <Route path="/rooms/:roomCode" element={<Room />} />
            
            {/* Legacy App for reference */}
            <Route path="/old" element={<OldApp />} />
            
            {/* Admin Dashboard */}
            <Route path="/admin" element={<Admin />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
