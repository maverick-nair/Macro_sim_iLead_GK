import type { LmsSettings } from './settings';

/**
 * imsmanifest.xml for SCORM 1.2 and SCORM 2004 4th edition (D205): one organization with one item, one SCO
 * resource launching index.html and listing every file in the package. SCORM 1.2 carries the mastery score
 * when the pass rule is a score; SCORM 2004 declares the Leadership Score as the primary objective and one
 * objective per skill, all set by the content (the package decides pass and completion itself).
 */
export interface ManifestInput {
  /** Unique per storyline version: the storyline id and the content hash. */
  identifier: string;
  title: string;
  settings: LmsSettings;
  files: string[];
  skills: Array<{ key: string; name: string }>;
}

export const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
/** XML ids are NCNames: a letter or underscore first, then letters, digits, dots, dashes and underscores. */
export const ncName = (s: string) => { const t = s.replace(/[^A-Za-z0-9._-]/g, '_'); return /^[A-Za-z_]/.test(t) ? t : `_${t}`; };

const fileList = (files: string[]) => files.map(f => `      <file href="${xml(f)}"/>`).join('\n');

export function manifest12(m: ManifestInput): string {
  const mastery = m.settings.pass.kind === 'score' ? `\n        <adlcp:masteryscore>${m.settings.pass.min}</adlcp:masteryscore>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(ncName(m.identifier))}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${xml(m.title)}</title>
      <item identifier="item" identifierref="sco" isvisible="true">
        <title>${xml(m.title)}</title>${mastery}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sco" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileList(m.files)}
    </resource>
  </resources>
</manifest>
`;
}

export function manifest2004(m: ManifestInput): string {
  const objectives = m.skills.map(s => `            <imsss:objective objectiveID="${xml(s.key)}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${xml(ncName(m.identifier))}" version="1"
  xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
  xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
  xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
  xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org">
    <organization identifier="org">
      <title>${xml(m.title)}</title>
      <item identifier="item" identifierref="sco" isvisible="true">
        <title>${xml(m.title)}</title>
        <imsss:sequencing>
          <imsss:objectives>
            <imsss:primaryObjective objectiveID="leadership_score" satisfiedByMeasure="false"/>
${objectives}
          </imsss:objectives>
          <imsss:deliveryControls completionSetByContent="true" objectiveSetByContent="true"/>
        </imsss:sequencing>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="sco" type="webcontent" adlcp:scormType="sco" href="index.html">
${fileList(m.files)}
    </resource>
  </resources>
</manifest>
`;
}

export const imsManifest = (m: ManifestInput) => (m.settings.version === 'scorm12' ? manifest12(m) : manifest2004(m));
