import { PrismaClient, Role, ListingType, ListingStatus, BookingStatus, EscrowStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://allo:allo_secret@localhost:5433/allo_appart';
const pool   = new Pool({ connectionString: DB_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

// ─── Users de développement ───────────────────────────────────────────────────
const SEED_USERS = [
  {
    clerkId: 'user_seed_locataire_mamadou_001',
    email:     'mamadou.diallo@seed.dev',
    firstName: 'Mamadou',
    lastName:  'Diallo',
    phone:     '+221771234567',
    roles:     [Role.LOCATAIRE],
  },
  {
    clerkId: 'user_seed_bailleur_binta_002',
    email:     'binta.sarr@seed.dev',
    firstName: 'Binta',
    lastName:  'Sarr',
    phone:     '+221779876543',
    roles:     [Role.BAILLEUR],
  },
  {
    clerkId: 'user_seed_admin_modou_003',
    email:     'modou.kane@seed.dev',
    firstName: 'Modou',
    lastName:  'Kane',
    phone:     '+221765432100',
    roles:     [Role.ADMIN],
  },
  {
    clerkId: 'user_seed_agent_awa_004',
    email:     'awa.diop@seed.dev',
    firstName: 'Awa',
    lastName:  'Diop',
    phone:     '+221785551234',
    roles:     [Role.AGENT_TERRAIN],
  },
  {
    clerkId: 'user_seed_dual_ousmane_005',
    email:     'ousmane.thiaw@seed.dev',
    firstName: 'Ousmane',
    lastName:  'Thiaw',
    phone:     '+221776667788',
    roles:     [Role.LOCATAIRE, Role.BAILLEUR],
  },
];

// ─── Annonces ────────────────────────────────────────────────────────────────
const SEED_LISTINGS = [
  /* ── DAKAR ── */
  { title: 'Appartement 3 Pièces Meublé', description: 'Bel appartement meublé de 3 pièces situé au cœur du Plateau. Lumineux, calme et bien entretenu, idéal pour un couple ou une petite famille.', price: 350000, type: ListingType.APPARTEMENT, city: 'Plateau, Dakar', region: 'Dakar', address: 'Rue du Plateau', lat: 14.6897, lng: -17.4372, rooms: 3, beds: 2, baths: 1, surface: 85, amenities: ['wifi','clim','tv','cuisine','douche','gardien'], images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80','https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80'] },
  { title: 'Villa 5 Pièces avec Piscine', description: 'Magnifique villa aux Almadies avec piscine privée, jardin paysagé et vue sur l\'océan Atlantique. Idéale pour une grande famille ou des professionnels expatriés.', price: 750000, type: ListingType.VILLA, city: 'Almadies, Dakar', region: 'Dakar', address: 'Route des Almadies', lat: 14.7490, lng: -17.5231, rooms: 5, beds: 4, baths: 3, surface: 250, amenities: ['wifi','clim','piscine','gardien','parking'], images: ['https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=80','https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=80'] },
  { title: 'Studio Moderne Meublé', description: 'Studio entièrement meublé et équipé à Mermoz, quartier résidentiel calme. Parfait pour un étudiant ou un professionnel célibataire cherchant confort et praticité.', price: 150000, type: ListingType.STUDIO, city: 'Mermoz, Dakar', region: 'Dakar', address: 'Rue Mermoz', lat: 14.7254, lng: -17.4879, rooms: 1, beds: 1, baths: 1, surface: 35, amenities: ['wifi','clim','cuisine'], images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80','https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=1200&q=80'] },
  { title: 'Appartement Vue Mer – Mamelles', description: 'Appartement de 4 pièces avec vue imprenable sur l\'océan Atlantique depuis les hauteurs des Mamelles. Terrasse spacieuse, gardien 24h.', price: 500000, type: ListingType.APPARTEMENT, city: 'Mamelles, Dakar', region: 'Dakar', address: 'Route des Mamelles', lat: 14.7152, lng: -17.4867, rooms: 4, beds: 3, baths: 2, surface: 130, amenities: ['wifi','clim','tv','gardien'], images: ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&q=80','https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&q=80'] },
  { title: 'Chambre Meublée en Colocation', description: 'Chambre meublée dans une colocation de 3 personnes à Ouakam. Partage de la cuisine et du salon. Ambiance conviviale, proche des transports.', price: 80000, type: ListingType.CHAMBRE, city: 'Ouakam, Dakar', region: 'Dakar', address: 'Rue de Ouakam', lat: 14.7348, lng: -17.4953, rooms: 1, beds: 1, baths: 1, surface: 18, amenities: ['wifi','cuisine'], images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80'] },
  { title: 'Villa Résidentielle 6 Pièces', description: 'Villa de standing dans la résidence fermée de Sacré-Cœur. Sécurité 24h/24, piscine commune, parking privé. Idéale pour une grande famille.', price: 900000, type: ListingType.VILLA, city: 'Sacré-Cœur, Dakar', region: 'Dakar', address: 'Résidence Sacré-Cœur', lat: 14.7116, lng: -17.4634, rooms: 6, beds: 5, baths: 3, surface: 320, amenities: ['wifi','clim','piscine','gardien','parking','generateur'], images: ['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=1200&q=80','https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=80'] },

  /* ── THIÈS ── */
  { title: 'Appartement 2 Pièces Thiès Centre', description: 'Appartement propre et lumineux au centre-ville de Thiès. Proche des marchés et des commodités. Idéal pour un couple ou un professionnel.', price: 120000, type: ListingType.APPARTEMENT, city: 'Thiès', region: 'Thiès', address: 'Avenue Léopold Sédar Senghor', lat: 14.7910, lng: -16.9307, rooms: 2, beds: 1, baths: 1, surface: 55, amenities: ['wifi','douche'], images: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=80','https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80'] },
  { title: 'Villa Familiale 4 Pièces Thiès', description: 'Belle villa de 4 pièces avec jardin dans un quartier calme de Thiès. Grande terrasse, parking et espace barbecue pour profiter des soirées en famille.', price: 280000, type: ListingType.VILLA, city: 'Thiès', region: 'Thiès', address: 'Quartier Résidentiel Thiès', lat: 14.7965, lng: -16.9182, rooms: 4, beds: 3, baths: 2, surface: 175, amenities: ['clim','parking','gardien'], images: ['https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&q=80','https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=1200&q=80'] },

  /* ── SAINT-LOUIS ── */
  { title: 'Maison Coloniale Saint-Louis', description: 'Charmante maison coloniale au cœur du patrimoine historique de Saint-Louis. Murs en pierre, plafonds hauts, cour intérieure ombragée. Classée patrimoine UNESCO.', price: 200000, type: ListingType.VILLA, city: 'Saint-Louis', region: 'Saint-Louis', address: "Île de Saint-Louis", lat: 16.0326, lng: -16.4892, rooms: 4, beds: 3, baths: 2, surface: 145, amenities: ['wifi','douche','cuisine'], images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&q=80','https://images.unsplash.com/photo-1560472355-536de3962603?w=1200&q=80'] },
  { title: 'Studio Vue Fleuve Sénégal', description: 'Studio avec vue directe sur le fleuve Sénégal à Saint-Louis. Cuisine équipée, balcon privatif. Parfait pour découvrir cette ville historique au charme unique.', price: 90000, type: ListingType.STUDIO, city: 'Saint-Louis', region: 'Saint-Louis', address: 'Bord du Fleuve, Saint-Louis', lat: 16.0283, lng: -16.5082, rooms: 1, beds: 1, baths: 1, surface: 30, amenities: ['wifi','cuisine'], images: ['https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&q=80'] },

  /* ── ZIGUINCHOR ── */
  { title: 'Villa Tropicale Ziguinchor', description: 'Magnifique villa tropicale en Casamance, entourée d\'une végétation luxuriante. Piscine, jardin fruitier et terrasse couverte pour profiter du climat agréable de Ziguinchor.', price: 350000, type: ListingType.VILLA, city: 'Ziguinchor', region: 'Ziguinchor', address: 'Quartier Santhiaba', lat: 12.5673, lng: -16.2719, rooms: 4, beds: 3, baths: 2, surface: 200, amenities: ['wifi','piscine','gardien','generateur'], images: ['https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80','https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=1200&q=80'] },
  { title: 'Appartement Ziguinchor Centre', description: 'Appartement moderne au cœur de Ziguinchor, capitale de la Casamance. Proche du marché central, des restaurants et des administrations. Idéal pour les professionnels.', price: 160000, type: ListingType.APPARTEMENT, city: 'Ziguinchor', region: 'Ziguinchor', address: 'Centre-ville Ziguinchor', lat: 12.5600, lng: -16.2700, rooms: 3, beds: 2, baths: 1, surface: 90, amenities: ['wifi','clim','cuisine'], images: ['https://images.unsplash.com/photo-1555636222-cae831e670b3?w=1200&q=80'] },

  /* ── KAOLACK ── */
  { title: 'Maison 3 Pièces Kaolack', description: 'Maison bien entretenue de 3 pièces à Kaolack, capitale du Saloum. Quartier résidentiel calme, proche des grandes artères de la ville.', price: 100000, type: ListingType.APPARTEMENT, city: 'Kaolack', region: 'Kaolack', address: 'Quartier Médina, Kaolack', lat: 14.1520, lng: -16.0726, rooms: 3, beds: 2, baths: 1, surface: 80, amenities: ['douche','cuisine'], images: ['https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=1200&q=80'] },

  /* ── DAKAR suite ── */
  { title: 'Bureau Moderne Plateau', description: 'Espace de bureau moderne et climatisé au Plateau de Dakar, quartier d\'affaires central. Idéal pour une startup, un cabinet ou une représentation commerciale.', price: 450000, type: ListingType.BUREAU, city: 'Plateau, Dakar', region: 'Dakar', address: 'Avenue Roume, Plateau', lat: 14.6857, lng: -17.4373, rooms: 3, beds: 0, baths: 1, surface: 95, amenities: ['wifi','clim','parking'], images: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80','https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80'] },
  { title: 'Appartement 4 Pièces Point E', description: 'Grand appartement familial de 4 pièces au Point E, quartier prisé et verdoyant de Dakar. Proche des ambassades, écoles internationales et centres commerciaux.', price: 600000, type: ListingType.APPARTEMENT, city: 'Point E, Dakar', region: 'Dakar', address: 'Rue Point E', lat: 14.7051, lng: -17.4623, rooms: 4, beds: 3, baths: 2, surface: 160, amenities: ['wifi','clim','gardien','parking'], images: ['https://images.unsplash.com/photo-1560185008-b033106af5c3?w=1200&q=80','https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80'] },
  { title: 'Studio Étudiant Fann', description: 'Studio meublé adapté aux étudiants, proche de l\'Université Cheikh Anta Diop de Dakar. Internet haut débit, espace de travail dédié, ambiance studieuse garantie.', price: 95000, type: ListingType.STUDIO, city: 'Fann, Dakar', region: 'Dakar', address: 'Cité Fann Résidence', lat: 14.6968, lng: -17.4698, rooms: 1, beds: 1, baths: 1, surface: 25, amenities: ['wifi','cuisine'], images: ['https://images.unsplash.com/photo-1560448204-603b3fc33ddc?w=1200&q=80'] },
  { title: 'Villa Luxe Ngor', description: 'Villa de luxe à Ngor avec accès privé à la plage. Piscine à débordement, rooftop panoramique, cuisine ouverte équipée. À quelques brasses de l\'île de Ngor.', price: 1200000, type: ListingType.VILLA, city: 'Ngor, Dakar', region: 'Dakar', address: 'Village de Ngor', lat: 14.7538, lng: -17.5142, rooms: 6, beds: 5, baths: 4, surface: 380, amenities: ['wifi','clim','piscine','gardien','parking','generateur'], images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80','https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1200&q=80'] },

  /* ── THIÈS suite ── */
  { title: 'Studio Meublé Thiès Nord', description: 'Studio fonctionnel dans le quartier nord de Thiès. Tout équipé, idéal pour un professionnel en déplacement ou un étudiant cherchant calme et accessibilité.', price: 70000, type: ListingType.STUDIO, city: 'Thiès', region: 'Thiès', address: 'Thiès Nord', lat: 14.8012, lng: -16.9376, rooms: 1, beds: 1, baths: 1, surface: 28, amenities: ['wifi'], images: ['https://images.unsplash.com/photo-1505691723518-36a5ac3be353?w=1200&q=80'] },

  /* ── FATICK ── */
  { title: 'Maison Familiale Fatick', description: 'Grande maison familiale à Fatick avec cour et jardin. Quartier calme proche du marché hebdomadaire. Parfaite pour une famille recherchant l\'authenticité du Sénégal profond.', price: 85000, type: ListingType.VILLA, city: 'Fatick', region: 'Fatick', address: 'Quartier Résidentiel Fatick', lat: 14.3392, lng: -16.4115, rooms: 4, beds: 3, baths: 2, surface: 160, amenities: ['douche','cuisine'], images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80'] },

  /* ── LOUGA ── */
  { title: 'Appartement Louga Centre', description: 'Appartement rénové de 2 pièces en plein centre de Louga. Proche de la grande mosquée et des administrations. Idéal pour un fonctionnaire ou un commerçant.', price: 75000, type: ListingType.APPARTEMENT, city: 'Louga', region: 'Louga', address: 'Centre-ville Louga', lat: 15.6142, lng: -16.2269, rooms: 2, beds: 1, baths: 1, surface: 60, amenities: ['douche','cuisine'], images: ['https://images.unsplash.com/photo-1486304873000-235643847519?w=1200&q=80'] },

  /* ── TAMBACOUNDA ── */
  { title: 'Villa Tambacounda', description: 'Villa spacieuse à Tambacounda, gateway du Sénégal oriental. Idéale pour professionnels travaillant dans la région. Générateur, grande cour et parking sécurisé.', price: 130000, type: ListingType.VILLA, city: 'Tambacounda', region: 'Tambacounda', address: 'Quartier Liberté Tambacounda', lat: 13.7718, lng: -13.6650, rooms: 4, beds: 3, baths: 2, surface: 180, amenities: ['generateur','parking','gardien'], images: ['https://images.unsplash.com/photo-1576941089067-2de3c901e126?w=1200&q=80'] },

  /* ── DAKAR – annonces récentes ── */
  { title: 'Appartement Meublé Liberté 6', description: 'Appartement de standing entièrement meublé à Liberté 6, résidentiel calme et bien desservi. Proche des commerces, restaurants et du tramway Dakar Express.', price: 420000, type: ListingType.APPARTEMENT, city: 'Liberté 6, Dakar', region: 'Dakar', address: 'Liberté 6, Dakar', lat: 14.7213, lng: -17.4524, rooms: 3, beds: 2, baths: 2, surface: 100, amenities: ['wifi','clim','tv','gardien'], images: ['https://images.unsplash.com/photo-1600210492493-0946911123ea?w=1200&q=80','https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1200&q=80'] },
  { title: 'Chambre Meublée Liberté 5', description: 'Chambre meublée confortable dans une colocation de 4 personnes à Liberté 5. Salon partagé, cuisine équipée. Proche de toutes les commodités.', price: 65000, type: ListingType.CHAMBRE, city: 'Liberté 5, Dakar', region: 'Dakar', address: 'Liberté 5, Dakar', lat: 14.7179, lng: -17.4592, rooms: 1, beds: 1, baths: 1, surface: 16, amenities: ['wifi','cuisine'], images: ['https://images.unsplash.com/photo-1540518614846-7eded433c457?w=1200&q=80'] },
];

async function main() {
  console.log('🌱 Début du seed...');

  // Upsert des users (idempotent)
  const users = await Promise.all(
    SEED_USERS.map((u) =>
      prisma.user.upsert({
        where: { clerkId: u.clerkId },
        create: u,
        update: { phone: u.phone },
      }),
    ),
  );
  console.log(`✅ ${users.length} utilisateurs créés/mis à jour`);

  const bailleur = users.find((u) => u.roles.includes(Role.BAILLEUR) && !u.roles.includes(Role.LOCATAIRE))!;
  const dual     = users.find((u) => u.roles.includes(Role.BAILLEUR) && u.roles.includes(Role.LOCATAIRE))!;
  const locataire = users.find((u) => u.roles.includes(Role.LOCATAIRE) && !u.roles.includes(Role.BAILLEUR))!;

  // Upsert des listings (idempotent par titre+ville)
  let listingCount = 0;
  const createdListings: { id: string }[] = [];

  for (const l of SEED_LISTINGS) {
    const owner = listingCount % 3 === 0 ? dual : bailleur;
    const existing = await prisma.listing.findFirst({
      where: { title: l.title, city: l.city },
    });

    if (existing) {
      createdListings.push(existing);
    } else {
      const created = await prisma.listing.create({
        data: {
          ...l,
          status: ListingStatus.ACTIVE,
          isVerified: listingCount % 4 === 0,
          boostScore: listingCount < 5 ? 10 : 0,
          ownerId: owner.id,
        },
      });
      createdListings.push(created);
      listingCount++;
    }
  }
  console.log(`✅ ${listingCount} annonces créées (${createdListings.length} total)`);

  // Bookings de démonstration
  const bookingsData = [
    {
      listingId:   createdListings[0].id,
      tenantId:    locataire.id,
      startDate:   new Date('2026-06-01'),
      endDate:     new Date('2026-08-31'),
      totalAmount: 1050000,
      status:      BookingStatus.CONFIRMED,
      escrowStatus: EscrowStatus.HELD,
    },
    {
      listingId:   createdListings[2].id,
      tenantId:    locataire.id,
      startDate:   new Date('2026-07-01'),
      totalAmount: 150000,
      status:      BookingStatus.PENDING,
      escrowStatus: EscrowStatus.HELD,
    },
    {
      listingId:   createdListings[4].id,
      tenantId:    locataire.id,
      startDate:   new Date('2026-05-01'),
      endDate:     new Date('2026-05-31'),
      totalAmount: 80000,
      status:      BookingStatus.COMPLETED,
      escrowStatus: EscrowStatus.RELEASED,
    },
  ];

  let bookingCount = 0;
  for (const b of bookingsData) {
    const exists = await prisma.booking.findFirst({
      where: { listingId: b.listingId, tenantId: b.tenantId },
    });
    if (!exists) {
      await prisma.booking.create({ data: b });
      bookingCount++;
    }
  }
  console.log(`✅ ${bookingCount} réservations créées`);
  console.log('🎉 Seed terminé !');
}

main()
  .catch((e) => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
