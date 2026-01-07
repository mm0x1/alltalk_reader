# Phase 6: Nice-to-Have Features

This phase covers optional features that would enhance the application but are not critical for core functionality.

## Features

### 6.3 Text Parsing/Splitting Review

**User Request**: Review and improve parsing logic.

#### Current Issues Identified

1. (priority) No automatic A03 page parsing. The user wants to be able to copy an entire AO3 page and then paste it into the text box. The app should strip non chapter contents. Within AO3 pages, the chapter text is dneoted by a line that says "Chapter Text". However, the line before that with the Chapter Number and title sould also be included. The contents of the sections "Notes:" and "Summary:" are to be included also. The end of the chapter text is denoted by a line that states "Actions". See plans/page.txt for the full page text as it will be pasted and plans/page_parsed.txt for an example of what the "trimmed" or parsed chapter text should be. Consider an implementation of this that makes sure ther is a hard coded config values for what denotes the summary, notes, chapter title, and chapter text sections. Note that not all works have a chapter number and chapter title
2. **Double newline only**: Only splits on `\n\n`, missing other paragraph indicators

#### Improvements

## Testing Checklist

## Success Criteria
