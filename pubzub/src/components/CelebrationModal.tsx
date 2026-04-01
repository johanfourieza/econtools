import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicationTitle: string;
}

// 10 celebration memes - using reliable Tenor/Giphy embed URLs
const CELEBRATION_MEMES = [
  {
    id: 'confetti',
    name: 'Confetti Celebration',
    gif: 'https://media.tenor.com/XhLxWOkn4FYAAAAi/confetti.gif',
    subtitle: 'Dancing into publication history! 🕺',
  },
  {
    id: 'celebration-dance',
    name: 'Celebration Dance',
    gif: 'https://media.tenor.com/blrYGTssqNMAAAAi/happy-dance.gif',
    subtitle: 'Cheers to your success! 🥂',
  },
  {
    id: 'party-time',
    name: 'Party Time',
    gif: 'https://media.tenor.com/ik6KxyKJhCkAAAAi/celebrate-party.gif',
    subtitle: 'Time to celebrate! 🎉',
  },
  {
    id: 'thumbs-up',
    name: 'Thumbs Up',
    gif: 'https://media.tenor.com/6-uK3wnhM5wAAAAi/thumbs-up-joypixels.gif',
    subtitle: 'YESSS! You did it! 💪',
  },
  {
    id: 'cheering',
    name: 'Cheering',
    gif: 'https://media.tenor.com/-AyTtMgs2mMAAAAi/yay-minion.gif',
    subtitle: 'The whole team is celebrating! 🎊',
  },
  {
    id: 'dancing',
    name: 'Happy Dancing',
    gif: 'https://media.tenor.com/lxJgp-a8MrgAAAAi/happy-excited.gif',
    subtitle: 'Time for your victory dance! 💃',
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    gif: 'https://media.tenor.com/1b1AauwECKAAAAAi/fireworks-night.gif',
    subtitle: 'You get a publication! 📚',
  },
  {
    id: 'clapping',
    name: 'Clapping',
    gif: 'https://media.tenor.com/epnw5x5yLnAAAAAi/clap-clapping.gif',
    subtitle: 'YAAAY! Amazing work! 👏',
  },
  {
    id: 'trophy',
    name: 'Trophy',
    gif: 'https://media.tenor.com/Y0TEQbO9SXUAAAAC/trophy-winner.gif',
    subtitle: 'Drop it like it\'s published! 🏆',
  },
  {
    id: 'star',
    name: 'Star',
    gif: 'https://media.tenor.com/SNL9_xhEyjYAAAAi/star-gold.gif',
    subtitle: 'Nailed it! Another one for the CV! ⭐',
  },
];

export function CelebrationModal({ isOpen, onClose, publicationTitle }: CelebrationModalProps) {
  const [selectedMeme, setSelectedMeme] = useState(CELEBRATION_MEMES[0]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Reset error state and randomly select a meme when opening
      setImageError(false);
      const randomIndex = Math.floor(Math.random() * CELEBRATION_MEMES.length);
      setSelectedMeme(CELEBRATION_MEMES[randomIndex]);
      
      // Auto-close after 4 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-card border-2 border-published">
        <div className="flex flex-col items-center text-center">
          {/* Meme GIF or fallback */}
          <div className="w-full aspect-video bg-muted overflow-hidden flex items-center justify-center">
            {imageError ? (
              <div className="text-6xl animate-bounce">🎉</div>
            ) : (
              <img 
                src={selectedMeme.gif} 
                alt={selectedMeme.name}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
            )}
          </div>
          
          {/* Celebration text */}
          <div className="p-6 space-y-2">
            <h2 className="text-2xl font-display font-bold text-published">
              Published! 🎉
            </h2>
            <p className="text-foreground font-medium truncate max-w-[300px]">
              "{publicationTitle}"
            </p>
            <p className="text-muted-foreground text-sm">
              {selectedMeme.subtitle}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
