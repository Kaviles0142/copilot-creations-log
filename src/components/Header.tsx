import { Moon, Sun, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/signin");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-purple-500/20 bg-gradient-to-r from-purple-50/90 via-blue-50/90 to-indigo-50/90 dark:from-purple-950/40 dark:via-blue-950/40 dark:to-indigo-950/40 backdrop-blur-xl supports-[backdrop-filter]:bg-gradient-to-r shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        {/* Logo - Left */}
        <Link to="/" className="flex items-center gap-2 min-w-[120px]">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200">
            <span className="text-white font-bold text-xl">H</span>
          </div>
          <span className="hidden sm:inline-block font-semibold text-lg bg-gradient-to-r from-purple-700 to-blue-700 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">HistoryAI</span>
        </Link>

        {/* Title - Center */}
        <div className="absolute left-1/2 transform -translate-x-1/2 hidden md:block">
          <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent whitespace-nowrap drop-shadow-sm">
            Historical AI Experience
          </h1>
        </div>

        {/* Right Side - Theme Toggle & User Menu */}
        <div className="flex items-center gap-2 min-w-[120px] justify-end">
          {/* Theme Toggle */}
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

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:scale-110 transition-all duration-200 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.user_metadata?.full_name || 'User'}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 dark:text-red-400 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/signin">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-700"
              >
                <UserIcon className="h-4 w-4 mr-2" />
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

