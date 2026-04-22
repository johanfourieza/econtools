import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Printer, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { Publication } from '@/types/publication';
import { exportPipelineToExcel } from '@/lib/pipelineExport';

interface ExportPdfModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string | null;
  publications?: Publication[];
}

export function ExportPdfModal({ open, onOpenChange, userName, publications = [] }: ExportPdfModalProps) {
  const [exportOption, setExportOption] = useState<'funnel' | 'all'>('funnel');
  const [customTitle, setCustomTitle] = useState('');
  const [includeUserName, setIncludeUserName] = useState(true);

  useEffect(() => {
    if (open) {
      setCustomTitle('');
    }
  }, [open]);

  const handlePrint = () => {
    const printHeader = document.getElementById('pdf-print-header');
    if (printHeader) {
      const dateEl = printHeader.querySelector('[data-print-date]');
      if (dateEl) {
        dateEl.textContent = format(new Date(), 'MMMM d, yyyy');
      }
      
      const titleEl = printHeader.querySelector('[data-print-title]');
      if (titleEl) {
        titleEl.textContent = customTitle || 'Kabbo Pipeline';
      }
      
      const subtitleEl = printHeader.querySelector('[data-print-subtitle]');
      if (subtitleEl) {
        const parts: string[] = [];
        if (includeUserName && userName) {
          parts.push(userName);
        }
        parts.push('Publication Research Pipeline');
        subtitleEl.textContent = parts.join(' · ');
      }
    }
    
    document.body.classList.add('printing-pdf');
    document.body.setAttribute('data-print-option', exportOption);
    
    onOpenChange(false);
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing-pdf');
        document.body.removeAttribute('data-print-option');
      }, 100);
    }, 100);
  };

  const handleExcelExport = () => {
    exportPipelineToExcel({
      publications,
      userName: includeUserName ? userName : null,
      customTitle: customTitle || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Export Pipeline
          </DialogTitle>
          <DialogDescription>
            Export your pipeline as a PDF (via print) or as an Excel spreadsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="custom-title">Custom title (optional)</Label>
            <Input
              id="custom-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Kabbo Pipeline"
              className="bg-card"
            />
          </div>

          {userName && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="include-username"
                checked={includeUserName}
                onChange={(e) => setIncludeUserName(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <Label htmlFor="include-username" className="text-sm cursor-pointer">
                Include your name ({userName}) in header
              </Label>
            </div>
          )}

          <div className="space-y-3">
            <Label>PDF – What to include:</Label>
            <RadioGroup
              value={exportOption}
              onValueChange={(value) => setExportOption(value as 'funnel' | 'all')}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="funnel" id="funnel" />
                <Label htmlFor="funnel" className="flex-1 cursor-pointer">
                  <div className="font-medium">Pipeline funnel only</div>
                  <div className="text-sm text-muted-foreground">
                    Just the funnel stages with publication counts
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex-1 cursor-pointer">
                  <div className="font-medium">Funnel + Publications</div>
                  <div className="text-sm text-muted-foreground">
                    Include the published section and all publication details
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <strong>Tip:</strong> In the print dialog, select &quot;Save as PDF&quot; as the destination 
            and set orientation to &quot;Landscape&quot; for best results.
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleExcelExport} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hidden print header component - only visible when printing
export function PrintHeader() {
  return (
    <div 
      id="pdf-print-header" 
      className="hidden print:block print:mb-6"
      style={{ display: 'none' }}
    >
      <div className="flex items-center justify-between border-b border-gray-300 pb-4">
        <div>
          <h1 data-print-title className="text-2xl font-bold text-gray-900">Kabbo Pipeline</h1>
          <p data-print-subtitle className="text-sm text-gray-600">Publication Research Pipeline</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">Generated on</p>
          <p data-print-date className="text-base font-medium text-gray-900">
            {format(new Date(), 'MMMM d, yyyy')}
          </p>
        </div>
      </div>
    </div>
  );
}
