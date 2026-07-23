import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocumentLib = require('pdfkit') as typeof import('pdfkit');
import { Booking, Listing, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

type BookingFull = Booking & { listing: Listing; tenant: User };

type MonthlyReportData = {
  ownerName: string;
  month: string; // ex: "juin 2026"
  stats: {
    totalListings: number;
    publishedListings: number;
    totalBookings: number;
    confirmedBookings: number;
    totalRevenue: number;
    avgRating: number | null;
  };
  bookings: Array<{
    id: string;
    listingTitle: string;
    tenantName: string;
    startDate: Date;
    totalAmount: Decimal | number;
    status: string;
  }>;
};

@Injectable()
export class PdfService {
  generateReceipt(booking: BookingFull): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocumentLib({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('AlloAppart', { align: 'center' })
        .moveDown(0.3)
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#555555')
        .text('Recu de reservation', { align: 'center' })
        .moveDown(1.5);
  
      // Divider
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#dddddd')
        .stroke()
        .moveDown(1);
  
      const left = 50;
      const right = 300;
  
      const row = (label: string, value: string) => {
        const y = doc.y;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(label, left, y);
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#000000')
          .text(value, right, y);
        doc.moveDown(0.6);
      };
  
      row('Numero de reservation :', booking.id.slice(0, 8).toUpperCase());
      row(
        'Locataire :',
        `${booking.tenant.firstName} ${booking.tenant.lastName}`,
      );
      row('Email :', booking.tenant.email);
      row('Annonce :', booking.listing.title);
      row('Ville :', booking.listing.city);
      row('Date de debut :', booking.startDate.toLocaleDateString('fr-FR'));
      row(
        'Date de fin :',
        booking.endDate ? booking.endDate.toLocaleDateString('fr-FR') : 'Ouvert',
      );
      row('Statut :', booking.status);
      row(
        'Montant total :',
        `${Number(booking.totalAmount).toLocaleString('fr-FR')} FCFA`,
      );
      row('Reference paiement :', booking.paymentRef ?? 'N/A');
      row("Date d'emission :", new Date().toLocaleDateString('fr-FR'));
  
      doc.moveDown(1.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#dddddd')
        .stroke()
        .moveDown(1);
  
      doc
        .fontSize(9)
        .fillColor('#888888')
        .text(
          'Ce document est genere automatiquement par AlloAppart. Pour toute question, contactez alloappart221@gmail.com',
          { align: 'center' },
        );

      doc.end();
    });
  }

  generateMonthlyReport(data: MonthlyReportData): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocumentLib({ size: 'A4', margin: 0 });
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PAGE_WIDTH = 595;
      const GOLD       = '#b8972a';
      const INK        = '#0f172a';
      const SLATE      = '#374151';
      const GREY       = '#6b7280';
      const LIGHT_GREY = '#9ca3af';
      const BORDER     = '#d1d5db';
      const ROW_BORDER = '#e5e7eb';
      const TABLE_HEAD_BG = '#f3f4f6';
      const DARK_TEXT   = '#111827';

      const STATUS_LABELS: Record<string, string> = {
        CONFIRMED: 'Confirmée',
        COMPLETED: 'Terminée',
        PENDING:   'En attente',
        CANCELLED: 'Annulée',
      };

      const truncate = (s: string, max: number) =>
        s.length > max ? s.slice(0, max - 1) + '…' : s;

      const spaced = (s: string) => s.split('').join(' ');

      const drawFooter = () => {
        doc.moveTo(40, 787).lineTo(555, 787).strokeColor(BORDER).lineWidth(0.5).stroke();
        doc.fillColor(LIGHT_GREY).font('Helvetica').fontSize(7.5)
          .text(
            `Généré le ${new Date().toLocaleDateString('fr-FR')} · AlloAppart · alloappart221@gmail.com · Document confidentiel`,
            0, 790, { width: PAGE_WIDTH, align: 'center' }
          );
      };

      // ── Header ──
      doc.moveTo(40, 40).lineTo(555, 40).strokeColor(GOLD).lineWidth(2).stroke();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(24)
        .text('AlloAppart', 0, 50, { width: PAGE_WIDTH, align: 'center' });
      doc.fillColor(SLATE).font('Helvetica').fontSize(12)
        .text(`Rapport mensuel — ${data.month}`, 0, 82, { width: PAGE_WIDTH, align: 'center' });
      doc.fillColor(GREY).font('Helvetica').fontSize(10)
        .text(`Agence : ${data.ownerName}`, 0, 98, { width: PAGE_WIDTH, align: 'center' });
      doc.moveTo(40, 115).lineTo(555, 115).strokeColor(BORDER).lineWidth(0.5).stroke();

      // ── KPI grid (2x2) — cartes bordurées, pas de fond ──
      const kpiCard = (x: number, y: number, label: string, value: string) => {
        doc.roundedRect(x, y, 240, 68, 4).stroke(BORDER);
        doc.fillColor(GREY).font('Helvetica').fontSize(7.5).text(label, x + 12, y + 12);
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(20).text(value, x + 12, y + 30);
      };

      kpiCard(40,  130, 'ANNONCES ACTIVES', `${data.stats.publishedListings} / ${data.stats.totalListings}`);
      kpiCard(315, 130, 'RÉSERVATIONS', `${data.stats.totalBookings}`);
      kpiCard(40,  212, 'REVENUS ENCAISSÉS', `${data.stats.totalRevenue.toLocaleString('fr-FR')} FCFA`);
      kpiCard(315, 212, 'NOTE MOYENNE', data.stats.avgRating ? `${data.stats.avgRating.toFixed(1)}/5` : 'N/A');

      // ── Section réservations ──
      doc.moveTo(40, 295).lineTo(555, 295).strokeColor(BORDER).lineWidth(0.5).stroke();
      doc.fillColor(GREY).font('Helvetica-Bold').fontSize(9)
        .text(spaced('RÉSERVATIONS DU MOIS'), 40, 302);

      if (data.bookings.length === 0) {
        doc.fillColor(LIGHT_GREY).font('Helvetica').fontSize(10)
          .text('Aucune réservation pour ce mois.', 0, 330, { width: PAGE_WIDTH, align: 'center' });
        drawFooter();
      } else {
        const startY = 320;

        doc.rect(40, startY, 515, 18).fill(TABLE_HEAD_BG);
        doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(8);
        doc.text('ANNONCE', 48, startY + 5);
        doc.text('LOCATAIRE', 198, startY + 5);
        doc.text('DATE', 318, startY + 5);
        doc.text('MONTANT', 398, startY + 5);
        doc.text('STATUT', 478, startY + 5);

        data.bookings.forEach((b, i) => {
          const rowY = startY + 18 + i * 18;
          doc.moveTo(40, rowY + 18).lineTo(555, rowY + 18).strokeColor(ROW_BORDER).lineWidth(0.3).stroke();
          doc.fillColor(DARK_TEXT).font('Helvetica').fontSize(8.5);
          doc.text(truncate(b.listingTitle, 30), 48, rowY + 5);
          doc.text(truncate(b.tenantName, 20), 198, rowY + 5);
          doc.text(b.startDate.toLocaleDateString('fr-FR'), 318, rowY + 5);
          doc.text(`${Number(b.totalAmount).toLocaleString('fr-FR')} FCFA`, 398, rowY + 5);
          doc.text(STATUS_LABELS[b.status] ?? b.status, 478, rowY + 5);
        });

        const tableBottomY = startY + 18 + data.bookings.length * 18;
        if (tableBottomY > 770) doc.addPage();
        drawFooter();
      }

      doc.end();
    });
  }
}
