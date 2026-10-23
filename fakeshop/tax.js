"use strict";
/* Combined state + average local sales tax rates (%), by state. These are estimates: real rates vary by city, county and
   ZIP, and some states exempt items such as clothing. [code, name, combined rate]. */
const US_STATES = [
  ["AL", "Alabama", 9.46], ["AK", "Alaska", 1.82], ["AZ", "Arizona", 8.52], ["AR", "Arkansas", 9.46], ["CA", "California", 8.98],
  ["CO", "Colorado", 7.89], ["CT", "Connecticut", 6.35], ["DE", "Delaware", 0], ["DC", "District of Columbia", 6], ["FL", "Florida", 7.02],
  ["GA", "Georgia", 7.39], ["HI", "Hawaii", 4.5], ["ID", "Idaho", 6.03], ["IL", "Illinois", 8.89], ["IN", "Indiana", 7],
  ["IA", "Iowa", 6.94], ["KS", "Kansas", 8.69], ["KY", "Kentucky", 6], ["LA", "Louisiana", 10.11], ["ME", "Maine", 5.5],
  ["MD", "Maryland", 6], ["MA", "Massachusetts", 6.25], ["MI", "Michigan", 6], ["MN", "Minnesota", 8.13], ["MS", "Mississippi", 7.07],
  ["MO", "Missouri", 8.4], ["MT", "Montana", 0], ["NE", "Nebraska", 6.97], ["NV", "Nevada", 8.24], ["NH", "New Hampshire", 0],
  ["NJ", "New Jersey", 6.6], ["NM", "New Mexico", 7.62], ["NY", "New York", 8.54], ["NC", "North Carolina", 7.0], ["ND", "North Dakota", 7.04],
  ["OH", "Ohio", 7.24], ["OK", "Oklahoma", 9.07], ["OR", "Oregon", 0], ["PA", "Pennsylvania", 6.34], ["RI", "Rhode Island", 7],
  ["SC", "South Carolina", 7.44], ["SD", "South Dakota", 6.11], ["TN", "Tennessee", 9.55], ["TX", "Texas", 8.19], ["UT", "Utah", 7.19],
  ["VT", "Vermont", 6.36], ["VA", "Virginia", 5.77], ["WA", "Washington", 9.43], ["WV", "West Virginia", 6.59], ["WI", "Wisconsin", 5.7],
  ["WY", "Wyoming", 5.36],
];
// Accepts "CA", "ca" or "California" (older saved addresses) and returns the two-letter code, or "".
const stateCode = v => { const u = String(v || "").trim().toUpperCase(); const h = u && US_STATES.find(([c, n]) => c === u || n.toUpperCase() === u); return h ? h[0] : ""; };
const taxRateFor = code => { const h = US_STATES.find(([c]) => c === code); return h ? h[2] : null; };
