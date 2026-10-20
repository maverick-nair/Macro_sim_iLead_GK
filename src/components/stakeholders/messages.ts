import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/stakeholders.json';

/** The stakeholders panel's copy loads with it, not in the first load (D67). Import for its side effect. */
registerMessages(messages);
