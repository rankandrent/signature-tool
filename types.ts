
export interface PagePosition {
  x: number;
  y: number;
}

export interface SignatureSettings {
  scale: number;
  opacity: number;
  isGrayscale: boolean; // New property for black & white mode
  mode: 'all' | 'last' | 'custom';
  selectedPages: number[]; // 0-indexed page numbers
  pagePositions: Record<number, PagePosition>; // Key: page index
  globalX: number; // Default X for newly selected pages
  globalY: number; // Default Y for newly selected pages
}

export interface FileData {
  file: File;
  previewUrl: string;
}

export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}
