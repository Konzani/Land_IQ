import geoblaze from 'geoblaze';

const SOIL_PH_COG_URL = 'https://files.isric.org/soilgrids/latest/data/phh2o/phh2o_0-5cm_mean.vrt';

self.onmessage = async (event) => {
  const { polygonGeometry, lat, lon } = event.data;

  try {
    const phRaster = await geoblaze.parse(SOIL_PH_COG_URL);
    const stats = await geoblaze.stats(phRaster, polygonGeometry);
    
    const rawMean = stats[0].mean;
    const soilPh = (rawMean / 10).toFixed(2);

    self.postMessage({ 
      status: 'success', 
      data: { soilPh },
      lat,
      lon
    });
  } catch (error) {
    self.postMessage({ status: 'error', message: error.message });
  }
};