import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Utility class for exporting components to PDF
 */
export class PDFExporter {
  /**
   * Export a DOM element to PDF
   * @param {HTMLElement} element - The DOM element to export
   * @param {Object} options - Configuration options
   * @param {string} options.filename - The filename for the PDF (without extension)
   * @param {string} options.orientation - 'portrait' or 'landscape'
   * @param {string} options.unit - Unit of measurement ('mm', 'cm', 'in', 'px')
   * @param {string|Array} options.format - Paper format ('a4', 'a3', 'letter', etc.) or [width, height]
   * @param {number} options.scale - Scale factor for html2canvas
   * @param {boolean} options.useCORS - Whether to use CORS for images
   * @param {Object} options.margin - Margin settings {top, right, bottom, left}
   * @returns {Promise<void>}
   */
  static async exportToPDF(element, options = {}) {
    const {
      filename = 'export',
      orientation = 'portrait',
      unit = 'mm',
      format = 'a4',
      scale = 2,
      useCORS = true,
      margin = { top: 10, right: 10, bottom: 10, left: 10 }
    } = options;

    try {
      // Show loading state
      const originalCursor = document.body.style.cursor;
      document.body.style.cursor = 'wait';

      // Create canvas from the element
      const canvas = await html2canvas(element, {
        scale: scale,
        useCORS: useCORS,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: orientation,
        unit: unit,
        format: format
      });

      // Get PDF dimensions
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate available space after margins
      const availableWidth = pdfWidth - margin.left - margin.right;
      const availableHeight = pdfHeight - margin.top - margin.bottom;
      
      // Calculate image dimensions
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      
      // Calculate scaled dimensions to fit within available space
      let scaledWidth = availableWidth;
      let scaledHeight = scaledWidth / ratio;
      
      if (scaledHeight > availableHeight) {
        scaledHeight = availableHeight;
        scaledWidth = scaledHeight * ratio;
      }
      
      // Center the image if it's smaller than available space
      const xOffset = margin.left + (availableWidth - scaledWidth) / 2;
      const yOffset = margin.top + (availableHeight - scaledHeight) / 2;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, scaledWidth, scaledHeight);
      
      // Save the PDF
      pdf.save(`${filename}.pdf`);
      
      // Reset cursor
      document.body.style.cursor = originalCursor;
      
      console.log(`PDF exported successfully as ${filename}.pdf`);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      document.body.style.cursor = 'default';
      throw new Error('Failed to export PDF: ' + error.message);
    }
  }

  /**
   * Export with custom styling for print
   * @param {HTMLElement} element - The DOM element to export
   * @param {Object} options - Configuration options
   * @returns {Promise<void>}
   */
  static async exportToPDFWithPrintStyles(element, options = {}) {
    try {
      // Create a temporary container with print styles
      const printContainer = document.createElement('div');
      printContainer.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        width: 210mm;
        background: white;
        padding: 20px;
        font-family: 'Arial', sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
      `;
      
      // Clone the element
      const clonedElement = element.cloneNode(true);
      
      // Apply print-friendly styles to the cloned element
      this.applyPrintStyles(clonedElement);
      
      printContainer.appendChild(clonedElement);
      document.body.appendChild(printContainer);
      
      try {
        // Export the styled container
        await this.exportToPDF(printContainer, {
          ...options,
          scale: 1.5,
          margin: { top: 15, right: 15, bottom: 15, left: 15 }
        });
      } finally {
        // Clean up
        document.body.removeChild(printContainer);
      }
    } catch (error) {
      console.error('Error exporting PDF with print styles:', error);
      throw error;
    }
  }

  /**
   * Apply print-friendly styles to an element and its children
   * @param {HTMLElement} element - The element to style
   */
  static applyPrintStyles(element) {
    // Remove any problematic styles
    element.style.boxShadow = 'none';
    element.style.borderRadius = '0';
    element.style.background = 'white';
    element.style.color = '#000';
    
    // Style tables for better PDF output
    const tables = element.querySelectorAll('table');
    tables.forEach(table => {
      table.style.cssText = `
        border-collapse: collapse;
        width: 100%;
        margin: 10px 0;
        font-size: 11px;
      `;
      
      // Style table headers
      const headers = table.querySelectorAll('th');
      headers.forEach(th => {
        th.style.cssText = `
          background-color: #f5f5f5 !important;
          border: 1px solid #ccc;
          padding: 8px;
          text-align: left;
          font-weight: bold;
          color: #000;
        `;
      });
      
      // Style table cells
      const cells = table.querySelectorAll('td');
      cells.forEach(td => {
        td.style.cssText = `
          border: 1px solid #ccc;
          padding: 6px 8px;
          color: #000;
          background: white;
        `;
      });
    });
    
    // Style input fields to show their values
    const inputs = element.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (input.type !== 'hidden' && input.type !== 'button' && input.type !== 'submit') {
        const value = input.value || input.placeholder || '';
        input.style.cssText = `
          border: 1px solid #ccc;
          padding: 4px;
          background: white;
          color: #000;
          font-size: 11px;
        `;
        
        // For select elements, show selected option
        if (input.tagName.toLowerCase() === 'select') {
          const selectedOption = input.options[input.selectedIndex];
          if (selectedOption) {
            input.style.color = '#000';
          }
        }
      }
    });
    
    // Style buttons to be more print-friendly
    const buttons = element.querySelectorAll('button');
    buttons.forEach(button => {
      button.style.cssText = `
        border: 1px solid #ccc;
        background: #f5f5f5;
        color: #000;
        padding: 4px 8px;
        font-size: 10px;
      `;
    });
    
    // Hide elements that shouldn't appear in PDF
    const hideElements = element.querySelectorAll('.no-print, .print-hide');
    hideElements.forEach(el => {
      el.style.display = 'none';
    });
    
    // Style headings
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      heading.style.color = '#000';
      heading.style.marginTop = '15px';
      heading.style.marginBottom = '10px';
    });
    
    // Style form sections
    const formSections = element.querySelectorAll('.form-section, .section');
    formSections.forEach(section => {
      section.style.cssText = `
        margin: 15px 0;
        padding: 10px;
        border: 1px solid #ddd;
        background: white;
      `;
    });
  }
}

export default PDFExporter;