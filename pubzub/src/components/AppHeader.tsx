import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, Moon, Sun, Info, Users } from 'lucide-react';
import { UserProfile } from '@/types/publication';
import { PubZubLogo } from './PubZubLogo';
import { ProfileSettingsModal } from './ProfileSettingsModal';
import { PaletteSelector } from './PaletteSelector';
import { useTheme } from 'next-themes';

interface AppHeaderProps {
  title: string;
  subtitle: string;
  profile?: UserProfile | null;
  onSignOut?: () => void;
  onProfileUpdated?: () => void;
  onOpenTeams?: () => void;
  teamInvitationCount?: number;
}

export function AppHeader({ title, subtitle, profile, onSignOut, onProfileUpdated, onOpenTeams, teamInvitationCount = 0 }: AppHeaderProps) {
  const { theme, setTheme } = useTheme();
  const [showSettings, setShowSettings] = useState(false);

  const getInitials = () => {
    if (profile?.displayName) {
      return profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return 'U';
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border flex-shrink-0">
        <div className="max-w-[1440px] mx-auto px-2 py-2 md:px-4 md:py-3 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Logo */}
            <PubZubLogo size={28} className="md:w-8 md:h-8" />
            
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-base md:text-xl leading-tight tracking-tight">
                {title}
              </h1>
              <p className="text-muted-foreground text-[10px] md:text-xs mt-0.5 hidden sm:block">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Teams Button */}
            {profile && onOpenTeams && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenTeams}
                className="relative"
                title="Teams"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Teams</span>
                {teamInvitationCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                  >
                    {teamInvitationCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* Palette Selector */}
            <PaletteSelector />
            
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>

            {/* User Menu */}
            {profile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
                      <AvatarFallback className="text-xs">{getInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden sm:inline">{profile.displayName || 'User'}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5 text-sm">
                    <p className="font-medium">{profile.displayName || 'User'}</p>
                    {profile.universityAffiliation && (
                      <p className="text-muted-foreground text-xs truncate mt-0.5">
                        {profile.universityAffiliation}
                      </p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowSettings(true)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <Link to="/about">
                    <DropdownMenuItem>
                      <Info className="w-4 h-4 mr-2" />
                      About PubZub
                    </DropdownMenuItem>
                  </Link>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onSignOut} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      {/* Profile Settings Modal */}
      {profile && (
        <ProfileSettingsModal
          open={showSettings}
          onOpenChange={setShowSettings}
          profile={profile}
          onProfileUpdated={onProfileUpdated || (() => {})}
        />
      )}
    </>
  );
}
