import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { showLoading, showSuccess, showError, dismissToast } from './toast';

export const exportToPdf = async (element: HTMLElement, filename: string = 'relatorio.pdf') => {
  const toastId = showLoading('Gerando PDF, por favor aguarde...');
  try {
    const canvas = await html2canvas(element, {
      scale: 2, // Aumenta a escala para melhor qualidade
      useCORS: true, // Importante se houver imagens de outras origens
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' para retrato, 'mm' para milímetros, 'a4' para tamanho A4
    const imgWidth = 210; // Largura A4 em mm
    const pageHeight = 297; // Altura A4 em mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    showSuccess('PDF gerado com sucesso!');
  } catch (error: any) {
    console.error('Erro ao gerar PDF:', error);
    showError('Erro ao gerar PDF: ' + error.message);
  } finally {
    dismissToast(toastId);
  }
};