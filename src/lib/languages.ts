export const languages = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeName: "मराठी" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்" },
  { code: "ur", name: "Urdu", nativeName: "اردو" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം" },
  { code: "or", name: "Odia", nativeName: "ଓଡ଼ିଆ" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ" },
  { code: "as", name: "Assamese", nativeName: "অসমীয়া" },
  { code: "mai", name: "Maithili", nativeName: "मैथिली" },
  { code: "sa", name: "Sanskrit", nativeName: "संस्कृतम्" },
  { code: "ks", name: "Kashmiri", nativeName: "کٲشُر" },
  { code: "ne", name: "Nepali", nativeName: "नेपाली" },
  { code: "kok", name: "Konkani", nativeName: "कोंकणी" },
  { code: "sd", name: "Sindhi", nativeName: "سنڌي" },
  { code: "doi", name: "Dogri", nativeName: "डोगरी" },
  { code: "brx", name: "Bodo", nativeName: "बड़ो" },
  { code: "sat", name: "Santali", nativeName: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "mni", name: "Manipuri", nativeName: "ꯃꯩꯇꯩꯂꯣꯟ" },
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return languages.some((language) => language.code === value);
}

export function getLanguage(code: LanguageCode) {
  return languages.find((language) => language.code === code)!;
}
