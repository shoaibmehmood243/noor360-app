import * as SQLite from 'expo-sqlite';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;
let resolveInit: (() => void) | null = null;

const initCompleted = new Promise<void>((resolve) => {
  resolveInit = resolve;
});

export const getDbConnection = async (): Promise<SQLite.SQLiteDatabase> => {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('noor360.db');
  return dbInstance;
};

/**
 * Block/wait until database is fully initialized
 */
export const ensureDbInitialized = async (): Promise<void> => {
  if (!initPromise) {
    // Start initializing if not already triggered
    initializeDatabase().catch(() => {});
  }
  await initCompleted;
};

/**
 * Initializes the SQLite database schema and populates it from bundled JSON assets
 * if it's the first time the app is launched.
 */
export const initializeDatabase = async (): Promise<void> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const db = await getDbConnection();

    // Check if names_of_allah table has the old structure
    try {
      const info = await db.getAllAsync("PRAGMA table_info(names_of_allah)");
      const hasArabic = info.some((col: any) => col.name === 'arabic');
      if (info.length > 0 && !hasArabic) {
        console.log('Detected outdated names_of_allah table. Recreating...');
        await db.execAsync('DROP TABLE IF EXISTS names_of_allah');
      }
    } catch (e) {
      // Table doesn't exist yet, ignore
    }

    // Check if verses table is missing the juz column
    try {
      const info = await db.getAllAsync("PRAGMA table_info(verses)");
      const hasJuz = info.some((col: any) => col.name === 'juz');
      if (info.length > 0 && !hasJuz) {
        console.log('Detected outdated verses table missing juz column. Recreating...');
        await db.execAsync('DROP TABLE IF EXISTS verses');
      }
    } catch (e) {
      // Table doesn't exist yet, ignore
    }

    // 1. Create tables if they do not exist
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS surahs (
        number INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        englishName TEXT NOT NULL,
        englishNameTranslation TEXT NOT NULL,
        revelationType TEXT NOT NULL,
        numberOfAyahs INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verses (
        id TEXT PRIMARY KEY,
        surahNumber INTEGER NOT NULL,
        verseNumber INTEGER NOT NULL,
        text TEXT NOT NULL,
        translation TEXT NOT NULL,
        juz INTEGER,
        FOREIGN KEY (surahNumber) REFERENCES surahs(number)
      );

      CREATE TABLE IF NOT EXISTS duas (
        id INTEGER PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        arabic TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        translation TEXT NOT NULL,
        reference TEXT
      );

      CREATE TABLE IF NOT EXISTS names_of_allah (
        id INTEGER PRIMARY KEY,
        arabic TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS hadith_books (
        bookSlug TEXT PRIMARY KEY,
        bookName TEXT NOT NULL,
        writerName TEXT NOT NULL,
        about TEXT
      );

      CREATE TABLE IF NOT EXISTS hadith_chapters (
        id TEXT PRIMARY KEY,
        bookSlug TEXT NOT NULL,
        chapterNumber TEXT NOT NULL,
        chapterName TEXT NOT NULL,
        chapterArabic TEXT NOT NULL,
        FOREIGN KEY (bookSlug) REFERENCES hadith_books(bookSlug)
      );

      CREATE TABLE IF NOT EXISTS hadiths (
        id TEXT PRIMARY KEY,
        bookSlug TEXT NOT NULL,
        chapterNumber TEXT NOT NULL,
        hadithNumber TEXT NOT NULL,
        hadithArabic TEXT NOT NULL,
        hadithEnglish TEXT NOT NULL,
        hadithUrdu TEXT,
        englishNarrator TEXT NOT NULL,
        arabicNarrator TEXT NOT NULL,
        urduNarrator TEXT,
        FOREIGN KEY (bookSlug) REFERENCES hadith_books(bookSlug)
      );

      CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahNumber);
      CREATE INDEX IF NOT EXISTS idx_verses_juz ON verses(juz);
      CREATE INDEX IF NOT EXISTS idx_duas_cat ON duas(category);
      CREATE INDEX IF NOT EXISTS idx_hadiths_book_chap ON hadiths(bookSlug, chapterNumber);
    `);

    // Migration helper: dynamically add new columns to hadiths table if they don't exist
    try {
      await db.execAsync('ALTER TABLE hadiths ADD COLUMN hadithUrdu TEXT;');
    } catch (_) {}
    try {
      await db.execAsync('ALTER TABLE hadiths ADD COLUMN urduNarrator TEXT;');
    } catch (_) {}

    // 2. Check if already seeded (insists on the entire Quran's 6236 verses)
    const surahCountRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM surahs');
    const verseCountRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM verses');
    const isSeeded = (surahCountRes?.count ?? 0) > 0 && (verseCountRes?.count ?? 0) >= 6236;

    if (!isSeeded) {
      console.log('Database not seeded or incomplete. Loading bundled JSON assets...');

      // Clear existing to prevent UNIQUE constraint violations on re-seeding
      await db.execAsync(`
        DELETE FROM verses;
        DELETE FROM surahs;
      `);

      // Load static data
      const surahsData = require('../../assets/data/quran_surahs.json');
      const offlineQuranData = require('../../assets/data/quran_offline.json');
      const duasData = require('../../assets/data/duas.json');
      const namesData = require('../../assets/data/names.json');

      await db.withTransactionAsync(async () => {
        // Seed Surahs metadata
        for (const s of surahsData) {
          await db.runAsync(
            `INSERT INTO surahs (number, name, englishName, englishNameTranslation, revelationType, numberOfAyahs)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [s.number, s.name, s.englishName, s.englishNameTranslation, s.revelationType, s.numberOfAyahs]
          );
        }
        console.log(`Seeded ${surahsData.length} surahs metadata into local DB.`);

        // Seed offline verse details for all Surahs
        let verseCount = 0;
        for (const surahId of Object.keys(offlineQuranData)) {
          const surahObj = offlineQuranData[surahId];
          if (surahObj && surahObj.ayahs) {
            for (const ayah of surahObj.ayahs) {
              const uniqueId = `${surahId}:${ayah.numberInSurah}`;
              await db.runAsync(
                `INSERT INTO verses (id, surahNumber, verseNumber, text, translation, juz)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [uniqueId, parseInt(surahId, 10), ayah.numberInSurah, ayah.text, ayah.translation, ayah.juz]
              );
              verseCount++;
            }
          }
        }
        console.log(`Seeded ${verseCount} popular verses into local DB.`);

        // Seed Duas
        for (const d of duasData) {
          await db.runAsync(
            `INSERT OR REPLACE INTO duas (id, category, title, arabic, transliteration, translation, reference)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [d.id || d._id, d.category, d.title, d.arabic, d.transliteration, d.translation, d.reference || '']
          );
        }
        console.log(`Seeded ${duasData.length} supplications into local DB.`);

        // Seed Names of Allah
        for (const n of namesData) {
          await db.runAsync(
            `INSERT OR REPLACE INTO names_of_allah (id, arabic, transliteration, meaning, description)
             VALUES (?, ?, ?, ?, ?)`,
            [n.number, n.arabic, n.transliteration, n.meaning, n.description || '']
          );
        }
        console.log(`Seeded ${namesData.length} Names of Allah into local DB.`);

        // Seed Hadith Books
        const hadithBooksData = require('../../assets/data/hadith_books.json');
        for (const b of hadithBooksData) {
          await db.runAsync(
            `INSERT OR REPLACE INTO hadith_books (bookSlug, bookName, writerName, about)
             VALUES (?, ?, ?, ?)`,
            [b.bookSlug, b.bookName, b.writerName, b.about || '']
          );
        }
        console.log(`Seeded ${hadithBooksData.length} Hadith Books into local DB.`);
      });

      console.log('Local SQLite Database populated successfully!');
    }
  } catch (error) {
    console.error('Failed to initialize local SQLite database:', error);
  } finally {
    if (resolveInit) resolveInit();
  }
  })();

  return initPromise;
};

