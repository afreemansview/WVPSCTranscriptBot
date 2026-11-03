# WV PSC Transcript Bot

Speaker-attributed, cleaned transcripts of the West Virginia Public Service Commission evidentiary hearing on the NextEra Energy Transmission MidAtlantic Mid-Atlantic Resiliency Link (MARL) 500 kV line (case number read on the record as 26-000075), October 26 to 30, 2026. The source is the YouTube auto-captions of the live stream.

The goal is a site where someone asks a plain-language question and a chatbot answers with the exact quotes, each with its day, timestamp and speaker.

## What is here

| Path | What it is |
|---|---|
| `transcripts/all_days_turns.jsonl` | Every speaker turn from all five days, one JSON object per line. This is the file the chatbot searches. |
| `transcripts/<date>_transcript_speakers.docx` | Readable transcript for one day. |
| `transcripts/<date>_transcript.md` | The same transcript as Markdown. |
| `transcripts/<date>_transcript.json` | Full detail for one day: meta, speaker roster, turns. |
| `transcripts/<date>_corrections_applied.json` | How often each caption correction fired that day. |
| `data/days/<date>/source_youtube_captions.docx` | The raw caption export, as received. |
| `data/days/<date>/segments.json`, `segments.txt` | The captions split into numbered timestamped segments. |
| `data/days/<date>/speakers.txt` | Hand-made speaker annotations (see below). |
| `data/roster.json` | Speaker ids, display names and roles. |
| `data/days.tsv` | Date, day number and long date for each hearing day. |
| `pipeline/` | Scripts that build `transcripts/` from `data/`. |

## Turn format (`*_turns.jsonl`)

```json
{"hearing_date": "2026-10-30", "day": 5, "turn": 1, "t": "7:40", "sec": 460,
 "speaker": "Chairman Charlotte Lane", "role": "Chairman, Public Service Commission of West Virginia",
 "text": "corrected wording", "raw_text": "original caption wording",
 "lines": [{"t": "7:40", "sec": 460, "text": "...", "raw_text": "..."}]}
```

`t` and `sec` are the position in that day's YouTube stream where the turn starts. `lines` keeps each original caption line with its own timestamp, so a quote can be cited to the exact second.

## Speaker annotations (`speakers.txt`)

One line per speaker change: `segment_index|phrase|SPEAKER_ID`.

- Empty phrase: the speaker starts at the beginning of that segment.
- Phrase given: the speaker starts at that text inside the segment (matched in order within the segment).

Speakers were inferred from context (who was called, who was sworn, question and answer pattern). Turns that could not be attributed are labelled "Unidentified speaker".

## Caption corrections

`pipeline/corrections.py` holds ordered regular-expression fixes for misheard words: names (for example "Egnito" to Egnatoff, "Kungle" to Kunkel), places, organisations and grid terms ("moral" to MARL, "PGM" to PJM, "FK" to FERC). The build checks that no number changed between `raw_text` and `text` in any turn and fails if one did.

## Rebuild

```bash
pip install python-docx
pipeline/build_all.sh
```

To add a day: extract the caption docx (`pipeline/extract.py in.docx raw.txt`), split it (`pipeline/seg2.py raw.txt segments.json segments.txt "<title>"`), write `speakers.txt`, add a row to `data/days.tsv`, and run `build_all.sh`. `pipeline/review.py segments.json speakers.txt LO HI` prints the text around each speaker change, which helps catch annotations placed one segment early or late.

## Known uncertainties

- About 15 turns are "Unidentified speaker".
- Some names are as heard on the recording and not confirmed: the Consumer Advocate Division attorney "John" (surname unclear), Commission staff "Ryan" and "Ms. Harper", Garner Marks, Cynthia Wilson, Maya Thomas, and the spellings of Palowski, Kurt Rener and Derrick Williamson.
- One Day 1 turn heard as "Lance Evans" is attributed to Myers Evans.
