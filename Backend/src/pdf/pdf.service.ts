import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocumentLib = require('pdfkit') as typeof import('pdfkit');
import { Booking, Listing, User } from '@prisma/client';

type BookingFull = Booking & { listing: Listing; tenant: User };

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
}
