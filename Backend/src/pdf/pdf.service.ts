import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocumentLib = require('pdfkit') as typeof import('pdfkit');
import { Booking, Listing, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';

type BookingFull = Booking & { listing: Listing; tenant: User };

const LISTING_TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  VILLA: 'Villa',
  CHAMBRE: 'Chambre',
  STUDIO: 'Studio',
  BUREAU: 'Bureau',
};

export type LeaseContractData = {
  bookingId: string;
  landlord: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  tenant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  listing: {
    title: string;
    type: string;
    address: string | null;
    city: string;
    region: string;
    rooms: number | null;
    surface: number | null;
  };
  monthlyRent: number;
  chargesIncluded: boolean | null;
  depositMonths: number;
  depositAmount: number;
  minLeaseMonths: number;
  moveInDate: Date;
  totalDueAtSigning: number;
  platformFee: number;
};

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
        booking.endDate
          ? booking.endDate.toLocaleDateString('fr-FR')
          : 'Ouvert',
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

  /**
   * Génère le contrat de bail d'habitation (mode MONTHLY) à partir des
   * données de la réservation. AlloAppart n'est pas partie au contrat
   * (cf. Article 11 des CGU) — le document est établi entre le Bailleur et
   * le Locataire, AlloAppart agissant en simple intermédiaire technique.
   * Les parties le signent ensuite séquentiellement (locataire puis
   * bailleur) en le re-téléversant signé via leur espace AlloAppart.
   */
  generateLeaseContract(rawData: LeaseContractData): Promise<Buffer> {
    // ── Assainissement défensif des données ────────────────────────────────
    // pdfkit peut boucler indéfiniment sur `addPage`/`continueOnNewPage`
    // (RangeError: Maximum call stack size exceeded) face à un champ texte
    // anormal (espaces multiples/caractères de contrôle dans une adresse
    // saisie librement, par ex.) ou un nombre non fini (NaN/Infinity issu
    // d'une conversion Decimal ratée). On normalise tout ici, une seule fois,
    // avant toute mise en page — plutôt que de laisser pdfkit planter en
    // silence sur une réservation précise sans jamais créer son contrat.
    const cleanText = (s: string, maxLen = 300): string =>
      s.replace(/\s+/g, ' ').trim().slice(0, maxLen) || '—';
    const finite = (n: number, fallback = 0): number =>
      Number.isFinite(n) ? n : fallback;
    const validDate = (d: Date): Date =>
      d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date();

    const data: LeaseContractData = {
      ...rawData,
      landlord: {
        firstName: cleanText(rawData.landlord.firstName, 80),
        lastName: cleanText(rawData.landlord.lastName, 80),
        email: cleanText(rawData.landlord.email, 120),
        phone: rawData.landlord.phone ? cleanText(rawData.landlord.phone, 40) : null,
      },
      tenant: {
        firstName: cleanText(rawData.tenant.firstName, 80),
        lastName: cleanText(rawData.tenant.lastName, 80),
        email: cleanText(rawData.tenant.email, 120),
        phone: rawData.tenant.phone ? cleanText(rawData.tenant.phone, 40) : null,
      },
      listing: {
        ...rawData.listing,
        title: cleanText(rawData.listing.title, 150),
        address: rawData.listing.address ? cleanText(rawData.listing.address, 200) : null,
        city: cleanText(rawData.listing.city, 100),
        region: cleanText(rawData.listing.region, 100),
      },
      monthlyRent: finite(rawData.monthlyRent),
      depositAmount: finite(rawData.depositAmount),
      totalDueAtSigning: finite(rawData.totalDueAtSigning),
      platformFee: finite(rawData.platformFee),
      depositMonths: Math.max(0, Math.round(finite(rawData.depositMonths, 0))),
      minLeaseMonths: Math.max(1, Math.round(finite(rawData.minLeaseMonths, 1))),
      moveInDate: validDate(rawData.moveInDate),
    };

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocumentLib({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const GOLD = '#b8972a';
      const INK = '#0f172a';
      const SLATE = '#374151';
      const GREY = '#6b7280';
      const BORDER = '#d1d5db';

      const drawFooter = () => {
        const bottom = doc.page.height - 40;
        // Le pied de page est dessiné dans la marge basse (bottom + 6 dépasse
        // page.height - margins.bottom, la zone imprimable définie par
        // `margin: 50`). Sans neutraliser temporairement cette marge, pdfkit
        // considère ce texte "hors zone" et redéclenche indéfiniment
        // addPage → pageAdded → drawFooter → addPage, jusqu'à RangeError:
        // Maximum call stack size exceeded. On neutralise la marge le temps
        // du dessin, puis on restaure marge + curseur (x/y) pour ne pas
        // perturber la suite de la mise en page sur la nouvelle page.
        const originalMarginBottom = doc.page.margins.bottom;
        const originalX = doc.x;
        const originalY = doc.y;
        doc.page.margins.bottom = 0;
        doc
          .moveTo(50, bottom)
          .lineTo(545, bottom)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fillColor(GREY)
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `Contrat genere automatiquement par AlloAppart le ${new Date().toLocaleDateString('fr-FR')} - Reservation ${data.bookingId.slice(0, 8).toUpperCase()} - alloappart221@gmail.com`,
            50,
            bottom + 6,
            { width: 495, align: 'center' },
          );
        doc.page.margins.bottom = originalMarginBottom;
        doc.x = originalX;
        doc.y = originalY;
      };
      doc.on('pageAdded', drawFooter);

      const money = (n: number) =>
        `${Math.round(n).toLocaleString('fr-FR')} FCFA`;
      const fullName = (p: { firstName: string; lastName: string }) =>
        `${p.firstName} ${p.lastName}`;

      // width explicite partout (au lieu de laisser pdfkit le déduire de
      // doc.x/marges courants) — évite toute dérive de largeur de ligne après
      // les appels positionnés en absolu de l'en-tête, cause plausible du
      // bug de boucle infinie addPage/continueOnNewPage.
      const sectionTitle = (title: string) => {
        doc
          .moveDown(1)
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(INK)
          .text(title, { width: 495 })
          .moveDown(0.4);
      };

      const paragraph = (text: string) => {
        doc
          .fontSize(9.5)
          .font('Helvetica')
          .fillColor(SLATE)
          .text(text, { width: 495, align: 'justify', lineGap: 2 })
          .moveDown(0.5);
      };

      const identityBlock = (
        label: string,
        p: {
          firstName: string;
          lastName: string;
          email: string;
          phone: string | null;
        },
      ) => {
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor(INK)
          .text(label, { width: 495 })
          .font('Helvetica')
          .fillColor(SLATE)
          .text(fullName(p), { width: 495 })
          .text(p.email, { width: 495 })
          .text(p.phone ?? 'Telephone communique via la messagerie AlloAppart', { width: 495 })
          .moveDown(0.6);
      };

      // ── En-tête ──
      doc
        .moveTo(50, 40)
        .lineTo(545, 40)
        .strokeColor(GOLD)
        .lineWidth(2)
        .stroke();
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('AlloAppart', 50, 52, { width: 495, align: 'center' });
      doc
        .fillColor(SLATE)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text("CONTRAT DE LOCATION - BAIL D'HABITATION", 50, 78, {
          width: 495,
          align: 'center',
        });
      doc
        .fillColor(GREY)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Reservation ${data.bookingId.slice(0, 8).toUpperCase()} - Emis le ${new Date().toLocaleDateString('fr-FR')}`,
          50,
          98,
          { width: 495, align: 'center' },
        );
      doc
        .moveTo(50, 115)
        .lineTo(545, 115)
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .stroke();
      doc.y = 128;

      paragraph(
        "AlloAppart agit en qualite d'intermediaire technique et de mise en relation entre le Bailleur et le Locataire. AlloAppart n'est pas partie au present contrat de bail (Article 11 des Conditions Generales d'Utilisation AlloAppart) et n'engage sa responsabilite que dans les limites prevues auxdites CGU, notamment le mecanisme de signalement de non-conformite de l'Article 9.",
      );

      sectionTitle('ENTRE LES SOUSSIGNES');
      identityBlock(
        'LE BAILLEUR, ci-apres "le Bailleur", d\'une part :',
        data.landlord,
      );
      identityBlock(
        'ET LE LOCATAIRE, ci-apres "le Locataire", d\'autre part :',
        data.tenant,
      );
      paragraph('IL A ETE CONVENU CE QUI SUIT :');

      sectionTitle('Article 1 - Objet du contrat');
      paragraph(
        `Le Bailleur donne en location au Locataire, qui accepte, le bien suivant : ${LISTING_TYPE_LABELS[data.listing.type] ?? data.listing.type} "${data.listing.title}", ` +
          `${data.listing.address ? data.listing.address + ', ' : ''}${data.listing.city}, ${data.listing.region}` +
          `${data.listing.rooms ? ` - ${data.listing.rooms} piece(s)` : ''}${data.listing.surface ? ` - ${data.listing.surface} m2` : ''}.`,
      );

      sectionTitle('Article 2 - Duree du bail');
      paragraph(
        `Le present bail prend effet a compter du ${data.moveInDate.toLocaleDateString('fr-FR')}, pour une duree minimale de ${data.minLeaseMonths} mois. ` +
          `Passe ce delai, il se poursuit tacitement, sans limitation de duree, jusqu'a resiliation par l'une des parties dans les conditions de l'Article 6 ci-dessous.`,
      );

      sectionTitle('Article 3 - Loyer et charges');
      paragraph(
        `Le loyer mensuel est fixe a ${money(data.monthlyRent)}. ` +
          (data.chargesIncluded
            ? 'Les charges (eau, electricite) sont incluses dans ce montant.'
            : 'Les charges (eau, electricite) ne sont pas incluses et restent a la charge du Locataire, a regler directement au Bailleur ou aux fournisseurs concernes.'),
      );

      sectionTitle('Article 4 - Depot de garantie (caution)');
      paragraph(
        `Un depot de garantie de ${money(data.depositAmount)} (equivalent a ${data.depositMonths} mois de loyer) est verse par le Locataire a la signature. ` +
          `Conformement a l'Article 7 des CGU AlloAppart, ce depot inclut la commission de courtage d'AlloAppart, equivalente a un (1) mois de loyer, prelevee avant reversement au Bailleur ; le solde constitue la garantie proprement dite, restituable au Locataire en fin de bail sous deduction des sommes dues au titre de degradations locatives eventuelles.`,
      );

      sectionTitle('Article 5 - Modalites de paiement');
      paragraph(
        `Le montant du au titre du 1er loyer et du depot de garantie, soit ${money(data.totalDueAtSigning)}, est regle par le Locataire via la plateforme AlloAppart au moment de la signature. ` +
          `Les loyers des mois suivants sont regles directement entre le Bailleur et le Locataire, selon les modalites qu'ils conviennent entre eux (hors intermediation d'AlloAppart).`,
      );

      sectionTitle('Article 6 - Resiliation');
      paragraph(
        "Le present bail peut etre resilie a tout moment, a l'initiative du Bailleur comme du Locataire, via l'espace AlloAppart de la partie concernee. La resiliation remet le logement a disposition a la location des sa prise d'effet.",
      );

      sectionTitle('Article 7 - Litiges et responsabilite');
      paragraph(
        "Le Locataire dispose d'un delai de vingt-quatre (24) heures a compter de son entree effective dans les lieux pour signaler toute non-conformite substantielle, conformement a l'Article 9 des CGU AlloAppart. Pour tout differend relatif a l'execution du present bail, les parties s'efforceront de trouver une solution amiable ; a defaut, le litige releve du droit commun, AlloAppart n'etant pas partie au contrat (Article 11 des CGU).",
      );

      sectionTitle('Article 8 - Droit applicable');
      paragraph(
        'Le present contrat est regi par le droit de la Republique du Senegal, notamment le Code des Obligations Civiles et Commerciales (COCC). En cas de litige et a defaut de resolution amiable, competence exclusive est attribuee au Tribunal de Grande Instance de Dakar.',
      );

      if (doc.y > doc.page.height - 220) doc.addPage();

      sectionTitle('Signatures');
      paragraph(
        'Ce contrat est signe de maniere sequentielle : le Locataire signe en premier et le re-televerse sur AlloAppart, puis le Bailleur le signe a son tour pour finaliser le bail. Chaque partie peut apposer sa signature electroniquement (ex. Adobe Acrobat / Adobe Fill & Sign) avant re-televersement.',
      );

      const sigY = doc.y + 10;
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor(INK);
      doc.text('Le Locataire', 50, sigY);
      doc.text('Le Bailleur', 320, sigY);
      doc
        .fontSize(8.5)
        .font('Helvetica')
        .fillColor(GREY)
        .text(fullName(data.tenant), 50, sigY + 14)
        .text(fullName(data.landlord), 320, sigY + 14);
      doc
        .moveTo(50, sigY + 60)
        .lineTo(235, sigY + 60)
        .strokeColor(BORDER)
        .stroke();
      doc
        .moveTo(320, sigY + 60)
        .lineTo(505, sigY + 60)
        .strokeColor(BORDER)
        .stroke();
      doc
        .fontSize(7.5)
        .fillColor(GREY)
        .text('Signature', 50, sigY + 64)
        .text('Signature', 320, sigY + 64);

      drawFooter();
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
      const GOLD = '#b8972a';
      const INK = '#0f172a';
      const SLATE = '#374151';
      const GREY = '#6b7280';
      const LIGHT_GREY = '#9ca3af';
      const BORDER = '#d1d5db';
      const ROW_BORDER = '#e5e7eb';
      const TABLE_HEAD_BG = '#f3f4f6';
      const DARK_TEXT = '#111827';

      const STATUS_LABELS: Record<string, string> = {
        CONFIRMED: 'Confirmée',
        COMPLETED: 'Terminée',
        PENDING: 'En attente',
        CANCELLED: 'Annulée',
      };

      const truncate = (s: string, max: number) =>
        s.length > max ? s.slice(0, max - 1) + '…' : s;

      const spaced = (s: string) => s.split('').join(' ');

      const drawFooter = () => {
        doc
          .moveTo(40, 787)
          .lineTo(555, 787)
          .strokeColor(BORDER)
          .lineWidth(0.5)
          .stroke();
        doc
          .fillColor(LIGHT_GREY)
          .font('Helvetica')
          .fontSize(7.5)
          .text(
            `Généré le ${new Date().toLocaleDateString('fr-FR')} · AlloAppart · alloappart221@gmail.com · Document confidentiel`,
            0,
            790,
            { width: PAGE_WIDTH, align: 'center' },
          );
      };

      // ── Header ──
      doc
        .moveTo(40, 40)
        .lineTo(555, 40)
        .strokeColor(GOLD)
        .lineWidth(2)
        .stroke();
      doc
        .fillColor(INK)
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('AlloAppart', 0, 50, { width: PAGE_WIDTH, align: 'center' });
      doc
        .fillColor(SLATE)
        .font('Helvetica')
        .fontSize(12)
        .text(`Rapport mensuel — ${data.month}`, 0, 82, {
          width: PAGE_WIDTH,
          align: 'center',
        });
      doc
        .fillColor(GREY)
        .font('Helvetica')
        .fontSize(10)
        .text(`Agence : ${data.ownerName}`, 0, 98, {
          width: PAGE_WIDTH,
          align: 'center',
        });
      doc
        .moveTo(40, 115)
        .lineTo(555, 115)
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .stroke();

      // ── KPI grid (2x2) — cartes bordurées, pas de fond ──
      const kpiCard = (x: number, y: number, label: string, value: string) => {
        doc.roundedRect(x, y, 240, 68, 4).stroke(BORDER);
        doc
          .fillColor(GREY)
          .font('Helvetica')
          .fontSize(7.5)
          .text(label, x + 12, y + 12);
        doc
          .fillColor(INK)
          .font('Helvetica-Bold')
          .fontSize(20)
          .text(value, x + 12, y + 30);
      };

      kpiCard(
        40,
        130,
        'ANNONCES ACTIVES',
        `${data.stats.publishedListings} / ${data.stats.totalListings}`,
      );
      kpiCard(315, 130, 'RÉSERVATIONS', `${data.stats.totalBookings}`);
      kpiCard(
        40,
        212,
        'REVENUS ENCAISSÉS',
        `${data.stats.totalRevenue.toLocaleString('fr-FR')} FCFA`,
      );
      kpiCard(
        315,
        212,
        'NOTE MOYENNE',
        data.stats.avgRating ? `${data.stats.avgRating.toFixed(1)}/5` : 'N/A',
      );

      // ── Section réservations ──
      doc
        .moveTo(40, 295)
        .lineTo(555, 295)
        .strokeColor(BORDER)
        .lineWidth(0.5)
        .stroke();
      doc
        .fillColor(GREY)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(spaced('RÉSERVATIONS DU MOIS'), 40, 302);

      if (data.bookings.length === 0) {
        doc
          .fillColor(LIGHT_GREY)
          .font('Helvetica')
          .fontSize(10)
          .text('Aucune réservation pour ce mois.', 0, 330, {
            width: PAGE_WIDTH,
            align: 'center',
          });
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
          doc
            .moveTo(40, rowY + 18)
            .lineTo(555, rowY + 18)
            .strokeColor(ROW_BORDER)
            .lineWidth(0.3)
            .stroke();
          doc.fillColor(DARK_TEXT).font('Helvetica').fontSize(8.5);
          doc.text(truncate(b.listingTitle, 30), 48, rowY + 5);
          doc.text(truncate(b.tenantName, 20), 198, rowY + 5);
          doc.text(b.startDate.toLocaleDateString('fr-FR'), 318, rowY + 5);
          doc.text(
            `${Number(b.totalAmount).toLocaleString('fr-FR')} FCFA`,
            398,
            rowY + 5,
          );
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
