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

function getStatusDescription(code) {
  if (code >= 200 && code < 300) return 'Success';
  if (code >= 300 && code < 400) return 'Redirect';
  const descriptions = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    408: 'Request Timeout',
    418: 'I\'m a teapot',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout'
  };
  return descriptions[code] || 'Error';
}

function aggregate(domain, languageCodes, statusCode) {
  const validCodes = languageCodes.filter(c => c && c.length >= 2);
  const languageNamesList = validCodes.map(code => languageNames[code] || code.toUpperCase());
  
  const uniqueNames = [...new Set(languageNamesList)].sort();
  
  return {
    domain: domain,
    status: `${statusCode} - ${getStatusDescription(statusCode)}`,
    languageCount: uniqueNames.length,
    languages: uniqueNames.join('; ') || '-',
    reviewRecommended: uniqueNames.length === 0 ? 'Yes' : 'No'
  };
}

module.exports = aggregate;
