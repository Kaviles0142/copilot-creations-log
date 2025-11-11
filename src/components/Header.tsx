import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";

const Header = () => {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-purple-500/20 bg-gradient-to-r from-purple-50/90 via-blue-50/90 to-indigo-50/90 dark:from-purple-950/40 dark:via-blue-950/40 dark:to-indigo-950/40 backdrop-blur-xl supports-[backdrop-filter]:bg-gradient-to-r shadow-lg">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo - Left */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <span className="hidden sm:inline-block font-semibold text-lg bg-gradient-to-r from-purple-700 to-blue-700 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">HistoryAI</span>
        </div>

        {/* Title - Center */}
        <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent whitespace-nowrap drop-shadow-sm">
            Historical AI Experience
          </h1>
        </div>

        {/* Theme Toggle - Right */}
        <div className="flex items-center min-w-[120px] justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:scale-110 transition-all duration-200 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-blue-400" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;