/**
 * Get all Surahs from local DB
 */
export const getLocalSurahs = async (): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT * FROM surahs ORDER BY number ASC');
  } catch (e) {
    console.warn('Failed to query local surahs:', e);
    return [];
  }
};

/**
 * Get all verses of a Surah from local DB
 */
export const getLocalSurahVerses = async (surahNumber: number): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT * FROM verses WHERE surahNumber = ? ORDER BY verseNumber ASC', [surahNumber]);
  } catch (e) {
    console.warn(`Failed to query local verses for Surah ${surahNumber}:`, e);
    return [];
  }
};

/**
 * Get all verses of a Juz/Para from local DB
 */
export const getLocalJuzVerses = async (juzNumber: number): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    const rows = await db.getAllAsync(`
      SELECT 
        v.verseNumber,
        v.text,
        v.translation,
        v.juz,
        s.number as surahNumber,
        s.name as surahName,
        s.englishName as surahEnglishName,
        s.englishNameTranslation as surahEnglishNameTranslation,
        s.numberOfAyahs as surahNumberOfAyahs,
        s.revelationType as surahRevelationType
      FROM verses v
      JOIN surahs s ON v.surahNumber = s.number
      WHERE v.juz = ?
      ORDER BY v.surahNumber ASC, v.verseNumber ASC
    `, [juzNumber]);

    return rows.map((r: any) => ({
      numberInSurah: r.verseNumber,
      text: r.text,
      translation: r.translation,
      juz: r.juz,
      surah: {
        number: r.surahNumber,
        name: r.surahName,
        englishName: r.surahEnglishName,
        englishNameTranslation: r.surahEnglishNameTranslation,
        numberOfAyahs: r.surahNumberOfAyahs,
        revelationType: r.surahRevelationType
      }
    }));
  } catch (e) {
    console.warn(`Failed to query local verses for Juz ${juzNumber}:`, e);
    return [];
  }
};

