import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/tablet.json';

/** The tablet layouts' copy loads with them, not in the first load (D67, D73). Import for its side effect. */
registerMessages(messages);
