// Simple test to verify jsPDF functionality
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const testPDFGeneration = () => {
  console.log('🧪 Testing basic PDF generation...');
  
  try {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Test PDF', 20, 20);
    doc.text('This is a simple test to verify jsPDF is working.', 20, 40);
    
    const pdfBlob = doc.output('blob');
    console.log('✅ Basic PDF test successful:', pdfBlob);
    console.log('📊 PDF blob type:', typeof pdfBlob);
    console.log('📊 PDF blob size:', pdfBlob.size);
    
    return pdfBlob;
  } catch (error) {
    console.error('❌ Basic PDF test failed:', error);
    return null;
  }
};

export default testPDFGeneration;