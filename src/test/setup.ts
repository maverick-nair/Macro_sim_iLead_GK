import { loadEngineCopy } from '../i18n/locales';

// Engine copy is worded as payloads are parsed (D83): every test file starts with the English catalog in.
await loadEngineCopy('en');
