import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

// Types
interface PickListMaterial {
  material_sku: string;
  material_name: string;
  category: string;
  sub_category: string | null;
  unit_type: string;
  total_quantity: number;
  // Stocking area info
  area_code: string | null;
  area_name: string | null;
  area_color_hex: string | null;
}

interface BundleProject {
  id: string;
  project_code: string;
  project_name: string;
  customer_name: string | null;
}

interface PickListData {
  project_id: string;
  project_code: string;
  project_name: string;
  customer_name: string | null;
  customer_address: string | null;
  expected_pickup_date: string | null;
  crew_name: string | null;
  yard_name: string | null;
  is_bundle: boolean;
  bundle_projects: BundleProject[] | null;
  materials: PickListMaterial[];
  total_linear_feet: number | null;
}

// Category display order and short names
const CATEGORY_ORDER: Record<string, { order: number; shortName: string }> = {
  '01-Post': { order: 1, shortName: 'Posts' },
  '02-Pickets': { order: 2, shortName: 'Pickets' },
  '03-Rails': { order: 3, shortName: 'Rails' },
  '04-Cap/Trim': { order: 4, shortName: 'Cap/Trim' },
  '05-Boards': { order: 5, shortName: 'Boards' },
  '06-Concrete': { order: 6, shortName: 'Concrete' },
  '07-Gate': { order: 7, shortName: 'Gate' },
  '08-Hardware': { order: 8, shortName: 'Hardware' },
  '09-Iron': { order: 9, shortName: 'Iron' },
};

// Generate QR code as data URL
async function generateQRCode(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 80,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code:', err);
    return '';
  }
}

// Convert hex color to RGB array for jsPDF
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ];
  }
  return [240, 240, 240]; // Default gray
}

// Get lighter version of color for background
function getLighterColor(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  // Mix with white (80% white, 20% color)
  return [
    Math.round(r * 0.25 + 255 * 0.75),
    Math.round(g * 0.25 + 255 * 0.75),
    Math.round(b * 0.25 + 255 * 0.75),
  ];
}

// Get text color (darker version of the area color)
function getDarkerColor(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  // Darken by 40%
  return [
    Math.round(r * 0.6),
    Math.round(g * 0.6),
    Math.round(b * 0.6),
  ];
}

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Group materials by category
function groupMaterialsByCategory(materials: PickListMaterial[]): Map<string, PickListMaterial[]> {
  const grouped = new Map<string, PickListMaterial[]>();

  // Sort materials by category order first
  const sorted = [...materials].sort((a, b) => {
    const orderA = CATEGORY_ORDER[a.category]?.order ?? 99;
    const orderB = CATEGORY_ORDER[b.category]?.order ?? 99;
    return orderA - orderB;
  });

  sorted.forEach(material => {
    const category = material.category;
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(material);
  });

  return grouped;
}

