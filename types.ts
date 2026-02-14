
export interface SignatureSettings {
  x: number;
  y: number;
  scale: number;
  opacity: number;
  mode: 'all' | 'last' | 'custom';
  selectedPages: number[]; // 0-indexed page numbers
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
