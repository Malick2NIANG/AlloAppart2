import { Injectable } from '@nestjs/common';
import { join } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocumentLib = require('pdfkit') as typeof import('pdfkit');
import { Booking, Listing, User } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { displayableEmail } from '../common/user-display.util';

type BookingFull = Booking & { listing: Listing; tenant: User };

// Copié depuis Frontend/public/images/LOGO.png. `assets` dans nest-cli.json
// copie ce dossier vers dist/pdf/assets au build, donc ce chemin relatif à
// __dirname reste valide en dev (ts-node depuis src/pdf) et en prod (dist/pdf).
const LOGO_PATH = join(__dirname, 'assets', 'logo.png');

const LISTING_TYPE_LABELS: Record<string, string> = {
  APPARTEMENT: 'Appartement',
  VILLA: 'Villa',
  CHAMBRE: 'Chambre',
  STUDIO: 'Studio',
  BUREAU: 'Bureau',
};

/**
 * Formate un montant en FCFA avec une espace ASCII normale comme séparateur
 * de milliers. `Number.prototype.toLocaleString('fr-FR')` insère une espace
 * fine insécable (U+202F) que la police Helvetica standard des PDF
 * (encodage WinAnsi) ne sait pas représenter : elle s'affichait comme un
 * caractère cassé au milieu du montant (ex. "80/000 FCFA" au lieu de
 * "80 000 FCFA") dans tous les PDF générés par ce service (reçu, contrat,
 * rapport mensuel).
 */