// Generate the Pick List PDF
export async function generatePickListPDF(data: PickListData, copies: number = 3): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter', // 8.5" x 11"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  // Generate QR code - path-based URL that auto-opens mobile view with this project
  // Using /claim/CODE format for reliable PWA deep linking
  const appUrl = `${window.location.origin}/claim/${data.project_code}`;
  const qrCodeDataUrl = await generateQRCode(appUrl);

  // Generate each copy
  for (let copy = 0; copy < copies; copy++) {
    if (copy > 0) {
      doc.addPage();
    }

    let yPos = margin;

    // ============================================
    // HEADER SECTION
    // ============================================

    // Company name and title (left side)
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DISCOUNT FENCE USA', margin, yPos + 5);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Pick List', margin, yPos + 11);

    // Large Project Code (right side) - main visual identifier
    const codeBoxWidth = 45;
    const codeBoxHeight = 20;
    const codeBoxX = pageWidth - margin - codeBoxWidth;

    // Black background box
    doc.setFillColor(30, 30, 30);
    doc.rect(codeBoxX, yPos, codeBoxWidth, codeBoxHeight, 'F');

    // White text - large project code
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    const codeText = data.project_code || '---';
    const codeTextWidth = doc.getTextWidth(codeText);
    doc.text(codeText, codeBoxX + (codeBoxWidth - codeTextWidth) / 2, yPos + 13);

    // Reset text color
    doc.setTextColor(0, 0, 0);

    yPos += codeBoxHeight + 5;

    // Horizontal line
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // ============================================
    // PROJECT INFO SECTION
    // ============================================

    doc.setFontSize(9);
    const leftCol = margin;
    const rightCol = pageWidth / 2 + 5;

    // Left column
    doc.setFont('helvetica', 'bold');
    doc.text('Project:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.project_name || '-', leftCol + 18, yPos);

    // Right column
    doc.setFont('helvetica', 'bold');
    doc.text('Pickup Date:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(data.expected_pickup_date), rightCol + 25, yPos);

    yPos += 5;

    // Customer
    doc.setFont('helvetica', 'bold');
    doc.text('Customer:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.customer_name || '-', leftCol + 20, yPos);

    // Yard
    doc.setFont('helvetica', 'bold');
    doc.text('Yard:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(data.yard_name || '-', rightCol + 12, yPos);

    yPos += 5;

    // Address
    if (data.customer_address) {
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', leftCol, yPos);
      doc.setFont('helvetica', 'normal');
      // Truncate address if too long
      const maxAddrWidth = contentWidth - 25;
      let addr = data.customer_address;
      while (doc.getTextWidth(addr) > maxAddrWidth && addr.length > 10) {
        addr = addr.slice(0, -4) + '...';
      }
      doc.text(addr, leftCol + 18, yPos);
      yPos += 5;
    }

    // Crew name line (to be filled in)
    doc.setFont('helvetica', 'bold');
    doc.text('Crew:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    if (data.crew_name) {
      doc.text(data.crew_name, leftCol + 12, yPos);
    } else {
      doc.setDrawColor(150, 150, 150);
      doc.line(leftCol + 12, yPos, leftCol + 70, yPos);
    }

    // Linear feet
    if (data.total_linear_feet) {
      doc.setFont('helvetica', 'bold');
      doc.text('Total LF:', rightCol, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(data.total_linear_feet.toLocaleString(), rightCol + 18, yPos);
    }

    yPos += 5;

    // Bundle info if applicable
    if (data.is_bundle && data.bundle_projects && data.bundle_projects.length > 0) {
      doc.setFillColor(245, 240, 255);
      doc.rect(margin, yPos, contentWidth, 10, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 50, 150);
      doc.text(`BUNDLE (${data.bundle_projects.length} projects):`, margin + 2, yPos + 4);

      doc.setFont('helvetica', 'normal');
      const projectCodes = data.bundle_projects.map(p => p.project_code).join(', ');
      doc.text(projectCodes, margin + 45, yPos + 4);

      doc.setTextColor(0, 0, 0);
      yPos += 12;
    }

    yPos += 3;

    // ============================================
    // MATERIALS TABLE
    // ============================================

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('MATERIALS', margin, yPos);
    yPos += 3;

    // Group materials by category
    const groupedMaterials = groupMaterialsByCategory(data.materials);
    const categories = Array.from(groupedMaterials.keys());

    // Filter out empty categories
    const nonEmptyCategories = categories.filter(cat => {
      const mats = groupedMaterials.get(cat) || [];
      return mats.some(m => m.total_quantity > 0);
    });

    // Determine if we need 2 columns (more than 10 items total)
    const totalItems = data.materials.filter(m => m.total_quantity > 0).length;
    const useTwoColumns = totalItems > 10;

    if (useTwoColumns) {
      // Two-column layout
      const colWidth = (contentWidth - 5) / 2;
      const leftTableX = margin;
      const rightTableX = margin + colWidth + 5;

      // Split categories roughly in half by item count
      let leftItems = 0;
      let splitIndex = 0;
      const halfItems = Math.ceil(totalItems / 2);

      for (let i = 0; i < nonEmptyCategories.length; i++) {
        const catMats = groupedMaterials.get(nonEmptyCategories[i]) || [];
        const catCount = catMats.filter(m => m.total_quantity > 0).length;
        if (leftItems + catCount <= halfItems || leftItems === 0) {
          leftItems += catCount;
          splitIndex = i + 1;
        } else {
          break;
        }
      }

      const leftCategories = nonEmptyCategories.slice(0, splitIndex);
      const rightCategories = nonEmptyCategories.slice(splitIndex);

      // Render left column
      let leftY = yPos;
      leftCategories.forEach(category => {
        const categoryMaterials = (groupedMaterials.get(category) || []).filter(m => m.total_quantity > 0);
        if (categoryMaterials.length === 0) return;

        const shortName = CATEGORY_ORDER[category]?.shortName || category;

        // Get area color from first material in category
        const areaColor = categoryMaterials[0]?.area_color_hex;
        const bgColor = areaColor ? getLighterColor(areaColor) : [240, 240, 240] as [number, number, number];
        const textColor = areaColor ? getDarkerColor(areaColor) : [60, 60, 60] as [number, number, number];

        autoTable(doc, {
          startY: leftY,
          margin: { left: leftTableX, right: pageWidth - leftTableX - colWidth },
          head: [[{ content: shortName, colSpan: 3, styles: { fillColor: bgColor, textColor: textColor, fontStyle: 'bold', fontSize: 8 } }]],
          body: categoryMaterials.map(m => [
            { content: '☐', styles: { cellWidth: 6, halign: 'center' } },
            m.material_name.length > 30 ? m.material_name.slice(0, 30) + '...' : m.material_name,
            { content: m.total_quantity.toString(), styles: { halign: 'right', fontStyle: 'bold' } },
          ]),
          theme: 'plain',
          styles: { fontSize: 8, cellPadding: 1.5 },
          columnStyles: {
            0: { cellWidth: 6 },
            1: { cellWidth: colWidth - 22 },
            2: { cellWidth: 12 },
          },
        });

        leftY = (doc as any).lastAutoTable.finalY + 2;
      });

      // Render right column
      let rightY = yPos;
      rightCategories.forEach(category => {
        const categoryMaterials = (groupedMaterials.get(category) || []).filter(m => m.total_quantity > 0);
        if (categoryMaterials.length === 0) return;

        const shortName = CATEGORY_ORDER[category]?.shortName || category;

        // Get area color from first material in category
        const areaColor = categoryMaterials[0]?.area_color_hex;
        const bgColor = areaColor ? getLighterColor(areaColor) : [240, 240, 240] as [number, number, number];
        const textColor = areaColor ? getDarkerColor(areaColor) : [60, 60, 60] as [number, number, number];

        autoTable(doc, {
          startY: rightY,
          margin: { left: rightTableX, right: margin },
          head: [[{ content: shortName, colSpan: 3, styles: { fillColor: bgColor, textColor: textColor, fontStyle: 'bold', fontSize: 8 } }]],
          body: categoryMaterials.map(m => [
            { content: '☐', styles: { cellWidth: 6, halign: 'center' } },
            m.material_name.length > 30 ? m.material_name.slice(0, 30) + '...' : m.material_name,
            { content: m.total_quantity.toString(), styles: { halign: 'right', fontStyle: 'bold' } },
          ]),
          theme: 'plain',
          styles: { fontSize: 8, cellPadding: 1.5 },
          columnStyles: {
            0: { cellWidth: 6 },
            1: { cellWidth: colWidth - 22 },
            2: { cellWidth: 12 },
          },
        });

        rightY = (doc as any).lastAutoTable.finalY + 2;
      });

      yPos = Math.max(leftY, rightY);
    } else {
      // Single column layout
      nonEmptyCategories.forEach(category => {
        const categoryMaterials = (groupedMaterials.get(category) || []).filter(m => m.total_quantity > 0);
        if (categoryMaterials.length === 0) return;

        const shortName = CATEGORY_ORDER[category]?.shortName || category;

        // Get area color from first material in category (they should all have same area)
        const areaColor = categoryMaterials[0]?.area_color_hex;
        const bgColor = areaColor ? getLighterColor(areaColor) : [240, 240, 240] as [number, number, number];
        const textColor = areaColor ? getDarkerColor(areaColor) : [60, 60, 60] as [number, number, number];

        autoTable(doc, {
          startY: yPos,
          margin: { left: margin, right: margin },
          head: [[{ content: shortName, colSpan: 3, styles: { fillColor: bgColor, textColor: textColor, fontStyle: 'bold', fontSize: 9 } }]],
          body: categoryMaterials.map(m => [
            { content: '☐', styles: { cellWidth: 8, halign: 'center' } },
            m.material_name,
            { content: m.total_quantity.toString(), styles: { halign: 'right', fontStyle: 'bold' } },
          ]),
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 8 },
            1: { cellWidth: contentWidth - 28 },
            2: { cellWidth: 16 },
          },
        });

        yPos = (doc as any).lastAutoTable.finalY + 2;
      });
    }

    // ============================================
    // FOOTER SECTION - Signature & QR Code
    // ============================================

    // Position footer at bottom of page
    const footerY = pageHeight - 45;

    // Horizontal line above footer
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY, pageWidth - margin, footerY);

    // Partial pickup checkbox
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.rect(margin, footerY + 5, 4, 4);
    doc.text('PARTIAL PICKUP', margin + 6, footerY + 8);

    doc.setFontSize(8);
    doc.text('Notes:', margin + 45, footerY + 8);
    doc.setDrawColor(150, 150, 150);
    doc.line(margin + 55, footerY + 8, pageWidth - margin - 30, footerY + 8);

    // Signature section
    const sigY = footerY + 18;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Crew Signature:', margin, sigY);
    doc.setDrawColor(100, 100, 100);
    doc.line(margin + 32, sigY, margin + 100, sigY);

    doc.text('Date:', margin + 110, sigY);
    doc.line(margin + 120, sigY, margin + 155, sigY);

    // QR Code (bottom right)
    if (qrCodeDataUrl) {
      const qrSize = 22;
      const qrX = pageWidth - margin - qrSize;
      const qrY = footerY + 5;
      doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Scan for digital', qrX, qrY + qrSize + 3);
      doc.setTextColor(0, 0, 0);
    }

    // Copy indicator (small text)
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.text(`Copy ${copy + 1} of ${copies}`, pageWidth - margin - 20, pageHeight - 5);
    doc.setTextColor(0, 0, 0);
  }

  // Save/download the PDF
  const filename = `PickList_${data.project_code || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// Helper to fetch pick list data and generate PDF
export async function fetchAndGeneratePickListPDF(
  projectId: string,
  supabase: any,
  copies: number = 3
): Promise<void> {
  // Fetch project data
  const { data: project, error: projectError } = await supabase
    .from('bom_projects')
    .select(`
      id,
      project_code,
      project_name,
      customer_name,
      customer_address,
      expected_pickup_date,
      crew_name,
      is_bundle,
      total_linear_feet,
      yard_id,
      yards (
        name
      )
    `)
    .eq('id', projectId)
    .single();

  if (projectError) throw projectError;

  // Fetch bundle projects if this is a bundle
  let bundleProjects: BundleProject[] | null = null;
  if (project.is_bundle) {
    const { data: children, error: childError } = await supabase
      .from('bom_projects')
      .select('id, project_code, project_name, customer_name')
      .eq('bundle_id', projectId);

    if (!childError && children) {
      bundleProjects = children;
    }
  }

  // Fetch materials - either from v_pick_list view or directly
  // Using direct query for more control
  let projectIds = [projectId];
  if (project.is_bundle && bundleProjects) {
    projectIds = bundleProjects.map(p => p.id);
  }

  const { data: materials, error: matError } = await supabase
    .from('project_materials')
    .select(`
      final_quantity,
      materials (
        material_sku,
        material_name,
        category,
        sub_category,
        unit_type,
        default_area:yard_areas (
          area_code,
          area_name,
          color_hex
        )
      )
    `)
    .in('project_id', projectIds);

  if (matError) throw matError;

  // Aggregate materials
  const materialMap = new Map<string, PickListMaterial>();
  (materials || []).forEach((pm: any) => {
    if (!pm.materials) return;
    const mat = pm.materials;
    const key = mat.material_sku;
    if (materialMap.has(key)) {
      materialMap.get(key)!.total_quantity += pm.final_quantity || 0;
    } else {
      materialMap.set(key, {
        material_sku: mat.material_sku,
        material_name: mat.material_name,
        category: mat.category,
        sub_category: mat.sub_category,
        unit_type: mat.unit_type,
        total_quantity: pm.final_quantity || 0,
        area_code: mat.default_area?.area_code || null,
        area_name: mat.default_area?.area_name || null,
        area_color_hex: mat.default_area?.color_hex || null,
      });
    }
  });

  // Build the data object
  const pickListData: PickListData = {
    project_id: project.id,
    project_code: project.project_code,
    project_name: project.project_name,
    customer_name: project.customer_name,
    customer_address: project.customer_address,
    expected_pickup_date: project.expected_pickup_date,
    crew_name: project.crew_name,
    yard_name: project.yards?.name || null,
    is_bundle: project.is_bundle,
    bundle_projects: bundleProjects,
    materials: Array.from(materialMap.values()),
    total_linear_feet: project.total_linear_feet,
  };

  // Generate the PDF
  await generatePickListPDF(pickListData, copies);
}
