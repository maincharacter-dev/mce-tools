import { describe, it, expect } from 'vitest';
import { classifyDocumentType } from './accFolderMapping';

describe('ACC Folder Mapping - classifyDocumentType', () => {
  describe('Weather Files', () => {
    it('should classify TMY CSV files', () => {
      expect(classifyDocumentType('tmy_19.638_56.884_2005_2023.csv')).toBe('WEATHER_FILE');
    });

    it('should classify weather data files', () => {
      expect(classifyDocumentType('weather_data_2024.csv')).toBe('WEATHER_FILE');
    });

    it('should classify EPW files', () => {
      expect(classifyDocumentType('site_location.epw')).toBe('WEATHER_FILE');
    });

    it('should classify meteo files', () => {
      expect(classifyDocumentType('meteo_data.csv')).toBe('WEATHER_FILE');
    });
  });

  describe('Feasibility Studies', () => {
    it('should classify feasibility study files', () => {
      expect(classifyDocumentType('Project_Feasibility_Study_v1.pdf')).toBe('FEASIBILITY_STUDY');
    });
  });

  describe('Planning Documents', () => {
    it('should classify planning documents', () => {
      expect(classifyDocumentType('Planning_Approval_Application.pdf')).toBe('PLANNING');
    });

    it('should classify land krooki documents', () => {
      expect(classifyDocumentType('Marsa Duqm Land Krooki.pdf')).toBe('PLANNING');
    });

    it('should classify environmental documents', () => {
      expect(classifyDocumentType('Environmental_Impact_Assessment.pdf')).toBe('PLANNING');
    });
  });

  describe('Grid Studies', () => {
    it('should classify grid study files', () => {
      expect(classifyDocumentType('Grid_Connection_Study.pdf')).toBe('GRID_STUDY');
    });
  });

  describe('Contracts', () => {
    it('should classify PPA files', () => {
      expect(classifyDocumentType('PPA_Agreement_2024.pdf')).toBe('CONTRACT');
    });

    it('should classify EPC contracts', () => {
      expect(classifyDocumentType('EPC_Contract_Draft.pdf')).toBe('CONTRACT');
    });
  });

  describe('Schedule Files', () => {
    it('should classify schedule xlsx files as PLANNING', () => {
      expect(classifyDocumentType('Marsa LNG Solar_Schedule_Share with OQ.xlsx')).toBe('PLANNING');
    });
  });

  describe('Other Files', () => {
    it('should return OTHER for unrecognized files', () => {
      expect(classifyDocumentType('random_document.pdf')).toBe('OTHER');
    });
  });
});
