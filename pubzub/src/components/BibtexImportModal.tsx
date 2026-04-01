import { useState, useRef } from 'react';
import { FileText, Upload, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface ParsedEntry {
  key: string;
  title: string;
  authors: string;
  year: string;
  journal?: string;
  booktitle?: string;
  publisher?: string;
  type: string;
  suggestedStage: 'published' | 'draft';
}

interface BibtexImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (entries: ParsedEntry[]) => void;
  userDisplayName?: string;
}

// Common name suffixes
const NAME_SUFFIXES = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'phd', 'md', 'esq'];

// Common name particles (lowercase in many naming conventions)
const NAME_PARTICLES = ['van', 'von', 'de', 'del', 'della', 'der', 'den', 'la', 'le', 'du', 'dos', 'das', 'di', 'da', 'ten', 'ter', 'het'];

// Convert BibTeX author format to "FirstName LastName" format
// Handles: "LastName, FirstName", "LastName, FirstName, Jr.", "van der Berg, Jan"
function normalizeAuthorName(name: string): string {
  const trimmed = name.trim();
  
  if (!trimmed.includes(',')) {
    // Already in "FirstName LastName" format
    return trimmed;
  }
  
  const parts = trimmed.split(',').map(p => p.trim()).filter(p => p.length > 0);
  
  if (parts.length === 0) return trimmed;
  
  if (parts.length === 1) {
    // Just a last name with trailing comma
    return parts[0];
  }
  
  // Check if last part is a suffix
  const lastPart = parts[parts.length - 1].toLowerCase();
  const hasSuffix = NAME_SUFFIXES.includes(lastPart);
  
  if (parts.length === 2) {
    if (hasSuffix) {
      // "LastName, Jr." - unusual but handle it
      return `${parts[0]} ${parts[1]}`;
    }
    // Standard "LastName, FirstName" -> "FirstName LastName"
    return `${parts[1]} ${parts[0]}`;
  }
  
  if (parts.length === 3) {
    if (hasSuffix) {
      // "LastName, FirstName, Jr." -> "FirstName LastName Jr."
      return `${parts[1]} ${parts[0]} ${parts[2]}`;
    }
    // Unusual format, just join with spaces
    return parts.join(' ');
  }
  
  // More than 3 parts - just join them
  return parts.join(' ');
}

