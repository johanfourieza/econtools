import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  viewingPublicationId: string | null;
  lastSeen: string;
}

interface PresenceIndicatorProps {
  viewers: PresenceUser[];
  maxVisible?: number;
  size?: 'sm' | 'md';
}

export function PresenceIndicator({ viewers, maxVisible = 3, size = 'sm' }: PresenceIndicatorProps) {
  if (viewers.length === 0) return null;

  const visibleViewers = viewers.slice(0, maxVisible);
  const remainingCount = viewers.length - maxVisible;

  const sizeClasses = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const textSize = size === 'sm' ? 'text-[8px]' : 'text-[10px]';
  const ringSize = size === 'sm' ? 'ring-1' : 'ring-2';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <TooltipProvider>
      <div className="flex items-center -space-x-1.5">
        {visibleViewers.map((viewer) => (
          <Tooltip key={viewer.id}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Avatar className={`${sizeClasses} ${ringSize} ring-background cursor-pointer`}>
                  <AvatarImage src={viewer.avatarUrl} alt={viewer.displayName} />
                  <AvatarFallback className={`${textSize} bg-primary text-primary-foreground font-medium`}>
                    {getInitials(viewer.displayName)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium">{viewer.displayName}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        
        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`${sizeClasses} ${ringSize} ring-background rounded-full bg-muted flex items-center justify-center cursor-pointer`}>
                <span className={`${textSize} font-medium text-muted-foreground`}>+{remainingCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{remainingCount} more viewing</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
