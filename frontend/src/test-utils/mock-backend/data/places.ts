/**
 * Gazetteer of the Tel Aviv metropolitan area used by the mock geocoding API and the seed data.
 * Coordinates are real neighborhood centers; street names are real streets of each place (en + he).
 */
import type { GeoCoordinates, LocalizedText } from '@/types/domain';

export interface GazetteerStreet {
  name: LocalizedText;
}

export interface GazetteerPlace {
  id: string;
  city: LocalizedText;
  neighborhood: LocalizedText | null;
  center: GeoCoordinates;
  streets: GazetteerStreet[];
}

const TEL_AVIV: LocalizedText = { en: 'Tel Aviv-Yafo', he: 'תל אביב-יפו' };

const street = (en: string, he: string): GazetteerStreet => ({ name: { en, he } });
const at = (latitude: number, longitude: number): GeoCoordinates => ({ latitude, longitude });

export const PLACES: readonly GazetteerPlace[] = [
  // ───────────── Tel Aviv-Yafo ─────────────
  {
    id: 'tlv-florentin',
    city: TEL_AVIV,
    neighborhood: { en: 'Florentin', he: 'פלורנטין' },
    center: at(32.0567, 34.77),
    streets: [
      street('Florentin St', 'פלורנטין'),
      street('Vital St', 'ויטל'),
      street('Abarbanel St', 'אברבנאל'),
      street('Washington Blvd', 'שדרות וושינגטון'),
      street('Levinsky St', 'לוינסקי'),
    ],
  },
  {
    id: 'tlv-neve-tzedek',
    city: TEL_AVIV,
    neighborhood: { en: 'Neve Tzedek', he: 'נווה צדק' },
    center: at(32.0612, 34.7651),
    streets: [street('Shabazi St', 'שבזי'), street('Pines St', 'פינס'), street('Rokach St', 'רוקח'), street('Amzaleg St', 'אמזלג')],
  },
  {
    id: 'tlv-lev-hair',
    city: TEL_AVIV,
    neighborhood: { en: 'Lev HaIr', he: 'לב העיר' },
    center: at(32.0664, 34.7744),
    streets: [
      street('Rothschild Blvd', 'שדרות רוטשילד'),
      street('Allenby St', 'אלנבי'),
      street('Sheinkin St', 'שינקין'),
      street('Nachalat Binyamin St', 'נחלת בנימין'),
      street('Lilienblum St', 'לילינבלום'),
    ],
  },
  {
    id: 'tlv-kerem-hateimanim',
    city: TEL_AVIV,
    neighborhood: { en: 'Kerem HaTeimanim', he: 'כרם התימנים' },
    center: at(32.069, 34.7686),
    streets: [street('HaKovshim St', 'הכובשים'), street('Yishkon St', 'ישכון'), street('Rabbi Meir St', 'רבי מאיר')],
  },
  {
    id: 'tlv-old-north',
    city: TEL_AVIV,
    neighborhood: { en: 'Old North', he: 'הצפון הישן' },
    center: at(32.0853, 34.7753),
    streets: [
      street('Dizengoff St', 'דיזנגוף'),
      street('Ben Yehuda St', 'בן יהודה'),
      street('Gordon St', 'גורדון'),
      street('Frishman St', 'פרישמן'),
      street('Arlozorov St', 'ארלוזורוב'),
    ],
  },
  {
    id: 'tlv-new-north',
    city: TEL_AVIV,
    neighborhood: { en: 'New North', he: 'הצפון החדש' },
    center: at(32.0927, 34.7838),
    streets: [street('Ibn Gabirol St', 'אבן גבירול'), street('Pinkas St', 'פנקס'), street('Yehuda HaMaccabi St', 'יהודה המכבי')],
  },
  {
    id: 'tlv-bavli',
    city: TEL_AVIV,
    neighborhood: { en: 'Bavli', he: 'בבלי' },
    center: at(32.0978, 34.7958),
    streets: [street('Ben Saruk St', 'בן סרוק'), street('Namir Rd', 'דרך נמיר')],
  },
  {
    id: 'tlv-ramat-aviv',
    city: TEL_AVIV,
    neighborhood: { en: 'Ramat Aviv', he: 'רמת אביב' },
    center: at(32.1127, 34.7985),
    streets: [
      street('Einstein St', 'איינשטיין'),
      street('Brodetsky St', 'ברודצקי'),
      street('Haim Levanon St', 'חיים לבנון'),
      street('Kehilat Varsha St', 'קהילת ורשה'),
    ],
  },
  {
    id: 'tlv-ramat-hahayal',
    city: TEL_AVIV,
    neighborhood: { en: 'Ramat HaHayal', he: 'רמת החייל' },
    center: at(32.1103, 34.8392),
    streets: [street('HaBarzel St', 'הברזל'), street('Raoul Wallenberg St', 'ראול ולנברג'), street('HaNechoshet St', 'הנחושת')],
  },
  {
    id: 'tlv-yad-eliyahu',
    city: TEL_AVIV,
    neighborhood: { en: 'Yad Eliyahu', he: 'יד אליהו' },
    center: at(32.0588, 34.7893),
    streets: [street('Yigal Alon St', 'יגאל אלון'), street('HaTayasim Rd', 'דרך התייסים')],
  },
  {
    id: 'tlv-jaffa',
    city: TEL_AVIV,
    neighborhood: { en: 'Jaffa', he: 'יפו' },
    center: at(32.0493, 34.7545),
    streets: [
      street('Yefet St', 'יפת'),
      street('Jerusalem Blvd', 'שדרות ירושלים'),
      street('Olei Zion St', 'עולי ציון'),
      street('Raziel St', 'רזיאל'),
    ],
  },
  {
    id: 'tlv-sarona',
    city: TEL_AVIV,
    neighborhood: { en: 'Sarona', he: 'שרונה' },
    center: at(32.0718, 34.7864),
    streets: [street('Kaplan St', 'קפלן'), street('HaArba’a St', 'הארבעה'), street('Leonardo da Vinci St', 'לאונרדו דה וינצ׳י')],
  },
  {
    id: 'tlv-port',
    city: TEL_AVIV,
    neighborhood: { en: 'Tel Aviv Port', he: 'נמל תל אביב' },
    center: at(32.0972, 34.7737),
    streets: [street('HaYarkon St', 'הירקון'), street('Yirmiyahu St', 'ירמיהו'), street('Nordau Blvd', 'שדרות נורדאו')],
  },
  {
    id: 'tlv-hatikva',
    city: TEL_AVIV,
    neighborhood: { en: 'HaTikva', he: 'שכונת התקווה' },
    center: at(32.0533, 34.7923),
    streets: [street('Etzel St', 'אצ״ל'), street('HaHagana Rd', 'דרך ההגנה')],
  },
  {
    id: 'tlv-neve-shaanan',
    city: TEL_AVIV,
    neighborhood: { en: 'Neve Sha’anan', he: 'נווה שאנן' },
    center: at(32.0561, 34.7772),
    streets: [street('Neve Sha’anan St', 'נווה שאנן'), street('HaGdud HaIvri St', 'הגדוד העברי')],
  },
  {
    id: 'tlv-kikar-hamedina',
    city: TEL_AVIV,
    neighborhood: { en: 'Kikar HaMedina', he: 'כיכר המדינה' },
    center: at(32.0869, 34.7897),
    streets: [street('Weizmann St', 'ויצמן'), street('Jabotinsky St', 'ז׳בוטינסקי')],
  },
  {
    id: 'tlv-montefiore',
    city: TEL_AVIV,
    neighborhood: { en: 'Montefiore', he: 'מונטיפיורי' },
    center: at(32.0664, 34.7836),
    streets: [street('Yehuda HaLevi St', 'יהודה הלוי'), street('HaRakevet St', 'הרכבת')],
  },
  {
    id: 'tlv-ajami',
    city: TEL_AVIV,
    neighborhood: { en: 'Ajami', he: 'עג׳מי' },
    center: at(32.0466, 34.7527),
    streets: [street('Kedem St', 'קדם'), street('Yefet St', 'יפת')],
  },
  {
    id: 'tlv-afeka',
    city: TEL_AVIV,
    neighborhood: { en: 'Afeka', he: 'אפקה' },
    center: at(32.1152, 34.8042),
    streets: [street('Mivtsa Kadesh St', 'מבצע קדש'), street('Haim Levanon St', 'חיים לבנון')],
  },
  // ───────────── Ramat Gan & Givatayim ─────────────
  {
    id: 'rg-center',
    city: { en: 'Ramat Gan', he: 'רמת גן' },
    neighborhood: { en: 'City Center', he: 'מרכז העיר' },
    center: at(32.082, 34.813),
    streets: [street('Bialik St', 'ביאליק'), street('Krinitzi St', 'קריניצי'), street('Herzl St', 'הרצל')],
  },
  {
    id: 'rg-bursa',
    city: { en: 'Ramat Gan', he: 'רמת גן' },
    neighborhood: { en: 'Diamond Exchange', he: 'הבורסה' },
    center: at(32.0838, 34.8024),
    streets: [street('Jabotinsky Rd', 'דרך ז׳בוטינסקי'), street('Abba Hillel Silver Rd', 'דרך אבא הלל סילבר'), street('Tuval St', 'תובל')],
  },
  {
    id: 'givatayim',
    city: { en: 'Givatayim', he: 'גבעתיים' },
    neighborhood: null,
    center: at(32.0715, 34.811),
    streets: [street('Katznelson St', 'כצנלסון'), street('Weizmann St', 'ויצמן'), street('Borochov St', 'בורוכוב')],
  },
  // ───────────── South ─────────────
  {
    id: 'holon',
    city: { en: 'Holon', he: 'חולון' },
    neighborhood: null,
    center: at(32.0158, 34.7795),
    streets: [street('Sokolov St', 'סוקולוב'), street('Weizmann St', 'ויצמן'), street('Kugel Blvd', 'שדרות קוגל'), street('Eilat St', 'אילת')],
  },
  {
    id: 'bat-yam',
    city: { en: 'Bat Yam', he: 'בת ים' },
    neighborhood: null,
    center: at(32.0171, 34.7462),
    streets: [street('Balfour St', 'בלפור'), street('Rothschild St', 'רוטשילד'), street('HaAtzmaut Blvd', 'שדרות העצמאות')],
  },
  {
    id: 'rishon-center',
    city: { en: 'Rishon LeZion', he: 'ראשון לציון' },
    neighborhood: { en: 'City Center', he: 'מרכז העיר' },
    center: at(31.964, 34.804),
    streets: [street('Herzl St', 'הרצל'), street('Rothschild St', 'רוטשילד'), street('Ahad Ha’Am St', 'אחד העם')],
  },
  {
    id: 'ness-ziona',
    city: { en: 'Ness Ziona', he: 'נס ציונה' },
    neighborhood: null,
    center: at(31.9296, 34.7988),
    streets: [street('Weizmann St', 'ויצמן'), street('HaBanim St', 'הבנים')],
  },
  {
    id: 'rehovot',
    city: { en: 'Rehovot', he: 'רחובות' },
    neighborhood: null,
    center: at(31.8943, 34.8113),
    streets: [street('Herzl St', 'הרצל'), street('Bilu St', 'בילו')],
  },
  // ───────────── East ─────────────
  {
    id: 'bnei-brak',
    city: { en: 'Bnei Brak', he: 'בני ברק' },
    neighborhood: null,
    center: at(32.0849, 34.8352),
    streets: [street('Rabbi Akiva St', 'רבי עקיבא'), street('Jabotinsky Rd', 'דרך ז׳בוטינסקי'), street('Hazon Ish St', 'חזון איש')],
  },
  {
    id: 'pt-center',
    city: { en: 'Petah Tikva', he: 'פתח תקווה' },
    neighborhood: { en: 'City Center', he: 'מרכז העיר' },
    center: at(32.0878, 34.8864),
    streets: [street('Rothschild St', 'רוטשילד'), street('Haim Ozer St', 'חיים עוזר'), street('Baron Hirsch St', 'ברון הירש')],
  },
  {
    id: 'pt-em-hamoshavot',
    city: { en: 'Petah Tikva', he: 'פתח תקווה' },
    neighborhood: { en: 'Em HaMoshavot', he: 'אם המושבות' },
    center: at(32.1047, 34.8718),
    streets: [street('Jabotinsky Rd', 'דרך ז׳בוטינסקי'), street('Ahad Ha’Am St', 'אחד העם')],
  },
  {
    id: 'kiryat-ono',
    city: { en: 'Kiryat Ono', he: 'קריית אונו' },
    neighborhood: null,
    center: at(32.0594, 34.8556),
    streets: [street('Levi Eshkol St', 'לוי אשכול'), street('Tzahal St', 'צה״ל'), street('Yerushalayim St', 'ירושלים')],
  },
  {
    id: 'or-yehuda',
    city: { en: 'Or Yehuda', he: 'אור יהודה' },
    neighborhood: null,
    center: at(32.029, 34.853),
    streets: [street('Eliyahu Saadon St', 'אליהו סעדון'), street('HaHistadrut St', 'ההסתדרות')],
  },
  {
    id: 'yehud',
    city: { en: 'Yehud', he: 'יהוד' },
    neighborhood: null,
    center: at(32.0331, 34.8882),
    streets: [street('Herzl St', 'הרצל'), street('Ben Gurion St', 'בן גוריון')],
  },
  {
    id: 'rosh-haayin',
    city: { en: 'Rosh HaAyin', he: 'ראש העין' },
    neighborhood: null,
    center: at(32.0956, 34.9566),
    streets: [street('Shabazi St', 'שבזי'), street('Ben Gurion St', 'בן גוריון')],
  },
  // ───────────── North (Sharon) ─────────────
  {
    id: 'herzliya-center',
    city: { en: 'Herzliya', he: 'הרצליה' },
    neighborhood: { en: 'City Center', he: 'מרכז העיר' },
    center: at(32.1648, 34.8437),
    streets: [street('Sokolov St', 'סוקולוב'), street('Ben Gurion St', 'בן גוריון'), street('HaNasi St', 'הנשיא')],
  },
  {
    id: 'herzliya-pituach',
    city: { en: 'Herzliya', he: 'הרצליה' },
    neighborhood: { en: 'Herzliya Pituach', he: 'הרצליה פיתוח' },
    center: at(32.1635, 34.8045),
    streets: [street('Galgalei HaPlada St', 'גלגלי הפלדה'), street('HaMenofim St', 'המנופים'), street('Abba Eban Blvd', 'שדרות אבא אבן')],
  },
  {
    id: 'ramat-hasharon',
    city: { en: 'Ramat HaSharon', he: 'רמת השרון' },
    neighborhood: null,
    center: at(32.1459, 34.8399),
    streets: [street('Sokolov St', 'סוקולוב'), street('Ussishkin St', 'אוסישקין'), street('Bialik St', 'ביאליק')],
  },
  {
    id: 'raanana',
    city: { en: 'Ra’anana', he: 'רעננה' },
    neighborhood: null,
    center: at(32.1844, 34.8707),
    streets: [street('Ahuza St', 'אחוזה'), street('Weizmann St', 'ויצמן'), street('Ostrovsky St', 'אוסטרובסקי')],
  },
  {
    id: 'kfar-saba',
    city: { en: 'Kfar Saba', he: 'כפר סבא' },
    neighborhood: null,
    center: at(32.1758, 34.9077),
    streets: [street('Weizmann St', 'ויצמן'), street('Tel Hai St', 'תל חי'), street('Rothschild St', 'רוטשילד')],
  },
  {
    id: 'hod-hasharon',
    city: { en: 'Hod HaSharon', he: 'הוד השרון' },
    neighborhood: null,
    center: at(32.1553, 34.8913),
    streets: [street('Ramatayim Rd', 'דרך רמתיים'), street('HaBanim St', 'הבנים'), street('Magdiel St', 'מגדיאל')],
  },
];

const PLACE_BY_ID = new Map(PLACES.map((place) => [place.id, place]));

export function getPlace(id: string): GazetteerPlace {
  const place = PLACE_BY_ID.get(id);
  if (!place) throw new Error(`Unknown gazetteer place "${id}"`);
  return place;
}