function formatFcfa(amount: number): string {
  const rounded = Math.round(amount);
  const withSpaces = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} FCFA`;
}

// Libellés lisibles pour le statut affiché sur le reçu PDF (au lieu de
// l'enum brut type "CONFIRMED").
const RECEIPT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de paiement',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REQUESTED: 'Demande envoyée',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
  ACTIVE: 'Bail actif',
  TERMINATED: 'Bail résilié',
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
  /**
   * Date de création du contrat (`Contract.createdAt`) — affichée dans
   * l'en-tête et le pied de page ("Émis le...", "généré le..."). Le PDF
   * étant regénéré à la volée à chaque téléchargement (voir
   * ContractsService.buildContractPdf), on passe explicitement cette date
   * plutôt que d'utiliser `new Date()` au moment du rendu : sans ça, ces
   * mentions changeraient à chaque téléchargement au lieu de rester figées
   * à la date d'émission réelle du contrat.
   */
  issuedAt: Date;
};

type MonthlyReportData = {
  ownerName: string;
  month: string; // ex: "juin 2026"
  previousMonthLabel: string; // ex: "mai" — pour le texte de tendance des KPI
  stats: {
    totalListings: number;
    publishedListings: number;
    totalBookings: number;
    totalRevenue: number;
    avgRating: number | null;
  };
  previousMonth: {
    totalRevenue: number;
    totalBookings: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  listingBreakdown: Array<{ title: string; revenue: number; bookings: number }>;
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
  /**
   * @param qrCodeBuffer PNG du QR de vérification d'identité locataire
   * (voir BookingsService.getVerificationQr / verifyPublic). Optionnel pour
   * ne jamais faire échouer la génération du reçu si le QR n'a pas pu être
   * produit (ex. secret non configuré en dev) — le reçu reste utilisable
   * sans, juste sans le bloc de vérification.
   */
  generateReceipt(
    booking: BookingFull,
    qrCodeBuffer?: Buffer,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocumentLib({ size: 'A4', margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Document sobre en noir/gris — pas de couleur de marque, juste le
      // logo (qui garde sa propre couleur, c'est le logo).
      const LEFT = 50;
      const RIGHT_EDGE = 545;
      const CONTENT_WIDTH = RIGHT_EDGE - LEFT;
      const LOGO_SIZE = 46;

      try {
        doc.image(LOGO_PATH, LEFT, 44, { width: LOGO_SIZE, height: LOGO_SIZE });
      } catch {
        // Logo manquant/illisible : on continue sans bloquer le reçu.
      }
      doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text('AlloAppart', LEFT + LOGO_SIZE + 14, 48);
      doc
        .fillColor('#666666')
        .font('Helvetica')
        .fontSize(11)
        .text('Reçu de réservation', LEFT + LOGO_SIZE + 14, 72);

      let headerBottom = 44 + LOGO_SIZE + 20;

      if (qrCodeBuffer) {
        try {
          const qrSize = 80;
          const qrX = RIGHT_EDGE - qrSize;
          doc.image(qrCodeBuffer, qrX, 40, { width: qrSize });
          doc
            .fontSize(6.5)
            .font('Helvetica')
            .fillColor('#999999')
            .text('Vérification identité', qrX, 40 + qrSize + 3, {
              width: qrSize,
              align: 'center',
            });
          headerBottom = Math.max(headerBottom, 40 + qrSize + 16);
        } catch {
          // Image corrompue/illisible : on continue sans bloquer le reçu.
        }
      }

      doc.x = LEFT;
      doc.y = headerBottom;
      doc
        .moveTo(LEFT, doc.y)
        .lineTo(RIGHT_EDGE, doc.y)
        .strokeColor('#dddddd')
        .stroke();
      doc.moveDown(1.3);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor('#111111')
        .text('DÉTAILS DE LA RÉSERVATION', LEFT, doc.y, {
          characterSpacing: 0.5,
        });
      doc.moveDown(0.9);

      const right = 300;
      const row = (label: string, value: string) => {
        const y = doc.y;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#333333')
          .text(label, LEFT, y);
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#111111')
          .text(value, right, y, { width: RIGHT_EDGE - right });
        doc.moveDown(0.65);
      };

      row('Numéro de réservation :', booking.id.slice(0, 8).toUpperCase());
      row(
        'Locataire :',
        `${booking.tenant.firstName} ${booking.tenant.lastName}`,
      );
      // Omise si c'est un email placeholder Clerk (`<id>@clerk.local`,
      // compte sans email réel — voir user-display.util) : l'afficher tel
      // quel n'apporterait rien au locataire.
      const receiptTenantEmail = displayableEmail(booking.tenant.email);
      if (receiptTenantEmail) {
        row('Email :', receiptTenantEmail);
      }
      row('Annonce :', booking.listing.title);
      row('Ville :', booking.listing.city);
      row('Date de début :', booking.startDate.toLocaleDateString('fr-FR'));
      row(
        'Date de fin :',
        booking.endDate
          ? booking.endDate.toLocaleDateString('fr-FR')
          : 'Ouvert',
      );
      row('Statut :', RECEIPT_STATUS_LABELS[booking.status] ?? booking.status);

      doc.moveDown(0.5);
      doc
        .moveTo(LEFT, doc.y)
        .lineTo(RIGHT_EDGE, doc.y)
        .strokeColor('#dddddd')
        .stroke();
      doc.moveDown(1.1);

      // Bloc "montant total" mis en avant par la taille et un simple encadré
      // (pas de fond coloré).
      const boxY = doc.y;
      const boxHeight = 62;
      doc
        .roundedRect(LEFT, boxY, CONTENT_WIDTH, boxHeight, 8)
        .strokeColor('#cccccc')
        .lineWidth(1)
        .stroke();
      doc
        .fillColor('#666666')
        .font('Helvetica')
        .fontSize(9)
        .text('MONTANT TOTAL', LEFT + 20, boxY + 15, { characterSpacing: 0.5 });
      doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(formatFcfa(Number(booking.totalAmount)), LEFT + 20, boxY + 30);
      doc
        .fillColor('#999999')
        .font('Helvetica')
        .fontSize(9)
        .text(
          `Réf. paiement : ${booking.paymentRef ?? 'N/A'}`,
          LEFT + 260,
          boxY + 26,
          { width: CONTENT_WIDTH - 280, align: 'right' },
        );

      doc.x = LEFT;
      doc.y = boxY + boxHeight + 22;

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          `Document émis le ${new Date().toLocaleDateString('fr-FR')}`,
          LEFT,
          doc.y,
        );
      doc.moveDown(2.2);

      doc
        .moveTo(LEFT, doc.y)
        .lineTo(RIGHT_EDGE, doc.y)
        .strokeColor('#dddddd')
        .stroke();
      doc.moveDown(1);

      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          'Ce document est généré automatiquement par AlloAppart. Pour toute question, contactez alloappart221@gmail.com',
          LEFT,
          doc.y,
          { width: CONTENT_WIDTH, align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Génère le contrat de bail d'habitation (mode MONTHLY) à partir des
   * données de la réservation. AlloAppart n'est pas partie au contrat
   * (cf. Article 11 des CGU) — le document est établi entre le Bailleur et
   * le Locataire, AlloAppart agissant en simple intermédiaire technique.
   * Pas de signature électronique : le document (avec espaces libres pour
   * les informations privées) est signé à la main par les deux parties
   * lors de leur rencontre en personne — voir ContractsController.
   */
  /**
   * @param qrCodeBuffer PNG du QR de vérification (voir generateReceipt) —
   * optionnel, même raison de robustesse.
   */
  generateLeaseContract(
    rawData: LeaseContractData,
    qrCodeBuffer?: Buffer,
  ): Promise<Buffer> {
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
        phone: rawData.landlord.phone
          ? cleanText(rawData.landlord.phone, 40)
          : null,
      },
      tenant: {
        firstName: cleanText(rawData.tenant.firstName, 80),
        lastName: cleanText(rawData.tenant.lastName, 80),
        email: cleanText(rawData.tenant.email, 120),
        phone: rawData.tenant.phone
          ? cleanText(rawData.tenant.phone, 40)
          : null,
      },
      listing: {
        ...rawData.listing,
        title: cleanText(rawData.listing.title, 150),
        address: rawData.listing.address
          ? cleanText(rawData.listing.address, 200)
          : null,
        city: cleanText(rawData.listing.city, 100),
        region: cleanText(rawData.listing.region, 100),
      },
      monthlyRent: finite(rawData.monthlyRent),
      depositAmount: finite(rawData.depositAmount),
      totalDueAtSigning: finite(rawData.totalDueAtSigning),
      platformFee: finite(rawData.platformFee),
      depositMonths: Math.max(0, Math.round(finite(rawData.depositMonths, 0))),
      minLeaseMonths: Math.max(
        1,
        Math.round(finite(rawData.minLeaseMonths, 1)),
      ),
      moveInDate: validDate(rawData.moveInDate),
      issuedAt: validDate(rawData.issuedAt),
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
            `Contrat généré automatiquement par AlloAppart le ${data.issuedAt.toLocaleDateString('fr-FR')} - Réservation ${data.bookingId.slice(0, 8).toUpperCase()} - alloappart221@gmail.com`,
            50,
            bottom + 6,
            { width: 495, align: 'center' },
          );
        doc.page.margins.bottom = originalMarginBottom;
        doc.x = originalX;
        doc.y = originalY;
      };
      doc.on('pageAdded', drawFooter);

      const money = (n: number) => formatFcfa(n);
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
        // Email placeholder Clerk (`<id>@clerk.local`, compte sans email
        // réel — voir user-display.util) : on l'omet plutôt que de l'écrire
        // tel quel sur un document légal, ça n'apporte rien au lecteur.
        const email = displayableEmail(p.email);
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor(INK)
          .text(label, { width: 495 })
          .font('Helvetica')
          .fillColor(SLATE)
          .text(fullName(p), { width: 495 });
        if (email) {
          doc.text(email, { width: 495 });
        }
        doc
          .text(
            p.phone ?? 'Téléphone communiqué via la messagerie AlloAppart',
            { width: 495 },
          )
          .moveDown(0.6);
      };

      // ── En-tête ──
      doc
        .moveTo(50, 40)
        .lineTo(545, 40)
        .strokeColor(GOLD)
        .lineWidth(2)
        .stroke();
      // Logo en haut à gauche (même asset que le reçu, voir generateReceipt)
      // — le titre "AlloAppart" reste centré sur toute la largeur, le logo
      // vient simplement s'ajouter à sa gauche sans perturber cet alignement.
      try {
        doc.image(LOGO_PATH, 50, 46, { width: 28, height: 28 });
      } catch {
        // Logo manquant/illisible : on continue sans bloquer le contrat.
      }
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
          `Réservation ${data.bookingId.slice(0, 8).toUpperCase()} - Émis le ${data.issuedAt.toLocaleDateString('fr-FR')}`,
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
        "AlloAppart agit en qualité d'intermédiaire technique et de mise en relation entre le Bailleur et le Locataire. AlloAppart n'est pas partie au présent contrat de bail (Article 11 des Conditions Générales d'Utilisation AlloAppart) et n'engage sa responsabilité que dans les limites prévues auxdites CGU, notamment le mécanisme de signalement de non-conformité de l'Article 9.",
      );

      sectionTitle('ENTRE LES SOUSSIGNÉS');
      identityBlock(
        'LE BAILLEUR, ci-après "le Bailleur", d\'une part :',
        data.landlord,
      );
      identityBlock(
        'ET LE LOCATAIRE, ci-après "le Locataire", d\'autre part :',
        data.tenant,
      );
      paragraph('IL A ÉTÉ CONVENU CE QUI SUIT :');

      sectionTitle('Article 1 - Objet du contrat');
      paragraph(
        `Le Bailleur donne en location au Locataire, qui accepte, le bien suivant : ${LISTING_TYPE_LABELS[data.listing.type] ?? data.listing.type} "${data.listing.title}", ` +
          `${data.listing.address ? data.listing.address + ', ' : ''}${data.listing.city}, ${data.listing.region}` +
          `${data.listing.rooms ? ` - ${data.listing.rooms} pièce(s)` : ''}${data.listing.surface ? ` - ${data.listing.surface} m2` : ''}.`,
      );

      sectionTitle('Article 2 - Durée du bail');
      paragraph(
        `Le présent bail prend effet à compter du ${data.moveInDate.toLocaleDateString('fr-FR')}, pour une durée minimale de ${data.minLeaseMonths} mois. ` +
          `Passé ce délai, il se poursuit tacitement, sans limitation de durée, jusqu'à résiliation par l'une des parties dans les conditions de l'Article 6 ci-dessous.`,
      );

      sectionTitle('Article 3 - Loyer et charges');
      paragraph(
        `Le loyer mensuel est fixé à ${money(data.monthlyRent)}. ` +
          (data.chargesIncluded
            ? 'Les charges (eau, électricité) sont incluses dans ce montant.'
            : 'Les charges (eau, électricité) ne sont pas incluses et restent à la charge du Locataire, à régler directement au Bailleur ou aux fournisseurs concernés.'),
      );

      sectionTitle('Article 4 - Dépôt de garantie (caution)');
      paragraph(
        `Un dépôt de garantie de ${money(data.depositAmount)} (équivalent à ${data.depositMonths} mois de loyer) est versé par le Locataire à la signature. ` +
          `Conformément à l'Article 7 des CGU AlloAppart, ce dépôt inclut la commission de courtage d'AlloAppart, équivalente à un (1) mois de loyer, prélevée avant reversement au Bailleur ; le solde constitue la garantie proprement dite, restituable au Locataire en fin de bail sous déduction des sommes dues au titre de dégradations locatives éventuelles.`,
      );

      sectionTitle('Article 5 - Modalités de paiement');
      paragraph(
        `Le montant dû au titre du 1er loyer et du dépôt de garantie, soit ${money(data.totalDueAtSigning)}, est réglé par le Locataire via la plateforme AlloAppart au moment de la signature. ` +
          `Les loyers des mois suivants sont réglés directement entre le Bailleur et le Locataire, selon les modalités qu'ils conviennent entre eux (hors intermédiation d'AlloAppart).`,
      );

      sectionTitle('Article 6 - Résiliation');
      paragraph(
        "Le présent bail peut être résilié à tout moment, à l'initiative du Bailleur comme du Locataire, via l'espace AlloAppart de la partie concernée. La résiliation remet le logement à disposition à la location dès sa prise d'effet.",
      );

      sectionTitle('Article 7 - Litiges et responsabilité');
      paragraph(
        "Le Locataire dispose d'un délai de vingt-quatre (24) heures à compter de son entrée effective dans les lieux pour signaler toute non-conformité substantielle, conformément à l'Article 9 des CGU AlloAppart. Pour tout différend relatif à l'exécution du présent bail, les parties s'efforceront de trouver une solution amiable ; à défaut, le litige relève du droit commun, AlloAppart n'étant pas partie au contrat (Article 11 des CGU).",
      );

      sectionTitle('Article 8 - Droit applicable');
      paragraph(
        'Le présent contrat est régi par le droit de la République du Sénégal, notamment le Code des Obligations Civiles et Commerciales (COCC). En cas de litige et à défaut de résolution amiable, compétence exclusive est attribuée au Tribunal de Grande Instance de Dakar.',
      );

      if (doc.y > doc.page.height - (qrCodeBuffer ? 260 : 220)) doc.addPage();

      sectionTitle('Signatures');
      paragraph(
        'Ce contrat est complété avec les informations ci-dessus puis signé à la main par le Locataire et le Bailleur lors de leur rencontre en personne, en deux exemplaires originaux (un par partie).',
      );

      if (qrCodeBuffer) {
        try {
          const qrSize = 70;
          const qrX = 545 - qrSize;
          const qrY = doc.y;
          doc.image(qrCodeBuffer, qrX, qrY, { width: qrSize });
          doc
            .fontSize(6.5)
            .font('Helvetica')
            .fillColor(GREY)
            .text(
              "Scanner pour vérifier ce bail et l'identité du locataire",
              qrX - 130,
              qrY + qrSize + 2,
              {
                width: qrSize + 130,
                align: 'right',
              },
            );
          doc.y = qrY + qrSize + 16;
        } catch {
          // Image corrompue/illisible : on continue sans bloquer le contrat.
        }
      }

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
      const GREEN = '#15803d';
      const RED = '#b91c1c';

      const STATUS_LABELS: Record<string, string> = {
        PENDING: 'En attente',
        CONFIRMED: 'Confirmée',
        CANCELLED: 'Annulée',
        COMPLETED: 'Terminée',
        REQUESTED: 'Demandée',
        APPROVED: 'Approuvée',
        REJECTED: 'Refusée',
        ACTIVE: 'Bail actif',
        TERMINATED: 'Bail terminé',
      };

      const truncate = (s: string, max: number) =>
        s.length > max ? s.slice(0, max - 1) + '…' : s;

      const spaced = (s: string) => s.split('').join(' ');

      // Tendance vs mois précédent affichée sous une valeur de KPI. Retourne
      // null quand il n'y a rien de significatif à comparer (les deux valeurs
      // sont à 0) plutôt que d'afficher un "+0%" trompeur.
      const trendOf = (
        current: number,
        previous: number,
      ): { text: string; color: string } | null => {
        if (previous === 0) {
          if (current === 0) return null;
          return { text: 'Nouveau ce mois', color: GREY };
        }
        const pct = ((current - previous) / previous) * 100;
        const sign = pct >= 0 ? '+' : '';
        return {
          text: `${sign}${pct.toFixed(0)}% vs ${data.previousMonthLabel}`,
          color: pct >= 0 ? GREEN : RED,
        };
      };

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
      const kpiCard = (
        x: number,
        y: number,
        label: string,
        value: string,
        trend?: { text: string; color: string } | null,
      ) => {
        doc.roundedRect(x, y, 240, 78, 4).stroke(BORDER);
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
        if (trend) {
          doc
            .fillColor(trend.color)
            .font('Helvetica')
            .fontSize(7.5)
            .text(trend.text, x + 12, y + 58);
        }
      };

      const revenueTrend = trendOf(data.stats.totalRevenue, data.previousMonth.totalRevenue);
      const bookingsTrend = trendOf(data.stats.totalBookings, data.previousMonth.totalBookings);

      let y = 130;
      kpiCard(
        40,
        y,
        'ANNONCES ACTIVES',
        `${data.stats.publishedListings} / ${data.stats.totalListings}`,
      );
      kpiCard(315, y, 'RÉSERVATIONS', `${data.stats.totalBookings}`, bookingsTrend);
      y += 92;
      kpiCard(40, y, 'REVENUS ENCAISSÉS', formatFcfa(data.stats.totalRevenue), revenueTrend);
      kpiCard(
        315,
        y,
        'NOTE MOYENNE',
        data.stats.avgRating ? `${data.stats.avgRating.toFixed(1)}/5` : 'N/A',
      );
      y += 92;

      // Ajoute une nouvelle page (avec pied de page sur celle qui se termine)
      // quand il ne reste plus assez de place pour la prochaine section.
      const ensureRoom = (needed: number) => {
        if (y + needed > 762) {
          drawFooter();
          doc.addPage();
          y = 50;
        }
      };

      // ── Répartition par statut ──
      ensureRoom(45);
      doc.moveTo(40, y).lineTo(555, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += 10;
      doc
        .fillColor(GREY)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(spaced('RÉPARTITION DES RÉSERVATIONS'), 40, y);
      y += 17;
      if (data.statusBreakdown.length === 0) {
        doc
          .fillColor(LIGHT_GREY)
          .font('Helvetica')
          .fontSize(9)
          .text('Aucune réservation ce mois.', 40, y);
        y += 20;
      } else {
        const breakdownText = data.statusBreakdown
          .map((s) => `${STATUS_LABELS[s.status] ?? s.status} : ${s.count}`)
          .join('      ');
        doc
          .fillColor(DARK_TEXT)
          .font('Helvetica')
          .fontSize(9)
          .text(breakdownText, 40, y, { width: 515 });
        y += 24;
      }

      // ── Revenu par annonce ──
      ensureRoom(55 + Math.min(data.listingBreakdown.length, 5) * 18);
      doc.moveTo(40, y).lineTo(555, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += 10;
      doc
        .fillColor(GREY)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(spaced('REVENU PAR ANNONCE'), 40, y);
      y += 17;
      if (data.listingBreakdown.length === 0) {
        doc
          .fillColor(LIGHT_GREY)
          .font('Helvetica')
          .fontSize(9)
          .text('Aucun revenu par annonce ce mois.', 40, y);
        y += 20;
      } else {
        doc.rect(40, y, 515, 18).fill(TABLE_HEAD_BG);
        doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(8);
        doc.text('ANNONCE', 48, y + 5);
        doc.text('RÉSERVATIONS', 390, y + 5);
        doc.text('REVENU', 478, y + 5);
        y += 18;
        data.listingBreakdown.forEach((l) => {
          doc
            .moveTo(40, y + 18)
            .lineTo(555, y + 18)
            .strokeColor(ROW_BORDER)
            .lineWidth(0.3)
            .stroke();
          doc.fillColor(DARK_TEXT).font('Helvetica').fontSize(8.5);
          doc.text(truncate(l.title, 44), 48, y + 5);
          doc.text(`${l.bookings}`, 410, y + 5);
          doc.text(formatFcfa(l.revenue), 478, y + 5);
          y += 18;
        });
        y += 8;
      }

      // ── Section réservations détaillées ──
      ensureRoom(45);
      doc.moveTo(40, y).lineTo(555, y).strokeColor(BORDER).lineWidth(0.5).stroke();
      y += 10;
      doc
        .fillColor(GREY)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(spaced('RÉSERVATIONS DU MOIS'), 40, y);
      y += 18;

      if (data.bookings.length === 0) {
        doc
          .fillColor(LIGHT_GREY)
          .font('Helvetica')
          .fontSize(10)
          .text('Aucune réservation pour ce mois.', 0, y + 10, {
            width: PAGE_WIDTH,
            align: 'center',
          });
        drawFooter();
      } else {
        doc.rect(40, y, 515, 18).fill(TABLE_HEAD_BG);
        doc.fillColor(SLATE).font('Helvetica-Bold').fontSize(8);
        doc.text('ANNONCE', 48, y + 5);
        doc.text('LOCATAIRE', 198, y + 5);
        doc.text('DATE', 318, y + 5);
        doc.text('MONTANT', 398, y + 5);
        doc.text('STATUT', 478, y + 5);
        y += 18;

        data.bookings.forEach((b) => {
          ensureRoom(18);
          doc
            .moveTo(40, y + 18)
            .lineTo(555, y + 18)
            .strokeColor(ROW_BORDER)
            .lineWidth(0.3)
            .stroke();
          doc.fillColor(DARK_TEXT).font('Helvetica').fontSize(8.5);
          doc.text(truncate(b.listingTitle, 30), 48, y + 5);
          doc.text(truncate(b.tenantName, 20), 198, y + 5);
          doc.text(b.startDate.toLocaleDateString('fr-FR'), 318, y + 5);
          doc.text(formatFcfa(Number(b.totalAmount)), 398, y + 5);
          doc.text(STATUS_LABELS[b.status] ?? b.status, 478, y + 5);
          y += 18;
        });

        drawFooter();
      }

      doc.end();
    });
  }
}
