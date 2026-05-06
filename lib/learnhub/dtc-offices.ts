/**
 * DICT Region V (Bicol) — DTC Office locations.
 *
 * Static list of the six DTC hub offices used by:
 *   • The Right-Panel "DTC Offices" widget (opens a Mapbox modal)
 *   • The Meet/webinar post "Hosted by …" badge (links to the same modal)
 *
 * Coordinates come from `lib/r5-data.ts` (R5_PROVINCE_COORDS) so the map
 * markers stay in sync with the rest of the app's geographic layer.
 *
 *   coords: [longitude, latitude] — Mapbox order.
 */

export interface DtcOffice {
  id: string;
  province: string;
  city: string;
  isMain?: boolean;
  address: string;
  coords: [number, number]; // [lng, lat]
  mapsUrl: string;          // Google Maps deep link
}

export const DTC_OFFICES: DtcOffice[] = [
  {
    id: "legazpi",
    province: "Albay",
    city: "Legazpi City",
    isMain: true,
    address: "2/F Post Telecom Bldg., Lapu Lapu St.",
    coords: [123.7325, 13.1391],
    mapsUrl: "https://maps.google.com/?q=DICT+Regional+Office+V+Legazpi",
  },
  {
    id: "camsur",
    province: "Camarines Sur",
    city: "Camaligan",
    address: "P. Bustamante Rd., Sto. Domingo, Camaligan",
    coords: [123.1900, 13.6200],
    mapsUrl: "https://maps.google.com/?q=DICT+Camarines+Sur+Camaligan",
  },
  {
    id: "camnorte",
    province: "Camarines Norte",
    city: "Daet",
    address: "DICT Bldg., Carlos II Rd., Brgy. III, Daet",
    coords: [122.9550, 14.1120],
    mapsUrl: "https://maps.google.com/?q=DICT+Camarines+Norte+Daet",
  },
  {
    id: "catanduanes",
    province: "Catanduanes",
    city: "Virac",
    address: "Catnet Bldg., San Isidro Village, Virac",
    coords: [124.2400, 13.5790],
    mapsUrl: "https://maps.google.com/?q=DICT+Catanduanes+Virac",
  },
  {
    id: "masbate",
    province: "Masbate",
    city: "Masbate City",
    address: "Post Office Compound, Brgy. Bagumbayan",
    coords: [123.6200, 12.3650],
    mapsUrl: "https://maps.google.com/?q=DICT+Masbate+City",
  },
  {
    id: "sorsogon",
    province: "Sorsogon",
    city: "Sorsogon City",
    address: "2/F SNGCC Bldg., Flores St., Capitol Compound",
    coords: [123.9742, 12.9883],
    mapsUrl: "https://maps.google.com/?q=DICT+Sorsogon+City+Capitol",
  },
];

export function findDtcOffice(id: string | undefined | null): DtcOffice | undefined {
  if (!id) return undefined;
  return DTC_OFFICES.find((o) => o.id === id);
}
