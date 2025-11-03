/**
 * Optimized Excel/CSV utilities with lazy loading
 * These functions will dynamically load heavy libraries only when needed
 */

import { loadHeavyLibraries } from './lazyLoader.jsx';

/**
 * Optimized Excel export with lazy loading
 */
export const exportToExcel = async (data, filename = 'export.xlsx') => {
  try {
    // Only load XLSX when actually exporting
    const XLSX = await loadHeavyLibraries.xlsx();
    const FileSaver = await loadHeavyLibraries.fileSaver();
    
    if (!XLSX || !FileSaver) {
      throw new Error('Required libraries not available');
    }

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    FileSaver.saveAs(blob, filename);
    return true;
  } catch (error) {
    console.error('Excel export failed:', error);
    // Fallback to CSV export
    return exportToCSV(data, filename.replace('.xlsx', '.csv'));
  }
};

/**
 * Lightweight CSV export (no external dependencies)
 */
export const exportToCSV = (data, filename = 'export.csv') => {
  try {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return false;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes
          return typeof value === 'string' && (value.includes(',') || value.includes('"'))
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('CSV export failed:', error);
    return false;
  }
};

/**
 * Optimized file reading with lazy loading
 */
export const readExcelFile = async (file) => {
  try {
    const XLSX = await loadHeavyLibraries.xlsx();
    
    if (!XLSX) {
      throw new Error('XLSX library not available');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsArrayBuffer(file);
    });
  } catch (error) {
    console.error('Excel reading failed:', error);
    throw error;
  }
};

/**
 * Lightweight CSV reading (no external dependencies)
 */
export const readCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length === 0) {
          resolve([]);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsText(file);
  });
};

/**
 * Smart file reader that chooses the right method based on file type
 */
export const readFile = async (file) => {
  const fileExtension = file.name.split('.').pop().toLowerCase();
  
  switch (fileExtension) {
    case 'xlsx':
    case 'xls':
      return await readExcelFile(file);
    case 'csv':
      return await readCSVFile(file);
    default:
      throw new Error(`Unsupported file format: ${fileExtension}`);
  }
};

/**
 * Bulk data processing with performance optimization
 */
export const processBulkData = async (data, batchSize = 1000) => {
  if (!data || data.length === 0) return [];

  const results = [];
  
  // Process in batches to avoid blocking the main thread
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    // Use setTimeout to yield to the main thread
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // Process batch
    const processedBatch = batch.map(item => {
      // Add any processing logic here
      return {
        ...item,
        processed: true,
        processedAt: new Date().toISOString()
      };
    });
    
    results.push(...processedBatch);
  }
  
  return results;
};

/**
 * Memory-efficient data filtering
 */
export const filterLargeDataset = (data, filterFn, chunkSize = 1000) => {
  if (!data || data.length === 0) return [];
  
  const results = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const filtered = chunk.filter(filterFn);
    results.push(...filtered);
  }
  
  return results;
};

export default {
  exportToExcel,
  exportToCSV,
  readExcelFile,
  readCSVFile,
  readFile,
  processBulkData,
  filterLargeDataset
};
