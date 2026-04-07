import { useState, useEffect } from 'react';

export type PaletteId = 'burnt-fieldnotes' | 'ndebele-laboratory' | 'nordic-methodology' | 'oxbridge-library' | 'conference-lanyard';

export interface Palette {
  id: PaletteId;
  name: string;
  description: string;
  preview: string[]; // Array of 4 preview colors
}

export const PALETTES: Palette[] = [
  {
    id: 'burnt-fieldnotes',
    name: 'Burnt Fieldnotes',
    description: 'Warm, earthy Scandinavian tones',
    preview: ['#D4A574', '#C46F4E', '#4A7C6F', '#3D4F5F'],
  },
  {
    id: 'conference-lanyard',
    name: 'Conference Lanyard',
    description: 'Professional white and grey',
    preview: ['#F5F5F5', '#9E9E9E', '#616161', '#212121'],
  },
  {
    id: 'ndebele-laboratory',
    name: 'Ndebele Laboratory',
    description: 'Vibrant, bold African-inspired colours',
    preview: ['#E31B23', '#00A9A5', '#FFD600', '#2E5090'],
  },
  {
    id: 'nordic-methodology',
    name: 'Nordic Methodology',
    description: 'Cold, icy, elegant tones',
    preview: ['#1E3A5F', '#5B8FA8', '#A8C8D8', '#E8F1F5'],
  },
  {
    id: 'oxbridge-library',
    name: 'Oxbridge Library',
    description: 'Dark woods, royal blue, gold',
    preview: ['#1C2833', '#1E4D8C', '#C9A227', '#5D4E37'],
  },
];

const PALETTE_STORAGE_KEY = 'kabbo-palette';

export function usePalette() {
  const [paletteId, setPaletteId] = useState<PaletteId>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (stored && PALETTES.some(p => p.id === stored)) {
        return stored as PaletteId;
      }
    }
    return 'burnt-fieldnotes';
  });

  useEffect(() => {
    // Remove all palette classes
    PALETTES.forEach(p => {
      document.documentElement.classList.remove(`palette-${p.id}`);
    });
    // Add current palette class
    document.documentElement.classList.add(`palette-${paletteId}`);
    // Save to localStorage
    localStorage.setItem(PALETTE_STORAGE_KEY, paletteId);
  }, [paletteId]);

  const currentPalette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];

  return {
    paletteId,
    setPaletteId,
    currentPalette,
    palettes: PALETTES,
  };
}
