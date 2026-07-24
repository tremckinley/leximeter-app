// Simple mapping of ISO codes to human readable names
const languageNames = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ru': 'Russian',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'nl': 'Dutch',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'pl': 'Polish',
  'tr': 'Turkish'
};

function aggregate(domain, languageCodes) {
  const validCodes = languageCodes.filter(c => c && c.length >= 2);
  const languageNamesList = validCodes.map(code => languageNames[code] || code.toUpperCase());
  
  const uniqueNames = [...new Set(languageNamesList)].sort();
  
  return {
    domain: domain,
    languageCount: uniqueNames.length,
    languages: uniqueNames.join('; ') || '-',
    reviewRecommended: uniqueNames.length === 0 ? 'Yes' : 'No'
  };
}

module.exports = aggregate;
