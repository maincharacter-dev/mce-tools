import { extractText, getDocumentProxy } from 'unpdf';

const testUrl = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

console.log('Testing unpdf with small file first...');
const response = await fetch(testUrl);
const buffer = await response.arrayBuffer();
const uint8Array = new Uint8Array(buffer);

console.log('Loading PDF...');
const pdf = await getDocumentProxy(uint8Array);
console.log(`PDF loaded: ${pdf.numPages} pages`);

console.log('Extracting text...');
const { totalPages, text } = await extractText(pdf, { mergePages: true });
console.log(`Extracted ${totalPages} pages, ${text.length} chars`);
console.log('Text preview:', text.substring(0, 200));

await pdf.destroy();
console.log('unpdf test completed successfully!');
