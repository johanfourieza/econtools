import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePalette, type PaletteId } from '@/hooks/usePalette';
import { cn } from '@/lib/utils';

export function PaletteSelector() {
  const { paletteId, setPaletteId, palettes } = usePalette();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" title="Change colour palette">
          <Palette className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Colour Palette</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {palettes.map((palette) => (
          <DropdownMenuItem
            key={palette.id}
            onClick={() => setPaletteId(palette.id)}
            className={cn(
              'flex flex-col items-start gap-1.5 py-2.5 cursor-pointer',
              paletteId === palette.id && 'bg-accent/10'
            )}
          >
            <div className="flex items-center gap-2 w-full">
              <div className="flex gap-0.5">
                {palette.preview.map((color, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-sm border border-border/50"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="font-medium text-sm flex-1">{palette.name}</span>
              {paletteId === palette.id && (
                <span className="text-xs text-accent">✓</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground pl-[68px]">
              {palette.description}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
