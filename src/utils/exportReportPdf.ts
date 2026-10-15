import { jsPDF } from 'jspdf';
import type { WeeklyCheckpointReport, BoardWeeklyMetrics, TaskWithAssignee } from '../types';
import { getTaskCode } from './taskId';
import { formatFullDate } from './reportUtils';

interface ExportPdfOptions {
  report: WeeklyCheckpointReport;
  displayedMetrics: BoardWeeklyMetrics[];
  criticalTasks: Array<{ task: TaskWithAssignee; boardName: string; isDelayed: boolean }>;
  aggregatedStats: {
    completedThisWeek: number;
    completedPrevWeek: number;
    completedDelta: number;
    delayedThisWeek: number;
    delayedPrevWeek: number;
    delayedDelta: number;
    highPriorityThisWeek: number;
    highPriorityPrevWeek: number;
    highPriorityDelta: number;
    completionRate: number;
    totalTasks: number;
  };
  currentUserEmail?: string | null;
  selectedBoardFilter?: string;
}

export const exportWeeklyReportToPdf = async ({
  report,
  displayedMetrics,
  criticalTasks,
  aggregatedStats,
  currentUserEmail,
  selectedBoardFilter,
}: ExportPdfOptions): Promise<string> => {
  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm
  let currentY = 16;

  const checkAddPage = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - 16) {
      doc.addPage();
      currentY = 16;
      drawPageHeader();
      return true;
    }
    return false;
  };

  const drawPageHeader = () => {
    // Subtle mini-header on pages after page 1
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 145);
    doc.text(`Weekly Checkpoint Report • ${report.weekRange}`, marginX, 10);
    doc.setDrawColor(230, 230, 235);
    doc.setLineWidth(0.2);
    doc.line(marginX, 12, marginX + contentWidth, 12);
  };

  // ----------------------------------------------------
  // 1. Executive Title & Header Banner
  // ----------------------------------------------------
  // Header background badge
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.roundedRect(marginX, currentY, contentWidth, 24, 2.5, 2.5, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('WEEKLY CHECKPOINT REPORT', marginX + 6, currentY + 9);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216); // zinc-300
  doc.text(
    'Deliverable velocity, sprint completions, and active task tracking',
    marginX + 6,
    currentY + 15
  );

  // Generation timestamp & metadata (right-aligned in badge)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const weekLabel = `PERIOD: ${report.weekRange.toUpperCase()}`;
  doc.text(weekLabel, marginX + contentWidth - 6, currentY + 9, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(161, 161, 170); // zinc-400
  const genDate = `Generated on ${formatFullDate(new Date())}`;
  doc.text(genDate, marginX + contentWidth - 6, currentY + 15, { align: 'right' });

  currentY += 28;

  // Filter indicator if filtered to a specific board
  if (selectedBoardFilter && selectedBoardFilter !== 'all') {
    doc.setFillColor(244, 244, 245);
    doc.roundedRect(marginX, currentY, contentWidth, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 91);
    const filterName = displayedMetrics[0]?.boardName || selectedBoardFilter;
    doc.text(`Filtered to board: "${filterName}" • Showing 1 of ${report.boardMetrics.length} boards`, marginX + 4, currentY + 4.8);
    currentY += 10;
  }

  // ----------------------------------------------------
  // 2. Executive KPI Summary Cards (4 Columns)
  // ----------------------------------------------------
  const cardGap = 3.5;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 22;

  const kpis = [
    {
      label: 'TASKS COMPLETED',
      value: String(aggregatedStats.completedThisWeek),
      unit: 'tasks',
      delta: `${aggregatedStats.completedDelta >= 0 ? '+' : ''}${aggregatedStats.completedDelta} vs prev`,
      deltaPositive: aggregatedStats.completedDelta >= 0,
      bgR: 240,
      bgG: 253,
      bgB: 244, // emerald-50
      borderR: 167,
      borderG: 243,
      borderB: 208, // emerald-200
      accentR: 16,
      accentG: 185,
      accentB: 129, // emerald-500
    },
    {
      label: 'DELAYED / OVERDUE',
      value: String(aggregatedStats.delayedThisWeek),
      unit: 'overdue',
      delta: `${aggregatedStats.delayedDelta <= 0 ? '' : '+'}${aggregatedStats.delayedDelta} vs prev`,
      deltaPositive: aggregatedStats.delayedDelta <= 0,
      bgR: 255,
      bgG: 241,
      bgB: 242, // rose-50
      borderR: 254,
      borderG: 205,
      borderB: 211, // rose-200
      accentR: 244,
      accentG: 63,
      accentB: 94, // rose-500
    },
    {
      label: 'HIGH PRIORITY',
      value: String(aggregatedStats.highPriorityThisWeek),
      unit: 'urgent',
      delta: `${aggregatedStats.highPriorityDelta <= 0 ? '' : '+'}${aggregatedStats.highPriorityDelta} vs prev`,
      deltaPositive: aggregatedStats.highPriorityDelta <= 0,
      bgR: 255,
      bgG: 251,
      bgB: 235, // amber-50
      borderR: 253,
      borderG: 230,
      borderB: 138, // amber-200
      accentR: 245,
      accentG: 158,
      accentB: 11, // amber-500
    },
    {
      label: 'COMPLETION RATE',
      value: `${aggregatedStats.completionRate}%`,
      unit: 'of scope',
      delta: `${aggregatedStats.totalTasks} total tasks`,
      deltaPositive: true,
      bgR: 239,
      bgG: 246,
      bgB: 255, // blue-50
      borderR: 191,
      borderG: 219,
      borderB: 254, // blue-200
      accentR: 37,
      accentG: 99,
      accentB: 235, // blue-600
    },
  ];

  kpis.forEach((kpi, i) => {
    const cardX = marginX + i * (cardWidth + cardGap);

    // Card background
    doc.setFillColor(kpi.bgR, kpi.bgG, kpi.bgB);
    doc.setDrawColor(kpi.borderR, kpi.borderG, kpi.borderB);
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    // Accent top bar
    doc.setFillColor(kpi.accentR, kpi.accentG, kpi.accentB);
    doc.rect(cardX + 2, currentY + 1.2, cardWidth - 4, 0.8, 'F');

    // Label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(82, 82, 91);
    doc.text(kpi.label, cardX + 3.5, currentY + 6.5);

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(24, 24, 27);
    doc.text(kpi.value, cardX + 3.5, currentY + 13.5);

    // Unit
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(113, 113, 122);
    const valWidth = doc.getTextWidth(kpi.value);
    doc.text(kpi.unit, cardX + 4.5 + valWidth, currentY + 13.5);

    // Delta / subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    if (kpi.deltaPositive) {
      doc.setTextColor(5, 150, 105); // emerald-600
    } else {
      doc.setTextColor(225, 29, 72); // rose-600
    }
    doc.text(kpi.delta, cardX + 3.5, currentY + 18.5);
  });

  currentY += cardHeight + 7;

  // ----------------------------------------------------
  // 3. Active Boards Performance Breakdown Table
  // ----------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('ACTIVE BOARDS PERFORMANCE & VELOCITY', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text(`Tracking ${displayedMetrics.length} boards across workspace`, marginX + contentWidth, currentY, {
    align: 'right',
  });

  currentY += 4;

  // Table header
  const thHeight = 7;
  doc.setFillColor(244, 244, 245);
  doc.setDrawColor(228, 228, 231);
  doc.setLineWidth(0.2);
  doc.rect(marginX, currentY, contentWidth, thHeight, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(82, 82, 91);

  // Column definitions
  const colX = {
    name: marginX + 3,
    total: marginX + 68,
    completed: marginX + 90,
    delayed: marginX + 115,
    highPri: marginX + 138,
    pipeline: marginX + 160,
  };

  doc.text('BOARD WORKFLOW', colX.name, currentY + 4.8);
  doc.text('TOTAL', colX.total, currentY + 4.8);
  doc.text('COMPLETED', colX.completed, currentY + 4.8);
  doc.text('DELAYED', colX.delayed, currentY + 4.8);
  doc.text('HIGH PRIORITY', colX.highPri, currentY + 4.8);
  doc.text('PROGRESS', colX.pipeline, currentY + 4.8);

  currentY += thHeight;

  // Table rows
  const rowHeight = 9.5;
  displayedMetrics.forEach((m, idx) => {
    checkAddPage(rowHeight + 5);

    // Row alternating background
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(marginX, currentY, contentWidth, rowHeight, 'F');
    }

    doc.setDrawColor(240, 240, 242);
    doc.setLineWidth(0.2);
    doc.line(marginX, currentY + rowHeight, marginX + contentWidth, currentY + rowHeight);

    // Board name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(24, 24, 27);
    const truncatedName = m.boardName.length > 30 ? m.boardName.slice(0, 28) + '…' : m.boardName;
    doc.text(truncatedName, colX.name, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    doc.text(`Backlog: ${m.backlogCount} | In Progress: ${m.inProgressCount} | Review: ${m.reviewCount}`, colX.name, currentY + 7.8);

    // Total tasks
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(39, 39, 42);
    doc.text(String(m.totalTasks), colX.total, currentY + 5.5);

    // Completed
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129); // emerald
    const compText = `${m.completedThisWeek}`;
    doc.text(compText, colX.completed, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(113, 113, 122);
    const compDelta = m.weeklyVelocityDelta >= 0 ? `+${m.weeklyVelocityDelta} vs prev` : `${m.weeklyVelocityDelta} vs prev`;
    doc.text(compDelta, colX.completed, currentY + 7.8);

    // Delayed
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    if (m.delayedTasks > 0) {
      doc.setTextColor(225, 29, 72); // rose
    } else {
      doc.setTextColor(113, 113, 122);
    }
    doc.text(String(m.delayedTasks), colX.delayed, currentY + 5.5);

    // High Priority
    if (m.highPriorityRemaining > 0) {
      doc.setTextColor(217, 119, 6); // amber
    } else {
      doc.setTextColor(113, 113, 122);
    }
    doc.text(String(m.highPriorityRemaining), colX.highPri, currentY + 5.5);

    // Progress Bar + Percentage
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(24, 24, 27);
    doc.text(`${m.completionRate}%`, colX.pipeline, currentY + 4.5);

    // Mini progress bar
    const barWidth = 18;
    const barHeight = 2.2;
    const fillWidth = Math.max(1, (m.completionRate / 100) * barWidth);
    doc.setFillColor(228, 228, 231);
    doc.roundedRect(colX.pipeline, currentY + 5.5, barWidth, barHeight, 0.8, 0.8, 'F');
    doc.setFillColor(16, 185, 129);
    doc.roundedRect(colX.pipeline, currentY + 5.5, fillWidth, barHeight, 0.8, 0.8, 'F');

    currentY += rowHeight;
  });

  currentY += 8;

  // ----------------------------------------------------
  // 4. Critical Action Items & Attention List
  // ----------------------------------------------------
  checkAddPage(30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(24, 24, 27);
  doc.text('CRITICAL ACTION ITEMS & DELAYED DELIVERABLES', marginX, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(113, 113, 122);
  doc.text(
    `${criticalTasks.length} ${criticalTasks.length === 1 ? 'task' : 'tasks'} requiring attention`,
    marginX + contentWidth,
    currentY,
    { align: 'right' }
  );

  currentY += 4;

  if (criticalTasks.length === 0) {
    // Empty state card
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text('All project deliverables on track!', marginX + 6, currentY + 7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(4, 120, 87);
    doc.text(
      'No tasks are currently delayed past their deadlines or blocked with active high priority.',
      marginX + 6,
      currentY + 12
    );
    currentY += 22;
  } else {
    // Action items table header
    doc.setFillColor(244, 244, 245);
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.rect(marginX, currentY, contentWidth, thHeight, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(82, 82, 91);

    const taskColX = {
      id: marginX + 3,
      urgency: marginX + 22,
      title: marginX + 50,
      board: marginX + 118,
      assignee: marginX + 150,
    };

    doc.text('TASK ID', taskColX.id, currentY + 4.8);
    doc.text('STATUS', taskColX.urgency, currentY + 4.8);
    doc.text('DELIVERABLE TITLE', taskColX.title, currentY + 4.8);
    doc.text('BOARD', taskColX.board, currentY + 4.8);
    doc.text('ASSIGNEE & DUE', taskColX.assignee, currentY + 4.8);

    currentY += thHeight;

    const maxTasksToRender = Math.min(criticalTasks.length, 25);
    for (let i = 0; i < maxTasksToRender; i++) {
      const { task, boardName, isDelayed } = criticalTasks[i];
      const taskRowHeight = 9;

      checkAddPage(taskRowHeight + 5);

      if (i % 2 === 1) {
        doc.setFillColor(252, 252, 253);
        doc.rect(marginX, currentY, contentWidth, taskRowHeight, 'F');
      }

      doc.setDrawColor(240, 240, 242);
      doc.setLineWidth(0.2);
      doc.line(marginX, currentY + taskRowHeight, marginX + contentWidth, currentY + taskRowHeight);

      // Task Code Badge
      const taskCode = getTaskCode(task);
      doc.setFont('courier', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(39, 39, 42);
      doc.text(taskCode, taskColX.id, currentY + 5.5);

      // Status Badge
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      if (isDelayed) {
        doc.setFillColor(255, 228, 230); // rose-100
        doc.roundedRect(taskColX.urgency, currentY + 2.2, 24, 4.8, 1, 1, 'F');
        doc.setTextColor(190, 18, 60); // rose-700
        doc.text('DELAYED', taskColX.urgency + 3, currentY + 5.5);
      } else {
        doc.setFillColor(254, 243, 199); // amber-100
        doc.roundedRect(taskColX.urgency, currentY + 2.2, 24, 4.8, 1, 1, 'F');
        doc.setTextColor(180, 83, 9); // amber-700
        doc.text('HIGH PRIORITY', taskColX.urgency + 2, currentY + 5.5);
      }

      // Deliverable Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(24, 24, 27);
      const truncatedTitle = task.title.length > 36 ? task.title.slice(0, 34) + '…' : task.title;
      doc.text(truncatedTitle, taskColX.title, currentY + 5.5);

      // Board Name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(113, 113, 122);
      const truncatedBoard = boardName.length > 18 ? boardName.slice(0, 16) + '…' : boardName;
      doc.text(truncatedBoard, taskColX.board, currentY + 5.5);

      // Assignee & Due
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(39, 39, 42);
      const assigneeStr = task.assignee?.full_name || 'Unassigned';
      const truncatedAssignee = assigneeStr.length > 18 ? assigneeStr.slice(0, 16) + '…' : assigneeStr;
      doc.text(truncatedAssignee, taskColX.assignee, currentY + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      if (isDelayed) {
        doc.setTextColor(225, 29, 72);
        doc.text(task.deadline ? `Due: ${task.deadline.slice(0, 10)} (Overdue)` : 'Overdue', taskColX.assignee, currentY + 7.5);
      } else {
        doc.setTextColor(113, 113, 122);
        doc.text(task.deadline ? `Due: ${task.deadline.slice(0, 10)}` : 'No deadline', taskColX.assignee, currentY + 7.5);
      }

      currentY += taskRowHeight;
    }

    if (criticalTasks.length > maxTasksToRender) {
      currentY += 3;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(140, 140, 145);
      doc.text(`+ ${criticalTasks.length - maxTasksToRender} additional critical tasks in active backlog`, marginX + 3, currentY);
      currentY += 5;
    }

    currentY += 8;
  }

  // ----------------------------------------------------
  // 5. Footers on all pages
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Footer divider line
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 12, marginX + contentWidth, pageHeight - 12);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 145);
    const footerLeft = currentUserEmail
      ? `Weekly Checkpoint Report • Exported for ${currentUserEmail}`
      : 'Weekly Checkpoint Report • Project Sprint Analytics';
    doc.text(footerLeft, marginX, pageHeight - 7.5);

    // Page number
    const pageStr = `Page ${p} of ${totalPages}`;
    doc.text(pageStr, marginX + contentWidth, pageHeight - 7.5, { align: 'right' });
  }

  // ----------------------------------------------------
  // 6. Save PDF File to User Device
  // ----------------------------------------------------
  const cleanRange = report.weekRange.replace(/[^a-zA-Z0-9-]/g, '_');
  const filename = `Weekly-Checkpoint-Report-${cleanRange}.pdf`;
  doc.save(filename);

  return filename;
};
