export const VENUE_LOCATIONS = [
  'Главная сцена',
  'Конференц-зал A',
  'Конференц-зал B'
] as const;

export type VenueLocation = typeof VENUE_LOCATIONS[number];
