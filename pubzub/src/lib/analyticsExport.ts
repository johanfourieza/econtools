import * as XLSX from 'xlsx';

interface StageDistribution {
  stage: string;
  label: string;
  count: number;
}

interface MemberStats {
  id: string;
  name: string;
  count: number;
}

interface CoAuthorLink {
  source: string;
  target: string;
  weight: number;
}

interface AnalyticsData {
  teamName: string;
  exportDate: string;
  total: number;
  publishedCount: number;
  workingPaperCount: number;
  workingPaperPercent: number;
  uniqueAuthors: number;
  avgAuthors: string;
  grantCoverage: number;
  uniqueGrants: number;
  stageDistribution: StageDistribution[];
  topMembers: MemberStats[];
  topThemes: [string, number][];
  grantsList: [string, number][];
  journalsList: [string, number][];
  coAuthorLinks: CoAuthorLink[];
  yearCounts: Record<string, number>;
  outputCounts: Record<string, number>;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function exportToCSV(data: AnalyticsData): void {
  const lines: string[] = [];
  
  // Header
  lines.push(`"${data.teamName} - Team Analytics Report"`);
  lines.push(`"Generated on: ${data.exportDate}"`);
  lines.push('');
  
  // Summary
  lines.push('"SUMMARY"');
  lines.push('"Metric","Value"');
  lines.push(`"Total Publications",${data.total}`);
  lines.push(`"Published",${data.publishedCount}`);
  lines.push(`"Working Papers",${data.workingPaperCount}`);
  lines.push(`"Working Paper %",${data.workingPaperPercent}%`);
  lines.push(`"Unique Authors",${data.uniqueAuthors}`);
  lines.push(`"Avg Authors per Paper",${data.avgAuthors}`);
  lines.push(`"Grant Coverage",${data.grantCoverage}%`);
  lines.push(`"Unique Grants",${data.uniqueGrants}`);
  lines.push('');
  
  // Stage Distribution
  lines.push('"PUBLICATIONS BY STAGE"');
  lines.push('"Stage","Count"');
  data.stageDistribution.forEach(item => {
    lines.push(`"${item.label}",${item.count}`);
  });
  lines.push('');
  
  // Top Contributors
  lines.push('"TOP CONTRIBUTORS"');
  lines.push('"Member","Publications"');
  data.topMembers.forEach(member => {
    lines.push(`"${member.name}",${member.count}`);
  });
  lines.push('');
  
  // Themes
  lines.push('"RESEARCH THEMES"');
  lines.push('"Theme","Count"');
  data.topThemes.forEach(([theme, count]) => {
    lines.push(`"${theme}",${count}`);
  });
  lines.push('');
  
  // Grants
  lines.push('"GRANTS"');
  lines.push('"Grant","Publications"');
  data.grantsList.forEach(([grant, count]) => {
    lines.push(`"${grant}",${count}`);
  });
  lines.push('');
  
  // Target Journals
  if (data.journalsList.length > 0) {
    lines.push('"TARGET JOURNALS"');
    lines.push('"Journal","Count"');
    data.journalsList.forEach(([journal, count]) => {
      lines.push(`"${journal}",${count}`);
    });
    lines.push('');
  }
  
  // Target Years
  lines.push('"TARGET YEARS"');
  lines.push('"Year","Count"');
  Object.entries(data.yearCounts)
    .sort((a, b) => (a[0] === 'Not set' ? 1 : b[0] === 'Not set' ? -1 : b[0].localeCompare(a[0])))
    .forEach(([year, count]) => {
      lines.push(`"${year}",${count}`);
    });
  lines.push('');
  
  // Output Types
  lines.push('"OUTPUT TYPES"');
  lines.push('"Type","Count"');
  Object.entries(data.outputCounts).forEach(([type, count]) => {
    lines.push(`"${type}",${count}`);
  });
  lines.push('');
  
  // Co-Author Network
  lines.push('"CO-AUTHOR COLLABORATIONS"');
  lines.push('"Author 1","Author 2","Shared Papers"');
  data.coAuthorLinks.forEach(link => {
    lines.push(`"${link.source}","${link.target}",${link.weight}`);
  });
  
  // Create and download
  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${sanitizeFilename(data.teamName)}_analytics_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(data: AnalyticsData): void {
  const workbook = XLSX.utils.book_new();
  
  // Summary Sheet
  const summaryData = [
    [`${data.teamName} - Team Analytics Report`],
    [`Generated on: ${data.exportDate}`],
    [],
    ['Metric', 'Value'],
    ['Total Publications', data.total],
    ['Published', data.publishedCount],
    ['Working Papers', data.workingPaperCount],
    ['Working Paper %', `${data.workingPaperPercent}%`],
    ['Unique Authors', data.uniqueAuthors],
    ['Avg Authors per Paper', data.avgAuthors],
    ['Grant Coverage', `${data.grantCoverage}%`],
    ['Unique Grants', data.uniqueGrants],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Pipeline Sheet
  const pipelineData = [
    ['Stage', 'Count'],
    ...data.stageDistribution.map(item => [item.label, item.count]),
  ];
  const pipelineSheet = XLSX.utils.aoa_to_sheet(pipelineData);
  pipelineSheet['!cols'] = [{ wch: 20 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, pipelineSheet, 'Pipeline');
  
  // Contributors Sheet
  const contributorsData = [
    ['Member', 'Publications'],
    ...data.topMembers.map(m => [m.name, m.count]),
  ];
  const contributorsSheet = XLSX.utils.aoa_to_sheet(contributorsData);
  contributorsSheet['!cols'] = [{ wch: 30 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, contributorsSheet, 'Contributors');
  
  // Themes Sheet
  const themesData = [
    ['Theme', 'Count'],
    ...data.topThemes.map(([theme, count]) => [theme, count]),
  ];
  const themesSheet = XLSX.utils.aoa_to_sheet(themesData);
  themesSheet['!cols'] = [{ wch: 30 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, themesSheet, 'Themes');
  
  // Grants Sheet
  const grantsData = [
    ['Grant', 'Publications'],
    ...data.grantsList.map(([grant, count]) => [grant, count]),
  ];
  const grantsSheet = XLSX.utils.aoa_to_sheet(grantsData);
  grantsSheet['!cols'] = [{ wch: 40 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, grantsSheet, 'Grants');
  
  // Journals Sheet
  if (data.journalsList.length > 0) {
    const journalsData = [
      ['Journal', 'Count'],
      ...data.journalsList.map(([journal, count]) => [journal, count]),
    ];
    const journalsSheet = XLSX.utils.aoa_to_sheet(journalsData);
    journalsSheet['!cols'] = [{ wch: 40 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, journalsSheet, 'Target Journals');
  }
  
  // Years Sheet
  const yearsData = [
    ['Year', 'Count'],
    ...Object.entries(data.yearCounts)
      .sort((a, b) => (a[0] === 'Not set' ? 1 : b[0] === 'Not set' ? -1 : b[0].localeCompare(a[0])))
      .map(([year, count]) => [year, count]),
  ];
  const yearsSheet = XLSX.utils.aoa_to_sheet(yearsData);
  yearsSheet['!cols'] = [{ wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, yearsSheet, 'Target Years');
  
  // Output Types Sheet
  const outputData = [
    ['Output Type', 'Count'],
    ...Object.entries(data.outputCounts).map(([type, count]) => [type, count]),
  ];
  const outputSheet = XLSX.utils.aoa_to_sheet(outputData);
  outputSheet['!cols'] = [{ wch: 25 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, outputSheet, 'Output Types');
  
  // Co-Authors Sheet
  const coAuthorsData = [
    ['Author 1', 'Author 2', 'Shared Papers'],
    ...data.coAuthorLinks.map(link => [link.source, link.target, link.weight]),
  ];
  const coAuthorsSheet = XLSX.utils.aoa_to_sheet(coAuthorsData);
  coAuthorsSheet['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, coAuthorsSheet, 'Co-Authors');
  
  // Download
  const filename = `${sanitizeFilename(data.teamName)}_analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