// Check if two names match (case-insensitive, handles variations)
// Also handles partial matches for particles
function namesMatch(name1: string, name2: string): boolean {
  const normalize = (n: string) => {
    return n
      .toLowerCase()
      .replace(/[.,]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  if (n1 === n2) return true;
  
  // Check if one contains the other (for partial name matches)
  // This helps with "Johan Fourie" matching "J. Fourie" or variations
  const words1 = n1.split(' ').filter(w => !NAME_PARTICLES.includes(w) && !NAME_SUFFIXES.includes(w));
  const words2 = n2.split(' ').filter(w => !NAME_PARTICLES.includes(w) && !NAME_SUFFIXES.includes(w));
  
  // Check if last names match (usually the most reliable)
  if (words1.length > 0 && words2.length > 0) {
    const lastName1 = words1[words1.length - 1];
    const lastName2 = words2[words2.length - 1];
    
    // If last names match and at least one first initial matches
    if (lastName1 === lastName2) {
      const first1 = words1[0] || '';
      const first2 = words2[0] || '';
      // Check if first names match or one is an initial of the other
      if (first1 === first2 || 
          first1.charAt(0) === first2.charAt(0)) {
        return true;
      }
    }
  }
  
  return false;
}

function parseBibtex(bibtex: string, userDisplayName?: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  
  // Match @type{key, ... }
  const entryRegex = /@(\w+)\s*\{\s*([^,]+)\s*,([^@]*?)(?=\n\s*@|\s*$)/gs;
  let match;
  
  // Types that should be imported as Draft
  const draftTypes = ['mimeo', 'workingpaper', 'working_paper', 'techreport', 'unpublished'];
  
  while ((match = entryRegex.exec(bibtex)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const content = match[3];
    
    // Parse fields
    const fieldRegex = /(\w+)\s*=\s*(?:\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}|"([^"]*)"|(\d+))/gi;
    const fields: Record<string, string> = {};
    let fieldMatch;
    
    while ((fieldMatch = fieldRegex.exec(content)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      const fieldValue = fieldMatch[2] || fieldMatch[3] || fieldMatch[4] || '';
      fields[fieldName] = fieldValue.replace(/\s+/g, ' ').trim();
    }
    
    // Clean up LaTeX commands in author names
    let authorsRaw = fields.author || '';
    authorsRaw = authorsRaw
      .replace(/\{([^}]*)\}/g, '$1')
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
      .replace(/\\/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split by "and" (BibTeX standard separator)
    const authorList = authorsRaw
      .split(/\s+and\s+/i)
      .map(normalizeAuthorName)
      .filter(name => name.length > 0);
    
    // Exclude the user's own name if provided
    const filteredAuthors = userDisplayName
      ? authorList.filter(name => !namesMatch(name, userDisplayName))
      : authorList;
    
    const authors = filteredAuthors.join(', ');
    
    // Clean up title
    let title = fields.title || 'Untitled';
    title = title
      .replace(/\{([^}]*)\}/g, '$1')
      .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
      .replace(/\\/g, '')
      .trim();
    
    // Determine if this should be a draft or published
    const suggestedStage = draftTypes.includes(type) ? 'draft' : 'published';
    
    entries.push({
      key,
      title,
      authors,
      year: fields.year || '',
      journal: fields.journal,
      booktitle: fields.booktitle,
      publisher: fields.publisher,
      type,
      suggestedStage,
    });
  }
  
  return entries;
}

export function BibtexImportModal({ isOpen, onClose, onImport, userDisplayName }: BibtexImportModalProps) {
  const [bibtexContent, setBibtexContent] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setBibtexContent(content);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    if (!bibtexContent.trim()) {
      toast.error('Please paste or upload BibTeX content');
      return;
    }
    
    const entries = parseBibtex(bibtexContent, userDisplayName);
    if (entries.length === 0) {
      toast.error('No valid BibTeX entries found');
      return;
    }
    
    setParsedEntries(entries);
    setSelectedKeys(new Set(entries.map(e => e.key)));
    setStep('preview');
  };

  const toggleEntry = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleImport = () => {
    const selectedEntries = parsedEntries.filter(e => selectedKeys.has(e.key));
    if (selectedEntries.length === 0) {
      toast.error('Please select at least one entry');
      return;
    }
    
    onImport(selectedEntries);
    toast.success(`Imported ${selectedEntries.length} publication${selectedEntries.length > 1 ? 's' : ''}`);
    handleClose();
  };

  const handleClose = () => {
    setBibtexContent('');
    setParsedEntries([]);
    setSelectedKeys(new Set());
    setStep('input');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <FileText className="w-5 h-5 text-primary" />
            Import from BibTeX
          </DialogTitle>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".bib,.bibtex,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload .bib file
              </Button>
            </div>
            
            <Textarea
              value={bibtexContent}
              onChange={(e) => setBibtexContent(e.target.value)}
              placeholder="Paste your BibTeX entries here..."
              className="min-h-[300px] font-mono text-xs"
            />
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleParse}>
                Parse Entries
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 flex-1 min-h-0">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {parsedEntries.length} entries. Select which to import as published:
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('input')}
              >
                Back
              </Button>
            </div>
            
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {parsedEntries.map((entry) => (
                  <div
                    key={entry.key}
                    onClick={() => toggleEntry(entry.key)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedKeys.has(entry.key)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        selectedKeys.has(entry.key)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40'
                      }`}>
                        {selectedKeys.has(entry.key) && <Check className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight">{entry.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {entry.authors}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {entry.year && (
                            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">
                              {entry.year}
                            </span>
                          )}
                          {entry.journal && (
                            <span className="text-xs text-muted-foreground truncate">
                              {entry.journal}
                            </span>
                          )}
                          {entry.booktitle && !entry.journal && (
                            <span className="text-xs text-muted-foreground truncate">
                              {entry.booktitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            
            <div className="flex justify-between items-center pt-2 border-t">
              <p className="text-sm text-muted-foreground">
                {selectedKeys.size} of {parsedEntries.length} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={selectedKeys.size === 0}>
                  Import Selected
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type { ParsedEntry };
