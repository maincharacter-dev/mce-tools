import { describe, it, expect } from 'vitest';
import { classifyByFilename, classifyByContent, quickClassify } from './document-classifier';

describe('Document Classifier', () => {
  describe('classifyByFilename', () => {
    it('should classify Investment Memorandum files', () => {
      const result = classifyByFilename('Project_IM_v2.pdf');
      expect(result).not.toBeNull();
      expect(result?.suggestedType).toBe('IM');
      expect(result?.confidence).toBe('high');
      expect(result?.source).toBe('filename');
    });

    it('should classify Due Diligence files', () => {
      const result = classifyByFilename('Technical_DD_Report.pdf');
      expect(result).not.toBeNull();
      expect(result?.suggestedType).toBe('DD_PACK');
      expect(result?.confidence).toBe('high');
    });

    it('should classify Contract files', () => {
      const result = classifyByFilename('PPA_Agreement_2024.pdf');
      expect(result).not.toBeNull();
      expect(result?.suggestedType).toBe('CONTRACT');
      expect(result?.confidence).toBe('high');
    });

    it('should classify Grid Study files', () => {
      const result = classifyByFilename('Grid_Connection_Study.pdf');
      expect(result).not.toBeNull();
      expect(result?.suggestedType).toBe('GRID_STUDY');
      expect(result?.confidence).toBe('high');
    });

    it('should classify Weather Data files', () => {
      const result = classifyByFilename('TMY_Weather_Data.csv');
      expect(result).not.toBeNull();
      expect(result?.suggestedType).toBe('WEATHER_DATA');
      expect(result?.confidence).toBe('high');
    });

    it('should return null for generic filenames', () => {
      const result = classifyByFilename('document.pdf');
      expect(result).toBeNull();
    });
  });

  describe('classifyByContent', () => {
    it('should classify content with investment memorandum keywords', () => {
      const text = 'This Investment Memorandum provides an executive summary of the project opportunity. The target IRR is 12%.';
      const result = classifyByContent(text);
      expect(result.suggestedType).toBe('IM');
      expect(result.confidence).toBe('high');
      expect(result.matchedKeywords).toContain('investment memorandum');
    });

    it('should classify content with grid study keywords', () => {
      const text = 'Grid Connection Study for the proposed solar plant. The point of connection is at the 132kV substation.';
      const result = classifyByContent(text);
      expect(result.suggestedType).toBe('GRID_STUDY');
      expect(result.matchedKeywords.length).toBeGreaterThan(0);
    });

    it('should classify content with contract keywords', () => {
      const text = 'Power Purchase Agreement between Party A and Party B. The parties agree to the following terms and conditions.';
      const result = classifyByContent(text);
      expect(result.suggestedType).toBe('CONTRACT');
    });

    it('should return OTHER for content without matching keywords', () => {
      const text = 'This is a random document with no specific keywords.';
      const result = classifyByContent(text);
      expect(result.suggestedType).toBe('OTHER');
      expect(result.confidence).toBe('low');
    });
  });

  describe('quickClassify', () => {
    it('should return classification for matching filenames', () => {
      const result = quickClassify('EPC_Contract_Final.pdf');
      expect(result.suggestedType).toBe('CONTRACT');
      expect(result.source).toBe('filename');
    });

    it('should return OTHER with low confidence for non-matching filenames', () => {
      const result = quickClassify('random_file.pdf');
      expect(result.suggestedType).toBe('OTHER');
      expect(result.confidence).toBe('low');
      expect(result.source).toBe('fallback');
    });
  });
});
