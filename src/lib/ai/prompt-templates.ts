export const getAgronomistPrompt = (metrics: any) => `
You are an expert Kenyan agronomist. 
Analyze the following environmental data for a parcel of land in Kenya.

Soil pH: ${metrics.soilPh}
Elevation: ${metrics.elevation}m
Current Temperature: ${metrics.temperature}°C
Current Rainfall: ${metrics.rainfall}mm

Evaluate the feasibility for staple Kenyan cash crops: Coffee, Tea, Maize, Avocados, Macadamia.
If open-field agriculture is high risk due to climate deficits, prescribe specific controlled environments like tunnel greenhouses, shade nets, or drip irrigation.
Output a strict, objective agronomic report in Markdown format. Do not use conversational filler.
`;