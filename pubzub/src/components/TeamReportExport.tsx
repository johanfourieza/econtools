import { useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { FileDown, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { STAGE_LABELS, STAGE_ORDER, isStageVisible } from '@/types/team';
import type { PipelineStage, Team } from '@/types/team';
import { STAGE_COLORS } from '@/types/publication';

interface MemberStats {
  id: string;
  memberId: string;
  displayName: string;
  email: string;
  universityAffiliation?: string;
  role: 'admin' | 'member';
  minVisibleStage: PipelineStage;
  publicationsByStage: Record<string, number>;
  totalVisible: number;
}

interface TeamReportExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  memberStats: MemberStats[];
  teamTotals: Record<string, number>;
  totalPublications: number;
}

export function TeamReportExport({
  open,
  onOpenChange,
  team,
  memberStats,
  teamTotals,
  totalPublications,
}: TeamReportExportProps) {
  const [customTitle, setCustomTitle] = useState('');
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeBreakdown, setIncludeBreakdown] = useState(true);

  const handleExport = () => {
    const title = customTitle || `${team.name} Progress Report`;
    const date = format(new Date(), 'MMMM d, yyyy');

    // Create print-friendly HTML content
    const printContent = generatePrintContent({
      title,
      date,
      team,
      memberStats,
      teamTotals,
      totalPublications,
      includeMembers,
      includeBreakdown,
    });

    // Open new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Team Report
          </DialogTitle>
          <DialogDescription>
            Generate a PDF report of your team's publication progress.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="report-title">Report title</Label>
            <Input
              id="report-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={`${team.name} Progress Report`}
              className="bg-card"
            />
          </div>

          <div className="space-y-3">
            <Label>Include in report:</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-members"
                  checked={includeMembers}
                  onCheckedChange={(checked) => setIncludeMembers(checked as boolean)}
                />
                <Label htmlFor="include-members" className="text-sm cursor-pointer">
                  Individual member progress
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="include-breakdown"
                  checked={includeBreakdown}
                  onCheckedChange={(checked) => setIncludeBreakdown(checked as boolean)}
                />
                <Label htmlFor="include-breakdown" className="text-sm cursor-pointer">
                  Stage-by-stage breakdown
                </Label>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <strong>Tip:</strong> In the print dialog, select "Save as PDF" as the destination.
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <FileDown className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function generatePrintContent({
  title,
  date,
  team,
  memberStats,
  teamTotals,
  totalPublications,
  includeMembers,
  includeBreakdown,
}: {
  title: string;
  date: string;
  team: Team;
  memberStats: MemberStats[];
  teamTotals: Record<string, number>;
  totalPublications: number;
  includeMembers: boolean;
  includeBreakdown: boolean;
}): string {
  const stageColors = [
    '#8b5cf6', // violet
    '#3b82f6', // blue
    '#06b6d4', // cyan
    '#f59e0b', // amber
    '#f97316', // orange
    '#22c55e', // green
    '#10b981', // emerald
  ];

  const membersHtml = includeMembers
    ? `
    <div class="section">
      <h2>Team Members</h2>
      <table>
        <thead>
          <tr>
            <th style="text-align: left;">Name</th>
            <th style="text-align: left;">Affiliation</th>
            <th style="text-align: center;">Role</th>
            <th style="text-align: center;">Publications</th>
            ${includeBreakdown ? STAGE_ORDER.map(s => `<th style="text-align: center; font-size: 10px;">${STAGE_LABELS[s].split(' ')[0]}</th>`).join('') : ''}
          </tr>
        </thead>
        <tbody>
          ${memberStats.map(member => `
            <tr>
              <td>${member.displayName}</td>
              <td style="color: #666;">${member.universityAffiliation || '-'}</td>
              <td style="text-align: center;">
                <span class="badge ${member.role === 'admin' ? 'admin' : 'member'}">
                  ${member.role === 'admin' ? 'Admin' : 'Member'}
                </span>
              </td>
              <td style="text-align: center; font-weight: 600;">${member.totalVisible}</td>
              ${includeBreakdown ? STAGE_ORDER.map((stage, idx) => {
                if (!isStageVisible(stage, member.minVisibleStage)) return '<td style="text-align: center; color: #ccc;">-</td>';
                const count = member.publicationsByStage[stage] || 0;
                return `<td style="text-align: center; ${count > 0 ? `color: ${stageColors[idx]}; font-weight: 600;` : 'color: #999;'}">${count}</td>`;
              }).join('') : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
    : '';

  const breakdownHtml = includeBreakdown
    ? `
    <div class="section">
      <h2>Stage Distribution</h2>
      <div class="stage-bar">
        ${STAGE_ORDER.map((stage, idx) => {
          const count = teamTotals[stage] || 0;
          const percentage = totalPublications > 0 ? (count / totalPublications) * 100 : 0;
          if (percentage === 0) return '';
          return `<div class="stage-segment" style="width: ${Math.max(percentage, 5)}%; background: ${stageColors[idx]};">${count}</div>`;
        }).join('')}
      </div>
      <div class="stage-legend">
        ${STAGE_ORDER.map((stage, idx) => {
          const count = teamTotals[stage] || 0;
          if (count === 0) return '';
          return `
            <div class="legend-item">
              <span class="legend-dot" style="background: ${stageColors[idx]};"></span>
              <span>${STAGE_LABELS[stage]}: ${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 40px;
          color: #1a1a1a;
          line-height: 1.5;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #e5e5e5;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .header h1 { font-size: 24px; margin-bottom: 4px; }
        .header .subtitle { color: #666; font-size: 14px; }
        .header .date { text-align: right; color: #666; font-size: 14px; }
        .summary {
          display: flex;
          gap: 30px;
          margin-bottom: 30px;
          padding: 20px;
          background: #f9fafb;
          border-radius: 8px;
        }
        .summary-item { text-align: center; }
        .summary-item .value { font-size: 32px; font-weight: 700; color: #8b5cf6; }
        .summary-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
        .section { margin-bottom: 30px; }
        .section h2 { font-size: 16px; margin-bottom: 15px; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; }
        th { background: #f9fafb; font-weight: 600; }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .badge.admin { background: #fef3c7; color: #92400e; }
        .badge.member { background: #e5e7eb; color: #374151; }
        .stage-bar {
          display: flex;
          height: 32px;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 15px;
        }
        .stage-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 600;
          font-size: 12px;
          min-width: 24px;
        }
        .stage-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        @media print {
          body { padding: 20px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>${title}</h1>
          <div class="subtitle">${team.name}${team.description ? ` · ${team.description}` : ''}</div>
        </div>
        <div class="date">
          <div>Generated on</div>
          <div style="font-weight: 600;">${date}</div>
        </div>
      </div>

      <div class="summary">
        <div class="summary-item">
          <div class="value">${memberStats.length}</div>
          <div class="label">Team Members</div>
        </div>
        <div class="summary-item">
          <div class="value">${totalPublications}</div>
          <div class="label">Total Publications</div>
        </div>
        <div class="summary-item">
          <div class="value">${memberStats.length > 0 ? (totalPublications / memberStats.length).toFixed(1) : 0}</div>
          <div class="label">Avg per Member</div>
        </div>
      </div>

      ${breakdownHtml}
      ${membersHtml}

      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e5e5; color: #999; font-size: 11px; text-align: center;">
        Generated by PubZub · ${date}
      </div>
    </body>
    </html>
  `;
}