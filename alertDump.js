const fetch = require('node-fetch');

(async () => {
  const response = await fetch('https://api.weather.gov/alerts/active?area=TX');
  const data = await response.json();

  for (const alert of data.features) {
    console.log('----- ALERT -----');
    console.log('Event:', alert.properties.event);
    console.log('ID:', alert.id);
    console.log('AreaDesc:', alert.properties.areaDesc);
    console.log('FIPS SAME:', alert.properties.geocode?.SAME || 'N/A');
    console.log('Effective:', alert.properties.effective);
    console.log('Expires:', alert.properties.expires);
    console.log('Description:', alert.properties.description.substring(0, 100) + '...');
    console.log('');
  }
})();
