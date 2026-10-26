// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_init.sql';
import m0001 from './0001_ingredient-quantities.sql';
import m0002 from './0002_ingredient-names-lowercase.sql';
import m0003 from './0003_recipe-titles-lowercase.sql';
import m0004 from './0004_meal-history.sql';
import m0005 from './0005_recipe-photo-and-times.sql';
import m0006 from './0006_drinks.sql';
import m0007 from './0007_sort-keys-ligatures.sql';
import m0008 from './0008_drink-maturation.sql';
import m0009 from './0009_recipe-author.sql';
import m0010 from './0010_account-names.sql';
import m0011 from './0011_sync-server-versions.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007,
m0008,
m0009,
m0010,
m0011
    }
  }
  