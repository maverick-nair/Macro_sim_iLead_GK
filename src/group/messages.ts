import { registerMessages } from '../i18n';
import messages from '../i18n/messages/en/group.json';
// The report's copy too: the group report reuses its chrome (Show as table, the toolbar, the about section).
import '../components/report/messages';

/** The group report's copy loads with it, not in the participant's first load (D67, D77). Import for its side effect. */
registerMessages(messages);
