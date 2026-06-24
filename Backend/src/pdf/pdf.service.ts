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
  generateReceipt(booking: BookingFull): Buffer {
    const chunks: Buffer[] = [];
    const doc = new PDFDocumentLib({ size: 'A4', margin: 50 });

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

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

    return Buffer.concat(chunks);
  }

  generateMonthlyReport(data: MonthlyReportData): Buffer {
    const chunks: Buffer[] = [];
    const doc = new PDFDocumentLib({ size: 'A4', margin: 50 });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    // En-tête
    doc
      .fontSize(20).font('Helvetica-Bold').fillColor('#000000')
      .text('AlloAppart', { align: 'center' })
      .moveDown(0.2)
      .fontSize(11).font('Helvetica').fillColor('#555555')
      .text(`Rapport mensuel — ${data.month}`, { align: 'center' })
      .moveDown(0.4)
      .fontSize(10).fillColor('#888888')
      .text(`Agence : ${data.ownerName}`, { align: 'center' })
      .moveDown(1.5);

    // Séparateur
    const hr = () => {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#dddddd').stroke().moveDown(1);
    };
    hr();

    // KPIs
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('Résumé du mois').moveDown(0.8);

    const row = (label: string, value: string) => {
      const y = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#555555').text(label, 50, y);
      doc.fontSize(10).font('Helvetica').fillColor('#000000').text(value, 300, y);
      doc.moveDown(0.6);
    };

    row('Annonces actives :', `${data.stats.publishedListings} / ${data.stats.totalListings}`);
    row('Réservations du mois :', `${data.stats.totalBookings}`);
    row('Réservations confirmées :', `${data.stats.confirmedBookings}`);
    row('Revenus encaissés :', `${data.stats.totalRevenue.toLocaleString('fr-FR')} FCFA`);
    row('Note moyenne :', data.stats.avgRating ? `${data.stats.avgRating.toFixed(1)} / 5` : 'N/A');

    doc.moveDown(0.5);
    hr();

    // Liste réservations
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#333333').text('Réservations').moveDown(0.8);

    if (data.bookings.length === 0) {
      doc.fontSize(10).font('Helvetica').fillColor('#888888').text('Aucune réservation ce mois-ci.').moveDown(1);
    } else {
      data.bookings.forEach((b, i) => {
        doc
          .fontSize(10).font('Helvetica-Bold').fillColor('#000000')
          .text(`${i + 1}. ${b.listingTitle}`, 50, doc.y)
          .moveDown(0.2)
          .fontSize(9).font('Helvetica').fillColor('#555555')
          .text(
            `Locataire : ${b.tenantName}  ·  ${b.startDate.toLocaleDateString('fr-FR')}  ·  ${Number(b.totalAmount).toLocaleString('fr-FR')} FCFA  ·  ${b.status}`,
            60, doc.y,
          )
          .moveDown(0.6);
      });
    }

    doc.moveDown(0.5);
    hr();

    doc.fontSize(9).fillColor('#aaaaaa')
      .text(
        `Généré le ${new Date().toLocaleDateString('fr-FR')} · AlloAppart · alloappart221@gmail.com`,
        { align: 'center' }
      );

    doc.end();
    return Buffer.concat(chunks);
  }
}
