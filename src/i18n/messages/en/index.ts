/**
 * English catalog, one JSON file per feature so parallel work does not collide.
 * Add a file, import it here, and spread it into the catalog. Keys must be unique across files
 * (checked by src/i18n/catalog.test.ts).
 */
import action from './action.json';
import common from './common.json';
import gamification from './gamification.json';
import live from './live.json';
import member from './member.json';
import metric from './metric.json';
import outcome from './outcome.json';
import palette from './palette.json';
import reason from './reason.json';
import style from './style.json';

export const en = { ...action, ...common, ...gamification, ...live, ...member, ...metric, ...outcome, ...palette, ...reason, ...style };
