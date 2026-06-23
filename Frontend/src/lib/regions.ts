export interface RegionData {
  slug: string;
  name: string;
  description: string;
  cities: string[];
  coverImage: string;
  highlights: string[];
}

export const REGIONS: RegionData[] = [
  {
    slug: 'Dakar',
    name: 'Dakar',
    description: 'Capitale économique et culturelle du Sénégal, Dakar concentre l\'essentiel de l\'offre locative haut de gamme et intermédiaire.',
    cities: ['Dakar', 'Pikine', 'Guédiawaye', 'Rufisque', 'Bargny'],
    coverImage: 'https://images.unsplash.com/photo-1604328671516-5e8a6d1b8e9b?auto=format&fit=crop&w=800&q=80',
    highlights: ['Plateau', 'Almadies', 'Mermoz', 'Ouakam', 'Yoff'],
  },
  {
    slug: 'Thiès',
    name: 'Thiès',
    description: 'Deuxième ville du pays, Thiès offre un marché immobilier accessible avec une bonne qualité de vie.',
    cities: ['Thiès', 'Mbour', 'Tivaouane', 'Joal-Fadiouth'],
    coverImage: 'https://images.unsplash.com/photo-1580746738099-1dd01d16f0d1?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre-ville', 'Mbour Plage', 'Saly'],
  },
  {
    slug: 'Saint-Louis',
    name: 'Saint-Louis',
    description: 'Ancienne capitale coloniale classée au patrimoine mondial de l\'UNESCO, Saint-Louis séduit par son architecture et son charme.',
    cities: ['Saint-Louis', 'Richard-Toll', 'Dagana'],
    coverImage: 'https://images.unsplash.com/photo-1580746738099-1dd01d16f0d1?auto=format&fit=crop&w=800&q=80',
    highlights: ['Île de Saint-Louis', 'Langue de Barbarie', 'Guet Ndar'],
  },
  {
    slug: 'Ziguinchor',
    name: 'Ziguinchor',
    description: 'Capitale de la Casamance, région verdoyante aux paysages tropicaux et à la culture riche.',
    cities: ['Ziguinchor', 'Bignona', 'Oussouye'],
    coverImage: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre de Ziguinchor', 'Cap Skirring', 'Kafountine'],
  },
  {
    slug: 'Kaolack',
    name: 'Kaolack',
    description: 'Carrefour commercial du centre du Sénégal, Kaolack dispose d\'un marché locatif dynamique.',
    cities: ['Kaolack', 'Nioro du Rip', 'Guinguinéo'],
    coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    highlights: ['Médina Baye', 'Ndorong', 'Léona'],
  },
  {
    slug: 'Diourbel',
    name: 'Diourbel',
    description: 'Région à forte tradition religieuse, Diourbel attire des pèlerins et des résidents tout au long de l\'année.',
    cities: ['Diourbel', 'Touba', 'Mbacké'],
    coverImage: 'https://images.unsplash.com/photo-1580746738099-1dd01d16f0d1?auto=format&fit=crop&w=800&q=80',
    highlights: ['Touba', 'Mbacké'],
  },
  {
    slug: 'Louga',
    name: 'Louga',
    description: 'Région du nord-ouest avec des villes en plein développement.',
    cities: ['Louga', 'Linguère', 'Kébémer'],
    coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre de Louga'],
  },
  {
    slug: 'Tambacounda',
    name: 'Tambacounda',
    description: 'Vaste région de l\'est, porte d\'entrée pour le parc national du Niokolo-Koba.',
    cities: ['Tambacounda', 'Bakel', 'Kédougou'],
    coverImage: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre-ville'],
  },
  {
    slug: 'Kolda',
    name: 'Kolda',
    description: 'Haute Casamance aux paysages préservés et au marché locatif abordable.',
    cities: ['Kolda', 'Vélingara', 'Médina Yoro Foulah'],
    coverImage: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre de Kolda'],
  },
  {
    slug: 'Fatick',
    name: 'Fatick',
    description: 'Région côtière du Sine-Saloum avec ses bolongs et son tourisme balnéaire.',
    cities: ['Fatick', 'Foundiougne', 'Gossas'],
    coverImage: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    highlights: ['Sine-Saloum', 'Foundiougne'],
  },
  {
    slug: 'Kaffrine',
    name: 'Kaffrine',
    description: 'Région agricole du centre du pays avec un coût de la vie attractif.',
    cities: ['Kaffrine', 'Koungheul', 'Birkelane'],
    coverImage: 'https://images.unsplash.com/photo-1580746738099-1dd01d16f0d1?auto=format&fit=crop&w=800&q=80',
    highlights: ['Centre de Kaffrine'],
  },
  {
    slug: 'Kédougou',
    name: 'Kédougou',
    description: 'La région la plus forestière du Sénégal, avec des paysages uniques et un potentiel touristique fort.',
    cities: ['Kédougou', 'Saraya', 'Salémata'],
    coverImage: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=800&q=80',
    highlights: ['Bassari', 'Dindefelo'],
  },
  {
    slug: 'Matam',
    name: 'Matam',
    description: 'Région du nord-est sur les rives du fleuve Sénégal.',
    cities: ['Matam', 'Kanel', 'Ranérou'],
    coverImage: 'https://images.unsplash.com/photo-1580746738099-1dd01d16f0d1?auto=format&fit=crop&w=800&q=80',
    highlights: ['Bord du fleuve'],
  },
  {
    slug: 'Sédhiou',
    name: 'Sédhiou',
    description: 'Nouvelle région de la Casamance aux forêts luxuriantes et au potentiel agricole.',
    cities: ['Sédhiou', 'Bounkiling', 'Goudomp'],
    coverImage: 'https://images.unsplash.com/photo-1559598467-f8b76c8155d0?auto=format&fit=crop&w=800&q=80',
    highlights: ['Bords du Casamance'],
  },
];

export function getRegion(slug: string): RegionData | undefined {
  return REGIONS.find(
    (r) => r.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase(),
  );
}
