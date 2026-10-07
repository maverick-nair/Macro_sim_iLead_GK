# Design canvas (approved visual source, D80)

These frames are the approved iLead 2.0 product design ("Night Studio" for play, "Paper" for the report), exported from the design canvas. They are HTML with inline styles and a small data script per frame: read them as the visual spec.

- `Main.dc.html`: foundations (palette, type pairing Manrope with Newsreader, spacing, radii, elevation, motion, targets).
- Desktop play: `Board.dc.html` (1440), `Board1024.dc.html`, `Live.dc.html`, `Events.dc.html`, `Score.dc.html`, `WeekEnd.dc.html`, `End.dc.html`.
- Report: `Report.dc.html` (web, Paper), `ReportPrint.dc.html` (letter).
- Tablet (built in D73): `TabletBoard`, `TabletDrawer`, `TabletStyles`, `TabletLive`, and `SmallScreen` (the phone notice).
- `canvas.json` lists the frames, sizes and pages.

Images written as `/_blob/<id>` are the team portraits in `public/assets/npc/`:

| Blob id | Portrait |
|---|---|
| 591e30ff8363f46b3929b9e1cc60c1d3 | kent |
| 03a9b43b1a4724fec350a8fb8b50f901 | beth |
| df764ce0defd433843ec0193ca55914d | justin |
| 9f5a55035d40bd976f042e174ffc9d22 | derick |
| 4a96b92108fe93197fa623e861a79e03 | green |
| a19adc6ec80ed6aea62b27c45c3c6a0e | lowe |
| 4b523a9a5d6fdf04e3244986868c6ec0 | jack |
| a0910603ea748084eb5db8a73e9b503d | peter |
| e19bda513a19220c24c159505e25ee17 | ruth |
| 35f2ae3bcc7eb301d495cb45854c903f | mandy |

The engine decides behaviour and copy (docs win on behaviour); these frames decide visuals. Where a frame shows sample copy that the engine or catalog already words differently, keep the engine's words.
