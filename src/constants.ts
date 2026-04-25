export const VENUE_LOCATIONS = [
  'Главная сцена',
  'Стойка регистрации',
  'Конференц-зал A',
  'Конференц-зал B',
  'Зона питания',
  'Гардероб'
] as const;

export type VenueLocation = typeof VENUE_LOCATIONS[number];
