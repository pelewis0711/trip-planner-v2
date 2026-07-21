// City -> IATA code for flight-price lookups. Compiled from general
// knowledge (not extracted from a source file like the other src/data/*
// files) -- spot-check before fully trusting, and expand UNMAPPED entries
// over time as needed.
//
// Prefers metro/city IATA codes (PAR, LON, MIL, ROM, STO...) over a single
// specific airport where one exists, since price-search APIs typically
// treat a city code as "search all airports serving this city."

export const IATA: Record<string, string> = {
  // Italy
  "Rome": "ROM",
  "Florence": "FLR",
  "Venice": "VCE",
  "Milan": "MIL",
  "Cinque Terre": "PSA", // nearest: Pisa
  "Amalfi Coast": "NAP", // nearest: Naples
  "Naples": "NAP",
  "Palermo (Sicily)": "PMO",
  "Catania & Etna": "CTA",
  "Cagliari (Sardinia)": "CAG",
  "Bari & Puglia": "BRI",
  "Bologna": "BLQ",
  "Verona": "VRN",
  "Siena": "FLR", // nearest: Florence
  "Turin": "TRN",
  "Genoa": "GOA",
  "Matera": "BRI", // nearest: Bari
  "Lecce": "BDS", // nearest: Brindisi
  "Perugia & Assisi": "PEG",
  "Trieste": "TRS",
  "Pisa & Lucca": "PSA",
  "Lake Garda": "VRN", // nearest: Verona
  "Ravenna": "BLQ", // nearest: Bologna
  "Orvieto": "ROM", // nearest: Rome
  "Portofino & Santa Margherita": "GOA", // nearest: Genoa

  // Austria
  "Vienna": "VIE",
  "Salzburg": "SZG",
  "Hallstatt": "SZG", // nearest: Salzburg
  "Wachau Valley": "VIE", // nearest: Vienna
  "Graz": "GRZ",
  "Innsbruck": "INN",

  // Czechia
  "Český Krumlov": "PRG", // nearest: Prague
  "Kutná Hora": "PRG", // nearest: Prague
  "Brno": "BRQ",
  "Olomouc": "PRG", // nearest: Prague
  "Plzeň": "PRG", // nearest: Prague
  "Karlovy Vary": "PRG", // nearest: Prague
  "Bohemian Switzerland NP": "DRS", // nearest: Dresden
  "Telč & Moravia": "BRQ", // nearest: Brno

  // Hungary
  "Budapest": "BUD",
  "Eger": "BUD", // nearest: Budapest
  "Pécs": "BUD", // nearest: Budapest

  // Slovakia
  "Bratislava": "BTS",
  "High Tatras": "TAT", // nearest: Poprad-Tatry
  "Košice": "KSC",

  // Poland
  "Kraków + Auschwitz": "KRK",
  "Warsaw": "WAW",
  "Wrocław": "WRO",
  "Gdańsk": "GDN",
  "Zakopane": "KRK", // nearest: Kraków

  // Germany
  "Nuremberg": "NUE",
  "Munich": "MUC",
  "Berlin": "BER",
  "Hamburg": "HAM",
  "Dresden": "DRS",
  "Leipzig": "LEJ",
  "Cologne": "CGN",
  "Heidelberg": "FRA", // nearest: Frankfurt
  "Rothenburg ob der Tauber": "NUE", // nearest: Nuremberg
  "Garmisch & Zugspitze": "MUC", // nearest: Munich
  "Regensburg": "MUC", // nearest: Munich
  "Bamberg": "NUE", // nearest: Nuremberg
  "Würzburg": "FRA", // nearest: Frankfurt
  "Potsdam": "BER", // nearest: Berlin

  // Switzerland
  "Lauterbrunnen / Swiss Alps": "ZRH", // nearest: Zurich
  "Interlaken": "ZRH", // nearest: Zurich
  "Zermatt / Matterhorn": "GVA", // nearest: Geneva
  "Zürich": "ZRH",
  "St. Moritz & Bernina": "ZRH", // nearest: Zurich
  "Grindelwald": "ZRH", // nearest: Zurich

  // France
  "Chamonix / Mont Blanc": "GVA", // nearest: Geneva
  "Annecy": "GVA", // nearest: Geneva
  "Paris": "PAR",
  "Nice & French Riviera": "NCE",
  "Lyon": "LYS",
  "Marseille & Calanques": "MRS",
  "Bordeaux": "BOD",
  "Strasbourg & Alsace": "SXB",
  "Normandy D-Day Beaches": "CFR", // nearest: Caen
  "Loire Valley Châteaux": "TUF", // nearest: Tours
  "Colmar & Alsace villages": "SXB", // nearest: Strasbourg
  "Avignon & Provence": "MRS", // nearest: Marseille
  "Lille": "LIL",
  "Reims & Champagne": "PAR", // nearest: Paris

  // Slovenia
  "Lake Bled": "LJU", // nearest: Ljubljana
  "Lake Bohinj & Triglav": "LJU", // nearest: Ljubljana
  "Ljubljana": "LJU",

  // Netherlands
  "Amsterdam": "AMS",
  "Rotterdam": "RTM",
  "Utrecht": "AMS", // nearest: Amsterdam
  "Delft & The Hague": "RTM", // nearest: Rotterdam

  // Belgium
  "Bruges": "BRU", // nearest: Brussels
  "Ghent": "BRU", // nearest: Brussels
  "Brussels": "BRU",
  "Antwerp": "BRU", // nearest: Brussels

  // Luxembourg
  "Luxembourg City": "LUX",

  // Ireland
  "Dublin (St. Patrick's)": "DUB",
  "Galway & Cliffs of Moher": "SNN", // nearest: Shannon

  // Scotland
  "Edinburgh": "EDI",
  "Glasgow": "GLA",

  // England
  "London": "LON",
  "Oxford": "LON", // nearest: London
  "Cambridge": "LON", // nearest: London
  "Bath & Stonehenge": "BRS", // nearest: Bristol
  "Liverpool": "LPL",
  "York": "LBA", // nearest: Leeds Bradford
  "Brighton": "LON", // nearest: London
  "The Cotswolds": "BRS", // nearest: Bristol
  "Lake District": "MAN", // nearest: Manchester

  // Northern Ireland
  "Belfast & Giant's Causeway": "BFS",

  // Wales
  "Cardiff & Brecon Beacons": "CWL",

  // Spain
  "Barcelona": "BCN",
  "Madrid": "MAD",
  "Seville": "SVQ",
  "Granada": "GRX",
  "Córdoba": "SVQ", // nearest: Seville
  "Cádiz & Costa de la Luz": "XRY", // nearest: Jerez
  "Bilbao & Basque Country": "BIO",
  "San Sebastián": "BIO", // nearest: Bilbao
  "Valencia": "VLC",
  "Málaga & Costa del Sol": "AGP",
  "Girona & Costa Brava": "GRO",
  "Salamanca": "MAD", // nearest: Madrid
  "Santiago de Compostela": "SCQ",
  "Tenerife (Canary Islands)": "TFS",
  "Mallorca": "PMI",
  "Ibiza": "IBZ",
  "Menorca": "MAH",
  "Toledo": "MAD", // nearest: Madrid
  "Segovia": "MAD", // nearest: Madrid
  "Ronda & Pueblos Blancos": "AGP", // nearest: Málaga

  // Portugal
  "Lisbon": "LIS",
  "Porto": "OPO",
  "Algarve (Lagos)": "FAO", // nearest: Faro
  "Madeira": "FNC",
  "Azores (São Miguel)": "PDL",
  "Coimbra": "OPO", // nearest: Porto
  "Évora & Alentejo": "LIS", // nearest: Lisbon

  // Croatia
  "Zagreb": "ZAG",
  "Plitvice Lakes": "ZAG", // nearest: Zagreb
  "Dubrovnik": "DBV",
  "Split + Hvar": "SPU",
  "Zadar": "ZAD",
  "Rovinj & Istria": "PUY", // nearest: Pula
  "Hvar Island": "SPU", // nearest: Split
  "Pula & Brijuni": "PUY",

  // Montenegro
  "Kotor": "TIV", // nearest: Tivat
  "Durmitor NP (Žabljak)": "TGD", // nearest: Podgorica
  "Budva & Sveti Stefan": "TIV", // nearest: Tivat

  // Bosnia
  "Sarajevo": "SJJ",

  // Serbia
  "Belgrade": "BEG",
  "Novi Sad": "BEG", // nearest: Belgrade

  // Bulgaria
  "Sofia": "SOF",
  "Plovdiv": "SOF", // nearest: Sofia
  "Veliko Tarnovo": "SOF", // nearest: Sofia

  // Romania
  "Bucharest": "OTP",
  "Brașov & Transylvania": "OTP", // nearest: Bucharest
  "Sibiu": "SBZ",

  // Albania
  "Tirana": "TIA",
  "Berat & Albanian Riviera": "TIA", // nearest: Tirana

  // North Macedonia
  "Ohrid": "OHD",
  "Skopje & Matka Canyon": "SKP",

  // Greece
  "Athens": "ATH",
  "Santorini": "JTR",
  "Mykonos": "JMK",
  "Naxos": "JNX",
  "Paros": "PAS",
  "Milos": "MLO",
  "Crete (Chania)": "CHQ",
  "Rhodes": "RHO",
  "Thessaloniki": "SKG",
  "Meteora": "SKG", // nearest: Thessaloniki
  "Corfu": "CFU",
  "Kefalonia": "EFL",
  "Zakynthos": "ZTH",
  "Nafplio": "ATH", // nearest: Athens
  "Hydra": "ATH", // nearest: Athens

  // Turkey
  "Istanbul": "IST",
  "Cappadocia": "ASR", // nearest: Kayseri
  "Pamukkale & Ephesus": "ADB", // nearest: Izmir

  // Malta
  "Malta": "MLA",

  // Cyprus
  "Cyprus (Paphos)": "PFO",

  // Denmark
  "Copenhagen": "CPH",
  "Aarhus": "AAR",

  // Sweden
  "Stockholm": "STO",
  "Gothenburg": "GOT",
  "Malmö & Copenhagen bridge": "CPH", // nearest: Copenhagen

  // Norway
  "Oslo": "OSL",
  "Bergen & Fjords": "BGO",
  "Tromsø": "TOS",
  "Lofoten Islands": "BOO", // nearest: Bodø
  "Stavanger & Pulpit Rock": "SVG",

  // Finland
  "Helsinki": "HEL",
  "Turku & Archipelago": "TKU",

  // Iceland
  "Reykjavík & South Coast": "KEF",

  // Estonia
  "Tallinn": "TLL",
  "Pärnu & Saaremaa": "TLL", // nearest: Tallinn
  "Tartu": "TAY",

  // Latvia
  "Riga": "RIX",

  // Lithuania
  "Vilnius": "VNO",
  "Kaunas": "KUN",
  "Klaipėda & Curonian Spit": "PLQ", // nearest: Palanga

  // Morocco
  "Marrakech": "RAK",
  "Fez": "FEZ",
  "Chefchaouen": "TNG", // nearest: Tangier
  "Essaouira": "RAK", // nearest: Marrakech

  // Monaco
  "Monaco & Menton": "NCE", // nearest: Nice

  // Home-only cities
  "Prague": "PRG",
  "Dublin": "DUB",
};

// Catalog cities we could not confidently map to a single airport/city code
// -- live flight prices won't be available for these, only the estimate.
export const UNMAPPED: string[] = [
  "Dolomites (Bolzano)", // no single obvious airport -- Innsbruck, Verona, Venice, and Bolzano's own tiny airport are all plausible depending on which part of the range
  "Black Forest", // large region with no center -- Stuttgart, Basel/EuroAirport, and Baden-Baden are all comparably "nearest" depending on where in the forest
  "Andorra", // no airport of its own; nearest options (Barcelona, Toulouse) are in different countries and roughly a toss-up
  "Mostar", // Dubrovnik, Split, and Sarajevo are all similar driving distance -- no clear default
  "Ios", // ferry-dependent Cycladic island; its own airport (JIK) has negligible/uncertain scheduled service, no clear mainland default either
];
