import * as XLSX from 'xlsx';
import { Publication, DEFAULT_STAGES } from '@/types/publication';
import { parseList } from '@/lib/storage';
import { STAGE_ORDER, STAGE_LABELS } from '@/types/team';
import type { PipelineStage } from '@/types/team';

interface ExportOptions {
  publications: Publication[];
  userName?: string | null;
  customTitle?: string;
}

interface TeamPublication {
  id: string;
  title: string;
  stage: string;
  authors: string[];
  themes: string[];
  grants: string[];
  targetYear?: number;
  outputType?: string;
  ownerName: string;
  workingPaper?: { isWorkingPaper?: boolean; journalTarget?: string };
  updatedAt: string;
  createdAt: string;
}

interface TeamExportOptions {
  publications: TeamPublication[];
  teamName: string;
  customTitle?: string;
}

function getStageName(stageId: string): string {
  const stage = DEFAULT_STAGES.find(s => s.id === stageId);
  return stage?.name ?? stageId;
}

export function exportPipelineToExcel({ publications, userName, customTitle }: ExportOptions): void {
  const workbook = XLSX.utils.book_new();

  // Build rows
  const rows = publications.map(pub => {
    const authors = parseList(pub.authors);
    const themes = parseList(pub.themes);
    const grants = parseList(pub.grants);

    return {
      'Stage': getStageName(pub.stageId),
      'Title': pub.title || 'Untitled',
      'Authors': pub.authors || '',
      'Number of Co-authors': Math.max(authors.length - 1, 0),
      'Themes': pub.themes || '',
      'Grants': pub.grants || '',
      'Target Year': pub.completionYear || '',
      'Published Year': pub.publishedYear || '',
      'Output Type': pub.outputType || '',
      'Journal / Publisher': pub.typeA || '',
      'Book Title': pub.typeB || '',
      'Working Paper': pub.workingPaper?.on ? 'Yes' : 'No',
      'WP Series': pub.workingPaper?.series || '',
      'Notes': pub.notes || '',
      'Created': pub.createdAt ? new Date(pub.createdAt).toLocaleDateString() : '',
      'Last Updated': pub.updatedAt ? new Date(pub.updatedAt).toLocaleDateString() : '',
    };
  });

  // Sort by stage order, then by title
  const stageOrder = DEFAULT_STAGES.map(s => s.id);
  rows.sort((a, b) => {
    const aStage = publications.find(p => getStageName(p.stageId) === a['Stage']);
    const bStage = publications.find(p => getStageName(p.stageId) === b['Stage']);
    const aIdx = stageOrder.indexOf(aStage?.stageId || 'idea');
    const bIdx = stageOrder.indexOf(bStage?.stageId || 'idea');
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a['Title'].localeCompare(b['Title']);
  });

  const sheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  sheet['!cols'] = [
    { wch: 18 },  // Stage
    { wch: 45 },  // Title
    { wch: 35 },  // Authors
    { wch: 16 },  // # Co-authors
    { wch: 30 },  // Themes
    { wch: 25 },  // Grants
    { wch: 12 },  // Target Year
    { wch: 14 },  // Published Year
    { wch: 15 },  // Output Type
    { wch: 30 },  // Journal
    { wch: 25 },  // Book Title
    { wch: 14 },  // Working Paper
    { wch: 20 },  // WP Series
    { wch: 40 },  // Notes
    { wch: 12 },  // Created
    { wch: 14 },  // Last Updated
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Pipeline');

  // Summary sheet
  const stageCounts = DEFAULT_STAGES.map(s => ({
    'Stage': s.name,
    'Count': publications.filter(p => p.stageId === s.id).length,
  }));
  stageCounts.push({ 'Stage': 'Total', 'Count': publications.length });

  const summarySheet = XLSX.utils.json_to_sheet(stageCounts);
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Build filename
  const datePart = new Date().toISOString().split('T')[0];
  const namePart = userName ? `_${userName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
  const titlePart = customTitle ? `_${customTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
  const filename = `pubzub_pipeline${titlePart}${namePart}_${datePart}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

export function exportTeamPipelineToExcel({ publications, teamName, customTitle }: TeamExportOptions): void {
  const workbook = XLSX.utils.book_new();

  const rows = publications.map(pub => ({
    'Stage': STAGE_LABELS[pub.stage as PipelineStage] || pub.stage,
    'Title': pub.title || 'Untitled',
    'Owner': pub.ownerName,
    'Authors': pub.authors.join(', '),
    'Number of Co-authors': Math.max(pub.authors.length - 1, 0),
    'Themes': pub.themes.join(', '),
    'Grants': pub.grants.join(', '),
    'Target Year': pub.targetYear || '',
    'Output Type': pub.outputType || '',
    'Working Paper': pub.workingPaper?.isWorkingPaper ? 'Yes' : 'No',
    'Created': pub.createdAt ? new Date(pub.createdAt).toLocaleDateString() : '',
    'Last Updated': pub.updatedAt ? new Date(pub.updatedAt).toLocaleDateString() : '',
  }));

  rows.sort((a, b) => {
    const aStage = publications.find(p => (STAGE_LABELS[p.stage as PipelineStage] || p.stage) === a['Stage'])?.stage as PipelineStage | undefined;
    const bStage = publications.find(p => (STAGE_LABELS[p.stage as PipelineStage] || p.stage) === b['Stage'])?.stage as PipelineStage | undefined;
    const aIdx = STAGE_ORDER.indexOf((aStage || 'idea') as PipelineStage);
    const bIdx = STAGE_ORDER.indexOf((bStage || 'idea') as PipelineStage);
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a['Title'].localeCompare(b['Title']);
  });

  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 18 }, { wch: 45 }, { wch: 20 }, { wch: 35 }, { wch: 16 },
    { wch: 30 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 14 },
    { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Pipeline');

  const visibleStages = STAGE_ORDER.filter(s => s !== 'idea');
  const stageCounts = visibleStages.map(s => ({
    'Stage': STAGE_LABELS[s as PipelineStage] || s,
    'Count': publications.filter(p => p.stage === s).length,
  }));
  stageCounts.push({ 'Stage': 'Total', 'Count': publications.length });

  const summarySheet = XLSX.utils.json_to_sheet(stageCounts);
  summarySheet['!cols'] = [{ wch: 22 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const datePart = new Date().toISOString().split('T')[0];
  const teamPart = teamName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const titlePart = customTitle ? `_${customTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
  const filename = `pubzub_team_${teamPart}${titlePart}_${datePart}.xlsx`;

  XLSX.writeFile(workbook, filename);
}
