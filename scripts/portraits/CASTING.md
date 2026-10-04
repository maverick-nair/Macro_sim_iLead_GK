# Portrait casting brief: Sales Elevator candidates

The Configuration Spec sets NPC portraits to photographic stock photos by default, with an optional
set of five mood expressions (neutral, happy, thinking, concerned, frustrated). The ten team
members already have photos. These ten hire candidates need them too: real people, no cartoons or
illustrated avatars.

Match the existing team photos: head and shoulders, facing the camera, plain light or softly blurred
office background, natural light, business casual. Any size; the script crops to 4:5 and keeps the
face in the top third. Use photos licensed for commercial use (for example Unsplash or Pexels, or a
paid stock library), and keep the source links with the files.

| File | Name | Role | Look for |
| --- | --- | --- | --- |
| ron.jpg | Ron Hackman | Lead Generation Executive | Man, mid 30s, 7 years in telemarketing, friendly and energetic |
| sheila.jpg | Sheila Frederick | Lead Generation Executive | Woman, around 30, chatty and sociable |
| ajit.jpg | Ajit Ram | Lead Qualifier | South Asian man, mid 30s, upbeat, a natural motivator |
| nate.jpg | Nate Benjamin | Lead Qualifier | Man, mid 30s, confident negotiator changing careers |
| desmond.jpg | Desmond Mart | Proposal Specialist | Man, early 30s, polished, good with clients |
| rita.jpg | Rita Sandersky | Proposal Specialist | Woman, late 20s, an executive assistant moving into sales |
| ben.jpg | Ben Lowinsky | Negotiation Specialist | Man, mid 30s, seasoned and self assured |
| nico.jpg | Nico Arnas | Negotiation Specialist | Man, mid 20s, fresh MBA graduate |
| patrick.jpg | Patrick Kent | Conversion Specialist | Man, early 20s, fresh commerce graduate |
| terrence.jpg | Terrence Paddington | Conversion Specialist | Man, late 40s, a business school professor turning to sales |

Then run:

```bash
python3 scripts/portraits/prepare.py path/to/photos
```

Mood variants are optional: `ron.happy.jpg`, `ron.concerned.jpg` and so on. Without them the one
photo is used for every mood, which is the spec's default.
