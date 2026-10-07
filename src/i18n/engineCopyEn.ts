import type { Copy } from '../engine/copy';
import { createI18n, registerMessages } from './core';
import { wordCopy } from './engineCopy';
import en from './messages/en/engine.json';

/**
 * Engine copy worded in English, synchronously, for server side code that needs plain text (D83): the
 * AI layer's prompts and history, and the server's token stream of a turn. The participant's own screen
 * words the same codes in their language.
 */
registerMessages(en);
const english = createI18n('en');
export const wordEnglish = (c: Copy): string => wordCopy(c, english);
