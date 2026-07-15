import { jsPDF } from "jspdf";

export const FORM_VERSION = "V1.0";

interface PdfCtx {
  doc: jsPDF;
  y: number;
  page: number;
}

const MARGIN = 12;
const PAGE_W = 210;
const PAGE_H = 297;

function header(doc: jsPDF, page: number) {
  doc.setFillColor(45, 27, 142);
  doc.rect(0, 0, PAGE_W, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SHEPHERD'S HILL PARISH", MARGIN, 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Member Registration Form", MARGIN, 15);
  doc.setFontSize(8);
  doc.text(`Page ${page} of 2`, PAGE_W - MARGIN - 20, 15);
  doc.setTextColor(0, 0, 0);
}

function footer(doc: jsPDF) {
  const today = new Date().toISOString().slice(0, 10);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Shepherd's Hill Parish · Physical Registration Form · ${FORM_VERSION} · ${today}`, MARGIN, PAGE_H - 6);
  doc.setTextColor(0, 0, 0);
}

function sectionHeader(ctx: PdfCtx, letter: string, title: string, shaded = false) {
  const { doc } = ctx;
  if (shaded) doc.setFillColor(235, 235, 235); else doc.setFillColor(45, 27, 142);
  doc.rect(MARGIN, ctx.y, PAGE_W - MARGIN * 2, 6.5, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(shaded ? 0 : 255, shaded ? 0 : 255, shaded ? 0 : 255);
  doc.text(`SECTION ${letter} — ${title.toUpperCase()}`, MARGIN + 2, ctx.y + 4.6);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  ctx.y += 9;
}

function line(ctx: PdfCtx, label: string, width = PAGE_W - MARGIN * 2, height = 8) {
  const { doc } = ctx;
  doc.setFontSize(9);
  doc.text(label, MARGIN, ctx.y + 3);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, ctx.y + 4, width, height);
  ctx.y += 4 + height + 2;
}

function twoCol(ctx: PdfCtx, l1: string, l2: string, height = 8) {
  const { doc } = ctx;
  const w = (PAGE_W - MARGIN * 2 - 4) / 2;
  doc.setFontSize(9);
  doc.text(l1, MARGIN, ctx.y + 3);
  doc.text(l2, MARGIN + w + 4, ctx.y + 3);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, ctx.y + 4, w, height);
  doc.rect(MARGIN + w + 4, ctx.y + 4, w, height);
  ctx.y += 4 + height + 2;
}

function tickBoxes(ctx: PdfCtx, label: string, options: string[]) {
  const { doc } = ctx;
  doc.setFontSize(9);
  doc.text(label, MARGIN, ctx.y + 3);
  let x = MARGIN + doc.getTextWidth(label) + 4;
  options.forEach((opt) => {
    doc.rect(x, ctx.y, 3.5, 3.5);
    doc.text(opt, x + 5, ctx.y + 3);
    x += 5 + doc.getTextWidth(opt) + 5;
  });
  ctx.y += 6;
}

export function generateRegistrationPdf(): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const ctx: PdfCtx = { doc, y: 24, page: 1 };

  // PAGE 1
  header(doc, 1);

  // Photo box
  doc.setDrawColor(120, 120, 120);
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.rect(PAGE_W - MARGIN - 28, ctx.y, 28, 34);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text("Paste passport", PAGE_W - MARGIN - 26, ctx.y + 15);
  doc.text("photograph here", PAGE_W - MARGIN - 27, ctx.y + 19);
  doc.setTextColor(0, 0, 0);

  // Section A - Personal
  sectionHeader(ctx, "A", "Personal Information");
  twoCol(ctx, "First Name *", "Last Name *");
  twoCol(ctx, "Middle Name", "Preferred Name");
  twoCol(ctx, "Date of Birth (DD/MM/YYYY) *", "Gender *");

  // Section B - Contact
  sectionHeader(ctx, "B", "Contact Information");
  twoCol(ctx, "Primary Phone (+234) *", "Secondary Phone");
  line(ctx, "Email");
  line(ctx, "Home Address");
  twoCol(ctx, "City", "State *");

  // Section C - Family
  sectionHeader(ctx, "C", "Family");
  tickBoxes(ctx, "Marital Status: ", ["Single", "Married", "Widowed", "Divorced"]);
  twoCol(ctx, "Spouse Name (if married)", "Spouse Phone");
  line(ctx, "Names & ages of children (if any)", PAGE_W - MARGIN * 2, 14);

  footer(doc);

  // PAGE 2
  doc.addPage();
  ctx.y = 24; ctx.page = 2;
  header(doc, 2);

  // Section D - Church life
  sectionHeader(ctx, "D", "Church Life");
  twoCol(ctx, "How long have you attended?", "How did you hear about us?");
  tickBoxes(ctx, "Stage: ", ["First Timer", "New Convert", "New Member", "Member", "Worker", "Leader"]);
  line(ctx, "Cell Group name (if known)");
  line(ctx, "Departments you're interested in");

  // Section E - Spiritual
  sectionHeader(ctx, "E", "Spiritual Journey");
  tickBoxes(ctx, "Salvation: ", ["Yes", "No", "Not sure"]);
  tickBoxes(ctx, "Baptism by immersion: ", ["Yes", "No", "In progress"]);
  tickBoxes(ctx, "Believers' Class: ", ["Completed", "In progress", "Not started"]);
  tickBoxes(ctx, "Baptismal Class: ", ["Completed", "In progress", "Not started"]);

  // Section F - Consent
  sectionHeader(ctx, "F", "Consent & Signature");
  doc.rect(MARGIN, ctx.y, 3.5, 3.5);
  doc.setFontSize(9);
  doc.text("The information I have given above is accurate.", MARGIN + 5, ctx.y + 3);
  ctx.y += 6;
  doc.rect(MARGIN, ctx.y, 3.5, 3.5);
  doc.text("I consent to the church using this information for pastoral care.", MARGIN + 5, ctx.y + 3);
  ctx.y += 6;
  doc.rect(MARGIN, ctx.y, 3.5, 3.5);
  doc.text("I consent to photography for church records and materials.", MARGIN + 5, ctx.y + 3);
  ctx.y += 8;
  twoCol(ctx, "Signature *", "Date *");

  // Section G - Office use (shaded)
  sectionHeader(ctx, "G", "Office Use Only", true);
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, ctx.y, PAGE_W - MARGIN * 2, 50, "F");
  const gY = ctx.y;
  doc.setDrawColor(160, 160, 160);
  doc.rect(MARGIN, ctx.y, PAGE_W - MARGIN * 2, 50);
  ctx.y += 3;
  twoCol(ctx, "Received by", "Date received");
  twoCol(ctx, "Member code assigned", "Verified by");
  twoCol(ctx, "House Fellowship Centre assigned", "Branch");
  line(ctx, "Notes");
  ctx.y = gY + 52;

  footer(doc);
  return doc;
}
