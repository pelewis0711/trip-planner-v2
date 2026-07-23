// Study-abroad host cities beyond the original fixed 20 in src/data/homes.ts
// (kept there as quick-pick shortcuts). Hand-authored from general
// knowledge, the same way src/data/iata.ts and src/data/universitySemesters.ts
// were -- approximate lat/lon good enough for routing-distance estimates,
// not survey-grade data. Spot-check before fully trusting a specific entry.
// Country names match this app's existing convention (src/data/homeCountries.ts,
// src/lib/calc/schengen.ts's SCHENGEN set) -- e.g. "Czechia" not "Czech
// Republic", "England"/"Scotland"/"Wales" as their own non-Schengen
// "countries" rather than one "United Kingdom".
//
// Used by src/lib/resolveHome.ts as the second tier of home-city
// resolution (after the original 20, before a live-geocoded custom home).

export interface CityInfo {
  lat: number;
  lon: number;
  country: string;
}

export const EUROPEAN_CITIES: Record<string, CityInfo> = {
  // Austria
  Salzburg: { lat: 47.80, lon: 13.04, country: "Austria" },
  Innsbruck: { lat: 47.27, lon: 11.39, country: "Austria" },
  Graz: { lat: 47.07, lon: 15.44, country: "Austria" },

  // Belgium
  Bruges: { lat: 51.21, lon: 3.22, country: "Belgium" },
  Ghent: { lat: 51.05, lon: 3.72, country: "Belgium" },
  Antwerp: { lat: 51.22, lon: 4.40, country: "Belgium" },
  Liege: { lat: 50.63, lon: 5.57, country: "Belgium" },

  // Bulgaria
  Sofia: { lat: 42.70, lon: 23.32, country: "Bulgaria" },
  Plovdiv: { lat: 42.14, lon: 24.75, country: "Bulgaria" },
  Varna: { lat: 43.21, lon: 27.92, country: "Bulgaria" },

  // Croatia
  Zagreb: { lat: 45.81, lon: 15.98, country: "Croatia" },
  Split: { lat: 43.51, lon: 16.44, country: "Croatia" },
  Dubrovnik: { lat: 42.65, lon: 18.09, country: "Croatia" },

  // Cyprus (non-Schengen)
  Nicosia: { lat: 35.19, lon: 33.38, country: "Cyprus" },
  Limassol: { lat: 34.71, lon: 33.02, country: "Cyprus" },

  // Czechia (beyond Prague)
  Brno: { lat: 49.20, lon: 16.61, country: "Czechia" },
  "Cesky Krumlov": { lat: 48.81, lon: 14.32, country: "Czechia" },
  Ostrava: { lat: 49.84, lon: 18.29, country: "Czechia" },

  // Denmark (beyond Copenhagen)
  Aarhus: { lat: 56.16, lon: 10.20, country: "Denmark" },
  Odense: { lat: 55.40, lon: 10.39, country: "Denmark" },

  // Estonia
  Tallinn: { lat: 59.44, lon: 24.75, country: "Estonia" },
  Tartu: { lat: 58.38, lon: 26.72, country: "Estonia" },

  // Finland
  Helsinki: { lat: 60.17, lon: 24.94, country: "Finland" },
  Turku: { lat: 60.45, lon: 22.27, country: "Finland" },
  Tampere: { lat: 61.50, lon: 23.76, country: "Finland" },

  // France (beyond Paris)
  Lyon: { lat: 45.76, lon: 4.83, country: "France" },
  Marseille: { lat: 43.30, lon: 5.37, country: "France" },
  Nice: { lat: 43.70, lon: 7.27, country: "France" },
  Toulouse: { lat: 43.60, lon: 1.44, country: "France" },
  Bordeaux: { lat: 44.84, lon: -0.58, country: "France" },
  Strasbourg: { lat: 48.58, lon: 7.75, country: "France" },
  Nantes: { lat: 47.22, lon: -1.55, country: "France" },
  Lille: { lat: 50.63, lon: 3.06, country: "France" },

  // Germany (beyond Berlin)
  Munich: { lat: 48.14, lon: 11.58, country: "Germany" },
  Hamburg: { lat: 53.55, lon: 9.99, country: "Germany" },
  Cologne: { lat: 50.94, lon: 6.96, country: "Germany" },
  Frankfurt: { lat: 50.11, lon: 8.68, country: "Germany" },
  Stuttgart: { lat: 48.78, lon: 9.18, country: "Germany" },
  Dresden: { lat: 51.05, lon: 13.74, country: "Germany" },
  Leipzig: { lat: 51.34, lon: 12.37, country: "Germany" },
  Heidelberg: { lat: 49.40, lon: 8.69, country: "Germany" },

  // Greece (beyond Athens)
  Thessaloniki: { lat: 40.64, lon: 22.94, country: "Greece" },
  Heraklion: { lat: 35.34, lon: 25.13, country: "Greece" },
  Santorini: { lat: 36.39, lon: 25.46, country: "Greece" },
  Mykonos: { lat: 37.45, lon: 25.33, country: "Greece" },

  // Hungary (beyond Budapest)
  Debrecen: { lat: 47.53, lon: 21.63, country: "Hungary" },
  Szeged: { lat: 46.25, lon: 20.15, country: "Hungary" },

  // Iceland
  Reykjavik: { lat: 64.15, lon: -21.94, country: "Iceland" },

  // Ireland (beyond Dublin)
  Cork: { lat: 51.90, lon: -8.47, country: "Ireland" },
  Galway: { lat: 53.27, lon: -9.05, country: "Ireland" },
  Limerick: { lat: 52.66, lon: -8.63, country: "Ireland" },

  // Italy (beyond Rome/Florence/Milan)
  Naples: { lat: 40.85, lon: 14.27, country: "Italy" },
  Turin: { lat: 45.07, lon: 7.69, country: "Italy" },
  Bologna: { lat: 44.49, lon: 11.34, country: "Italy" },
  Venice: { lat: 45.44, lon: 12.34, country: "Italy" },
  Verona: { lat: 45.44, lon: 10.99, country: "Italy" },
  Genoa: { lat: 44.41, lon: 8.93, country: "Italy" },
  Palermo: { lat: 38.12, lon: 13.36, country: "Italy" },
  Pisa: { lat: 43.72, lon: 10.40, country: "Italy" },

  // Latvia
  Riga: { lat: 56.95, lon: 24.11, country: "Latvia" },

  // Lithuania
  Vilnius: { lat: 54.69, lon: 25.28, country: "Lithuania" },
  Kaunas: { lat: 54.90, lon: 23.90, country: "Lithuania" },

  // Luxembourg
  "Luxembourg City": { lat: 49.61, lon: 6.13, country: "Luxembourg" },

  // Malta
  Valletta: { lat: 35.90, lon: 14.51, country: "Malta" },

  // Monaco
  Monaco: { lat: 43.74, lon: 7.43, country: "Monaco" },

  // Montenegro (non-Schengen)
  Kotor: { lat: 42.42, lon: 18.77, country: "Montenegro" },
  Podgorica: { lat: 42.44, lon: 19.26, country: "Montenegro" },

  // Morocco (non-Schengen)
  Marrakech: { lat: 31.63, lon: -7.99, country: "Morocco" },
  Casablanca: { lat: 33.57, lon: -7.59, country: "Morocco" },
  Fez: { lat: 34.03, lon: -5.00, country: "Morocco" },

  // Netherlands (beyond Amsterdam)
  Rotterdam: { lat: 51.92, lon: 4.48, country: "Netherlands" },
  Utrecht: { lat: 52.09, lon: 5.12, country: "Netherlands" },
  "The Hague": { lat: 52.08, lon: 4.31, country: "Netherlands" },
  Maastricht: { lat: 50.85, lon: 5.69, country: "Netherlands" },

  // North Macedonia (non-Schengen)
  Skopje: { lat: 42.00, lon: 21.43, country: "North Macedonia" },

  // Norway
  Oslo: { lat: 59.91, lon: 10.75, country: "Norway" },
  Bergen: { lat: 60.39, lon: 5.32, country: "Norway" },
  Trondheim: { lat: 63.43, lon: 10.39, country: "Norway" },

  // Poland
  Warsaw: { lat: 52.23, lon: 21.01, country: "Poland" },
  Krakow: { lat: 50.06, lon: 19.94, country: "Poland" },
  Wroclaw: { lat: 51.11, lon: 17.04, country: "Poland" },
  Gdansk: { lat: 54.35, lon: 18.65, country: "Poland" },

  // Portugal (beyond Lisbon/Porto)
  Coimbra: { lat: 40.21, lon: -8.43, country: "Portugal" },
  Braga: { lat: 41.55, lon: -8.42, country: "Portugal" },
  Faro: { lat: 37.02, lon: -7.93, country: "Portugal" },

  // Romania
  Bucharest: { lat: 44.43, lon: 26.10, country: "Romania" },
  "Cluj-Napoca": { lat: 46.77, lon: 23.60, country: "Romania" },
  Brasov: { lat: 45.65, lon: 25.61, country: "Romania" },

  // Scotland (non-Schengen, UK)
  Edinburgh: { lat: 55.95, lon: -3.19, country: "Scotland" },
  Glasgow: { lat: 55.86, lon: -4.25, country: "Scotland" },

  // Wales (non-Schengen, UK)
  Cardiff: { lat: 51.48, lon: -3.18, country: "Wales" },

  // Northern Ireland (non-Schengen, UK)
  Belfast: { lat: 54.60, lon: -5.93, country: "Northern Ireland" },

  // England (beyond London)
  Manchester: { lat: 53.48, lon: -2.24, country: "England" },
  Oxford: { lat: 51.75, lon: -1.26, country: "England" },
  Cambridge: { lat: 52.21, lon: 0.12, country: "England" },
  Bristol: { lat: 51.45, lon: -2.59, country: "England" },
  Birmingham: { lat: 52.48, lon: -1.90, country: "England" },

  // Serbia (non-Schengen)
  Belgrade: { lat: 44.79, lon: 20.45, country: "Serbia" },
  "Novi Sad": { lat: 45.27, lon: 19.83, country: "Serbia" },

  // Slovakia (beyond none -- not in original 20)
  Bratislava: { lat: 48.15, lon: 17.11, country: "Slovakia" },
  Kosice: { lat: 48.72, lon: 21.26, country: "Slovakia" },

  // Slovenia
  Ljubljana: { lat: 46.06, lon: 14.51, country: "Slovenia" },
  Bled: { lat: 46.37, lon: 14.11, country: "Slovenia" },

  // Spain (beyond Barcelona/Madrid/Seville)
  Valencia: { lat: 39.47, lon: -0.38, country: "Spain" },
  Granada: { lat: 37.18, lon: -3.60, country: "Spain" },
  Bilbao: { lat: 43.26, lon: -2.94, country: "Spain" },
  Malaga: { lat: 36.72, lon: -4.42, country: "Spain" },
  "San Sebastian": { lat: 43.32, lon: -1.98, country: "Spain" },
  Salamanca: { lat: 40.97, lon: -5.66, country: "Spain" },
  "Santiago de Compostela": { lat: 42.88, lon: -8.55, country: "Spain" },
  "Palma de Mallorca": { lat: 39.57, lon: 2.65, country: "Spain" },

  // Sweden (beyond Stockholm)
  Gothenburg: { lat: 57.71, lon: 11.97, country: "Sweden" },
  Malmo: { lat: 55.60, lon: 13.00, country: "Sweden" },
  Uppsala: { lat: 59.86, lon: 17.64, country: "Sweden" },

  // Switzerland
  Zurich: { lat: 47.37, lon: 8.54, country: "Switzerland" },
  Geneva: { lat: 46.20, lon: 6.14, country: "Switzerland" },
  Bern: { lat: 46.95, lon: 7.45, country: "Switzerland" },
  Basel: { lat: 47.56, lon: 7.59, country: "Switzerland" },
  Lucerne: { lat: 47.05, lon: 8.31, country: "Switzerland" },

  // Turkey (non-Schengen)
  Istanbul: { lat: 41.01, lon: 28.98, country: "Turkey" },
  Ankara: { lat: 39.93, lon: 32.86, country: "Turkey" },
  Izmir: { lat: 38.42, lon: 27.14, country: "Turkey" },

  // Albania (non-Schengen)
  Tirana: { lat: 41.33, lon: 19.82, country: "Albania" },

  // Bosnia and Herzegovina (non-Schengen)
  Sarajevo: { lat: 43.86, lon: 18.41, country: "Bosnia and Herzegovina" },
  Mostar: { lat: 43.34, lon: 17.81, country: "Bosnia and Herzegovina" },
};
