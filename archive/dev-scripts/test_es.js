const axios = require('axios');
(async () => {
  try {
    const res = await axios.get('https://fifa.com/es/home');
    console.log('Status:', res.status);
    console.log('Contains lang="es":', res.data.includes('lang="es"'));
  } catch(e) {
    console.log('Error:', e.message);
  }
})();
