import { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePublicationComments, PublicationComment } from '@/hooks/usePublicationComments';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface PublicationChatProps {
  publicationId: string;
}

export function PublicationChat({ publicationId }: PublicationChatProps) {
  const { comments, isLoading, isSending, sendComment, deleteComment } = usePublicationComments(publicationId);
  const [message, setMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    
    const success = await sendComment(message);
    if (success) {
      setMessage('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return iso;
    }
  };

  const getDisplayName = (comment: PublicationComment) => {
    if (comment.userDisplayName) return comment.userDisplayName;
    return 'Unknown';
  };

  const getInitials = (comment: PublicationComment) => {
    const name = getDisplayName(comment);
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden flex flex-col h-[300px]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30 flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-display font-medium text-sm">Co-author Chat</h4>
        <span className="text-xs text-muted-foreground ml-auto">
          {comments.length} message{comments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => {
              const isOwnMessage = comment.userId === currentUserId;
              return (
                <div key={comment.id} className={`flex gap-2 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 ${
                    isOwnMessage 
                      ? 'bg-accent text-accent-foreground' 
                      : 'bg-secondary text-secondary-foreground'
                  }`}>
                    {getInitials(comment)}
                  </div>
                  
                  {/* Message bubble */}
                  <div className={`max-w-[75%] ${isOwnMessage ? 'text-right' : ''}`}>
                    <div className={`px-3 py-2 rounded-lg text-xs ${
                      isOwnMessage 
                        ? 'bg-accent text-accent-foreground rounded-tr-none' 
                        : 'bg-secondary/50 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                    </div>
                    <div className={`flex items-center gap-2 mt-0.5 ${isOwnMessage ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-muted-foreground">
                        {getDisplayName(comment)} · {formatTime(comment.createdAt)}
                      </span>
                      {isOwnMessage && (
                        <button
                          onClick={() => deleteComment(comment.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-2 border-t border-border bg-secondary/20">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send)"
            className="bg-card text-xs min-h-[36px] max-h-[80px] resize-none py-2"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="h-9 w-9 flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
