/**
 * English catalog, one JSON file per feature so parallel work does not collide.
 * Add a file, import it here, and spread it into the catalog. Keys must be unique across files
 * (checked by src/i18n/catalog.test.ts).
 */
import common from './common.json';
import metric from './metric.json';
import reason from './reason.json';

export const en = { ...common, ...metric, ...reason };
