import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/preview.json';

/** The preview bar's copy loads with it, never in a participant's first load (D191). Import for its side effect. */
registerMessages(messages);
