import '../styles/global.css';
import { bootPackage } from './boot';

/**
 * The packaged participant player's entry (D200, D208): `player.html`, built by scripts/player-build.ts into
 * `dist/player`, becomes a SCORM package's index.html. It holds the participant app and its engine only:
 * none of GenieKreator, the galleries or the group report.
 */
void bootPackage(document.getElementById('root')!);
