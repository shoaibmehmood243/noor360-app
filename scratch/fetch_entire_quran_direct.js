const fs = require('fs');
const path = require('path');
const https = require('https');

const fetchUrl = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

const run = async () => {
  try {
    console.log('Downloading entire Arabic Quran text...');
    const arabicRes = await fetchUrl('https://api.alquran.cloud/v1/quran/quran-simple');
    if (arabicRes.code !== 200) {
      throw new Error(`Failed to download Arabic Quran: ${arabicRes.status}`);
    }
    const arabicSurahs = arabicRes.data.surahs;

    console.log('Downloading entire English translation text (Sahih International)...');
    const englishRes = await fetchUrl('https://api.alquran.cloud/v1/quran/en.sahih');
    if (englishRes.code !== 200) {
      throw new Error(`Failed to download English Quran: ${englishRes.status}`);
    }
    const englishSurahs = englishRes.data.surahs;

    console.log('Merging Arabic and English translations...');
    const offlineQuran = {};

    for (let i = 0; i < 114; i++) {
      const arSurah = arabicSurahs[i];
      const enSurah = englishSurahs[i];

      const surahId = arSurah.number;
      offlineQuran[surahId] = {
        number: arSurah.number,
        name: arSurah.name,
        englishName: arSurah.englishName,
        englishNameTranslation: arSurah.englishNameTranslation,
        revelationType: arSurah.revelationType,
        numberOfAyahs: arSurah.numberOfAyahs,
        ayahs: arSurah.ayahs.map((arAyah, idx) => {
          const enAyah = enSurah.ayahs[idx];
          return {
            numberInSurah: arAyah.numberInSurah,
            text: arAyah.text,
            translation: enAyah.text,
            juz: arAyah.juz
          };
        })
      };
    }

    const targetFile = path.join(__dirname, '..', 'assets', 'data', 'quran_offline.json');
    console.log(`Writing entire Quran details to: ${targetFile}`);
    fs.writeFileSync(targetFile, JSON.stringify(offlineQuran, null, 2));
    
    console.log('Successfully completed bundling entire Quran offline dataset!');
  } catch (err) {
    console.error('Error fetching entire Quran:', err.message);
  }
};

run();
