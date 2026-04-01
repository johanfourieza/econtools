import { Publication, STAGE_COLORS } from '@/types/publication';
import { parseList } from '@/lib/storage';
import { PresenceIndicator } from './PresenceIndicator';
import { Users } from 'lucide-react';

interface PresenceUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  viewingPublicationId: string | null;
  lastSeen: string;
}

interface PublicationCardProps {
  publication: Publication;
  stageIndex?: number;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  viewers?: PresenceUser[];
}

export function PublicationCard({ publication, stageIndex = 0, onClick, onDragStart, viewers = [] }: PublicationCardProps) {
  const authors = parseList(publication.authors);
  const themes = parseList(publication.themes);
  const isWorkingPaper = publication.workingPaper?.on;
  const isCollaboration = publication.isCollaboration;

  const stageColor = STAGE_COLORS[stageIndex % STAGE_COLORS.length];

  return (
    <article
      className={`card-publication relative animate-fade-in ${isCollaboration ? 'ring-1 ring-primary/30' : ''}`}
      draggable={!isCollaboration || publication.myRole === 'editor'}
      onDragStart={onDragStart}
      onClick={onClick}
    >
      {/* Collaboration indicator - top left corner */}
      {isCollaboration && (
        <div className="absolute top-2 left-2 z-10" title={`Shared with you (${publication.myRole})`}>
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[9px] font-medium">
            <Users className="w-3 h-3" />
            <span className="capitalize">{publication.myRole}</span>
          </div>
        </div>
      )}
      
      {/* Presence indicator - top right corner */}
      {viewers.length > 0 && (
        <div className="absolute top-2 right-2 z-10">
          <PresenceIndicator viewers={viewers} maxVisible={2} size="sm" />
        </div>
      )}
      
      {isWorkingPaper && (
        <div className={`absolute ${viewers.length > 0 ? 'top-8' : 'top-2'} right-2 chip-wp chip text-[10px] rotate-3 font-semibold`}>
          WP
        </div>
      )}
      
      <h3 className={`font-display font-semibold text-sm leading-snug mb-2 pr-8 line-clamp-3 ${isCollaboration ? 'mt-5' : ''}`}>
        {publication.title || 'Untitled publication'}
      </h3>
      
      <div className="flex flex-wrap gap-1.5 items-center">
        {authors.slice(0, 2).map((author, i) => (
          <span key={i} className="chip text-[10px]">
            {author}
          </span>
        ))}
        {authors.length > 2 && (
          <span className="chip text-[10px]">+{authors.length - 2}</span>
        )}
        
        {themes.slice(0, 1).map((theme, i) => (
          <span key={i} className="chip-accent chip text-[10px]">
            {theme}
          </span>
        ))}
        
        {publication.completionYear && (
          <span className="chip text-[10px] font-medium">
            {publication.completionYear}
          </span>
        )}
      </div>
    </article>
  );
}
