import { registerMessages } from '../../i18n';
import messages from '../../i18n/messages/en/guide.json';

/** The guided tour's and the demo's copy loads with them, not in the first load (D67, D92, D94). Import for its side effect. */
registerMessages(messages);