/**
 * Check if a Surah's text is fully available offline
 */
export const isSurahTextOffline = async (surahNumber: number): Promise<boolean> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    const surahRes = await db.getFirstAsync<{ numberOfAyahs: number }>('SELECT numberOfAyahs FROM surahs WHERE number = ?', [surahNumber]);
    if (!surahRes) return false;

    const versesCountRes = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM verses WHERE surahNumber = ?', [surahNumber]);
    return (versesCountRes?.count ?? 0) >= surahRes.numberOfAyahs;
  } catch (e) {
    return false;
  }
};

/**
 * Save dynamically loaded verses to local DB cache
 */
export const cacheSurahVerses = async (surahNumber: number, ayahs: any[]): Promise<void> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    await db.withTransactionAsync(async () => {
      for (const ayah of ayahs) {
        const uniqueId = `${surahNumber}:${ayah.numberInSurah}`;
        // Map backend/API properties to DB schema
        const textVal = ayah.text || '';
        const transVal = ayah.translation || '';
        await db.runAsync(
          `INSERT OR REPLACE INTO verses (id, surahNumber, verseNumber, text, translation)
           VALUES (?, ?, ?, ?, ?)`,
          [uniqueId, surahNumber, ayah.numberInSurah, textVal, transVal]
        );
      }
    });
  } catch (e) {
    console.warn(`Failed to cache verses locally for Surah ${surahNumber}:`, e);
  }
};

/**
 * Get Duas by category
 */
export const getLocalDuasByCategory = async (category: string): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT * FROM duas WHERE LOWER(category) = LOWER(?) ORDER BY id ASC', [category]);
  } catch (e) {
    console.warn(`Failed to query local duas for category ${category}:`, e);
    return [];
  }
};

/**
 * Get all unique Dua categories with counts
 */
export const getLocalDuaCategories = async (): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT category, COUNT(*) as count FROM duas GROUP BY category ORDER BY category ASC');
  } catch (e) {
    console.warn('Failed to query local dua categories:', e);
    return [];
  }
};

/**
 * Get Names of Allah
 */
export const getLocalNamesOfAllah = async (): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    const rows = await db.getAllAsync('SELECT * FROM names_of_allah ORDER BY id ASC');
    return rows.map((r: any) => ({
      number: r.id,
      arabic: r.arabic,
      transliteration: r.transliteration,
      meaning: r.meaning,
      description: r.description,
    }));
  } catch (e) {
    console.warn('Failed to query local names of Allah:', e);
    return [];
  }
};

/**
 * Get all Hadith Books from local DB
 */
export const getLocalHadithBooks = async (): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT * FROM hadith_books');
  } catch (e) {
    console.warn('Failed to query local hadith books:', e);
    return [];
  }
};

/**
 * Cache Hadith Books
 */
export const cacheLocalHadithBooks = async (books: any[]): Promise<void> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    await db.withTransactionAsync(async () => {
      for (const b of books) {
        const slug = b.bookSlug || b.slug || b.id;
        const name = b.bookName || b.name || b.title;
        const writer = b.writerName || b.writer || b.author;
        const about = b.about || b.description || '';
        await db.runAsync(
          `INSERT OR REPLACE INTO hadith_books (bookSlug, bookName, writerName, about)
           VALUES (?, ?, ?, ?)`,
          [slug, name, writer, about]
        );
      }
    });
  } catch (e) {
    console.warn('Failed to cache hadith books:', e);
  }
};

