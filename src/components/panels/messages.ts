import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/panels.json';

/** The in play panels' copy loads with them, not in the first load (D67, D89). Import for its side effect. */
registerMessages(messages);
