import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { InitiativeWithDetails } from './leadership';

/**
 * Generate PDF report for progress dashboard
 */
export const exportProgressDashboardPDF = (data: {
  totalInitiatives: number;
  activeInitiatives: number;
  completedInitiatives: number;
  atRiskInitiatives: number;
  completionRate: number;
  averageProgress: number;
  initiativesByFunction: Array<{
    function: { name: string; description?: string };
    total: number;
    completed: number;
    active: number;
    atRisk: number;
    avgProgress: number;
    completionRate: number;
  }>;
  allInitiatives?: InitiativeWithDetails[];
}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Leadership Progress Report', pageWidth / 2, 20, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`, pageWidth / 2, 28, { align: 'center' });

  // Summary Statistics
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Executive Summary', 14, 40);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const summaryY = 48;
  const colWidth = 45;

  // Column 1
  doc.text(`Total Initiatives: ${data.totalInitiatives}`, 14, summaryY);
  doc.text(`Active: ${data.activeInitiatives}`, 14, summaryY + 6);

  // Column 2
  doc.text(`Completed: ${data.completedInitiatives}`, 14 + colWidth, summaryY);
  doc.text(`At Risk: ${data.atRiskInitiatives}`, 14 + colWidth, summaryY + 6);

  // Column 3
  doc.text(`Completion Rate: ${data.completionRate}%`, 14 + colWidth * 2, summaryY);
  doc.text(`Average Progress: ${data.averageProgress}%`, 14 + colWidth * 2, summaryY + 6);

  // Progress by Function Table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Progress by Function', 14, 68);

  autoTable(doc, {
    startY: 74,
    head: [['Function', 'Total', 'Active', 'Completed', 'At Risk', 'Avg Progress', 'Completion %']],
    body: data.initiativesByFunction.map(item => [
      item.function.name,
      item.total.toString(),
      item.active.toString(),
      item.completed.toString(),
      item.atRisk.toString(),
      `${item.avgProgress}%`,
      `${item.completionRate}%`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 9 },
  });

  if (data.allInitiatives && data.allInitiatives.length > 0) {
    // Add new page for detailed initiatives list
    doc.addPage();

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('All Initiatives', 14, 20);

    autoTable(doc, {
      startY: 28,
      head: [['Initiative', 'Area', 'Status', 'Priority', 'Progress', 'Assigned To']],
      body: data.allInitiatives.slice(0, 50).map(initiative => [
        initiative.title.length > 40 ? initiative.title.substring(0, 37) + '...' : initiative.title,
        initiative.area?.name || 'N/A',
        initiative.status.replace('_', ' '),
        initiative.priority,
        `${initiative.progress_percent}%`,
        initiative.assigned_user?.full_name || 'Unassigned',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 8 },
    });
  }

  // Save the PDF
  doc.save(`leadership-progress-report-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Generate PDF report for a single initiative
 */
export const exportInitiativePDF = (initiative: InitiativeWithDetails) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(initiative.title, pageWidth / 2, 20, { align: 'center' });

  // Area and Function
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  const areaText = initiative.area?.name || 'Unknown Area';
  doc.text(areaText, pageWidth / 2, 28, { align: 'center' });

  let yPos = 40;

  // Basic Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Overview', 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const info = [
    ['Status:', initiative.status.replace('_', ' ')],
    ['Priority:', initiative.priority],
    ['Progress:', `${initiative.progress_percent}%`],
    ['Assigned To:', initiative.assigned_user?.full_name || 'Unassigned'],
    ['Created:', new Date(initiative.created_at).toLocaleDateString()],
  ];

  info.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 14, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 50, yPos);
    yPos += 6;
  });

  yPos += 6;

  // Description
  if (initiative.description) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Description', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const descLines = doc.splitTextToSize(initiative.description, pageWidth - 28);
    doc.text(descLines, 14, yPos);
    yPos += descLines.length * 6 + 6;
  }

  // Success Criteria
  if (initiative.success_criteria) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Success Criteria', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const criteriaLines = doc.splitTextToSize(initiative.success_criteria, pageWidth - 28);
    doc.text(criteriaLines, 14, yPos);
    yPos += criteriaLines.length * 6 + 6;
  }

  // This Week / Next Week
  if (initiative.this_week || initiative.next_week) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Weekly Updates', 14, yPos);
    yPos += 8;

    if (initiative.this_week) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('This Week:', 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const thisWeekLines = doc.splitTextToSize(initiative.this_week, pageWidth - 28);
      doc.text(thisWeekLines, 14, yPos);
      yPos += thisWeekLines.length * 6 + 4;
    }

    if (initiative.next_week) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Next Week:', 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const nextWeekLines = doc.splitTextToSize(initiative.next_week, pageWidth - 28);
      doc.text(nextWeekLines, 14, yPos);
    }
  }

  // Save the PDF
  const fileName = initiative.title.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 50);
  doc.save(`initiative-${fileName}-${new Date().toISOString().split('T')[0]}.pdf`);
};

/**
 * Generate PDF report for user's initiatives
 */
export const exportMyInitiativesPDF = (
  initiatives: InitiativeWithDetails[],
  userName: string
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('My Initiatives Report', pageWidth / 2, 20, { align: 'center' });

  // User name and date
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(userName, pageWidth / 2, 28, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })}`, pageWidth / 2, 34, { align: 'center' });

  // Summary Statistics
  const total = initiatives.length;
  const active = initiatives.filter(i => i.status === 'active').length;
  const completed = initiatives.filter(i => i.status === 'completed').length;
  const atRisk = initiatives.filter(i => i.color_status === 'red').length;
  const avgProgress = total > 0
    ? Math.round(initiatives.reduce((sum, i) => sum + i.progress_percent, 0) / total)
    : 0;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, 46);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total: ${total} | Active: ${active} | Completed: ${completed} | At Risk: ${atRisk} | Avg Progress: ${avgProgress}%`, 14, 54);

  // Initiatives Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Initiatives', 14, 64);

  autoTable(doc, {
    startY: 70,
    head: [['Initiative', 'Area', 'Status', 'Priority', 'Progress', 'This Week']],
    body: initiatives.map(initiative => [
      initiative.title.length > 35 ? initiative.title.substring(0, 32) + '...' : initiative.title,
      initiative.area?.name || 'N/A',
      initiative.status.replace('_', ' '),
      initiative.priority,
      `${initiative.progress_percent}%`,
      initiative.this_week
        ? (initiative.this_week.length > 30 ? initiative.this_week.substring(0, 27) + '...' : initiative.this_week)
        : '-',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] },
    styles: { fontSize: 8 },
  });

  // Save the PDF
  doc.save(`my-initiatives-${new Date().toISOString().split('T')[0]}.pdf`);
};
