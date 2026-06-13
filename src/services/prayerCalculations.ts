// Offline Astronomical Calculation Helpers for Prayer Times, Qibla and Hijri Calendar

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const fixAngle = (a: number) => {
  a = a - 360 * Math.floor(a / 360);
  return a < 0 ? a + 360 : a;
};

// Helper: Julian Date calculation
export function getJulianDate(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + B - 1524.5;
}

// Helper: Solar position coordinates
function getSolarCoordinates(jd: number) {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const L = fixAngle(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)));
  
  const obliq = 23.439 - 0.00000036 * d;
  const decl = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(L))));
  
  let RA = deg(Math.atan2(Math.cos(rad(obliq)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15;
  if (RA < 0) RA += 24;
  
  const EqT = (q / 15) - RA;
  return { decl, eqt: EqT * 60 }; // eqt in minutes
}

/**
 * Calculates prayer times locally based on geographic location and astronomical formula
 */
export function calculateOfflinePrayerTimes(
  lat: number,
  lon: number,
  date: Date = new Date(),
  method: 'ISNA' | 'MWL' | 'Karachi' | 'Makkah' = 'ISNA'
) {
  const jd = getJulianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  
  // Calculate timezone offset in hours
  const timezone = -(date.getTimezoneOffset() / 60);
  
  // Get solar coordinates
  const { decl, eqt } = getSolarCoordinates(jd);
  
  // Solar Noon (Dhuhr)
  const dhuhr = 12 + timezone - lon / 15 - eqt / 60;
  
  // Method parameters
  let fajrAngle = 15;
  let ishaAngle = 15;
  let isMakkah = false;
  
  if (method === 'MWL') {
    fajrAngle = 18;
    ishaAngle = 17;
  } else if (method === 'Karachi') {
    fajrAngle = 18;
    ishaAngle = 18;
  } else if (method === 'Makkah') {
    fajrAngle = 18.5;
    isMakkah = true;
  }
  
  // Hour Angle for depression angle
  const hourAngle = (angle: number) => {
    const rAngle = rad(angle);
    const rLat = rad(lat);
    const rDecl = rad(decl);
    
    // Depression angle: altitude is -angle
    const cosH = (-Math.sin(rAngle) - Math.sin(rLat) * Math.sin(rDecl)) / (Math.cos(rLat) * Math.cos(rDecl));
    if (cosH < -1 || cosH > 1) return NaN; // handle extreme latitude cases
    const H = deg(Math.acos(cosH));
    return H / 15;
  };
  
  const fajrHA = hourAngle(fajrAngle);
  const sunriseHA = hourAngle(0.833);
  const sunsetHA = hourAngle(0.833);
  
  // Asr hour angle (Standard/Shafi'i method)
  const rLat = rad(lat);
  const rDecl = rad(decl);
  const asrCot = 1 + Math.abs(Math.tan(rLat - rDecl));
  const asrAngle = deg(Math.atan(1 / asrCot));
  
  const cosAsr = (Math.sin(rad(asrAngle)) - Math.sin(rLat) * Math.sin(rDecl)) / (Math.cos(rLat) * Math.cos(rDecl));
  const asrHA = cosAsr >= -1 && cosAsr <= 1 ? deg(Math.acos(cosAsr)) / 15 : NaN;
  
  const pad = (h: number) => {
    if (isNaN(h)) return '--:--';
    h = fixAngle(h * 15) / 15; // normalize
    const hours = Math.floor(h);
    const minutes = Math.floor((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };
  
  const fajrVal = dhuhr - fajrHA;
  const sunriseVal = dhuhr - sunriseHA;
  const asrVal = dhuhr + asrHA;
  const sunsetVal = dhuhr + sunsetHA;
  
  let ishaVal = dhuhr + hourAngle(ishaAngle);
  if (isMakkah) {
    // Um Al-Qura: Isha is Maghrib + 90 minutes
    ishaVal = sunsetVal + 1.5;
  }
  
  return {
    Fajr: pad(fajrVal),
    Sunrise: pad(sunriseVal),
    Dhuhr: pad(dhuhr),
    Asr: pad(asrVal),
    Maghrib: pad(sunsetVal),
    Isha: pad(ishaVal),
  };
}

/**
 * Calculates Qibla bearing/angle from coordinates offline
 */
export function calculateOfflineQibla(lat: number, lon: number): { bearing: number; direction: string } {
  // Kaaba coordinates
  const kaabaLat = rad(21.422478);
  const kaabaLon = rad(39.826207);
  
  const rLat = rad(lat);
  const rLon = rad(lon);
  
  const diffLon = kaabaLon - rLon;
  
  const y = Math.sin(diffLon);
  const x = Math.cos(rLat) * Math.tan(kaabaLat) - Math.sin(rLat) * Math.cos(diffLon);
  
  let bearing = deg(Math.atan2(y, x));
  bearing = (bearing + 360) % 360;
  
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  const index = Math.round(bearing / 45);
  const direction = directions[index];
  
  return {
    bearing: parseFloat(bearing.toFixed(2)),
    direction
  };
}

/**
 * Converts standard Gregorian date to Hijri offline using tabular calendar approximation
 */
export function convertGregorianToHijriOffline(date: Date) {
  const jd = getJulianDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  
  const l = Math.floor(jd) - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  const l2 = l - 10631 * n + 354;
  const j = Math.floor((10985 - l2) / 5316) * Math.floor((50 + l2) / 30) + Math.floor((l2 - 40) / 30) * Math.floor((10985 - l2) / 5316) + Math.floor((l2 - 40) / 30);
  
  const year = 30 * n + Math.floor((30 * j + 43) / 10631);
  let monthIndex = Math.floor(((30 * j + 43) % 10631) / 30);
  let day = l2 - Math.floor((29 * j + 14) / 30) + 1;
  
  if (day > 30) {
    day -= 30;
    monthIndex += 1;
  }
  
  const monthsEn = [
    'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani',
    'Jumada al-Awwal', 'Jumada al-Thani', 'Rajab', 'Sha\'ban',
    'Ramadan', 'Shawwal', 'Dhu al-Qa\'dah', 'Dhu al-Hijjah'
  ];
  
  const monthsAr = [
    'المحرّم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
    'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
    'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
  ];
  
  const monthNumber = monthIndex + 1;
  const monthNameEn = monthsEn[monthIndex] || 'Muharram';
  const monthNameAr = monthsAr[monthIndex] || 'المحرّم';
  
  const pad = (num: number) => String(num).padStart(2, '0');
  
  return {
    date: `${pad(day)}-${pad(monthNumber)}-${year}`,
    day: String(day),
    month: {
      number: monthNumber,
      en: monthNameEn,
      ar: monthNameAr
    },
    year: String(year)
  };
}
