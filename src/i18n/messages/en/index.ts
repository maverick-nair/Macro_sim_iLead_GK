/**
 * English catalog, one JSON file per feature so parallel work does not collide.
 * Add a file, import it here, and spread it into the catalog. Keys must be unique across files
 * (checked by src/i18n/catalog.test.ts).
 */
import action from './action.json';
import common from './common.json';
import gamification from './gamification.json';
import hud from './hud.json';
import live from './live.json';
import member from './member.json';
import metric from './metric.json';
import metrics from './metrics.json';
import outcome from './outcome.json';
import palette from './palette.json';
import reason from './reason.json';
import style from './style.json';
import time from './time.json';

export const en = { ...action, ...common, ...gamification, ...hud, ...live, ...member, ...metric, ...metrics, ...outcome, ...palette, ...reason, ...style, ...time };
