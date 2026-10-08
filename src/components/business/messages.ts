import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/decision.json';

/** The decision dialog's copy loads with it, not in the first load (D67). Import for its side effect. */
registerMessages(messages);