/**
 * Get chapters of a Hadith Book from local DB
 */
export const getLocalHadithChapters = async (bookSlug: string): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    return await db.getAllAsync('SELECT * FROM hadith_chapters WHERE bookSlug = ? ORDER BY CAST(chapterNumber AS INTEGER) ASC', [bookSlug]);
  } catch (e) {
    console.warn(`Failed to query local chapters for book ${bookSlug}:`, e);
    return [];
  }
};

/**
 * Cache chapters of a Hadith Book
 */
export const cacheLocalHadithChapters = async (bookSlug: string, chapters: any[]): Promise<void> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    await db.withTransactionAsync(async () => {
      for (const ch of chapters) {
        const chNumber = String(ch.chapterNo || ch.chapterNumber || ch.id || '0');
        const id = `${bookSlug}:${chNumber}`;
        const chName = ch.chapterName || ch.name || '';
        const chArabic = ch.chapterArabic || ch.arabic || '';
        await db.runAsync(
          `INSERT OR REPLACE INTO hadith_chapters (id, bookSlug, chapterNumber, chapterName, chapterArabic)
           VALUES (?, ?, ?, ?, ?)`,
          [id, bookSlug, chNumber, chName, chArabic]
        );
      }
    });
  } catch (e) {
    console.warn(`Failed to cache hadith chapters for book ${bookSlug}:`, e);
  }
};

/**
 * Get paginated Hadiths from local DB
 */
export const getLocalHadiths = async (
  bookSlug: string,
  chapter: number | null,
  page = 1,
  limit = 20
): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    const offset = (page - 1) * limit;
    if (chapter !== null) {
      return await db.getAllAsync(
        `SELECT * FROM hadiths 
         WHERE bookSlug = ? AND CAST(chapterNumber AS INTEGER) = ? 
         ORDER BY CAST(hadithNumber AS INTEGER) ASC 
         LIMIT ? OFFSET ?`,
         [bookSlug, chapter, limit, offset]
      );
    } else {
      return await db.getAllAsync(
        `SELECT * FROM hadiths 
         WHERE bookSlug = ? 
         ORDER BY CAST(hadithNumber AS INTEGER) ASC 
         LIMIT ? OFFSET ?`,
        [bookSlug, limit, offset]
      );
    }
  } catch (e) {
    console.warn(`Failed to query local hadiths for book ${bookSlug}:`, e);
    return [];
  }
};

/**
 * Cache paginated Hadiths to local DB
 */
export const cacheLocalHadiths = async (bookSlug: string, hadiths: any[]): Promise<void> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    await db.withTransactionAsync(async () => {
      for (const h of hadiths) {
        const hNo = String(h.hadithNumber || h.hadithNo || h.id || '0');
        const id = `${bookSlug}:${hNo}`;
        const chNo = String(h.chapterNo || h.chapterNumber || '0');
        const hArabic = h.hadithArabic || h.arabic || h.text || '';
        const hEnglish = h.hadithEnglish || h.english || h.translation || '';
        const hUrdu = h.hadithUrdu || h.urdu || h.translationUrdu || '';
        const engNarrator = h.englishNarrator || h.narrator || '';
        const araNarrator = h.arabicNarrator || '';
        const urdNarrator = h.urduNarrator || '';
        await db.runAsync(
          `INSERT OR REPLACE INTO hadiths (id, bookSlug, chapterNumber, hadithNumber, hadithArabic, hadithEnglish, hadithUrdu, englishNarrator, arabicNarrator, urduNarrator)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, bookSlug, chNo, hNo, hArabic, hEnglish, hUrdu, engNarrator, araNarrator, urdNarrator]
        );
      }
    });
  } catch (e) {
    console.warn(`Failed to cache hadiths for book ${bookSlug}:`, e);
  }
};

/**
 * Search local Hadiths
 */
export const searchLocalHadiths = async (q: string): Promise<any[]> => {
  try {
    await ensureDbInitialized();
    const db = await getDbConnection();
    const pattern = `%${q}%`;
    return await db.getAllAsync(
      `SELECT * FROM hadiths 
       WHERE hadithEnglish LIKE ? OR hadithArabic LIKE ? OR englishNarrator LIKE ? 
       LIMIT 50`,
      [pattern, pattern, pattern]
    );
  } catch (e) {
    console.warn(`Failed to search local hadiths for query ${q}:`, e);
    return [];
  }
};
