import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { trpc } from '../lib/trpc';

interface WeatherFileUploadProps {
  projectId: number;
  projectDbName: string;
  onUploadComplete?: () => void;
}

export function WeatherFileUpload({ projectId, projectDbName, onUploadComplete }: WeatherFileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const uploadMutation = trpc.weatherFiles.upload.useMutation();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validExtensions = ['.csv', '.epw', '.tm2', '.tm3'];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      
      if (!validExtensions.includes(fileExt)) {
        setErrorMessage('Invalid file type. Please upload CSV, EPW, TM2, or TM3 files.');
        setUploadStatus('error');
        return;
      }
      
      // Validate file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage('File too large. Maximum size is 50MB.');
        setUploadStatus('error');
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus('idle');
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadStatus('idle');
    setErrorMessage('');

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Content = e.target?.result as string;
        const base64Data = base64Content.split(',')[1]; // Remove data:text/csv;base64, prefix

        try {
          const result = await uploadMutation.mutateAsync({
            projectDbName,
            projectId,
            fileName: selectedFile.name,
            fileContent: base64Data,
          });

          setUploadStatus('success');
          setSelectedFile(null);
          
          if (onUploadComplete) {
            onUploadComplete();
          }

          // Show success message with trigger status
          if (result.triggered) {
            setErrorMessage('Weather file uploaded successfully! Performance validation triggered.');
          } else {
            setErrorMessage('Weather file uploaded successfully! Validation will run when all data is available.');
          }
        } catch (error) {
          setUploadStatus('error');
          setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadStatus('error');
        setErrorMessage('Failed to read file');
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Upload Weather Data</h3>
          <p className="text-sm text-muted-foreground">
            Upload TMY, EPW, or PVGIS weather files to override extracted data or provide missing weather information.
          </p>
        </div>

        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
          <input
            type="file"
            id="weather-file-input"
            accept=".csv,.epw,.tm2,.tm3"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {!selectedFile ? (
            <label htmlFor="weather-file-input" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Click to upload weather file</p>
              <p className="text-xs text-muted-foreground">CSV, EPW, TM2, or TM3 (max 50MB)</p>
            </label>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
          )}
        </div>

        {selectedFile && (
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1"
            >
              {uploading ? 'Uploading...' : 'Upload Weather File'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedFile(null);
                setUploadStatus('idle');
                setErrorMessage('');
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-800 dark:text-green-200">{errorMessage}</p>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
          </div>
        )}
      </div>
    </Card>
  );
}
