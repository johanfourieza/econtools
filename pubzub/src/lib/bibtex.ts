import { Publication } from '@/types/publication';

export function generateBibtex(publications: Publication[]): string {
  return publications
    .map((pub) => {
      const key = generateBibtexKey(pub);
      const type = getBibtexType(pub);
      
      const fields: string[] = [];
      
      // Title
      fields.push(`  title = {${escapeBibtex(pub.title)}}`);
      
      // Authors
      if (pub.authors) {
        const authors = pub.authors
          .split(',')
          .map(a => a.trim())
          .join(' and ');
        fields.push(`  author = {${escapeBibtex(authors)}}`);
      }
      
      // Year
      if (pub.publishedYear || pub.completionYear) {
        fields.push(`  year = {${pub.publishedYear || pub.completionYear}}`);
      }
      
      // Journal/publisher/booktitle based on output type
      if (pub.outputType === 'journal' && pub.typeA) {
        fields.push(`  journal = {${escapeBibtex(pub.typeA)}}`);
      } else if (pub.outputType === 'book' && pub.typeA) {
        fields.push(`  publisher = {${escapeBibtex(pub.typeA)}}`);
      } else if (pub.outputType === 'chapter') {
        if (pub.typeA) {
          fields.push(`  publisher = {${escapeBibtex(pub.typeA)}}`);
        }
        if (pub.typeB) {
          fields.push(`  booktitle = {${escapeBibtex(pub.typeB)}}`);
        }
        if (pub.typeC) {
          fields.push(`  editor = {${escapeBibtex(pub.typeC)}}`);
        }
      }
      
      return `@${type}{${key},\n${fields.join(',\n')}\n}`;
    })
    .join('\n\n');
}

function generateBibtexKey(pub: Publication): string {
  // Get first author's last name
  const authors = pub.authors.split(',');
  const firstAuthor = authors[0]?.trim() || 'Unknown';
  const lastName = firstAuthor.split(' ').pop() || 'Unknown';
  
  // Get year
  const year = pub.publishedYear || pub.completionYear || 'XXXX';
  
  // Get first word of title (excluding articles)
  const titleWords = pub.title.split(' ').filter(w => 
    !['the', 'a', 'an', 'on', 'in', 'of', 'for', 'and'].includes(w.toLowerCase())
  );
  const firstWord = titleWords[0] || 'untitled';
  
  // Clean and combine
  const cleanName = lastName.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const cleanWord = firstWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
  
  return `${cleanName}${year}${cleanWord}`;
}

function getBibtexType(pub: Publication): string {
  switch (pub.outputType) {
    case 'book':
      return 'book';
    case 'chapter':
      return 'incollection';
    case 'journal':
    default:
      return 'article';
  }
}

function escapeBibtex(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%');
}

export function downloadBibtex(publications: Publication[], filename = 'publications.bib'): void {
  const content = generateBibtex(publications);
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
